# oughta

How we oughta build things. Skills, conventions, and guidance for coding agents.

## Organization

Top-level folders group content by **domain**: a language, workflow, or discipline such as `rust`, `git`, `devops`, `ux`, `graphic-design`, or `writing`. Add a domain when there is content for it.

Each domain can contain project guidance and reusable skills. Keep a skill’s supporting references alongside its `SKILL.md`. Start with the files the domain needs rather than requiring the same structure everywhere.

```text
rust/
├── AGENTS.md
└── skills/
    └── rust-practices/
        ├── SKILL.md
        └── references.md
```

## What’s here

- [Rust project guidance](rust/AGENTS.md): an adoption template for repository conventions, check commands, and approval boundaries.
- [Rust practices](rust/skills/rust-practices/SKILL.md): one reusable skill covering Rust techniques, decision procedures, and examples.
- [Rust references](rust/skills/rust-practices/references.md): primary sources and further reading.

The Rust template describes conventions to adopt in a Rust project, not instructions to turn this repository into a Rust workspace.

## Use in a project

1. Merge the relevant domain’s guidance into the project’s existing `AGENTS.md`. Adapt its conventions, commands, lint configuration, and approval policies before adoption.
2. Copy the entire skill folder—for example, `rust/skills/rust-practices/`—into the project’s supported skill location, keeping its supporting files together.
3. Update links in the project’s `AGENTS.md` to the installed skill location and remove the adoption note.

Keep repository policy in `AGENTS.md`, general procedures and examples in the skill, and source citations in its references. Preserve existing project instructions when adopting or updating guidance.
