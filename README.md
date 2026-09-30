# oughta

How we oughta do things. Reusable guidance and skills for coding agents.

## Organization

Content is grouped by domain: a language, workflow, or discipline such as `rust`, `git`, `devops`, `ux`, `graphic-design`, or `writing`. Add domains when they have content.

```text
rust/
├── AGENTS.fragment.md
├── references.md
└── skills/
    └── rust-practices/
        └── SKILL.md
```

- **`AGENTS.fragment.md`** — project rules to adapt and merge into another repository’s `AGENTS.md`.
- **`skills/`** — reusable procedures and examples, with one folder per skill.
- **`references.md`** — shared primary sources and further reading. References used by only one skill can live with that skill.

## Available guidance

**Rust:** [project rules](rust/AGENTS.fragment.md), [practices skill](rust/skills/rust-practices/SKILL.md), and [references](rust/references.md).

## Use in a project

1. Adapt the domain’s fragment to the target project’s conventions, checks and approval policies, then merge it into the existing `AGENTS.md`.
2. Copy the desired skill folder into the project’s supported skill location.
3. Copy any shared references it uses. Update relative links in the merged guidance, skill and references to their new locations; the skill folder alone may not include everything it links to.
4. Verify those links and remove the fragment’s adoption note.

Preserve the target project’s existing instructions when adopting or updating guidance.

## Contributing

Keep guidance concise, actionable and grounded in primary sources. Put project requirements in fragments, techniques in skills, and shared citations in domain references. Prefer improving an existing skill before splitting it into separate workflows.

See the root [AGENTS.md](AGENTS.md) for instructions on maintaining this repository. Domain fragments are reusable content, not active instructions for working on `oughta`.
