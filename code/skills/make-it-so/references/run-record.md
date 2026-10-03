# Run record template

Use one compact record at the location chosen under [Scope, authority, and continuity](../SKILL.md#scope-authority-and-continuity-start-sync). Update the status header when SKILL.md directs; fill other fields only when useful to this run. Preserve enough evidence to resume without treating old results as current. The sections after Fingerprint form the record.

## Fingerprint

Compute the deliverable fingerprint from task-owned paths without touching the real index. Separate files with mixed ownership, or resolve them under [Scope](../SKILL.md#scope-authority-and-continuity-start-sync), first.

```sh
(
  tmp=$(mktemp -d) || exit
  trap 'rm -rf "$tmp"' EXIT
  export GIT_INDEX_FILE="$tmp/index"
  git read-tree HEAD &&
  git add -A -- <task-owned paths> &&
  git write-tree   # prints the fingerprint
)
```

A failed step prints no fingerprint; reconcile the task-owned path list, as at `SYNC`, and rerun, dropping paths that exist in neither `HEAD` nor the worktree after a deletion or rename is committed. Never run it with an empty list, which would stage the whole worktree; with no task-owned paths, the fingerprint is `HEAD^{tree}`.

Record it, with the target-base revision and requirements/contract/decision version, in the status header and with each check, Gate 2 round, and Gate 3 pass.

## Status

- Branch and worktree that own this run:
- Node (graph ID) and next action:
- Blocker or pending owner decision, if any:
- Target-base, merge-base, and head revisions; task-owned paths; deliverable fingerprint:
- Requirements/contract version and owner decisions in force:
- Gate currency (planning, Gate 1, Gate 2, Gate 3 clean-review count under the current fingerprint, base, and requirements); stall in effect:
- Fingerprint of the last no-change Gate 2 round, and each later content change with its origin (`TRIAGE` fix, Gate 1 repair needed by a `TRIAGE` fix and not entered from `CI`, CI-entered change, or other):
- PR, head being checked, and lifecycle state:

## Context and plan

- Issue/spec and repository:
- Issue-related scope; user/concurrent edits and staging preserved:
- Complete prospective PR diff and ownership reconciliation, including inherited commits and accepted dependencies; scoped branch if needed:
- Effective tested snapshots, relevant build inputs, and baseline:
- Relevant repository rules, language/domain skills, and architectural constraints:
- Supported assumptions and unresolved questions:
- Implementation steps and verification-environment dependencies, including any PR needed to obtain evidence:

## Acceptance evidence

| Criterion or required practice | Observable pass condition | Test/check and environment | Expected and observed result; evidence location | Effective tested snapshot; applicability to deliverable |
| --- | --- | --- | --- | --- |

Keep baseline failures, owner-accepted target-base failures, and verification gaps explicit.

## Cleanup and review

- Each Gate 2 round: skill/source applied, simplification and elevation outcomes recorded separately, fingerprint, concrete benefit or reason for no change, and behavior-preservation evidence:
- Each Gate 3 pass: fingerprint, instrument, primary risk lens, scope/context, what was independently examined, findings, and clean or not clean:

| Finding | Verification evidence and impact | Necessity and scope | Disposition and rationale (cycle or stall rule if applied) | Fix or follow-up reference |
| --- | --- | --- | --- | --- |

## Follow-up candidates

For each distinct valid deferral, retain a suggested title, observed problem and supporting evidence, impact, proposed scope/acceptance criteria, and reason it belongs outside this issue. Link duplicates to the same candidate. Keep rejected findings separate from valid deferred work.

## Delivery

- PR, draft/readiness status, complete diff matching agreed scope, and pushed tree matching the fingerprint at verified head/target-base:
- Final Gate 1 evidence, the Gate 3 clean-review count and its passes for the delivered fingerprint, and the no-change Gate 2 round that keeps Gate 2 current:
- Required CI for the current PR/merge revision and lifecycle state (or verified absence of required checks), owner-accepted target-base failures, final reconciliation, and material limitations:
- Manual checks with setup and expected observations:
- Handoff summary and follow-up candidates:
