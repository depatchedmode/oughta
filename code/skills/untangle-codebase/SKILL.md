---
name: untangle-codebase
description: Thoroughly refactor a codebase or specified area around what should change together, with verification and independent review. Use when explicitly asked to untangle a repository, subsystem, or PR.
disable-model-invocation: true
argument-hint: "[area or concern to focus on] [--comments] [--tests] [--no-confirm]"
license: MIT
---

Adapted from [Maze's untangle-codebase](https://github.com/caldoai/skills/blob/442c29918339cc8dbf09ae27aaf17b05745465a3/skills/untangle-codebase/SKILL.md). The original change-together lens and refactoring loop are retained; this adaptation adds verification, native-language guidance, and durable review records. See [LICENSE](LICENSE).

Start a thorough refactor and pursue it until the done conditions in step 5 hold. Do not stop after easy wins, a clean commit, or the first pass through the list.

The question throughout is **should these pieces change together?** Make ownership and contracts explicit, remove needless coupling, and preserve required behavior. The intended benefits are less searching, fewer silent breaks, and faster debugging; do not claim measured savings without evidence.

## Scope and invocation

- An area or concern limits investigation and changes to it and the code needed to understand and fix its links. For a PR, record the target branch and original PR head. Related code is not permission to refactor the entire repository.
- `--comments` or `--tests` answers step 1 for both additions: a named one is on, an absent one is off. Explicit prose instructions take precedence over flags.
- `--no-confirm` skips questions and the step 3 review gate. Without other instructions, additions are on only when their flags are given. Treat uncertain external boundaries as fixed. File moves without existing authorization remain deferred. This flag does not relax verification or authorize pushing or publishing.
- Carry the user's choices and authorizations across resumes; do not ask for them again.

## 0. Establish readiness and the baseline

Read [readiness.md](references/readiness.md) and establish its prerequisites before restructuring affected code. Missing prerequisites are work to complete, not reasons to shrink the objective. Continue independent work while a genuine blocker remains.

- **Detect toolchains from tracked files.** Read [rust.md](references/rust.md), [swift.md](references/swift.md), and [kotlin.md](references/kotlin.md) only for matching projects. For other languages, use repository instructions and tooling; the structural method still applies.
- **Preserve the starting state.** Record the starting commit and checkout. Use a clean branch or isolated checkout without discarding the user's work. Identify ownership of existing changes before touching them. Follow repository commit conventions.
- **Establish verification readiness.** Resolve dependencies, required credentials and services, toolchain/cache access, fixtures, and devices. Record which checks share simulators, build directories, ports, or other resources and must run sequentially or in isolation. Record readiness without secret values.
- **Map verification to behavior.** Take build, test, lint, formatting, binding-generation, and packaging commands from the project first. Map affected behavior to checks and environments. Establish missing critical regression coverage before changing the implementation. Compilation does not replace a persistence, lifecycle, deployment, or device test.
- **Run and preserve the baseline.** Record the exact commit, platform, command, individual failing or skipped tests, failure signatures, and evidence. Separate setup blockers from code failures. For PR work, a failure on the original PR head is not confirmed on the target branch; compare there when attribution matters. Never relabel a new failure as baseline. Append explanations and reruns without replacing original observations.
- **Identify exclusions and fixed boundaries.** Skip hand-editing generated output, vendored forks, and submodules. Identify supported consumers, release versions, public APIs, FFI, wire and persisted formats, and platform-required structure. In-repo consumers can ship independently; change both sides together only when their compatibility contract allows it. Regenerate output from its source.
- **Check layout and formatting constraints.** Find out how file moves affect build membership, generated project files, and module boundaries. If formatting already fails, format touched files rather than creating unrelated churn.

Start `UNTANGLE.md` using [decision-log.md](references/decision-log.md). Keep findings, verification evidence, review records, and next work there. Do not automatically exclude it from Git. Use the project's documentation location if preferred; local scratch notes must be distilled into a portable completion or handoff record delivered with the branch or patch.

On resume, read the log and inspect Git before acting. Check that the log belongs to this task and starting revision. Reconcile entries with commits and owned uncommitted edits; do not blindly revert a diff or restart the baseline. Reopen affected verification when code changes after a check.

## 1. Choose additions and confirm constraints

Besides untangling the codebase, there are two additions:

| Addition | What it does |
| --- | --- |
| **Comments** | Remove comments that only restate the code. |
| **Tests** | Remove tests that wouldn't catch a real bug, and fix the ones that fail without one. |

If the user has not already chosen and `--no-confirm` is absent, show these exact descriptions and ask which additions to include. Bundle unresolved scope or boundary questions with this question. Record the answer once. Tests needed to protect a structural fix are part of that fix regardless of whether optional Tests cleanup was selected.

## 2. List the structural problems

Do not restructure code yet. Run relevant linters and inspect suppressions, baseline files, and configuration-level disables. Use results as evidence, not one mandatory fix per warning.

Survey the scoped code, asking **should these pieces change together?** Record concrete evidence for each finding:

**Hidden links: pieces that must change together, but the dependency is not expressed.**

- Logic or values copied across sites that must agree.
- State, globals, files, or environment variables written by one module and implicitly consumed by another.
- One feature scattered across layers so a change requires edits whose relationship is hard to discover.
- Call order or lifecycle conventions callers must remember.
- Matching string literals across notifications, preferences, routes, intent extras, or wire fields.

**Needless links: pieces tied together that change for different reasons.**

- Callers depending on another module's implementation details.
- Stable policy depending directly on a changing implementation.
- A general function containing vocabulary or parameters for one workflow.
- An interface exposing so much machinery that internal changes repeatedly force caller changes.

**Surplus: pieces with no demonstrated responsibility.**

- Forwarders that provide no boundary, ownership, adaptation, or contract.
- Extension points for variation the requirements do not support.
- Code with no consumers across supported targets, features, reflection, generation, or external APIs.

Also investigate **special cases**: value-specific branches, platform/version branches, swallowed errors, delays, retries, forced unwraps or casts, suppressions, and disabled tests. Identify the requirement each serves and whether the design accounts for it.

These are investigation prompts, not removal rules. A wrapper may isolate a platform API; a retry may implement a protocol; a newtype may prevent mixing identifiers. Similar-looking code need not share ownership. Record justified exceptions at the module or invariant level rather than cataloguing every routine branch. Do not accept a problem merely because fixing it is difficult or its tests are unavailable.

## 3. Redesign from the requirements

Work out the fixes as if the system had known today's requirements from the start. Look for one change in ownership or representation that resolves several findings. Do not patch special cases one by one or introduce a general abstraction without a shared responsibility.

Write each proposed fix above the problems it solves. Give it a stable ID and record:

- The proposed owner, type, or contract and why it resolves the coupling.
- Affected callers, platforms, generated artifacts, persisted data, and external consumers.
- Observable behavior that must remain unchanged.
- Any intended behavior change, its requirement, compatibility consequences, and test evidence to obtain.
- Acceptance conditions and the checks that demonstrate them.

An HTTP status, error outcome, retry policy, default, or startup rejection can change behavior even if signatures stay the same. Calling something a bug fix does not waive compatibility. Preserve fixed contracts unless the user changes that constraint; record unrelated bugs separately without expanding the task.

Mark file moves and include required project/build updates. Existing authorization for those moves is sufficient; otherwise include them in the review gate. Under `--no-confirm`, defer unauthorized moves and continue independent fixes.

Unless already authorized or `--no-confirm` was passed, present the concrete fixes and ask which to strike before implementation. Record user exclusions separately from accepted design exceptions; neither should be rediscovered without new evidence.

## 4. Implement and verify every fix

Work in coherent units ordered by dependency. Complete substantive redesigns; do not substitute convenient local cleanups for the agreed fix.

- Run fast checks per fix or tightly related batch, using the language reference and repository cost constraints. Run relevant behavioral tests for each unit and full affected suites at integration checkpoints and the final revision.
- Investigate new failures immediately. Fix regressions before building further on the change. If the environment fails, retain the failed attempt and rerun under controlled conditions; an interrupted or blocked run is not a pass.
- After changing native/FFI code, rebuild libraries and bindings before consumer checks. Verify the new artifact, not a cached package or old binary.
- Format touched code and commit coherent checked units using repository conventions. Include finding IDs and rationale. A compile-checked checkpoint may be committed with pending behavioral verification explicitly recorded; it cannot be marked verified.
- Mark an entry **implemented and verified** only after its acceptance conditions pass. Remove temporary probes or deliberately broken code before committing.

For tests added or changed during any fix, replace timing guesses with controlled scheduling or explicit completion signals. Negative assertions require proof the relevant work had a chance to execute. Bound failure paths and release blocked workers or tasks during cleanup. For critical protections, where feasible temporarily break the protection and verify the test fails for the intended reason, then restore and rerun. Do not claim this evidence for tests you did not exercise.

If **Comments** was selected, remove narration that adds nothing to the code. Keep explanations of invariants, ownership, compatibility, algorithms, and external constraints where the code alone is insufficient. Preserve API docs, doctests, safety arguments, and tool directives. Remove obsolete workaround explanations with the workaround.

If **Tests** was selected, do the cleanup after structural changes have their regression protection:

- Before removing a test, identify its behavior or failure mode and why coverage is redundant, invalid, or unnecessary. Keep distinct consumer and integration coverage even when lower-level assertions overlap.
- Rewrite tests coupled to incidental implementation details. Private-function access is not itself a defect. Interaction assertions can represent a contract, such as no write after cancellation.

## 5. Review, repeat, and deliver

Have independent subagents review the resulting design and introduced regressions, partitioned by crate, target, or module, plus a cross-cutting review of contracts, globals, string keys, and generated mirrors. Give them the step 2 definitions, relevant language reference, scope and boundaries, current log, diff, and verification evidence. Reviewers report without editing. They may reopen an existing item when its fix or evidence is inadequate.

Record reviewer identity, reviewed revision, scope, findings, and dispositions. Fix actionable findings and repeat affected reviews and checks until a complete review round has no unresolved actionable findings. A self-review does not satisfy independent review. If independent reviewers are unavailable, record that requirement as blocked instead of claiming it happened.

Use the states in [decision-log.md](references/decision-log.md): **open**, **implemented and verified**, **accepted exception**, **deferred**, and **blocked**. Missing verification is unresolved work. Accepted exceptions require a design reason; user exclusions require the recorded scope decision. Neither difficulty nor elapsed time justifies accepting a defect.

The scoped task is complete when:

- All scoped findings are implemented and verified or justified accepted exceptions; no scoped open, deferred, or blocked work remains.
- Ownership and contracts make coordinated changes discoverable, and independent responsibilities are not needlessly coupled. Necessary cross-platform or process boundaries are explicit.
- Intended behavior is preserved and every authorized behavior change has its own evidence.
- Required checks for affected behavior ran against the final code, or remain valid because subsequent edits cannot affect what they checked. No unexplained new failures remain. Unchanged baseline failures outside affected behavior are disclosed; failures preventing verification of changed behavior remain blockers.
- Independent review covers the final changes, with no unresolved actionable findings.
- The portable decision record accompanies the deliverable: baseline provenance, verification, behavior changes, exceptions, and explicit user scope exclusions.

Special-case counts, deleted lines, commit counts, and passing test totals do not substitute for these conditions.

Continue until these conditions hold. When a real blocker or execution limit forces a handoff, label the run **incomplete**, preserve the full objective, and name remaining items, unblocking conditions, current revision, owned uncommitted work, and next action. A successful checkpoint is not task completion. Do not push or publish unless authorized.

## Investigation aids

- Use declaration inventories to navigate; inspect implementations before drawing conclusions. The references include search commands that do not modify sources.
- Use Git history to investigate frequently changing files and files that change together. Co-change is evidence to examine, not proof of one responsibility.
- Inspect dependency and type-reference graphs, including generated, runtime, and process-boundary links that imports miss.
