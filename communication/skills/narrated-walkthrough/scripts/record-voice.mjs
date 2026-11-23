#!/usr/bin/env node
// Record a reference sample and turn it into a reusable cloned voice for Reverb.
//
//   node record-voice.mjs <name> [--device NAME] [--seconds 14] [--text "..."] [--language en]   (macOS)
//   node record-voice.mjs <name> --from sample.wav --text "exact transcript" [--language en]   (any file)
//
// Plays a countdown tone, records, trims silence, checks length and level, clones the voice, then
// saves, in <home>/voices/ (see lib/paths.mjs):
//   <name>.wav   the trimmed reference        <name>.npz   the voice: voice: '<name>' in a spec
//   <name>.txt   the transcript               <name>.json  its language, and the speed that paces it at ~2.7 words/s
//   <name>.test.wav   a test line
// Nothing is replaced until the new voice is cloned, so a bad take never damages an existing voice.
// --device is a macOS input name (default: the system's default input). Aim for 5–10 s of speech:
// the default line takes about 10 s to read, and the recording window is a little longer.
// Only clone a voice with its owner's consent.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { NAME, SETUP, VOICES_DIR } from './lib/paths.mjs';
import { REVERB, cloneVoice, probeSeconds, reverbInstalled } from './lib/tts.mjs';

const SCRIPT =
  "Here's a quick walkthrough of what changed. Every setting now lives in git, it's checked before it ships, and the deploy copies it everywhere it's needed.";
const USAGE = 'usage: node record-voice.mjs <name> [--device NAME] [--seconds 14] [--text "..."] [--from file.wav] [--language en] [--debug]';

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: { device: { type: 'string' }, seconds: { type: 'string' }, text: { type: 'string' }, from: { type: 'string' }, language: { type: 'string' }, debug: { type: 'boolean' } },
  });
} catch (e) {
  console.error(`${e.message}\n${USAGE}`);
  process.exit(2);
}
const { values: opt, positionals } = parsed;
const name = positionals[0];
if (positionals.length !== 1 || !NAME.test(name)) {
  console.error(USAGE);
  process.exit(2);
}
const language = opt.language ?? 'en';
if (!REVERB.languages.includes(language)) {
  console.error(`--language is one of ${REVERB.languages.join(', ')} (got "${language}")`);
  process.exit(2);
}
if (!reverbInstalled()) {
  console.error(`Reverb isn't installed, so a voice can't be cloned yet. Run: ${SETUP}`);
  process.exit(1);
}
if (opt.from && !opt.text) {
  console.error('--from needs --text with the exact words spoken in the file: the voice is cloned from both.');
  process.exit(2);
}
if (!opt.from && process.platform !== 'darwin') {
  console.error('Recording from a microphone needs macOS. Record a 5–10 s sample another way and pass it with --from file.wav --text "transcript".');
  process.exit(1);
}
const text = opt.text ?? SCRIPT;
const device = opt.device ?? 'default';
const seconds = Number(opt.seconds ?? 14);

mkdirSync(VOICES_DIR, { recursive: true });
const work = path.join(VOICES_DIR, `.recording-${name}-${process.pid}`);
mkdirSync(work, { recursive: true });
const done = (code) => {
  if (!opt.debug) rmSync(work, { recursive: true, force: true });
  else console.log(`work files kept in ${work}`);
  process.exit(code);
};
const tmp = (f) => path.join(work, f);
const ff = (a) => execFileSync('ffmpeg', ['-nostdin', '-hide_banner', '-v', 'error', '-y', ...a], { stdio: ['ignore', 'ignore', 'pipe'] });
// Anything that fails from here (a --from file ffmpeg can't read, say) removes the work folder
// and says what went wrong, instead of leaving both behind.
process.on('uncaughtException', (e) => {
  console.error(`${e.stderr?.toString().trim() || e.message}\nNot saved; any existing "${name}" voice is unchanged.`);
  done(1);
});

// Wait until ffmpeg is really capturing (its progress output reports recorded time).
function capturing(rec) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`ffmpeg didn't start recording from "${device}"; list inputs with: ffmpeg -f avfoundation -list_devices true -i ""`)), 10000);
    rec.stdout.on('data', (d) => {
      buf += d;
      if ([...buf.matchAll(/out_time_us=(\d+)/g)].some((m) => Number(m[1]) > 300000)) {
        clearTimeout(timer);
        rec.stdout.removeAllListeners('data');
        rec.stdout.resume();
        resolve();
      }
    });
  });
}

