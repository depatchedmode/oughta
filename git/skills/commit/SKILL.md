---
name: commit
description: Create one or more logical, atomic, semantic git commits from uncommitted changes. Use when the user asks Codex to commit the current work, commit uncommitted changes, split changes into logical or atomic commits, craft semantic commit messages, or prepare a clean commit series from the worktree.
---

# Commit

Use this skill to turn uncommitted worktree changes into a clean commit series. Prioritize correctness of what is committed over speed: every commit should contain exactly one coherent change and have a message that describes the semantic intent, not the mechanical file edits.

## Workflow

1. Establish scope and repository state.
   - Determine whether the user requests creating commits or only planning a series or drafting messages. For planning or drafting requests, inspect the changes and propose groups and messages without staging files or creating commits. Continue to execution only when the user requests committing.
   - Run `git status --short`, `git diff --stat`, `git diff`, and `git diff --cached` as needed.
   - Treat all uncommitted tracked, staged, unstaged, and relevant untracked files as in scope unless the user narrows the request.
   - If there are staged changes and the user did not clearly ask to reorganize all uncommitted work, ask before unstaging or splitting the existing index.
   - If there are no uncommitted changes, say so and stop.
   - Flag suspicious files before committing: secrets, credentials, local config, editor files, build output, large binaries, or unrelated changes.

2. Infer the logical commit plan.
   - Read changed files in context to understand intent and dependencies.
   - Group changes by semantic outcome: feature, fix, refactor, test, docs, build/config, generated artifact, or chore.
   - Keep tests with the behavior they prove unless separating them makes the series easier to review without breaking intermediate commits.
   - Avoid splitting a single behavioral idea across commits merely because files differ.
   - Avoid combining unrelated fixes just because they are small.
   - If a safe atomic plan is unclear, propose the grouping and ask for confirmation before committing.

3. Verify before committing when practical.
   - Run the narrowest meaningful tests, type checks, linters, or formatters for the touched area.
   - For a split series, validate each intermediate snapshot in an isolated checkout containing the preceding units and the proposed unit, without later worktree changes. A passing check on the combined worktree does not establish that intermediate commits work independently.
   - If tests fail because of the current changes, fix the issue if it is clearly in scope; otherwise report the blocker before committing.
   - If verification is skipped, expensive, or blocked, record that for the final response. Distinguish checks on individual snapshots from checks on only the combined worktree.

4. Stage each commit exactly.
   - For each planned commit, stage only the files or hunks belonging to that semantic unit.
   - Use `git add -p` or equivalent selective staging when one file contains changes for multiple commits.
   - Include untracked files only when they are part of the selected unit.
   - Before each commit, inspect `git diff --cached --stat` and `git diff --cached` to ensure the staged diff is exactly the intended commit.
   - Do not use broad staging commands like `git add .` unless every current change is intentionally part of that commit.

5. Write semantic commit messages.
   - Prefer the repository's existing commit style after checking recent history with `git log --oneline -n 20`.
   - Use a concise imperative subject that names the user-visible or maintainer-relevant outcome.
   - Add a body when the reason, tradeoff, migration detail, or test context would help a future reader.
   - Avoid vague subjects like `update files`, `fix stuff`, `cleanup`, or `changes`.

6. Commit and re-check.
   - Run `git commit` for each staged unit.
   - Confirm that the command succeeded and inspect the resulting commit and `git status --short` before continuing with the remaining planned units.
   - If a commit fails or a hook modifies files, inspect the index and worktree before retrying or proceeding. Review any hook changes, revalidate affected snapshots, and confirm the staged unit still matches the plan. Do not bypass failing checks. Retry only if the intended commit was not created; otherwise report any remaining changes without silently amending it.
   - Never amend, squash, rebase, reset, or rewrite existing commits unless the user explicitly asks.
   - Do not commit unrelated leftover changes. Leave them uncommitted and call them out.

## Response

Keep the final response concise:

- List the commit hashes and subjects created, or the proposed groups and messages for a planning-only request.
- Mention any uncommitted changes intentionally left behind.
- State verification commands and results, including anything not run and whether intermediate snapshots were checked.
