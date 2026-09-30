# Rust practices: reference documentation

Primary sources supporting the [Rust guidance fragment](AGENTS.fragment.md) and [rust-practices skill](skills/rust-practices/SKILL.md). Consult the relevant topic rather than reading the entire catalog. Layout and stricter lint choices are house conventions, not language requirements; use versioned documentation matching the project where available.

## Official Rust documentation

- **[Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)**: naming (`as_`/`to_`/`into_`), common trait implementations, `From` over `Into`, future-proofing. The checklist is the fastest way to review a public API.
- **[`std::error::Error` docs](https://doc.rust-lang.org/std/error/trait.Error.html)**: the source of two error rules in the AGENTS section. Error messages are lowercase without trailing punctuation, and an error either exposes its source via `source()` or includes the source's text in its message, never both.
- **[The Cargo Book: Workspaces](https://doc.rust-lang.org/cargo/reference/workspaces.html)**: virtual manifests, `[workspace.dependencies]`, `[workspace.lints]` and inheritance.
- **[The Cargo Book: Features](https://doc.rust-lang.org/cargo/reference/features.html)**: why features must be additive, and how unification works.
- **[Rust 2024 Edition Guide](https://doc.rust-lang.org/edition-guide/rust-2024/index.html)**: `unsafe extern`, `#[unsafe(no_mangle)]`, `static_mut_refs`, the `if let` scope changes and resolver 3.
- **[The Rust Style Guide](https://doc.rust-lang.org/style-guide/)**: what `rustfmt` enforces. Useful mainly when formatting disagrees with you.
- **[Clippy lint list](https://rust-lang.github.io/rust-clippy/stable/index.html)**: lint behavior, configuration and version requirements. Restriction lints are opt-in; configured warnings become errors under `-D warnings`. Check each lint’s limitations.
- **[The Rustonomicon](https://doc.rust-lang.org/nomicon/)**: consult relevant chapters before unsafe, `Send`/`Sync` or FFI work.
- **[Unsafe Code Guidelines](https://rust-lang.github.io/unsafe-code-guidelines/)**: the working group's notes on layout, validity and aliasing.
- **[Miri](https://github.com/rust-lang/miri)**: the README states plainly what Miri can and can't detect (executed paths only, limited FFI).

- **[Cargo test](https://doc.rust-lang.org/cargo/commands/cargo-test.html)**: test targets and executable linking.
- **[Unsafe contracts](https://doc.rust-lang.org/reference/unsafe-keyword.html)**: caller obligations and unsafe blocks.

## Code organization and large codebases (matklad)

- **[Large Rust Workspaces](https://matklad.github.io/2021/08/22/large-rust-workspaces.html)**: the flat `crates/` layout, a virtual root manifest, folder names that match crate names, and `0.0.0` versions for internal crates. The basis for the Layout rules.
- **[Delete Cargo Integration Tests](https://matklad.github.io/2021/02/27/delete-cargo-integration-tests.html)**: why to use one `tests/it/` binary instead of one per file. Applying it to Cargo cut test compile time 3×.
- **[Fast Rust Builds](https://matklad.github.io/2021/09/04/fast-rust-builds.html)**: crate graphs shaped for parallelism, thin generic interfaces, and auditing `Cargo.lock`. Build speed is feedback-loop speed for agents.
- **[One Hundred Thousand Lines of Rust](https://matklad.github.io/2021/09/05/Rust100k.html)**: index to the series, including [ARCHITECTURE.md](https://matklad.github.io/2021/02/06/ARCHITECTURE.md.html), which is also the best single thing to hand an agent.
- **[rust-analyzer architecture](https://github.com/rust-lang/rust-analyzer/blob/master/docs/book/src/contributing/architecture.md)** and **[style guide](https://github.com/rust-lang/rust-analyzer/blob/master/docs/book/src/contributing/style.md)**: a working example of both documents in a large codebase.
- **[cargo-xtask](https://github.com/matklad/cargo-xtask)**: writing project automation in Rust instead of shell scripts.

## Error handling and panics

- **[Using unwrap() in Rust is Okay](https://burntsushi.net/unwrap/)** by Andrew Gallant (BurntSushi): panics are for bugs, not errors, and `unwrap` and `expect` are equally fine for asserting invariants. The rules take the "panics are for bugs" half and go stricter on the other half: `expect` with a written invariant, `unwrap` only in tests, enforced by `clippy::unwrap_used`. That extra strictness is a house choice, not his position.
- **[thiserror](https://github.com/dtolnay/thiserror)** and **[anyhow](https://github.com/dtolnay/anyhow)** READMEs by David Tolnay: the library-versus-application split, in the author's own words. `anyhow`'s alternate formatting (`{err:#}`) prints the whole chain on one line, which is what the "don't repeat the source's text" rule relies on.
- **[`tracing` field syntax](https://docs.rs/tracing/latest/tracing/#recording-fields)** and **[visitors](https://docs.rs/tracing/latest/tracing/field/trait.Visit.html)**: typed error fields expose errors to the subscriber; source-chain formatting depends on its implementation. Verify the configured formatter.

## Async and Tokio (Alice Ryhl, Carl Lerche and the Tokio team)

- **[Tokio tutorial](https://tokio.rs/tokio/tutorial)**, especially **[Shared state](https://tokio.rs/tokio/tutorial/shared-state)**: when to use `std::sync::Mutex` in async code, and why.
- **[`tokio::sync::Mutex` docs](https://docs.rs/tokio/latest/tokio/sync/struct.Mutex.html)**: "Contrary to popular belief, it is ok and often preferred to use the ordinary Mutex from the standard library in asynchronous code."
- **[Actors with Tokio](https://ryhl.io/blog/actors-with-tokio/)** by Alice Ryhl: the handle-plus-task actor pattern, and how actor cycles can deadlock.
- **[Async: What is blocking?](https://ryhl.io/blog/async-what-is-blocking/)** by Alice Ryhl: the source of the "10 to 100 microseconds between each `.await`" rule of thumb.
- **[`tokio::select!` cancellation safety](https://docs.rs/tokio/latest/tokio/macro.select.html#cancellation-safety)**: which Tokio operations are cancel-safe. Check a method's own "Cancel safety" doc section before putting it in a `select!` loop.
- **[`tokio::fs` module docs](https://docs.rs/tokio/latest/tokio/fs/index.html)**: explains that `tokio::fs` runs on `spawn_blocking`, and recommends batching file operations.
- **[`spawn_blocking`](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html)**: bound parallel CPU computations and account for non-abortable work. **[`spawn`](https://docs.rs/tokio/latest/tokio/task/fn.spawn.html)** documents the `Send` bounds.
- **[TaskTracker](https://docs.rs/tokio-util/latest/tokio_util/task/task_tracker/struct.TaskTracker.html)** and **[JoinSet](https://docs.rs/tokio/latest/tokio/task/struct.JoinSet.html)**: lifecycle tracking versus collecting task outcomes.
- **[Graceful Shutdown](https://tokio.rs/tokio/topics/shutdown)**: `CancellationToken` and `TaskTracker` from tokio-util.
- **[Inventing the Service trait](https://tokio.rs/blog/2021-05-14-inventing-the-service-trait)**: the reasoning behind Tower's middleware model, useful before designing any request/response abstraction.

## Unsafe, memory model and language semantics (Ralf Jung, Niko Matsakis, Mara Bos)

- **[Two Kinds of Invariants: Safety and Validity](https://www.ralfj.de/blog/2018/08/22/two-kinds-of-invariants.html)** by Ralf Jung: the vocabulary for writing a correct `// SAFETY:` comment.
- **[The Scope of Unsafe](https://www.ralfj.de/blog/2016/01/09/the-scope-of-unsafe.html)** by Ralf Jung: why an `unsafe` block's soundness depends on the whole module's privacy boundary, not just the block.
- **[Ralf Jung's blog](https://www.ralfj.de/blog/)**: ongoing work on the aliasing models (Stacked and Tree Borrows) that Miri checks.
- **[Rust Atomics and Locks](https://marabos.nl/atomics/)** by Mara Bos: chapters 2–3 explain atomic operations and memory ordering. Use the synchronization argument to choose an ordering; release/acquire is not a universal default.
- **[Baby Steps](https://smallcultfollowing.com/babysteps/)** by Niko Matsakis: language design direction, including async closures, dyn-compatible async traits and the ownership model.
- **[Async methods and return-position `impl Trait`](https://blog.rust-lang.org/2023/12/21/async-fn-rpit-in-traits/)**: native async traits, explicit `Send` futures and [trait-variant](https://github.com/rust-lang/impl-trait-utils). [dynosaur](https://github.com/spastorino/dynosaur) and [async-trait](https://github.com/dtolnay/async-trait) provide dynamic-dispatch approaches. Check support against the project’s toolchain.

## Performance

- **[The Rust Performance Book](https://nnethercote.github.io/perf-book/)** by Nicholas Nethercote: measure first, then apply specific techniques. The first stop before any `mem-*` or `opt-*` change.

## Further reading

Background material; not required for routine changes.

### Books

- **[Rust for Rustaceans](https://rust-for-rustaceans.com/)** by Jon Gjengset: API design, crate boundaries, unsafe code and testing, for intermediate-to-advanced Rust.
- **[Effective Rust](https://effective-rust.com/)** by David Drysdale: free online, 35 short items in the spirit of Effective C++. Its dependency and tooling chapters are relevant here.

### Agentic practice

- **[Agentic Coding Recommendations](https://lucumr.pocoo.org/2025/6/12/agentic-coding/)** by Armin Ronacher: fast feedback, readable diagnostics and simple code.
- **[mitsuhiko/agent-stuff](https://github.com/mitsuhiko/agent-stuff)**: Armin's own agent extensions and commands. It isn't Rust-specific, but it shows how he sets up his agents in practice.
- **[Zed’s agent rules](https://github.com/zed-industries/zed/blob/main/.rules)**: source of several house preferences and the bar for adding rules: recurring, non-obvious and actionable.
- **[AGENTS.md](https://agents.md/)**: the cross-tool convention for repository agent instructions.
