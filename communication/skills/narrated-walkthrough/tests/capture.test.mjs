// node --test tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { head, pick } from '../scripts/lib/capture.mjs';

test('pick keeps every matching line, whatever the regex flags', () => {
  const text = 'ok 1\nnot this\nok 2\nok 3\nok 4';
  for (const re of [/ok/, /ok/g, /ok/y, /OK/gi]) assert.equal(pick(text, re), 'ok 1\nok 2\nok 3\nok 4', String(re));
  assert.equal(pick(text, /ok/g, { max: 2 }), 'ok 1\nok 2');
  assert.equal(pick(text, (l) => l.endsWith('3')), 'ok 3');
});

test('head cuts to n lines and says so', () => {
  assert.equal(head('a\nb\nc', 2), 'a\nb\n…');
  assert.equal(head('a\nb', 2), 'a\nb');
});
