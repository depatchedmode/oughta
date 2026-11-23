# Narrated walkthrough

Agents load [SKILL.md](SKILL.md); this file is for people.

## Requirements

Node 18.3 or newer, ffmpeg, and Python 3.10 or newer; `scripts/setup.sh` installs the rest: Playwright
and Reverb under `~/.local/share/narrated-walkthrough`, with their own caches holding the
downloads (Reverb's model, about 300 MB, in `~/.cache/huggingface`; Chromium in Playwright's
browser cache, `~/Library/Caches/ms-playwright` on macOS). Tested on
macOS with Apple Silicon. Recording your own voice with `scripts/record-voice.mjs` needs macOS;
elsewhere, pass it an existing recording with `--from`. If Reverb can't be set up (Python too old,
say), `setup.sh` still installs Playwright and says so, and builds can narrate with macOS's voice
(`voice: { engine: 'say' }`) meanwhile.

`node --test tests/*.test.mjs` runs the tests: narration, voices, themes, and check builds against
a fixture theme (those need Playwright from `setup.sh`, and skip without it). The example tour,
`examples/tour/spec.mjs`, doubles as a smoke test:
`node scripts/build.mjs examples/tour/spec.mjs --check --out "$(mktemp -d)/tour"`.

To see whether a change to the skill alters the slides, run `node scripts/regress.mjs record` with
the code from before it and `node scripts/regress.mjs compare` with the code after: the same checkout
at two times, or an old copy of the skill recording and a new one comparing. It builds the tour (or a
spec you name) with `--check` in every theme, compares each slide's pixels and its HTML as built, and
says why a slide differs: its markup, styles or script, the browser drawing the same HTML differently,
or captured output on the slide changing (live data like IDs, which it sets aside for you to look
at). Differences of a colour level or two from text smoothing are ignored (`--tolerance`). It exits
1 when something changed and 2 when a build failed. References live in the machine's home folder,
since they depend on its fonts and browser. It checks stills, not motion or audio.

## Credits

- The skill grew out of the video step of `ux-auto-improve` in Dennison Bertram's
  [developer-skill-pack](https://github.com/dennisonbertram/developer-skill-pack) (MIT).
  `scripts/annotate.mjs` comes from there; its notice is at the top of the file.
- Narration runs on [Reverb-TTS](https://github.com/software-mansion-labs/Reverb-TTS) by Software
  Mansion Labs, which `scripts/setup.sh` installs. Its code is Apache-2.0, but its model weights
  are CC BY-NC 4.0, so check that your use is non-commercial.
- The endless theme uses DM Sans and DM Mono, under the SIL Open Font License (licence files in
  `themes/endless/fonts/`).

## Licence

MIT (see LICENSE in the plugin folder, next to `skills/`), except as noted above and the endless
theme's artwork, which has its own terms in `themes/endless/art/README.md`.
