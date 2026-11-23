// Page-side motion for slides. Loaded into every slide page; build.mjs drives it frame by frame:
//   __motion.plan(step, { entrance, prevY }) → { duration, trackerY, exitMs }   // ms
//   __motion.frame(t)                                         // pose everything at t ms
//   __motion.finish()                                         // the step's resting state
//   __motion.exit(p)                                          // 0..1, content leaving the slide
// Everything is a pure function of t, so frames are exact and repeatable (no recording jitter).
(() => {
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3)); // easeOutCubic
  // cubic-bezier(0.2, 0, 0, 1): the stand-in for a bounce-free spring, for things that travel
  const glide = (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bx = (u) => 3 * 0.2 * u * (1 - u) ** 2 + u ** 3; // x(u) with x1 = 0.2, x2 = 0
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (bx(mid) < x) lo = mid; else hi = mid; }
    const u = (lo + hi) / 2;
    return 3 * u * u * (1 - u) + u ** 3; // y(u) with y1 = 0, y2 = 1
  };
  const prog = (t, start, dur) => (dur <= 0 ? (t >= start ? 1 : 0) : (t - start) / dur);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let tracks = [];
  // A staggered container that paints its own frame (a border or fill) fades in first, so its
  // children never arrive into an empty box that was already sitting there.
  const paints = (el) => {
    const cs = getComputedStyle(el);
    return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || ['Top', 'Right', 'Bottom', 'Left'].some((k) => parseFloat(cs[`border${k}Width`]) > 0 && cs[`border${k}Style`] !== 'none');
  };
  const frames = new Set();
  let total = 0;

  // Containers whose children should arrive one after another rather than as one block.
  const STAGGER = 'ul.bullets, .flow, .cards, .stats';
  // Entrance: each chunk fades up 12px out of a 4px blur, 100ms after the one before.
  const STAGGER_MS = 100, RISE_MS = 300, TITLE_MS = 400, RISE_PX = 12, BLUR_PX = 4;
  // Exit: shorter and smaller than the entrance; build.mjs renders it over EXIT_MS.
  const EXIT_MS = 150;

  function setStep(n) {
    for (const el of document.querySelectorAll('[data-step]')) {
      const s = Number(el.dataset.step);
      el.classList.toggle('is-hidden', s > n);
      el.classList.toggle('is-past', s < n);
    }
  }

  function entering(step, entrance) {
    const roots = [];
    let header = 0;
    if (entrance) {
      // A hero box that paints a panel arrives whole; one that only groups its lines
      // (endless, or display: contents) lets the title and marquee arrive one after the other.
      const hero = document.querySelector('.hero-box');
      const panel = hero && getComputedStyle(hero).display !== 'contents' && paints(hero);
      const head = panel ? [hero] : hero ? [...hero.children] : [...document.querySelectorAll('.slide > .kicker, .slide > h1.title')];
      roots.push(...head);
      header = head.length;
      for (const child of document.querySelector('.content')?.children ?? []) {
        if (!child.dataset.step || Number(child.dataset.step) <= step) roots.push(child);
      }
    }
    for (const el of document.querySelectorAll(`[data-step="${step}"]`)) roots.push(el);
    // Drop anything inside another entering element, then expand staggered containers.
    const unique = roots.filter((el, i) => !roots.some((o, j) => j !== i && o !== el && o.contains(el)));
    // Layout containers (split, stack) open up however deeply they nest, so bullets in a stack in
    // a split still arrive one by one.
    const shown = (k) => !k.dataset.step || Number(k.dataset.step) <= step;
    const items = [];
    const expand = (el) => {
      if (el.matches(STAGGER)) {
        if (paints(el)) { frames.add(el); items.push(el); }
        items.push(...[...el.children].filter(shown));
      } else if (el.matches('.split, .stack')) {
        [...el.children].filter(shown).forEach(expand);
      } else items.push(el);
    };
    unique.forEach(expand);
    const seen = new Set();
    const keep = (el) => !seen.has(el) && seen.add(el) && el.getBoundingClientRect().height > 0;
    const head = items.slice(0, header).filter(keep);
    return { head, body: items.slice(header).filter(keep) };
  }

  function typingTracks(pre, start) {
    const lines = [...pre.querySelectorAll('.line')];
    const plan = [];
    let t = start;
    for (const line of lines) {
      const text = line.textContent;
      if (text.startsWith('$ ')) {
        const dur = Math.min(900, 22 * text.length);
        plan.push({ line, kind: 'cmd', start: t, dur, html: line.innerHTML, text });
        t += dur + 160;
      } else {
        plan.push({ line, kind: 'out', start: t, dur: 0, html: line.innerHTML });
        t += 32;
      }
    }
    // Cap long transcripts at ~2.6 s by compressing the schedule.
    const span = t - start;
    const k = span > 2600 ? 2600 / span : 1;
    for (const p of plan) {
      p.start = start + (p.start - start) * k;
      p.dur *= k;
    }
    return { plan, end: start + span * k };
  }

  function plan(step, { entrance = false, prevY = null } = {}) {
    tracks = [];
    frames.clear();
    setStep(step);
    const { head, body } = entering(step, entrance);
    const items = [...head, ...body];
    items.forEach((el, i) => {
      // Stagger by position in reading order: kicker, title, marquee, then the content.
      const isKicker = el.matches('.kicker');
      const isTitle = el.matches('h1.title, .hero-box');
      const delay = STAGGER_MS * i;
      if (frames.has(el)) { tracks.push({ kind: 'fade', el, start: delay, dur: RISE_MS }); return; }
      tracks.push({ kind: 'rise', el, start: delay, dur: isTitle ? TITLE_MS : RISE_MS, dx: isKicker ? -RISE_PX : 0, dy: isKicker ? 0 : RISE_PX });
      // Terminal output types itself out once its panel is in.
      for (const pre of el.matches('pre[data-type]') ? [el] : el.querySelectorAll('pre[data-type]')) {
        const { plan: p, end } = typingTracks(pre, delay + 260);
        tracks.push({ kind: 'type', el: pre, plan: p, start: delay + 260, end });
      }
      // Highlighted lines sweep in after their panel (and its typing) settles.
      const hls = el.querySelectorAll('.line.hl');
      if (hls.length) {
        const typed = tracks.filter((tr) => tr.kind === 'type' && el.contains(tr.el)).map((tr) => tr.end);
        const at = Math.max(delay + 380, ...typed) + 120;
        hls.forEach((l, j) => tracks.push({ kind: 'sweep', el: l, start: at + 90 * j, dur: 380 }));
      }
      // Marks lock on: the ring tightens and the caption drops in.
      // The ring settles at the theme's own outline offset.
      for (const m of el.matches('.mark') ? [el] : el.querySelectorAll('.mark')) {
        tracks.push({ kind: 'mark', el: m, start: delay + 420, dur: 420, offset: parseFloat(getComputedStyle(m).outlineOffset) || 0 });
      }
    });
    // Earlier steps fade back on focus slides, to the opacity the theme gives past steps.
    if (document.querySelector('.slide.focus-past')) {
      for (const el of document.querySelectorAll(`[data-step="${step - 1}"]`)) {
        tracks.push({ kind: 'dim', el, start: 0, dur: 320, to: parseFloat(getComputedStyle(el).opacity) });
      }
    }
    // A theme's hero art draws itself in: [data-draw] strokes (pathLength="1" stroke-dasharray="1")
    // trace out and [data-pop] marks fade in, scattered over the first second.
    if (entrance) {
      document.querySelectorAll('.hero-art [data-draw]').forEach((ln, i) => tracks.push({ kind: 'draw', el: ln, start: (i * 37) % 700, dur: 700 }));
      document.querySelectorAll('.hero-art [data-pop]').forEach((n, i) => tracks.push({ kind: 'pop', el: n, start: 200 + ((i * 53) % 900), dur: 300 }));
    }
    // A .tracker in the theme's frame glides to the top of the first new thing on screen, shifted
    // by its data-tracker-offset (px); a [data-tracker-y] inside it shows that position, padded with
    // zeros to its data-tracker-pad digits.
    const tracker = document.querySelector('.frame .tracker');
    let trackerY = prevY;
    if (tracker && getComputedStyle(tracker.parentElement).display !== 'none' && items.length) {
      const target = items.find((el) => !el.matches('.kicker')) ?? items[0];
      trackerY = Math.round(target.getBoundingClientRect().top + (Number(tracker.dataset.trackerOffset) || 0));
      tracks.push({ kind: 'tracker', el: tracker, start: 0, dur: 400, from: prevY ?? trackerY, to: trackerY });
    }
    total = Math.max(0, ...tracks.map((tr) => (tr.kind === 'type' ? tr.end : tr.start + tr.dur)));
    return { duration: total, trackerY, exitMs: EXIT_MS };
  }

  function frame(t) {
    for (const tr of tracks) {
      const p = prog(t, tr.start, tr.dur);
      const e = ease(p);
      const s = tr.el.style;
      switch (tr.kind) {
        case 'rise':
          s.opacity = String(e);
          s.transform = e >= 1 ? '' : `translate(${(1 - e) * tr.dx}px, ${(1 - e) * tr.dy}px)`;
          s.filter = e >= 1 ? '' : `blur(${(1 - e) * BLUR_PX}px)`;
          break;
        case 'fade':
          s.opacity = String(e);
          break;
        case 'dim':
          s.opacity = String(1 - (1 - tr.to) * e);
          break;
        case 'type':
          for (const ln of tr.plan) {
            if (t < ln.start) ln.line.style.visibility = 'hidden';
            else if (ln.kind === 'cmd' && t < ln.start + ln.dur) {
              const n = Math.max(1, Math.round(ln.text.length * prog(t, ln.start, ln.dur)));
              ln.line.style.visibility = '';
              ln.line.innerHTML = `<span class="prompt">$</span>${esc(ln.text.slice(1, n))}<span class="caret">&#9612;</span>`;
            } else {
              ln.line.style.visibility = '';
              if (ln.line.innerHTML !== ln.html) ln.line.innerHTML = ln.html;
            }
          }
          break;
        case 'sweep':
          s.backgroundSize = `${e * 100}% 100%`;
          break;
        case 'mark': {
          s.outlineOffset = `${tr.offset + (1 - e) * 16}px`;
          s.outlineColor = e > 0 ? '' : 'transparent';
          if (e > 0 && e < 1) s.outlineColor = `color-mix(in srgb, var(--tone, var(--mark)) ${Math.round(e * 100)}%, transparent)`;
          const cap = tr.el.querySelector('.mark-caption');
          if (cap) {
            cap.style.opacity = String(e);
            cap.style.transform = `translateY(${(1 - e) * 8}px)`;
          }
          break;
        }
        case 'draw':
          s.strokeDashoffset = String(1 - e);
          break;
        case 'pop':
          s.opacity = String(e);
          break;
        case 'tracker': {
          const y = tr.from + (tr.to - tr.from) * glide(p);
          s.top = `${y}px`;
          s.opacity = '1';
          const label = tr.el.querySelector('[data-tracker-y]');
          if (label) label.textContent = String(Math.round(y)).padStart(Number(label.dataset.trackerPad) || 0, '0');
          break;
        }
      }
    }
  }

  function finish() {
    frame(1e9);
    for (const tr of tracks) {
      if (tr.kind === 'tracker') continue;
      for (const k of ['opacity', 'transform', 'filter', 'backgroundSize', 'outlineOffset', 'outlineColor', 'strokeDashoffset']) tr.el.style[k] = '';
      tr.el.querySelector?.('.mark-caption')?.removeAttribute('style');
    }
  }

  function exit(p) {
    const e = ease(p);
    for (const el of document.querySelectorAll('.slide > .kicker, .slide > h1.title, .slide > .content, .slide > .hero-box, .slide > .hero-art')) {
      el.style.opacity = String(1 - e);
      el.style.transform = `translateY(${-RISE_PX * e}px)`;
      el.style.filter = `blur(${BLUR_PX * e}px)`;
    }
    const tracker = document.querySelector('.frame .tracker');
    if (tracker) tracker.style.opacity = String(1 - e);
  }

  window.__motion = { plan, frame, finish, exit, setStep };
})();
