# Themes

## Which theme a repo gets

Lowest priority first:

1. **Machine rules** in `~/.local/share/narrated-walkthrough/config.json` match the repo's git
   remote (origin), first match wins, e.g. `{ "match": "github.com/acme/*", "theme": "acme" }`
   to give one organisation's repos their house style. With no matching rule, the theme is the
   config's `"theme"` if it has one, else `endless`.
2. **Repo config** `<repo>/.walkthrough/config.json` (commit it): `theme`, `brand`, `footer`,
   `voice`, `timing`, `motion`, and a repo-wide `lexicon` of pronunciations that every
   walkthrough of that repo shares. `theme` is a name or an inline theme
   (`{ "extends": "paper", "tokens": { "accent": "#e0561b" } }`).
3. **The spec** (`theme`, `brand`, `footer`, `lexicon`, ...), then `--theme NAME` on the command
   line.

The build prints which theme it used, why, and the folder it came from, and notes when a theme
replaces another of the same name further down the lookup. The repo is found from `--repo`,
`spec.repo`, the first capture's working directory, the spec's folder, or the current directory, in
that order; a `--repo` that isn't a git repo means no repo (no repo config, no remote). Config
values are checked as they're read (`timing` numbers, `motion` true or false, `lexicon` text to
text), and a wrong one stops the build naming its file.

```
node $SKILL/scripts/theme.mjs show    [--repo DIR]                 # what applies here, and why
node $SKILL/scripts/theme.mjs list    [--repo DIR]                 # themes available, and where
node $SKILL/scripts/theme.mjs init    [--repo DIR] [--theme NAME]  # add .walkthrough/config.json
node $SKILL/scripts/theme.mjs new NAME --extends paper [--global]  # scaffold a theme to edit
node $SKILL/scripts/theme.mjs preview [--repo DIR] [--theme NAME]  # sample deck → contact sheet
```

To customise a repo, run `theme.mjs show` there first, then either `init` (pin a built-in theme
and set the brand or footer), or `new` + `init --theme NAME` for a look of its own, and check it
with `preview` before building a video. Never edit the built-in themes for one repo's sake.

## Writing a theme

**A theme is a folder** with `theme.json` and optionally `theme.css`, `decor.mjs`, fonts and a logo.
Its name is the folder's name (letters, digits, `-` and `_`). Themes are looked up in
`<repo>/.walkthrough/themes/`, then `~/.local/share/narrated-walkthrough/themes/` (`--global`, for
themes shared across repos), then the skill's own `themes/`.

```json
{
  "extends": "paper", "description": "…",
  "tokens":  { "accent": "#e0561b", "font-sans": "\"Avenir Next\", sans-serif" },
  "fonts":   [{ "family": "X", "src": "fonts/x.woff2", "weight": "400 700" }],
  "brand":   { "name": "Ledger", "logo": "logo.svg" },
  "options": { "kickerStyle": "none" | "plain", "marquee": false, "middleDot": " / " }
}
```

An inline theme (in a repo config or a spec) takes the same `extends`, `tokens`, `fonts`, `brand`
and `options`, with paths relative to the file that set it; it has no CSS or decor of its own
(a spec has `css` for that).

Token names are letters, digits, `-` and `_`, and a value can't contain `{`, `}`, `;` or `</`: a
token sets its own value and nothing else. A theme's `extends` is a theme name.

- `theme.mjs new` writes every token the parent exposes (base tokens and the parent's own) with
  the value it has there, so changing a theme means editing values; delete the tokens you don't
  change. `theme.mjs init` writes the repo's config: the theme it gets now (unless that comes from
  this machine alone), the footer, and a brand only with `--brand NAME`.
- Reach for `theme.css` only for what tokens can't express, scoped `[data-theme~="name"]` so
  themes that extend it inherit it. Theme CSS can't contain `</style`.
- Every font face listed is loaded and checked, so a missing bold or italic file is an error.
- `middleDot` swaps the ` · ` in footers and marquees, for fonts without that glyph.
- No theme puts a label above its titles: a slide's `kicker` becomes the marquee line on title and
  section slides. `"kickerStyle": "plain"` puts kickers back above titles; `"marquee": true` shows
  the spec's title in the marquee when a slide has neither.
- A theme can let titles run longer than the 2-line check allows with `--title-max-lines` on
  `h1.title` in its CSS (as `endless` does for its stacked title slide).
- The build measures the background behind each footer item and marks it `.on-dark` or
  `.on-light`, so a theme on image backgrounds can flip the footer colour per corner (`endless`
  does) instead of boxing it.

A house style that isn't yours to publish (a client's brand, licensed fonts) belongs in
`~/.local/share/narrated-walkthrough/themes/` or the repo's `.walkthrough/themes/`, never in the
skill.

## Decor

Decor is for a house style that draws more than CSS can. A theme's `decor.mjs` may export:

- `frame({ slide, total, brand, esc })`: HTML drawn on every slide behind the content (rulers, a
  logo strip). `brand` is the merged brand, including `meta: [['PR', '#92']]` pairs.
- `heroArt({ slide, esc })`: HTML behind title and section slides. Elements with `data-draw` (SVG
  lines or paths with `pathLength="1" stroke-dasharray="1"`) draw themselves in, and `data-pop`
  ones fade in.

A `.tracker` in the frame glides to the top of whatever just appeared (shifted by its
`data-tracker-offset` px), showing that position in a `[data-tracker-y]` child (zero-padded to its
`data-tracker-pad` digits). The theme's CSS styles all of it. No built-in theme has decor.

`brand` fields come from repo config and specs too, so treat them as untrusted text: pass every one
through `esc` (a `brand.logo` arrives as a URL, resolved from where it was set).

`decor.mjs` is code: the build runs it from built-in and machine themes, but from a repo's
`.walkthrough/themes/` only with `--trust-repo-theme` (or `"trustRepoThemes": true` in the machine
config), since the repo being narrated may be someone else's branch. It prints each decor it loads
or skips. Slides render offline: a page may load only `file:` and `data:` URLs, so no theme or spec
can send what's on a slide anywhere, and fonts, images and screenshots must be on disk. The only
script a slide runs is the build's own animation code (allowed by its hash), so a `<script>` or
`onerror=` that reaches a slide through HTML, from captured output or a decor that forgot `esc`,
doesn't run. Each slide carries these rules in its own Content-Security-Policy, so they hold when
you open `html/*.html` in an ordinary browser too.

## The built-in themes

- **`endless`** (the default), the Endless Limited house style, taken from endless.limited:
  greyscale only, static film grain over a light grey field. One typeface for all text, DM Sans,
  with hierarchy carried by size and weight; DM Mono (weights 400 and 500, ligatures off) for code,
  terminals and file paths. The footer is plain text that flips light or dark with the background.
  Cards, callouts and pipeline boxes are borderless white; a tone tints the whole box. Stats are
  plain Black 72px figures with a small coloured square for a tone; `stats(..., { boxed: true })`
  boxes them. Title and section slides use stills exported from the site's shader
  (`themes/endless/art/`): the title slide stacks its title (up to 3 lines), marquee and lede on the
  still's dark half, and section dividers centre the title under a bright arc. Terminals are black.
  The only colour is in the ok, warn and bad tones.
- **`midnight`** (dark navy, blue accent, SF type) and **`paper`** (light) are neutral themes for a
  repo to pin or extend.
