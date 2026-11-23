#!/usr/bin/env node
// Build a narrated walkthrough video from a presentation spec.
//
//   node build.mjs <spec.mjs> [--out DIR] [--check] [--only 2,4-6] [--theme NAME] [--repo DIR]
//                  [--trust-repo-theme] [--force] [-- spec args...]
//
//   --check   render slides, run the layout check and the narration lint, print what the voice will
//             read. No motion, no audio, no video. Fast; use it while writing.
//   --only    limit to these slide numbers (1-based; ranges like 4-6 work), for checking or previewing
//             a few slides. Output goes to DIR/only-<ranges> (only-2_4-6), so the full build's files
//             stay as they were.
//   --theme   use this theme instead of the one the repo would get.
//   --repo    the repository the walkthrough is about (for its theme and config).
//   --trust-repo-theme  run a repo theme's decor.mjs (machine config "trustRepoThemes" does the same).
//   --force   write the video even if the layout check finds errors.
//   args after -- are passed to the spec as ctx.args (e.g. -- --repo ~/code/app).
//
// Output (DIR defaults to <spec dir>/out): <name>.mp4 (with chapters), <name>.srt, narration.md,
// captures.txt, slides/*.png, html/*.html (as checked; html/source/ as built), contact-sheet.png,
// report.json. --check writes check.json instead of report.json, as its last act.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import * as components from './lib/components.mjs';
import { launch } from './lib/browser.mjs';
import { fitAndCheck, markFootContrast } from './lib/check.mjs';
import { createCapture, formatLog, head, pick } from './lib/capture.mjs';
import { lintSpoken, makeLexicon, parseSay, resolveStyles } from './lib/narration.mjs';
import { checkSpec, resolveContext } from './lib/context.mjs';
import { ConfigError, SETUP, SKILL } from './lib/paths.mjs';
import { screenshotter } from './lib/screenshot.mjs';
import { planTimeline, rangeLabel } from './lib/timeline.mjs';
import { checkVoices, isRecorded, prepare, probeSeconds, reverbInstalled, resolveVoice, synthesize } from './lib/tts.mjs';
import { assertSafeCss, loadDecor, themeCss } from './lib/theme.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const W = 1920;
const H = 1080;
// One place for failures: a mistake in the spec or config prints its message and exits 2, an
// expected failure (an error with an exitCode) its message, and anything else its stack.
process.on('uncaughtException', (e) => {
  console.error(e instanceof ConfigError || e?.exitCode ? e.message : (e?.stack ?? String(e)));
  process.exit(e?.exitCode ?? 1);
});
const USAGE = 'usage: node build.mjs <spec.mjs> [--out DIR] [--check] [--only 2,4-6] [--theme NAME] [--repo DIR] [--trust-repo-theme] [--force] [-- spec args]';

// ---- args ----------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const dash = argv.indexOf('--');
const specArgs = dash >= 0 ? argv.slice(dash + 1) : [];
let parsed;
try {
  parsed = parseArgs({
    args: dash >= 0 ? argv.slice(0, dash) : argv,
    allowPositionals: true,
    options: {
      out: { type: 'string' }, check: { type: 'boolean' }, only: { type: 'string' }, theme: { type: 'string' },
      repo: { type: 'string' }, 'trust-repo-theme': { type: 'boolean' }, force: { type: 'boolean' },
    },
  });
} catch (e) {
  console.error(`${e.message}\n${USAGE}`);
  process.exit(2);
}
const { values: opts0, positionals } = parsed;
if (positionals.length !== 1) {
  console.error(USAGE);
  process.exit(2);
}
const specFile = path.resolve(positionals[0]);
const checkOnly = !!opts0.check;
const force = !!opts0.force;
// --only 2,4-6 → [2, 4, 5, 6]
const only = opts0.only?.split(',').flatMap((part) => {
  const m = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part);
  if (!m) {
    console.error(`--only takes slide numbers and ranges, like 2,4-6 (got "${opts0.only}")`);
    process.exit(2);
  }
  const [a, b = a] = [Number(m[1]), Number(m[2] ?? m[1])];
  return Array.from({ length: Math.max(0, b - a + 1) }, (_, k) => a + k);
});
const baseOut = path.resolve(opts0.out ?? path.join(path.dirname(specFile), 'out'));
const out = only ? path.join(baseOut, `only-${rangeLabel(only)}`) : baseOut;

