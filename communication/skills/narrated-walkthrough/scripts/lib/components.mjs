// Slide components. Each returns an HTML string for a slide's `body`.
// Text arguments are escaped unless the parameter is documented as HTML.
// Every component takes an optional `step` (1-based): the part stays hidden until that step of the slide.

import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const stepAttr = (step) => (step ? ` data-step="${Number(step)}"` : '');
const cls = (...names) => names.filter(Boolean).join(' ');
const toneClass = (tone) => (tone ? `tone-${tone}` : '');

/** Wrap any HTML so it appears at a given step. */
export const step = (n, html) => `<div${stepAttr(n)}>${html}</div>`;

/** A large paragraph under the title. `html` may contain <b>, <code>. */
export const lede = (html, { step: s } = {}) => `<p class="lede"${stepAttr(s)}>${html}</p>`;

/** A smaller supporting paragraph. HTML. */
export const note = (html, { step: s } = {}) => `<p class="note"${stepAttr(s)}>${html}</p>`;

/** Inline code. Text. */
export const c = (text) => `<code>${esc(text)}</code>`;

/** A key cap. Text. */
export const kbd = (text) => `<kbd>${esc(text)}</kbd>`;

/**
 * Bullet list. Items are HTML strings, or { html, step }.
 * reveal: n → item i appears at step n + i (one bullet per narration step).
 */
export const bullets = (items, { reveal, step: s } = {}) =>
  `<ul class="bullets"${stepAttr(s)}>${items
    .map((item, i) => {
      const it = typeof item === 'string' ? { html: item } : item;
      const st = it.step ?? (reveal ? reveal + i : undefined);
      return `<li${stepAttr(st)}>${it.html}</li>`;
    })
    .join('')}</ul>`;

/** Two columns. ratio: CSS grid columns, e.g. '1.25fr 1fr'. */
export const split = (left, right, { ratio = '1fr 1fr', align = 'start', gap } = {}) =>
  `<div class="split" style="grid-template-columns:${ratio};align-items:${align}${gap ? `;gap:${gap}px` : ''}">${left}${right}</div>`;

/** Vertical stack of parts. */
export const stack = (...parts) => `<div class="stack">${parts.join('')}</div>`;

function panelLines(text, { highlight = [], dim = [], prompt = true } = {}) {
  const hl = new Set(highlight);
  const dm = new Set(dim);
  return String(text)
    .split('\n')
    .map((line, i) => {
      const n = i + 1;
      let body = esc(line);
      if (prompt && line.startsWith('$ ')) body = `<span class="prompt">$</span>${esc(line.slice(1))}`;
      return `<span class="${cls('line', hl.has(n) && 'hl', dm.has(n) && 'dim')}">${body || ' '}</span>`;
    })
    .join('');
}

function panel(kind, text, { title = '', size = 'auto', max, min, highlight, dim, step: s, grow = false, wrap = false, type = 'auto' } = {}) {
  const auto = size === 'auto';
  // Auto panels start at max, else the theme's --size-code, and shrink to min, else --size-code-min.
  const start = auto ? max : size;
  const fit = auto ? ` data-fit${min ? ` data-min="${min}"` : ''}` : '';
  // Typed playback: commands type out and output lines follow, when the panel appears (motion on).
  const typed = kind === 'term' && (type === true || (type === 'auto' && /^\$ /m.test(String(text))));
  const dots = kind === 'term' ? '<span class="dot"></span><span class="dot"></span><span class="dot"></span>' : '';
  const bar = kind === 'term' || title ? `<div class="bar">${dots}<span class="title">${esc(title || 'Terminal')}</span></div>` : '';
  return `<div class="${cls('panel', kind)}"${stepAttr(s)}${grow ? ' style="flex:1"' : ''}>${bar}<pre class="${wrap ? 'wrap' : ''}"${start ? ` style="font-size:${start}px"` : ''}${fit}${typed ? ' data-type' : ''}>${panelLines(text, { highlight, dim, prompt: kind === 'term' })}</pre></div>`;
}

