#!/usr/bin/env node
// Themes per repo.
//
//   node theme.mjs list   [--repo DIR]                  themes available here, and where they live
//   node theme.mjs show   [--repo DIR]                  what a walkthrough in this repo would use, and why
//   node theme.mjs init   [--repo DIR] [--theme NAME] [--brand NAME]
//                                                       add .walkthrough/config.json to a repo (theme, footer, lexicon)
//   node theme.mjs new    NAME [--repo DIR] [--extends midnight] [--global]
//                                                       scaffold a theme folder with every token listed, ready to edit
//   node theme.mjs preview [--repo DIR] [--theme NAME] [--out DIR] [--trust-repo-theme]
//                                                       render the sample deck in that theme → contact sheet
// --repo defaults to the current directory.
const USAGE = `usage: node theme.mjs list|show|init|new|preview [options]
  list    [--repo DIR]                                 themes available here, and where they live
  show    [--repo DIR]                                 what a walkthrough in this repo would use, and why
  init    [--repo DIR] [--theme NAME] [--brand NAME]   add .walkthrough/config.json to a repo
  new     NAME [--repo DIR] [--extends midnight] [--global]   scaffold a theme to edit
  preview [--repo DIR] [--theme NAME] [--out DIR] [--trust-repo-theme]
                                                       render the sample deck in that theme`;
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { launch } from './lib/browser.mjs';
import { repoRoot, resolveContext } from './lib/context.mjs';
import { HOME, MACHINE_CONFIG, NAME, SKILL, THEMES_DIR } from './lib/paths.mjs';
import { listThemes, loadTheme, themeCss } from './lib/theme.mjs';
import { resolveVoice } from './lib/tts.mjs';

const fail = (msg) => {
  console.error(msg);
  process.exit(2);
};
let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      repo: { type: 'string' }, theme: { type: 'string' }, brand: { type: 'string' }, extends: { type: 'string' },
      global: { type: 'boolean' }, out: { type: 'string' }, 'trust-repo-theme': { type: 'boolean' },
    },
  });
} catch (e) {
  fail(`${e.message}\n${USAGE}`);
}
const { values: opt, positionals } = parsed;
const [cmd, arg] = positionals;
const dir = path.resolve(opt.repo ?? process.cwd());
const root = repoRoot(dir);

// Tokens that aren't the look: the canvas is fixed at 1920×1080 by the build.
const FIXED = new Set(['canvas-w', 'canvas-h']);

/**
 * The tokens a theme exposes, as the parent theme writes them: every custom property set on the
 * root element (base.css's :root, the chain's CSS, its theme.json tokens), read from the page's own
 * stylesheets in cascade order. Values are the text as written, so a token defined as
 * var(--font-sans) stays a reference and follows font-sans when you change it. Values that point
 * at files are left out, since a copied path would only work on this machine.
 */
async function tokensOf(theme) {
  let session;
  try {
    session = await launch();
  } catch (e) {
    fail(e.message);
  }
  const page = await session.newPage();
  await page.setContent(`<html data-theme="${theme.names.join(' ')}"><head><style>${themeCss(theme)}</style></head><body></body></html>`);
  const tokens = await page.evaluate(() => {
    const root = document.documentElement;
    const out = {};
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        // Plain rules only (not @media and the like), and only those that apply to the root itself.
        if (!(rule instanceof CSSStyleRule) || !root.matches(rule.selectorText)) continue;
        for (const prop of rule.style) if (prop.startsWith('--')) out[prop.slice(2)] = rule.style.getPropertyValue(prop).trim();
      }
    }
    return out;
  });
  await session.browser.close();
  return Object.fromEntries(Object.entries(tokens).filter(([k, v]) => v && !FIXED.has(k) && !/url\(|file:/.test(v)).sort(([a], [b]) => a.localeCompare(b)));
}

