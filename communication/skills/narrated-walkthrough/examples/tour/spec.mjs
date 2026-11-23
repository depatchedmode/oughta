// A short, self-contained walkthrough of this toolkit. It runs anywhere and uses most components,
// so it doubles as a smoke test:  node ../../scripts/build.mjs spec.mjs --check --out "$(mktemp -d)/tour"
// page.html stands in for the app a real walkthrough would screenshot (usually a localhost URL).
import { pathToFileURL } from 'node:url';

export default async ({ capture, screenshot, image, term, code, bullets, split, stack, flow, cards, callout, stats, lede, note, mark, c, specDir }) => {
  const cap = capture({ cwd: specDir });
  const page = pathToFileURL(`${specDir}/page.html`).href;
  const ringed = await screenshot(page, {
    name: 'settings',
    viewport: { width: 1200, height: 800 },
    marks: [
      { target: '#digest', caption: 'New setting', position: 'left' },
      { target: '#saved', caption: 'Confirms the save', position: 'bottom' },
    ],
  });
  const fullFrame = await screenshot(page, {
    name: 'settings-full',
    viewport: { width: 1920, height: 1080 },
    marks: [{ target: '#digest', caption: 'New: weekly digest', position: 'left' }],
  });
  const versions = [
    cap.shell('node --version'),
    cap.shell('ffmpeg -version | head -1 | cut -d" " -f1-3'),
  ].join('\n');

  return {
    name: 'toolkit-tour',
    title: 'narrated-walkthrough',
    footer: 'narrated-walkthrough · toolkit tour',
    lexicon: { 'spec.mjs': 'spec dot M J S', TTS: 'T T S' },
    slides: [
      {
        layout: 'title',
        title: 'The work is done. Nobody saw it happen.',
        body: lede('A diff shows what changed. It doesn’t show why, or how anyone knows it works.'),
        say: 'Your agent just spent an hour on a change. What comes back is a diff, and a summary in a chat that’s already scrolling away. A diff shows what changed. It doesn’t show why, or how anyone knows it works.',
      },
      {
        title: 'A narrated walkthrough explains the work to people who weren’t watching',
        body: `${cards([
          { title: 'You', tone: 'accent', body: 'Back from a meeting, you watch three minutes instead of reading forty files.', step: 1 },
          { title: 'Teammates', tone: 'ok', body: 'They review with the reasons in hand, not just the diff.', step: 2 },
          { title: 'Later', tone: 'neutral', body: 'Months on, the video still explains why it was built this way.', step: 3 },
        ], { cols: 3 })}${note('Your agent writes the slides and the script from real output. This toolkit renders, checks, narrates and joins them into one video.')}`,
        say: [
          'That’s what this skill is for. Your agent makes a short narrated video of its work, from real command output, code and screenshots. You can catch up in a few minutes.',
          'Teammates who weren’t in the chat get the reasons, not just the diff.',
          'And months later, the video still explains why it was built this way.',
        ],
      },
      {
        title: 'Five stages, each one checkable',
        body: `${flow([
          { title: 'Capture', note: 'real command output', step: 1 },
          { title: 'Render', note: 'HTML to PNG per step', step: 2 },
          { title: 'Check', note: 'overflow, clipping, size', step: 2 },
          { title: 'Narrate', note: 'local Reverb TTS', step: 3, accent: true },
          { title: 'Join', note: 'ffmpeg, chapters, captions', step: 3 },
        ])}${split(term(versions, { title: 'captured when the spec runs', step: 1 }), note(`Everything on a terminal panel comes from a command the spec ran. The commands and their full output are saved in ${c('captures.txt')}.`, { step: 1 }), { align: 'center' })}`,
        say: [
          'First, the spec runs real commands, and their output goes straight into terminal panels. Nothing is typed in by hand.',
          'Each slide is rendered once per narration step, and checked for anything that overflows, is clipped, or is too small to read.',
          'Then a local voice model reads the narration. That’s this voice. Almost human, but not quite, which puts us right in the uncanny valley. [beat] [dry] The rent here is very reasonable. [plain] Finally, ffmpeg joins it all into one video, with chapters and captions.',
        ],
      },
      {
        title: 'Parts appear as the narration reaches them',
        focus: true,
        body: split(
          code(`say: [\n  'First sentence, about the first bullet.',\n  'Second, about the next one.',\n],\nbody: bullets([...], { reveal: 1 })`, { title: 'spec.mjs', highlight: [1] }),
          bullets(['Give <b>say</b> an array, one entry per step.', 'Mark parts with a <b>step</b> number, or reveal bullets one by one.', `With ${mark('<b>focus</b>', 'Dims what came before', { below: true })} on, earlier steps fade back.`], { reveal: 1 }),
          { ratio: '1.1fr 1fr' },
        ),
        say: [
          'A slide can reveal its parts in step with the narration. Give say a list, with one entry per step.',
          'Then mark each part with the step it belongs to, or let a bullet list reveal one bullet per step.',
          'With focus turned on, earlier steps fade back, so the viewer always knows which line I mean.',
        ],
      },
      {
        title: 'A screenshot of a live page can ring what changed',
        body: split(
          code(`await screenshot('http://localhost:3000/settings', {\n  marks: [\n    { target: '#digest', caption: 'New setting' },\n    { target: '#saved', caption: 'Confirms the save' },\n  ],\n})`, { title: 'spec.mjs' }),
          image(ringed, { title: 'settings', caption: 'A stand-in page that ships with the tour', step: 2 }),
          { ratio: '1fr 1.25fr', align: 'center' },
        ),
        say: [
          'When a change is something you can see, the spec can open the page, usually your app running locally, and point at the parts that matter.',
          'Each target gets a ring and a short caption, drawn into the page itself before the screenshot is taken, so they line up exactly. A target that isn’t on the page stops the build.',
        ],
      },
      {
        title: 'A full-frame screenshot',
        media: fullFrame,
        say: 'A screenshot can also fill the whole frame, like this one. So can a screen recording. Give the slide a video file instead, and it plays while the narration runs.',
      },
      {
        title: 'The build catches slides a viewer can’t read',
        body: `${cards([
          { title: 'Overflow', tone: 'bad', body: 'Content taller or wider than the slide. Stops the build.' },
          { title: 'Clipping', tone: 'bad', body: 'Panel text cut off at an edge. Stops the build.' },
          { title: 'Type size', tone: 'warn', body: 'Anything under 15 pixels. Raises a warning.' },
          { title: 'Narration', tone: 'warn', body: 'File names the voice would garble. Raises a warning.' },
        ])}${stats([
          { value: '24 kHz', label: 'Reverb output, resampled to 48 kHz AAC' },
          { value: '−16 LUFS', label: 'One loudness for the whole video' },
          { value: '1080p30', label: 'H.264, fast start, chapters' },
        ])}`,
        say: 'Before any audio is made, the build checks every slide. Content that overflows or gets clipped stops the build. Text too small to read is a warning, and so is anything the voice would read badly, like file names and command flags. The finished video has one consistent loudness, chapters, and a captions file.',
      },
      {
        title: 'Install the plugin, and the first run sets up the rest',
        body: `${split(
          code('claude plugin marketplace add depatchedmode/oughta\nclaude plugin install communication@oughta', { title: 'Claude Code', step: 1 }),
          code('codex plugin marketplace add depatchedmode/oughta\ncodex plugin add communication@oughta', { title: 'Codex', step: 1 }),
        )}${note(`The first time, your agent runs ${c('setup.sh')}. It installs Reverb, the default voice and a browser for rendering: a few hundred megabytes, once per machine. You need Node, ffmpeg and Python 3.10 or newer.`, { step: 2 })}`,
        say: [
          'To install it, add the oughta marketplace, then install the communication plugin. That’s two commands in Claude Code, and the same two in Codex.',
          'The first time you use it, your agent runs a one time setup. It downloads the voice model and a browser for rendering slides. That’s a few hundred megabytes, once per machine.',
        ],
      },
      {
        title: 'It narrates in a stock voice until you record your own',
        body: split(
          stack(
            code('# read the line it shows you, about 10 seconds\nnode scripts/record-voice.mjs alex\n\n# optional: deadpan and pleased takes for asides\nnode scripts/record-voice.mjs alex-dry --text "…"\nnode scripts/record-voice.mjs alex-up --text "…"', { title: 'Record a voice', step: 2 }),
            code('{ "voice": { "voice": "alex" } }', { title: '~/.local/share/narrated-walkthrough/config.json', step: 3 }),
          ),
          bullets([
            { html: 'Out of the box: the <b>en_female_narrator</b> preset, or another Reverb preset.', step: 1 },
            { html: 'Record yourself reading one line. The script trims it, checks the level and clones it.', step: 2 },
            { html: 'Make it this machine’s default. Clone a voice only with its owner’s consent.', step: 3 },
            { html: 'Reverb’s weights don’t allow commercial use.', step: 3 },
          ]),
          { ratio: '1.2fr 1fr', align: 'center' },
        ),
        say: [
          'Out of the box, it narrates with a stock preset voice. It sounds like this. [beat] [voice en_female_narrator] Here’s a quick walkthrough of what changed in this pull request, and how we know it works. [plain] There are other presets to choose from.',
          'To narrate in your own voice, record yourself reading one line, about ten seconds. The script trims the recording, checks the level, and turns it into a voice. You can also record a deadpan take and a pleased one, for the asides.',
          'Then make it the default in your config. Only clone a voice with its owner’s consent. And the voice model is licensed for non-commercial use, so check that yours qualifies.',
        ],
      },
      {
        title: 'Ask for a walkthrough in plain words',
        body: split(
          stack(
            bullets(['“Make a walkthrough video of this pull request.”', '“Narrate what changed on this branch for the team.”', '“Record a demo of the new settings page.”']),
            note(`Or name the skill: type ${c('/')} in Claude Code or ${c('$')} in Codex, then pick ${c('narrated-walkthrough')}.`),
          ),
          callout('What your agent does', [
            'Plans the slides and captures real output.',
            `Runs ${c('--check')} until every slide is clean.`,
            'Builds the video, then hands you the MP4, captions and script.',
          ], { tone: 'ok', step: 2 }),
          { ratio: '1.15fr 1fr', align: 'center' },
        ),
        say: [
          'You don’t need to learn the spec. Ask your agent in plain words, like, make a walkthrough video of this pull request. Or name the skill directly.',
          'Your agent plans the slides, captures real output, and checks every slide until it’s clean. Then it builds the video, and hands you the video, its captions and the script. Thanks for watching. [beat] [dry] Please, hold your applause.',
        ],
      },
    ],
  };
};
