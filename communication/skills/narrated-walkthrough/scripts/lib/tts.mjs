// Text to speech with Reverb-TTS, run locally by reverb_worker.py. Jobs [{ text, out, meta, cfg }]
// become audio files, with [{ seconds, spoken }], where spoken is the text as Reverb actually reads
// it. Results are cached by a hash of everything that affects the audio, so rebuilding after a
// one-slide edit only re-synthesises that slide.
//
// Voice config (spec.voice, repo or machine config), with defaults:
//   { voice: 'en_female_narrator', language: 'en', speed: 1.0, seed: 7, variant: 'int8' }
//   voice may be a preset name, a recorded voice's name (see record-voice.mjs), an absolute .npz
//   path, or { audio: '/abs/ref.wav', text: 'exact transcript' } to clone (3–10 s, clean, with consent).
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { HOME, NAME, SETUP, SKILL, VENV, VOICES_DIR } from './paths.mjs';

const PY = path.join(VENV, 'bin/python');
const WORKER = path.join(SKILL, 'scripts/reverb_worker.py');
const PRESETS_CACHE = path.join(HOME, 'presets.json');

export const BUILTIN_VOICE = { voice: 'en_female_narrator', language: 'en', speed: 1.0, seed: 7, variant: 'int8' };
/** What Reverb accepts, so a config can be checked before anything runs. */
export const REVERB = { languages: ['de', 'en', 'es', 'fr', 'it', 'pl', 'pt'], variants: ['int8', 'fp16', 'fp32', 'int4'] };

/**
 * Merge voice settings, lowest layer first: [[settings, where], ...]. The narrator is one thing:
 * a layer that picks a different voice drops the speed of the layers below it (a repo that picks
 * another narrator doesn't inherit the machine narrator's pace). Returns { voice, from }: the
 * merged settings and where the voice itself was chosen.
 */
export function mergeVoices(layers) {
  let voice = {};
  let from = 'built-in default';
  for (const [layer, where] of layers) {
    if (!layer) continue;
    if (layer.voice !== undefined && layer.voice !== voice.voice) {
      voice = { ...voice };
      delete voice.speed;
      from = where;
    }
    voice = { ...voice, ...layer };
  }
  return { voice, from };
}

export const reverbInstalled = () => existsSync(PY);

function callReverb(request, { quiet = false } = {}) {
  if (!reverbInstalled()) throw new Error(`Reverb isn't installed. Run: ${SETUP}`);
  const r = spawnSync(PY, ['-I', WORKER], {
    input: JSON.stringify(request),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', quiet ? 'pipe' : 'inherit'],
    maxBuffer: 64 << 20,
    env: { ...process.env, TQDM_DISABLE: '1', HF_HUB_DISABLE_PROGRESS_BARS: '1' },
  });
  if (r.status !== 0) throw new Error(`reverb worker failed (exit ${r.status})${r.stderr ? `\n${r.stderr.trim()}` : ''}`);
  return JSON.parse(r.stdout.trim().split('\n').pop());
}

// The installed reverb-tts version, so an upgrade doesn't mix takes from two models in one video.
let reverbVersionCache;
function reverbVersion() {
  if (reverbVersionCache !== undefined) return reverbVersionCache;
  reverbVersionCache = null;
  try {
    const lib = path.join(VENV, 'lib');
    for (const py of readdirSync(lib)) {
      const dist = readdirSync(path.join(lib, py, 'site-packages')).find((d) => /^reverb_tts-.*\.dist-info$/.test(d));
      if (dist) reverbVersionCache = dist.replace(/^reverb_tts-|\.dist-info$/g, '');
    }
  } catch {}
  return reverbVersionCache;
}

// Each job carries its own resolved cfg (voice and speed differ per style segment). The worker
// writes each job's .json as it finishes, so takes done before a failure stay cached.
function synth(jobs) {
  const { results } = callReverb({
    op: 'synth',
    variant: jobs[0].cfg.variant,
    jobs: jobs.map(({ text, out, meta, cfg }) => ({
      text,
      out,
      meta,
      voice: cfg.voice,
      language: cfg.language,
      speed: cfg.speed,
      seed: cfg.seed,
      steps: cfg.steps,
    })),
  });
  return results.map((r) => ({ seconds: r.seconds, spoken: r.spoken }));
}

