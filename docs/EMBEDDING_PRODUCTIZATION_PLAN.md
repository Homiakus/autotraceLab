# AutoTrace — Embedding & SDK Productization Execution Plan

Status: **execution annex to `MASTER_IMPLEMENTATION_PLAN.md`**  
Baseline audited: `602e7c742496671b183bcd0537f6c2ee79f5cbe2`  
Scope: reusable Go core, TypeScript SDK, WASM/Worker runtime, registry resolution, packaging, compatibility and consumer experience.  
Authority rule: this document **does not replace** `MASTER_IMPLEMENTATION_PLAN.md`; it expands the reusable-core / embedding / delivery workstream. If ordering or mathematical cutover requirements conflict, the master plan wins.

---

## 0. Goal and Definition of Done

AutoTrace must be usable as a real embedded engine, not as an AutoTraceLab implementation detail.

A successful end state is:

```text
Any Host
  |
  v
Small stable SDK / Go API
  |
  v
Versioned canonical contract
  |
  v
Isolated runtime adapter
  |-- native Go
  |-- Go/WASM Dedicated Worker
  |-- TypeScript reference runtime
  `-- future RPC/stdio runtime
  |
  v
Canonical Go Core
```

A third-party integrator must be able to start from an empty project and obtain a routed scene with no knowledge of AutoTraceLab internals, no host-specific globals, no manual WASM asset copying, no React dependency and no silent runtime substitution.

### Release-level Definition of Done

The embedding program is complete only when all of the following are true:

1. `@autotrace/sdk` has no application/UI runtime dependencies.
2. A clean consumer can `npm install`/`npm pack` the SDK and run it without importing source files from the repository.
3. Go consumers can import a semantically versioned module and use `core` without AutoTraceLab.
4. WASM and Worker assets resolve package-relatively or through an explicit runtime factory; `/autotrace.wasm` is not a hidden requirement.
5. No universal SDK/core path contains `businessOS*`, AutoTraceLab UI state or another host-specific symbol.
6. Each runtime/client has explicit ownership and scene isolation; two clients may use the same scene ID without collision.
7. `AbortSignal`/`context.Context` cancellation reaches long-running computation where the selected algorithm supports cancellation; unsupported cancellation is explicitly reported.
8. Registry packages are validated, versioned, resolved into a canonical scene, and actually influence ports/geometry/routing profiles.
9. Protocol, contract, registry schema, snapshot and engine versions are separately observable.
10. Fallback from Go/WASM to TypeScript is policy-driven and visible, never silent in strict production mode.
11. Public API compatibility is checked in CI.
12. Consumer acceptance tests pass for Go, Node ESM, Node CJS where supported, Vite/browser and at least one React host.

---

# 1. Current high-impact findings

## E-01 — SDK package boundary is not clean

Current `package.json` combines the SDK with AutoTraceLab application dependencies such as React, Vite, Tailwind, Express, Motion and Google GenAI.

**Risk:** an embedding consumer installs the application dependency graph instead of a small headless SDK.

**Target:** separate product packages and keep the SDK runtime dependency footprint at zero or near-zero.

---

## E-02 — Documented registry path and client registry are different instances

`docs/EMBEDDING.md` demonstrates mutation of `globalRegistryStore`, while `AutoTraceClient` constructs its own `new RegistryStore()`.

**Risk:** customization appears accepted but does not configure the client being used.

**Target:** explicit registry ownership; no ambiguous global mutable registry in the primary API.

---

## E-03 — Registry resolution is not part of the canonical routing pipeline

The repository has registry definitions and resolvers, but `AutoTraceClient.route/openScene` sends host `BlockNode` objects directly to the engine.

**Risk:** type packages remain metadata beside the engine instead of a reusable domain-model layer.

**Target:** `Host Scene -> Registry Resolver -> Canonical Scene -> Engine`.

---

## E-04 — `SceneSession.updateOptions()` can reset unrelated options

The method merges a partial update into global defaults instead of the session's effective current options.

**Risk:** changing one option can silently overwrite prior per-scene configuration.

**Target:** keep effective session options and merge partial changes against that state.

---

## E-05 — WASM runtime uses a host-specific global and process-global scene engine

`go_engine/cmd/wasm/main.go` exports `businessOSAutoTraceRequest` and uses one package-global `graphSceneEngine`.

**Risk:** host coupling, global namespace pollution, scene-ID collision between embedded clients and difficult resource ownership.

**Target:** generic runtime bridge with per-runtime/client namespace and explicit lifecycle.

---

## E-06 — Runtime `auto` policy can silently use the TypeScript implementation

`EngineClient` falls back to TypeScript when the WASM bridge/Worker is not already available.

**Risk:** production semantics/performance can change with environment configuration while the Go/TS cutover is still governed by parity gates.

**Target:** explicit preferred runtime, required capabilities and fallback policy.

---

## E-07 — Protocol validation exists but is not consistently used by backends

`parseProtocolResponse()` validates protocol version, while direct/worker paths parse or accept responses independently.

**Risk:** protocol mismatch can cross the boundary without a uniform failure mode.

**Target:** one protocol codec/validator used by every transport.

---

## E-08 — Injected Worker ownership is unsafe

The Worker backend assigns `onmessage/onerror` and terminates the Worker during disposal even if the Worker was supplied by the host.

**Risk:** AutoTrace can overwrite host handlers or destroy host-owned resources.

**Target:** owned/borrowed resource semantics plus event-listener cleanup.

---

## E-09 — Promise cancellation does not necessarily stop computation

The JS request may be rejected on abort while the Worker/WASM computation continues. Some Go routers check context before calling a non-context-aware algorithm but cannot stop it once started.

**Risk:** wasted CPU and stale work during rapid editor interactions.

**Target:** request cancellation protocol + cooperative checkpoints in long-running canonical algorithms.

---

## E-10 — WASM distribution assumes application-root assets

The loader defaults to `/autotrace.wasm`; the Worker and Go runtime helper assets are not yet a fully self-contained published package experience.

**Risk:** embedding requires undocumented bundler/public-directory setup.

**Target:** package-relative assets and runtime factory.

---

## E-11 — SDK is not protected by a dedicated consumer CI gate

The repository currently has a Go-engine workflow, but no equivalent SDK workflow that packs and installs the actual artifact into clean consumers.

**Risk:** source tests can pass while the published package is broken.

**Target:** `npm pack` acceptance matrix, bundle-size/API compatibility checks and WASM smoke tests.

---

## E-12 — Go/TS contracts are manually duplicated

Scene, protocol and registry structures exist in several Go/TS files.

**Risk:** semantic drift in optional fields, defaults, serialization and versioning.

**Target:** schema-first or generation-backed contracts with cross-language fixtures.

---

# 2. Target repository/product structure

Adopt the separation incrementally; do not perform a disruptive big-bang move before tests protect the boundary.

```text
autotraceLab/
  apps/
    lab/                         # React reference editor / benchmark laboratory

  packages/
    contract/                    # stable TS contracts + generated schemas/types
    sdk/                         # headless client/session API
    registry/                    # registry definitions/resolution utilities
    wasm/                        # worker, loader, wasm assets/runtime factory
    renderer-svg/                # renderer-neutral SVG path helpers
    react/                       # optional React adapter/components

  contracts/                     # canonical schemas + compatibility fixtures

  go_engine/
    core/                        # canonical reusable computation
    cmd/autotrace/               # CLI / future stdio transport
    cmd/wasm/                    # generic WASM adapter only

  consumer-tests/
    node-esm/
    node-cjs/
    vite-browser/
    react-vite/
    go-native/
