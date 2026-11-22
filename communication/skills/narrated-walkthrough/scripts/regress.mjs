#!/usr/bin/env node
// Did a change alter the slides? Builds a spec with --check in each theme and compares the slides
// with the ones recorded earlier on this machine.
//
//   node regress.mjs record  [SPEC] [--theme a,b] [--repo DIR] [--trust-repo-theme] [-- spec args]
//   node regress.mjs compare [SPEC] [--theme a,b] [--repo DIR] [--trust-repo-theme] [--tolerance 2] [-- spec args]
//
// SPEC defaults to examples/tour/spec.mjs, and --theme to every theme available here. Record before
// the change, compare after it. References live in <home>/regress, because they depend on this
// machine's fonts and browser. Another copy of the skill can record or compare (record with the
// old checkout, compare with the new): paths into the skill's folder don't count as differences.
//
// Each slide's HTML is compared as well as its pixels, so a difference says where it came from:
//   markup or styles changed   the build or the theme made a different slide
//   drawn differently          same HTML, different pixels: the browser or a font changed
//   text smoothing             same HTML, pixels within --tolerance levels (default 2): ignored
//   looks the same             the HTML changed but not a pixel did: noted, not a failure
//   set aside                  the markup changed and so did the spec's captured output (live data,
//                              like IDs or timings), so the difference may be the data: look at it
// Exit 0 when nothing changed but smoothing or set-aside slides, 1 when something did, 2 on a usage
// or build failure. Compares stills only: motion and audio aren't covered.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { launch } from './lib/browser.mjs';
import { repoRoot } from './lib/context.mjs';
import { HOME, SKILL } from './lib/paths.mjs';
import { listThemes } from './lib/theme.mjs';

const BUILD = path.join(path.dirname(fileURLToPath(import.meta.url)), 'build.mjs');
const USAGE = `usage: node regress.mjs record|compare [SPEC] [--theme a,b] [--repo DIR] [--trust-repo-theme] [--tolerance 2] [-- spec args]
  record    build SPEC in each theme and keep its slides as the reference
  compare   build it again and say which slides changed, and how`;

const fail = (msg) => {
  console.error(msg);
  process.exit(2);
};

/**
 * Compare two PNGs pixel by pixel in the browser (no image library needed). Returns null when the
 * sizes differ, else { max, over, box }: the largest channel difference, how many pixels differ by
 * more than tolerance, and the box around them (or around every difference, when none is over).
 */
export async function comparePngs(page, a, b, tolerance) {
  const [ba, bb] = [readFileSync(a), readFileSync(b)];
  if (ba.equals(bb)) return { max: 0, over: 0, box: null };
  return page.evaluate(
    async ([a64, b64, tol]) => {
      const pixels = async (b64) => {
        const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
        const g = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d');
        g.drawImage(bmp, 0, 0);
        return g.getImageData(0, 0, bmp.width, bmp.height);
      };
      const [pa, pb] = await Promise.all([pixels(a64), pixels(b64)]);
      if (pa.width !== pb.width || pa.height !== pb.height) return null;
      let max = 0;
      let over = 0;
      const any = [Infinity, Infinity, -1, -1];
      const big = [Infinity, Infinity, -1, -1];
      const grow = (r, x, y) => {
        r[0] = Math.min(r[0], x);
        r[1] = Math.min(r[1], y);
        r[2] = Math.max(r[2], x);
        r[3] = Math.max(r[3], y);
      };
      for (let i = 0; i < pa.data.length; i += 4) {
        let d = 0;
        for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(pa.data[i + c] - pb.data[i + c]));
        if (!d) continue;
        const p = i / 4;
        const [x, y] = [p % pa.width, Math.floor(p / pa.width)];
        max = Math.max(max, d);
        grow(any, x, y);
        if (d > tol) {
          over++;
          grow(big, x, y);
        }
      }
      const r = over ? big : any;
      return { max, over, box: r[2] < 0 ? null : { x: r[0], y: r[1], w: r[2] - r[0] + 1, h: r[3] - r[1] + 1 } };
    },
    [ba.toString('base64'), bb.toString('base64'), tolerance],
  );
}

/**
 * A slide's HTML in three parts, with the output folder's and the skill's paths taken out, so two
 * folders, or builds by two copies of the skill (before and after a change), compare.
 */
