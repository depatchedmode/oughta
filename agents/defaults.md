# Agent runtime defaults

Give each agent the capabilities its task needs. Keep project instructions, relevant skills, and the means to verify the work. Add external tools when the task requires their data or actions. Choose write access and approval settings independently of tool selection.

## Codex subagents

Make a lean setup the default for bounded repository work such as code exploration, diff review, implementation, and local tests. Give reviewers read-only access where the launcher supports it. Give implementers workspace write access when their assignment calls for edits. Keep MCP servers, connected apps, browser and desktop automation, and image generation out of the setup when the work can be completed locally. Keep applicable skills, including plugin-provided skills when the task depends on them. Assign tasks that need a browser, device, design file, or live service to an agent with the corresponding capability.

| Setting from the dry-mode example | Recommended default |
| --- | --- |
| Apps, browser use (including external and in-app), computer use, image generation | Off for local workers when the launcher supports it. Enable the capability a specialist needs. |
| Plugins, remote plugins, plugin sharing | Skip for local workers with no plugin dependency. Disabling plugins can also remove skills they provide. |
| MCP servers | Enable only the servers the job needs in the launching session. Native Codex subagents inherit that session’s MCP configuration. |
| Skill search and MCP dependency installation | Keep relevant skills discoverable. Skip automatic MCP dependency installation for workers with known prerequisites. |
| Model, sandbox, and Git repository check | Choose the model and sandbox for the assignment. Use `--skip-git-repo-check` only for intentional runs outside Git repositories. |

**Native subagents.** Use named custom agents for recurring local roles. Their TOML files support reductions such as `features.apps = false` and `features.plugins = false`. A custom agent inherits its parent’s MCP servers, sandbox, and approval policy. If a parent needs a connector and a worker needs a smaller tool set, use a separately configured session for that worker where the orchestrator supports it. [Codex custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents)

For user-level defaults, copy the [explorer](codex/explorer.toml) and [worker](codex/worker.toml) definitions into `~/.codex/agents/`. They take precedence over the built-in roles with those names. Merge the settings into existing definitions if you already customize either role. Both turn off apps. The explorer also turns off plugins, and the worker keeps them available for skills used during implementation. Use the general-purpose role or a specialist when the task requires an integration. [Codex custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents)

**Standalone `codex exec` workers.** Apply the chosen feature and server settings to that launch. With Codex CLI 0.170.0, `-c 'mcp_servers={}'` left existing servers enabled, and `plugin_discovery_prefetch` was already removed. Disable configured servers individually with `-c 'mcp_servers.<id>.enabled=false'` and check `codex mcp list --json` with the same config overrides. Check feature names and effective values with `codex features list` and the same feature overrides. [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)

For recurring local-only jobs, save those overrides in `~/.codex/repo-worker.config.toml` and launch with `codex exec --profile repo-worker`. Put feature overrides under `[features]`. Each disabled server entry in the profile needs its `command` or `url` alongside `enabled = false` on CLI 0.170.0. Use `codex --profile repo-worker mcp list --json` to check the effective server list, including after installing or enabling a new server. [Codex profiles](https://learn.chatgpt.com/docs/config-file/config-advanced#profiles)

## General-purpose and interactive agents

Keep authorized tools available on demand. A person can switch from a code question to a GitHub issue, a Figma design, or a browser check in the same session. Pass the relevant context and name required tools when delegating. Keep pure local jobs lean, including jobs run directly by a top-level agent.

Dry mode’s speedup is anecdotal. Before expanding the rollout, compare standard and lean runs on the same model, reasoning effort, and tasks. Track elapsed time to a verified result, token use, and missed checks or retries. Include cold and warm runs and a task that needs an integration to exercise the exception.

## Claude Code

Our user-level setup enables experimental Code Mode via `env.CLAUDE_CODE_EXPERIMENTAL_CODE_MODE = "1"` in `~/.claude/settings.json`. This is a Claude Code tool-use setting. Tool availability and permissions are configured separately. The setting was present in the local configuration for Claude Code 2.1.328 and is absent from Anthropic’s published environment-variable reference. [Claude Code environment settings](https://code.claude.com/docs/en/env-vars#set-variables-in-settings-files)