// The build owns its output folder (and, for --only, the folder it sits in) and replaces what's in
// it on every run. Only do that in a folder a build made (it leaves a marker) or a new or empty one:
// never in, say, a project root that happens to have an html/ folder. Checked before the spec runs
// its captures.
const MARKER = '.narrated-walkthrough';
const outDirs = [...new Set([baseOut, out])];
for (const dir of outDirs) {
  if (existsSync(dir) && readdirSync(dir).length && !existsSync(path.join(dir, MARKER))) {
    console.error(`${dir} isn't empty and wasn't made by this build, so it won't be cleaned. Pass --out with a new or empty folder.`);
    process.exit(2);
  }
}
// One build at a time per folder: a --check that resets slides/ while a full build is still
// encoding from them would break that build. The lock holds this process's id, so one left by a
// build that was killed is taken over.
const LOCK = path.join(out, '.lock');
let claimed = false;
const claimOutput = () => {
  if (claimed) return;
  for (const dir of outDirs) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, MARKER), 'Output of narrated-walkthrough build.mjs, which replaces what it made here on every run.\n');
  }
  const holder = Number(existsSync(LOCK) && readFileSync(LOCK, 'utf8'));
  if (holder && holder !== process.pid && alive(holder)) throw new ConfigError(`another build (process ${holder}) is using ${out}; wait for it, or pass --out with another folder`);
  writeFileSync(LOCK, String(process.pid));
  process.on('exit', () => rmSync(LOCK, { force: true }));
  claimed = true;
};
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

// ---- load spec -----------------------------------------------------------------------------------
const captures = [];
const shots = screenshotter(out);
const ctx = {
  ...components,
  pick,
  head,
  args: specArgs,
  arg: (name, fallback) => (specArgs.includes(name) ? specArgs[specArgs.indexOf(name) + 1] : fallback),
  specDir: path.dirname(specFile),
  // Image paths are relative to the spec, like media slides.
  image: (src, o) => components.image(src, { ...o, base: path.dirname(specFile) }),
  capture: (o) => {
    const c = createCapture(o);
    captures.push(c);
    return c;
  },
  // A live page as a PNG for out/shots, with optional rings and captions (see lib/screenshot.mjs).
  // Shots wait in a staging folder until the build replaces its output.
  screenshot: (url, o) => {
    claimOutput();
    return shots.shoot(url, o);
  },
};
let spec;
try {
  spec = (await import(pathToFileURL(specFile).href)).default;
  if (typeof spec === 'function') spec = await spec(ctx);
} finally {
  await shots.close();
}
checkSpec(spec);
const name = spec.name ?? path.basename(specFile).replace(/\.m?js$/, '');
// Theme, brand, voice and pronunciations: machine rules (by git remote) < repo .walkthrough/config.json < spec.
const context = resolveContext({
  repo: opts0.repo ?? spec.repo ?? captures[0]?.cwd,
  repoExplicit: opts0.repo !== undefined,
  specDir: path.dirname(specFile),
  spec,
  themeOverride: opts0.theme,
});
const theme = context.theme;
console.log(`theme: ${theme.names[0]}${theme.names.length > 1 ? ` (extends ${theme.names.slice(1).join(' → ')})` : ''} · from ${context.themeWhy}${context.remote ? ` · repo ${context.remote}` : ''}`);
console.log(`       ${theme.sources[0]}`);
for (const note of theme.notes) console.log(`note: ${note}`);
const { decor, loaded: decorLoaded, skipped: decorSkipped } = await loadDecor(theme, { trustRepo: opts0['trust-repo-theme'] || context.trustRepoThemes });
for (const f of decorLoaded) console.log(`decor: ${f}`);
for (const f of decorSkipped) console.log(`note: skipped ${f}: a repo theme's decor.mjs runs only with --trust-repo-theme (or "trustRepoThemes": true in the machine config)`);
const voice = resolveVoice(context.voice);
const timing = { lead: 0.35, gap: 0.45, hold: 0.9, ...context.timing };