switch (cmd) {
  case 'list': {
    for (const t of listThemes(root)) console.log(`${t.name.padEnd(14)} ${t.description}\n${''.padEnd(14)} ${t.dir}`);
    break;
  }
  case 'show': {
    let c;
    try {
      c = resolveContext({ repo: dir, repoExplicit: true });
    } catch (e) {
      fail(e.message);
    }
    const v = resolveVoice(c.voice);
    console.log(`repo     ${c.root ?? '(not a git repo)'}${c.remote ? `  (${c.remote})` : ''}`);
    console.log(`config   ${c.repoConfigFile ?? '(no .walkthrough/config.json)'}; machine ${MACHINE_CONFIG}`);
    console.log(`theme    ${c.theme.names.join(' → ')}   chosen by ${c.themeWhy}`);
    for (const src of c.theme.sources) console.log(`         ${src}`);
    for (const note of c.theme.notes) console.log(`note     ${note}`);
    console.log(`brand    ${JSON.stringify(c.brand)}`);
    console.log(`footer   ${c.footer ?? '(spec title)'}`);
    console.log(`voice    ${v.voiceName}, speed ${v.speed ?? 1}   chosen by ${c.voiceWhy}`);
    console.log(`lexicon  ${Object.keys(c.lexicon).length} repo-wide entr${Object.keys(c.lexicon).length === 1 ? 'y' : 'ies'}`);
    break;
  }
  case 'init': {
    if (!root) fail(`${dir} isn't inside a git repo`);
    const file = path.join(root, '.walkthrough/config.json');
    if (existsSync(file)) {
      console.log(`${file} already exists:\n${readFileSync(file, 'utf8')}`);
      break;
    }
    const repoName = path.basename(root);
    const config = {};
    const notes = [];
    if (opt.theme) {
      // Pin it only if it exists, and say so when other people won't have it.
      let t;
      try {
        t = loadTheme(opt.theme, root);
      } catch (e) {
        fail(e.message);
      }
      config.theme = opt.theme;
      if (t.origin === 'machine') notes.push(`"${opt.theme}" is a theme on this machine only; anyone else building walkthroughs of this repo needs it too, or copy it into .walkthrough/themes/`);
    } else {
      // Pin what this repo gets now, unless that comes from this machine alone (a machine rule or
      // theme): committing it would break the build for everyone else.
      let current;
      try {
        current = resolveContext({ repo: root, repoExplicit: true }).theme;
      } catch (e) {
        fail(e.message);
      }
      if (current.origin === 'built-in' || current.origin === 'repo') config.theme = current.names[0];
      else notes.push(`left "theme" out: this repo gets "${current.names[0]}" from this machine's config, which nobody else has. Pin one with --theme NAME`);
    }
    // A brand only if asked: a theme's decor may draw its own brand, and a repo name would replace it.
    if (opt.brand) config.brand = { name: opt.brand };
    config.footer = repoName;
    config.lexicon = {};
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
    console.log(`wrote ${file}\n${JSON.stringify(config, null, 2)}`);
    for (const n of notes) console.log(`note: ${n}`);
    console.log('Commit it so every walkthrough of this repo looks the same. "lexicon" is for repo-wide pronunciations.');
    break;
  }
  case 'new': {
    const name = arg;
    if (!name || !NAME.test(name)) fail('usage: node theme.mjs new NAME [--extends midnight] [--global] [--repo DIR]');
    const parent = opt.extends ?? 'midnight';
    const base = opt.global || !root ? THEMES_DIR : path.join(root, '.walkthrough/themes');
    const tdir = path.join(base, name);
    if (existsSync(path.join(tdir, 'theme.json'))) fail(`${tdir}/theme.json already exists`);
    let parentTheme;
    try {
      parentTheme = loadTheme(parent, root);
    } catch (e) {
      fail(e.message);
    }
    const def = {
      description: `Based on ${parent}. Describe the look here.`,
      extends: parent,
      tokens: await tokensOf(parentTheme),
      fonts: [],
      brand: {},
      options: {},
    };
    mkdirSync(path.join(tdir, 'fonts'), { recursive: true });
    writeFileSync(path.join(tdir, 'theme.json'), `${JSON.stringify(def, null, 2)}\n`);
    writeFileSync(
      path.join(tdir, 'theme.css'),
      `/* ${name}: optional CSS on top of "${parent}". Prefer tokens in theme.json; use this only for\n   things tokens can't express. Scope rules with [data-theme~="${name}"] so themes extending\n   this one inherit them. url(...) paths are relative to this folder. */\n`,
    );
    console.log(`wrote ${tdir}/theme.json (every token with ${parent}'s value; delete the ones you don't change)`);
    console.log(`options, brand and art are inherited from ${parent}; set only what should differ`);
    console.log(`fonts: put files in ${tdir}/fonts and list them: { "family": "X", "src": "fonts/x.woff2", "weight": "400 700" }`);
    console.log(`use it: "theme": "${name}" in .walkthrough/config.json, then: node theme.mjs preview`);
    break;
  }
  case 'preview': {
    // Replaced each run (the build only cleans folders it made); under the machine home, which is
    // this user's own, never a shared temp folder.
    const out = path.resolve(opt.out ?? path.join(HOME, 'theme-preview'));
    const r = spawnSync(
      process.execPath,
      [
        path.join(SKILL, 'scripts/build.mjs'), path.join(SKILL, 'examples/tour/spec.mjs'), '--check', '--out', out, '--repo', dir,
        ...(opt.theme ? ['--theme', opt.theme] : []), ...(opt['trust-repo-theme'] ? ['--trust-repo-theme'] : []),
      ],
      { encoding: 'utf8' },
    );
    process.stdout.write(r.stdout.split('\n').filter((l) => /^(theme:|decor:|note|ERROR|warn |layout:)/.test(l)).join('\n') + '\n');
    if (r.status) process.stderr.write(r.stderr);
    console.log(`slides: ${out}/slides`);
    process.exitCode = r.status ?? 1;
    break;
  }
  default:
    console.log(USAGE);
    if (cmd) process.exitCode = 2;
}
