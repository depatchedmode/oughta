// node --test tests/*.test.mjs
// Runs build.mjs --check and theme.mjs against a fixture theme in a throwaway home, then drives the
// motion code on the slides it rendered. Needs Playwright (setup.sh); skipped without it. Uses this
// machine's Reverb install, if any, only to check voice names.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { annotate } from '../scripts/annotate.mjs';
import * as components from '../scripts/lib/components.mjs';
import { chromium, launch } from '../scripts/lib/browser.mjs';
import { HOME, NODE_DIR, SKILL, VENV } from '../scripts/lib/paths.mjs';
import { reverbInstalled } from '../scripts/lib/tts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(here, '../scripts/build.mjs');
const THEME = path.join(here, '../scripts/theme.mjs');
const hasPlaywright = existsSync(path.join(NODE_DIR, 'node_modules/playwright'));
const opts = { skip: !hasPlaywright && "Playwright isn't installed (run setup.sh)" };

const tmp = mkdtempSync(path.join(os.tmpdir(), 'nw-build-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const home = path.join(tmp, 'home');
const repo = path.join(tmp, 'repo');
if (hasPlaywright) {
  mkdirSync(home);
  symlinkSync(NODE_DIR, path.join(home, 'node'));
  if (existsSync(path.join(HOME, 'presets.json'))) cpSync(path.join(HOME, 'presets.json'), path.join(home, 'presets.json'));
  cpSync(path.join(here, 'fixtures/repo'), repo, { recursive: true });
  spawnSync('git', ['init', '-q', repo]);
}
const env = { ...process.env, NARRATED_WALKTHROUGH_HOME: home, NARRATED_WALKTHROUGH_VENV: VENV };
const run = (script, args) => spawnSync(process.execPath, [script, ...args], { env, encoding: 'utf8' });
// Async, for tests that serve something to the build while it runs.
const runAsync = (script, args) =>
  new Promise((resolve) => {
    const p = spawn(process.execPath, [script, ...args], { env });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d));
    p.on('close', (status) => resolve({ status, stdout, stderr }));
  });
const build = (args) => run(BUILD, [...args, ...(args.includes('--repo') ? [] : ['--repo', repo])]);

function spec(name, body) {
  const file = path.join(tmp, `${name}.mjs`);
  writeFileSync(file, `export default (c) => (${body});`);
  return file;
}
const deck = spec(
  'deck',
  `{ title: 'Test deck', slides: [
    { layout: 'title', kicker: 'PR #1', title: 'A title slide', say: 'Hello. [beat] [voice en_female_narrator] A sample. [plain] Back.' },
    { title: 'A content slide', focus: true, body: c.bullets(['One', 'Two'], { reveal: 1 }) + c.mark('ringed', 'A mark', { below: true }), say: ['First.', 'Second.'] },
  ] }`,
);