// ---- expand slides into steps --------------------------------------------------------------------
const lexicon = makeLexicon(context.lexicon);
const all = spec.slides.map((s, i) => ({ ...s, n: i + 1 }));
const slides = only ? all.filter((s) => only.includes(s.n)) : all;
if (only && !slides.length) throw new ConfigError(`--only ${opts0.only} matches no slides (the spec has ${all.length})`);
const problems = []; // { slide, level: 'error'|'warn', msg }
const problem = (slide, level, msg) => problems.push({ slide, level, msg });

const narrator = voice.engine === 'reverb' && typeof voice.voiceName === 'string' ? voice.voiceName : null;
const missingStyles = new Set();
for (const s of slides) {
  const says = s.say === undefined ? [] : [].concat(s.say);
  if (!says.length && !s.silent) problem(s.n, 'error', 'no narration: add say (string or array), or silent: seconds');
  s.steps = (says.length ? says : ['']).map((text, i) => {
    const { display, segments } = parseSay(text, { lexicon });
    for (const st of resolveStyles(segments, narrator, isRecorded)) missingStyles.add(st);
    return { i: i + 1, display, segments, spokenInput: segments.map((g) => g.input).join(' ').trim(), speed: s.speed, seed: s.seed };
  });
}
// Styles are recordings of the narrator, so a preset narrator reads [dry] and [up] lines in its plain voice.
for (const st of missingStyles) {
  if (isRecorded(narrator)) problem(0, 'warn', `no recorded "${narrator}-${st}" voice, so [${st}] lines use the plain voice (record one with record-voice.mjs)`);
  else console.log(`note: [${st}] lines use the plain ${narrator ?? voice.engine} voice (styles need a recorded narrator)`);
}

// Every voice the narration uses must exist before anything is rendered.
{
  const configured = [context.voice.voice ?? voice.voiceName, ...slides.flatMap((s) => s.steps.flatMap((st) => st.segments.map((g) => g.voice)))].filter(Boolean);
  const { unknown, note } = checkVoices(configured, voice.engine);
  if (note) console.log(`note: ${note}`);
  // No video can be made with a voice that doesn't exist, so this stops here, --force or not.
  if (unknown.length) {
    const lines = unknown.map(({ voice: v, why }) => `ERROR spec: voice "${v}": ${why}; speak.mjs --list shows the voices you have, and record-voice.mjs records one`);
    throw Object.assign(new Error(lines.join('\n')), { exitCode: 1 });
  }
}
if (voice.engine === 'reverb' && !reverbInstalled()) throw Object.assign(new Error(`Reverb isn't installed. Run: ${SETUP}`), { exitCode: 1 });
// --check shows what the voice will read; asking now means a voice setting the engine rejects
// (a language it doesn't speak, say) stops the check, instead of the full build later.
let readAs;
if (checkOnly) {
  try {
    readAs = prepare(slides.flatMap((s) => s.steps.flatMap((st) => st.segments.map((g) => g.input || ' '))), voice);
  } catch (e) {
    throw Object.assign(new Error(`The voice can't read this narration: ${e.message}`), { exitCode: 1 });
  }
}
// Media files: a missing one would stop the video halfway, so it stops the build now, --force or not.
// This run's screenshots are still in staging (they replace shots/ with the rest of the output),
// and nothing else may come from the output folder, which the build replaces.
const inside = (dir, file) => !path.relative(dir, file).startsWith('..') && !path.isAbsolute(path.relative(dir, file));
for (const s of slides.filter((x) => x.media)) {
  s.mediaPath = path.resolve(path.dirname(specFile), s.media);
  const shot = shots.staged(s.mediaPath);
  if (shot === null && inside(baseOut, s.mediaPath)) throw new ConfigError(`slide ${s.n}: media ${s.mediaPath} is inside the build's output folder, which every build replaces; keep it beside the spec`);
  if (!existsSync(shot ?? s.mediaPath)) throw new ConfigError(`slide ${s.n}: media not found: ${s.mediaPath}; ${shot ? 'this run took no such screenshot' : 'media paths are relative to the spec file'}`);
  if (s.steps.length > 1) throw new ConfigError(`slide ${s.n}: a media slide has one narration step; make say a single string`);
  if (/\.(png|jpe?g)$/i.test(s.media)) s.steps[0].png = s.mediaPath;
}

