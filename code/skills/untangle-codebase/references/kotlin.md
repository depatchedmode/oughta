# Kotlin

What the core skill's categories look like in Kotlin, on Android and in Kotlin Multiplatform, and which tools find them. Read it once, then use it to guide investigation. The patterns below are candidates, not automatic defects; establish their responsibility and consumers before changing them.

## Commands

Fallbacks for when the project's Makefile, CI workflow or agent instructions don't say. Always run the wrapper, `./gradlew`, never a system `gradle`, and look for the wrapper in subdirectories: a repo can hold several Gradle builds, none at the root. The task names below assume no product flavors. With flavors they carry the flavor name, and a KMP module has per-target compile tasks instead of `compileKotlin`. Discover the real names with:

```sh
./gradlew tasks --all | rg -i 'compile.*kotlin|unittest|verify(paparazzi|roborazzi)'
```

| Need | Android | JVM and KMP |
| --- | --- | --- |
| Fast check | `./gradlew compileDebugUnitTestKotlin`, which compiles the tests too | `./gradlew compileTestKotlin`, or one target such as `./gradlew compileKotlinIosArm64` |
| Full suite | `./gradlew testDebugUnitTest`, plus `./gradlew verifyPaparazziDebug` or `./gradlew verifyRoborazziDebug` when those plugins are applied | `./gradlew test`, or `./gradlew allTests` for KMP |
| On device | `./gradlew connectedDebugAndroidTest` (needs an emulator) | |
| Lint | `./gradlew lint`, plus `./gradlew detekt` or `./gradlew ktlintCheck` if configured | `./gradlew detekt`, `./gradlew ktlintCheck` |
| Format | `./gradlew ktlintCheck` or `./gradlew spotlessCheck` to check; `./gradlew ktlintFormat` or `./gradlew spotlessApply` to fix, whichever is configured | same |
| Module graph | `rg -n 'project\(|projects\.' -g '*.gradle*'`, or `./gradlew :app:dependencies --configuration debugRuntimeClasspath` | same |

Batch related fixes in one invocation when appropriate and scope fast checks to changed modules, such as `./gradlew :feature:login:compileDebugUnitTestKotlin`. Use `--offline` only after required dependencies are resolved. Include affected consumers in integration checks. Compilation is a checkpoint, not behavioral verification. Establish emulator/device access before restructuring behavior covered only by instrumented tests; record which variants and platforms actually ran.

Use the project's pinned coroutine and test-library versions. Do not replace dispatcher compatibility logic with a seemingly simpler API without proving support and behavior on those versions. Isolate shared build output and emulator ownership or run competing checks sequentially. Regenerate bindings and rebuild native libraries before testing consumers.

Skeleton:

```sh
rg -n '^\s*(public |internal |private |protected )?(abstract |open |data |sealed |enum |annotation |value |inline |suspend |override |operator )*(class|object|interface|fun|val|var)\b' --type kotlin
```

## Generated and vendored code

Do not hand-edit generated output; change its source and regenerate. Configuration and lockfiles still belong in dependency and compatibility analysis even though they are not application code.

- Everything under `build/`: `R`, `BuildConfig`, and `build/generated/ksp/` and `build/generated/source/kapt/` for Room, Hilt, Dagger and Moshi. None of it is in the tree, but code that uses it depends on an annotation somewhere.
- In the tree: uniffi `*.kt` bindings, and any checked-in protobuf or Wire output. Look for a "generated" header.
- Vendored or forked modules, and Git submodules.
- `gradle.lockfile` and `libs.versions.toml` are configuration, not code.

## Fixed boundaries

- A library module's public API consumed by other apps. If binary-compatibility-validator's `api/*.api` files exist, they're the contract.
- `external fun` and JNI entry points, `@JvmStatic` and `@JvmName` for Java callers, and uniffi interfaces, when the consumer lives outside this repo. For coordinated in-repo consumers, regenerate bindings, rebuild the native library, and update callers in the same fix. Independently released consumers still require compatibility.
- Classes named in `AndroidManifest.xml`: activities, services, receivers, providers. Names in XML layouts and navigation graphs. Anything `@Keep` or ProGuard rules keep because reflection finds it by name.
- Persisted shapes: Room entity and column names need a migration, `Parcelable` and `Serializable` classes in saved state, serialization field names matching a wire format.
- KMP `expect` and `actual` pairs and source sets. The split across `commonMain`, `androidMain` and `iosMain` is the toolchain's, not a layout to fix.
- Compose navigation routes that deep links or other modules use.

## Hidden links

