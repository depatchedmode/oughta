# Rust

What the core skill's categories look like in Rust, and which tools find them. Read it once, then use it to guide investigation. The patterns below are candidates, not automatic defects; establish their responsibility and consumers before changing them.

## Commands

Fallbacks for when the project's Makefile, Justfile, CI workflow or agent instructions don't say.

| Need | Command |
| --- | --- |
| Fast check | `cargo check --all-targets --workspace --all-features` |
| Full suite | `cargo test --workspace --all-features`; with nextest, run `cargo nextest run --workspace --all-features` and `cargo test --workspace --all-features --doc` separately so a failing lane does not skip doctests |
| Lint | `cargo clippy --all-targets --workspace --all-features` |
| Format | `cargo fmt --check` to check, `cargo fmt` to fix |
| Unused dependencies | `cargo machete`, or `cargo +nightly udeps` |
| Public surface | `cargo public-api`, or `cargo doc --no-deps` and read the index |
| Crate graph | `cargo tree`; `cargo tree -i <crate>` for who depends on it |
| Module graph | `cargo modules dependencies --package <crate>` (cargo-modules) |

A host check covers only its enabled features and target; it cannot establish that other conditional code is dead. Use the project's supported feature/target matrix. The `--all-features` commands above apply only when features are compatible; also cover supported default and minimal configurations where relevant. For native cfgs, use checks such as `cargo check --target aarch64-apple-ios` and `--target aarch64-linux-android` with the required toolchain installed. `cargo hack check --each-feature` checks individual features, not every combination. Check optional tool availability before relying on it. Run a scoped fast check after each fix when affordable, or after a coherent batch; record what compiled.

Tests depending on storage daemons, databases, network peers, or a recovery harness need those prerequisites established before restructuring the behavior they cover. `#[ignore]` does not make a relevant integration test optional. Rebuild native artifacts before running Swift or Kotlin consumers.

Skeleton:

```sh
rg -n '^\s*(pub(\([^)]*\))?\s+)?(async\s+|unsafe\s+|const\s+|extern\s+"C"\s+)*(fn|struct|enum|trait|impl|mod|type)\b' --type rust
```

## Generated and vendored code

Do not hand-edit generated output; change its source and regenerate. Configuration and lockfiles still belong in dependency and compatibility analysis even though they are not application code.

- Whatever `build.rs` writes goes to `OUT_DIR` and comes in through `include!`. It isn't in the tree, but the file that includes it depends on `build.rs`.
- Checked-in `bindgen`, `prost`, `tonic` or `cbindgen` output. Look for a "generated" header.
- The Swift and Kotlin bindings uniffi produces from `#[uniffi::export]` or a `.udl`. They copy the Rust API by design.
- Vendored or forked crates pulled in through `[patch.crates-io]` or a path dependency. They change on their upstream's schedule, not this repo's.
- `Cargo.lock` isn't code.

## Fixed boundaries

- The public API of any crate published or consumed from another repo. Semver applies. The `diff` subcommand of cargo-public-api shows what a change breaks.
- `extern "C"`, `#[no_mangle]`, `#[repr(C)]` types, `#[uniffi::export]`, `#[wasm_bindgen]`, `#[pyfunction]`, when a consumer outside the repo calls them: it won't recompile with you. For coordinated in-repo consumers, change the Rust, regenerate the bindings, rebuild the native library, and update callers in the same fix. Independently released consumers still require compatibility.
- Serde field and variant names that match a wire format or stored data. Renaming the field renames the JSON.
- Feature flags other crates enable by name.

## Hidden links

- Feature flags that only work in combination, with nothing that says so.
- Globals: `static`, `static mut`, `OnceLock`, `lazy_static`, `thread_local!`, and environment variables read with `std::env::var` or `env!` in more than one place.
- Independent copies of logic across implementations. Check whether they implement the same rule; macros may already provide one source of truth.
- The same enum or struct defined in Rust and again by hand in a binding layer.
- A `build.rs` that reads files the crate also reads.

## Needless links

