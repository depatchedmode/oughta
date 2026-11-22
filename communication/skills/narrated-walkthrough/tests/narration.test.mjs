// node --test tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lintSpoken, makeLexicon, parseSay, resolveStyles } from '../scripts/lib/narration.mjs';

const shape = (segments) => segments.map(({ text, style, voice, pauseAfter }) => ({ text, style, voice, pauseAfter }));

test('plain text is one segment in the narrator voice', () => {
  const { display, segments } = parseSay('One line.');
  assert.equal(display, 'One line.');
  assert.deepEqual(shape(segments), [{ text: 'One line.', style: null, voice: null, pauseAfter: 0 }]);
});

test('[beat] and [pause n] add pauses after the text before them', () => {
  const { segments } = parseSay('Setup. [beat] Punchline. [pause 1.2] After.');
  assert.deepEqual(segments.map((g) => [g.text, g.pauseAfter]), [['Setup.', 0.55], ['Punchline.', 1.2], ['After.', 0]]);
});

test('[dry] switches style until [plain], which adds a short gap', () => {
  const { display, segments } = parseSay('Thanks for watching. [beat] [dry] Hold your applause. [plain] Bye.');
  assert.equal(display, 'Thanks for watching. Hold your applause. Bye.');
  assert.deepEqual(shape(segments), [
    { text: 'Thanks for watching.', style: null, voice: null, pauseAfter: 0.55 },
    { text: 'Hold your applause.', style: 'dry', voice: null, pauseAfter: 0.3 },
    { text: 'Bye.', style: null, voice: null, pauseAfter: 0 },
  ]);
});

test('[voice NAME] keeps the name exactly and ends at [plain]', () => {
  const { segments } = parseSay('It sounds like this. [voice en_Female_1] A sample. [plain] Back.');
  assert.deepEqual(shape(segments), [
    { text: 'It sounds like this.', style: null, voice: null, pauseAfter: 0 },
    { text: 'A sample.', style: null, voice: 'en_Female_1', pauseAfter: 0.3 },
    { text: 'Back.', style: null, voice: null, pauseAfter: 0 },
  ]);
});

test('a voice cue straight after a style ends the style', () => {
  const { segments } = parseSay('[dry] Deadpan. [voice other] Sample.');
  assert.deepEqual(segments.map((g) => [g.style, g.voice, g.pauseAfter]), [['dry', null, 0.3], [null, 'other', 0]]);
});

test('brackets that are not cues stay in the text, and the lint flags them', () => {
  const { display, segments } = parseSay('Read [sic] it, and array[i], and [dyr] this.');
  assert.equal(display, 'Read [sic] it, and array[i], and [dyr] this.');
  assert.equal(segments.length, 1);
  assert.ok(lintSpoken(segments[0].input).some((f) => f.what.startsWith('symbol')));
});

test('malformed pauses are not cues', () => {
  for (const bad of ['[pause]', '[pause .]', '[pause 1.2.3]', '[paused]']) {
    const { segments } = parseSay(`A ${bad} B`);
    assert.equal(segments.length, 1, bad);
    assert.ok(!segments.some((g) => Number.isNaN(g.pauseAfter)), bad);
  }
});

test('the lexicon replaces whole tokens only, longest first', () => {
  const lex = makeLexicon({ 'spec.mjs': 'spec dot M J S', TTS: 'T T S', 'TTS-2': 'T T S two' });
  assert.equal(lex('Edit spec.mjs, not myspec.mjs. TTS and TTS-2.'), 'Edit spec dot M J S, not myspec.mjs. T T S and T T S two.');
  const { segments } = parseSay('Open spec.mjs.', { lexicon: lex });
  assert.equal(segments[0].input, 'Open spec dot M J S.');
  assert.equal(segments[0].text, 'Open spec.mjs.');
});

test('styles resolve to recorded style voices, and report the ones missing', () => {
  const { segments } = parseSay('[dry] One. [up] Two.');
  const missing = resolveStyles(segments, 'alex', (n) => n === 'alex-dry');
  assert.deepEqual(segments.map((g) => g.voice), ['alex-dry', null]);
  assert.deepEqual([...missing], ['up']);
});

test('lint: file names, flags, paths and identifiers', () => {
  const kinds = (t) => lintSpoken(t).map((f) => f.what);
  assert.ok(kinds('Run build.mjs').includes('file name'));
  assert.ok(kinds('pass --check first').includes('command-line flag'));
  assert.ok(kinds('in src/lib/x').includes('path'));
  assert.ok(kinds('the voice_name field').includes('snake_case identifier'));
  assert.deepEqual(kinds('At 10:30 it ran.'), []);
});

test('lint: dotted file names are flagged even when they contain a domain ending', () => {
  for (const t of ['Edit vite.config.ts now', 'Open app.component.ts', 'see next.config.js', 'run my.dev.json', 'the api.io.ts file']) {
    assert.ok(lintSpoken(t).some((f) => f.what === 'file name'), t);
  }
});

test('lint: things Reverb reads fine are not flagged', () => {
  for (const t of ['This is pull request #92.', 'See https://example.com/docs/setup today.', 'Go to example.com.', 'visit docs.acme.io, then', 'On macOS and iPhone.', 'Tests and/or docs.', 'Back in the 1990s.']) {
    assert.deepEqual(lintSpoken(t), [], t);
  }
});
