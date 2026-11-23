// Narration text: delivery cues, pronunciations and the lint for things the voice reads badly.
// Pure functions, so they can be tested without a build (tests/narration.test.mjs).
//
// Cues inside a say string:
//   [beat]          a short pause (0.55 s), e.g. before a punchline
//   [pause 1.2]     a pause of n seconds
//   [dry] [up]      read what follows in that style of the narrator: the recorded voice "<voice>-dry"
//                   or "<voice>-up" (e.g. alex-dry), until [plain] or another voice cue
//   [voice NAME]    read what follows in another voice (a preset or a recorded voice), e.g. to play
//                   a sample of it; ends the same way
//   [plain]         back to the narrator, after 0.3 s so the aside lands
// Anything else in brackets is not a cue: it stays in the text, and the lint flags it.
// Cues never appear in captions or narration.md's display text.

export const STYLES = ['dry', 'up'];
export const BEAT = 0.55;
export const ASIDE_GAP = 0.3;
const CUE = new RegExp(`\\[(?:(?<beat>beat)|pause\\s+(?<pause>\\d+(?:\\.\\d+)?)|voice\\s+(?<voice>[\\w-]+)|(?<plain>plain)|(?<style>${STYLES.join('|')}))\\]`, 'gi');

/**
 * Whole-token replacement of display text with spoken text, in one pass: longer entries win where
 * they overlap, and a replacement is never itself replaced again.
 */
export function makeLexicon(entries = {}) {
  const list = Object.entries(entries).sort((a, b) => b[0].length - a[0].length);
  if (!list.length) return (text) => text;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const spoken = new Map(list);
  const re = new RegExp(`(?<![\\w-])(?:${list.map(([from]) => esc(from)).join('|')})(?![\\w-])`, 'g');
  return (text) => text.replace(re, (m) => spoken.get(m));
}

/**
 * Split one narration step into segments of one voice each.
 * Returns { display, segments: [{ text, input, style, voice, pauseAfter }] }, where style is 'dry' or
 * 'up' (resolved to a voice later, see resolveStyles), voice is a [voice NAME] cue's name, and input
 * is the text after the lexicon.
 */
export function parseSay(text, { lexicon = (t) => t } = {}) {
  const segments = [];
  let current = { style: null, voice: null };
  let last = 0;
  const push = (chunk, pause) => {
    const t = chunk.replace(/\s+/g, ' ').trim();
    if (t) segments.push({ text: t, ...current, pauseAfter: pause });
    else if (pause) {
      if (segments.length) segments.at(-1).pauseAfter += pause;
      else segments.push({ text: '', ...current, pauseAfter: pause });
    }
  };
  for (const m of text.matchAll(CUE)) {
    const g = m.groups;
    const chunk = text.slice(last, m.index);
    last = m.index + m[0].length;
    if (g.beat) push(chunk, BEAT);
    else if (g.pause) push(chunk, Number(g.pause));
    else {
      const next = g.plain ? { style: null, voice: null } : g.voice ? { style: null, voice: g.voice } : { style: g.style.toLowerCase(), voice: null };
      const leaving = (current.style || current.voice) && (next.style !== current.style || next.voice !== current.voice);
      push(chunk, leaving ? ASIDE_GAP : 0);
      current = next;
    }
  }
  push(text.slice(last), 0);
  for (const seg of segments) seg.input = lexicon(seg.text);
  const display = text.replace(CUE, ' ').replace(/\s+([,.!?;:])/g, '$1').replace(/\s+/g, ' ').trim();
  return { display, segments };
}

/**
 * Give styled segments a voice: [dry] → "<narrator>-dry" when that recorded voice exists, else the
 * narrator. Returns the styles that had no recording, so the build can say so.
 */
export function resolveStyles(segments, narrator, hasRecording) {
  const missing = new Set();
  for (const seg of segments) {
    if (!seg.style) continue;
    const name = narrator ? `${narrator}-${seg.style}` : null;
    if (name && hasRecording(name)) seg.voice = name;
    else missing.add(seg.style);
  }
  return missing;
}

// Things a voice reads badly, found in the spoken text (after the lexicon).
const CODEY = [
  [/\S+\.(md|json|mjs|js|ts|tsx|py|toml|yaml|yml|sh|txt|css|html)\b/g, 'file name'],
  [/(?:^|\s)--?[a-z][\w-]*/g, 'command-line flag'],
  [/\b\w+[/\\]\w+[/\\]?\S*/g, 'path'],
  [/\b\w*_\w+\b/g, 'snake_case identifier'],
  [/\b[a-z]+[A-Z]\w*\b/g, 'camelCase identifier'],
  [/\b\w+:\w+\b/g, 'colon-joined token'],
  [/[`<>{}[\]()#|*=~]/g, 'symbol the voice drops or reads oddly'],
  [/\b\d+(\.\d+)?(ms|s|kb|mb|gb|px)\b/gi, 'number with unit suffix'],
];

// Things that look code-like but read fine: Reverb says URLs and "#92" itself, product names
// like macOS and iPhone are words, "and/or" is a phrase, and "1990s" is a decade.
// A domain counts only where its ending ends the word, so vite.config.ts isn't a "vite.co" URL.
const URL = /\bhttps?:\/\/\S+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|org|net|io|dev|app|ai|co|uk)(?:\/\S*|(?=$|[\s,;:!?)'"]|\.(?:\s|$)))/gi;
const FINE = [
  ['symbol the voice drops or reads oddly', (t, at, s) => t === '#' && /\d/.test(s[at + 1] ?? '')],
  ['camelCase identifier', (t) => /^(?:[a-z]+OS|i(?:Phone|Pad|Mac|Cloud|Pod)|eBay)$/.test(t)],
  ['path', (t) => /^(and|either)\/or$/i.test(t)],
  ['colon-joined token', (t) => /^\d+:\d+$/.test(t)], // times
  ['number with unit suffix', (t) => /^\d{3}0s$/.test(t)], // decades: the 1990s
];

/** [{ token, what }] for each thing in spoken text that the voice would read badly. */
export function lintSpoken(spoken) {
  const urls = [...spoken.matchAll(URL)].map((m) => [m.index, m.index + m[0].length]);
  const inUrl = (at) => urls.some(([a, b]) => at >= a && at < b);
  const found = [];
  for (const [re, what] of CODEY) {
    for (const m of spoken.matchAll(re)) {
      const token = m[0].trim();
      const at = m.index + m[0].indexOf(token);
      if (inUrl(at) || FINE.some(([w, ok]) => w === what && ok(token, at, spoken))) continue;
      found.push({ token, what });
    }
  }
  return found;
}
