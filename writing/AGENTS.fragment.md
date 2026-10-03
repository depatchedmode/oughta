# Technical writing

> Adoption: select one snippet below for your installation mode and merge it into the project's `AGENTS.md` (Codex) or `CLAUDE.md` (Claude Code). Preserve existing instructions and remove the unused variants and this note. Installing `writing@oughta` does not adopt these project rules automatically.

## Installed writing plugin

Install `writing@oughta` through the appropriate marketplace as described in the repository README. Both agents expose the skill under the `writing:clear-technical-writing` plugin namespace; Claude Code also accepts `/writing:clear-technical-writing` as an explicit command.

```markdown
When drafting, revising, or reviewing technical documentation, explanations,
or procedures, load and apply the writing:clear-technical-writing skill.
```

## Repository-local skill in Codex

Copy the complete [skill folder](skills/clear-technical-writing/SKILL.md) to `.agents/skills/clear-technical-writing/` in the target repository. Its external source links need no companion reference files. Use this snippet in a root `AGENTS.md`:

```markdown
When drafting, revising, or reviewing technical documentation, explanations,
or procedures, read and apply .agents/skills/clear-technical-writing/SKILL.md.
```

## Repository-local skill in Claude Code

Copy the same skill folder to `.claude/skills/clear-technical-writing/` in the target repository. Use this snippet in a root `CLAUDE.md`:

```markdown
When drafting, revising, or reviewing technical documentation, explanations,
or procedures, read and apply .claude/skills/clear-technical-writing/SKILL.md.
```