// ---- narration lint: things the voice will read badly ----------------------------------------------
for (const s of slides) {
  for (const st of s.steps) {
    for (const { token, what } of lintSpoken(st.spokenInput)) {
      problem(s.n, 'warn', `step ${st.i}: "${token}" looks like a ${what}; write it for the ear or add it to spec.lexicon`);
    }
  }
}

// ---- render ----------------------------------------------------------------------------------------
const css = themeCss(theme) + assertSafeCss(spec.css ?? '', 'spec.css');
// The page itself refuses the network, so a slide opened in any browser (html/*.html, to debug a
// layout) can't send what's on it anywhere either; the build's own browser also blocks it.
// Only the animation script runs, by its hash: a script or onerror= handler that reaches a slide
// through HTML (a capture in bullets, a decor that forgot esc) doesn't run, in the build or in a
// browser opening html/*.html, so it can't navigate away with what's on the slide.
const motionJs = readFileSync(path.join(here, 'lib/motion.js'), 'utf8');
const motionHash = createHash('sha256').update(motionJs).digest('base64');
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file: data:; font-src file: data:; media-src file: data:; style-src 'unsafe-inline' file: data:; script-src 'sha256-${motionHash}'">`;
const opts = theme.options;
const esc = components.esc;
const dataTheme = esc(theme.names.join(' '));
// A theme whose font lacks the middle dot can swap it (options.middleDot, e.g. " / ").
const dot = (text) => String(text).replace(/\s*·\s*/g, opts.middleDot ?? ' · ');
const motion = context.motion !== false;
const brand = context.brand;

// A number and its unit never split across lines ("48 kHz", "9 files", "3 lines"): glue them with
// a no-break space in rendered text. Code, terminals and keys are left exactly as written.
function glueNumbers(html) {
  let raw = 0;
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      const tag = part.match(/^<(\/?)(pre|code|kbd|script|style)\b/i);
      if (tag) raw += tag[1] ? -1 : 1;
      if (part.startsWith('<') || raw > 0) return part;
      return part.replace(/(\d) (?=[A-Za-zµ%°])/g, '$1\u00a0');
    })
    .join('');
}

function slideHtml(s) {
  const layout = s.media ? 'media' : s.layout ?? 'default';
  const hero = layout === 'title' || layout === 'section';
  // No label above titles unless a theme opts in with kickerStyle "plain": the heading speaks for
  // itself. On title and section slides the kicker's text (a PR or ticket number, say) becomes the
  // marquee line instead, unless the slide sets its own marquee. Themes with options.marquee show
  // the spec's title there when a slide has neither.
  const kickerAbove = opts.kickerStyle === 'plain';
  const kicker = kickerAbove && s.kicker ? `<div class="kicker">${esc(s.kicker)}</div>` : '';
  const footText = dot(context.footer ?? spec.title ?? '');
  const foot = context.footer === false || s.footer === false ? '' : `<div class="foot"><span>${esc(footText)}</span><span>${s.n} / ${all.length}</span></div>`;
  const title = s.title ? `<h1 class="title">${esc(s.title)}</h1>` : '';
  const marqueeText = dot(s.marquee ?? (kickerAbove ? undefined : s.kicker) ?? (opts.marquee ? spec.title : undefined) ?? '');
  const marquee = hero && marqueeText ? `<div class="marquee">${esc(marqueeText)}</div>` : '';
  const frame = decor.frame ? `<div class="frame">${decor.frame({ slide: s, total: all.length, brand, esc })}</div>` : '';
  const art = hero && decor.heroArt ? `<div class="hero-art">${decor.heroArt({ slide: s, esc })}</div>` : '';
  const inner = s.media
    ? ''
    : glueNumbers(`${frame}${art}${hero ? `<div class="hero-box">${kicker}${title}${marquee}</div>` : `${kicker}${title}`}<div class="content">${s.body ?? ''}</div>${foot}`);
  // lang drives quotes, hyphenation and font fallback; the narration language is the slides' language.
  return `<!doctype html><html lang="${esc(spec.lang ?? voice.language ?? 'en')}" data-theme="${dataTheme}"><head><meta charset="utf-8">${CSP}<style>${css}</style></head><body><div class="slide layout-${layout}${s.focus ? ' focus-past' : ''}">${inner}</div><script>${motionJs}</script></body></html>`;
}

const session = await launch();
const { browser } = session;
const page = await session.newPage({ viewport: { width: W, height: H } });