/** Names of the voices recorded on this machine (record-voice.mjs), styles included. */
export const recordedVoices = () => {
  try {
    return readdirSync(VOICES_DIR).filter((f) => f.endsWith('.npz')).map((f) => f.slice(0, -4)).sort();
  } catch {
    return [];
  }
};

/** True if `name` is a voice recorded on this machine (record-voice.mjs). */
export const isRecorded = (name) => typeof name === 'string' && NAME.test(name) && existsSync(path.join(VOICES_DIR, `${name}.npz`));

/** A voice's short name: "alex" for alex, or for /path/alex.npz. */
export const voiceName = (voice) => (typeof voice === 'string' ? path.basename(voice, '.npz') : 'cloned voice');

/**
 * Reverb's preset voice names, cached in HOME/presets.json for a week (refresh: list them now).
 * Listing them needs the network (not the model); offline, the last list is used, and with none,
 * returns null. A failed listing isn't retried for a day, so offline builds don't each wait on
 * the network. Synthesis itself works offline once a preset has been used.
 */
export function presetVoices({ refresh = false } = {}) {
  let cache = {};
  try {
    cache = JSON.parse(readFileSync(PRESETS_CACHE, 'utf8')) ?? {};
  } catch {}
  const voices = Array.isArray(cache.voices) ? cache.voices : null;
  const day = 864e5;
  if (!refresh && ((voices && Date.now() - cache.at < 7 * day) || Date.now() - (cache.failedAt ?? 0) < day)) return voices;
  if (!reverbInstalled()) return voices;
  mkdirSync(HOME, { recursive: true });
  try {
    const listed = callReverb({ op: 'presets' }, { quiet: true }).voices;
    writeFileSync(PRESETS_CACHE, JSON.stringify({ at: Date.now(), voices: listed }));
    return listed;
  } catch {
    writeFileSync(PRESETS_CACHE, JSON.stringify({ ...cache, failedAt: Date.now() }));
    return voices; // offline: an old list beats none
  }
}

/**
 * Clone a voice from a reference recording and its exact transcript: writes npz (the voice) and
 * test (a test line read in it). Used by record-voice.mjs.
 */
export function cloneVoice({ audio, text, language = 'en', npz, test, line }) {
  callReverb({ op: 'clone', audio, text, language, npz, test, line });
}

/**
 * Which of these configured voices can't be used. A voice is a preset or recorded name, an .npz
 * path, or { audio, text } to clone (its audio must exist). Returns [{ voice, why }]. presets is
 * the preset list, or null if it couldn't be fetched (then names that aren't recorded are let
 * through, and the caller says the check didn't run).
 */
export function unknownVoices(voices, { isRecorded: recorded, exists, presets }) {
  const out = [];
  for (const v of new Set(voices)) {
    if (typeof v !== 'string') {
      if (typeof v?.audio !== 'string' || typeof v?.text !== 'string') out.push({ voice: JSON.stringify(v), why: 'a clone is { audio: "ref.wav", text: "its exact transcript" }' });
      else if (!exists(v.audio)) out.push({ voice: v.audio, why: 'no such file (the recording to clone)' });
    } else if (path.isAbsolute(v) || v.endsWith('.npz')) {
      if (!exists(v)) out.push({ voice: v, why: 'no such file' });
    } else if (!recorded(v) && presets && !presets.includes(v)) {
      out.push({ voice: v, why: "isn't a Reverb preset or a voice recorded on this machine" });
    }
  }
  return out;
}

/**
 * Check configured voices (the narrator's config value and each [voice NAME] cue) before anything
 * is rendered. Returns { unknown: [{ voice, why }], note }: note says why names weren't checked.
 */
