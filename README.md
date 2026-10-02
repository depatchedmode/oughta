# oughta

How we oughta do things. Reusable guidance and skills for coding agents.

Favor local-first systems and user-owned data, with peer-to-peer communication available wherever feasible and practical. Turn that preference into explicit design decisions and verifiable behavior, while respecting each project’s requirements.

## Organization

Content is grouped by domain: a language, workflow, or discipline such as `rust`, `git`, `devops`, `ux`, `graphic-design`, or `writing`. Add domains when they have content.

```text
rust/
├── AGENTS.fragment.md
├── references.md
├── .claude-plugin/
│   └── plugin.json
├── .codex-plugin/
│   └── plugin.json
└── skills/
    └── rust-practices/
        └── SKILL.md
```

- **`AGENTS.fragment.md`** — project rules to adapt and merge into another repository’s `AGENTS.md`.
- **`skills/`** — reusable procedures and examples, with one folder per skill.
- **`references.md`** — shared primary sources and further reading. References used by only one skill can live with that skill.
- **`.claude-plugin/plugin.json`** and **`.codex-plugin/plugin.json`** — plugin metadata for installing the domain's skills and supporting files through Claude Code or Codex.

The Codex manifests use Codex's compatibility format, verified with Codex CLI 0.131.0. The Claude Code manifests were verified with `claude plugin validate` and a local install using Claude Code 2.1.283.

The repository's marketplace catalogs for [Claude Code](.claude-plugin/marketplace.json) and [Codex](.agents/plugins/marketplace.json) expose each domain with skills as a separate plugin. The domain folder is the package root, so shared references and fragments travel with its skills and their relative links remain valid.

## Available guidance

**Local-first:** [project rules](local-first/AGENTS.fragment.md), [design skill](local-first/skills/local-first-design/SKILL.md), and [references](local-first/references.md). Use alongside language-specific guidance when designing storage, synchronization, or service dependencies.

**Rust:** [project rules](rust/AGENTS.fragment.md), [practices skill](rust/skills/rust-practices/SKILL.md), and [references](rust/references.md).

**Git:** [commit skill](git/skills/commit/SKILL.md) for preparing logical, atomic commits from uncommitted work.

**Code:** [elevate skill](code/skills/elevate/SKILL.md) for focused improvements to a selected worktree or branch diff.

## Install skills through Claude Code

Add the marketplace from GitHub after the catalog and manifests have been committed and pushed to the ref you want to use:

```sh
claude plugin marketplace add depatchedmode/oughta
```

For a specific branch or tag, append `#<ref>`, as in `depatchedmode/oughta#main`. To use an existing checkout, including uncommitted packaging changes, add its repository root instead:

```sh
claude plugin marketplace add /absolute/path/to/oughta
```

Install the domains you want using the plugin names in the [table below](#install-skills-through-codex), for example:

```sh
claude plugin install git@oughta
```

Inside a Claude Code session, `/plugin marketplace add depatchedmode/oughta` and `/plugin install git@oughta` do the same. Start a new session, or run `/reload-plugins`, to load the skills. Skills from a plugin are namespaced by plugin, such as `/git:commit`.

For Git-backed sources, users receive a published change only after its plugin's `version` changes; they then run `claude plugin marketplace update oughta` and `claude plugin update <plugin>@oughta`. A marketplace added from a local checkout loads its plugins in place, so edits apply at the next session. Follow the official Claude Code documentation for [creating](https://code.claude.com/docs/en/plugin-marketplaces) and [hosting](https://code.claude.com/docs/en/plugins/host-marketplace) marketplaces.

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
| `git@oughta` | `commit` |
| `local-first@oughta` | `local-first-design` |
| `rust@oughta` | `rust-practices` |

For example:

```sh
codex plugin add git@oughta
```

In the Codex app, add `depatchedmode/oughta` as a marketplace source, then select and install the desired domain plugins. For local testing, use the checkout's absolute path as the source. Start a new chat after installation to use the skills.

The catalog makes every plugin available for explicit installation. These packages contain skills and supporting guidance; they have no connected services or authentication setup. Installing a plugin does not merge its `AGENTS.fragment.md` into a project's instructions. Adopt those rules explicitly using the procedure below.

For Git-backed sources, refresh the catalog with `codex plugin marketplace upgrade oughta` after publishing changes. Follow the [official Codex plugin packaging documentation](https://developers.openai.com/plugins/build/plugins) for marketplace and installation behavior.

## Use in a project

1. Adapt the domain’s fragment to the target project’s conventions, checks and approval policies, then merge it into the existing `AGENTS.md`.
2. Copy the desired skill folder into the project’s supported skill location.
3. Copy any shared references it uses. Update relative links in the merged guidance, skill and references to their new locations; the skill folder alone may not include everything it links to.
4. Verify those links and remove the fragment’s adoption note.

Preserve the target project’s existing instructions when adopting or updating guidance.

## Contributing

Keep guidance concise, actionable and grounded in primary sources. Put project requirements in fragments, techniques in skills, and shared citations in domain references. Prefer improving an existing skill before splitting it into separate workflows.

When adding or changing a domain plugin, update the version and metadata in both its `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`, keep all skill dependencies inside the domain folder, and add or update its entry in both marketplace catalogs. Keep the installation table above in sync. Plugin packaging does not change a skill's policy or approval boundaries.

See the root [AGENTS.md](AGENTS.md) for instructions on maintaining this repository. Domain fragments are reusable content, not active instructions for working on `oughta`.