// ---- output: everything above can stop the build without touching the last good output ---------
claimOutput();
// --check remakes only the slides: audio/, video/ and frames/ belong to the video it keeps.
for (const dir of checkOnly ? ['slides', 'html'] : ['slides', 'html', 'audio', 'video', 'frames']) {
  rmSync(path.join(out, dir), { recursive: true, force: true });
  mkdirSync(path.join(out, dir), { recursive: true });
}
mkdirSync(path.join(out, 'html/source'));
rmSync(path.join(out, 'check.json'), { force: true });
shots.commit();
// The last video stays until this build has made its own (see the end), so a build that fails
// partway never costs the last good one. --check leaves it alone and says it's older.
rmSync(path.join(out, 'captures.txt'), { force: true });
if (checkOnly) for (const f of readdirSync(out)) if (f.endsWith('.mp4')) console.log(`note: ${path.join(out, f)} is from an earlier full build, not these slides`);
// What the spec ran and saw, so anyone can check a panel wasn't made up.
if (captures.length) writeFileSync(path.join(out, 'captures.txt'), captures.map((c) => formatLog(c.log)).join('\n\n'));
const pad = (n) => String(n).padStart(2, '0');
const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
let trackerY = null;

for (const s of slides) {
  if (s.media) continue;
  const html = path.join(out, 'html', `slide-${pad(s.n)}.html`);
  const source = slideHtml(s);
  writeFileSync(html, source);
  // As built, before the check fits panels or marks the footer (regress.mjs compares these).
  writeFileSync(path.join(out, 'html/source', `slide-${pad(s.n)}.html`), source);
  await page.goto(pathToFileURL(html).href);
  // Browsers fetch a face only when something uses it; load every declared face (each weight and
  // style) so the font check tests the files themselves, not whether this slide uses each one.
  await page.evaluate(() => Promise.all([...document.fonts].map((f) => f.load().catch(() => {}))));
  const { errors, warns, maxStep } = await page.evaluate(fitAndCheck);
  errors.forEach((m) => problem(s.n, 'error', m));
  warns.forEach((m) => problem(s.n, 'warn', m));
  if (maxStep > s.steps.length) problem(s.n, 'error', `parts reveal at step ${maxStep}, but say has ${count(s.steps.length, 'entry', 'entries')}; give say one entry per step`);
  await markFootContrast(page);
  // Keep the page as checked (panels fitted, footer marked), so html/ shows what was rendered.
  // (Read through outerHTML: page.content() here made later screenshots differ run to run.)
  writeFileSync(html, `<!doctype html>${await page.evaluate(() => document.documentElement.outerHTML)}`);
  for (const st of s.steps) {
    st.png = path.join(out, 'slides', `slide-${pad(s.n)}${s.steps.length > 1 ? `-${st.i}` : ''}.png`);
    st.frames = [];
    st.exitFrames = [];
    if (checkOnly || !motion) {
      await page.evaluate((n) => window.__motion.setStep(n), st.i);
      await page.screenshot({ path: st.png });
      continue;
    }
    // Motion: pose each frame of the step's entrance, then the resting state, then (on a slide's
    // last step) the exit. Frames are JPEG for speed; the resting frame is PNG.
    const dir = path.join(out, 'frames', `${pad(s.n)}-${st.i}`);
    mkdirSync(dir, { recursive: true });
    const { duration, trackerY: ty, exitMs } = await page.evaluate(([n, entrance, prevY]) => window.__motion.plan(n, { entrance, prevY }), [st.i, st.i === 1, trackerY]);
    trackerY = ty ?? trackerY;
    const nf = Math.ceil((duration / 1000) * FPS);
    for (let f = 0; f < nf; f++) {
      await page.evaluate((t) => window.__motion.frame(t), (f * 1000) / FPS);
      const fp = path.join(dir, `f${String(f).padStart(4, '0')}.jpg`);
      await page.screenshot({ path: fp, type: 'jpeg', quality: 94 });
      st.frames.push(fp);
    }
    await page.evaluate(() => window.__motion.finish());
    await page.screenshot({ path: st.png });
    // The video's image list must be one codec, so the resting frame goes in as JPEG too.
    st.hold = path.join(dir, 'hold.jpg');
    await page.screenshot({ path: st.hold, type: 'jpeg', quality: 94 });
    if (st.i === s.steps.length && s.n !== all.length) {
      const ne = Math.max(2, Math.round((exitMs / 1000) * FPS));
      for (let f = 1; f <= ne; f++) {
        await page.evaluate((p) => window.__motion.exit(p), f / ne);
        const fp = path.join(dir, `x${String(f).padStart(3, '0')}.jpg`);
        await page.screenshot({ path: fp, type: 'jpeg', quality: 94 });
        st.exitFrames.push(fp);
      }
    }
  }
}

