# Readiness before restructuring

Use this during step 0. Establish prerequisites for the actual scope, not every tool or environment the repository could ever use. Record the results in the decision log. The agent should resolve routine setup within existing authorization; the user need not prepare every item manually.

## Scope and starting state

- Name the repository, area or PR, starting commit, and intended deliverable. For PR work, record both the original PR head and the target revision used for comparison.
- Record additions, approved layout changes, fixed decisions, and excluded work. Do not infer permission to publish from permission to refactor.
- Preserve existing work. Use an isolated checkout when needed, and record who owns any uncommitted changes. Do not reset the user's checkout to obtain a clean baseline.
- Identify generated and vendored paths. Find generators and consumer build steps so generated output can be rebuilt rather than hand-edited.

## Executable verification

Use project manifests, wrappers, CI, scripts, and agent instructions to establish:

- Pinned dependencies and toolchains, including private registry access and cache permissions.
- Required services and realistic fixtures, such as a database, storage daemon, or deployed test stack.
- Devices, simulator runtimes, build variants, feature combinations, and native consumer packaging relevant to the scope.
- An environment for tests that cannot run locally, such as existing CI or an authorized linked host. Confirm access rather than assuming it.
- Resource ownership: isolate or serialize checks sharing build output, simulators, ports, global state, or scarce host resources. Parallelize only independent checks.

Check credential availability without recording values. Use the host's secure credential mechanism when input is needed. Missing authentication, dependencies, or services are setup blockers, not evidence of a code defect.

Do not disable tests, lengthen timeouts, or change production behavior to accommodate a broken environment. Investigate the cause. Keep the failed attempt and record the controlled rerun.

## Verification matrix

Map behavior to evidence before changing it. Expand the matrix as findings reveal additional affected behavior.

| Affected behavior | Required evidence | Environment and prerequisites | Execution constraints |
| --- | --- | --- | --- |
| Pure domain rules | Behavioral unit tests and compiler/type checks | Pinned host toolchain and fixtures | Usually independent |
| Cancellation and resource ownership | Controlled late-result, teardown, and failure-path tests | Relevant runtime and scheduler | Isolate shared runtime state |
| Rust/native bindings | Regeneration, rebuilt library, consumer compile and runtime tests | Supported native target and consumer harness | Build producers before consumers |
| Persistence and compatibility | Existing-data, migration, or consumer contract tests | Old fixtures or supported consumers | Keep independent test data |
| Storage, deployment, recovery | Project integration/recovery harness | Required service or authorized test stack | Reserve ports and services |
| Native UI and platform lifecycle | Relevant platform or device tests | Simulator/emulator/device and correct build variant | Reserve or isolate the device |

These rows are examples, not mandatory suites for every task. Record exact project commands and what each proves. A host unit suite does not establish device behavior; compilation does not establish recovery behavior.

Where important coverage is absent, establish characterization or regression tests before the structural change. Tie assertions to the requirement; do not freeze a known bug without identifying it. Test the intended correction separately.

## Baseline provenance

For each check record revision, platform/toolchain, command, prerequisites, outcome, named failures/skips, failure signatures, and an evidence location. Distinguish:

- **Passed:** executed successfully under the recorded conditions.
- **Code failure:** test executed and failed; attribution still needs evidence.
- **Setup blocked:** required authentication, service, dependency, or tool was unavailable.
- **Skipped or interrupted:** verification did not establish the result.

For PR work, state “present on the original PR head” unless the target revision was also tested. Matching failures require matching identities and causes, not matching totals. A later setup repair adds evidence; it does not erase the original observation or excuse a new regression.

Run the full relevant baseline even if one runner stops early: resume the remaining suites explicitly. Do not call the baseline complete while required suites have not executed.

## Decide what can proceed

- Proceed with structural work whose prerequisites and regression protection are established.
- Resolve missing prerequisites for other affected areas before restructuring them. Continue independent work rather than waiting unnecessarily.
- If a prerequisite cannot be obtained within the available authorization or environment, record the affected finding as blocked, with the exact missing capability and next action. Keep it in the objective.
- A baseline failure outside the changed behavior can remain disclosed. A failure that prevents verification of changed behavior cannot be waived merely because it predates the refactor.
- Arrange independent review and a durable handoff location. If the runtime ends a run early, resume from the record; a commit or completed agent turn is not evidence that the task is finished.
