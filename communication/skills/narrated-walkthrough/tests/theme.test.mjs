// node --test tests/*.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

// An empty machine home, so this machine's own themes and config don't change the results; set
// before the modules load, since paths.mjs reads it once.
const tmp = mkdtempSync(path.join(os.tmpdir(), 'nw-theme-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
process.env.NARRATED_WALKTHROUGH_HOME = path.join(tmp, 'home');
const { checkConfig, checkSpec, matchesRule, normalizeRemote, resolveContext } = await import('../scripts/lib/context.mjs');
const { assertSafeCss, loadDecor, loadTheme, themeCss } = await import('../scripts/lib/theme.mjs');

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/repo');

test('remotes normalise to host/owner/repo', () => {
  for (const url of ['https://github.com/acme/widgets.git', 'git@github.com:acme/widgets.git', 'ssh://git@github.com/acme/widgets', 'https://github.com/acme/widgets/']) {
    assert.equal(normalizeRemote(url), 'github.com/acme/widgets', url);
  }
  assert.equal(normalizeRemote('ssh://git@host:2222/acme/widgets.git'), 'host:2222/acme/widgets');
  // In git's user@host:path form, the colon starts the path, even when the owner starts with a digit.
  assert.equal(normalizeRemote('git@github.com:37signals/kamal.git'), 'github.com/37signals/kamal');
  assert.equal(normalizeRemote('github.com:37signals/kamal'), 'github.com/37signals/kamal');
  assert.ok(matchesRule('github.com/37signals/*', normalizeRemote('git@github.com:37signals/kamal')));
});

test('machine rules match remotes with * wildcards, ignoring case', () => {
  assert.ok(matchesRule('github.com/acme/*', 'github.com/Acme/widgets'));
  assert.ok(matchesRule('*', null));
  assert.ok(!matchesRule('github.com/acme/*', 'github.com/other/acme'));
  assert.ok(!matchesRule('github.com/a.c/*', 'github.com/abc/x'), 'dots are literal');
});

test('a theme chain records where each theme came from', () => {
  const t = loadTheme('demo', repo);
  assert.deepEqual(t.names, ['demo', 'paper', 'midnight']);
  assert.equal(t.origin, 'repo');
  assert.equal(loadTheme('paper', repo).origin, 'built-in');
  assert.equal(loadTheme({ extends: 'paper', tokens: { accent: 'red' } }, repo).origin, 'inline');
  assert.deepEqual(t.decor.map((d) => d.origin), ['repo']);
});

test("a repo theme's decor runs only when repo themes are trusted", async () => {
  const t = loadTheme('demo', repo);
  const untrusted = await loadDecor(t);
  assert.deepEqual(Object.keys(untrusted.decor), []);
  assert.equal(untrusted.skipped.length, 1);
  const trusted = await loadDecor(t, { trustRepo: true });
  assert.deepEqual(Object.keys(trusted.decor).sort(), ['frame', 'heroArt']);
  const html = trusted.decor.frame({ slide: { n: 2 }, total: 5, brand: t.brand, esc: (s) => s });
  assert.match(html, /Demo 2\/5/);
  assert.match(trusted.decor.heroArt({ slide: { n: 1 } }), /data-draw/);
});

test('slide CSS can never close its <style> element, from any source', () => {
  assert.throws(() => themeCss(loadTheme({ extends: 'paper', tokens: { bg: 'red}</style><script>x</script><style>a{' } }, repo)), /<\/style/);
  assert.throws(() => themeCss(loadTheme({ extends: 'paper', fonts: [{ family: "X</STYLE>", src: 'x.woff2' }] }, repo)), /font family/, 'stopped even earlier, when the theme loads');
  assert.throws(() => assertSafeCss('a{}</style >', 'spec.css'), /spec\.css/);
  assert.doesNotThrow(() => themeCss(loadTheme('demo', repo)));
});

test('font entries must look like fonts', () => {
  const bad = [
    { family: 'X</script><script>alert(1)</script>', src: 'x.woff2' },
    { family: "X'; } body { color: red", src: 'x.woff2' },
    { family: 'X', src: 'x.woff2', weight: '400; src: url(http://evil)' },
    { family: 'X', src: 'x.woff2)', style: 'normal' },
    { family: 'X', src: 'x.woff2', style: 'bold' },
  ];
  for (const f of bad) assert.throws(() => loadTheme({ extends: 'paper', fonts: [f] }, repo), /font/, JSON.stringify(f));
  assert.doesNotThrow(() => loadTheme({ extends: 'paper', fonts: [{ family: 'DM Sans', src: 'fonts/a.woff2', weight: '100 1000', style: 'italic' }] }, repo));
});

test("a repo config's or spec's logo is resolved from where it was set, and encoded", () => {
  const dir = mkdtempSync(path.join(tmp, 'logo-'));
  spawnSync('git', ['init', '-q', dir]);
  mkdirSync(path.join(dir, '.walkthrough'));
  writeFileSync(path.join(dir, '.walkthrough/config.json'), JSON.stringify({ theme: 'paper', brand: { logo: 'logo" onerror="x.svg' } }));
  const c = resolveContext({ repo: dir, repoExplicit: true });
  assert.match(c.brand.logo, /^file:\/\/.*\/\.walkthrough\/logo%22%20onerror=%22x\.svg$/);
  const s = resolveContext({ repo: dir, repoExplicit: true, specDir: '/specs', spec: { brand: { logo: 'mark.png' } } });
  assert.equal(s.brand.logo, 'file:///specs/mark.png');
});

// A throwaway git repo with these files under .walkthrough/.
function tmpRepo(files) {
  const dir = mkdtempSync(path.join(tmp, 'repo-'));
  spawnSync('git', ['init', '-q', dir]);
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, '.walkthrough', f)), { recursive: true });
    writeFileSync(path.join(dir, '.walkthrough', f), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return dir;
}