```

### Package dependency direction

```text
contract <- registry <- sdk
    ^                    |
    |                    v
    +---------------- runtime adapters

renderer-svg <- react

apps/lab may depend on all packages.
No package may depend on apps/lab.
```

The Go core must not import UI/browser packages. The TypeScript SDK must not import React or AutoTraceLab UI state.

---

# 3. Phase P0-A — Correctness before restructuring

Purpose: eliminate correctness traps before moving files/packages.

## P0-A1. Fix effective scene options

**Files:**
- `src/sdk/SceneSession.ts`
- `src/sdk/index.ts`
- `src/tests/sdkTest.ts`

**Changes:**
- store effective `RoutingOptions` in `SceneSession`;
- initialize from the exact options used during `scene.open`;
- merge `updateOptions(partial)` against current effective options;
- update local effective state only after backend success;
- include effective options in snapshot/session persistence contract if persistence remains enabled.

**Tests:**
- open with non-default A/B/C values;
- update only B;
- assert A/C remain unchanged;
- backend failure must not mutate local effective options.

**Gate:** partial option updates are lossless across TS and Go/WASM backends.

## P0-A2. Centralize protocol response parsing

**Files:**
- `src/engine/protocol.ts`
- `src/engine/backend/DirectWasmBackend.ts`
- `src/engine/backend/WasmWorkerBackend.ts`
- `src/engine/types.ts`

**Changes:**
- create one `decodeProtocolResponse<T>()` path;
- validate object shape, protocol version, request ID and success/error invariants;
- reject mismatched request IDs in Worker transport;
- convert malformed responses into `EngineProtocolError` with stable code.

**Tests:**
- wrong protocol;
- missing request ID;
- mismatched request ID;
- `ok=true` with no value where value is required;
- `ok=false` with missing error;
- malformed JSON/direct bridge response.

## P0-A3. Make runtime selection observable

**Files:**
- `src/engine/EngineClient.ts`
- `src/engine/types.ts`
- `src/sdk/types.ts`

**Introduce:**

```ts
interface RuntimePolicy {
  preferred: 'wasm-worker' | 'direct-wasm' | 'typescript';
  fallback: 'typescript' | 'error';
  minimumContractVersion?: number;
  requireCapabilities?: (keyof EngineCapabilities)[];
}
```

Add `runtimeInfo()`/equivalent returning selected backend, engine ID, protocol version, contract version and fallback reason.

**Compatibility:** keep current `backend` option temporarily but deprecate ambiguous `auto` for production use.

**Gate:** strict mode can guarantee "Go/WASM or fail".

---

# 4. Phase P0-B — Runtime isolation and lifecycle

## P0-B1. Remove BusinessOS naming from universal core/SDK

**Files:**
- `go_engine/cmd/wasm/main.go`
- `src/engine/wasmLoader.ts`
- `src/engine/backend/DirectWasmBackend.ts`
- tests/docs referencing the old symbol.

**Migration:**
- introduce generic `autotraceRequestV2` only as a compatibility bridge if a global is still temporarily required;
- retain `businessOSAutoTraceRequest` for one deprecation window only as an alias in the AutoTraceLab compatibility shell, not in the core contract;
- add a deprecation test/documented removal milestone.

## P0-B2. Introduce runtime identity / namespace

Avoid one process-global scene namespace.

Minimum acceptable protocol extension:

```text
client.create -> runtime/client handle
request(clientHandle, operation, payload)
client.dispose
```

Alternative acceptable implementation: one isolated Worker/WASM instance per `AutoTraceRuntime`, where all scenes are naturally private to the instance.

**Requirements:**
- Client A and Client B may both open `graphId="main"`;
- disposing A cannot close B scenes;
- duplicate scene IDs inside one runtime have explicit semantics (`replace`, `error`, or `openExisting`) rather than implicit replacement.

**Files:**
- `go_engine/cmd/wasm/main.go`
- `go_engine/core/scene_engine.go`
- `src/engine/wasmLoader.ts`
- backend/runtime tests.

## P0-B3. Formalize owned vs borrowed Worker

**Files:**
- `src/engine/backend/WasmWorkerBackend.ts`

**Changes:**
- `worker` injected by host => borrowed by default;
- SDK-created Worker => owned;
- use `addEventListener/removeEventListener`;
- only owned workers are terminated on dispose;
- expose optional `ownership: 'owned' | 'borrowed'` only if explicit override is required.

**Tests:**
- host listener survives SDK lifecycle;
- borrowed worker is not terminated;
- owned worker is terminated exactly once;
- pending promises are rejected on dispose.

## P0-B4. Add real request cancellation semantics

**Protocol:** add a cancellation message or cancellation-aware request registry where useful.

**Go:**
- audit every `Router` implementation;
- introduce context-aware variants for algorithms expected to run long enough to matter;
- place cancellation checkpoints in loops/iterations/search expansion;
- do not claim cancellability in capabilities for algorithms that cannot stop cooperatively.

**TS/Worker:**
- AbortSignal must send cancellation to the Worker runtime when the request has started;
- late responses for cancelled request IDs must be ignored.

**Gate:** rapid patch/drag stress test demonstrates bounded stale CPU work.

---

# 5. Phase P0-C — Registry becomes part of execution

## P0-C1. Remove ambiguous global registry from the primary SDK API

**Files:**
- `src/registry/RegistryClient.ts`
- `src/sdk/index.ts`
- `src/sdk/types.ts`
- `docs/EMBEDDING.md`

**Target API:**

```ts
const registry = createRegistry();
registry.importPackage(pkg);

