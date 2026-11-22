# Voices

The narrator is set in the machine config (`~/.local/share/narrated-walkthrough/config.json`,
`{ "voice": { "voice": "<name>" } }`), a repo's `.walkthrough/config.json`, or the spec's `voice`,
later ones winning. `theme.mjs show` prints the voice in effect and where it came from. The build
checks every voice (the narrator's and each `[voice NAME]` cue's, clone recordings included) against
the engine in use (Reverb's presets and your recorded voices, or `say`'s voices) before rendering;
one that doesn't exist stops the build. A layer that changes the engine replaces the whole narrator,
so a Reverb voice and its speed never carry over to `say`. An `.npz` path or a clone's `audio` is
relative to the file that set it (the spec, the repo config, or the machine home).

## Your own voice

`record-voice.mjs <name>` records a 5–10 s sample and clones it (macOS). It plays three ticks and a
chime, records from the default input (`--device NAME` for another), cuts everything before the
speech starts (found by sound), trims silence, refuses takes that are silent, too long, too quiet
or clipped, and writes a test line. The default line takes about 10 s. A refused or failed take
leaves an existing voice of that name untouched. **Clone only with the speaker's consent.**

- Elsewhere, or from an existing recording: `--from file.wav --text "exact transcript"`, used whole.
- Other languages: `--language de` (also `fr`, `es`, `it`, `pl`, `pt`). The voice keeps its language,
  so narrating with it needs no `language` setting; a configured one still wins.
- macOS input volume matters: at 34% a take came out silent; about 70% worked.
- Recorded voices live in `~/.local/share/narrated-walkthrough/voices/<name>.{wav,npz,txt,json}`,
  with the test line in `<name>.test.wav`.

**Styles.** A speaker recorded as `alex` can add `alex-dry` and `alex-up`, which the `[dry]` and
`[up]` cues switch to (see Delivery and personality in SKILL.md). Record one with
`record-voice.mjs <voice>-<style> --text "…"`, using a line written to provoke that delivery, and
ask the speaker to overdo it a little: the clone flattens it. A missing style falls back to the
plain voice, with a warning for a recorded voice; presets have no styles.

## Speed

Reverb copies the reference's pace. Each recorded voice stores the speed that brings it to about
2.7 words/s in `voices/<name>.json` (a brisk reader's voice might run at 0.7), so switching styles
doesn't change the pace. A configured `voice.speed` (spec, repo or machine) replaces the narrator's
own, and belongs to the voice it was set with: a repo that picks another narrator doesn't inherit
the machine narrator's speed, and `-dry`, `-up` and `[voice NAME]` keep their own. A slide's `speed`
multiplies whichever applies.

## Presets

`en_female_narrator` (the default), `en_male_narrator_1`, `en_male_narrator_2`; `speak.mjs --list`
shows all of them and the voices recorded here. Audition with
`speak.mjs "One line." --voice a,b` (files go to `~/.local/share/narrated-walkthrough/voice-preview`
unless `--out` says otherwise); it uses the machine's narrator, as a build outside any repo would.
Listing presets needs the network about once a week (after a failed try, not again for a day);
narrating with one works offline once it has been used.

## Takes and the cache

Same text + voice + seed = same audio, cached in `out/.tts-cache`. Re-recording a voice, replacing a
clone's recording, or upgrading reverb-tts invalidates it, and takes finished before a failed build stay cached. For a
different take of one slide, set `seed` on that slide.

## Engines

Fallback without Reverb: `voice: { engine: 'say', voice: 'Samantha' }` (macOS). Engines live in
`scripts/lib/tts.mjs`: an engine is `synth(jobs)` → `[{ seconds, spoken }]`, where each job is
`{ text, out, meta, cfg }` with its own resolved voice config and writes its `meta` file when
done, plus `prepare`, `voices` and `version`. Add one there; don't fork the pipeline.