// Contact sheet: every slide's final step in one image, so one look catches layout problems.
const sheet = slides.map((s) => ({ n: s.n, png: s.steps.at(-1).png, steps: s.steps.length, title: s.title ?? path.basename(s.media ?? '') }));
const cols = 4;
await page.setViewportSize({ width: 4 * 480 + 5 * 16, height: Math.ceil(sheet.length / cols) * (270 + 46) + 16 });
// A file of its own, like the slides, so its images load from disk whatever the page showed last.
const sheetHtml = path.join(out, 'html', 'contact-sheet.html');
writeFileSync(
  sheetHtml,
  `<!doctype html><meta charset="utf-8">${CSP}<body style="margin:0;padding:16px;background:#222;display:grid;grid-template-columns:repeat(${cols},480px);gap:16px;font:14px -apple-system,sans-serif;color:#ddd">${sheet
    .map(
      (x) =>
        `<div>${x.png && /\.(png|jpe?g)$/i.test(x.png) ? `<img src="${pathToFileURL(x.png).href}" style="width:480px;height:270px;display:block;object-fit:contain;background:#000">` : '<div style="width:480px;height:270px;background:#000;display:grid;place-items:center">video</div>'}<div style="padding:6px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x.n}${x.steps > 1 ? ` · ${x.steps} steps` : ''} · ${components.esc(x.title)}</div></div>`,
    )
    .join('')}</body>`,
);
await page.goto(pathToFileURL(sheetHtml).href);
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
await page.screenshot({ path: path.join(out, 'contact-sheet.png'), fullPage: true });
await browser.close();

// ---- report problems -------------------------------------------------------------------------------
const errors = problems.filter((p) => p.level === 'error');
const where = (p) => (p.slide ? `slide ${p.slide}` : 'spec');
for (const p of problems) console.log(`${p.level === 'error' ? 'ERROR' : 'warn '} ${where(p)}: ${p.msg}`);
console.log(`layout: ${count(errors.length, 'error')}, ${count(problems.length - errors.length, 'warning')}. Contact sheet: ${path.join(out, 'contact-sheet.png')}`);

if (checkOnly) {
  slides.flatMap((s) => s.steps.flatMap((st) => st.segments)).forEach((g, k) => (g.spoken = readAs[k]));
  const who = (g) => (g.voice ? `(${g.voice}) ` : g.style ? `(${g.style}?) ` : '');
  console.log("\nWhat the voice will read (after spec.lexicon and the engine's own normalisation):");
  for (const s of slides)
    for (const st of s.steps) console.log(`  ${s.n}.${st.i}  ${st.segments.map((g) => `${who(g)}${g.spoken.trim()}${g.pauseAfter ? ` [${g.pauseAfter}s]` : ''}`).join(' ')}`);
  // Last, so its presence means the check ran to the end: what it found, what the spec captured,
  // and the folders this build's paths point into (regress.mjs reads it).
  const check = {
    problems,
    captures: captures.flatMap((c) => c.log.map(({ cmd, status, out: text }) => ({ cmd, status, out: text }))),
    paths: { out, skill: SKILL, spec: path.dirname(specFile), repo: context.root },
  };
  writeFileSync(path.join(out, 'check.json'), JSON.stringify(check, null, 2));
  process.exit(errors.length ? 1 : 0);
}
if (errors.length && !force) {
  console.error('\nFix the errors above (or pass --force) before building the video.');
  process.exit(1);
}

// ---- narrate ---------------------------------------------------------------------------------------
// One job per spoken segment; each take is copied back onto the segment it reads.
const jobs = slides.flatMap((s) => s.steps.flatMap((st) => st.segments.filter((g) => g.input).map((g) => ({ seg: g, text: g.input, voice: g.voice, speed: st.speed, seed: st.seed }))));
console.log(`\nnarrating ${count(jobs.length, 'segment')} with ${voice.engine}:${voice.voiceName}`);
// One cache for the spec's output folder, shared by --only runs, so a full build reuses their takes.
synthesize(jobs, context.voice, path.join(baseOut, '.tts-cache'));
for (const { seg, audio, seconds, spoken, cached } of jobs) Object.assign(seg, { audio, seconds, spoken, cached });

// ---- timeline --------------------------------------------------------------------------------------
for (const s of slides) {
  if (s.media && !s.steps[0].png) s.mediaSeconds = probeSeconds(s.mediaPath);
  for (const st of s.steps) {
    st.frames ??= [];
    st.exitFrames ??= [];
    st.exitSeconds = st.exitFrames.length / FPS;
    st.animSeconds = st.frames.length / FPS + st.exitSeconds;
    st.spoken = st.segments.map((g) => g.spoken ?? '').join(' ').trim();
  }
}
const timeline = planTimeline(slides, { timing, fps: FPS, lang: spec.lang ?? voice.language ?? 'en' });

// ---- encode: each step's video and audio, exactly the same length -----------------------------------
const ff = (args) => execFileSync('ffmpeg', ['-nostdin', '-y', '-v', 'error', ...args]);
// A line of an ffmpeg concat list; quotes in the path are escaped the way the concat demuxer reads them.
const listFile = (f) => `file '${f.replace(/'/g, "'\\''")}'`;
const vlist = [];
const alist = [];
slides.forEach((s, si) => {
  s.steps.forEach((st, k) => {
    Object.assign(st, timeline.steps[si][k]); // start, lead, speech, frameCount, duration
    // words per second, to catch takes that came out garbled, truncated or stretched
    const said = st.segments.reduce((n, g) => n + (g.seconds ?? 0), 0);
    if (said) {
      const words = st.spokenInput.split(/\s+/).filter(Boolean).length;
      st.wps = words / said;
      if (words >= 6 && (st.wps < 1.7 || st.wps > 3.9)) problem(s.n, 'warn', `step ${st.i}: ${st.wps.toFixed(1)} words/s is unusual; listen to it, and try another seed if it sounds wrong`);
    }
    const base = `${pad(s.n)}-${st.i}`;
    const enc = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS * 10), '-frames:v', String(st.frameCount)];
    const fit = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,fps=${FPS}`;
    const v = path.join(out, 'video', `${base}.mp4`);
    if (st.png) {
      // Entrance frames, the resting frame held, then exit frames: one image list (a still is a list
      // of one), the last entry repeated as the concat demuxer needs.
      const rest = st.hold ?? st.png;
      const list = [
        ...st.frames.map((f) => `${listFile(f)}\nduration ${1 / FPS}`),
        `${listFile(rest)}\nduration ${(st.duration - st.animSeconds).toFixed(4)}`,
        ...st.exitFrames.map((f) => `${listFile(f)}\nduration ${1 / FPS}`),
        listFile(st.exitFrames.at(-1) ?? rest),
      ].join('\n');
      const lf = path.join(out, 'video', `${base}.txt`);
      writeFileSync(lf, list);
      ff(['-f', 'concat', '-safe', '0', '-i', lf, '-vf', `${fit},format=yuv420p`, ...enc, v]);
    } else ff(['-i', s.mediaPath, '-vf', `${fit},tpad=stop_mode=clone:stop_duration=3600,format=yuv420p`, '-an', ...enc, v]);
    vlist.push(listFile(v));
    // Audio in one pass: each segment's take (or silence) then its pause, joined, delayed by the
    // lead, padded and cut to the step's length.
    const a = path.join(out, 'audio', `${base}.wav`);
    const pcm = ['-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le'];
    const parts = st.segments.filter((g) => g.audio || g.pauseAfter);
    if (parts.length) {
      const inputs = parts.flatMap((g) => (g.audio ? ['-i', g.audio] : ['-f', 'lavfi', '-t', String(g.pauseAfter), '-i', 'anullsrc=r=48000:cl=mono']));
      const chains = parts.map((g, j) => `[${j}]aresample=48000,aformat=channel_layouts=mono${g.audio && g.pauseAfter ? `,apad=pad_dur=${g.pauseAfter}` : ''}[s${j}]`);
      const join = `${parts.map((_, j) => `[s${j}]`).join('')}concat=n=${parts.length}:v=0:a=1,adelay=${Math.round(st.lead * 1000)}:all=1,apad,atrim=0:${st.duration}[out]`;
      ff([...inputs, '-filter_complex', `${chains.join(';')};${join}`, '-map', '[out]', ...pcm, a]);
    } else ff(['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', String(st.duration), ...pcm, a]);
    alist.push(listFile(a));
  });
});
const { cues, chapters } = timeline;

// FFMETADATA: =, ;, # and backslash are escaped with a backslash; a newline can't be in a value.
const metaEsc = (v) => String(v).replace(/\n/g, ' ').replace(/[=;#\\]/g, (c) => `\\${c}`);
writeFileSync(path.join(out, 'video.txt'), vlist.join('\n'));
writeFileSync(path.join(out, 'audio.txt'), alist.join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', path.join(out, 'audio.txt'), '-c', 'copy', path.join(out, 'narration.wav')]);
const meta = [
  ';FFMETADATA1',
  `title=${metaEsc(spec.title ?? name)}`,
  ...chapters.flatMap((c) => ['[CHAPTER]', 'TIMEBASE=1/1000', `START=${Math.round(c.start * 1000)}`, `END=${Math.round(c.end * 1000)}`, `title=${metaEsc(c.title)}`]),
].join('\n');
writeFileSync(path.join(out, 'chapters.txt'), meta);
const final = path.join(out, `${name}.mp4`);
ff([
  '-f', 'concat', '-safe', '0', '-i', path.join(out, 'video.txt'),
  '-i', path.join(out, 'narration.wav'),
  '-i', path.join(out, 'chapters.txt'),
  '-map', '0:v', '-map', '1:a', '-map_metadata', '2', '-map_chapters', '2',
  '-c:v', 'copy',
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000',
  '-c:a', 'aac', '-b:a', '160k', '-ac', '2',
  '-movflags', '+faststart', `${final}.part.mp4`,
]);
// Into place only once it's whole, so a build stopped while joining leaves the last video intact.
renameSync(`${final}.part.mp4`, final);

// ---- captions, narration script, report ------------------------------------------------------------
const ts = (sec) => {
  const ms = Math.round(sec * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
writeFileSync(path.join(out, `${name}.srt`), cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n'));
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
writeFileSync(
  path.join(out, 'narration.md'),
  `# ${spec.title ?? name}\n\nVoice: ${voice.engine} ${voice.voiceName}, speed ${voice.speed ?? 1}\n\n` +
    slides
      .map(
        (s) =>
          `## ${s.n}. ${s.title ?? s.media} (${mmss(s.steps[0].start)})\n\n` +
          s.steps
            .map((st) => `${s.steps.length > 1 ? `**Step ${st.i}.** ` : ''}${st.display || '_(silent)_'}${st.spoken && st.spoken !== st.display ? `\n\n> read as: ${st.spoken}` : ''}`)
            .join('\n\n'),
      )
      .join('\n\n') +
    '\n',
);
const duration = probeSeconds(final);
const report = {
  video: final,
  duration,
  voice: { ...voice, voice: voice.voiceName },
  slides: slides.map((s) => ({
    n: s.n,
    title: s.title,
    start: s.steps[0].start,
    seconds: s.steps.reduce((n, st) => n + st.duration, 0),
    steps: s.steps.map((st) => ({ i: st.i, seconds: st.duration, wps: st.wps && Number(st.wps.toFixed(2)), seed: st.seed ?? voice.seed, cached: st.segments.every((g) => g.cached ?? true) })),
  })),
  problems,
};
writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
// This build's video is made: now an older one under another name can go (the spec's name may
// have changed), so the folder never holds two.
for (const f of readdirSync(out)) if (/\.(mp4|srt)$/.test(f) && f !== `${name}.mp4` && f !== `${name}.srt`) rmSync(path.join(out, f), { force: true });
for (const p of problems.filter((x) => x.msg.includes('words/s'))) console.log(`warn  ${where(p)}: ${p.msg}`);
console.log(`\n${final}\n${mmss(duration)} · ${count(slides.length, 'slide')} · ${count(jobs.length, 'narrated segment')} (${jobs.filter((j) => !j.cached).length} new)`);
