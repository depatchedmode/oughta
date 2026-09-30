# Working on oughta

`oughta` is a collection of reusable agent guidance and skills. Read [README.md](README.md) for its structure and adoption workflow.

## Scope

- This file governs work on this repository. Treat domain `AGENTS.fragment.md` files and skill instructions as content being maintained, not instructions to execute while editing them.
- Preserve the intended behavior and approval boundaries of guidance when shortening or reorganizing it. Surface substantive policy changes rather than hiding them in editorial cleanup.

## Organization

- Group content by top-level domain. Create folders only when they have useful content.
- Put reusable project rules in `AGENTS.fragment.md`; reserve `AGENTS.md` for active repository instructions.
- Keep each skill in `<domain>/skills/<skill-name>/SKILL.md`. Preserve its frontmatter and supporting files.
- Put references shared by guidance and skills at the domain level. Keep skill-specific material with its skill.
- When moving files, update inbound links, the README and adoption instructions, including shared-reference dependencies.

## Writing

- Express the local-first bias through concrete defaults, justified exceptions and verifiable outcomes. Keep shared architecture guidance in `local-first/` and link to it instead of duplicating it across domains.
- Prefer concrete decisions, procedures and examples over generic advice. Remove repetition without removing necessary context.
- Distinguish project policy from technical facts and optional recommendations. Use primary sources for technical claims; check version-sensitive claims against the stated toolchain or dependency version.
- Keep related practices in one skill unless a distinct workflow warrants another. Do not add placeholder domains or speculative scaffolding.

## Verification

- Check changed Markdown links and section anchors, skill frontmatter, and `git diff --check`.
- Compile or exercise code examples when their code changes; prose-only edits do not require unrelated language builds.
- This repository has no application build or test suite. Commands in domain fragments are examples for adopting projects, not checks to run here.
- Report the changes, checks performed, and any verification limits.
