---
name: narrated-walkthrough
description: "Make a narrated video walkthrough (MP4) of a pull request, feature, design or system: slides themed per repo (built-in or your own themes) built from real command output, code and screenshots, with motion (step reveals, typed terminal playback), narrated locally by Reverb-TTS in a preset or your own cloned voice, with chapters and captions. Use when asked to 'make a walkthrough video', 'narrate this PR', 'record a demo of what changed', 'explain this change in a video', 'make a narrated presentation', or when another skill needs a narrated video."
---

# Narrated walkthrough

A walkthrough is a spec file (slides + narration + real captures) that the toolkit turns into a
1080p MP4. The toolkit does the rendering, layout checks, narration and muxing; your job is the story,
the captures, and the words.

`SKILL` below is this skill's own folder (the base directory it was loaded from), wherever it's
installed.

```
$SKILL/scripts/setup.sh                                  # once per machine: checks, Playwright, Reverb
node $SKILL/scripts/build.mjs spec.mjs --check [-- args]  # render + check + print what the voice reads
node $SKILL/scripts/build.mjs spec.mjs [-- args]          # narrate + build the video
node $SKILL/scripts/speak.mjs "One line." --voice en_female_narrator,en_male_narrator_1   # audition voices
node $SKILL/scripts/record-voice.mjs <name>               # record a 5–10 s sample → cloned voice (macOS)
node $SKILL/scripts/theme.mjs show                        # which theme and voice this repo gets, and why
```

Start from `examples/tour/spec.mjs` (self-contained, uses most components). `references/spec.md`
is the full spec and component reference; `references/voice.md` covers recording and tuning
voices, and `references/themes.md` covers repo themes and writing your own.
`node --test $SKILL/tests/*.test.mjs` runs the tests (the build tests need setup.sh's Playwright,
and the full-build tests its Reverb too).

## Workflow

1. **Find the story before the slides.** Read the change (diff, PR body, tickets, tests). Write a
   one-line answer to "what can someone do now that they couldn't before, and why should they trust
   it?" The usual arc: what it is (1 slide) → how it works (3–6) → proof it works (1–2) → what's left
   (1). 6–12 slides, 20–40 s of narration each, under ~6 minutes total.
2. **Capture real output.** Every terminal panel must come from a command the spec runs
   (`cap.run`, `cap.shell`, `cap.read`); the toolkit logs each to `captures.txt`. Never type
   output by hand, never "tidy" it beyond picking lines (`pick`, `head`), and when you abridge, say
   so in the panel title ("selected cases", "abridged"). Use a throwaway temp dir for anything that
   writes state. Demos of failures are good: show the refusal, not just the happy path.
3. **Write the spec.** Run `theme.mjs show` in the repo first so you know which theme and
   repo-wide lexicon apply; don't set `theme` in the spec unless asked. One idea per slide. Title = the claim the slide proves, as a sentence
   (≤ 2 lines). No section labels: a `kicker` on the title slide (the PR or ticket number) becomes its marquee line. At most 4–5 bullets; each bullet ≤ 2 lines.
4. **Check until clean:** `build.mjs spec.mjs --check` (fast: no motion, no audio). Errors block the build: overflow, clipped
   panels, lines too long, titles over 2 lines, captions covering text, missing images, steps that
   don't match the narration. Then **open `out/contact-sheet.png`** and look at it, and open any
   slide whose thumbnail looks dense. The check catches geometry, not taste.
5. **Read what the voice will say** (printed by `--check`). Fix anything that would be read
   wrong (see Narration). Use `--only 3,4` (or `4-6`) to iterate on a few slides; it writes to `out/only-3-4/`, so the full
   build's files stay as they were. A `--check` after a full build leaves the last video in place
   and says it's older than the slides.
