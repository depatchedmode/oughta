// Themes: folders with a theme.json (and optionally theme.css, decor.mjs, fonts, a logo), found in
//   <repo>/.walkthrough/themes/<name>/  →  <home>/themes/<name>/  →  <skill>/themes/<name>/
// A theme can extend another; its CSS loads after its parent's, and its tokens, options and decor
// override the parent's. A theme's name is its folder's name. Which theme a walkthrough gets is
// decided in context.mjs.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ConfigError, NAME, SKILL, THEMES_DIR, readJson } from './paths.mjs';

export const FALLBACK_THEME = 'endless';
const BUILT_IN = path.join(SKILL, 'themes');

function themeDirs(root) {
  return [root && path.join(root, '.walkthrough/themes'), THEMES_DIR, BUILT_IN].filter(Boolean);
}

/**
 * A font entry goes into CSS and a script, and may come from a repo, so each field must look like
 * what it is: a family name, a weight or weight range, a style, a file path.
 */
function checkFont(f, theme) {
  const bad = (what) => {
    throw new ConfigError(`theme "${theme}": font ${what} isn't allowed: ${JSON.stringify(f)}`);
  };
  if (typeof f.family !== 'string' || !/^[\w .-]+$/.test(f.family)) bad('family (letters, digits, spaces, . - _)');
  if (f.weight !== undefined && !/^(?:\d{1,4}(?: \d{1,4})?|normal|bold)$/.test(String(f.weight))) bad('weight (like 400 or "400 700")');
  if (f.style !== undefined && !/^(?:normal|italic|oblique)$/.test(f.style)) bad('style (normal, italic or oblique)');
  if (typeof f.src !== 'string' || /["'()\s\\]/.test(f.src)) bad('src (a path with no quotes, brackets or spaces)');
  return f;
}

/**
 * Tokens become CSS custom properties, and may come from a repo, so a token can only set its own
 * value: a name like accent or size-code, and a value that can't end the declaration or rule.
 */
function checkTokens(tokens, theme) {
  if (tokens === undefined) return {};
  if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) throw new ConfigError(`theme "${theme}": tokens is an object like { "accent": "#e0561b" }`);
  for (const [k, v] of Object.entries(tokens)) {
    if (!/^(--)?[\w-]+$/.test(k)) throw new ConfigError(`theme "${theme}": token name ${JSON.stringify(k)} isn't allowed (letters, digits, - and _)`);
    if ((typeof v !== 'string' && typeof v !== 'number') || /[{};]|<\//.test(String(v))) throw new ConfigError(`theme "${theme}": token ${k} can't contain { } ; or </ (got ${JSON.stringify(v)})`);
  }
  return tokens;
}

/** Where a theme folder lives: 'built-in' (this skill), 'machine' (<home>/themes) or 'repo'. */
const originOf = (dir) => (dir.startsWith(BUILT_IN + path.sep) ? 'built-in' : dir.startsWith(THEMES_DIR + path.sep) ? 'machine' : 'repo');

export function listThemes(root) {
  const seen = new Map();
  for (const dir of themeDirs(root)) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      const file = path.join(dir, name, 'theme.json');
      if (NAME.test(name) && !seen.has(name) && existsSync(file)) seen.set(name, { name, dir: path.join(dir, name), description: readJson(file).description ?? '' });
    }
  }
  return [...seen.values()];
}

