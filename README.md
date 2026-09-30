# oughta

How we oughta build things. Skills, conventions, and guidance for coding agents.

## Organization

Top-level folders group content by **domain**: a language, workflow, or discipline such as `rust`, `git`, `devops`, `ux`, `graphic-design`, or `writing`. Add a domain when there is content for it.

Each domain can contain project guidance and reusable skills. Shared references live at the domain level; material used by only one skill can stay alongside its `SKILL.md`. Start with the files the domain needs rather than requiring the same structure everywhere.

```text
rust/
├── AGENTS.fragment.md
├── references.md
└── skills/
    └── rust-practices/
        └── SKILL.md
```

## What’s here

- [Rust project guidance](rust/AGENTS.fragment.md): a fragment to adapt and merge into a project’s `AGENTS.md` for repository conventions, check commands, and approval boundaries.
- [Rust practices](rust/skills/rust-practices/SKILL.md): one reusable skill covering Rust techniques, decision procedures, and examples.
- [Rust references](rust/references.md): primary sources and further reading.

Files named `AGENTS.fragment.md` contain reusable instructions for other projects. Reserve `AGENTS.md` for instructions that govern work on this repository itself.

## Use in a project

1. Merge the relevant domain’s `AGENTS.fragment.md` into the project’s existing `AGENTS.md`. Adapt its conventions, commands, lint configuration, and approval policies before adoption.
2. Copy the entire skill folder—for example, `rust/skills/rust-practices/`—into the project’s supported skill location, keeping its supporting files together.
3. Copy the domain’s shared `references.md` to a suitable documentation location in the project. Update links in the installed skill, references and merged guidance to their new locations; a skill folder alone does not include the shared references.
4. Verify the local links and remove the fragment’s adoption note.

Keep repository policy in `AGENTS.md`, general procedures and examples in the skill, and shared source citations in the domain’s references. Preserve existing project instructions when adopting or updating guidance.