export function slideParts(html, out, skill = SKILL) {
  let plain = html;
  for (const [dir, as] of [[out, 'OUT'], [skill, 'SKILL']]) plain = plain.replaceAll(pathToFileURL(dir).href, as).replaceAll(dir, as);
  const styles = [...plain.matchAll(/<style>[\s\S]*?<\/style>/g)].join('');
  const script = [...plain.matchAll(/<script>[\s\S]*?<\/script>|<meta http-equiv="Content-Security-Policy"[^>]*>/g)].join('');
  const markup = plain.replace(/<style>[\s\S]*?<\/style>|<script>[\s\S]*?<\/script>|<meta http-equiv="Content-Security-Policy"[^>]*>/g, '');
  return { markup, styles, script };
}

/** Where two strings first differ, as a short excerpt of each. */
function excerpt(a, b) {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  const cut = (s) => `${i > 40 ? '…' : ''}${s.slice(Math.max(0, i - 40), i + 80).replace(/\s+/g, ' ')}${s.length > i + 80 ? '…' : ''}`;
  return [cut(a), cut(b)];
}

const box = (r) => (r ? `${r.x},${r.y} ${r.w}×${r.h}` : '');
const list = (xs) => xs.join(', ');

// ---- args ----------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

async function main() {
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
  const repo = opt.repo && path.resolve(opt.repo);
  const available = listThemes(repoRoot(repo)).map((t) => t.name);
  const themes = opt.theme ? opt.theme.split(',').map((t) => t.trim()).filter(Boolean) : available;
  for (const t of themes) if (!available.includes(t)) fail(`no theme "${t}" here; themes: ${list(available)}`);

  // One folder per spec, its arguments and repo, so two specs both called spec.mjs don't share one.
  const key = `${path.basename(path.dirname(spec))}-${createHash('sha256').update(JSON.stringify([spec, specArgs, repo ?? null])).digest('hex').slice(0, 8)}`;
  const root = path.join(HOME, 'regress', key);
  const buildArgs = (theme, out) => [
    BUILD, spec, '--check', '--theme', theme, '--out', out,
    ...(repo ? ['--repo', repo] : []), ...(opt['trust-repo-theme'] ? ['--trust-repo-theme'] : []),
    ...(specArgs.length ? ['--', ...specArgs] : []),
  ];

  function build(theme) {
    const out = path.join(root, theme, 'current');
    const r = spawnSync(process.execPath, buildArgs(theme, out), { encoding: 'utf8' });
    writeFileSync(path.join(root, theme, 'current.log'), `${r.stdout}${r.stderr}`);
    writeFileSync(path.join(root, theme, 'current.json'), JSON.stringify({ skill: SKILL }));
    // 1 is the layout check finding errors: the slides are still made, and the log keeps the count.
    if (r.status !== 0 && r.status !== 1) fail(`${theme}: the build failed (exit ${r.status})\n${r.stderr || r.stdout}`);
    return { out, layout: (r.stdout.match(/^layout: .*?\./m) ?? [''])[0] };
  }

  if (mode === 'record') {
    for (const theme of themes) {
      const dir = path.join(root, theme);
      rmSync(path.join(dir, 'current'), { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      const { out, layout } = build(theme);
      rmSync(path.join(dir, 'reference'), { recursive: true, force: true });
      renameSync(out, path.join(dir, 'reference'));
      for (const ext of ['log', 'json']) renameSync(path.join(dir, `current.${ext}`), path.join(dir, `reference.${ext}`));
      console.log(`${theme}: recorded ${readdirSync(path.join(dir, 'reference/slides')).length} images · ${layout}`);
    }
    console.log(`\nreferences: ${root}\nafter your change: node ${path.relative(process.cwd(), fileURLToPath(import.meta.url))} ${argv.map((a, k) => (k === argv.indexOf('record') ? 'compare' : a)).join(' ')}`);
    return;
  }

  const missing = themes.filter((t) => !existsSync(path.join(root, t, 'reference/slides')));
  if (missing.length) fail(`no reference for ${list(missing)}: run "node regress.mjs record" with the same spec and arguments first (looked in ${root})`);

  const read = (d, f) => (existsSync(path.join(d, f)) ? readFileSync(path.join(d, f), 'utf8') : null);
  const session = await launch();
  const page = await session.newPage();
  let failed = false;
  let setAside = 0;
  for (const theme of themes) {
    const dir = path.join(root, theme);
    const ref = path.join(dir, 'reference');
    const { out: cur, layout } = build(theme);
    const refSkill = JSON.parse(read(dir, 'reference.json') ?? '{}').skill;
    const refLayout = (readFileSync(path.join(dir, 'reference.log'), 'utf8').match(/^layout: .*?\./m) ?? [''])[0];
    const capturesChanged = read(ref, 'captures.txt') !== read(cur, 'captures.txt');
    const pngs = (d) => readdirSync(path.join(d, 'slides')).filter((f) => f.endsWith('.png')).sort();
    const [before, after] = [pngs(ref), pngs(cur)];
    const label = (f) => f.replace(/^slide-0?(\d+)(?:-(\d+))?\.png$/, (_, n, i) => (i ? `${n}.${i}` : n));
    const smoothing = [];
    const aside = [];
    const looksSame = [];
    const changed = [];
    for (const f of before.filter((f) => after.includes(f))) {
      // slide-03-2.png is step 2 of slide-03.html.
      const html = f.replace(/^(slide-\d+)(-\d+)?\.png$/, '$1.html');
      const parts0 = [ref, cur].map((d) => read(path.join(d, 'html'), html));
      if (parts0.includes(null)) fail(`${theme}: no html/${html} for slides/${f}; was the reference made by an older build?`);
      const [a, b] = [slideParts(parts0[0], ref, refSkill), slideParts(parts0[1], cur)];
      const parts = ['markup', 'styles', 'script'].filter((p) => a[p] !== b[p]);
      const px = await comparePngs(page, path.join(ref, 'slides', f), path.join(cur, 'slides', f), tolerance);
      const drawn = px === null ? 'a different size' : px.over ? `max ${px.max} levels, ${px.over} px, box ${box(px.box)}` : px.max ? `within ${tolerance} levels` : 'identical pixels';
      if (!parts.length) {
        if (px?.over === 0 && px.max === 0) continue;
        if (px?.over === 0) smoothing.push(`${label(f)} (${px.max})`);
        else changed.push({ f, why: `drawn differently (same HTML): ${drawn}` });
      } else if (px?.over === 0 && px.max === 0) {
        looksSame.push(`${label(f)} (${list(parts)})`);
      } else if (capturesChanged && parts.length === 1 && parts[0] === 'markup') {
        const [x, y] = excerpt(a.markup, b.markup);
        aside.push({ f, why: drawn, x, y });
      } else {
        const [x, y] = excerpt(a[parts[0]], b[parts[0]]);
        changed.push({ f, why: `${list(parts)} changed: ${drawn}`, x, y });
      }
    }
    const lost = before.filter((f) => !after.includes(f)).map(label);
    const added = after.filter((f) => !before.includes(f)).map(label);
    const same = before.length - lost.length - smoothing.length - aside.length - looksSame.length - changed.length;
    console.log(`\n${theme}: ${same} of ${before.length} images unchanged`);
    if (smoothing.length) console.log(`  text smoothing only (max level difference): ${list(smoothing)}`);
    if (looksSame.length) console.log(`  HTML changed but the slide looks the same: ${list(looksSame)}`);
    const show = (c) => {
      if (c.x) console.log(`    before: ${c.x}\n    after:  ${c.y}`);
      console.log(`    ${path.join(ref, 'slides', c.f)}\n    ${path.join(cur, 'slides', c.f)}`);
    };
    for (const c of aside) {
      console.log(`  slide ${label(c.f)}: set aside, since the captured output changed too; look at it (${c.why})`);
      show(c);
    }
    for (const c of changed) {
      console.log(`  slide ${label(c.f)}: ${c.why}`);
      show(c);
    }
    if (lost.length) console.log(`  gone: ${list(lost)}`);
    if (added.length) console.log(`  new: ${list(added)}`);
    if (layout !== refLayout) console.log(`  layout check: was "${refLayout}", now "${layout}"`);
    setAside += aside.length;
    if (changed.length || lost.length || added.length || layout !== refLayout) failed = true;
  }
  await session.browser.close();
  console.log(failed ? '\nchanged: see above' : setAside ? `\nno changes, but ${setAside} set aside: look at them` : '\nno changes');
  process.exit(failed ? 1 : 0);
}
