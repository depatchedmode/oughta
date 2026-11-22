#!/usr/bin/env bash
# One-time setup for narrated-walkthrough. Safe to re-run.
#   - checks for ffmpeg/ffprobe
#   - Playwright + Chromium for rendering slides
#   - Python virtualenv with reverb-tts (local TTS), and the default voice weights (~300 MB)
# The venv and Playwright go under ~/.local/share/narrated-walkthrough (override with
# NARRATED_WALKTHROUGH_HOME; NARRATED_WALKTHROUGH_VENV moves just the virtualenv). The downloads go
# to their tools' own caches: Reverb's weights to ~/.cache/huggingface (HF_HOME), Chromium to
# Playwright's (PLAYWRIGHT_BROWSERS_PATH). Tested on macOS with Apple Silicon.
set -euo pipefail
home=${NARRATED_WALKTHROUGH_HOME:-$HOME/.local/share/narrated-walkthrough}
venv=${NARRATED_WALKTHROUGH_VENV:-$home/venv}
mkdir -p "$home"

for tool in ffmpeg ffprobe node npm; do
  command -v "$tool" >/dev/null || { echo "missing $tool (on macOS: brew install ${tool/ffprobe/ffmpeg})" >&2; exit 1; }
done

# Playwright first: it's all slides need, so with it, builds work with macOS's voice even if
# Reverb can't be installed here.
if [ ! -f "$home/node/node_modules/playwright/package.json" ]; then
  mkdir -p "$home/node"
  (cd "$home/node" && npm init -y >/dev/null && npm install --silent playwright)
fi
(cd "$home/node" && npx --yes playwright install chromium >/dev/null)
echo "playwright $(node -p 'require(process.argv[1]).version' "$home/node/node_modules/playwright/package.json")"

# Every step returns on failure: set -e doesn't apply inside a function called from an if.
reverb() {
  local py="" candidate log
  for candidate in python3.13 python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" >/dev/null && "$candidate" -c 'import sys; sys.exit(sys.version_info < (3, 10))'; then
      py=$candidate; break
    fi
  done
  [ -n "$py" ] || { echo "reverb-tts needs Python 3.10 or later (on macOS: brew install python@3.12)" >&2; return 1; }
  if [ ! -x "$venv/bin/python" ]; then
    echo "creating $venv with $py"
    "$py" -m venv "$venv" || return 1
  fi
  "$venv/bin/pip" install -q --upgrade pip || return 1
  "$venv/bin/pip" install -q --upgrade "reverb-tts>=1,<2" || return 1
  echo "reverb-tts $("$venv/bin/pip" show reverb-tts | awk '/^Version/{print $2}')"

  echo "fetching Reverb weights"
  log=$(mktemp)
  if ! echo '{"op":"load"}' | "$venv/bin/python" -I "$(dirname "$0")/reverb_worker.py" >/dev/null 2>"$log"; then
    echo "couldn't download or load the Reverb model:" >&2
    tail -n 20 "$log" >&2
    rm -f "$log"
    return 1
  fi
  rm -f "$log"
  # Cache the preset names (tts.mjs keeps them fresh), so builds can check voice names offline.
  NARRATED_WALKTHROUGH_HOME=$home NARRATED_WALKTHROUGH_VENV=$venv node --input-type=module -e '
const { presetVoices } = await import(process.argv[1]);
const voices = presetVoices({ refresh: true });
console.log(voices ? `${voices.length} preset voices` : "couldn'"'"'t list the preset voices (offline?); builds will list them later");
' "$(cd "$(dirname "$0")" && pwd)/lib/tts.mjs"
}

if ! reverb; then
  cat >&2 <<'EOF'

Reverb isn't set up, so narration can't use it yet; fix the problem above and run setup.sh again.
Slides render already, and on macOS a build can narrate with the system voice meanwhile:
  voice: { engine: 'say', voice: 'Samantha' }   in the spec, or in config.json for this machine
EOF
  exit 1
fi
echo "ready"