// Make url(...) in a theme's CSS absolute, relative to that theme's folder.
const absolutizeUrls = (css, dir) =>
  css.replace(/url\((['"]?)(?![a-z]+:|\/|#)([^)'"]+)\1\)/gi, (_, q, rel) => `url(${q}${pathToFileURL(path.join(dir, rel)).href}${q})`);

/** brand with its logo as a URL: a path resolves against dir to a file: URL. Decor still escapes it. */
export function withLogo(brand, dir) {
  if (!brand?.logo) return brand;
  const logo = /^[a-z][a-z0-9+.-]*:/i.test(brand.logo) ? new URL(brand.logo).href : pathToFileURL(path.resolve(dir ?? process.cwd(), brand.logo)).href;
  return { ...brand, logo };
}

const NO_THEME = { names: [], css: '', fonts: [], tokens: {}, brand: {}, options: {}, decor: [], sources: [], notes: [] };

/**
 * Load a theme by name, or an inline theme object ({ extends, tokens, options, brand, fonts }),
 * following its chain. An inline theme's font and logo paths resolve against base (the folder of
 * the file that set it); it has no CSS or decor of its own. Returns { names, origin, css, fonts,
 * tokens, brand, options, decor, sources, notes }: origin is where the named theme lives
 * ('built-in', 'machine', 'repo', or 'inline'); decor lists its chain's decor.mjs files as
 * { file, origin }, parent first; notes are things worth printing (a theme that replaces another
 * of the same name).
 */
export function loadTheme(ref, root, { base, seen = [] } = {}) {
  let def;
  let dir;
  let name;
  const notes = [];
  if (typeof ref === 'string') {
    if (!NAME.test(ref)) throw new ConfigError(`"${ref}" isn't a theme name (letters, digits, - and _)`);
    if (seen.includes(ref)) throw new ConfigError(`theme "${ref}" extends itself (${[...seen, ref].join(' → ')})`);
    const found = themeDirs(root).map((d) => path.join(d, ref)).filter((d) => existsSync(path.join(d, 'theme.json')));
    if (!found.length) throw new ConfigError(`theme "${ref}" not found (looked in ${themeDirs(root).join(', ')})`);
    [dir] = found;
    name = ref;
    def = readJson(path.join(dir, 'theme.json'));
    if (found.length > 1) notes.push(`theme "${ref}" from ${dir} replaces the ${originOf(found[1])} theme of the same name in ${found[1]}`);
    if (def.name !== undefined && def.name !== ref) notes.push(`${path.join(dir, 'theme.json')} sets "name" to ${JSON.stringify(def.name)}, which is ignored: a theme's name is its folder's, "${ref}"`);
  } else if (ref && typeof ref === 'object' && !Array.isArray(ref)) {
    def = ref;
    name = 'inline';
    dir = base ?? process.cwd();
  } else {
    throw new ConfigError(`a theme is a name or an object like { "extends": "paper", "tokens": {...} } (got ${JSON.stringify(ref)})`);
  }
  if (def.extends != null && typeof def.extends !== 'string') throw new ConfigError(`theme "${name}": extends is a theme name (got ${JSON.stringify(def.extends)})`);
  const tokens = checkTokens(def.tokens, name);
  const parent = def.extends == null ? NO_THEME : loadTheme(def.extends, root, { seen: typeof ref === 'string' ? [...seen, name] : seen });
  const named = typeof ref === 'string';
  const cssFile = path.join(dir, 'theme.css');
  const css = named && existsSync(cssFile) ? absolutizeUrls(readFileSync(cssFile, 'utf8'), dir) : '';
  const fonts = (def.fonts ?? []).map((f) => checkFont(f, name)).map((f) => ({ ...f, url: /^[a-z]+:/.test(f.src) ? f.src : pathToFileURL(path.join(dir, f.src)).href }));
  const decor = path.join(dir, 'decor.mjs');
  return {
    names: [name, ...parent.names],
    origin: named ? originOf(dir) : 'inline',
    css: `${parent.css}\n${css}`,
    fonts: [...parent.fonts, ...fonts],
    tokens: { ...parent.tokens, ...tokens },
    brand: { ...parent.brand, ...withLogo(def.brand, dir) },
    options: { ...parent.options, ...def.options },
    decor: [...parent.decor, ...(named && existsSync(decor) ? [{ file: decor, origin: originOf(dir) }] : [])],
    sources: [named ? `${name} (${dir})` : `inline theme (paths from ${dir})`, ...parent.sources],
    notes: [...notes, ...parent.notes],
  };
}

/**
 * A theme's decor: optional functions from each decor.mjs in its chain, a child's overriding its
 * parent's.
 *   frame({ slide, total, brand, esc })  → HTML drawn on every slide, behind the content (rulers, a logo strip)
 *   heroArt({ slide, esc })              → HTML behind title and section slides. Elements with
 *                                          data-draw (SVG lines or paths with pathLength="1"
 *                                          stroke-dasharray="1") draw themselves in; data-pop ones fade in.
 * decor.mjs is code. Built-in and machine themes are yours, so theirs runs; a repo's runs only when
 * trustRepo is set (machine config "trustRepoThemes": true, or --trust-repo-theme), because the repo
 * being narrated may be someone else's branch. Returns { decor, loaded, skipped } (file lists).
 */
export async function loadDecor(theme, { trustRepo = false } = {}) {
  const decor = {};
  const loaded = [];
  const skipped = [];
  for (const { file, origin } of theme.decor) {
    if (origin === 'repo' && !trustRepo) {
      skipped.push(file);
      continue;
    }
    Object.assign(decor, await import(pathToFileURL(file).href));
    loaded.push(file);
  }
  return { decor, loaded, skipped };
}

/** Slide CSS goes inside a <style> element; CSS that closes it early could add markup or scripts. */
export function assertSafeCss(css, from) {
  if (/<\/style/i.test(css)) throw new ConfigError(`${from} contains "</style", which slide CSS can't`);
  return css;
}

/** The CSS for a loaded theme: base layer, theme chain, @font-face, then token overrides. */
export function themeCss(theme) {
  const base = readFileSync(path.join(BUILT_IN, 'base.css'), 'utf8');
  const faces = theme.fonts
    .map((f) => `@font-face { font-family: '${f.family}'; ${f.weight ? `font-weight: ${f.weight}; ` : ''}${f.style ? `font-style: ${f.style}; ` : ''}src: url(${f.url}); }`)
    .join('\n');
  const tokens = Object.entries(theme.tokens)
    .map(([k, v]) => `--${k.replace(/^--/, '')}: ${v};`)
    .join(' ');
  return assertSafeCss(`${faces}\n${base}\n${theme.css}\n${tokens ? `html[data-theme] { ${tokens} }` : ''}`, `theme "${theme.names[0]}" (its CSS, tokens or font names)`);
}
