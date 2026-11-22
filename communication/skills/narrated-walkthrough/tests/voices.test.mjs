// node --test tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unknownVoices } from '../scripts/lib/tts.mjs';

const env = { isRecorded: (n) => n === 'alex' || n === 'alex-dry', exists: (p) => p === '/voices/alex.npz' || p === '/a.wav', presets: ['en_female_narrator', 'en_male_narrator_1'] };

test('presets, recorded voices, existing .npz files and clones are all fine', () => {
  assert.deepEqual(unknownVoices(['en_female_narrator', 'alex', 'alex-dry', '/voices/alex.npz', { audio: '/a.wav', text: 'hi' }], env), []);
});

test('unknown names and missing files are reported, once each', () => {
  assert.deepEqual(unknownVoices(['en_femal_narator', 'en_femal_narator', '/voices/gone.npz', { audio: '/gone.wav', text: 'hi' }], env), [
    { voice: 'en_femal_narator', why: "isn't a Reverb preset or a voice recorded on this machine" },
    { voice: '/voices/gone.npz', why: 'no such file' },
    { voice: '/gone.wav', why: 'no such file (the recording to clone)' },
  ]);
});

test("other engines' voices are checked against their own list", () => {
  assert.deepEqual(unknownVoices(['Samantha', 'Samanta'], { isRecorded: () => false, exists: () => false, presets: ['Samantha', 'Daniel'], kind: 'a say voice on this machine' }), [
    { voice: 'Samanta', why: "isn't a say voice on this machine" },
  ]);
});

test("without a preset list, names that aren't recorded are let through", () => {
  assert.deepEqual(unknownVoices(['anything'], { ...env, presets: null }), []);
});

test('a speed belongs to the voice it was set with', async () => {
  const { mergeVoices } = await import('../scripts/lib/tts.mjs');
  const machine = [{ voice: 'alex', speed: 0.7 }, 'machine'];
  assert.deepEqual(mergeVoices([machine, [{ voice: 'en_male_narrator_1' }, 'repo']]), { voice: { voice: 'en_male_narrator_1' }, from: 'repo' });
  assert.deepEqual(mergeVoices([machine, [{ speed: 0.9 }, 'repo']]), { voice: { voice: 'alex', speed: 0.9 }, from: 'machine' });
  assert.deepEqual(mergeVoices([machine, [{ seed: 3 }, 'spec']]), { voice: { voice: 'alex', speed: 0.7, seed: 3 }, from: 'machine' });
  assert.deepEqual(mergeVoices([[{ voice: 'alex', speed: 0.7 }], [{ voice: 'alex-dry' }]]).voice, { voice: 'alex-dry' }, 'a style keeps its own calibration');
  assert.deepEqual(mergeVoices([]), { voice: {}, from: 'built-in default' });
});

test('changing engine replaces the whole narrator', async () => {
  const { mergeVoices } = await import('../scripts/lib/tts.mjs');
  const machine = [{ voice: 'alex', speed: 0.7, seed: 3 }, 'machine'];
  assert.deepEqual(mergeVoices([machine, [{ engine: 'say' }, 'spec']]), { voice: { engine: 'say', seed: 3 }, from: 'spec' });
  assert.deepEqual(mergeVoices([[{ engine: 'say', voice: 'Samantha', rate: 200 }, 'machine'], [{ voice: 'en_male_narrator_1' }, 'repo']]).voice, { engine: 'say', voice: 'en_male_narrator_1' }, 'a new voice drops the old rate');
  assert.deepEqual(mergeVoices([machine, [{ engine: 'reverb' }, 'repo']]).voice, { voice: 'alex', speed: 0.7, seed: 3, engine: 'reverb' }, 'naming the same engine changes nothing');
});
