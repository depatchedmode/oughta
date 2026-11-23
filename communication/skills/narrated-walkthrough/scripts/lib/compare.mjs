// How regress.mjs compares two builds of a spec: slide images by pixel, slide HTML by part, and
// captured output by line, and what each kind of difference means.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Compare two PNGs pixel by pixel in the browser (no image library needed). Returns null when the
 * sizes differ, else { max, over, box }: the largest channel difference, how many pixels differ by
 * more than tolerance, and the box around them (or around every difference, when none is over).
 */
export async function comparePngs(page, a, b, tolerance) {
  const [ba, bb] = [readFileSync(a), readFileSync(b)];
  if (ba.equals(bb)) return { max: 0, over: 0, box: null };
  return page.evaluate(
    async ([a64, b64, tol]) => {
      const pixels = async (b64) => {
        const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
        const g = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d');
        g.drawImage(bmp, 0, 0);
        return g.getImageData(0, 0, bmp.width, bmp.height);
      };
      const [pa, pb] = await Promise.all([pixels(a64), pixels(b64)]);
      if (pa.width !== pb.width || pa.height !== pb.height) return null;
      let max = 0;
      let over = 0;
      const any = [Infinity, Infinity, -1, -1];
      const big = [Infinity, Infinity, -1, -1];
      const grow = (r, x, y) => {
        r[0] = Math.min(r[0], x);
        r[1] = Math.min(r[1], y);
        r[2] = Math.max(r[2], x);
        r[3] = Math.max(r[3], y);
      };
      for (let i = 0; i < pa.data.length; i += 4) {
        let d = 0;
        for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(pa.data[i + c] - pb.data[i + c]));
        if (!d) continue;
        const p = i / 4;
        const [x, y] = [p % pa.width, Math.floor(p / pa.width)];
        max = Math.max(max, d);
        grow(any, x, y);
        if (d > tol) {
          over++;
          grow(big, x, y);
        }
      }
      const r = over ? big : any;
      return { max, over, box: r[2] < 0 ? null : { x: r[0], y: r[1], w: r[2] - r[0] + 1, h: r[3] - r[1] + 1 } };
    },
    [ba.toString('base64'), bb.toString('base64'), tolerance],
  );
}

/**
 * Replace a build's own folders (its output, the skill, the spec's folder, the repo: build.mjs
 * lists them in check.json) with their names, as paths and as file: URLs, so builds in two folders,
 * or by two copies of the skill, compare. The longest goes first, since one may hold another.
 */
export function stripPaths(text, paths) {
  const dirs = Object.entries(paths).filter(([, dir]) => dir).sort(([, a], [, b]) => b.length - a.length);
  let plain = text;
  for (const [name, dir] of dirs) plain = plain.replaceAll(pathToFileURL(dir).href, name.toUpperCase()).replaceAll(dir, name.toUpperCase());
  return plain;
}

const STYLES = /<style>[\s\S]*?<\/style>/g;
const SCRIPT = /<script>[\s\S]*?<\/script>|<meta http-equiv="Content-Security-Policy"[^>]*>/g;

/** A slide's HTML in three parts: markup, styles, and script (the CSP holds the script's hash). */
export function slideParts(html) {
  const all = (re) => [...html.matchAll(re)].join('');
  return { markup: html.replace(STYLES, '').replace(SCRIPT, ''), styles: all(STYLES), script: all(SCRIPT) };
}

/**
 * The lines of captured output that differ between two builds, from check.json's captures
 * ({ cmd, status, out }, paths already stripped). Captures pair up in order; one with no partner
 * counts whole.
 */
export function changedCaptureLines(a, b) {
  const lines = (c) => (c ? [c.cmd, ...String(c.out).split('\n')] : []);
  const changed = new Set();
  for (let k = 0; k < Math.max(a.length, b.length); k++) {
    const [la, lb] = [lines(a[k]), lines(b[k])];
    for (const l of la) if (!lb.includes(l)) changed.add(l.trim());
    for (const l of lb) if (!la.includes(l)) changed.add(l.trim());
  }
  changed.delete('');
  return [...changed];
}

const textOf = (markup) =>
  markup
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

/** Does either version of a slide's markup show one of these changed lines of captured output? */
export const showsLines = (markups, lines) => lines.length > 0 && markups.map(textOf).some((t) => lines.some((l) => t.includes(l)));

/**
 * What a difference between two builds of one slide image means.
 *   parts: which parts of the slide's source HTML differ ([] when none)
 *   px:    comparePngs's result (null: the sizes differ)
 *   live:  the markup shows captured output that changed between the builds
 * Returns { kind, fails }:
 *   same        identical pixels and HTML
 *   smoothing   same HTML, pixels within the tolerance: text smoothing, ignored
 *   looks-same  the HTML changed, the pixels didn't beyond the tolerance: noted
 *   live        only the markup changed, and it shows captured output that changed: set aside
 *   drawn       same HTML, pixels beyond the tolerance: the browser, a font or a file it shows
 *   changed     the HTML changed and so did the pixels
 */
export function classify({ parts, px, live }) {
  const kind = !parts.length
    ? px === null || px.over
      ? 'drawn'
      : px.max
        ? 'smoothing'
        : 'same'
    : px !== null && !px.over
      ? 'looks-same'
      : live && parts.length === 1 && parts[0] === 'markup'
        ? 'live'
        : 'changed';
  return { kind, fails: kind === 'drawn' || kind === 'changed' };
}

/** Where two strings first differ, as a short excerpt of each. */
export function excerpt(a, b) {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  const cut = (s) => `${i > 40 ? '…' : ''}${s.slice(Math.max(0, i - 40), i + 80).replace(/\s+/g, ' ')}${s.length > i + 80 ? '…' : ''}`;
  return [cut(a), cut(b)];
}
