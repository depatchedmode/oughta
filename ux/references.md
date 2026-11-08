# UX references

Third-party tools and sources for UX review of running apps. These are optional recommendations, not project policy. Check each tool's current README before relying on details below, which were checked against developer-skill-pack 1.3.0.

## developer-skill-pack

[dennisonbertram/developer-skill-pack](https://github.com/dennisonbertram/developer-skill-pack) is a set of skills for Claude Code, Codex and Cursor. Its UX skills map an app's user journeys from the codebase, walk them in a real browser and critique the result. They then file or fix what they find.

Install the skills for all three agents at user level:

```sh
npx skills add dennisonbertram/developer-skill-pack -g -a claude-code -a cursor -a codex -s '*' -y
```

This installs only the skills. The pack's 20 subagents (used by `/coordinator` and the issue-groomer and issue-implementer agents) are installed separately, through `claude plugin install`. The UX skills do not need them.

### Recommended sequence

The pack's author recommends running the UX skills as a single goal, in this order (posted by [@DennisonBertram](https://x.com/DennisonBertram) on X, November 2026):

```text
/goal Please run /ux-paths then /ux-flow then /ux-walker then /ux-visual and after that /loop three rounds of /ux-auto-improve
```

| Step | Skill | What it produces |
| --- | --- | --- |
| 1 | `ux-paths` | A catalog of user-journey stories derived from the codebase, with the ideal path length for each |
| 2 | `ux-flow` | Friction scores against those ideal paths, duplicate-feature hunting and ranked simplification proposals |
| 3 | `ux-walker` | A browser walk of every story, checking correctness, layout geometry and friction; fixes small issues and files the rest |
| 4 | `ux-visual` | A screenshot-and-interaction critique of each component and page at desktop and phone widths; implements the chosen fixes |
| 5 | `ux-auto-improve` ×3 | Three rounds, each improving one section: critique, adversarial judging, parallel implementation with regression tests, then a merge and a narrated before/after video |

Each step uses the output of the steps before it, so run them in order.

### Before running it

- **Use a branch or worktree.** `ux-walker`, `ux-visual` and `ux-auto-improve` change code, and `ux-auto-improve` merges its changes.
- **Expect GitHub issues.** `ux-walker` and `ux-flow` file issues in the repository's GitHub project for problems they do not fix.
- **Native macOS apps** use `ux-paths-native`, `ux-flow-native` and `ux-walker-native` in place of steps 1–3. Run the skill's `driver/install.sh` once (at `~/.agents/skills/ux-walker-native/driver/install.sh` after the install above) and grant the terminal Accessibility permission.
- **Narrated videos** from `ux-auto-improve` need `ffmpeg`, `jq`, `bc` and Playwright. The voice uses ElevenLabs if `ELEVENLABS_API_KEY` is set, and only the narration text is sent. Otherwise it falls back to macOS `say`.