// RMS level (dB) of each 50 ms of a file.
function levels(file) {
  const r = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-i', file, '-af', 'asetnsamples=2400,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level', '-f', 'null', '-'], { encoding: 'utf8' });
  return [...`${r.stdout}${r.stderr}`.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map((m) => (m[1] === '-inf' ? -120 : Number(m[1])));
}

// The countdown is recorded too (speaker into mic). Counting tones is fragile (a tick can split
// into two onsets), so find where speech starts instead: the first 1 s window that is mostly
// loud. Ticks are ~0.1 s and the chime ~0.5 s, so neither qualifies. Cut 0.2 s before it.
// Returns null when nothing qualifies (then trimming silence has to do).
function speechStart(file) {
  const lv = levels(file);
  const floor = [...lv].sort((a, b) => a - b)[Math.floor(lv.length * 0.05)];
  const loud = lv.map((x) => x > floor + 15);
  for (let i = 0; i + 20 <= loud.length; i++) {
    if (!loud[i]) continue;
    const window = loud.slice(i, i + 20).filter(Boolean).length;
    if (window >= 13) return Math.max(0, i * 0.05 - 0.2);
  }
  return null;
}

const tone = (sound) => spawnSync('afplay', [`/System/Library/Sounds/${sound}.aiff`]);

if (opt.from) {
  // A file has no countdown to cut away, so it's used whole (trimming silence below is enough):
  // cutting into it could drop words its transcript still has.
  const from = path.resolve(opt.from);
  if (!existsSync(from)) {
    console.error(`no such file: ${from}`);
    done(2);
  }
  ff(['-i', from, '-ac', '1', '-ar', '48000', tmp('raw.wav')]);
} else {
  // Capture first and keep capturing through the countdown, so a reader who starts early isn't
  // cut off; then cut away the countdown, found by sound.
  const capture = tmp('capture.wav');
  const rec = spawn('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-progress', 'pipe:1', '-stats_period', '0.1', '-f', 'avfoundation', '-i', `:${device}`, '-ac', '1', '-ar', '48000', capture], { stdio: ['pipe', 'pipe', 'inherit'] });
  const closed = new Promise((r) => rec.on('close', r));
  try {
    await capturing(rec);
  } catch (e) {
    rec.kill();
    console.error(e.message);
    done(1);
  }
  await sleep(400);
  console.log(`Read this after the third tick, when you hear the chime:\n\n  "${text}"\n`);
  for (let i = 3; i > 0; i--) {
    process.stdout.write(`${i}… `);
    tone('Tink');
    await sleep(600);
  }
  tone('Glass');
  console.log(`recording ${seconds}s from "${device}"`);
  await sleep((seconds + 1.5) * 1000); // ffmpeg drops the last ~1 s on stop
  rec.stdin.end('q'); // ffmpeg's own clean stop; it finalises the file
  await closed;
  tone('Pop');
  const cut = speechStart(capture);
  if (cut === null) console.log('no clear start of speech found; trimming silence only');
  if (opt.debug) console.log(`capture ${probeSeconds(capture).toFixed(2)}s, cut at ${cut}`);
  ff(['-ss', String(cut ?? 0), '-i', capture, '-ac', '1', '-ar', '48000', tmp('raw.wav')]);
}

// Trim leading/trailing silence, keep 0.15 s of air, gentle high-pass for rumble.
const ref = tmp(`${name}.wav`);
ff([
  '-i', tmp('raw.wav'),
  '-af',
  'highpass=f=70,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.25,areverse',
  '-ac', '1', '-ar', '48000', ref,
]);
const dur = probeSeconds(ref);
const stats = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-i', ref, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const mean = Number(/mean_volume: (-?[\d.]+)/.exec(stats)?.[1]);
const peak = Number(/max_volume: (-?[\d.]+)/.exec(stats)?.[1]);
console.log(`\nreference: ${dur.toFixed(1)}s, mean ${mean} dB, peak ${peak} dB`);
const problems = [];
if (!(dur >= 3)) problems.push('under 3 s of speech: nothing was picked up, or the mic is muted');
if (dur > 15) problems.push('over 15 s: Reverb makes worse takes from long references; record again with a shorter line, or trim it');
if (mean < -38) problems.push('very quiet: move closer to the mic (about 30 cm) or raise the input level');
if (peak > -0.5) problems.push('clipping: move back from the mic or lower the input level');
if (problems.length) {
  console.log(`\nNot saved, and any existing "${name}" voice is unchanged:\n- ${problems.join('\n- ')}`);
  done(1);
}

writeFileSync(tmp(`${name}.txt`), text);
// Reverb copies the reference's pace. Store the speed that brings it to ~2.7 words/s, so every
// recorded voice (and style) narrates at the same comfortable rate unless a spec overrides it.
const refWps = text.split(/\s+/).filter(Boolean).length / dur;
const speed = Math.min(1.2, Math.max(0.5, Number((2.7 / refWps).toFixed(2))));
// The language goes with the voice, so a spec that names it narrates in it without saying so.
writeFileSync(tmp(`${name}.json`), JSON.stringify({ language, speed, referenceWordsPerSecond: Number(refWps.toFixed(2)), seconds: Number(dur.toFixed(2)) }, null, 2));
console.log(`reference pace ${refWps.toFixed(2)} words/s → speed ${speed}`);
try {
  cloneVoice({
    audio: ref,
    text,
    language,
    npz: tmp(`${name}.npz`),
    test: tmp(`${name}.test.wav`),
    line: 'This is a test of the cloned voice. If it sounds like you, the walkthroughs will too.',
  });
} catch (e) {
  console.error(`${e.message}\nCloning failed; any existing "${name}" voice is unchanged.`);
  done(1);
}
// Swap the new voice in. The .npz goes last: a voice counts as recorded once its .npz exists.
for (const f of [`${name}.wav`, `${name}.txt`, `${name}.json`, `${name}.test.wav`, `${name}.npz`]) renameSync(tmp(f), path.join(VOICES_DIR, f));
console.log(`saved voice "${name}": ${path.join(VOICES_DIR, `${name}.npz`)}\ntest line: ${path.join(VOICES_DIR, `${name}.test.wav`)}\nuse it with voice: { voice: '${name}' }`);
done(0);