6. **Build**, then verify: read `report.json` problems (words-per-second outliers mean a garbled or
   truncated take: change that slide's `seed` and rebuild), listen to at least the first slide and
   any flagged step (`afplay out/audio/03-1.wav`), and check the duration is sensible. Check the
   motion by tiling frames from a slide's first seconds:
   `ffmpeg -ss <start> -t 2 -i out/<name>.mp4 -vf fps=6,scale=480:-1,tile=4x3 -frames:v 1 sheet.png`
   (slide start times are in `report.json`).
7. **Hand over** the MP4 path, its length, slide count, and what's real (captures) versus
   illustrative. `narration.md` (script with timestamps) and the `.srt` captions sit next to it.

## Narration: write for the ear

- Write how you'd say it to a colleague: short sentences, active voice, one idea each. ~150–170
  spoken words per minute; the check flags steps far outside 1.7–3.9 words/s.
- **Narrate, don't read the slide.** The slide shows the evidence; the voice says what it means
  and where to look ("On the left is real output from the validator…").
- **Split narration into steps** (`say: [...]`) whenever a slide has parts. Each step reveals its
  parts and gets its own pause. A step per bullet, per panel, or per idea.
- Reverb normalises numbers, dates, money, units, URLs and `#92` by itself ("pull request number
  ninety-two"). Write those naturally.
- It does **not** handle code: file names, paths, flags, `snake_case`, `camelCase`, `a:b`
  tokens, unit-suffixed numbers like `1.4s`. The lint flags these. Either rephrase ("the release
  checklist") or map them in `spec.lexicon` so the slide text can stay exact:
  `lexicon: { 'APP-412': 'A P P four twelve', 'cache:warm': 'cache warm' }`.
  Spell acronyms the team spells (`'APP': 'A P P'`); leave ones said as words (JSON, CI, KV).
- Reverb has no pause or emphasis markup of its own. Commas and full stops shape the rhythm; steps
  add real pauses (`timing: { lead, gap, hold }` globally, or `gap`/`hold` per slide). For pauses
  and delivery inside a step, use cues (next section). A slide's `speed` multiplies the voice's
  speed (0.95 = a touch slower for a dense slide); use it sparingly.
- Brackets are dropped by the voice. Don't put asides in parentheses.

## Delivery and personality

Reverb can't be told to emote; it copies the delivery of its reference recording. So expression
comes from **style voices**: extra recordings of the same speaker in a different register,
switched in mid-line with cues. Cues never appear in captions.

| cue | effect |
| --- | --- |
| `[beat]` | 0.55 s pause, the setup-then-punchline gap |
| `[pause 1.2]` | a pause of n seconds |
| `[dry]` | what follows is read by `<voice>-dry` (deadpan) |
| `[up]` | what follows is read by `<voice>-up` (genuinely pleased) |
| `[plain]` | back to the normal voice, after a 0.3 s pause so the aside lands |
| `[voice NAME]` | what follows is read by another voice, a preset or a recorded one (e.g. a sample of a preset); ends like a style |

Anything else in square brackets is read as written (and the lint flags it), so a typo like `[dyr]`
shows up in the check instead of vanishing.

A speaker recorded as `alex` can add `alex-dry` and `alex-up` (recording them:
`references/voice.md`). Each style keeps the voice's pace. A missing style falls back to the plain
voice.

**The narrator is plain-spoken, confident, warm, with occasional dry wit.** Write the way you'd
present to colleagues you like. If the narration uses someone's cloned voice, write it as they'd
say it, and let them hear the result before it goes out.

- **Dry wit: understatement, not jokes.** Deadpan observations about software, situations, or the
  narrator: "Of course they do." "I checked twice." "Three mistakes in one profile. It's
  almost impressive." "Thanks for watching. There won't be a quiz."
- **Sparingly:** about one aside per three or four slides, never two in a row, and never more than
  five in a video. A video that's all bits is tiring, and the wit only works against a straight
  background.
- **Landing it:** finish the straight point, then `[beat] [dry]` and a short line of 2–8 words.
  Then move on. Never explain the joke, and never follow it with another.
- **Never** at the expense of a person, team, partner, customer or reviewer; never about
  security, data loss or anything that broke for users; never where it could undercut a claim
  the slide is proving. Aim it at software in general, at the situation, or at ourselves.
- **Keep it true.** An aside can't overstate the result: "I checked twice" is fine only if it was
  checked.
- **`[up]` is for real wins** (all tests passing, the hard bug finally fixed, a big number that
  matters): once or twice per video, on the sentence that states the win.
- Opening and closing lines get the most attention. A dry closer after "Thanks for watching" is
  a good habit.

## Voice

Engine: Reverb-TTS (Software Mansion Labs), running locally (tested on Apple Silicon, via PyTorch
MPS, about 8× real time). Narration never leaves the machine. Reverb's weights are licensed CC BY-NC 4.0
(non-commercial), and that covers making the narration at all, not just publishing it: check that
your use qualifies (work for a business may not) before you use this skill for it.

**Default voice: the `en_female_narrator` preset.** To narrate in your own voice, record one with
`record-voice.mjs <name>` (with the speaker's consent) and make it the machine default in
`~/.local/share/narrated-walkthrough/config.json`: `{ "voice": { "voice": "<name>" } }`. A repo
config's or a spec's `voice` overrides it, and `theme.mjs show` prints the voice in effect and
why. The build checks every voice before rendering and stops on one that doesn't exist.
Recording, styles, speeds, presets and the take cache: `references/voice.md`.

- For a different take of one slide, set `seed` on that slide.

## Themes

The theme is chosen per repo, so most walkthroughs never name one: a machine rule that matches the
repo's git remote, then the repo's `.walkthrough/config.json`, then the spec, then `--theme`. The
build prints which theme it used and why. Giving a repo its own look (`theme.mjs init`, `new`,
`preview`), writing a theme, and decor: `references/themes.md`. Never edit the built-in themes for
one repo's sake.

A repo's theme can't run code unless you trust it (`--trust-repo-theme`), slides run no script but
their own animation, and they render offline, so fonts, images and screenshots must be files on disk.

## Design rules

The built-in themes are `endless` (the default: greyscale, DM Sans and DM Mono, shader stills on
title and section slides), `midnight` (dark) and `paper` (light); `references/themes.md` describes
them.

`brand: { name, meta: [['PR', '#92'], ['TICKET', 'APP-412']] }` reaches a theme's decor, for themes
that draw a brand strip. Components are in `scripts/lib/components.mjs`.

- Body text ≥ 26 px, code ≥ 15 px at 1080p (panels auto-shrink from 24 px and fail below their
  minimum). If a panel shrinks to its minimum, show fewer lines or give it its own slide.
- Captured output never soft-wraps by default (mid-token wrapping is unreadable). Use
  `wrap: true` only for prose-like output (test names, log lines): it wraps at spaces with a
  hanging indent.
- Point at things. `highlight: [lines]` on panels, `mark(html, 'Caption')` for a ring + 2–5 word
  caption, `focus: true` on a slide to fade earlier steps. For a live page,
  `await screenshot(url, { marks: [{ target: '#total', caption: 'Now correct' }] })` rings it in
  the page and returns a PNG for `image()` or a `media` slide.
- Colour means something: the theme's accent is the one accent; `ok` green, `bad` red, `warn` amber,
  `neutral` grey only for outcomes. Don't use tones decoratively, and say the outcome in words too
  ("Stops the build."), so colour is never the only cue.
- One word per thing across titles, slides and narration. "Step" already means a narration step,
  so a pipeline has stages; if a slide says "Join", the voice doesn't say "mux". Labels use
  sentence case. Every claim on a slide is checked against the code or output it describes.
- Typeset slide text: curly quotes and apostrophes (’), en dashes for ranges (2–5), a real minus
  (−16), → for changes (3 → 0). Code keeps straight quotes. The build glues a number to the word
  after it with a no-break space (48 kHz, 9 files) everywhere outside code, so they never split.
- Diagrams: a `flow` of ≤ 6 nodes (mark the key one `accent: true`), or `cards`; no dense
  architecture diagrams.
- Screen recordings and full-frame screenshots are slides too: `{ media: 'clip.mp4', say }`.
  Record at 1920×1080 (or 16:9), zoom so text is legible, hold each state long enough to read.

## Motion

On by default (`motion: false` in a spec turns it off). Every frame is posed and captured
deterministically by `scripts/lib/motion.js`, not screen-recorded, so it's exact and repeatable.

- Each slide builds in, in reading order and 100 ms apart: title, marquee, then each
  content block, with bullets, flow nodes, cards and stats one by one. Each part fades up 12 px out
  of a 4 px blur (300 ms, ease-out; titles 400 ms). A hero box that paints a panel
  arrives whole. A theme's hero art draws itself in.
- Each narration step reveals its parts the same way; `focus` slides fade earlier steps back.
- Terminal panels with `$ ` commands (a dollar sign and a space) type the command out and then print the output line by line
  (capped at ~2.6 s; `type: false` on a `term` turns it off). Highlighted lines sweep in after.
- `mark` rings lock on (tighten) and their captions drop in.
- A theme's tracker (`references/themes.md`, Decor) glides to whatever just appeared.
- Content leaves at the end of each slide in 150 ms, shorter and smaller than its entrance (fade,
  12 px up, 4 px blur); the theme's frame and the footer stay put.

Motion is driven by structure, so you get it by using steps and components, not by scripting it.
Keep a step's narration longer than its animation (the build extends the step if not).

## Output

`out/` next to the spec: `<name>.mp4` (H.264/AAC, 1080p30, −16 LUFS, chapters per slide),
`<name>.srt`, `narration.md`, `captures.txt`, `report.json`, `contact-sheet.png`,
`slides/*.png` (one per step, resting state), `frames/` (motion frames), `html/*.html` (open in
a browser to debug a layout; each is saved as checked, and can't reach the network), `shots/` (the
spec's screenshots). The build replaces the output folder's contents on every run, so it refuses an
`--out` folder that has other things in it and wasn't made by a build (it leaves a
`.narrated-walkthrough` marker): point `--out` at a new folder. The last video stays until a full
build has made its replacement, so a build that fails partway never costs it; then any older video
in the folder, whatever its name, is removed. One build runs in a folder at a time (a `.lock` file
holds its process id), and `--check` leaves the last video's `audio/` and `video/` alone.

Write specs outside the repo being narrated (a scratch folder), or gitignore their `out/`: the
output is large (`frames/`), and `html/`, `captures.txt` and `report.json` hold this machine's paths.
Keep videos out of public repos unless the owner says otherwise; slides can show internal IDs.
