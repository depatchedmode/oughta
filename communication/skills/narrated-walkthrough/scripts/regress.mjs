#!/usr/bin/env node
// Did a change to the skill alter the slides? Builds a spec with --check in each theme and compares
// the slides with the ones recorded earlier on this machine.
//
//   node regress.mjs record  [SPEC] [--theme a,b] [--repo DIR] [--trust-repo-theme] [-- spec args]
//   node regress.mjs compare [SPEC] [--theme a,b] [--repo DIR] [--trust-repo-theme] [--tolerance 2] [-- spec args]
//
// Record with the code from before the change, compare with the code after it: the same checkout
// at two times, or two copies of the skill (the old one records, the new one compares). SPEC
// defaults to examples/tour/spec.mjs. record builds every theme available (or --theme) and replaces
// the references only once all of them built; compare checks the themes that were recorded. The
// references live in <home>/regress, because they depend on this machine's fonts and browser.
//
// A slide's image is compared by pixel and its HTML (as built, before the layout check measures it)
// by part, so a difference says where it came from:
//   markup, styles or script changed   the build, a component or the theme made a different slide
//   drawn differently    same HTML, other pixels: the browser, a font, or an image or screenshot it shows
//   text smoothing       same HTML, pixels within --tolerance levels (default 2): ignored
//   looks the same       the HTML changed, the pixels didn't beyond the tolerance: noted
//   set aside            only the markup changed, and it shows captured output that changed (live
//                        data such as IDs or timings): listed to look at, not a failure
// Exit 0 when nothing failed, 1 when a slide, a theme or the layout check's findings changed, and 2
// on a usage error or a failed build. Compares stills only: motion and audio aren't covered.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { launch } from './lib/browser.mjs';
import { changedCaptureLines, classify, comparePngs, excerpt, showsLines, slideParts, stripPaths } from './lib/compare.mjs';
import { repoRoot } from './lib/context.mjs';
import { HOME, SKILL } from './lib/paths.mjs';
import { listThemes } from './lib/theme.mjs';

// Every failure is exit 2: exit 1 means "something changed", and a crash mustn't read as that.
process.on('uncaughtException', (e) => {
  console.error(e?.exitCode ? e.message : (e?.stack ?? String(e)));
  process.exit(2);
});
const fail = (msg) => {
  console.error(msg);
  process.exit(2);
};
const BUILD = path.join(path.dirname(fileURLToPath(import.meta.url)), 'build.mjs');
const USAGE = `usage: node regress.mjs record|compare [SPEC] [--theme a,b] [--repo DIR] [--trust-repo-theme] [--tolerance 2] [-- spec args]
  record    with the code from before your change: build SPEC in each theme and keep its slides
  compare   with the code after it: build again and say which slides changed, and how`;

// ---- args ----------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const dash = argv.indexOf('--');
const specArgs = dash >= 0 ? argv.slice(dash + 1) : [];
let parsed;
try {
  parsed = parseArgs({
    args: dash >= 0 ? argv.slice(0, dash) : argv,
    allowPositionals: true,
    options: { theme: { type: 'string' }, repo: { type: 'string' }, 'trust-repo-theme': { type: 'boolean' }, tolerance: { type: 'string' } },
  });
} catch (e) {
  fail(`${e.message}\n${USAGE}`);
}
const { values: opt, positionals } = parsed;
const [mode, specArg, ...extra] = positionals;
if (!['record', 'compare'].includes(mode) || extra.length) fail(USAGE);
const spec = path.resolve(specArg ?? path.join(SKILL, 'examples/tour/spec.mjs'));
if (!existsSync(spec)) fail(`no spec at ${spec}`);
const tolerance = Number(opt.tolerance ?? 2);
if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255) fail(`--tolerance takes a whole number of colour levels, 0–255 (got "${opt.tolerance}")`);
const named = opt.theme?.split(',').map((t) => t.trim()).filter(Boolean);
if (named && !named.length) fail('--theme takes theme names, like paper,midnight');
const repo = opt.repo && path.resolve(opt.repo);

// One folder per spec, its arguments and repo. A spec inside the skill is named by its place in the
// skill, so two copies of the skill share references; any other by its real path.
const real = realpathSync(spec);
const skill = realpathSync(SKILL);
const specKey = real.startsWith(skill + path.sep) ? `skill:${path.relative(skill, real)}` : real;
const key = `${path.basename(path.dirname(spec))}-${createHash('sha256').update(JSON.stringify([specKey, specArgs, repo ? realpathSync(repo) : null])).digest('hex').slice(0, 8)}`;
const root = path.join(HOME, 'regress', key);
const at = (theme, ...p) => path.join(root, theme, ...p);

