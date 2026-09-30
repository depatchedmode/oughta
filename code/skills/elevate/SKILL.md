---
name: elevate
description: Inspect and improve a selected git diff scope for legibility, maintainability, elegance, correctness, and performance. Use when the user asks whether anything should be adjusted, polished, cleaned up, made more maintainable, made more correct, or otherwise improved in the current work, including variations like "anything you'd adjust in this diff?", "review the uncommitted changes", "review this branch against main", "polish this before commit", or "make the changes cleaner".
---

# Elevate

Use this skill to perform a senior-engineer improvement pass over a selected git diff scope. The goal is not to find every possible preference change; it is to make or recommend changes that clearly improve the user's existing work without hijacking its intent.

## Workflow

1. Resolve the review scope before inspecting deeply.
   - If the user explicitly says "staged", review only the index diff against `HEAD`.
   - If the user says "uncommitted", "worktree", "before commit", or similar without narrowing to staged changes, review staged, unstaged, and relevant untracked changes.
   - If the user explicitly names a branch, PR, merge target, or base branch, review the branch diff against that base.
   - If the user asks broadly to elevate, polish, review, or adjust "the changes" without a clear scope, ask one concise question: "Should I review only uncommitted changes, or the full branch diff against a base branch? If base branch, which one?"
   - Do not default to a base branch merely because one exists. Only infer a default base when the surrounding task clearly points to branch or PR review.

2. Establish the change set.
   - For staged scope, run `git status --short`, `git diff --cached --stat`, and `git diff --cached`. Read unstaged or untracked content only as needed for context; keep findings and edits within the staged scope.
   - For uncommitted scope, run `git status --short`, `git diff --stat`, `git diff`, and `git diff --cached` as needed.
   - For branch/base scope, identify the base branch, then use `git diff --stat <base>...HEAD` and `git diff <base>...HEAD`. Include uncommitted changes only if the user asks or they are directly needed to evaluate the branch work.
   - For uncommitted scope, inspect relevant untracked files explicitly; they are not included in the tracked diffs.
   - If the selected scope has no changes, say so and stop.

3. Reconstruct intent before judging implementation.
   - Read the changed files in context, plus nearby tests, callers, types, docs, and established local patterns.
   - Infer the user's goal from the diff and surrounding code. If intent is materially ambiguous, ask a concise question before making risky changes.

4. Review in priority order.
   - Correctness: broken behavior, edge cases, type/API contract mismatches, lifecycle/concurrency hazards, error handling, data loss, migration or compatibility issues.
   - Maintainability and legibility: needless complexity, confusing names, scattered logic, unclear boundaries, duplicated code that now has a concrete maintenance cost.
   - Elegance: simpler structure that fits existing patterns and reduces cognitive load without broad refactoring.
   - Performance: changes with plausible user-visible or scaling impact. Avoid speculative micro-optimizations.

5. Decide whether to edit or report.
   - When the user asks "anything you'd adjust", "polish", "clean up", or similar, apply small, low-risk improvements directly.
   - Report rather than edit when the change is large, subjective, risky, depends on product intent, or would move beyond the selected scope.
   - If the user explicitly asks for review only, do not edit files; return findings ordered by severity with file and line references.

6. Edit conservatively.
   - Keep changes close to the touched behavior and style of the repository.
   - Do not revert user work or unrelated changes.
   - Preserve the existing index unless the user asks to change it. When staged and unstaged edits overlap and a safe scoped edit is unclear, report the improvement instead of mixing the changes.
   - Preserve public contracts unless the diff is already changing them or a correctness fix requires it.
   - Prefer small patches that the user can easily review over clever rewrites.

7. Verify appropriately.
   - Run the narrowest meaningful tests, type checks, linters, or formatters available for the touched area.
   - If verification is unavailable, expensive, or blocked, state exactly what was not run and why.

## Response

Keep the final response concise:

- Summarize what changed and why.
- Call out any important issue found but not fixed.
- List verification commands and results.
- If no changes were worth making, say that clearly and mention any residual risks or test gaps.
