---
name: rust-practices
description: Apply repository Rust conventions when writing, reviewing or restructuring Rust code, adding dependencies, or investigating performance.
---

# Rust practices

General Rust practices, decision procedures and examples. Read the project’s `AGENTS.md` for authoritative conventions, check commands and approval requirements, then use the relevant sections below. Consult [reference documentation](../../references.md) when you need supporting detail.

## 0. Orient before editing

1. Read `ARCHITECTURE.md` if present, the root `Cargo.toml`, toolchain pin and relevant CI configuration. Find the owning package and applicable features, targets and MSRV.
2. Get a baseline with the project's check and test commands for that crate. If the baseline is already red, report it rather than fixing unrelated failures.

## 1. Where code goes

**Choose the location in this order:**

1. Is there an existing module for this feature or domain? Put it there.
2. Is it a new logical component inside one crate? Add a module using the repository’s layout convention.
3. Does it need its own compile unit, have a distinct dependency set, or get used by several crates? Only then create a new crate.

**Visibility.** Before expanding a public API, check whether the caller belongs in the same module or crate. Public items inside private modules need not be externally reachable.

**Creating a new crate.** This example applies the repository’s workspace conventions and assumes the root defines inherited package metadata and dependencies:

```toml
[package]
name = "billing"
version = "0.0.0"
edition.workspace = true
rust-version.workspace = true
publish = false

[dependencies]
serde.workspace = true

[lints]
workspace = true
```

Then:

- Add it to the workspace `members` if the root doesn't glob `crates/*`.
- Keep the crate graph wide rather than deep. A chain of crates compiles serially, while siblings compile in parallel.
- Keep generic public functions thin: a small generic wrapper that converts its arguments and calls a non-generic inner function, so the body isn't recompiled for every type.

**One integration-test binary.** Multiple top-level integration-test files produce separately linked binaries. `tests/it/main.rs` with submodules consolidates them. Unit tests can access private items, but still compile and link a test executable.

## 2. Adding a dependency

Prepare the assessment required by the project’s dependency policy: explain what the dependency replaces, why `std` is insufficient, and the expected feature and build cost.

1. **Can `std` do it at the project’s MSRV?** Check API stabilization versions; for example, `slice::as_chunks` requires Rust 1.88.
2. **Is it already in the tree?** Use `cargo tree -i <package>` for an existing dependency. Reuse may avoid another version, but new features or targets can add build cost.
3. **What features are needed?** Inspect feature definitions and `cargo tree -e features` to check what other dependencies enable; feature unification can re-enable defaults.
4. **Is it suitable?** Check maintenance, ownership, MSRV, license and dependency footprint. A mature crate need not release frequently to be healthy.

If the dependency is only for performance, stop and go to section 6 first.

## 3. Errors

**A library error variant carries the context a caller needs, and the underlying error goes in `source`, not in the message:**

```rust
use std::path::{Path, PathBuf};

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("failed to read config file {path}")]
    Read {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("missing required key `{0}`")]
    MissingKey(&'static str),
}

pub fn load(path: &Path) -> Result<String, ConfigError> {
    let text = std::fs::read_to_string(path).map_err(|source| ConfigError::Read {
        path: path.to_owned(),
        source,
    })?;
    if !text.contains("name") {
        return Err(ConfigError::MissingKey("name"));
    }
    Ok(text)
}
```

- **Source chains.** Keep causes in `source()` rather than duplicating their text in `Display`. `{err:#}` prints an anyhow chain. A typed `tracing` field records the error, but source formatting depends on the subscriber; verify the actual output format, including JSON if used.
- **Application context.** Use anyhow’s `.context(...)` or `.with_context(...)` to name the operation being attempted while retaining its underlying error.
- **Error bounds.** `Send + Sync + 'static` permits conversion into `anyhow::Error`. `tokio::spawn` requires its future and output to be `Send + 'static`, not `Sync`.
- `thiserror` derives `Display` and `Error::source`; implement them by hand if the project avoids it.
- **Panic messages.** For example, `expect("config already validated by Config::parse")` identifies the assumption to investigate when a panic occurs.
- **Intentional disregard.** If a failure is irrelevant at this boundary, `.ok();` with a comment records that decision; the actor example below demonstrates a caller that stopped waiting.
- **Untrusted input.** Use `get`, checked arithmetic and explicit parse errors where indexing, slicing or arithmetic could panic on invalid input.

## 4. Types and APIs

- **Parse at the boundary.** Use newtypes for IDs and units, and convert raw input into types that cannot represent invalid values, so downstream code need not re-check them:

  ```rust
  #[derive(Debug, Clone, Copy, PartialEq, Eq)]
  pub struct Port(u16);

  #[derive(Debug, thiserror::Error)]
  #[error("port must be between 1024 and 65535, got {0}")]
  pub struct InvalidPort(u32);

  impl TryFrom<u32> for Port {
      type Error = InvalidPort;
      fn try_from(value: u32) -> Result<Self, Self::Error> {
          match u16::try_from(value) {
              Ok(port) if port >= 1024 => Ok(Self(port)),
              _ => Err(InvalidPort(value)),
          }
      }
  }
  ```

