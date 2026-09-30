# oughta

How we oughta build things. Skills, conventions, and guidance for coding agents.

## What’s here

- [Rust project guidance](languages/rust/AGENTS.md): an adoption template for repository conventions, check commands, and approval boundaries.
- [Rust practices](skills/rust-practices/SKILL.md): one reusable skill covering Rust techniques, decision procedures, and examples.
- [Rust references](skills/rust-practices/references.md): primary sources and further reading.

Language-specific project templates live in `languages/`; reusable skills live in `skills/`. The Rust template describes conventions to adopt in a Rust project, not instructions to turn this repository into a Rust workspace.

## Use in a project

1. Merge the relevant language template into the project’s existing `AGENTS.md`. Adapt its layout conventions, commands, lint configuration, and approval policies before adoption.
2. Copy the entire `skills/rust-practices/` folder into the project’s supported skill location, keeping `SKILL.md` and `references.md` together.
3. Update links in the project’s `AGENTS.md` to the installed skill location and remove the adoption note.

Keep repository policy in `AGENTS.md`, general procedures and examples in the skill, and source citations in its references. Preserve existing project instructions when adopting or updating guidance.