/** Build one theme into <theme>/current. Returns its check.json, which --check writes last. */
function build(theme) {
  const out = at(theme, 'current');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(at(theme), { recursive: true });
  const args = [
    BUILD, spec, '--check', '--theme', theme, '--out', out,
    ...(repo ? ['--repo', repo] : []), ...(opt['trust-repo-theme'] ? ['--trust-repo-theme'] : []),
    ...(specArgs.length ? ['--', ...specArgs] : []),
  ];
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const log = `${r.stdout}${r.stderr}`;
  writeFileSync(at(theme, 'current.log'), log);
  // Exit 1 is also the layout check finding errors; only check.json says the check ran to the end.
  const result = path.join(out, 'check.json');
  if (r.status > 1 || !existsSync(result)) fail(`${theme}: the build failed (exit ${r.status}):\n${log.trimEnd().split('\n').slice(-15).join('\n')}\n(full log: ${at(theme, 'current.log')})`);
  return JSON.parse(readFileSync(result, 'utf8'));
}

const quote = (a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replaceAll("'", "'\\''")}'`);
const list = (xs) => xs.join(', ');
const recorded = () => (existsSync(root) ? readdirSync(root).filter((t) => existsSync(at(t, 'reference/check.json'))).sort() : []);

if (mode === 'record') {
  // The themes the build would see: the repo's, the machine's and the built-in ones.
  const available = listThemes(repo ? repoRoot(repo) : (repoRoot(path.dirname(spec)) ?? repoRoot(process.cwd()))).map((t) => t.name);
  const themes = named ?? available;
  // Every theme builds before any reference is replaced, so a failure leaves the old set whole.
  const built = themes.map((theme) => ({ theme, check: build(theme) }));
  for (const { theme, check } of built) {
    rmSync(at(theme, 'reference'), { recursive: true, force: true });
    renameSync(at(theme, 'current'), at(theme, 'reference'));
    renameSync(at(theme, 'current.log'), at(theme, 'reference.log'));
    console.log(`${theme}: recorded ${readdirSync(at(theme, 'reference/slides')).length} images · ${check.problems.length} layout problems`);
  }
  // A full record is the whole set: themes recorded before but not now would compare against old code.
  if (!named) for (const t of recorded()) if (!themes.includes(t)) rmSync(at(t), { recursive: true, force: true });
  const again = argv.map((a, k) => (k === argv.indexOf('record') ? 'compare' : a));
  console.log(`\nreferences: ${root}\nafter your change, with the code you're checking: node <that skill>/scripts/regress.mjs ${again.map(quote).join(' ')}`);
  process.exit(0);
}

// ---- compare -------------------------------------------------------------------------------------
const have = recorded();
if (!have.length) fail(`no references for this spec in ${root}: run regress.mjs record with the same spec and arguments, using the code from before your change`);
const themes = named ?? have;
const missing = themes.filter((t) => !have.includes(t));
if (missing.length) fail(`no reference for ${list(missing)}: recorded themes are ${list(have)}`);

// The themes the recorded builds could see (their repo's, the machine's, the built-in ones). One
// recorded but gone has nothing to build: a change; one here but never recorded is only noted.
const reference = (theme) => JSON.parse(readFileSync(at(theme, 'reference/check.json'), 'utf8'));
const available = listThemes(reference(have[0]).paths.repo).map((t) => t.name);
const gone = themes.filter((t) => !available.includes(t));
const unrecorded = named ? [] : available.filter((t) => !have.includes(t));

