# Untangle codebase

A thorough structural refactor driven by one question: **should these pieces change together?** It investigates hidden dependencies, unnecessary coupling, and code without a responsibility, then implements and verifies the resulting design.

Use it for a whole repository, a subsystem, or a PR. It is explicitly invoked and can span several runs. The goal is a completed, reviewed result; a smaller diff or fewer special cases is not proof of success.

## Start here

- [SKILL.md](SKILL.md): the agent workflow, scope rules, and completion conditions.
- [Readiness guide](references/readiness.md): what must be established before affected code is restructured.
- [Decision log](references/decision-log.md): finding states, a copyable template, and completion/handoff requirements.
- Language guidance: [Rust](references/rust.md), [Swift](references/swift.md), and [Kotlin](references/kotlin.md). Other languages use the same core method with repository tooling.

## Invocation

When installed through oughta's Claude Code plugin, use `/code:untangle-codebase` with the same scope and flags. The examples below use the standalone skill name.

For a Codex installation:

```text
$untangle-codebase
$untangle-codebase session lifecycle --comments --tests
$untangle-codebase PR 986 and its affected callers --comments --tests --no-confirm
```

In a host that exposes skills as slash commands, use `/untangle-codebase` with the same arguments. Put the entire folder in the host's skill directory so relative references remain available. The frontmatter preserves the existing slash-command fields; `agents/openai.yaml` expresses explicit-only invocation for Codex.

With neither additions flag, the skill asks about Comments and Tests unless the user already chose. Giving either flag chooses exactly the named additions. `--no-confirm` skips the questions and design review gate, but preserves compatibility boundaries, verification requirements, and existing authorization limits. It does not authorize publishing. Necessary regression tests remain part of every structural fix.

## Before starting

Provide the scope and any known constraints. The agent establishes the rest: a preserved starting revision, reproducible dependencies and tools, working verification environments, compatibility obligations, regression protection, and independent review coverage. The readiness guide explains the evidence required.

If infrastructure or coverage is missing, the agent works on that prerequisite and continues independent work. It does not replace an unavailable integration test with a compile check or silently drop the affected objective.

## What you receive

- Coherent refactor commits or a patch, following repository conventions.
- A portable decision record connecting problems, design decisions, behavior changes, commits, checks, and review findings.
- An explicit completion status. Unresolved scoped work remains open, deferred, or blocked, with the next action recorded.

Accepted exceptions explain why retaining a design is correct. User exclusions record an explicit scope decision. Neither is a label for work the agent found inconvenient.

## Changes informed by the trial runs

This revision adds verification readiness and baseline provenance, per-fix acceptance conditions, explicit behavior-change records, auditable independent review, durable handoffs, and stricter completion states. The native-language references treat suspicious patterns as investigation prompts and emphasize lifecycle and concurrency evidence.

These changes address observed failure modes from the trials. This revised package still needs a fresh real-project trial; the earlier runs do not validate the new instructions or establish future token or time savings.

## Source and license

Adapted from [untangle-codebase by Maze](https://github.com/caldoai/skills/blob/442c29918339cc8dbf09ae27aaf17b05745465a3/skills/untangle-codebase/SKILL.md) in `caldoai/skills`, at revision `442c29918339cc8dbf09ae27aaf17b05745465a3`. The original supplies the change-together question, hidden-link/needless-link/surplus categories, and redesign/review loop. This adaptation adds readiness and baseline provenance, Rust/Swift/Kotlin guidance, explicit behavior-change and finding states, test evidence, and portable completion records.

The skill package is MIT-licensed; [LICENSE](LICENSE) retains the upstream copyright and permission notice. Review gates, invocation flags, verification requirements, and completion states are this adaptation's workflow policy, not language requirements.