test("a theme's name is its folder: names are checked, and theme.json can't rename it", () => {
  for (const bad of ['../../etc', 'a/b', 'x"><img>', '']) assert.throws(() => loadTheme(bad, repo), /isn't a theme name|a theme is a name/, bad);
  const dir = tmpRepo({ 'themes/a/theme.json': { name: 'b', extends: 'a' }, 'themes/c/theme.json': { name: 'x"><script>', extends: 'paper' } });
  assert.throws(() => loadTheme('a', dir), /theme "a" extends itself \(a → a\)/, 'a renamed theme extending its own folder is caught, not a stack overflow');
  const c = loadTheme('c', dir);
  assert.deepEqual(c.names, ['c', 'paper', 'midnight']);
  assert.match(c.notes.join('\n'), /sets "name".*ignored/);
});

test('a repo theme with the name of another theme says it replaces it', () => {
  const dir = tmpRepo({ 'themes/paper/theme.json': { extends: 'midnight' } });
  const t = loadTheme('paper', dir);
  assert.equal(t.origin, 'repo');
  assert.match(t.notes.join('\n'), /replaces the built-in theme of the same name/);
});

test('an inline theme resolves its files from where it was set, and has no CSS file of its own', () => {
  const dir = tmpRepo({ 'theme.css': 'body { color: red }' });
  const t = loadTheme({ extends: 'paper', dir: '/', css: 'etc/hosts', fonts: [{ family: 'X', src: 'fonts/x.woff2' }], brand: { logo: 'data:image/svg+xml,<svg/>' } }, dir, { base: '/specs' });
  assert.doesNotMatch(t.css, /color: red|localhost/, 'no implicit theme.css, and no dir or css options');
  assert.equal(t.fonts.at(-1).url, 'file:///specs/fonts/x.woff2');
  assert.match(t.brand.logo, /^data:image\/svg\+xml,/, 'a theme logo can be a URL too, as in config');
  assert.equal(t.names[0], 'inline');
  const ctx = resolveContext({ repo: dir, repoExplicit: true, specDir: '/specs', spec: { theme: { extends: 'paper', fonts: [{ family: 'X', src: 'x.woff2' }] } } });
  assert.equal(ctx.theme.fonts.at(-1).url, 'file:///specs/x.woff2', "a spec's inline theme is relative to the spec");
});

test('config values are checked where they enter, naming the file', () => {
  const bad = [
    [{ timing: { hold: '1.2' } }, /config\.json: timing\.hold is a number/],
    [{ timing: { pause: 1 } }, /timing has lead, gap and hold/],
    [{ motion: 'false' }, /"motion" is true or false/],
    [{ footer: { text: 'x' } }, /"footer" is text/],
    [{ lexicon: { '': 'um' } }, /lexicon entries/],
    [{ lexicon: 'abc' }, /"lexicon" maps/],
    [{ voice: { speed: '0.9' } }, /voice\.speed/],
    [{ voice: { voice: 3 } }, /voice\.voice/],
  ];
  for (const [config, re] of bad) {
    const dir = tmpRepo({ 'config.json': config });
    assert.throws(() => resolveContext({ repo: dir, repoExplicit: true }), re, JSON.stringify(config));
  }
  assert.throws(() => checkConfig({ timing: { lead: -1 } }, 'the spec'), /^Error: the spec: timing\.lead/);
  // A repo's config can't ask for hours of still frames or an engine that never finishes.
  assert.throws(() => checkConfig({ timing: { hold: 100000 } }, 'x'), /timing\.hold is a number of seconds from 0 to 30/);
  assert.throws(() => checkConfig({ voice: { steps: 1e6 } }, 'x'), /voice\.steps is a whole number from 1 to 200/);
  assert.doesNotThrow(() => checkConfig({ timing: { lead: 0 }, motion: false, footer: false, lexicon: { a: 'b' }, voice: { voice: { audio: 'r.wav', text: 't' }, speed: 0.9, seed: 3 } }, 'x'));
});

test("token names and values can't reach past their own declaration", () => {
  for (const tokens of [{ bg: 'red; } body { color: red' }, { 'a b': 'red' }, { bg: 'x</style>' }, { 'a}': 'red' }]) {
    assert.throws(() => loadTheme({ extends: 'paper', tokens }, repo), /token/, JSON.stringify(tokens));
  }
  assert.throws(() => loadTheme({ extends: { tokens: {} } }, repo), /extends is a theme name/);
  assert.doesNotThrow(() => loadTheme({ extends: 'paper', tokens: { accent: '#e0561b', 'font-sans': '"Avenir Next", sans-serif', 'size-code': 24 } }, repo));
});

test('a spec is checked slide by slide before anything runs', () => {
  const ok = { title: 't', slides: [{ title: 'One', say: ['a', 'b'], layout: 'title' }, { media: 'clip.mp4', say: 'x' }] };
  assert.doesNotThrow(() => checkSpec(ok));
  const bad = [
    [{ slides: [] }, /"slides" is a list/],
    [{ slides: 'x' }, /"slides" is a list/],
    [{ lang: 'en_US', slides: [{}] }, /lang is a language tag/],
    [{ slides: [{ say: 42 }] }, /slide 1: say is text/],
    [{ slides: [{}, { say: ['a', 3] }] }, /slide 2: say is text/],
    [{ slides: [{ layout: 'titel' }] }, /layout is default, title, section/],
    [{ slides: [{ media: 'a.gif' }] }, /media is a \.png/],
    [{ slides: [{ title: 3 }] }, /title is text/],
    [{ slides: [{ hold: '1' }] }, /hold is a number/],
    [{ slides: [{ hold: 100000 }] }, /hold is a number of seconds from 0 to 30/],
    [{ slides: [{ silent: 7200 }] }, /silent is a number of seconds from 0 to 600/],
    [{ slides: [{ speed: 0 }] }, /speed is a number from 0.25 to 4/],
    [{ name: 'PR 92 / sync', slides: [{}] }, /name is letters, digits/],
    [{ name: '../x', slides: [{}] }, /name is letters, digits/],
    [{ name: 92, slides: [{}] }, /name is letters, digits/],
    [{ repo: ['..'], slides: [{}] }, /repo is text/],
    [{ title: { en: 'x' }, slides: [{}] }, /title is text/],
    [{ slides: [{ seed: 1.5 }] }, /seed is a whole number/],
  ];
  for (const [spec, re] of bad) assert.throws(() => checkSpec(spec), re, JSON.stringify(spec));
});

test('voice settings are checked, after merging the layers', () => {
  const dir = tmpRepo({});
  const ctx = (voice) => resolveContext({ repo: dir, repoExplicit: true, specDir: '/specs', spec: { voice } });
  assert.throws(() => ctx({ language: 'english' }), /voice\.language is one of de, en/);
  assert.throws(() => ctx({ variant: 'int3' }), /voice\.variant/);
  assert.throws(() => ctx({ steps: 0 }), /voice\.steps/);
});

test('voice files are relative to the file that set them', () => {
  const dir = tmpRepo({ 'config.json': { voice: { voice: { audio: 'narrator.wav', text: 'Hi.' } } } });
  const repoVoice = resolveContext({ repo: dir, repoExplicit: true }).voice.voice;
  assert.equal(repoVoice.audio, path.join(realpathSync(dir), '.walkthrough/narrator.wav'));
  assert.equal(resolveContext({ repo: dir, repoExplicit: true, specDir: '/specs', spec: { voice: { voice: 'v.npz' } } }).voice.voice, '/specs/v.npz');
  assert.equal(resolveContext({ repo: dir, repoExplicit: true, specDir: '/specs', spec: { voice: { voice: 'en_male_narrator_1' } } }).voice.voice, 'en_male_narrator_1', 'names stay names');
});

test('a recorded voice narrates in the language it was recorded in, unless a config says otherwise', async () => {
  const { resolveVoice } = await import('../scripts/lib/tts.mjs');
  const voices = path.join(tmp, 'home/voices');
  mkdirSync(voices, { recursive: true });
  writeFileSync(path.join(voices, 'anna.npz'), '');
  writeFileSync(path.join(voices, 'anna.json'), JSON.stringify({ language: 'de', speed: 0.8 }));
  try {
    const v = resolveVoice({ voice: 'anna' });
    assert.equal(v.language, 'de');
    assert.equal(v.speed, 0.8);
    assert.equal(resolveVoice({ voice: 'anna', language: 'fr' }).language, 'fr');
    assert.equal(resolveVoice({ voice: 'en_female_narrator' }).language, 'en');
  } finally {
    rmSync(voices, { recursive: true, force: true });
  }
});

test("a failed preset listing isn't retried by every build", async () => {
  const { presetVoices } = await import('../scripts/lib/tts.mjs');
  // A stand-in Python that counts its calls and fails, as an offline listing does.
  const bin = path.join(tmp, 'home/venv/bin');
  const calls = path.join(tmp, 'python-calls');
  mkdirSync(bin, { recursive: true });
  writeFileSync(path.join(bin, 'python'), `#!/bin/sh\necho x >> '${calls}'\nexit 1\n`);
  chmodSync(path.join(bin, 'python'), 0o755);
  try {
    assert.equal(presetVoices(), null);
    assert.equal(presetVoices(), null);
    assert.equal(readFileSync(calls, 'utf8').trim().split('\n').length, 1, 'tried once, then backed off');
    presetVoices({ refresh: true });
    assert.equal(readFileSync(calls, 'utf8').trim().split('\n').length, 2, 'refresh still tries');
  } finally {
    rmSync(path.join(tmp, 'home/venv'), { recursive: true, force: true });
    rmSync(path.join(tmp, 'home/presets.json'), { force: true });
  }
});