- Anything coupled by a string: `SharedPreferences` and DataStore keys, `Intent` actions and extras, `Bundle` and `SavedStateHandle` keys, navigation routes, WorkManager tags, notification channel IDs, resource names looked up by string.
- Manifest entries and the classes they name.
- `object` singletons and `companion object` mutable state written in one module and read in another.
- `BuildConfig` fields, and flavor-specific source sets that copy code between flavors.
- `GlobalScope` and hard-coded `Dispatchers` that tie a class to a runtime it doesn't declare.
- A feature's screen, view model, repository and tests in four modules or four packages.

## Needless links

- Overly broad visibility after checking external consumers, Java callers, reflection, and generated bindings. Narrow to `internal` where the contract permits it.
- A `:core` module that depends on a `:feature`, or any module that depends on `:app`. Gradle makes this visible in `build.gradle.kts`, so check it first.
- `api(...)` dependencies that should be `implementation(...)`. Every consumer of the module inherits them.
- View models that take a `Context`.
- Constructors with many dependencies: investigate whether they combine unrelated responsibilities rather than splitting them solely to reduce the parameter count.
- The same `when (x) { is A -> …; is B -> … }` repeated in several places, where a method on the sealed type would hold it once.

## Surplus

- Android Lint's `UnusedResources` and `UnusedIds`. detekt's `UnusedPrivateMember`, `UnusedImports` and `UnusedParameter`. Kotlin compiler warnings.
- `Base*` classes with one subclass. `*Utils` and `*Helper` objects. `Manager` classes that wrap one Android API.
- Interfaces with one implementation and no demonstrated boundary or substitution role. One implementation is not itself evidence of surplus.
- Flavors or build types nothing uses.

## Special cases

- `!!`, and `as` casts that can throw.
- `runCatching { }.getOrNull()`, empty `catch` blocks, and `?: return` chains that hide why something was null.
- `delay()`, `Thread.sleep`, `Handler.postDelayed` and retry loops outside tests.
- `lateinit var` where a constructor parameter would do.
- Suppressions: `@Suppress(...)`, `@SuppressLint(...)`, and `@OptIn` sprawl. Grep `@Suppress\(`, `@file:Suppress`, `@SuppressLint\(` and `ktlint-disable`, and read detekt's `baseline.xml`, Android Lint's `lint-baseline.xml` and `tools:ignore` in XML. Check directive support against the project's pinned tool version before calling a suppression ineffective.
- `GlobalScope.launch`, and `Dispatchers.Main` or `Dispatchers.IO` hard-coded instead of injected.
- `Build.VERSION.SDK_INT >= …`, `BuildConfig.DEBUG` and `BuildConfig.FLAVOR` branches.
- `@VisibleForTesting` on members made visible only so a test can reach them.
- `@Ignore` on a test.

## Comments mode

Keep:

- KDoc on public API.
- `// region` and `// endregion`, unless the file is being split anyway.

`@Suppress` is an annotation, not comment cleanup. Preserve functional tool directives. Remove obsolete directives only after verifying their meaning under the pinned tooling and recording the associated finding.

## Tests mode

- JVM and configured Robolectric tests can run without an emulator; instrumented `androidTest` needs a device/emulator. KMP native targets may require a different host or runtime. Record actual execution rather than inferring availability from the source set.
- MockK or Mockito interaction assertions can protect observable boundaries, such as not issuing a write after cancellation. Remove assertions only when they pin incidental internal choreography.
- `@VisibleForTesting` is a prompt to inspect the API and assertion, not proof that a test is invalid.
- Paparazzi and Roborazzi screenshot tests can run on the JVM. Use the project's configured verification tasks; do not assume a plain unit-test run compared goldens. Do not record new goldens merely to clear a failure.
- `@Ignore` is the disabled test.

Use controlled schedulers or explicit worker-start/completion signals. `advanceUntilIdle` does not prove that work on an unrelated executor completed. Late-result tests must exercise the session's protection rather than having a fake silently suppress every late result. Bound waits and release blocking workers during cleanup. For critical guards, selectively remove the guard, confirm failure for the intended reason, restore it, and rerun.

## Graph and partition

Files in the same package need no imports, so begin with Gradle module dependencies, then package/type references. Treat text matches as navigation rather than a complete graph. Include qualified references, generated code, manifest/XML names, reflection, and runtime contracts.

Partition subagents by Gradle module, and by package inside a large one.

## Primary sources

Use the documentation matching the adopting project's pinned versions.

- [Android command-line testing](https://developer.android.com/studio/test/command-line): unit and instrumented test tasks.
- [Testing Kotlin coroutines](https://developer.android.com/kotlin/coroutines/test): test dispatchers, schedulers, and controlled execution.
