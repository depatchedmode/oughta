> Adapt and merge this fragment into your project’s `AGENTS.md`; it does not govern work on `oughta`. Review layout conventions, check commands, lint configuration and toolchain compatibility. Update links to the installed skill and shared references, then remove this note.

## Rust

Rules for Rust changes in this repo. Preserve existing layout and style unless asked to migrate them; existing code does not override explicit safety or approval requirements. Report conflicts. Apply the relevant sections of the [rust-practices skill](skills/rust-practices/SKILL.md) for general Rust practices, procedures and examples. This section owns repository conventions, commands and approval requirements. Consult the relevant [references](references.md) to verify technical behavior; report conflicts with project policy rather than silently overriding it.

### Feedback loop

- While iterating, check and test the affected packages: `cargo check -p <package>`, then `cargo test -p <package>`. Include affected dependents when changing a shared API.
- Before finishing, run `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings` and `cargo test --workspace`, plus relevant feature, target or MSRV checks required by CI. Report failures and checks not run.
- Don't run `cargo update` or change `edition`, `rust-version`, `[profile.*]` or the toolchain pin unless asked.
- Don't commit a performance change without before and after numbers in your summary.

### Layout

- Virtual manifest at the root; every crate lives in `crates/<name>/`, and the folder name matches the crate name. Internal crates use `version = "0.0.0"` and `publish = false`.
- Shared versions go in `[workspace.dependencies]` and shared lints in `[workspace.lints]`. Members use `foo.workspace = true` and `[lints] workspace = true`.
- Modules are `src/foo.rs` plus `src/foo/` for children. Never create `mod.rs`.
- Organize by feature or domain, not by kind (no `models/`, `utils/`, `helpers/`). Add to an existing file unless the code is a new logical component.
- `main.rs` parses arguments and config, then calls into the library.
- Keep items private by default and use `pub(crate)` for crate internals. Reserve `pub` for the crate's API, re-exported from `lib.rs`. No glob preludes.
- Put unit tests in `#[cfg(test)] mod tests` at the bottom of the file. Integration tests go in one binary, `tests/it/main.rs` with submodules, not one file per test.

### Dependencies

- Ask before adding a dependency unless that addition is already explicitly authorized. Include the [dependency assessment](skills/rust-practices/SKILL.md#2-adding-a-dependency). An existing transitive dependency is not approval for direct use. If approval is unavailable, finish independent work and report the omission. Use `default-features = false` and enable only needed features.
- Don't add performance crates (`smallvec`, custom hashers, `compact_str`, arenas), `#[inline(always)]` or `target-cpu` flags without a benchmark or profile that shows the need. Never commit `target-cpu=native`.
- Cargo features must be additive.

### API and error conventions

- Library crates use typed error enums that are `Send + Sync + 'static`; binaries use `anyhow` at the top level.
- No `unwrap()` outside tests. Use `expect("...")` only for true invariants, with a message stating the invariant.
- Never discard a `Result` with `let _ =`; propagate or handle it, or explain intentional disregard.
- Error messages are lowercase with no trailing punctuation. Preserve sources and report each error once at its handling boundary; see the skill’s [error techniques](skills/rust-practices/SKILL.md#3-errors).
- Use full words in names. Comments explain *why*, not *what*.

### Safety and review requirements

- `unsafe_code` is denied workspace-wide. Don't add `unsafe`, `unsafe impl Send`/`Sync` or FFI without explicit human approval. If approval is unavailable, finish independent work and report the omission.
- Every unsafe block requires a `// SAFETY:` comment; every `unsafe fn` requires a `# Safety` doc section. Follow the skill’s [proof and Miri procedure](skills/rust-practices/SKILL.md#unsafe).
- Flag atomic and `Send`/`Sync` changes for human review. Lock-free data structures require a loom test and human review.

### Lints

During adoption, configure the root `Cargo.toml` as below, with member `[lints] workspace = true`, and set `allow-unwrap-in-tests = true` in `clippy.toml`. Verify toolchain support; `#[expect]` requires Rust 1.81 or newer. After setup, the actual configuration is authoritative.

```toml
[workspace.lints.rust]
unsafe_code = "deny"

[workspace.lints.clippy]
dbg_macro = "warn"
todo = "warn"
unwrap_used = "warn"
undocumented_unsafe_blocks = "warn"
allow_attributes = "warn"
allow_attributes_without_reason = "warn"
let_underscore_must_use = "warn"
mod_module_files = "warn"
```

These lints support the policy; the Clippy command above promotes warnings to errors. They are not exhaustive enforcement: for example, `allow_attributes` does not reject inner `#![allow(...)]` attributes.

Suppress a lint only with `#[expect(lint_name, reason = "...")]`, never with a bare `#[allow]`.

### Before handing back

- [ ] Placement and visibility match the intended scope; no unrelated API expansion.
- [ ] Errors retain context and sources; panic assumptions and intentional error discards are explained.
- [ ] Async changes have been checked against the skill’s [Tokio guidance](skills/rust-practices/SKILL.md#async-tokio).
- [ ] Required approvals and reviews are satisfied, or blocked work is listed. Lint exceptions have reasons.
- [ ] Report checks run, failures, checks not run, and before/after measurements for performance changes.

### Changing these rules

Keep this section focused on recurring, non-obvious mistakes and actionable repository policy. Put architecture in `ARCHITECTURE.md` and enforce mechanical rules with lints where possible. Propose rule changes in a PR description rather than editing them during feature work.