const session = await launch();
const page = await session.newPage();
let failed = gone.length > 0;
let setAside = 0;
for (const theme of themes.filter((t) => !gone.includes(t))) {
  const [ref, cur] = [at(theme, 'reference'), at(theme, 'current')];
  const before = reference(theme);
  const after = build(theme);
  const strip = (text, check) => stripPaths(text, check.paths);
  const captured = (check) => check.captures.map((c) => ({ cmd: strip(c.cmd, check), status: c.status, out: strip(c.out, check) }));
  const live = changedCaptureLines(captured(before), captured(after));
  const read = (dir, check, f) => (existsSync(path.join(dir, f)) ? strip(readFileSync(path.join(dir, f), 'utf8'), check) : null);
  const pngs = (d) => readdirSync(path.join(d, 'slides')).filter((f) => f.endsWith('.png')).sort();
  const [was, now] = [pngs(ref), pngs(cur)];
  const label = (f) => f.replace(/^slide-0?(\d+)(?:-(\d+))?\.png$/, (_, n, i) => (i ? `${n}.${i}` : n));
  const found = { same: [], smoothing: [], 'looks-same': [], live: [], drawn: [], changed: [] };
  for (const f of was.filter((f) => now.includes(f))) {
    // slide-03-2.png is step 2 of slide-03.html.
    const html = f.replace(/^(slide-\d+)(-\d+)?\.png$/, '$1.html');
    const src = [read(ref, before, `html/source/${html}`), read(cur, after, `html/source/${html}`)];
    if (src.includes(null)) fail(`${theme}: no html/source/${html} for slides/${f}; record again with this version of the skill`);
    const [a, b] = src.map(slideParts);
    const parts = ['markup', 'styles', 'script'].filter((p) => a[p] !== b[p]);
    const px = await comparePngs(page, path.join(ref, 'slides', f), path.join(cur, 'slides', f), tolerance);
    const { kind, fails } = classify({ parts, px, live: showsLines([a.markup, b.markup], live) });
    const drawn = px === null ? 'a different size' : px.over ? `max ${px.max} levels, ${px.over} px, box ${px.box.x},${px.box.y} ${px.box.w}×${px.box.h}` : `within ${px.max} levels`;
    // The page as checked differs while the source doesn't: the check measured it differently.
    const measured = !parts.length && read(ref, before, `html/${html}`) !== read(cur, after, `html/${html}`) ? '; the layout check also fitted it differently' : '';
    const [x, y] = parts.length ? excerpt(a[parts[0]], b[parts[0]]) : [];
    found[kind].push({ f, parts, max: px?.max, drawn, measured, x, y });
    failed ||= fails;
  }
  const lost = was.filter((f) => !now.includes(f)).map(label);
  const added = now.filter((f) => !was.includes(f)).map(label);
  const problems = (check) => check.problems.map((p) => `${p.level} ${p.slide ? `slide ${p.slide}` : 'spec'}: ${strip(p.msg, check)}`);
  const [pa, pb] = [problems(before), problems(after)];
  const layout = [...pa.filter((p) => !pb.includes(p)).map((p) => `fixed: ${p}`), ...pb.filter((p) => !pa.includes(p)).map((p) => `new: ${p}`)];

  console.log(`\n${theme}: ${found.same.length} of ${was.length} images unchanged`);
  if (found.smoothing.length) console.log(`  text smoothing only (max level difference): ${list(found.smoothing.map((c) => `${label(c.f)} (${c.max})`))}`);
  if (found['looks-same'].length) console.log(`  HTML changed but the slide looks the same: ${list(found['looks-same'].map((c) => `${label(c.f)} (${list(c.parts)})`))}`);
  const show = (c, why) => {
    console.log(`  slide ${label(c.f)}: ${why}`);
    if (c.x) console.log(`    before: ${c.x}\n    after:  ${c.y}`);
    console.log(`    ${path.join(ref, 'slides', c.f)}\n    ${path.join(cur, 'slides', c.f)}`);
  };
  for (const c of found.live) show(c, `set aside: it shows captured output that changed; look at it (${c.drawn})`);
  for (const c of found.drawn) show(c, `drawn differently (same HTML): ${c.drawn}${c.measured}`);
  for (const c of found.changed) show(c, `${list(c.parts)} changed: ${c.drawn}`);
  if (lost.length) console.log(`  gone: ${list(lost)}`);
  if (added.length) console.log(`  new: ${list(added)}`);
  for (const l of layout) console.log(`  layout check ${l}`);
  setAside += found.live.length;
  if (lost.length || added.length || layout.length) failed = true;
}
await session.browser.close();

if (gone.length) console.log(`\nrecorded, but no longer a theme: ${list(gone)}`);
if (unrecorded.length) console.log(`\nnot recorded, so not compared: ${list(unrecorded)}`);
console.log(failed ? '\nchanged: see above' : setAside ? `\nno changes, but ${setAside} set aside: look at them` : '\nno changes');
process.exit(failed ? 1 : 0);
