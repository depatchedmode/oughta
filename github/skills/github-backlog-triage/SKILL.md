---
name: github-backlog-triage
description: Audit an existing GitHub backlog across labels, milestones, issue formatting, and issue forms. Use for repo-wide issue organization or an approved triage migration, including template rollout.
---

# Triage a GitHub backlog

For a request for provisional recommendations, deliver a read-only assessment of all four dimensions. For an approved rollout, carry the agreed changes through verification. Treat implementation of the underlying tickets, closing issues, and merging a template PR as separate actions governed by the user's request.

## Establish what work is still open

Read the repository's issue and contribution guidance. Inventory live labels and descriptions, milestones and their membership, existing templates, and any workflows that consume labels or issue events. Check for organization defaults if the repo has no templates.

Capture every open issue's number, title, body, comments, labels, milestone, links, and update time. Paginate both issues and comments. The REST issues collection includes pull requests, and nested GraphQL connections can truncate comments independently of the issue list. Reconcile unique issue numbers against the repository's open-issue count and explain discrepancies or inaccessible records. Keep private snapshots local.

For each issue, record the remaining deliverable, evidence for its current scope, and how someone would know it was complete. Follow linked decisions, merged PRs, or release evidence where they change that answer. Keep proposed work, work on the default branch, and shipped behavior distinct. If the title says “add a CI check” but a later decision moves it to the release gate, settle the scope before choosing an area or milestone. Surface unresolved owner decisions explicitly.

## Develop recommendations in a second pass

| Dimension | Decision to make | What to show |
| --- | --- | --- |
| Labels | Which filters would someone actually use? Separate the kind of deliverable from owning area, cross-cutting concern, and temporary status. Respect existing issue types and automation. | Define each proposed label, map existing labels to keep, rename, consolidate, or retire, and test representative searches against the issue-level assignments. Explain exceptions and ambiguous assignments. |
| Milestones | Which issues share a verifiable delivery finish line? An epic owns a decomposition and dependencies. A milestone can deliver a slice of that epic. | Give each candidate a finish line, member issue numbers, and any broader related trackers to link from the description. Leave themes without a delivery boundary unassigned. |
| Formatting | Can a new contributor find the outstanding outcome or question, current scope, and acceptance evidence from the body? | Show a representative before/after. Preserve the author's facts, historical measurements, links, and rationale. Bring decisions forward from comments with attribution. Keep short issues short. |
| Templates | What does a filer know, and what must a maintainer decide? | A useful starting set is bug (expected/observed behavior and an example), change/task (outcome and acceptance), and investigation (question and settling evidence). Add an epic template if frequency warrants it, or document the blank-issue path. |

Test the scheme across the whole backlog. For example, evidence gathering can itself be the deliverable while a maintenance task can be waiting on a decision. Check whether the documented searches retrieve each as intended. Count unclassified issues and conflicting work kinds, inspect milestone outliers, and keep a per-issue disposition even for issues needing no edits. Report coverage, concrete examples with links, proposed changes across all four dimensions, and decisions still needed. Provide a local mapping for a large backlog so the user can inspect individual proposals.

## Apply an approved migration

Use the reviewed issue-level mapping as the desired state. Before writing, refresh affected records and reconcile intervening edits or new comments. Preserve unrelated labels, milestone assignments, body content, and contributor changes. Check consumers and wider usage before renaming or deleting a repository-wide label, including its use on closed issues and PRs.

Create any needed labels and milestones first, reusing existing ones on retry. Apply field-level differences in manageable batches. Read back each batch, record failures, and resume from live state. Afterward, export the backlog again, compare affected fields to the plan, and account for issues opened or closed during the migration. Report actual changes and exceptions.

## Deliver the issue forms

Use repository conventions for the template location and triage guide. Keep the few answers essential to act on each kind prominent, and place any redaction guidance before the first input. Document automatic labels, the manual triage step, and how CLI/API filers can supply the same context. Confirm the target repository supports the validation behavior described, especially for private repositories.

Parse the form YAML and verify field types, unique IDs, prompt order, configured labels against the live catalog, blank-issue settings, and documentation links. Walk a plausible submission through each form and the resulting triage search. For a requested template PR, follow repository checks. When authorized to merge, verify the required gate on the actual head and confirm the merge on the default branch. Distinguish files present on that branch from a verified live chooser.
