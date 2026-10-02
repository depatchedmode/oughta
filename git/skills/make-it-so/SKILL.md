---
name: make-it-so
description: Carry a GitHub issue or implementation specification through evidence-backed acceptance, repeated code review, and behavior-preserving simplification to an opened PR. Use when asked to pursue an issue autonomously through these quality gates, including continuing an interrupted run.
---

# Make It So

Pursue the issue until its final revision passes all three gates and an implementation PR is opened. Resolve supported decisions autonomously; interrupt only for material owner judgment or a real blocker. Do not settle for easy wins, shortcuts, partial acceptance, or a plan in place of delivery.

This is a workflow followed by the agent, not an executable graph engine. The [workflow graph](references/workflow.md) shows its transitions. The rules below define what passing each node means.

## Scope, authority, and continuity

- Start from the supplied issue/specification, the selected repository, and any existing owning task or PR. Read the source rather than inferring its acceptance criteria from its title. Establish the target base, full issue-related diff, relevant uncommitted/untracked work, and baseline problems. Preserve user and concurrent work, including deliberate task-related edits. Identify ownership before editing overlapping changes; separate or reconcile them rather than treating them as workflow-owned defects. Investigate intent and ask when a deliberate edit conflicts with newer requirements and the intended resolution is unresolved.
- Follow the host's project execution and delegation rules. Transfer the issue, acceptance criteria, owner decisions, repository conventions, relevant skills, scope, and verification expectations to any executor. A delegate's completion claim does not itself pass a gate.
- A request to carry the issue through this workflow authorizes its ordinary implementation, necessary fixes, meaningful tests, commits, pushes, and opening or updating its PR within normal repository permissions. It does not authorize merging, deploying, filing follow-up issues, or messaging people. If automatically discovered during a narrower request, retain that request's narrower authority.
- Keep a lightweight, durable run record outside the production diff, using the [run-record template](references/run-record.md). Use it to resume, retain evidence, and deduplicate findings, not as a second project-management system. Record the active gate and next action before interruption or handoff.
- Identify each evaluated revision by base and commit plus the task's uncommitted content, or an equivalent content fingerprint, together with the applicable issue requirements, adopted contracts, and owner decisions. Record a baseline separately. Any task-content change, or material change to those requirements or contracts, invalidates affected evidence, resets the clean-review count to zero, and requires renewed Gate 1 verification before review. Gate 3 completion is also invalidated. A metadata-only commit of already evaluated content need not cause gratuitous retesting; record that content identity.
- On resume, reconcile the record with the actual issue, owner decisions, dirty and untracked work, branch/base, PR head, and checks. Revalidate affected gates if any have changed; never resume from a stale green status. Report concrete progress without asking for routine approval between gates.

## Oughta skill routing

Use the stable identifiers below to find skills in the current catalog. Read the skills needed for the current stage and change; discovery does not mean loading every skill. The source links identify repo-owned guidance and remain usable when domain plugins are installed separately.

