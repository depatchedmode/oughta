// The video's timing, as plain data: how long each step is on screen, and the captions and
// chapters that go with it. Pure, so it's tested without rendering, narrating or encoding.
//
// A step is on screen for: lead (first step of a slide only) + its speech + gap (between steps) or
// hold (after a slide's last step). Its speech is each narration segment's audio followed by that
// segment's pause ([beat], [pause n], [plain]), so a step that is only a pause still lasts that long.

/** Sentences of display text, in the language's own rules (so "Node 18.3" and "e.g." don't split). */
export function sentences(text, lang = 'en') {
  return [...new Intl.Segmenter(lang, { granularity: 'sentence' }).segment(text)].map((s) => s.segment.trim()).filter(Boolean);
}

/** Seconds of speech in a step: every segment's audio and the pause after it. */
export const speechSeconds = (segments) => segments.reduce((n, g) => n + (g.seconds ?? 0) + (g.pauseAfter ?? 0), 0);

/**
 * slides: [{ n, title, kicker, lead, gap, hold, silent, mediaSeconds,
 *            steps: [{ segments: [{ text, seconds, pauseAfter }], animSeconds, exitSeconds }] }]
 * animSeconds is all of a step's motion, exitSeconds the part of it that is the slide leaving.
 * timing: { lead, gap, hold } defaults. fps: frames per second. lang: for sentence breaks.
 * Returns { steps, cues, chapters, total }: steps[slide][step] is { start, lead, speech,
 * frameCount, duration } (duration is a whole number of frames); cues are captions { start, end, text }, timed
 * per segment and split into sentences within it by length; chapters are { start, end, title }.
 */
export function planTimeline(slides, { timing, fps, lang = 'en' }) {
  let clock = 0;
  const cues = [];
  const chapters = [];
  const steps = slides.map((s) => {
    const slideStart = clock;
    const planned = s.steps.map((st, idx) => {
      const lead = idx === 0 ? (s.lead ?? timing.lead) : 0;
      const speech = speechSeconds(st.segments);
      // The exit plays at the very end, so a slide's last step holds at least that long after the
      // speech: content never leaves while the voice is still talking about it.
      const tail = idx === s.steps.length - 1 ? Math.max(s.hold ?? timing.hold, st.exitSeconds ?? 0) : (s.gap ?? timing.gap);
      let seconds = speech || !s.silent ? lead + speech + tail : s.silent;
      if (s.mediaSeconds) seconds = Math.max(seconds, s.mediaSeconds);
      // Never cut an animation short: a step lasts at least its motion, plus a moment at rest.
      seconds = Math.max(seconds, (st.animSeconds ?? 0) + 0.4);
      const frameCount = Math.ceil(seconds * fps);
      const start = clock;
      let t = start + lead;
      for (const g of st.segments) {
        const said = g.seconds ?? 0;
        const lines = said ? sentences(g.text ?? '', lang) : [];
        const chars = lines.reduce((n, x) => n + x.length, 0);
        let u = t;
        for (const text of lines) {
          const d = (said * text.length) / chars;
          cues.push({ start: u, end: u + d, text });
          u += d;
        }
        t += said + (g.pauseAfter ?? 0);
      }
      clock += frameCount / fps;
      return { start, lead, speech, frameCount, duration: frameCount / fps };
    });
    chapters.push({ start: slideStart, end: clock, title: s.title ?? s.kicker ?? `Slide ${s.n}` });
    return planned;
  });
  return { steps, cues, chapters, total: clock };
}

/** Slide numbers as a short, stable label: [4, 2, 3, 3, 7] → "2-4_7". */
export const rangeLabel = (numbers) => {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const runs = [];
  for (const n of sorted) {
    const run = runs.at(-1);
    if (run && n === run[1] + 1) run[1] = n;
    else runs.push([n, n]);
  }
  return runs.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join('_');
};