- Items that are `pub` with only internal consumers after checking supported targets, downstream users, and generated bindings. Narrow visibility when no external contract requires it.
- A stable crate depending on a changing implementation. Move the contract to its owner; use a trait only when the boundary needs one.
- `Box<dyn Any>` and downcasting, which tie the caller to a concrete type the signature hides.
- A function that takes the whole config struct to read one field.
- One `Arc<Mutex<Everything>>` that every module locks.

## Surplus

- Compiler warnings: `dead_code`, `unused_imports`, `unused_variables`. Delete the code once you've checked every feature and target that could use it, rather than silencing the warning.
- Dependencies `cargo machete` reports.
- `pub use` chains that only forward.
- Newtypes that provide neither domain distinction nor an invariant, ownership, or API boundary. A methodless identifier newtype can still prevent mixing values.
- Traits with one implementation and no test double, unless the trait exists to set dependency direction between crates or to be implemented across FFI.
- A trait object where a generic or a plain function would do.

## Special cases

- `#[allow(...)]` and `#[expect(...)]`. Investigate whether the suppression reflects a necessary invariant, tooling limitation, or unresolved design problem. Grep `#\[(allow|expect)\(` and `#!\[allow\(`, and inspect lint configuration and baselines.
- `unwrap()` outside tests, `expect()` without a stated invariant, and `as` casts that can truncate.
- `.clone()` added to satisfy the borrow checker. Check whether a borrow or a move would do; `Arc` clones and clone-into-closure are idiomatic.
- `let _ = fallible()` and `_ => {}` arms that drop errors or variants.
- `unsafe` blocks: examine their safety invariants and ownership boundaries. Preserve justified unsafe code and its safety argument.
- `#[cfg(target_os = ...)]`, `#[cfg(feature = ...)]` and `#[cfg(test)]` branches in non-test code.
- `std::thread::sleep`, `tokio::time::sleep` and retry loops outside tests.
- `Rc<RefCell<T>>` or `Arc<Mutex<T>>` where a single owner would do.
- `todo!()` and `unimplemented!()`.
- `#[ignore]` on a test.

## Comments mode

Keep:

- `// SAFETY:` on every `unsafe` block. Clippy's `undocumented_unsafe_blocks` lint, a restriction lint that's off by default, enforces it when enabled.
- `///` and `//!` doc comments on public items and crates. They're the API documentation, and code blocks in them are doctests that `cargo test` runs.
- `#[doc = ...]` attributes.

`// TODO` and `// FIXME` aren't comments to remove. They're special cases to log.

## Tests mode

- A `#[cfg(test)] mod tests` that calls private functions is idiomatic. Judge it by what it asserts: a result is behavior, a sequence of internal calls is implementation.
- Doctests are tests. Removing a doc comment can remove one.
- Public API and private-function tests can cover different failure modes. Before deleting overlap, identify which boundary and regression each test protects.
- Snapshot tests with `insta` catch regressions, including `assert_debug_snapshot!` of whatever the code under test returns. The exception is a snapshot of a value the test constructs itself and never passes through the code under test: that checks the same interpretation against itself.
- `#[ignore]` is the disabled test.

For async cancellation, late results, and teardown, use controlled scheduling or explicit start/completion signals. Release blocked workers even after assertions fail. Bound waits so a regression fails rather than hanging. For critical guards, selectively break the guard, observe the expected test failure, restore it, and rerun.

## Graph and partition

Use `cargo tree` and manifest dependencies for crate relationships, then inspect module/type references and visibility. `use` statements alone miss qualified paths, macro expansion, generated code, and runtime contracts. Look for stable policy coupled to changing implementations; change frequency alone does not prove a bad dependency.

Partition subagents by crate in a workspace, and by top-level module in a single crate.

## Primary sources

Use the documentation matching the adopting project's pinned versions.

- [Cargo test](https://doc.rust-lang.org/cargo/commands/cargo-test.html): test selection, features, targets, and doctests.
- [cargo-nextest](https://nexte.st/docs/running/): separate doctest execution and runner behavior.
