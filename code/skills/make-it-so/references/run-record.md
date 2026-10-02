# Run record template

Use one compact record in an existing task scratch area or another durable location outside the production diff. Fill only the fields useful to this run. Update at gate transitions and before interruption; preserve enough evidence to resume without treating old results as current.

## Context and plan

- Issue/spec and repository:
- Immutable head, diff merge base, current target-base revision, and issue-related scope; user/concurrent edits and staging preserved:
- Intended deliverable fingerprint, effective tested snapshots and relevant build inputs, requirements/contract version, and baseline:
- Relevant repository rules, language/domain skills, and architectural constraints:
- Owner decisions, supported assumptions, and unresolved questions:
- Implementation steps and verification-environment dependencies, including any PR needed to obtain evidence:
- Active gate, current blocker if any, and next action:

## Acceptance evidence

| Criterion or required practice | Observable pass condition | Test/check and environment | Expected and observed result; evidence location | Effective tested snapshot; applicability to deliverable |
| --- | --- | --- | --- | --- |

Keep baseline failures and verification gaps explicit. A criterion with missing required evidence remains incomplete. If preserved local work participates in a check, account for its effect or verify the isolated deliverable. A matching task diff alone does not establish matching tested behavior.

## Review and improvement

- Clean-review count and current content identity:
- Each review pass: scope/context, primary risk lens, what was independently examined, findings, and adjudicated result:
- Each distinct simplification and elevation pass: skill/source applied, concrete benefit or reason for no change, behavior-preservation evidence, and resulting gate invalidation:

| Finding | Verification evidence and impact | Necessity and scope | Disposition and rationale | Fix or follow-up reference |
| --- | --- | --- | --- | --- |

## Follow-up candidates

For each distinct valid deferral, retain a suggested title, observed problem and supporting evidence, impact, proposed scope/acceptance criteria, and reason it belongs outside this issue. Link duplicates to the same candidate. Keep rejected findings separate from valid deferred work.

## Delivery

- PR, draft/readiness status, and verified head/target-base/content matching the evaluated deliverable:
- Final Gate 1 evidence, two clean Gate 2 passes, and no-change Gate 3 pass:
- Required CI for the current PR/merge revision, final reconciliation, and material limitations:
- Manual checks with setup and expected observations:
- Handoff summary and follow-up candidates:
