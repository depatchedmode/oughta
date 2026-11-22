// The layout check: what the build measures on each rendered slide.

/**
 * Footer text sits straight on the slide background, which on image backgrounds can be dark in one
 * corner and light in the other. Measure the background behind each footer item (footer hidden) and
 * mark it .on-dark or .on-light, at the luminance where black and white text have equal contrast
 * (0.179). Themes colour those classes; themes that don't are unaffected.
 */
export async function markFootContrast(page) {
  const rects = await page.evaluate(() => {
    const foot = document.querySelector('.foot');
    if (!foot) return [];
    foot.style.visibility = 'hidden';
    return [...foot.querySelectorAll('span')].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: r.width + 8, height: r.height + 8 };
    });
  });
  if (!rects.length) return;
  const shots = [];
  for (const clip of rects) shots.push((await page.screenshot({ clip })).toString('base64'));
  await page.evaluate(async (shots) => {
    const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const spans = [...document.querySelectorAll('.foot span')];
    for (const [i, el] of spans.entries()) {
      const img = new Image();
      img.src = `data:image/png;base64,${shots[i]}`;
      await img.decode();
      const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d');
      c.drawImage(img, 0, 0);
      const d = c.getImageData(0, 0, img.width, img.height).data;
      let sum = 0;
      for (let j = 0; j < d.length; j += 4) sum += 0.2126 * lin(d[j]) + 0.7152 * lin(d[j + 1]) + 0.0722 * lin(d[j + 2]);
      const lum = sum / (d.length / 4);
      el.classList.add(lum < 0.179 ? 'on-dark' : 'on-light');
      el.dataset.bgLuminance = lum.toFixed(3);
    }
    document.querySelector('.foot').style.visibility = '';
  }, shots);
}

// Runs inside the page (page.evaluate serialises it, so it can't use anything outside itself):
// shrink [data-fit] panels until everything fits, then report layout problems.
export function fitAndCheck() {
  const errors = [];
  const warns = [];
  const content = document.querySelector('.content');
  const fits = [...document.querySelectorAll('[data-fit]')];
  const fs = (el) => parseFloat(getComputedStyle(el).fontSize);
  const wide = (el) => el.scrollWidth > el.clientWidth + 1;
  const deep = (el) => el.scrollHeight > el.clientHeight + 1;
  const over = (el) => wide(el) || deep(el);
  const tall = () => content && content.scrollHeight > content.clientHeight + 1;
  // A panel's smallest size: its own min, else the theme's --size-code-min, else 15 px.
  const minOf = (el) => Number(el.dataset.min || parseFloat(getComputedStyle(el).getPropertyValue('--size-code-min')) || 15);
  for (let guard = 0; guard < 400; guard++) {
    let targets = fits.filter(over);
    if (!targets.length && tall()) {
      const max = Math.max(...fits.map(fs));
      targets = fits.filter((el) => fs(el) === max);
    }
    targets = targets.filter((el) => fs(el) - 1 >= minOf(el));
    if (!targets.length) break;
    for (const el of targets) el.style.fontSize = `${fs(el) - 1}px`;
  }
  for (const img of document.images) if (!img.complete || !img.naturalWidth) errors.push(`image failed to load: ${img.src}; check the path and that the file is an image`);
  if (tall()) errors.push(`content is ${content.scrollHeight - content.clientHeight}px too tall for the slide; cut content or split the slide`);
  if (content && content.scrollWidth > content.clientWidth + 1) errors.push(`content is ${content.scrollWidth - content.clientWidth}px too wide for the slide; shorten the widest line or split the slide`);
  // Everything stays on the slide and above the footer. On title and section slides the content
  // box grows to fit, so it can't overflow itself: the slide overflows instead, off both edges.
  const foot = document.querySelector('.slide > .foot');
  const floor = foot && foot.getBoundingClientRect().height ? foot.getBoundingClientRect().top : innerHeight;
  for (const el of document.querySelectorAll('.slide > :not(.frame, .hero-art, .foot, .hero-box), .slide > .hero-box > *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const what = el.matches('h1.title') ? 'the title' : el.matches('.content') ? 'the content' : `<${el.tagName.toLowerCase()} class="${el.className}">`;
    if (r.top < -1) errors.push(`${what} runs ${Math.round(-r.top)}px off the top of the slide; cut content or split the slide`);
    if (r.bottom > floor + 1) errors.push(`${what} runs ${Math.round(r.bottom - floor)}px ${foot ? 'into the footer' : 'off the bottom of the slide'}; cut content or split the slide`);
    if (r.left < -1 || r.right > innerWidth + 1) errors.push(`${what} runs off the side of the slide; shorten it`);
  }
  for (const pre of document.querySelectorAll('.panel pre')) {
    const atMin = pre.dataset.fit !== undefined ? ' even at the minimum size' : '';
    if (wide(pre)) {
      const longest = pre.innerText.split('\n').reduce((a, b) => (b.length > a.length ? b : a), '');
      errors.push(`panel line too long${atMin}: "${longest.slice(0, 90)}${longest.length > 90 ? '…' : ''}"; break or trim the line`);
    }
    if (deep(pre)) errors.push(`panel is cut off at the bottom${atMin} (${pre.scrollHeight - pre.clientHeight}px hidden): show fewer lines or give it more room`);
    if (pre.dataset.fit !== undefined && fs(pre) <= minOf(pre)) warns.push(`a panel shrank to its minimum size (${fs(pre)}px); consider fewer lines`);
  }
  // Anything else that clips its own content (overflow hidden) is hiding text from the viewer.
  for (const el of document.querySelectorAll('.slide *')) {
    if (el.closest('.frame, .hero-art') || el.matches('pre, img, .title, .kicker, .content, .marquee') || !el.textContent.trim()) continue;
    const st = getComputedStyle(el);
    if (!/hidden|clip/.test(st.overflowX + st.overflowY)) continue;
    if (over(el)) errors.push(`content is clipped inside <${el.tagName.toLowerCase()} class="${el.className}">: "${el.textContent.trim().slice(0, 50)}…"; shorten the text or give it more room`);
  }
  // Every declared face (build.mjs loads them all first), so a broken bold or italic file is caught.
  for (const f of document.fonts) {
    if (f.status === 'error') errors.push(`theme font "${f.family.replace(/^["']|["']$/g, '')}" (weight ${f.weight}, ${f.style}) didn't load; check its src in theme.json`);
  }
  const h1 = document.querySelector('h1.title');
  if (h1) {
    // Two lines unless the theme says otherwise (--title-max-lines, e.g. for stacked hero titles).
    const cs = getComputedStyle(h1);
    const max = parseInt(cs.getPropertyValue('--title-max-lines'), 10) || 2;
    const lines = Math.round(h1.getBoundingClientRect().height / parseFloat(cs.lineHeight));
    if (lines > max) errors.push(`title wraps to ${lines} lines; shorten it to ${max}`);
  }
  const kicker = document.querySelector('.kicker');
  if (kicker && wide(kicker)) errors.push('kicker is cut off; shorten it');
  for (const t of document.querySelectorAll('.panel .bar .title')) if (wide(t)) warns.push(`panel title is cut with an ellipsis: "${t.textContent}"`);
  for (const el of document.querySelectorAll('.content *')) {
    if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const size = fs(el);
    if (size < 15) warns.push(`text at ${size}px is too small to read on video: "${el.textContent.trim().slice(0, 40)}"`);
  }
  // Mark captions float over the slide; make sure they don't sit on top of other text.
  const textEls = [...document.querySelectorAll('.slide *')].filter(
    (el) => !el.closest('.mark-caption, .frame, .hero-art') && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()),
  );
  for (const cap of document.querySelectorAll('.mark-caption')) {
    const r = cap.getBoundingClientRect();
    const owner = cap.parentElement;
    const hit = textEls.find((el) => {
      if (owner.contains(el) || el.contains(owner)) return false;
      for (const b of el.getClientRects()) if (b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top) return true;
      return false;
    });
    if (hit) errors.push(`mark caption "${cap.textContent}" covers "${hit.textContent.trim().slice(0, 40)}"; try below: true, or mark a block`);
  }
  const maxStep = Math.max(0, ...[...document.querySelectorAll('[data-step]')].map((el) => Number(el.dataset.step)));
  return { errors, warns, maxStep };
}
