// Test fixture: the smallest decor that uses every part of the hook.
export const frame = ({ slide, total, brand, esc }) =>
  `<div class="brand">${esc(brand.name ?? '')} ${slide.n}/${total}</div><div class="tracker" data-tracker-offset="2"><em data-tracker-y data-tracker-pad="4"></em></div>`;

export const heroArt = ({ slide }) =>
  `<svg viewBox="0 0 100 100"><line data-draw x1="0" y1="${slide.n}" x2="100" y2="50" pathLength="1" stroke-dasharray="1" stroke="currentColor"/><circle data-pop cx="50" cy="50" r="4"/></svg>`;
