# Decision log and portable report

Use `UNTANGLE.md` or the project's established design-record location. Stable finding IDs connect proposals, commits, checks, and reviews. Keep the record proportional to the work; one fix can resolve several related symptoms.

## States

| State | Meaning | Required record |
| --- | --- | --- |
| open | Work or verification remains | Next action and acceptance conditions; checkpoint commits if any |
| implemented and verified | The fix satisfies its acceptance conditions | Commits, check results, and evidence |
| accepted exception | Retaining this design is justified by requirements | Design reason, supporting evidence, and conditions that would reopen it |
| deferred | Work is postponed, including pending approval | Reason, remaining work, and trigger for resuming |
| blocked | A concrete dependency prevents progress or verification | Missing capability or input, attempted resolution, and unblocking action |

Deferred and blocked findings remain unfinished. An implemented fix awaiting runnable tests is open or blocked, not verified. User-struck work goes in **Scope exclusions** with the user's decision; do not disguise it as a design exception. A user exclusion changes the scoped objective but remains visible in the final report.

Reopen a verified entry if later edits invalidate its evidence. Reopen an exception when its stated assumptions stop holding. Reviewers may challenge either state with new evidence.

## Template

Copy and fill the sections needed for the task. The following is a blank template, not an example of completed evidence.

```md
# Untangle decision record

## Scope and setup
- Objective and deliverable:
- Repository and checkout:
- Original starting commit:
- PR original head and target comparison revision, if applicable:
- Toolchains and platforms:
- Comments / Tests choices and existing authorizations:
- Fixed boundaries, supported consumers, and compatibility obligations:
- Generated/vendor exclusions and generator commands:
- Layout/build-membership constraints:
- Formatting baseline and commit convention:
- Verification matrix: behavior → exact check → environment → prerequisites:
- Checks requiring isolation or sequential execution:
- Independent review coverage and record location:

## Original baseline (preserve observations)
| Check | Revision/platform | Command | Outcome | Named failures/skips and cause | Evidence |
| --- | --- | --- | --- | --- | --- |

## Follow-up evidence
Record setup repairs, reruns, target-branch comparisons, and changed explanations here.

## Findings and fixes
### U1 — Fix sentence naming the owner or contract
- State: open
- Problems and source evidence:
- Proposed design and why it resolves those problems:
- Affected callers/platforms/generated artifacts/persisted data/consumers:
- Behavior to preserve:
- Intended behavior change: none, or requirement, compatibility, authorization, tests:
- Acceptance conditions:
- Checks required:
- Commits/checkpoints:
- Verification: revision, environment, result, evidence:
- Next action or unblocking condition:

## Scope exclusions
Record the excluded finding IDs, the user's decision, and what remains outside this task.

## Independent reviews
| Round/reviewer | Revision | Scope | Findings | Disposition and follow-up evidence |
| --- | --- | --- | --- | --- |

## Completion or handoff
- Status: incomplete / complete (only when the skill's done conditions hold)
- Current revision and owned uncommitted changes:
- Structural outcomes:
- Observable behavior changes and compatibility evidence:
- Final verification and baseline comparison:
- Accepted exceptions and scope exclusions:
- Open, deferred, or blocked items and unblocking actions:
- Next action if incomplete:
- Portable record and evidence locations:
```

## Example: one fix behind two symptoms

**U1 — Give the sheet presenter ownership of focus restoration**

- **State:** open.
- **Problems:** `LogoutSheet.swift` waits 100 ms before restoring focus; `SettingsView.swift` sets a global flag when it opens a nested sheet to prevent the outer sheet restoring focus too early.
- **Design:** the presenter tracks the prior focus owner and sheet lifecycle. Each presentation owns its restoration; callers no longer coordinate through time or a global flag.
- **Affected:** sheet presenter, both callers, their UI tests. Public API and persisted formats stay unchanged.
- **Behavior to preserve:** normal dismissal restores the prior valid focus owner. Nested presentation keeps focus within the active sheet. A removed focus target is handled without a crash.
- **Intended behavior change:** fix focus escaping a nested sheet; record the product requirement and test that demonstrates the old failure.
- **Acceptance:** both callers use the presenter; delay and flag are gone; normal, nested, and removed-target cases pass on the required platform.
- **Verification:** package compilation plus the relevant UI lifecycle tests. Compilation alone cannot close the finding. If the simulator is unavailable, establish it or mark verification blocked.

**Accepted exception example:** a lock-backed Swift `@unchecked Sendable` type stays because the supported callback API crosses concurrency boundaries. Record the protected fields, synchronization invariant, and tests/review supporting it. “Removing it is hard” is not the rationale.

## Delivery and resume

Keep the decision record with the branch or patch. If repository policy excludes scratch logs, deliver a sanitized report as a tracked document, review artifact, or attachment alongside the changes. An absolute path inside a disposable worktree is not a portable handoff. Do not include credentials, private environment dumps, or raw logs containing secrets.

On resume, verify the original baseline identity, inspect commits and uncommitted changes, then reconcile states. Preserve user choices. List the next substantive action, not just the last successful check.

A final report may say “complete within the explicitly agreed scope” while listing user exclusions. It must say “incomplete” if any scoped finding, required check, or independent review remains open, deferred, or blocked. State what is needed to finish.
