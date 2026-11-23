// node --test tests/regress.test.mjs
// regress.mjs and lib/compare.mjs. The comparison rules are tested directly; then two copies of
// the skill in a throwaway home record and compare a small spec, changed in each of the ways the
// comparison tells apart. The builds need Playwright and Reverb (setup.sh), and skip without them.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { launch } from '../scripts/lib/browser.mjs';
import { changedCaptureLines, classify, comparePngs, showsLines, slideParts, stripPaths } from '../scripts/lib/compare.mjs';
import { HOME, NODE_DIR, SKILL, VENV } from '../scripts/lib/paths.mjs';
import { reverbInstalled } from '../scripts/lib/tts.mjs';

const hasPlaywright = existsSync(path.join(NODE_DIR, 'node_modules/playwright'));
const browserOpts = { skip: !hasPlaywright && "Playwright isn't installed (run setup.sh)" };
const buildOpts = { skip: browserOpts.skip || (!reverbInstalled() && "Reverb isn't installed (run setup.sh)") };

const tmp = mkdtempSync(path.join(os.tmpdir(), 'nw-regress-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

test('classify: what each difference between two builds of a slide means', () => {
  const px = (max, over = 0) => ({ max, over, box: over ? { x: 0, y: 0, w: 1, h: 1 } : null });
  const cases = [
    [{ parts: [], px: px(0) }, 'same', false],
    [{ parts: [], px: px(2) }, 'smoothing', false],
    [{ parts: [], px: px(90, 40) }, 'drawn', true],
    [{ parts: [], px: null }, 'drawn', true],
    [{ parts: ['markup'], px: px(0) }, 'looks-same', false],
    [{ parts: ['script'], px: px(1) }, 'looks-same', false],
    [{ parts: ['markup'], px: px(90, 40), live: true }, 'live', false],
    [{ parts: ['markup', 'styles'], px: px(90, 40), live: true }, 'changed', true],
    [{ parts: ['markup'], px: px(90, 40), live: false }, 'changed', true],
    [{ parts: ['styles'], px: null }, 'changed', true],
  ];
  for (const [input, kind, fails] of cases) assert.deepEqual(classify(input), { kind, fails }, JSON.stringify(input));
});

test("a build's folders are taken out of its text, as paths and as file: URLs, the longest first", () => {
  const paths = { out: '/r/skill/examples/x/out', skill: '/r/skill', spec: '/r/skill/examples/x', repo: null };
  assert.equal(
    stripPaths('src="file:///r/skill/examples/x/out/shots/a.png" url(file:///r/skill/themes/f.woff2) /r/skill/examples/x/data.txt', paths),
    'src="OUT/shots/a.png" url(SKILL/themes/f.woff2) SPEC/data.txt',
  );
});

test('slide HTML is split into markup, styles and script', () => {
  const html = `<html><head><meta http-equiv="Content-Security-Policy" content="script-src 'sha256-x'"><style>.a{}</style></head><body><p>Hi</p><script>go()</script></body></html>`;
  assert.deepEqual(slideParts(html), {
    markup: '<html><head></head><body><p>Hi</p></body></html>',
    styles: '<style>.a{}</style>',
    script: `<meta http-equiv="Content-Security-Policy" content="script-src 'sha256-x'"><script>go()</script>`,
  });
});

test('captured output: the lines that changed, and whether a slide shows one', () => {
  const was = [{ cmd: 'cat data.txt', status: 0, out: 'id 0001\nsame line' }, { cmd: 'date', status: 0, out: 'Monday' }];
  const now = [{ cmd: 'cat data.txt', status: 0, out: 'id 0002\nsame line' }];
  assert.deepEqual(changedCaptureLines(was, now).sort(), ['Monday', 'date', 'id 0001', 'id 0002']);
  assert.deepEqual(changedCaptureLines(was, was), []);
  const lines = changedCaptureLines(was, now);
  assert.ok(showsLines(['<pre><span class="line">id 0001</span></pre>', '<pre><span class="line">id 0002</span></pre>'], lines));
  assert.ok(!showsLines(['<h1>A title</h1>', '<h1>Another title</h1>'], lines));
  assert.ok(showsLines(['<span>a &lt;b&gt; &amp; c</span>'], ['a <b> & c']));
});

test('pixel comparison: a level or two is smoothing, a real change has a size and a box', browserOpts, async () => {
  const session = await launch();
  const page = await session.newPage();
  const png = async (name, color, patch, size = { width: 64, height: 48 }) => {
    await page.setViewportSize(size);
    await page.setContent(`<body style="margin:0;background:${color}">${patch ? `<div style="position:absolute;left:10px;top:20px;width:5px;height:4px;background:${patch}"></div>` : ''}</body>`);
    await page.screenshot({ path: path.join(tmp, name) });
    return path.join(tmp, name);
  };
  try {
    const a = await png('a.png', 'rgb(100,100,100)');
    const near = await png('near.png', 'rgb(101,100,100)');
    const patched = await png('patched.png', 'rgb(100,100,100)', 'rgb(200,0,0)');
    const small = await png('small.png', 'rgb(100,100,100)', null, { width: 32, height: 32 });
    assert.deepEqual(await comparePngs(page, a, a, 2), { max: 0, over: 0, box: null });
    assert.deepEqual(await comparePngs(page, a, near, 2), { max: 1, over: 0, box: { x: 0, y: 0, w: 64, h: 48 } });
    assert.deepEqual(await comparePngs(page, a, patched, 2), { max: 100, over: 20, box: { x: 10, y: 20, w: 5, h: 4 } });
    assert.equal(await comparePngs(page, a, small, 2), null);
  } finally {
    await session.browser.close();
  }
});

// ---- end to end ------------------------------------------------------------------------------------
// Two copies of the skill (the code before a change, and after), each with the same small spec in
// examples/: a slide with a captured command and a screenshot, and a slide whose title is a file.
const home = path.join(tmp, 'home');
const copies = ['old', 'new'].map((n) => path.join(tmp, n));
const specIn = (copy) => path.join(copy, 'examples/mini/spec.mjs');
const env = { ...process.env, NARRATED_WALKTHROUGH_HOME: home, NARRATED_WALKTHROUGH_VENV: VENV };
const regress = (copy, ...args) => spawnSync(process.execPath, [path.join(copy, 'scripts/regress.mjs'), ...args], { env, encoding: 'utf8' });
const put = (file, text) => copies.forEach((c) => writeFileSync(path.join(path.dirname(specIn(c)), file), text));
const out = (r) => r.stdout + r.stderr;

function setUp() {
  mkdirSync(home);
  symlinkSync(NODE_DIR, path.join(home, 'node'));
  if (existsSync(path.join(HOME, 'presets.json'))) cpSync(path.join(HOME, 'presets.json'), path.join(home, 'presets.json'));
  for (const t of ['plain', 'plain2']) {
    mkdirSync(path.join(home, 'themes', t), { recursive: true });
    writeFileSync(path.join(home, 'themes', t, 'theme.json'), JSON.stringify({ extends: 'paper', description: 'test' }));
    writeFileSync(path.join(home, 'themes', t, 'theme.css'), '');
  }
  for (const copy of copies) {
    cpSync(SKILL, copy, { recursive: true, filter: (f) => !/[/\\](node_modules|out|\.git)$/.test(f) });
    mkdirSync(path.dirname(specIn(copy)), { recursive: true });
    writeFileSync(
      specIn(copy),
      `import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export default async (c) => {
  const at = (f) => c.specDir + '/' + f;
  if (existsSync(at('boom'))) throw new Error('boom from the spec');
  const cap = c.capture({ cwd: c.specDir });
  const shot = await c.screenshot(pathToFileURL(at('page.html')).href, { name: 'page', viewport: { width: 400, height: 300 } });
  return { title: 'Regress', slides: [
    { title: 'Live', body: c.split(c.term(cap.shell('cat data.txt')), c.image(shot)), say: 'Look.' },
    { title: readFileSync(at('title.txt'), 'utf8').trim(), body: c.bullets(['One']), say: 'Then.' },
  ] };
};`,
    );
  }
  put('data.txt', 'id 0001');
  put('title.txt', 'First title');
  put('page.html', '<body style="margin:0;background:#3a6"><h1>Page</h1></body>');
}

test('record with one copy of the skill, compare with another: each kind of change is told apart', buildOpts, () => {
  setUp();
  const [old, now] = copies;
  const spec = 'examples/mini/spec.mjs';
  // The spec is named by its place in the skill, so each copy passes its own path.
  let r = regress(old, 'record', specIn(old), '--theme', 'plain,plain2');
  assert.equal(r.status, 0, out(r));
  assert.match(r.stdout, /plain: recorded 2 images/);

  // Nothing changed: the screenshot slide included, though the copies and output folders differ.
  r = regress(now, 'compare', specIn(now));
  assert.equal(r.status, 0, out(r));
  assert.match(r.stdout, /plain: 2 of 2 images unchanged[\s\S]*plain2: 2 of 2 images unchanged/);
  assert.match(r.stdout, /not recorded, so not compared: endless, midnight, paper/);
  assert.match(r.stdout, /no changes$/m);

  // Captured output changed: the slide showing it is set aside; a slide that doesn't show it still fails.
  put('data.txt', 'id 0002');
  r = regress(now, 'compare', specIn(now), '--theme', 'plain');
  assert.equal(r.status, 0, out(r));
  assert.match(r.stdout, /slide 1: set aside: it shows captured output that changed[\s\S]*before: .*id 0001[\s\S]*after: {2}.*id 0002/);
  put('title.txt', 'Second title');
  r = regress(now, 'compare', specIn(now), '--theme', 'plain');
  assert.equal(r.status, 1, out(r));
  assert.match(r.stdout, /slide 1: set aside/);
  assert.match(r.stdout, /slide 2: markup changed: max[\s\S]*before: .*First title[\s\S]*after: {2}.*Second title/);
  put('data.txt', 'id 0001');
  put('title.txt', 'First title');

  // The page in the screenshot changed: same HTML, drawn differently.
  put('page.html', '<body style="margin:0;background:#c33"><h1>Page</h1></body>');
  r = regress(now, 'compare', specIn(now), '--theme', 'plain');
  assert.equal(r.status, 1, out(r));
  assert.match(r.stdout, /slide 1: drawn differently \(same HTML\): max \d+ levels, \d+ px, box \d+,\d+ \d+×\d+/);
  put('page.html', '<body style="margin:0;background:#3a6"><h1>Page</h1></body>');

  // The new copy's CSS changed: styles, with an excerpt of the rule.
  const css = path.join(now, 'themes/base.css');
  const original = spawnSync('cat', [css], { encoding: 'utf8' }).stdout;
  writeFileSync(css, `${original}\n.slide .title { color: #c00 !important; }\n`);
  r = regress(now, 'compare', specIn(now), '--theme', 'plain');
  writeFileSync(css, original);
  assert.equal(r.status, 1, out(r));
  assert.match(r.stdout, /slide \d: styles changed: max[\s\S]*after: .*color: #c00/);

  // A build that fails is exit 2 with its error, and a failed record keeps the references.
  put('boom', '');
  r = regress(now, 'compare', specIn(now), '--theme', 'plain');
  assert.equal(r.status, 2, out(r));
  assert.match(r.stderr, /plain: the build failed[\s\S]*boom from the spec/);
  r = regress(old, 'record', specIn(old), '--theme', 'plain,plain2');
  assert.equal(r.status, 2, out(r));
  rmSync(path.join(path.dirname(specIn(old)), 'boom'));
  rmSync(path.join(path.dirname(specIn(now)), 'boom'));
  r = regress(now, 'compare', specIn(now));
  assert.equal(r.status, 0, out(r));

  // Run through a symlink, it still runs.
  symlinkSync(now, path.join(tmp, 'linked'));
  r = regress(path.join(tmp, 'linked'), 'compare', path.join(tmp, 'linked', spec), '--theme', 'nope');
  assert.equal(r.status, 2, out(r));
  assert.match(r.stderr, /no reference for nope: recorded themes are plain, plain2/);

  // A recorded theme that's gone is a change.
  rmSync(path.join(home, 'themes/plain2'), { recursive: true });
  r = regress(now, 'compare', specIn(now));
  assert.equal(r.status, 1, out(r));
  assert.match(r.stdout, /recorded, but no longer a theme: plain2/);
});

test('usage: a spec with no references, an empty theme list, a bad tolerance', buildOpts, () => {
  const [, now] = copies;
  let r = regress(now, 'compare', path.join(tmp, 'missing.mjs'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no spec at/);
  writeFileSync(path.join(tmp, 'other.mjs'), "export default { title: 't', slides: [{ title: 'x', say: 'y' }] };");
  r = regress(now, 'compare', path.join(tmp, 'other.mjs'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no references for this spec[\s\S]*using the code from before your change/);
  assert.match(regress(now, 'compare', '--theme', ',').stderr, /--theme takes theme names/);
  assert.match(regress(now, 'compare', '--tolerance', 'x').stderr, /--tolerance takes a whole number/);
  assert.equal(regress(now, 'nonsense').status, 2);
});