- **Conversions.** Implement `From` rather than `Into`: `impl From<A> for B` gives you `Into<B> for A` through the blanket impl. `impl Into` alone does not give you `From`, and it can't be used in `?` conversions.
- **Conversion names** follow the API Guidelines: `as_` is free (a borrow or reinterpretation), `to_` is expensive (allocates or computes), and `into_` consumes `self`. `FromStr` is the trait for text parsing so callers can write `.parse()`.
- **Why enums for states.** Two bool fields that can't both be true are three valid states pretending to be four; the compiler can't check the fourth away. An enum makes the invalid state unrepresentable and `match` exhaustive.
- **Ownership.** Prefer borrowed parameters such as `&str`, `&[T]` and `&Path` when sufficient; take ownership when storing or consuming a value. Borrowed getters and parser views can avoid copies; owned returns give callers independence from internal lifetimes.
- **Diagnostics.** Derive `Debug` on public types unless the representation needs a custom implementation.
- **`#[non_exhaustive]`** belongs only on published library enums and structs that will grow; inside an application it just forces `_ =>` arms nobody wanted.
- **Borrow checker errors:** restructure first. Split borrows, shorten a borrow's scope, or move ownership to where the value is used. Cloning an `Arc` or `Rc` is cheap and fine. Cloning data just to make the error go away usually hides a design problem.
- **Macros.** Prefer a function when it expresses the same behavior clearly.

## 5. Concurrency, unsafe and async

### Unsafe

For unsafe work permitted by the project’s policy:

- A `// SAFETY:` comment explains why an operation’s requirements hold. Cite established invariants or documented obligations of the enclosing `unsafe fn`. A safe public API cannot rely on undocumented caller behavior to prevent undefined behavior.
- Soundness is decided by the whole module's privacy boundary, not just the block. Safe code in the same module can break an invariant the `unsafe` block relies on (`self.len += 1`).
- `Send`/`Sync` impls are justified by the type's own API. `Sync` needs every `&self` method to be safe to call concurrently, and `Send` needs no thread-affine state and no unsynchronized aliasing.
- Keep the block to the operation that needs it, using the project’s lint-exception mechanism. This example shows a local bounds proof:

  ```rust
  pub fn sum_pairs(values: &[u32]) -> u64 {
      let even_len = values.len() - values.len() % 2;
      let mut total = 0u64;
      let mut index = 0;
      while index < even_len {
          #[expect(unsafe_code, reason = "benchmark shows bounds checks block vectorization")]
          // SAFETY: `index + 1 < even_len <= values.len()`: `index` starts at 0,
          // advances by 2, and the loop exits before `even_len`, which is even.
          let (a, b) = unsafe { (*values.get_unchecked(index), *values.get_unchecked(index + 1)) };
          total += u64::from(a) + u64::from(b);
          index += 2;
      }
      total
  }
  ```

  In practice the safe `values.chunks_exact(2)` often optimizes just as well. Try it first and measure; the example above only shows what a proof looks like.
- Run the affected tests with `cargo +nightly miri test -p <crate>`. Miri checks only the paths the tests execute and can't run most FFI, so a clean Miri run is evidence, not proof.

### Threads and atomics

- Shared mutable state starts as `Mutex<T>` (or `RwLock<T>` if reads dominate and critical sections are long), or as message passing. `std::thread::scope` lets threads borrow stack data without `Arc`.
- **Ordering.** `Relaxed` provides atomicity for independent counters. A release store and an acquire load that observes it can publish preceding writes; name the data protected by that handoff. `SeqCst` additionally orders sequentially consistent operations. Choose from the synchronization proof, not from a blanket default; review nontrivial algorithms with the relevant chapters of *Rust Atomics and Locks*.

### Async (Tokio)

**Which mutex.** Use `std::sync::Mutex` for short, low-contention sections; never hold its guard across `.await`. `tokio::sync::Mutex` permits yielding while acquiring the lock or holding it across `.await`. An actor instead owns state and receives requests:

