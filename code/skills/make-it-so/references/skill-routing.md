# Oughta skill routing

Read this at `PLAN` and when resuming past it, and the matching contract before any `code:elevate` call or commit.

Find skills in the current catalog by these stable identifiers, reading only those needed for the current node and change. The source links identify repo-owned guidance and remain usable when domain plugins are installed separately.

| Skill | When to use it |
| --- | --- |
| [`git:commit`](https://github.com/depatchedmode/oughta/blob/main/git/skills/commit/SKILL.md) | Logical, atomic commits at `EARLY`, `PR`, or an intermediate checkpoint, under the commit contract. |
| [`code:elevate`](../../elevate/SKILL.md) | The two Gate 2 passes and a review-only pass in each Gate 3 `REVIEW` visit, under the elevate contract. |
| [`local-first:local-first-design`](https://github.com/depatchedmode/oughta/blob/main/local-first/skills/local-first-design/SKILL.md) | Changes to persistence, offline behavior, synchronization, recovery, or remote-service dependencies, in any language. |
| [`rust:rust-practices`](https://github.com/depatchedmode/oughta/blob/main/rust/skills/rust-practices/SKILL.md) | Rust code, dependencies, or performance; read only applicable sections and use the project's toolchain and policies. |

`code:elevate` ships in this plugin; the others ship in oughta plugins that packaging does not install. If one is absent, read its source and referenced material from an oughta checkout or the linked repository. Discover other language/domain skills the issue calls for, within the task's authority.

## Elevate contract

- **Scope:** the complete issue-related diff against the target base, including task-owned uncommitted and untracked changes, plus necessary immediate context; never other parties' work, repository-wide cleanup, or behavior changes.
- **Intent:** the issue, criteria, and owner decisions, not the diff; route intent ambiguity to `OWNER` instead of asking elevate's own question.
- **Mode:** improvement in Gate 2 under that gate's [preservation rule](../SKILL.md#gate-2--simplification-and-elevation-improve-edited); review-only in Gate 3. In Gate 2, apply each improvement that elevate reports rather than applies, or record why it is declined or cataloged as beyond cleanup scope.
- **Correctness:** concerns go to `TRIAGE`, never into a behavior-preserving edit.

## Commit contract

Choose commit grouping yourself when a safe atomic plan is clear; otherwise take the grouping question to `OWNER` from `EARLY` or `PR`, as `git:commit` requires confirmation, deferring any intermediate checkpoint commit until then. Commit only task-owned changes; user staging and unrelated work keep their ownership. Task and other changes in one file are an ownership question under [Scope](../SKILL.md#scope-authority-and-continuity-start-sync). When the index holds another party's staged changes:

1. Mark task-owned untracked files with `git add -N` (intent-to-add), which lets `git commit --only` name them without staging their content for another party's plain commit.
2. Inspect `git diff HEAD -- <task-owned paths>` instead of the index: `git commit --only` commits each named path's whole working-tree content. Split a task-owned file across commits only with a temporary index or after asking at `OWNER`.
3. Run `git commit --only -- <task-owned paths>`, which leaves the other staged changes staged.
4. After every such attempt, including one a hook aborted or rewrote or one interrupted before this step, and before leaving these steps without one, run `git reset -q -- <task-owned paths>`. Confirm `git diff --cached --name-only` lists only the other party's paths and `git status --porcelain -- <task-owned paths>` shows new files as untracked (`??`), with nothing staged or intent-to-add.
