// Which theme, brand, voice and pronunciations apply to a walkthrough, and why.
//
// Layers, lowest first (later wins):
//   1. built-in defaults
//   2. machine config   <home>/config.json (see paths.mjs)
//        { "voice": {...}, "themes": [ { "match": "github.com/acme/*", "theme": "acme" },
//                                       { "match": "*", "theme": "paper" } ] }
//      The first rule whose pattern matches the repo's git remote (origin) picks the theme.
//   3. repo config      <repo>/.walkthrough/config.json
//        { "theme": "name" | { "extends": "midnight", "tokens": {...}, "brand": {...} },
//          "brand": {...}, "footer": "...", "voice": {...}, "lexicon": {...}, "timing": {...}, "motion": true }
//   4. the spec itself (and --theme on the command line)
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ConfigError, HOME, MACHINE_CONFIG, NAME, machineConfig, readJson } from './paths.mjs';
import { FALLBACK_THEME, loadTheme, withLogo } from './theme.mjs';
import { ENGINES, REVERB, mergeVoices } from './tts.mjs';

const git = (dir, args) => {
  try {
    return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

export function repoRoot(dir) {
  return dir && existsSync(dir) ? git(dir, ['rev-parse', '--show-toplevel']) : null;
}

/**
 * A remote URL as host/owner/repo: https://github.com/a/b.git and git@github.com:a/b both →
 * github.com/a/b. Only a URL (scheme://) can have a port; in git's user@host:path form everything
 * after the colon is the path, so git@github.com:37signals/kamal is github.com/37signals/kamal.
 */
export function normalizeRemote(url) {
  const scheme = /^[a-z][a-z0-9+.-]*:\/\//i;
  const rest = scheme.test(url) ? url.replace(scheme, '').replace(/^[^@/]+@/, '') : url.replace(/^[^@/]+@/, '').replace(/^([^/:]+):/, '$1/');
  return rest.replace(/\/+$/, '').replace(/\.git$/, '');
}

export function remoteOf(root) {
  const url = root && git(root, ['remote', 'get-url', 'origin']);
  return url ? normalizeRemote(url) : null;
}

/** Does a machine rule's pattern (with * wildcards, case-insensitive) match this remote? */
export const matchesRule = (glob, remote) => new RegExp(`^${glob.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 'i').test(remote ?? '');

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const show = (v) => JSON.stringify(v);
// Limits, so a config (perhaps a repo's) can't ask for hours of still frames or a stalled engine.
const MAX_PAUSE = 30; // lead, gap, hold: seconds
const MAX_SILENT = 600; // a silent slide: seconds
const MAX_TTS_STEPS = 200; // Reverb's sampling steps
const SPEED = [0.25, 4];
const isSpeed = (v) => typeof v === 'number' && v >= SPEED[0] && v <= SPEED[1];

/**
 * Check one config layer (a repo config or a spec) once, where it enters, so a wrong type stops
 * the build with the file's name instead of failing later inside ffmpeg. Returns the layer.
 */
export function checkConfig(c, where) {
  if (!c) return c;
  const bad = (msg) => {
    throw new ConfigError(`${where}: ${msg}`);
  };
  if (c.timing !== undefined) {
    if (!isObject(c.timing)) bad(`"timing" is an object like { "lead": 0.35, "gap": 0.45, "hold": 0.9 } (got ${show(c.timing)})`);
    for (const [k, v] of Object.entries(c.timing)) {
      if (!['lead', 'gap', 'hold'].includes(k)) bad(`timing has lead, gap and hold, not "${k}"`);
      if (typeof v !== 'number' || !(v >= 0 && v <= MAX_PAUSE)) bad(`timing.${k} is a number of seconds from 0 to ${MAX_PAUSE} (got ${show(v)})`);
    }
  }
  if (c.motion !== undefined && typeof c.motion !== 'boolean') bad(`"motion" is true or false (got ${show(c.motion)})`);
  if (c.footer !== undefined && c.footer !== false && typeof c.footer !== 'string') bad(`"footer" is text, or false to hide it (got ${show(c.footer)})`);
  if (c.lexicon !== undefined) {
    if (!isObject(c.lexicon)) bad(`"lexicon" maps display text to spoken text, like { "APP-412": "A P P four twelve" } (got ${show(c.lexicon)})`);
    for (const [k, v] of Object.entries(c.lexicon)) if (!k.trim() || typeof v !== 'string') bad(`lexicon entries are non-empty text → text (got ${show(k)}: ${show(v)})`);
  }
  if (c.brand !== undefined && !isObject(c.brand)) bad(`"brand" is an object like { "name": "Acme" } (got ${show(c.brand)})`);
  if (c.voice !== undefined) {
    const v = c.voice;
    if (!isObject(v)) bad(`"voice" is an object like { "voice": "en_female_narrator" } (got ${show(v)})`);
    const clone = isObject(v.voice) && typeof v.voice.audio === 'string' && typeof v.voice.text === 'string';
    if (v.voice !== undefined && typeof v.voice !== 'string' && !clone) bad(`voice.voice is a voice name, an .npz path, or { "audio": "ref.wav", "text": "transcript" } (got ${show(v.voice)})`);
    if (v.speed !== undefined && !isSpeed(v.speed)) bad(`voice.speed is a number from ${SPEED[0]} to ${SPEED[1]} (got ${show(v.speed)})`);
    if (v.rate !== undefined && (typeof v.rate !== 'number' || !(v.rate >= 50 && v.rate <= 600))) bad(`voice.rate is words per minute, from 50 to 600 (got ${show(v.rate)})`);
    if (v.seed !== undefined && !(Number.isInteger(v.seed) && v.seed >= 0)) bad(`voice.seed is a whole number (got ${show(v.seed)})`);
    if (v.steps !== undefined && !(Number.isInteger(v.steps) && v.steps >= 1 && v.steps <= MAX_TTS_STEPS)) bad(`voice.steps is a whole number from 1 to ${MAX_TTS_STEPS} (got ${show(v.steps)})`);
    if (v.engine !== undefined && !ENGINES.includes(v.engine)) bad(`voice.engine is ${ENGINES.join(' or ')} (got ${show(v.engine)})`);
  }
  return c;
}

/** The merged narrator: things that only make sense once the layers are combined. */
function checkVoice(v, where) {
  if ((v.engine ?? 'reverb') !== 'reverb') return v;
  const bad = (msg) => {
    throw new ConfigError(`${where}: ${msg}`);
  };
  if (v.language !== undefined && !REVERB.languages.includes(v.language)) bad(`voice.language is one of ${REVERB.languages.join(', ')} (got ${show(v.language)})`);
  if (v.variant !== undefined && !REVERB.variants.includes(v.variant)) bad(`voice.variant is one of ${REVERB.variants.join(', ')} (got ${show(v.variant)})`);
  return v;
}

/** Is this a language tag the browser and the caption splitter understand ("en", "pt-BR")? */
const isLang = (tag) => {
  try {
    return typeof tag === 'string' && Intl.getCanonicalLocales(tag).length === 1 && !!new Intl.Segmenter(tag);
  } catch {
    return false;
  }
};

const LAYOUTS = ['default', 'title', 'section'];

/**
 * Check a spec's shape (its slides and their fields) before anything runs, so a mistake stops
 * the build with the slide's number instead of failing halfway through. Its config fields
 * (theme, voice, timing...) are checked by resolveContext.
 */
export function checkSpec(spec) {
  const bad = (msg) => {
    throw new ConfigError(`the spec: ${msg}`);
  };
  if (!isObject(spec)) bad('export an object, or a function that returns one, with title and slides');
  // name becomes the video's file name in the output folder.
  if (spec.name !== undefined && !(typeof spec.name === 'string' && NAME.test(spec.name))) bad(`name is letters, digits, - and _, like "pr-92" (got ${show(spec.name)})`);
  for (const k of ['title', 'repo']) if (spec[k] !== undefined && typeof spec[k] !== 'string') bad(`${k} is text (got ${show(spec[k])})`);
  if (spec.lang !== undefined && !isLang(spec.lang)) bad(`lang is a language tag like "en" or "pt-BR" (got ${show(spec.lang)})`);
  if (!Array.isArray(spec.slides) || !spec.slides.length) bad('"slides" is a list with at least one slide');
  spec.slides.forEach((s, i) => {
    const at = `slide ${i + 1}`;
    if (!isObject(s)) bad(`${at} is an object like { title, say }`);
    if (s.say !== undefined && ![].concat(s.say).every((x) => typeof x === 'string')) bad(`${at}: say is text, or a list of text with one entry per step`);
    for (const k of ['title', 'kicker', 'marquee', 'body']) if (s[k] !== undefined && typeof s[k] !== 'string') bad(`${at}: ${k} is text (got ${show(s[k])})`);
    if (s.layout !== undefined && !LAYOUTS.includes(s.layout)) bad(`${at}: layout is ${LAYOUTS.join(', ')} (got ${show(s.layout)})`);
    if (s.media !== undefined && (typeof s.media !== 'string' || !/\.(png|jpe?g|mp4|webm|mov)$/i.test(s.media))) bad(`${at}: media is a .png, .jpg, .mp4, .webm or .mov file (got ${show(s.media)})`);
    for (const k of ['lead', 'gap', 'hold', 'silent']) {
      const max = k === 'silent' ? MAX_SILENT : MAX_PAUSE;
      if (s[k] !== undefined && (typeof s[k] !== 'number' || !(s[k] >= 0 && s[k] <= max))) bad(`${at}: ${k} is a number of seconds from 0 to ${max} (got ${show(s[k])})`);
    }
    if (s.speed !== undefined && !isSpeed(s.speed)) bad(`${at}: speed is a number from ${SPEED[0]} to ${SPEED[1]} (got ${show(s.speed)})`);
    if (s.seed !== undefined && !Number.isInteger(s.seed)) bad(`${at}: seed is a whole number (got ${show(s.seed)})`);
  });
  return spec;
}

/** The machine config's theme rules and voice. */
function checkMachine(m) {
  const bad = (msg) => {
    throw new ConfigError(`${MACHINE_CONFIG}: ${msg}`);
  };
  if (m.themes !== undefined && !(Array.isArray(m.themes) && m.themes.every((r) => isObject(r) && typeof r.match === 'string' && r.theme !== undefined))) {
    bad('"themes" is a list of rules like { "match": "github.com/acme/*", "theme": "acme" }');
  }
  if (m.trustRepoThemes !== undefined && typeof m.trustRepoThemes !== 'boolean') bad('"trustRepoThemes" is true or false');
  return checkConfig(m, MACHINE_CONFIG);
}

/** A voice file (an .npz, or a recording to clone) is relative to the file that set it. */
function withVoicePath(voice, dir) {
  const v = voice?.voice;
  if (!dir || !v) return voice;
  if (typeof v === 'string' && v.endsWith('.npz') && !path.isAbsolute(v)) return { ...voice, voice: path.resolve(dir, v) };
  if (isObject(v) && typeof v.audio === 'string' && !path.isAbsolute(v.audio)) return { ...voice, voice: { ...v, audio: path.resolve(dir, v.audio) } };
  return voice;
}

/**
 * The machine's narrator (config.json "voice"), checked and with its files resolved, as the build
 * uses it: for tools that run outside a repo, like speak.mjs. Returns { voice, from }.
 */
export function machineNarrator() {
  const merged = mergeVoices([[withVoicePath(checkMachine(machineConfig()).voice, HOME), MACHINE_CONFIG]]);
  checkVoice(merged.voice, merged.from);
  return merged;
}

/**
 * Resolve everything that isn't the slides: the repo, its config, the theme and where each came from.
 *   repo: a path inside the repository the walkthrough is about. If it was given explicitly
 *         (--repo) and isn't a git repo, there is no repo: no repo config, no remote. Otherwise it
 *         falls back to specDir's repo, then the current directory's.
 *   spec: the loaded spec object (its theme/brand/voice/lexicon win)
 *   themeOverride: --theme from the command line
 */
export function resolveContext({ repo, repoExplicit = false, specDir, spec = {}, themeOverride } = {}) {
  const root = repoExplicit ? repoRoot(repo) : (repoRoot(repo) ?? repoRoot(specDir) ?? repoRoot(process.cwd()));
  const remote = remoteOf(root);
  const machine = checkMachine(machineConfig());
  const repoConfigFile = root ? path.join(root, '.walkthrough/config.json') : null;
  const repoDir = repoConfigFile && path.dirname(repoConfigFile);
  const repoConfig = checkConfig((repoConfigFile && readJson(repoConfigFile)) ?? {}, repoConfigFile);
  checkConfig(spec, 'the spec');

  // [theme, why, the folder an inline theme's paths are relative to]
  let pick;
  if (themeOverride) pick = [themeOverride, '--theme on the command line'];
  else if (spec.theme) pick = [spec.theme, 'the spec', specDir];
  else if (repoConfig.theme) pick = [repoConfig.theme, repoConfigFile, repoDir];
  else {
    const rule = (machine.themes ?? []).find((r) => matchesRule(r.match, remote));
    if (rule) pick = [rule.theme, `rule "${rule.match}" in ${MACHINE_CONFIG}`, HOME];
    else pick = [machine.theme ?? FALLBACK_THEME, machine.theme ? MACHINE_CONFIG : 'built-in default', HOME];
  }
  const [themeRef, why, base] = pick;
  const theme = loadTheme(themeRef, root, { base });
  const { voice, from: voiceWhy } = mergeVoices([
    [withVoicePath(machine.voice, HOME), MACHINE_CONFIG],
    [withVoicePath(repoConfig.voice, repoDir), repoConfigFile],
    [withVoicePath(spec.voice, specDir), 'the spec'],
  ]);
  checkVoice(voice, voiceWhy);
  return {
    root,
    remote,
    theme,
    themeWhy: why,
    repoConfigFile: repoConfigFile && existsSync(repoConfigFile) ? repoConfigFile : null,
    // A brand's logo is a path relative to where it was set; decor gets it as an encoded URL.
    brand: { ...theme.brand, ...withLogo(repoConfig.brand, repoDir), ...withLogo(spec.brand, specDir) },
    footer: spec.footer ?? repoConfig.footer,
    voice,
    voiceWhy,
    lexicon: { ...repoConfig.lexicon, ...spec.lexicon },
    timing: { ...repoConfig.timing, ...spec.timing },
    motion: spec.motion ?? repoConfig.motion ?? true,
    trustRepoThemes: machine.trustRepoThemes === true,
  };
}