```rust
use tokio::sync::{mpsc, oneshot};

enum Message {
    Increment,
    Get { respond_to: oneshot::Sender<u64> },
}

struct Counter {
    receiver: mpsc::Receiver<Message>,
    count: u64,
}

impl Counter {
    async fn run(mut self) {
        while let Some(message) = self.receiver.recv().await {
            match message {
                Message::Increment => self.count += 1,
                Message::Get { respond_to } => {
                    // The caller may have stopped waiting; that isn't an error here.
                    respond_to.send(self.count).ok();
                }
            }
        }
    }
}

#[derive(Clone, Debug)]
pub struct CounterHandle {
    sender: mpsc::Sender<Message>,
}

impl CounterHandle {
    /// Returns the actor handle and its task for shutdown and failure observation.
    pub fn spawn() -> (Self, tokio::task::JoinHandle<()>) {
        let (sender, receiver) = mpsc::channel(64);
        let task = tokio::spawn(Counter { receiver, count: 0 }.run());
        (Self { sender }, task)
    }

    pub async fn increment(&self) -> Option<()> {
        self.sender.send(Message::Increment).await.ok()
    }

    pub async fn get(&self) -> Option<u64> {
        let (respond_to, response) = oneshot::channel();
        self.sender.send(Message::Get { respond_to }).await.ok()?;
        response.await.ok()
    }
}
```

The actor drains queued messages and exits after every sender is dropped. Its owner drops all handles, then awaits the returned task and handles any `JoinError`. Avoid cycles of actors waiting on each other.

**Blocking.**

- The 10–100 µs between yields is an application-dependent rule of thumb. Move blocking work to `spawn_blocking`; limit concurrent CPU jobs or use a CPU executor such as Rayon. Started blocking tasks cannot be aborted, so account for them during shutdown.
- `tokio::fs` uses the blocking pool. Batch small operations when this reduces scheduling overhead:

  ```rust
  pub async fn read_all(paths: Vec<std::path::PathBuf>) -> std::io::Result<Vec<String>> {
      tokio::task::spawn_blocking(move || paths.iter().map(std::fs::read_to_string).collect())
          .await
          .map_err(std::io::Error::other)?
  }
  ```

**`select!` loops.**

- Dropping an owned losing future can lose partial progress. Check cancellation documentation: `recv` and `read` are cancel-safe; `read_exact` is not. A future retained outside the loop and selected through `&mut` can resume later. Otherwise, explain why losing progress is acceptable, such as abandoning a connection at shutdown.
- `sleep(d)` written inside the loop restarts on every iteration and may never fire. Compute the deadline outside the loop and call `sleep_until(deadline)` (as below), or pin one `Sleep` and poll `&mut sleep`, or use `tokio::time::interval` for periodic work.

```rust
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::{Instant, sleep_until};
use tokio_util::sync::CancellationToken;

pub async fn drain(mut jobs: mpsc::Receiver<u32>, shutdown: CancellationToken) -> Vec<u32> {
    let deadline = Instant::now() + Duration::from_secs(5);
    let mut done = Vec::new();
    loop {
        tokio::select! {
            () = shutdown.cancelled() => break,
            () = sleep_until(deadline) => break,
            job = jobs.recv() => match job {
                Some(job) => done.push(job),
                None => break,
            },
        }
    }
    done
}
```

**Tasks and channels.**

- Bounded channels are the default because an unbounded one turns a slow consumer into unbounded memory growth instead of backpressure.
- Await or track every spawned task, or document why detachment is acceptable. `JoinHandle` and `JoinSet` expose results and panics. `TaskTracker` tracks completion; retain handles or arrange failure reporting separately.
- Use tokio-util’s `CancellationToken` for cooperative shutdown when available under the project’s dependency policy. Signal cancellation, then wait for tasks to finish; cancellation alone does not join them.

**Traits.** Native async methods support static dispatch. To expose `Send` futures, `trait-variant` can generate trait variants, or an explicit `fn method(...) -> impl Future<Output = T> + Send` can avoid a macro dependency. For dynamic dispatch, follow the project’s approach, such as `async-trait` or `dynosaur`. Check language support against the project’s toolchain.

## 6. Performance: measure, then change

To produce the measurements required by the project:

1. **Reproduce** the slow case in a benchmark or a release-mode run: `cargo build --release`, then time it.
2. **Profile** it (for example with `samply`, `perf` or `cargo flamegraph`) and find where the time actually goes.
3. **Fix the algorithm or data flow first.** Avoid repeated allocation in a loop, use `with_capacity` when the size is known, and pass `&[T]` instead of cloning.
4. **Only then** reach for targeted tools: a faster hasher for a proven-hot map with trusted keys, `SmallVec` for a proven-hot small collection, or `#[inline]` on a small cross-crate function the profile shows isn't being inlined.
5. **Compare** before and after under the same workload and settings. Repeat enough to identify measurement noise; revert changes with no demonstrated benefit.

**Build settings.** `target-cpu=native` may emit instructions unavailable on deployment CPUs. LTO, `codegen-units` and `panic` trade build time, runtime behavior and portability; explain those tradeoffs when proposing settings changes.

## Primary sources

See [reference documentation](../../references.md) for sources supporting these decisions and optional further reading. Use documentation matching the project’s toolchain and dependency versions.