export function checkVoices(voices) {
  const names = voices.filter((v) => typeof v === 'string' && !path.isAbsolute(v) && !v.endsWith('.npz'));
  const needPresets = names.some((n) => !isRecorded(n));
  const presets = needPresets ? presetVoices() : [];
  const note = needPresets && !presets
    ? reverbInstalled() ? "couldn't list Reverb's preset voices (offline?), so voice names weren't checked" : `Reverb isn't installed, so voice names weren't checked (run ${SETUP})`
    : null;
  return { unknown: unknownVoices(voices, { isRecorded, exists: existsSync, presets }), note };
}

/**
 * Resolve a voice config. Precedence, lowest first: built-in defaults, the recorded voice's own
 * calibration (<name>.json: the speed that brings it to ~2.7 words/s, and the language it was
 * recorded in), then the config given
 * (machine < repo < spec, merged by the caller). Returns cfg with voice resolved to a path for
 * recorded voices and voiceName kept as the short name.
 */
export function resolveVoice(voice = {}) {
  const name = voice.voice ?? BUILTIN_VOICE.voice;
  let calibration = {};
  let resolved = name;
  if (isRecorded(name)) {
    resolved = path.join(VOICES_DIR, `${name}.npz`);
    const file = path.join(VOICES_DIR, `${name}.json`);
    if (existsSync(file)) {
      try {
        const { speed, language } = JSON.parse(readFileSync(file, 'utf8'));
        if (speed) calibration.speed = speed;
        if (REVERB.languages.includes(language)) calibration.language = language;
      } catch {
        console.warn(`warn: ${file} isn't valid JSON, so "${name}" narrates at its recorded pace; record it again to fix`);
      }
    }
  }
  return { ...BUILTIN_VOICE, ...calibration, ...voice, voice: resolved, voiceName: voiceName(name) };
}

export function probeSeconds(file) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());
}

/**
 * Synthesise jobs [{ text, voice?, speed?, seed? }] into cacheDir. job.voice names a different
 * voice (a style like "alex-dry", or a [voice NAME] cue); it keeps its own calibrated speed, since
 * a configured speed is the narrator's. job.speed multiplies whichever speed applies (0.95 = 5%
 * slower); job.seed picks another take. Mutates each job, adding { audio, seconds, spoken, cached }.
 */
export function synthesize(jobs, voiceSpec, cacheDir) {
  mkdirSync(cacheDir, { recursive: true });
  const todo = []; // [{ job, text, out, meta, cfg }]
  for (const job of jobs) {
    const base = resolveVoice(job.voice ? mergeVoices([[voiceSpec], [{ voice: job.voice }]]).voice : voiceSpec);
    const cfg = { ...base, speed: Number(((base.speed ?? 1) * (job.speed ?? 1)).toFixed(3)), seed: job.seed ?? base.seed };
    // A recorded voice, or a clone's recording, can be replaced under the same name; its file time
    // keeps the cache honest.
    const file = typeof cfg.voice === 'string' ? cfg.voice : cfg.voice?.audio;
    const voiceStamp = typeof file === 'string' && existsSync(file) ? statSync(file).mtimeMs : null;
    const key = createHash('sha256').update(JSON.stringify({ cfg, voiceStamp, version: reverbVersion(), text: job.text })).digest('hex').slice(0, 20);
    job.audio = path.join(cacheDir, `${key}.wav`);
    const meta = `${job.audio}.json`;
    if (existsSync(job.audio) && existsSync(meta)) {
      Object.assign(job, JSON.parse(readFileSync(meta, 'utf8')), { cached: true });
    } else {
      todo.push({ job, text: job.text, out: job.audio, meta, cfg });
    }
  }
  if (todo.length) synth(todo).forEach((result, i) => Object.assign(todo[i].job, result, { cached: false }));
  return jobs;
}

/** The text as Reverb will read it (numbers, dates, symbols written out). */
export const prepare = (texts, voiceCfg) => callReverb({ op: 'prepare', language: resolveVoice(voiceCfg).language, texts }, { quiet: true }).texts;

/** Recorded voices, then Reverb's presets (null when they can't be listed, e.g. offline). */
export const listVoices = () => ({ recorded: recordedVoices(), presets: presetVoices() });
