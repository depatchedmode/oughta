# Local-first project rules

> Adoption: adapt these defaults to the project’s requirements, then merge them into its `AGENTS.md`. Copy [shared references](references.md) and update links. Remove this note after adoption.

- Favor local-first behavior and user-owned data. Identify which core operations must work offline, including after restarting the application, and make online-only requirements explicit.
- Persist local changes before reporting them as saved. Distinguish local persistence from synchronization and remote acknowledgement; define the durability promised by each state.
- Offer peer-to-peer communication whenever technically feasible and practical for the intended users. When designing communication or synchronization, assess direct peer operation alongside other transports. If excluded, explain concrete constraints such as platform restrictions, reachability, cost or operational complexity. P2P need not be the default or exclusive transport.
- For each required remote service, document its purpose, what stops working without it, and whether users can replace it. Preserve promised local functionality during outages.
- Define concurrent-edit and conflict behavior before implementing synchronization. Do not silently discard edits to simplify merging.
- Provide usable data export, backup and recovery appropriate to the product. Make dependencies and limits explicit, including what can be recovered without the original service.
- Respect existing architecture and scope. Propose migrations separately; this guidance does not authorize a rewrite or require a particular database, protocol or conflict-resolution library.

Use the [local-first design skill](skills/local-first-design/SKILL.md) for architecture work. Consult [references](references.md) selectively to resolve technical questions; they do not override project policy.
