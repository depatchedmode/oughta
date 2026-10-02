# oughta

How we oughta do things. Reusable guidance and skills for coding agents.

Favor local-first systems and user-owned data, with peer-to-peer communication available wherever feasible and practical. Turn that preference into explicit design decisions and verifiable behavior, while respecting each project’s requirements.

## Organization

Content is grouped by domain: a language, workflow, or discipline such as `rust`, `git`, `devops`, `ux`, `graphic-design`, or `writing`. Add domains when they have content.

```text
rust/
├── AGENTS.fragment.md
├── references.md
├── .codex-plugin/
│   └── plugin.json
└── skills/
    └── rust-practices/
        └── SKILL.md
```

- **`AGENTS.fragment.md`** — project rules to adapt and merge into another repository’s `AGENTS.md`.
- **`skills/`** — reusable procedures and examples, with one folder per skill.
- **`references.md`** — shared primary sources and further reading. References used by only one skill can live with that skill.
- **`.codex-plugin/plugin.json`** — plugin metadata for installing the domain's skills and supporting files through Codex.

The manifests use Codex's compatibility format, verified with Codex CLI 0.131.0.

The repository's [marketplace catalog](.agents/plugins/marketplace.json) exposes each domain with skills as a separate plugin. The domain folder is the package root, so shared references and fragments travel with its skills and their relative links remain valid.

## Available guidance

**Local-first:** [project rules](local-first/AGENTS.fragment.md), [design skill](local-first/skills/local-first-design/SKILL.md), and [references](local-first/references.md). Use alongside language-specific guidance when designing storage, synchronization, or service dependencies.

**Rust:** [project rules](rust/AGENTS.fragment.md), [practices skill](rust/skills/rust-practices/SKILL.md), and [references](rust/references.md).

**Git:** [commit skill](git/skills/commit/SKILL.md) for preparing logical, atomic commits from uncommitted work, and [make-it-so skill](git/skills/make-it-so/SKILL.md) for autonomous delivery through acceptance, repeated review, behavior-preserving cleanup, and an opened PR. Its [workflow graph](git/skills/make-it-so/references/workflow.md) specifies the process; its [run record](git/skills/make-it-so/references/run-record.md) supports interruption and resume. Invocation authorizes ordinary issue implementation and PR delivery within repository permissions; merging, deployment, and filing deferred issues remain separate actions.

**Code:** [elevate skill](code/skills/elevate/SKILL.md) for focused improvements to a selected worktree or branch diff.

## Install skills through Codex

Add the marketplace from GitHub after the catalog and manifests have been committed and pushed to the ref you want to use:

```sh
codex plugin marketplace add depatchedmode/oughta
codex plugin list --marketplace oughta
```

For a specific branch or tag, add `--ref <ref>` to the marketplace command. To use an existing checkout, including uncommitted packaging changes, add its repository root instead:

```sh
codex plugin marketplace add /absolute/path/to/oughta
```

Install the domains you want:

| Plugin | Skill |
| --- | --- |
| `code@oughta` | `elevate` |
| `git@oughta` | `commit`, `make-it-so` |
| `local-first@oughta` | `local-first-design` |
| `rust@oughta` | `rust-practices` |

For example:

```sh
codex plugin add git@oughta
```

In the Codex app, add `depatchedmode/oughta` as a marketplace source, then select and install the desired domain plugins. For local testing, use the checkout's absolute path as the source. Start a new chat after installation to use the skills.

The catalog makes every plugin available for explicit installation. These packages contain skills and supporting guidance; they have no connected services or authentication setup. Installing a plugin does not merge its `AGENTS.fragment.md` into a project's instructions. Adopt those rules explicitly using the procedure below.

For `git:make-it-so`, install `code@oughta` for review and its distinct simplification/elevation passes; add `local-first@oughta` or `rust@oughta` when the change calls for their guidance. The skill routes conditionally by stable identifiers and links to repo-owned sources if a companion is unavailable. Cross-domain skills are not bundled or automatically installed. Installing skills alone does not grant issue, push, or PR authorization; invoke the workflow for the intended repository and scope.

For Git-backed sources, refresh the catalog with `codex plugin marketplace upgrade oughta` after publishing changes. Follow the [official Codex plugin packaging documentation](https://developers.openai.com/plugins/build/plugins) for marketplace and installation behavior.

## Use in a project

1. Adapt the domain’s fragment to the target project’s conventions, checks and approval policies, then merge it into the existing `AGENTS.md`.
2. Copy the desired skill folder into the project’s supported skill location.
3. Copy any shared references it uses. Update relative links in the merged guidance, skill and references to their new locations; the skill folder alone may not include everything it links to.
4. Verify those links and remove the fragment’s adoption note.

For copied `make-it-so` guidance, include `git/skills/commit` alongside it and provide the conditionally used companion skills listed above through supported skill locations or accessible oughta sources. Adapt identifiers and links to the adopting layout; retain the gate and approval boundaries.

Preserve the target project’s existing instructions when adopting or updating guidance.

## Contributing

Keep guidance concise, actionable and grounded in primary sources. Put project requirements in fragments, techniques in skills, and shared citations in domain references. Prefer improving an existing skill before splitting it into separate workflows.

When adding or changing a domain plugin, update its `.codex-plugin/plugin.json` version and metadata, keep bundled file dependencies inside the domain folder, and add or update its entry in the marketplace catalog when registration changes. Cross-domain skill routing must use stable identifiers and accessible repo-owned sources, with companion installation requirements documented; relative file links must not escape the installed domain. Keep the installation table above in sync. Plugin packaging does not change a skill's policy or approval boundaries.

See the root [AGENTS.md](AGENTS.md) for instructions on maintaining this repository. Domain fragments are reusable content, not active instructions for working on `oughta`.
