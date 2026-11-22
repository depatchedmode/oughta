# Spec reference

A spec is an ES module whose default export is the presentation, or a function that returns it
(sync or async). The function receives `ctx` with the components, capture helpers and arguments,
so specs need no imports.

```js
export default ({ capture, arg, specDir, term, code, bullets, split, c }) => {
  const cap = capture({ cwd: arg('--repo', '.') });   // node build.mjs spec.mjs -- --repo ~/code/app
  const log = cap.run('git', ['log', '--oneline', '-3']);
  return {
    name: 'pr-123-walkthrough',          // output file name: letters, digits, - and _ (default: spec file name)
    title: 'PR #123 · Faster sync',      // video title metadata, footer fallback
    footer: 'app · PR #123',             // left footer text; false hides the footer
    theme: 'paper',                      // usually omit: the repo's theme applies (references/themes.md)
    repo: arg('--repo'),                 // which repo this is about (for its theme and config); optional
    brand: { name: 'Acme', meta: [['PR', '#123'], ['TICKET', 'APP-42']] },  // for themes whose decor draws a brand strip
    motion: true,                        // build-ins, step reveals, typed terminals, exits
    voice: { voice: 'en_male_narrator_1' },  // usually omit: the machine or repo default applies
    lexicon: { 'PR-123': 'P R one twenty-three' },   // display text → spoken text, whole tokens
    timing: { lead: 0.35, gap: 0.45, hold: 0.9 },    // seconds (up to 30): before a slide, between steps, after
    lang: 'en',                          // the slides' language (quotes, hyphenation, caption sentences); default: the voice's
    css: '',                             // extra CSS, last resort
    slides: [ /* ... */ ],
  };
};
```

## Slide