test('a trusted repo theme draws its frame and hero art', opts, () => {
  const out = path.join(tmp, 'trusted');
  const r = build([deck, '--check', '--theme', 'demo', '--trust-repo-theme', '--out', out]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /layout: 0 errors/);
  assert.match(r.stdout, /^decor: .*decor\.mjs$/m);
  const title = readFileSync(path.join(out, 'html/slide-01.html'), 'utf8');
  assert.match(title, /class="frame"><div class="brand">Demo 1\/2/);
  assert.match(title, /class="hero-art"><svg/);
  assert.match(title, /<div class="marquee">PR #1<\/div>/, 'the kicker becomes the marquee');
  assert.doesNotMatch(readFileSync(path.join(out, 'html/slide-02.html'), 'utf8'), /class="hero-art"/, 'hero art is for title and section slides');
});

test('motion: hero art draws in, the tracker follows, focus and marks settle where the theme puts them', opts, async () => {
  const out = path.join(tmp, 'trusted');
  if (!existsSync(path.join(out, 'html/slide-01.html'))) build([deck, '--check', '--theme', 'demo', '--trust-repo-theme', '--out', out]);
  const { browser, newPage } = await launch();
  try {
    const page = await newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(pathToFileURL(path.join(out, 'html/slide-01.html')).href);
    const title = await page.evaluate(() => {
      const m = window.__motion;
      const plan = m.plan(1, { entrance: true });
      const line = document.querySelector('.hero-art [data-draw]');
      const tracker = document.querySelector('.frame .tracker');
      m.frame(0);
      const start = line.style.strokeDashoffset;
      m.frame(1e6);
      const end = line.style.strokeDashoffset;
      const target = document.querySelector('h1.title').getBoundingClientRect().top; // paper's hero box is display: contents, so the title arrives first
      const top = parseFloat(tracker.style.top);
      const label = tracker.querySelector('[data-tracker-y]').textContent;
      m.finish();
      const rested = line.style.strokeDashoffset;
      m.exit(1);
      return { plan, start, end, top, target, label, rested, exitOpacity: document.querySelector('.content').style.opacity, frameOpacity: document.querySelector('.frame').style.opacity };
    });
    assert.ok(title.plan.duration > 0);
    assert.equal(title.start, '1', 'strokes start undrawn');
    assert.equal(title.end, '0', 'and end drawn');
    assert.equal(title.rested, '', 'the resting state is the CSS');
    assert.equal(title.top, Math.round(title.target + 2), 'tracker lands on the first new thing, plus its data-tracker-offset');
    assert.match(title.label, /^\d{4}$/, 'label padded to data-tracker-pad digits');
    assert.equal(title.exitOpacity, '0', 'content leaves');
    assert.equal(title.frameOpacity, '', 'the frame stays');

    await page.goto(pathToFileURL(path.join(out, 'html/slide-02.html')).href);
    const focus = await page.evaluate(() => {
      const m = window.__motion;
      m.plan(1, { entrance: true });
      m.finish();
      m.plan(2);
      const past = document.querySelector('[data-step="1"]');
      const mark = document.querySelector('.mark');
      m.frame(1e6);
      const animated = { dim: past.style.opacity, ring: mark.style.outlineOffset };
      m.finish();
      return { animated, rest: { dim: getComputedStyle(past).opacity, ring: getComputedStyle(mark).outlineOffset } };
    });
    assert.equal(Number(focus.animated.dim), Number(focus.rest.dim), 'the dim ends at the opacity the theme gives past steps');
  } finally {
    await browser.close();
  }
});

test("an untrusted repo theme's decor is skipped, and the build says so", opts, () => {
  const out = path.join(tmp, 'untrusted');
  const r = build([deck, '--check', '--theme', 'demo', '--out', out]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /note: skipped .*decor\.mjs/);
  assert.doesNotMatch(readFileSync(path.join(out, 'html/slide-01.html'), 'utf8'), /class="frame"/);
});

test('slides render offline: theme CSS cannot reach a server', opts, async () => {
  let hits = 0;
  const server = createServer((req, res) => {
    hits++;
    res.end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const leaky = path.join(repo, '.walkthrough/themes/leaky');
  mkdirSync(leaky, { recursive: true });
  writeFileSync(path.join(leaky, 'theme.json'), JSON.stringify({ extends: 'paper' }));
  writeFileSync(path.join(leaky, 'theme.css'), `@font-face { font-family: Leak; src: url(${url}/font); unicode-range: U+41; } h1.title { font-family: Leak; } .slide { background: url(${url}/bg); }`);
  try {
    const r = await runAsync(BUILD, [deck, '--check', '--theme', 'leaky', '--repo', repo, '--out', path.join(tmp, 'leaky')]);
    assert.equal(hits, 0, 'no request reached the server');
    assert.match(r.stdout, /ERROR slide 1: theme font "Leak" .*didn't load/, 'and the blocked font is reported');
    // The slide's own Content-Security-Policy holds in any browser, not just the build's.
    const browser = await chromium().launch();
    try {
      const page = await browser.newPage();
      await page.goto(pathToFileURL(path.join(tmp, 'leaky/html/slide-01.html')).href);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
    } finally {
      await browser.close();
    }
    assert.equal(hits, 0, 'opening the debug HTML in an ordinary, online browser reaches nothing either');
  } finally {
    server.close();
  }
});

test('slides run only their own animation script: injected scripts and handlers do nothing', opts, async () => {
  // HTML reaches a slide through bullets and cards (often captured output) and through decor.
  const file = spec('inject', `{ title: 't', slides: [{ title: 'Injected', body: c.bullets(['<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onload="document.documentElement.dataset.handler = 1">', '<script>document.documentElement.dataset.script = 1</script>']), say: 'Hi.' }] }`);
  const out = path.join(tmp, 'inject');
  const r = build([file, '--check', '--out', out]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const html = path.join(out, 'html/slide-01.html');
  assert.doesNotMatch(readFileSync(html, 'utf8'), /data-(handler|script)=/, "nothing injected ran in the build's browser");
  // And in an ordinary browser opening the debug HTML, where the animation code must still run.
  const browser = await chromium().launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(html).href);
    await page.waitForTimeout(200);
    const ran = await page.evaluate(() => ({ handler: document.documentElement.dataset.handler, script: document.documentElement.dataset.script, motion: typeof window.__motion }));
    assert.deepEqual(ran, { handler: undefined, script: undefined, motion: 'object' });
  } finally {
    await browser.close();
  }
});

test('image captions are text, like every argument not marked as HTML', () => {
  assert.match(components.image('data:,', { caption: '<b>x</b>' }), /<figcaption>&lt;b&gt;x&lt;\/b&gt;<\/figcaption>/);
});

test('a font name cannot inject script', opts, () => {
  const evil = path.join(tmp, 'evil-repo');
  mkdirSync(path.join(evil, '.walkthrough'), { recursive: true });
  spawnSync('git', ['init', '-q', evil]);
  writeFileSync(path.join(evil, '.walkthrough/config.json'), JSON.stringify({ theme: { extends: 'paper', fonts: [{ family: 'X</script><script>alert(1)</script>', src: 'x.woff2' }] } }));
  const r = build([deck, '--check', '--repo', evil, '--out', path.join(tmp, 'evil')]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /font family/);
});

test('the build refuses to clean a folder it did not make', opts, () => {
  const out = path.join(tmp, 'project');
  mkdirSync(path.join(out, 'html'), { recursive: true });
  writeFileSync(path.join(out, 'html/index.html'), 'keep me');
  writeFileSync(path.join(out, 'report.json'), '{}');
  const r = build([deck, '--check', '--out', out]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.equal(readFileSync(path.join(out, 'html/index.html'), 'utf8'), 'keep me');
});

test('--only builds into its own folder, and a full build of the same folder still works after it', opts, () => {
  const out = path.join(tmp, 'only');
  const first = build([deck, '--check', '--only', '2', '--out', out]);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.ok(existsSync(path.join(out, 'only-2/slides/slide-02-2.png')));
  assert.ok(!existsSync(path.join(out, 'slides')));
  const full = build([deck, '--check', '--out', out]);
  assert.equal(full.status, 0, full.stdout + full.stderr);
  assert.ok(existsSync(path.join(out, 'slides/slide-01.png')));
  const ranges = build([deck, '--check', '--only', '2,1', '--out', out]);
  assert.equal(ranges.status, 0, ranges.stdout + ranges.stderr);
  assert.ok(existsSync(path.join(out, 'only-1-2/slides/slide-01.png')), 'the folder is named by sorted ranges');
});

test('voice paths and clones pass the voice check; unknown names stop the build', opts, () => {
  const npz = path.join(tmp, 'alex.npz');
  const ref = path.join(tmp, 'ref.wav');
  writeFileSync(npz, '');
  writeFileSync(ref, '');
  for (const [i, voice] of [JSON.stringify(npz), `{ audio: ${JSON.stringify(ref)}, text: 'hi' }`].entries()) {
    const file = spec(`voice${i}`, `{ title: 't', voice: { voice: ${voice} }, slides: [{ title: 'One', say: 'Hello.' }] }`);
    const r = build([file, '--check', '--out', path.join(tmp, `voice${i}`)]);
    assert.equal(r.status, 0, voice + r.stdout + r.stderr);
  }
  const gone = spec('gone', `{ title: 't', voice: { voice: ${JSON.stringify(path.join(tmp, 'gone.npz'))} }, slides: [{ title: 'One', say: 'Hello.' }] }`);
  const missing = build([gone, '--check', '--force', '--out', path.join(tmp, 'gone')]);
  assert.equal(missing.status, 1, '--force does not get past a missing voice');
  assert.match(missing.stderr, /no such file/);
  if (!existsSync(path.join(home, 'presets.json'))) return; // no preset list here to check names against
  const bad = spec('bad', `{ title: 't', slides: [{ title: 'One', say: 'Hi. [voice en_femal_narator] typo.' }] }`);
  const r = build([bad, '--check', '--out', path.join(tmp, 'bad')]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ERROR spec: voice "en_femal_narator"/);
  assert.ok(!existsSync(path.join(tmp, 'bad/slides/slide-01.png')), 'stopped before rendering');
});

test("theme.mjs new scaffolds every token the parent exposes, as written", opts, () => {
  const r = run(THEME, ['new', 'mine', '--extends', 'endless', '--repo', repo]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const { tokens } = JSON.parse(readFileSync(path.join(repo, '.walkthrough/themes/mine/theme.json'), 'utf8'));
  for (const t of ['font-sans', 'font-mono', 'size-title', 'size-code', 'pad-x', 'radius', 'accent', 'ok-tint']) assert.ok(t in tokens, t);
  assert.equal(tokens['font-display'], 'var(--font-sans)', 'references stay references');
  assert.ok(!('canvas-w' in tokens), 'the canvas is fixed');
  assert.ok(!Object.values(tokens).some((v) => /url\(|file:/.test(v)), 'no file paths');
  const preview = run(BUILD, [deck, '--check', '--theme', 'mine', '--repo', repo, '--out', path.join(tmp, 'mine')]);
  assert.equal(preview.status, 0, preview.stdout + preview.stderr);
});

test("every declared font face is checked, so a broken italic is caught", opts, () => {
  const dir = path.join(repo, '.walkthrough/themes/halfont');
  mkdirSync(path.join(dir, 'fonts'), { recursive: true });
  cpSync(path.join(SKILL, 'themes/endless/fonts/dm-sans-latin-wght-normal.woff2'), path.join(dir, 'fonts/ok.woff2'));
  writeFileSync(path.join(dir, 'theme.json'), JSON.stringify({ extends: 'paper', fonts: [{ family: 'Half', src: 'fonts/ok.woff2', weight: '100 900' }, { family: 'Half', src: 'fonts/gone.woff2', style: 'italic' }] }));
  const r = build([deck, '--check', '--theme', 'halfont', '--out', path.join(tmp, 'halfont')]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /theme font "Half" \(weight normal, italic\) didn't load/);
  assert.doesNotMatch(r.stdout, /"Half" \(weight 100 900/, 'the good face loads');
});

test('bullets inside a stack inside a split still arrive one by one', opts, async () => {
  const file = spec('nested', `{ title: 't', slides: [{ title: 'Nested', body: c.split(c.stack(c.bullets(['One', 'Two', 'Three'])), c.callout('Note', ['Side.'])), say: 'Look.' }] }`);
  const out = path.join(tmp, 'nested');
  const r = build([file, '--check', '--out', out]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const { browser, newPage } = await launch();
  try {
    const page = await newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(pathToFileURL(path.join(out, 'html/slide-01.html')).href);
    const seen = await page.evaluate(() => {
      const m = window.__motion;
      m.plan(1, { entrance: true });
      const lis = [...document.querySelectorAll('ul.bullets li')];
      const at = (t) => (m.frame(t), lis.map((li) => Number(li.style.opacity)));
      const start = at(0);
      // Some moment while they're arriving has each one further along than the next.
      const staggered = Array.from({ length: 80 }, (_, i) => at(i * 25)).some(([a, b, c]) => a > b && b > c);
      return { start, staggered };
    });
    assert.deepEqual(seen.start, [0, 0, 0]);
    assert.ok(seen.staggered, 'they arrive one after another, not as one block');
  } finally {
    await browser.close();
  }
});

// The colour of one pixel of an image, as [r, g, b].
const pixel = (file, x, y) => [...spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `crop=1:1:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' }).stdout];

test("the contact sheet shows media slides even when they're all that was built", opts, () => {
  const png = path.join(tmp, 'red.png');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=red:s=320x180', '-frames:v', '1', png]);
  const file = spec('media', `{ title: 't', slides: [{ title: 'One', say: 'Hi.' }, { media: 'red.png', say: 'Red.' }] }`);
  const out = path.join(tmp, 'media');
  const r = build([file, '--check', '--only', '2', '--out', out]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const [red, green, blue] = pixel(path.join(out, 'only-2/contact-sheet.png'), 16 + 240, 16 + 135);
  assert.ok(red > 200 && green < 60 && blue < 60, `thumbnail pixel is ${[red, green, blue]}`);
});

test('a spec can screenshot a live page, with a ring and caption, while slides stay offline', opts, async () => {
  let hits = 0;
  const server = createServer((req, res) => {
    hits++;
    res.setHeader('content-type', 'text/html');
    res.end('<body style="margin:40px;font:32px sans-serif"><button id="go">Go</button></body>');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const file = path.join(tmp, 'shot.mjs');
  writeFileSync(
    file,
    `export default async (c) => {
      const shot = await c.screenshot('http://127.0.0.1:${server.address().port}/', { name: 'page', viewport: { width: 640, height: 360 }, marks: [{ target: '#go', caption: 'Press it' }] });
      return { title: 't', slides: [{ title: 'A live page', body: c.image(shot, { title: 'app' }), say: 'Look.' }] };
    };`,
  );
  const out = path.join(tmp, 'shot');
  try {
    const r = await runAsync(BUILD, [file, '--check', '--repo', repo, '--out', out]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(hits >= 1, 'the screenshot loaded the page');
    assert.ok(existsSync(path.join(out, 'shots/page.png')));
    assert.match(readFileSync(path.join(out, 'html/slide-01.html'), 'utf8'), /<img src="file:\/\/[^"]*\/shots\/page\.png">/);
  } finally {
    server.close();
  }
  const bad = path.join(tmp, 'remote-image.mjs');
  writeFileSync(bad, `export default (c) => ({ title: 't', slides: [{ title: 'x', body: c.image('https://example.com/a.png'), say: 'Hi.' }] });`);
  const r = build([bad, '--check', '--out', path.join(tmp, 'remote-image')]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /slides render offline, so images must be files/);
});

// Full builds narrate with Reverb's default preset: narration, timing, captions, chapters and the report.
const full = { skip: opts.skip || (!reverbInstalled() && "Reverb isn't installed (run setup.sh)") };
test('a full build: captions follow pauses, pause-only steps keep their pause, chapters per slide', full, () => {
  const out = path.join(tmp, 'full');
  const slides = `[
    { title: 'One', say: ['First part is here. [pause 1] And then more words follow.', '[pause 1]'] },
    { title: 'Two', say: 'Done.' },
  ]`;
  const first = spec('full-a', `{ name: 'first', title: 'Full', motion: false, slides: ${slides} }`);
  const r = build([first, '--out', out]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const report = JSON.parse(readFileSync(path.join(out, 'report.json'), 'utf8'));
  const [one, two] = report.slides;
  assert.ok(Math.abs(one.steps[1].seconds - (1 + 0.9)) < 0.04, `a pause-only step lasts its pause, then the slide's hold (${one.steps[1].seconds})`);
  assert.ok(Math.abs(report.duration - (one.seconds + two.seconds)) < 0.1, 'the video is as long as its steps');
  const cues = readFileSync(path.join(out, 'first.srt'), 'utf8').trim().split('\n\n').map((block) => {
    const [, times, text] = block.split('\n');
    const [a, b] = times.split(' --> ').map((t) => t.split(/[:,]/).map(Number)).map(([h, m, sec, ms]) => h * 3600 + m * 60 + sec + ms / 1000);
    return { a, b, text };
  });
  assert.deepEqual(cues.map((c) => c.text), ['First part is here.', 'And then more words follow.', 'Done.']);
  assert.ok(cues[1].a - cues[0].b >= 0.95, `the second caption waits out the pause (gap ${(cues[1].a - cues[0].b).toFixed(2)}s)`);
  const chapters = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_chapters', '-of', 'json', path.join(out, 'first.mp4')], { encoding: 'utf8' }).stdout).chapters;
  assert.deepEqual(chapters.map((c) => c.tags.title), ['One', 'Two']);

  // Renamed spec: the old video goes. A check run keeps the new one, and says it's older.
  const second = spec('full-b', `{ name: 'second', title: 'Full', motion: false, slides: ${slides} }`);
  assert.equal(build([second, '--out', out]).status, 0);
  assert.ok(!existsSync(path.join(out, 'first.mp4')) && !existsSync(path.join(out, 'first.srt')), 'no video left from the old name');
  const check = build([second, '--check', '--out', out]);
  assert.match(check.stdout, /note: .*second\.mp4 is from an earlier full build/);
  assert.ok(existsSync(path.join(out, 'second.mp4')));

  // A build that stops at a check that needs no rendering leaves the last good output alone.
  const broken = spec('full-c', `{ name: 'second', title: 'Full', voice: { voice: ${JSON.stringify(path.join(tmp, 'nobody.npz'))} }, slides: ${slides} }`);
  assert.equal(build([broken, '--out', out]).status, 1);
  assert.ok(existsSync(path.join(out, 'second.mp4')) && existsSync(path.join(out, 'slides/slide-01-1.png')), 'video and slides are still there');

  // So does one that fails after rendering (here, a clip ffmpeg can't read).
  writeFileSync(path.join(tmp, 'broken.mp4'), 'not a video');
  const late = spec('full-d', `{ name: 'third', title: 'Full', motion: false, slides: [{ title: 'One', say: 'Hi.' }, { media: 'broken.mp4', say: 'A clip.' }] }`);
  assert.notEqual(build([late, '--out', out]).status, 0);
  assert.ok(existsSync(path.join(out, 'second.mp4')) && existsSync(path.join(out, 'second.srt')) && existsSync(path.join(out, 'report.json')), 'the last video, captions and report survive a late failure');
});

test('content that runs off a title slide is an error', opts, () => {
  const file = spec('overflow', `{ title: 't', slides: [{ layout: 'title', title: 'Too much', body: Array.from({ length: 16 }, (_, i) => c.lede('Paragraph ' + (i + 1) + ' of far too many for one slide.')).join(''), say: 'Hi.' }] }`);
  const r = build([file, '--check', '--theme', 'paper', '--out', path.join(tmp, 'overflow')]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /ERROR slide 1: the title runs \d+px off the top of the slide/);
  assert.match(r.stdout, /into the footer/);
});

test('html/ keeps each slide as checked: fitted panels and the footer contrast mark', opts, () => {
  const html = readFileSync(path.join(tmp, 'trusted/html/slide-02.html'), 'utf8');
  assert.match(html, /class="[^"]*\bon-(dark|light)\b/);
  assert.match(html, /Content-Security-Policy/);
});

test('screenshot marks: the page scrolls to them, and marks that cannot all be seen stop the build', opts, async () => {
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end('<body style="margin:0;font:24px sans-serif"><p>top</p><button id="low" style="position:absolute;top:2000px;left:40px">Low</button><button id="high" style="position:absolute;top:10px;left:300px">High</button></body>');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const shotSpec = (name, opts) => {
    const file = path.join(tmp, `${name}.mjs`);
    writeFileSync(file, `export default async (c) => { const s = await c.screenshot(${JSON.stringify(url)}, ${JSON.stringify(opts)}); return { title: 't', slides: [{ title: 'x', body: c.image(s), say: 'Hi.' }] }; };`);
    return file;
  };
  try {
    const low = await runAsync(BUILD, [shotSpec('shot-low', { viewport: { width: 640, height: 360 }, marks: [{ target: '#low', caption: 'Down here' }] }), '--check', '--repo', repo, '--out', path.join(tmp, 'shot-low')]);
    assert.equal(low.status, 0, low.stdout + low.stderr);
    const both = await runAsync(BUILD, [shotSpec('shot-both', { viewport: { width: 640, height: 360 }, marks: [{ target: '#low' }, { target: '#high' }] }), '--check', '--repo', repo, '--out', path.join(tmp, 'shot-both')]);
    assert.notEqual(both.status, 0);
    assert.match(both.stderr, /"#high" is outside the shot/);
    const full = await runAsync(BUILD, [shotSpec('shot-full', { viewport: { width: 640, height: 360 }, fullPage: true, marks: [{ target: '#low' }, { target: '#high' }] }), '--check', '--repo', repo, '--out', path.join(tmp, 'shot-full')]);
    assert.equal(full.status, 0, full.stdout + full.stderr);
  } finally {
    server.close();
  }
});

test("a mark's caption sits by its ring, on a scrolled page or a full-page shot", opts, async () => {
  const browser = await chromium().launch();
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    await page.setContent('<body style="margin:8px;position:relative"><div style="height:3000px"></div><button id="go" style="position:absolute;top:2000px;left:40px">Go</button></body>');
    for (const area of ['page', 'viewport']) {
      if (area === 'viewport') await page.locator('#go').scrollIntoViewIfNeeded();
      await page.evaluate(() => document.getElementById('walkthrough-annotations')?.remove());
      await annotate(page, page.locator('#go'), 'Press it', { area });
      const [target, ring, caption] = await page.evaluate(() => ['#go', '#walkthrough-annotations .ring', '#walkthrough-annotations .caption'].map((q) => document.querySelector(q).getBoundingClientRect().top + scrollY));
      assert.ok(Math.abs(ring - (target - 8)) <= 1, `${area}: ring at ${ring}, target at ${target}`);
      assert.ok(Math.abs(caption - ring) < 120, `${area}: caption at ${caption}, ring at ${ring}`);
    }
  } finally {
    await browser.close();
  }
});

test('several marks on one shot: every target stays bright, the rest is dimmed once', opts, async () => {
  const browser = await chromium().launch();
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    await page.setContent('<body style="margin:0;background:#fff"><div id="a" style="position:absolute;left:40px;top:60px;width:120px;height:60px"></div><div id="b" style="position:absolute;left:400px;top:200px;width:120px;height:60px"></div></body>');
    await annotate(page, page.locator('#a'), '');
    await annotate(page, page.locator('#b'), '');
    await page.waitForTimeout(300);
    const file = path.join(tmp, 'two-marks.png');
    await page.screenshot({ path: file });
    for (const [x, y, what] of [[100, 90, 'first target'], [460, 230, 'second target']]) assert.deepEqual(pixel(file, x, y), [255, 255, 255], `${what} isn't dimmed`);
    const [grey] = pixel(file, 320, 20);
    assert.ok(grey > 150 && grey < 180, `outside the marks is dimmed once (${grey})`);
  } finally {
    await browser.close();
  }
});

test("a screenshot can be a media slide on the folder's first build", opts, () => {
  const page = path.join(tmp, 'media-page.html');
  writeFileSync(page, '<body style="margin:0;background:#00f"></body>');
  const file = path.join(tmp, 'shot-media.mjs');
  writeFileSync(file, `export default async (c) => ({ title: 't', slides: [{ media: await c.screenshot(${JSON.stringify(pathToFileURL(page).href)}, { name: 'blue', viewport: { width: 640, height: 360 } }), say: 'Blue.' }] });`);
  const out = path.join(tmp, 'shot-media');
  const r = build([file, '--check', '--out', out]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(existsSync(path.join(out, 'shots/blue.png')));
  const [red, , blue] = pixel(path.join(out, 'contact-sheet.png'), 16 + 240, 16 + 135);
  assert.ok(red < 60 && blue > 200, 'the shot is on the contact sheet');
});

test("media from inside the output folder is refused, since the build replaces it", opts, () => {
  const out = path.join(tmp, 'media-inside');
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, '.narrated-walkthrough'), '');
  writeFileSync(path.join(out, 'demo.mp4'), '');
  const file = spec('media-inside', `{ title: 't', slides: [{ media: ${JSON.stringify(path.join(out, 'demo.mp4'))}, say: 'Hi.' }] }`);
  const r = build([file, '--check', '--out', out]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /inside the build's output folder/);
  assert.ok(existsSync(path.join(out, 'demo.mp4')));
});

test('one build at a time per folder; a lock left by a stopped build is taken over', opts, () => {
  const out = path.join(tmp, 'locked');
  mkdirSync(path.join(out, 'audio'), { recursive: true });
  writeFileSync(path.join(out, '.narrated-walkthrough'), '');
  writeFileSync(path.join(out, 'audio/01-1.wav'), 'keep');
  writeFileSync(path.join(out, '.lock'), String(process.pid));
  const busy = build([deck, '--check', '--out', out]);
  assert.equal(busy.status, 2, busy.stdout + busy.stderr);
  assert.match(busy.stderr, new RegExp(`another build \\(process ${process.pid}\\)`));
  writeFileSync(path.join(out, '.lock'), String(spawnSync('true').pid));
  const r = build([deck, '--check', '--out', out]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(!existsSync(path.join(out, '.lock')), 'the lock goes when the build ends');
  assert.equal(readFileSync(path.join(out, 'audio/01-1.wav'), 'utf8'), 'keep', "--check leaves the last video's audio alone");
});

test("speak.mjs previews the machine's narrator, as the build would use it", full, () => {
  const home2 = path.join(tmp, 'speak-home');
  mkdirSync(home2, { recursive: true });
  if (existsSync(path.join(HOME, 'presets.json'))) cpSync(path.join(HOME, 'presets.json'), path.join(home2, 'presets.json'));
  writeFileSync(path.join(home2, 'config.json'), JSON.stringify({ voice: { voice: 'en_male_narrator_1' } }));
  const out = path.join(tmp, 'speak');
  const r = spawnSync(process.execPath, [path.join(here, '../scripts/speak.mjs'), 'Hello there.', '--out', out], {
    env: { ...process.env, NARRATED_WALKTHROUGH_HOME: home2, NARRATED_WALKTHROUGH_VENV: VENV },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(existsSync(path.join(out, 'en_male_narrator_1-seed7.wav')));
});

test('the default, with motion: frames, exits and a video whose length matches its steps', full, () => {
  const out = path.join(tmp, 'motion-full');
  const file = spec('motion-full', `{ name: 'moving', title: 'Motion', slides: [
    { layout: 'title', kicker: 'PR #1', title: 'A title', say: '-5 degrees is cold, and this line starts with a minus sign.' },
    { title: 'Two steps', body: c.bullets(['One', 'Two'], { reveal: 1 }) + c.term('$ echo hi\\nhi', { step: 2 }), say: ['First step.', 'Second step.'] },
    { title: 'Last', hold: 0, say: 'The end.' },
  ] }`);
  const r = build([file, '--out', out]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const report = JSON.parse(readFileSync(path.join(out, 'report.json'), 'utf8'));
  const probe = (args) => spawnSync('ffprobe', ['-v', 'error', ...args, path.join(out, 'moving.mp4')], { encoding: 'utf8' }).stdout.trim();
  const frames = Number(probe(['-select_streams', 'v', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'default=nw=1:nk=1']));
  const steps = report.slides.flatMap((s) => s.steps);
  assert.equal(frames, Math.round(steps.reduce((n, st) => n + st.seconds, 0) * 30), 'one video frame per planned frame');
  // The narration track before AAC encoding (which pads by a frame or two of its own).
  const audio = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path.join(out, 'narration.wav')], { encoding: 'utf8' }).stdout);
  assert.ok(Math.abs(audio - frames / 30) < 0.005, `audio ${audio}s and video ${frames / 30}s match`);
  assert.ok(existsSync(path.join(out, 'frames/01-1/x001.jpg')) && existsSync(path.join(out, 'frames/02-2/x001.jpg')), "exit frames on each slide's last step");
  assert.ok(!existsSync(path.join(out, 'frames/02-1/x001.jpg')), 'and not before it');
  assert.ok(!existsSync(path.join(out, 'frames/03-1/x001.jpg')), 'the last slide stays');
});