/**
 * A terminal window holding real captured output.
 * size: 'auto' (default) shrinks from `max` (24) to `min` (15) px until every line fits on one line
 * and the slide doesn't overflow; a number fixes the size. highlight/dim: 1-based line numbers.
 * Lines starting with "$ " get an accent prompt.
 * type: 'auto' (default) types out "$ " commands and then shows their output line by line when the
 * panel appears; true forces it, false turns it off.
 * wrap: true lets long lines wrap at spaces with a hanging indent, for output whose lines can't fit
 * on one line even at the minimum size (long JSON, test names). Without it the check fails instead.
 */
export const term = (text, opts = {}) => panel('term', text, opts);

/** A file or snippet panel. Same options as term; the title is the file path. */
export const code = (text, opts = {}) => panel('code', text, opts);

/** A row of steps joined by arrows. nodes: [{ title, note?, accent?, step? }] */
export const flow = (nodes) =>
  `<div class="flow">${nodes
    .map((n, i) => {
      const arrow = i ? `<span class="arrow"${stepAttr(n.step)}>→</span>` : '';
      return `${arrow}<div class="${cls('node', n.accent && 'is-accent')}"${stepAttr(n.step)}>${esc(n.title)}${n.note ? `<small>${esc(n.note)}</small>` : ''}</div>`;
    })
    .join('')}</div>`;

/**
 * Cards in a grid. items: [{ title, body (HTML), tone: accent|ok|warn|bad|neutral, mono?, step? }]
 */
export const cards = (items, { cols = items.length } = {}) =>
  `<div class="cards" style="grid-template-columns:repeat(${cols},1fr)">${items
    .map(
      (it) =>
        `<div class="${cls('card', toneClass(it.tone))}"${stepAttr(it.step)}><h3${it.mono ? ' class="mono"' : ''}>${esc(it.title)}</h3><p>${it.body}</p></div>`,
    )
    .join('')}</div>`;

/** A labelled box. paragraphs: HTML strings. */
export const callout = (title, paragraphs, { tone, step: s } = {}) =>
  `<div class="${cls('callout', toneClass(tone))}"${stepAttr(s)}><h3>${esc(title)}</h3>${[]
    .concat(paragraphs)
    .map((p) => `<p>${p}</p>`)
    .join('')}</div>`;

/**
 * Big numbers. items: [{ value, label, tone?, step? }]
 * boxed: each figure sits in its own box (a tone tints the box). Use it when the stats are the
 * slide's main content; leave it off when they sit under cards or a panel.
 */
export const stats = (items, { cols = items.length, boxed = false } = {}) =>
  `<div class="${cls('stats', boxed && 'boxed')}" style="grid-template-columns:repeat(${cols},1fr)">${items
    .map(
      (it) =>
        `<div class="${cls('stat', toneClass(it.tone))}"${stepAttr(it.step)}><div class="value">${esc(it.value)}</div><div class="label">${it.label}</div></div>`,
    )
    .join('')}</div>`;

/**
 * A screenshot in a window frame. src: a PNG/JPG path, relative to base (in a spec, the spec's
 * folder), or a data: URL. Slides render offline, so a web image must be downloaded first (or
 * taken with ctx.screenshot). The image is scaled to fit; keep the captured viewport near 16:9.
 */
export const image = (src, { title = '', caption = '', step: s, height, base = process.cwd() } = {}) => {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) && !/^(data|file):/i.test(src)) throw new Error(`image ${src}: slides render offline, so images must be files; download it first, or use screenshot(url)`);
  const url = /^(data|file):/i.test(src) ? src : pathToFileURL(path.resolve(base, src)).href;
  return `<figure class="shot"${stepAttr(s)}${height ? ` style="height:${height}px"` : ' style="flex:1"'}><div class="panel"><div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="title">${esc(title)}</span></div><img src="${esc(url)}"></div>${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
};

/**
 * Ring + caption on the thing the narration is talking about (for live pages, screenshot's marks).
 * html: what to ring. caption: 2–5 words. below: put the caption under it instead of above.
 */
export const mark = (html, caption = '', { tone, block = false, below = false, step: s } = {}) => {
  const tag = block ? 'div' : 'span';
  return `<${tag} class="${cls('mark', block && 'block', below && 'caption-below', toneClass(tone))}"${stepAttr(s)}>${html}${caption ? `<span class="mark-caption">${esc(caption)}</span>` : ''}</${tag}>`;
};