| field | meaning |
| --- | --- |
| `kicker` | e.g. `'PR #92'`: the line under the title on title and section slides (any theme); not shown elsewhere unless the theme sets `kickerStyle: "plain"` |
| `title` | the claim, ≤ 2 lines at 58 px (about 110 characters) |
| `body` | HTML, normally built from components |
| `say` | narration: a string, or an array with one entry per step; may contain cues `[beat]`, `[pause n]`, `[dry]`, `[up]`, `[voice NAME]`, `[plain]` |
| `layout` | `'default'`, `'title'` (opening slide: large title, the theme's title art if it has any), `'section'` (divider, same idea) |
| `marquee` | title/section slides: the line under the title (default: the slide's kicker; on themes with `options.marquee`, else the spec title) |
| `focus` | `true` fades parts from earlier steps |
| `media` | path to `.mp4`/`.webm`/`.png` shown full frame instead of a slide (one `say` string), relative to the spec; a `screenshot()` from this run, or a file outside the output folder (which every build replaces) |
| `speed`, `seed` | `speed` (0.25 to 4) multiplies the voice's speed for this slide; `seed` picks a different take |
| `lead`, `gap`, `hold` | timing overrides for this slide (seconds, up to 30) |
| `silent` | seconds to hold a slide with no narration (up to 600) |
| `footer` | `false` hides the footer on this slide |

**Steps.** With `say: ['a', 'b', 'c']` the slide is shown three times, once per entry. A part with
`step: 2` is hidden (its space kept) until step 2. `bullets(items, { reveal: 1 })` gives item *i*
step 1 + *i*. Parts without a step are always visible. The check fails if a part's step is higher
than the number of narration entries.

## Components

All take an optional `step`. Text arguments are escaped; arguments described as HTML are not.

| component | use |
| --- | --- |
| `term(text, { title, size='auto', max, min, highlight, dim, wrap, type='auto' })` (max, min default to the theme's `--size-code` 24 and `--size-code-min` 15) | terminal window for captured output; `$ ` lines get an accent prompt and, with motion, type out |
| `code(text, { title, ...same })` | file or snippet panel; `title` is the path |
| `bullets(items, { reveal })` | items are HTML strings or `{ html, step }` |
| `split(left, right, { ratio='1fr 1fr', align, gap })` | two columns |
| `stack(...parts)` | vertical group |
| `flow([{ title, note, accent, step }])` | steps joined by arrows, ≤ 6 |
| `cards([{ title, body(HTML), tone, mono, step }], { cols })` | colour-coded outcomes or options |
| `callout(title, paragraphs(HTML), { tone })` | "Next", "Why", "Risk" boxes |
| `stats([{ value, label(HTML), tone }], { boxed })` | big numbers; `boxed: true` puts each in its own box, for when the stats are the slide's main content (leave it off under cards or a panel) |
| `image(path, { title, caption, height })` | screenshot in a window frame; a path is relative to the spec, or a `data:` URL (slides render offline: download a web image first, or use `screenshot`) |
| `mark(html, caption, { tone, block, below })` | ring + caption on what the narration points at |
| `lede(html)`, `note(html)` | large intro paragraph, smaller supporting paragraph |
| `c(text)`, `kbd(text)` | inline code, key cap |
| `step(n, html)` | wrap anything so it appears at step n |

Tones: `accent`, `ok`, `warn`, `bad`, `neutral`.

`size: 'auto'` panels start at `max` and shrink 1 px at a time until every line fits and the slide
doesn't overflow, stopping at `min`. A number fixes the size (the check then fails on overflow).

## Capture helpers

`capture({ cwd, env })` returns:

- `run(cmd, args, { cwd, env, input, expectStatus })`: stdout+stderr, ANSI stripped. Non-zero exits are
  allowed (demos of refusals) unless `expectStatus` is set.
- `sh(line)`: run a shell line.
- `shell(shown, [cmd, ...args]?, opts)`: `"$ shown\n<output>"`; runs `actual` if given, else `shown`.
- `read(file)`: file contents.

`pick(text, regexOrFn, { max })` keeps matching lines; `head(text, n)` keeps the first n and adds `…`.

## Screenshots of live pages

`await screenshot(url, { name, viewport, waitFor, marks, fullPage })` loads a page (a local dev
server, a deployed preview) in its own online browser and returns the path of a PNG in
`out/shots/`, for `image()` or a `media` slide. Make the spec function `async` to use it.

- `viewport`: default `{ width: 1600, height: 900 }`; keep it near 16:9.
- `waitFor`: a selector to wait for before the shot.
- `marks`: `[{ target, caption, position, color }]`. `target` is a Playwright selector
  (`'#total'`, `'text=Payroll (paused)'`); each gets a ring and a 2–5 word caption, drawn in the
  page by `scripts/annotate.mjs`. A target that matches nothing stops the build.

```js
export default async ({ screenshot, image }) => {
  const shot = await screenshot('http://localhost:3000/payroll', {
    waitFor: '.summary', marks: [{ target: 'text=Payroll (paused)', caption: 'No warning' }],
  });
  return { title: 'Payroll', slides: [{ title: 'The pause has no warning', body: image(shot, { title: 'payroll' }), say: '…' }] };
};
```

## Voice config

| engine | fields |
| --- | --- |
| `reverb` (default) | `voice` (recorded voice name like `alex`, preset, `.npz` path, or `{ audio, text }` to clone), `language` (`en`, `de`, `fr`, `es`, `it`, `pl`, `pt`), `speed`, `seed`, `variant` (`int8` default; `fp16`, `fp32`, `int4`), `steps` (sampler steps, default 8) |
| `say` | `voice` (macOS voice name, like `Samantha`; `say -v '?'` lists them), `rate` (words/min, default 178), `speed` |

Voice files (`.npz`, a clone's `audio`) are relative to the spec. Settings are checked before
anything runs: an unknown engine, language or variant stops the build.

Environment: `NARRATED_WALKTHROUGH_HOME` (default `~/.local/share/narrated-walkthrough`) holds the
Python venv, Playwright, recorded voices, machine themes and `config.json`;
`NARRATED_WALKTHROUGH_VENV` moves just the venv. All of it is defined in `scripts/lib/paths.mjs`.
Downloads live in their tools' own caches: Reverb's model in `~/.cache/huggingface` (`HF_HOME`
moves it) and Chromium in Playwright's cache (`PLAYWRIGHT_BROWSERS_PATH` moves it).
