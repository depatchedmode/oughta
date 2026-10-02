# Contributing

Keep guidance concise, actionable and grounded in primary sources. Put project requirements in fragments, techniques in skills, and shared citations in domain references. Prefer improving an existing skill before splitting it into separate workflows.

See the root [AGENTS.md](AGENTS.md) for instructions on maintaining this repository. Domain fragments are reusable content, not active instructions for working on `oughta`.

## Package skills for Claude Code and Codex

Each domain with skills is published as a plugin in two marketplaces: one for Claude Code and one for Codex. Both read the same `skills/` folder, but each needs its own manifest and catalog entry. A domain packaged for only one of them cannot be installed from the other.

When you add a domain plugin, or change one's skills, metadata or version, update both sets of files:

| File | Claude Code | Codex |
| --- | --- | --- |
| Marketplace catalog entry | [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) | [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json) |
| Plugin manifest | `<domain>/.claude-plugin/plugin.json` | `<domain>/.codex-plugin/plugin.json` |

- Keep `name`, `version`, `description`, `author` and `repository` the same in both manifests, and use the domain folder name as the plugin name.
- Bump `version` in both manifests when you publish a change. Claude Code users with a Git-backed marketplace receive a new copy of a plugin only after its `version` changes.
- Each `SKILL.md` needs `name` and `description` frontmatter, which both agents use to decide when to load the skill. Write descriptions that do not name a specific agent.
- A skill may also include `agents/openai.yaml` with Codex display metadata and a default prompt. Claude Code ignores this file.
- Keep all skill dependencies inside the domain folder. The domain folder is the package root, so links that leave it break in installed copies.
- Keep the installation table in the [README](README.md#install-skills-through-codex) in sync.

Plugin packaging does not change a skill's policy or approval boundaries.

## Verify packaging

Validate the Claude Code catalog and manifests from the repository root:

```sh
claude plugin validate .
claude plugin validate <domain>
```

To check that a plugin installs and its skills load, add your checkout as a local marketplace in both agents, as described in the [README](README.md#install-skills-through-claude-code), and install the changed plugin.