const client = createAutoTraceClient({ registry });
```

`packages: []` may remain as a convenience constructor input, but it must populate the exact registry owned by that client.

`globalRegistryStore` may remain only as a deprecated compatibility helper, never as the documented recommended path.

## P0-C2. Add canonical scene materialization

Create an explicit boundary such as:

```text
resolveScene(hostScene, registry, policy) -> CanonicalScene
```

**Responsibilities:**
- resolve `semanticType` / block type;
- materialize missing default ports;
- resolve shape and routing envelope inputs;
- apply routing profile defaults;
- separate visual-only fields from routing geometry;
- validate referenced type IDs;
- produce deterministic canonical ordering/data;
- return diagnostics rather than silently substituting an unrelated type in strict mode.

**Files/new modules:**
- `src/registry/resolve.ts` (refactor/extend)
- `src/registry/sceneResolver.ts` (new recommended boundary)
- Go equivalent under `go_engine/core/` if resolution is canonical in Go;
- contract fixtures shared across languages.

## P0-C3. Define where registry truth lives

Choose one canonical rule and document it:

**Recommended:** registry/domain materialization is deterministic contract logic shared/generated across runtimes, while routing mathematics consumes only canonical scene geometry and semantics.

Do not allow independent TS and Go registries to evolve incompatible resolution rules.

## P0-C4. Registry dependency/version policy

Extend `RegistryPackage` with explicit schema/dependencies when needed:

```text
schemaVersion
requires
engineContractRange
```

Detect:
- duplicate IDs;
- incompatible replacement;
- missing package dependency;
- unresolved shape/routing profile;
- deprecated type use;
- checksum mismatch;
- unsupported schema/contract range.

**Rule:** imports are transactional; a failed package import must not partially mutate a registry.

---

# 6. Phase P0-D — Turn the SDK into an actual distributable product

## P0-D1. Split application and SDK dependency graphs

Do this incrementally after P0 correctness tests exist.

**First extraction targets:**
1. contract types;
2. registry;
3. SDK/session;
4. runtime adapters;
5. renderer helpers;
6. React layer;
7. move AutoTraceLab into `apps/lab` last if needed.

**Rules:**
- `@autotrace/sdk` cannot depend on React, ReactDOM, Motion, Lucide, Vite, Tailwind, Express or GenAI;
- UI packages may depend on SDK, never reverse;
- AI parameter tuning must be an optional separate feature/package or host adapter, not a base SDK dependency.

## P0-D2. Define supported public exports

Recommended stable exports:

```text
@autotrace/sdk
@autotrace/sdk/contract
@autotrace/sdk/registry
@autotrace/sdk/runtime
@autotrace/wasm
@autotrace/renderer-svg
```

Do not make consumers import `dist/internal/*`.

Add explicit `exports` entries and type declarations for every intended extension point including `EngineBackend`/runtime interfaces.

## P0-D3. Self-contained WASM package

**Target API:**

```ts
import { createWasmWorkerRuntime } from '@autotrace/wasm';

const runtime = await createWasmWorkerRuntime();
```

Runtime factory owns:
- Worker construction;
- package-relative WASM URL;
- compatible `wasm_exec.js`/Go runtime bootstrapping;
- manifest/version verification;
- capability handshake;
- cleanup.

Allow explicit URL overrides for CDN/offline/embedded deployments, but require no manual copying for the default bundler path.

## P0-D4. Persistence becomes opt-in host policy

**Current concern:** routing success can be converted into SDK failure by a storage write/quota failure.

**Target:**
- memory/no persistence by default;
- explicit `PersistenceAdapter`/policy;
- persistence failure is separately classified from engine failure;
- support `restoreScene` that reconstructs active engine state rather than merely returning parsed JSON;
- version snapshots for migration.

---

# 7. Phase P0-E — CI must test the artifact, not the source tree

Create `.github/workflows/sdk.yml`.

## Required jobs

### sdk-source
- install using one canonical package manager;
- typecheck;
- unit tests;
- lint where configured;
- `build:lib`.

### sdk-pack-consumer
- build package;
- `npm pack`;
- install tarball into clean fixture projects;
- run public API only, never `src/**` imports.

### runtime-browser
- build Vite consumer;
- initialize packaged WASM Worker;
- `hello`;
- route;
- open/patch/snapshot/close;
- dispose and verify no leaked Worker/listeners.

### node-esm
- import SDK from packed artifact;
- use supported runtime (TS or future native/RPC adapter);
- verify no DOM/localStorage requirement.

### node-cjs
Only retain CJS support if it is intentionally supported and tested. Otherwise remove the claim/export rather than shipping an unverified compatibility path.

### registry-consumer
- import external registry package fixture;
- materialize custom block/edge types;
- assert routing uses resolved ports/profiles;
- assert version/reference failures are deterministic.

### api-compat
- generate public API report;
- fail on unreviewed breaking public API changes;
- enforce SemVer classification.

### bundle-budget
Track at minimum:
- SDK JS size;
- SDK gzip size;
- Worker JS size;
- WASM size.

Do not block justified algorithmic growth solely by bytes, but make size changes observable and reviewed.

### go-engine
Keep the existing Go test/vet/WASM build workflow, but add cross-language contract fixtures and consumer-level release linkage.

---

# 8. Phase P1-A — Canonical contracts and compatibility

## P1-A1. Separate version dimensions

Expose and persist independently:

```text
protocolVersion
contractVersion
registrySchemaVersion
snapshotVersion
engineVersion
packageVersion
```

Do not overload one number to mean several compatibility domains.

## P1-A2. Schema-first/generated contracts

Create `contracts/` with canonical machine-readable definitions for:
- points/ports/nodes/edges;
- routing options;
- scene/patch/result;
- protocol envelope/errors/capabilities;
- registry package;
- persisted snapshot.

Generate or continuously validate Go and TypeScript representations against these schemas.

## P1-A3. Golden cross-language fixtures

For each contract family store valid/invalid JSON fixtures and assert:
- TS accepts/rejects identically;
- Go accepts/rejects identically;
- omitted/default/zero/null semantics match;
- serialization round-trip is stable;
- deterministic ordering assumptions are explicit.

## P1-A4. Error taxonomy

Use stable error families rather than generic `AUTOTRACE_ERROR` where actionable classification exists:

```text
INVALID_PAYLOAD
INVALID_GRAPH
UNSUPPORTED_OPERATION
PROTOCOL_MISMATCH
CONTRACT_MISMATCH
CAPABILITY_MISSING
SCENE_NOT_FOUND
REVISION_CONFLICT
CANCELLED
TIMEOUT
RUNTIME_UNAVAILABLE
REGISTRY_INVALID
REGISTRY_CONFLICT
PERSISTENCE_FAILURE
CLIENT_DISPOSED
```

Errors must include retryability only where retry is semantically safe.

---

# 9. Phase P1-B — Go module/API productization

## P1-B1. Stable Go module versioning

Because the module is under `go_engine/`, release tags for the Go module must use the subdirectory prefix, e.g.:

```text
go_engine/v0.1.0
go_engine/v0.2.0
go_engine/v1.0.0
```

Keep immutable `engine-<sha>` WASM artifacts for supply-chain pinning, but do not use them as a substitute for user-facing Go SemVer.

## P1-B2. Go public surface review

Classify exported identifiers into:
- stable contract;
- extension point;
- experimental;
- internal implementation that should move under `internal/` or be unexported.

Add package-level examples for:
- stateless route;
- stateful engine;
- custom router;
- context cancellation;
- registry package;
- deterministic validation.

## P1-B3. Remove mutable singleton as the primary extension mechanism

Prefer factories:

```go
registry := core.NewRouterRegistryWithBuiltins()
engine := core.NewEngine(core.WithRouterRegistry(registry))
```

Keep process-global defaults only as convenience compatibility helpers if necessary.

---

# 10. Phase P1-C — Generic transport for non-JS hosts

Turn `go_engine/cmd/autotrace` from a hard-coded demo into a useful optional transport while retaining examples separately.

Recommended first transport:

```text
autotrace rpc --stdio
```

Use the same protocol envelope and capability negotiation as WASM.

Benefits:
- Python integration;
- C#/Java integration;
- Electron/Tauri sidecar;
- easy CLI/debugging;
- no premature maintenance burden from multiple FFI bindings.

Add process lifecycle, request framing, cancellation and deterministic exit/error semantics.

Native FFI bindings should be considered only after stdio/RPC consumer evidence shows a real need.

---

# 11. Phase P1-D — Documentation and adoption path

## P1-D1. Replace root README positioning

Root README must present AutoTrace as a reusable diagram routing/layout engine first, with AutoTraceLab as the reference app.

Required quickstarts:
- Go;
- Browser/WASM;
- Node supported mode;
- React adapter.

Remove AI-Studio-specific onboarding from the primary project identity; retain it only where relevant to the reference app.

## P1-D2. Rewrite `docs/EMBEDDING.md`

Document only public, tested APIs.

Required sections:
1. choose runtime;
2. create client;
3. route stateless graph;
4. open/patch/close scene;
5. registry package customization;
6. cancellation;
7. persistence adapter;
8. runtime/version diagnostics;
9. Worker ownership;
10. disposal;
11. troubleshooting and stable error codes.

Every example must run in a consumer fixture in CI.

## P1-D3. Add `COMPATIBILITY.md`

Matrix:

| Surface | Supported | CI-tested | Version policy |
|---|---|---|---|
| Go native | yes | yes | SemVer |
| Browser WASM Worker | yes | yes | SemVer + manifest |
| Node ESM | yes | yes | SemVer |
| Node CJS | explicit decision | if yes | SemVer |
| React | yes | yes | SemVer |
| Vue/Svelte | headless SDK | smoke/example | SDK contract |
| Electron/Tauri | example/runtime | smoke | SDK/runtime contract |

---

# 12. Phase P2 — Performance and advanced host ergonomics

Execute only after P0 correctness/productization gates are green.

## P2-1. Allocation and serialization budget

Measure separately:
- host -> canonical scene materialization;
- JSON encode/decode;
- Worker copy/structured clone;
- WASM bridge serialization;
- routing core;
- result serialization.

Optimize only measured dominant costs.

Potential later improvements:
- transferable buffers / binary contract for large graphs;
- compact patch encoding;
- reusable scratch buffers in Go;
- snapshot delta persistence.

Do not introduce a binary protocol before JSON contract stability is proven.

## P2-2. Runtime pooling

For applications with many documents, evaluate Worker/runtime pool policies only after per-runtime isolation is correct.

Never reintroduce cross-client global scene state merely to reduce startup cost.

## P2-3. Framework adapters

Thin adapters may be added for React/Vue/Svelte, but they must remain wrappers around the same headless client/session API.

No framework-specific semantics may become canonical scene semantics.

---

# 13. Atomic implementation sequence

Use the following sequence; each item must leave `main` green.

### EP-001 — Option-state regression protection
- add failing regression test;
- fix `SceneSession.updateOptions`;
- verify TS backend.

### EP-002 — Protocol codec hardening
- central decoder;
- direct backend migration;
- worker backend migration;
- malformed/mismatch tests.

### EP-003 — Runtime diagnostics/policy
- capability requirements;
- strict fallback policy;
- `runtimeInfo`;
- tests.

### EP-004 — Worker ownership
- borrowed/owned distinction;
- event listeners;
- disposal tests.

### EP-005 — Generic bridge naming
- introduce generic bridge;
- compatibility alias;
- remove BusinessOS knowledge from SDK path.

### EP-006 — Runtime/scene isolation
- two-client same-ID test first;
- runtime isolation implementation;
- lifecycle/disposal tests.

### EP-007 — Cancellation propagation
- cancellation protocol;
- worker propagation;
- Go context audit/checkpoints;
- stress test.

### EP-008 — Registry ownership cleanup
- client-injected registry;
- remove recommended global path;
- update embedding test.

### EP-009 — Canonical scene resolver
- strict resolver contract;
- custom block/ports fixture;
- routing-profile fixture;
- diagnostics.

### EP-010 — Transactional registry import
- dependency/reference validation;
- collision policy;
- rollback-on-failure tests.

### EP-011 — SDK package extraction
- isolate headless dependency graph;
- public export map;
- build declarations;
- source compatibility adapter for AutoTraceLab.

### EP-012 — WASM package/runtime factory
- package-relative Worker;
- package-relative WASM;
- manifest handshake;
- override URLs;
- browser fixture.

### EP-013 — Persistence policy
- opt-in adapter;
- failure isolation;
- versioned snapshots;
- restore active scene.

### EP-014 — SDK CI consumer gate
- `npm pack`;
- Node ESM/CJS decision;
- Vite/browser;
- React;
- registry;
- WASM lifecycle.

### EP-015 — Contract generation/golden fixtures
- canonical schemas;
- Go/TS parity validation;
- compatibility CI.

### EP-016 — Go SemVer/release surface
- module tags policy;
- examples;
- API classification.

### EP-017 — Root README + embedding docs
- tested quickstarts only;
- compatibility matrix;
- migration notes.

### EP-018 — stdio RPC transport
- same protocol;
- lifecycle/cancellation;
- Python/C# minimal consumer examples if useful.

### EP-019 — Performance profiling
- serialization/allocation breakdown;
- optimize only measured bottlenecks.

### EP-020 — 1.0 embedding release gate
- run full consumer matrix;
- run mathematical parity/cutover gates required by master plan;
- generate API/contract compatibility report;
- tag npm and Go releases only when all blocking gates pass.

---

# 14. Test matrix required for every embedding release

| Test class | TS reference | Go native | Go/WASM Worker |
|---|---:|---:|---:|
| stateless route | required | required | required |
| scene lifecycle | required | required | required |
| partial options | required | required | required |
| revision conflict | required | required | required |
| malformed graph | required | required | required |
| cancellation | capability-dependent | required where supported | required where supported |
| registry resolution | required | required/canonical | required/canonical |
| custom routing profile | required | required | required |
| two-client isolation | required | n/a/process model | required |
| persistence restore | SDK | n/a | SDK |
| protocol mismatch | required | adapter | required |
| deterministic fixtures | required | required | required |
| parity/QualityVector gate | oracle | canonical target | canonical target |

Add adversarial cases:
- empty graph;
- duplicate IDs;
- dangling ports;
- non-finite coordinates;
- huge coordinates;
- zero/negative dimensions according to contract policy;
- thousands of nodes/edges;
- repeated rapid patches;
- cancellation during heavy routing/NLP;
- registry package collision;
- unsupported registry schema;
- Worker crash/timeout;
- persistence quota/write failure.

---

# 15. Performance budgets and observability

Do not optimize against a single aggregate `durationMs`.

Capture:

```text
resolveMs
serializeRequestMs
transportMs
engineMs
serializeResponseMs
materializeResultMs
persistMs
```

For incremental scenes additionally capture:

```text
dirtyNodes
dirtyEdges
reroutedEdges
reusedEdges
spatialIndexUpdates
cancelledWork
```

SDK telemetry must remain an adapter and be disabled/no-op by default. Core logic must never require a telemetry vendor.

---

# 16. Compatibility and deprecation rules

1. Breaking public SDK changes require a SemVer major after 1.0.
2. Before 1.0, every breaking change must still have an explicit migration note.
3. Protocol breaking change requires a new protocol version and explicit negotiation failure, never heuristic parsing.
4. Registry schema breaking change requires a schema version/migration path.
5. Snapshot format changes require migration or explicit incompatibility error.
6. Host-specific compatibility aliases must have a documented removal release.
7. Deprecated exports remain covered by tests until removed.
8. `auto`/fallback behavior changes are treated as behaviorally significant API changes.

---

# 17. Security / robustness rules for embedding

Even though AutoTrace is not an auth/security library, an embeddable engine processes untrusted host data and must fail safely.

Required protections:
- explicit graph size/resource limits configurable by host;
- reject non-finite and structurally invalid geometry before expensive work;
- bounded timeout/cancellation policies at transport layer;
- no `eval`/dynamic code execution from registry packages;
- SVG/icon registry content treated as data and sanitized/escaped by renderers, not trusted by core;
- no network access from base SDK/core;
- no automatic telemetry or AI-provider calls from base SDK;
- deterministic errors without leaking unrelated host state;
- isolation between clients/scenes.

---

# 18. Merge/release gates

## P0 merge gate

P0 is complete when:
- option regression fixed;
- protocol codec unified;
- runtime strict policy exists;
- Worker ownership correct;
- host-specific bridge removed from universal API;
- client/runtime isolation proven;
- registry participates in canonical scene materialization;
- SDK package dependency graph separated;
- packaged WASM Worker runs in a clean browser fixture;
- SDK consumer CI is required and green.

At this point embedding readiness target: **>= 8/10**.

## P1 release-candidate gate

P1 is complete when:
- schema/version contracts are explicit;
- Go/TS golden fixtures are green;
- Go module/API versioning exists;
- compatibility/documentation matrix exists;
- persistence is host policy;
- tested public quickstarts exist;
- optional generic stdio transport is available or consciously deferred.

Embedding readiness target: **>= 9/10**.

## 1.0 gate

Do not call the reusable engine/SDK 1.0 until:
- master-plan mathematical parity/cutover requirements for the production runtime are satisfied;
- public API compatibility gate is active;
- no P0 embedding defect remains;
- consumer matrix is green from packed/released artifacts;
- runtime/contract/registry versions are externally observable;
- upgrade/migration notes exist;
- package installation does not require undocumented repository knowledge.

---

# 19. What not to do

Until P0 is complete, avoid spending the main development budget on:
- additional UI-only features;
- new framework-specific state models;
- new global singleton APIs;
- premature native FFI bindings;
- binary protocol replacement;
- additional routing algorithms that do not close a demonstrated product need;
- silent compatibility fallbacks.

The current highest-leverage work is **productizing the strong core that already exists**.

---

# 20. Expected end-state developer experience

## TypeScript/browser

```ts
import { createAutoTraceClient } from '@autotrace/sdk';
import { createWasmWorkerRuntime } from '@autotrace/wasm';

const runtime = await createWasmWorkerRuntime();
const client = createAutoTraceClient({
  runtime,
  registry,
  persistence: false,
});

const scene = await client.openScene({ id: 'main', nodes, edges });
await scene.patch({ nodes: { upsert: [movedNode] } });
await scene.dispose();
await client.dispose();
```

The host does **not** need to know about `wasm_exec.js`, global functions, AutoTraceLab folders or React internals.

## Go

```go
engine := core.NewEngine()
result, err := engine.OpenWithContext(ctx, core.SceneOpenRequest{
    GraphID: "main",
    Nodes: nodes,
    Edges: edges,
    Options: opts,
})
```

Both paths operate under the same explicit contract semantics and are validated by the same golden fixtures and release gates.

---

## Execution rule

Implement `EP-001` through `EP-020` in order unless a dependency discovered during implementation requires reordering. Each completed item must add or strengthen its regression/consumer tests before the next item begins. Mathematical behavior and Go cutover remain governed by `MASTER_IMPLEMENTATION_PLAN.md`; this annex governs the quality of the reusable embedding surface around that core.
