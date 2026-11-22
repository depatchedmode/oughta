// node --test tests/regress.test.mjs
// regress.mjs in a throwaway home: record a one-slide spec, change what it shows in each of the ways
// the comparison tells apart, and check what it says. Needs Playwright (setup.sh); skipped without it.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { launch } from '../scripts/lib/browser.mjs';
import { HOME, NODE_DIR, VENV } from '../scripts/lib/paths.mjs';
import { comparePngs, slideParts } from '../scripts/regress.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REGRESS = path.join(here, '../scripts/regress.mjs');
const hasPlaywright = existsSync(path.join(NODE_DIR, 'node_modules/playwright'));
const opts = { skip: !hasPlaywright && "Playwright isn't installed (run setup.sh)" };

const tmp = mkdtempSync(path.join(os.tmpdir(), 'nw-regress-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const home = path.join(tmp, 'home');
const dir = path.join(tmp, 'deck');
if (hasPlaywright) {
  mkdirSync(home);
  mkdirSync(dir);
  symlinkSync(NODE_DIR, path.join(home, 'node'));
  if (existsSync(path.join(HOME, 'presets.json'))) cpSync(path.join(HOME, 'presets.json'), path.join(home, 'presets.json'));
}
const env = { ...process.env, NARRATED_WALKTHROUGH_HOME: home, NARRATED_WALKTHROUGH_VENV: VENV };
const regress = (...args) => spawnSync(process.execPath, [REGRESS, ...args], { env, encoding: 'utf8' });
const put = (file, text) => writeFileSync(path.join(dir, file), text);

// A solid PNG of the given colour, with an optional patch of another, from the browser.
async function png(page, file, color, patch) {
  await page.setViewportSize({ width: 64, height: 48 });
  await page.setContent(`<body style="margin:0;background:${color}">${patch ? `<div style="position:absolute;left:10px;top:20px;width:5px;height:4px;background:${patch}"></div>` : ''}</body>`);
  await page.screenshot({ path: file });
  return file;
}

test('pixel comparison: a level or two is smoothing, a real change has a size and a box', opts, async () => {
  const session = await launch();
  const page = await session.newPage();
  try {
    const a = await png(page, path.join(tmp, 'a.png'), 'rgb(100,100,100)');
    const near = await png(page, path.join(tmp, 'near.png'), 'rgb(101,100,100)');
    const patched = await png(page, path.join(tmp, 'patched.png'), 'rgb(100,100,100)', 'rgb(200,0,0)');
    assert.deepEqual(await comparePngs(page, a, a, 2), { max: 0, over: 0, box: null });
    const n = await comparePngs(page, a, near, 2);
    assert.equal(n.max, 1);
    assert.equal(n.over, 0);
    assert.deepEqual(await comparePngs(page, a, patched, 2), { max: 100, over: 20, box: { x: 10, y: 20, w: 5, h: 4 } });
    await page.setViewportSize({ width: 32, height: 32 });
    await page.screenshot({ path: path.join(tmp, 'small.png') });
    assert.equal(await comparePngs(page, a, path.join(tmp, 'small.png'), 2), null);
  } finally {
    await session.browser.close();
  }
});

test("slide HTML is split into markup, styles and script, without the output folder's or skill's path", () => {
  const html = (out, skill) =>
    `<html><head><meta http-equiv="Content-Security-Policy" content="script-src 'sha256-x'"><style>@font-face{src:url(file://${skill}/f.woff2)}</style></head><body><img src="file://${out}/shots/a.png"><p>Hi</p><script>go()</script></body></html>`;
  const [a, b] = [slideParts(html('/r/one', '/s/old'), '/r/one', '/s/old'), slideParts(html('/r/two', '/s/new'), '/r/two', '/s/new')];
  assert.deepEqual(a, b);
  assert.equal(a.styles, '<style>@font-face{src:url(SKILL/f.woff2)}</style>');
  assert.match(a.script, /sha256-x[\s\S]*go\(\)/);
  assert.equal(a.markup, '<html><head></head><body><img src="OUT/shots/a.png"><p>Hi</p></body></html>');
});

test('compare tells smoothing, live data, a changed slide and a changed theme apart', opts, async () => {
  const session = await launch();
  const page = await session.newPage();
  await png(page, path.join(dir, 'pic.png'), 'rgb(40,90,160)');
  await session.browser.close();
  put('title.txt', 'First title');
  put('data.txt', 'id 0001');
  put(
    'spec.mjs',
    `import { readFileSync } from 'node:fs';
export default (c) => {
  const cap = c.capture({ cwd: c.specDir });
  const title = readFileSync(c.specDir + '/title.txt', 'utf8').trim();
  return { title: 'Regress', slides: [{ title, body: c.split(c.term(cap.shell('cat data.txt')), c.image('pic.png')), say: 'Look.' }] };
};`,
  );
  const spec = path.join(dir, 'spec.mjs');
  const theme = path.join(home, 'themes/plain');
  mkdirSync(theme, { recursive: true });
  writeFileSync(path.join(theme, 'theme.json'), JSON.stringify({ extends: 'paper', description: 'test' }));
  writeFileSync(path.join(theme, 'theme.css'), '');

  const rec = regress('record', spec, '--theme', 'plain');
  assert.equal(rec.status, 0, rec.stderr);
  assert.match(rec.stdout, /plain: recorded 1 images/);

  let r = regress('compare', spec, '--theme', 'plain');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /plain: 1 of 1 images unchanged[\s\S]*no changes$/m);

  // The captured output changed: set aside, with what changed, and not a failure.
  put('data.txt', 'id 0002');
  r = regress('compare', spec, '--theme', 'plain');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /slide 1: set aside, since the captured output changed too/);
  assert.match(r.stdout, /before: .*id 0001[\s\S]*after: .*id 0002/);
  put('data.txt', 'id 0001');

  // The same HTML drawn differently: the image file it shows was replaced.
  const s2 = await launch();
  await png(await s2.newPage(), path.join(dir, 'pic.png'), 'rgb(200,40,40)');
  await s2.browser.close();
  r = regress('compare', spec, '--theme', 'plain');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /slide 1: drawn differently \(same HTML\): max \d+ levels, \d+ px, box \d+,\d+ \d+×\d+/);

  // The slide itself changed, with the captures the same: a failure, showing the markup.
  r = regress('record', spec, '--theme', 'plain');
  assert.equal(r.status, 0, r.stderr);
  put('title.txt', 'Second title');
  r = regress('compare', spec, '--theme', 'plain');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /slide 1: markup changed: max/);
  assert.match(r.stdout, /before: .*First title[\s\S]*after: .*Second title/);
  put('title.txt', 'First title');

  // The theme changed.
  writeFileSync(path.join(theme, 'theme.css'), '.slide .title { color: #c00 !important; }');
  r = regress('compare', spec, '--theme', 'plain');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /slide 1: styles changed: max/);
});

test('compare needs a reference, and says how to make one', opts, () => {
  const r = regress('compare', path.join(dir, 'other.mjs'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no spec at/);
  writeFileSync(path.join(dir, 'other.mjs'), "export default { title: 't', slides: [{ title: 'x', say: 'y' }] };");
  const n = regress('compare', path.join(dir, 'other.mjs'), '--theme', 'paper');
  assert.equal(n.status, 2);
  assert.match(n.stderr, /no reference for paper: run "node regress.mjs record"/);
  assert.match(regress('compare', '--theme', 'nope').stderr, /no theme "nope" here/);
  assert.match(regress('compare', '--tolerance', 'x').stderr, /--tolerance takes a whole number/);
});
