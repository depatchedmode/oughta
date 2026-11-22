// node --test tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planTimeline, rangeLabel, sentences } from '../scripts/lib/timeline.mjs';

const timing = { lead: 0.5, gap: 0.5, hold: 1 };
const round = (cues) => cues.map((c) => [Number(c.start.toFixed(2)), Number(c.end.toFixed(2)), c.text]);

test('captions follow the narration: a pause between segments delays the next caption', () => {
  const slides = [{ n: 1, title: 'One', steps: [{ segments: [
    { text: 'First part is here.', seconds: 1.2, pauseAfter: 2 },
    { text: 'And after a long pause, more words follow.', seconds: 2.5, pauseAfter: 0 },
  ] }] }];
  const { steps, cues, chapters } = planTimeline(slides, { timing, fps: 10 });
  assert.deepEqual(round(cues), [[0.5, 1.7, 'First part is here.'], [3.7, 6.2, 'And after a long pause, more words follow.']]);
  assert.equal(steps[0][0].duration, 0.5 + 1.2 + 2 + 2.5 + 1);
  assert.deepEqual(chapters, [{ start: 0, end: 7.2, title: 'One' }]);
});

test('a step that is only a pause lasts as long as the pause', () => {
  const slides = [{ n: 1, steps: [{ segments: [{ text: 'Hi.', seconds: 1, pauseAfter: 0 }] }, { segments: [{ text: '', pauseAfter: 2 }] }] }];
  const { steps, cues } = planTimeline(slides, { timing, fps: 10 });
  assert.equal(steps[0][1].duration, 2 + 1, 'the pause, then the hold');
  assert.equal(steps[0][1].start, 0.5 + 1 + 0.5);
  assert.equal(cues.length, 1, 'a pause has no caption');
});

test('steps are whole frames, start where the last ended, and never cut an animation short', () => {
  const slides = [
    { n: 1, kicker: 'PR #1', steps: [{ segments: [{ text: 'A.', seconds: 0.33 }] }] },
    { n: 2, silent: 2, steps: [{ segments: [] }] },
    { n: 3, hold: 0, steps: [{ segments: [{ text: 'B.', seconds: 0.1 }], animSeconds: 3 }] },
  ];
  const { steps, chapters, total } = planTimeline(slides, { timing, fps: 30 });
  assert.equal(steps[0][0].frameCount, Math.ceil((0.5 + 0.33 + 1) * 30));
  assert.equal(steps[1][0].start, steps[0][0].duration);
  assert.equal(steps[1][0].duration, 2, 'silent slides hold for their seconds');
  assert.equal(steps[2][0].duration, 3.4, 'animation plus a moment at rest');
  assert.equal(chapters[0].title, 'PR #1', 'a chapter falls back to the kicker');
  assert.equal(Number(total.toFixed(4)), Number(steps.flat().reduce((n, s) => n + s.duration, 0).toFixed(4)));
});

test("a slide's exit never plays over its speech", () => {
  const slides = [{ n: 1, hold: 0, steps: [{ segments: [{ text: 'Talking.', seconds: 3 }], animSeconds: 0.5, exitSeconds: 0.2 }] }];
  const { steps } = planTimeline(slides, { timing, fps: 10 });
  assert.equal(steps[0][0].duration, 0.5 + 3 + 0.2, 'hold 0 still leaves room for the exit after the speech');
});

test("sentences don't break at decimals, abbreviations or before a closing quote", () => {
  assert.deepEqual(sentences('It needs Node 18.3 or newer, e.g. on macOS 15.1 it works.'), ['It needs Node 18.3 or newer, e.g. on macOS 15.1 it works.']);
  assert.deepEqual(sentences('Ask in plain words, like “make a walkthrough video.” Then build it.'), ['Ask in plain words, like “make a walkthrough video.”', 'Then build it.']);
});

test('--only labels are sorted ranges', () => {
  assert.equal(rangeLabel([3, 4]), '3-4');
  assert.equal(rangeLabel([2, 1]), '1-2');
  assert.equal(rangeLabel([7, 2, 3, 4, 4]), '2-4_7');
  assert.equal(rangeLabel(Array.from({ length: 120 }, (_, i) => i + 1)), '1-120');
});