| Skill | When to use it |
| --- | --- |
| [`git:commit`](../commit/SKILL.md) | Prepare logical, atomic commits at delivery or an intermediate checkpoint. Explicitly limit its scope to task-owned changes; existing user staging and unrelated work retain their ownership. |
| [`code:elevate`](https://github.com/depatchedmode/oughta/blob/main/code/skills/elevate/SKILL.md) | Perform a review-only pass in Gate 2 and the two improvement passes in Gate 3. Supply the full issue-related scope and this workflow's stricter gate constraints. |
| [`local-first:local-first-design`](https://github.com/depatchedmode/oughta/blob/main/local-first/skills/local-first-design/SKILL.md) | Plan, implement, and review changes to persistence, offline behavior, synchronization, recovery, or remote-service dependencies in any language. |
| [`rust:rust-practices`](https://github.com/depatchedmode/oughta/blob/main/rust/skills/rust-practices/SKILL.md) | Implement, review, or restructure Rust, add Rust dependencies, or investigate Rust performance. Read only the applicable sections and use the adopting project's toolchain and policies. |

`git:commit` ships in the same domain plugin. The other skills ship in their respective oughta plugins; packaging does not automatically install them. If one is absent from the catalog, read its source from an available oughta checkout or the linked repository, including any referenced material needed for the task. If required guidance cannot be accessed, record the specific capability gap and unblock needed; do not claim that pass ran. Do not install plugins or change host configuration merely to satisfy routing. Discover additional language/domain skills when the issue calls for them, within the original task's authority.

## Planning checkpoint

Before implementation:

1. Read the acceptance criteria, relevant code and existing behavior, applicable repository instructions, code conventions, and verification commands. Follow the conditional skill routing above and discover other relevant language/domain guidance. Respect the project's adopted architecture; do not turn a focused issue into an unsolicited migration.
2. Investigate gaps using repository evidence, product behavior, platform constraints, and authoritative documentation as needed. Distinguish observed facts from assumptions. Resolve ordinary implementation choices yourself.
3. Map every acceptance criterion to an observable pass condition, an implementation step, and suitable verification. Include applicable code-practice requirements and relevant regression risks. Produce an implementation and verification plan in the run record.
4. Escalate unresolved significant questions that expressly require the owner's judgment: intended user experience, accepting performance or security regressions, platform feasibility, material behavior/scope tradeoffs, or conflicting requirements. Present the issue, investigation and evidence, options and consequences, and a recommendation when supported. Pause dependent work until answered. Do not silently choose a regression, weaken a criterion, or pretend an impossible target is achievable.

When there is a supported path, enter Gate 1 immediately. This checkpoint does not require approval of every plan. Apply the same exception rule to consequential questions discovered later; preserve work and return to the earliest affected gate after resolution.

## Gate 1 — Acceptance and implementation quality

Implement and verify until **all** acceptance criteria and applicable repository, language, and domain practices are satisfied with evidence.

- Exercise observable behavior across real boundaries with integration or end-to-end tests. Unit tests are sufficient for genuinely isolated behavior, not a substitute for the multi-component promise being made. Use mocks only where they do not replace the behavior being accepted. Reuse meaningful coverage; add tests where they provide missing evidence.
- For relevant local-first promises, choose scenarios such as disconnect/edit/restart, interrupted synchronization and retries, concurrent edits, service loss, or export/restore according to the affected behavior and adopted guarantees. Do not claim network or platform behavior from an unrepresentative substitute.
- Record the evaluated revision, command or procedure, environment, expected observation, actual result, and relevant evidence for each criterion. Run required repository checks and targeted regressions. Separate pre-existing failures from new failures with evidence; an unexplained failure is not automatically a baseline problem.
- A green unrelated suite, skipped test, mock-only demonstration, or unavailable required test does not satisfy a criterion. Failed, ambiguous, or missing evidence keeps this gate open. Diagnose failures and repair within scope. If verification is genuinely blocked, state the missing evidence and what would unblock it; do not claim completion.
- Inspect adherence to applicable practices as well as test outcomes. Passing tests does not excuse code that violates adopted conventions or architecture.

After edits in later gates, renew affected acceptance and regression evidence and complete required checks for the resulting revision. Retain unaffected evidence only with a recorded reason it remains applicable. Do not rerun unchanged checks without a change, failure, or unresolved concern that warrants it.

**Pass:** every criterion has passing, applicable evidence; required checks are satisfied; relevant practices are met; no unresolved owner decision blocks the implementation.

## Gate 2 — Review, verify, and converge

Review the full issue-related change, including necessary immediate context. Prefer fresh independent reviewer contexts when available. Give each reviewer the actual current diff/content, issue, acceptance criteria, adopted constraints, and relevant skills; do not prime it with your desired verdict or previous reviewer conclusions. Ask for evidence and concrete impact, not a quota of findings.

Independently verify every finding against code, contracts, and tests before acting. Severity and scope are separate dimensions. Record the finding's evidence and disposition:

| Disposition | Action |
| --- | --- |
| Necessary and in scope | Fix automatically, then return through Gate 1. |
| Valid but suitable for deferral | Catalog the impact, evidence, scope boundary, and why deferral is appropriate. |
| Optional polish | Apply when clearly worthwhile, inexpensive, and low-risk within the issue scope; otherwise record why it is not worth doing now. |
| Unsupported or incorrect | Reject with the evidence that disproves it; unresolved uncertainty is not a disproof. |
| Owner decision required | Use the planning-checkpoint exception process. |

Do not defer a change needed for acceptance, an introduced regression, or a problem that makes the delivered issue incorrect merely by calling it out of scope. An unrelated pre-existing defect can be deferred even if serious; severity alone does not expand the issue. If its consequences prevent responsible completion without an owner's tradeoff, escalate that decision.

The default exit threshold is **two consecutive substantive clean review passes on unchanged task content**. A clean pass has no unresolved necessary fix or other reasonable in-scope work, including worthwhile cheap polish. It may leave cataloged deferrals and polish whose cost or risk exceeds its value. Both passes must involve fresh scrutiny; replaying a cached report, copying a verdict, or merely checking that last round's fixes exist does not count. If independent contexts are unavailable, perform distinct fresh passes and disclose that limitation.

Any edit resets the count. Reverify Gate 1, then review again. Deduplicate repeated findings; reconsider a prior disposition only when new evidence warrants it. Reaching a count or time limit is not a substitute for convergence. If repeated iterations stall or cycle, investigate the cause; if it cannot be resolved autonomously, report the evidence and specific blocker with gates still incomplete.

**Pass:** two clean passes apply to the current content, every finding is adjudicated, and no reasonable in-scope fix remains.

## Gate 3 — Simplification and elevation

Read and apply `code:elevate` through two distinct passes: **simplification** examines unnecessary nesting, branching, indirection, duplication, and scattered logic; **elevation** examines overall legibility, boundaries, maintainability, and evidence-backed efficiency. Its existing improvement workflow supplies both capabilities. Record the outcome of each pass separately; one general verdict does not establish both. This gate's strict preservation rule constrains any broader correctness or performance changes allowed by that skill.

Give these passes the explicit scope: the complete issue-related diff against the established base, including task-owned uncommitted and untracked changes, plus necessary immediate context. Their general instructions do not authorize repository-wide cleanup or behavior changes here.

- Improve clarity, structure, and maintainability where there is a concrete benefit. Preserve **exact behavior and outputs**, including public contracts, serialization, ordering, errors, side effects, persistence/synchronization semantics, accessibility behavior, and relevant timing assumptions. Fewer lines alone is not improvement.
- Evaluate simplification and elevation repeatedly until a full pass through both finds no worthwhile further improvement. Do not manufacture edits to satisfy the loop or oscillate between equivalent styles.
- After any edit, reset the clean-review count, return through Gate 1 and Gate 2, then run Gate 3 again. Tests are evidence for preservation, not permission to redefine expected behavior. Do not adjust expected outputs merely to make cleanup pass.
- If a pass discovers a correctness defect, classify it under Gate 2. A necessary behavior correction belongs to implementation and renewed acceptance, not a supposedly behavior-preserving refactor. Escalate any unresolved product tradeoff.

**Pass:** a full simplification-and-elevation pass makes no further worthwhile change, and the same final content still has Gate 1 evidence and Gate 2's two clean passes.

## PR and owner handoff

After all gates pass, use `git:commit` for task-owned commits and create or update the issue's PR using the repository's normal conventions. Verify the branch, base, pushed content, and PR URL. Reuse an existing matching PR rather than creating a duplicate. Prepare a reviewable title and description that explain the problem, resulting behavior, evidence, and material limitations. Attach the PR with the app's artifact tool when available. Oughta has no separate PR-publishing skill; use available repository tooling within the authorization above.

Account for required CI on the actual PR revision. Wait for required checks and diagnose failures; relevant fixes re-enter the gates and update the PR. A pending, failed, or inaccessible required check is not a verified completion. If waiting is blocked by external conditions, report that specific limitation and retain the unfinished state. PR-creation failure likewise prevents claiming the workflow is complete.

Hand back:

- The opened PR and a concise explanation of what changed and why.
- Acceptance evidence, relevant automated checks, and the final gate results for the delivered revision.
- Focused manual verification steps, with setup and expected observations, that help the owner assess the result. Separate additional confidence checks from any essential verification still missing; the latter prevents a complete claim.
- A deduplicated list of potential follow-up issues: suggested title, observed problem and evidence, impact, proposed scope or acceptance criteria, and reason for deferral. Keep these as candidates for owner review; do not file them automatically.

## Model and effort

Preserve explicit user model/effort choices. A skill or diagram cannot change runtime settings. Use only controls actually supported by the host or delegation API, within the user's authorization; never claim an unverified change.

When the user permits per-stage tuning, a starting policy is the same capable model throughout, Ultra for planning and review, High for routine implementation/test development and simplification, and Ultra for difficult implementation or substantial refactors. This is a configurable starting point, not a proven optimum or a reason to downgrade an explicit Ultra selection. If those labels or controls are unavailable, retain the active supported settings and report the limitation only when relevant. Evidence and gate requirements do not change with model choice.
