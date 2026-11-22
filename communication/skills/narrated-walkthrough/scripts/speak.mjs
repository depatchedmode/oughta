#!/usr/bin/env node
// Preview narration: hear one line in one or more voices, and see exactly what the engine reads.
//
//   node speak.mjs "Text to read." [--voice en_female_narrator,en_male_narrator_1] [--speed 1.1]
//                  [--seed 7] [--engine reverb|say] [--out DIR] [--play]
//   node speak.mjs --list [--engine say]
//
// Writes <out>/<voice>-seed<seed>.wav (default out: <home>/voice-preview, so nothing lands in the
// repo you run it from) and prints the read-as text.
// The default narrator is the machine's (config.json), read and checked as the build reads it,
// else the en_female_narrator preset; --engine and --voice replace it as a spec's voice would.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { machineNarrator } from './lib/context.mjs';
import { ConfigError, HOME, SETUP } from './lib/paths.mjs';
import { ENGINES, checkVoices, listVoices, mergeVoices, prepare, reverbInstalled, resolveVoice, synthesize, voiceName } from './lib/tts.mjs';

process.on('uncaughtException', (e) => {
  console.error(e instanceof ConfigError || e?.exitCode ? e.message : (e?.stack ?? String(e)));
  process.exit(e?.exitCode ?? 1);
});

const USAGE = 'usage: node speak.mjs "Text." [--voice a,b] [--speed 1] [--seed 7] [--engine reverb|say] [--out DIR] [--play]\n       node speak.mjs --list [--engine say]';
let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      voice: { type: 'string' }, speed: { type: 'string' }, seed: { type: 'string' }, engine: { type: 'string' },
      out: { type: 'string' }, play: { type: 'boolean' }, list: { type: 'boolean' },
    },
  });
} catch (e) {
  console.error(`${e.message}\n${USAGE}`);
  process.exit(2);
}
const { values: opt, positionals } = parsed;
if (opt.engine && !ENGINES.includes(opt.engine)) {
  console.error(`--engine is ${ENGINES.join(' or ')} (got "${opt.engine}")`);
  process.exit(2);
}
// The machine narrator, then what the command line changes (a new engine drops its voice and speed).
const base = mergeVoices([[machineNarrator().voice], [opt.engine ? { engine: opt.engine } : null]]).voice;
const engine = resolveVoice(base).engine;
if (opt.list) {
  const { recorded, presets } = listVoices({ engine });
  if (recorded.length) console.log(`recorded on this machine:\n  ${recorded.join('\n  ')}`);
  if (presets) console.log(`${engine === 'say' ? 'macOS voices' : 'Reverb presets'}:\n  ${presets.join('\n  ')}`);
  else console.log("Reverb's presets couldn't be listed (offline, or Reverb isn't installed: run setup.sh)");
  process.exit(presets || recorded.length ? 0 : 1);
}
const text = positionals.join(' ');
if (!text) {
  console.error(USAGE);
  process.exit(2);
}
// --voice a,b, else the narrator's voice (which may be a clone object), else the engine's default.
const voices = opt.voice ? opt.voice.split(',') : [base.voice ?? resolveVoice(base).voiceName];
if (engine === 'reverb' && !reverbInstalled()) {
  console.error(`Reverb isn't installed. Run: ${SETUP}\n(or try macOS's voices with --engine say)`);
  process.exit(1);
}
const { unknown, note } = checkVoices(voices, engine);
if (note) console.log(`note: ${note}`);
if (unknown.length) {
  console.error(unknown.map(({ voice: v, why }) => `voice "${v}": ${why}; speak.mjs --list shows the voices you have`).join('\n'));
  process.exit(1);
}
const out = path.resolve(opt.out ?? path.join(HOME, 'voice-preview'));
mkdirSync(out, { recursive: true });
const speed = opt.speed ? Number(opt.speed) : undefined; // default: each voice's calibrated speed
const seed = Number(opt.seed ?? 7);

console.log(`reads as: ${prepare([text], base)[0]}\n`);
for (const v of voices) {
  // Same rule as the build: the machine config's speed belongs to its own voice.
  const cfg = mergeVoices([[base], [{ voice: v, seed, ...(speed ? { speed } : {}) }]]).voice;
  const [job] = synthesize([{ text }], cfg, path.join(out, '.cache'));
  const file = path.join(out, `${voiceName(v).replace(/\W+/g, '_')}-seed${seed}.${job.audio.split('.').pop()}`);
  copyFileSync(job.audio, file);
  console.log(`${file}  ${job.seconds.toFixed(1)}s`);
  if (opt.play) execFileSync('afplay', [file]);
}
