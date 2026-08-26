# AutoTraceLab — Pareto implementation plan

Status: proposed / expanded  
Baseline commit: `6f0bcac419e04d062b22470920774537301b2778`  
Plan revision: 2  
Priority model: maximize routing quality, interactive latency, correctness, embeddability, customization and maintainability per unit of engineering effort.

## 0. Executive summary

AutoTraceLab already contains two valuable foundations:

1. a browser UI with several experimental TypeScript layout/routing algorithms;
2. an importable Go core with a versioned protocol and revisioned incremental scenes.

The largest current loss is that these foundations are not yet one runtime. `src/App.tsx` still calls TypeScript algorithms synchronously on the browser main thread, while `go_engine/core` is a separate production-oriented path. At the same time, the Go orthogonal A* checks every node from the `blocked` predicate for almost every expanded grid state, and its emergency fallback can return a route that has not been proven obstacle-free.

A second strategic requirement is now explicit: AutoTrace must evolve from a single application into a **reusable, headless diagram/routing core that can be embedded into other applications**, while preserving a very simple customization experience. Block types, connection types, port types, icons, shapes, themes and visual rules must become administrable data, not hard-coded React/Go branches.

The Pareto strategy is therefore:

- **P0.1 — One production engine:** make Go Core the single source of truth for routing/metrics and call it from the UI through a Web Worker + WASM, using `scene.open` / `scene.patch` for incremental updates.
- **P0.2 — Replace per-state obstacle scans:** add a reusable spatial/occupancy index and then a sparse orthogonal visibility graph so route search no longer performs O(nodes) obstacle checks on every A* expansion.
- **P0.3 — Make quality measurable:** add a representative benchmark corpus, correctness invariants, fuzz/property tests and performance/quality regression gates.
- **P0.4 — Establish the reusable-core boundary now:** separate semantic graph data, routing geometry, rendering/style and host application services before the current model becomes harder to extract.
- **P0.5 — Introduce versioned type registries:** block, edge, port, shape, icon and theme definitions become declarative, validated and serializable; graph instances reference stable type IDs rather than duplicating configuration.
- **P1 — Build a no-code administration/customization layer:** live theme editor and object-library manager for block/connection/port types, shapes, icons and defaults.
- **P1 — Improve global route quality:** congestion-aware routing, route ordering, rip-up/reroute, channel nudging and stability penalties.
- **P1 — Harden delivery:** full frontend/Go/WASM CI, least privilege, provenance, one package-manager policy and versioned SDK artifacts.

The architectural rule for all future work is:

> **Semantics are not rendering. Rendering is not routing geometry. Host integration is not core logic.**

A block type must not be represented by a React component. A connection type must not be represented by a switch statement in the canvas. A theme change must not cause rerouting. A host application must be able to use AutoTrace in router-only/headless mode without importing React or the AutoTraceLab UI.

---

# 1. Current-state findings

## 1.1 Two routing implementations are evolving independently

Relevant files:

- `src/algorithms/*.ts`
- `src/App.tsx`
- `go_engine/*.go`
- `go_engine/core/*.go`
- `go_engine/wasm_bridge_js.go`
- `go_engine/protocol.go`

Examples of duplicated concepts include block geometry, labels, metrics, artifact cleaning, orthogonal routing and NLP optimization. The newer `go_engine/core` package is already becoming a stable importable API, but the UI does not use it as the normal execution path.

**Risk:** numerical and behavioral drift, duplicated bug fixes, benchmark results that describe a different implementation from the one shipped to consumers.

## 1.2 Browser routing is synchronous and runs on the UI thread

`src/App.tsx::computeRouting` directly executes CPU-heavy TypeScript routing and metrics. It is called after layout, on option changes, and after node movement.

**Risk:** graph size directly becomes UI jank. Increasing algorithm quality by doing more work makes interaction worse.

## 1.3 Go A* has a high-cost obstacle predicate

`go_engine/core/orthogonal_router.go::routeOne` creates a `blocked(x,y)` closure that loops through all nodes. A* invokes this predicate for neighboring states, so the effective work grows roughly with:

`expanded_states × neighbors × node_count`

before heap/map overhead is counted.

The implementation also rebuilds routing search structures for each edge instead of sharing a scene-level representation.

## 1.4 Route failure is not a first-class result

If A* does not find a goal, `routeOne` constructs a simple fallback bend sequence. That fallback is not itself proven clear of obstacles.

Production rule: it is better to return explicit `no_path` / degraded state than silently output an illegal route.

## 1.5 Incremental scene architecture exists but is underused

`go_engine/core/scene_engine.go` already supports revisioned scenes, conflict detection, route reuse, dirty-node / dirty-edge rerouting, snapshots and a protocol surface.

This is high-value infrastructure. Promote it into the default UI execution model instead of building another incremental layer in TypeScript.

## 1.6 The current data model already hints at customization, but it is instance-oriented

`BlockNode` already contains fields such as `Color`, `Shape`, `ImageURL`, `IconName`, size constraints and routing clearance. `Port` already contains placement, type, side, group, color and spacing information.

This is useful for experiments, but production customization should not require every block instance to repeat its complete visual and behavioral definition.

The missing abstraction is:

```text
Block instance -> BlockTypeDefinition -> Shape/Icon/Theme/Port templates
Edge instance  -> EdgeTypeDefinition  -> Routing profile/visual/semantic rules
Port instance  -> PortTypeDefinition  -> compatibility/appearance/default behavior
```

Without this registry layer, reuse and administration will become increasingly difficult.

## 1.7 Appearance and routing-affecting geometry are currently too easy to mix

A future customization system must classify every property by invalidation domain:

- **render-only:** colors, icon, font, shadows, decorative stroke, selection/hover style;
- **layout-only:** preferred size, label dimensions, layout hints;
- **routing-geometry:** obstacle shape, size, clearance, port position, port side;
- **routing-cost:** bend/crossing/channel policy;
- **semantic-only:** labels, metadata schema, connection compatibility.

Render-only changes must not invalidate route indexes.

## 1.8 CI covers only part of the system

`.github/workflows/go-engine.yml` tests and vets Go, then builds WASM and publishes immutable releases. It does not validate the frontend on normal changes. The workflow grants write permission more broadly than test/build require.

There are also both `package-lock.json` and `bun.lock`, while README instructs users to run npm, allowing dependency-resolution drift.

## 1.9 Project documentation does not describe the actual architecture

The root README is still generic bootstrap documentation. It does not explain AutoTrace Core, protocol, embedding modes, customization schema, registries, benchmarks or release contracts.

---

# 2. Target architecture

## 2.1 Logical layers

```text
Host application
  |
  | HostAdapter / persistence / auth / telemetry / asset resolution
  v
AutoTrace SDK
  |-- EngineClient
  |-- RegistryClient
  |-- Theme API
  |-- Scene/patch types
  |-- capability negotiation
  v
Runtime adapter
  |-- Go native import
  |-- Go/WASM Worker
  |-- optional server/RPC adapter
  v
AutoTrace Headless Core
  |-- SceneEngine
  |-- TypeRegistry
  |-- SemanticValidator
  |-- GeometryResolver
  |-- SceneIndex
  |-- OrthogonalRouter
  |-- RouteValidator
  |-- GlobalRouter
  |-- Labels
  |-- Metrics
  `-- Contract/versioning

Optional UI packages
  |-- React editor adapter
  |-- AutoTraceLab application
  |-- Admin/customization UI
  `-- future framework adapters / Web Component
```

## 2.2 Runtime architecture in AutoTraceLab

```text
React UI
  |
  | typed commands / graph patches / registry edits
  v
EngineClient + RegistryClient
  |
  v
Dedicated Web Worker
  |
  v
Go/WASM protocol adapter
  |
  v
go_engine/core
```

## 2.3 Core principles

1. **Go Core is the production source of truth.**
2. **Core is headless and has no React/browser/UI dependency.**
3. **The browser main thread never performs full routing.**
4. **A scene owns reusable geometry/search indexes.**
5. **Every graph edit is revisioned and incremental.**
6. **All successful routes are validated before return.**
7. **Quality and speed are compared against a frozen corpus.**
8. **Graph semantics are separated from appearance.**
9. **Type definitions are declarative, versioned and data-driven.**
10. **Graph instances reference type IDs plus minimal per-instance overrides.**
11. **Visual-only changes do not invalidate routing.**
12. **Host services are injected through interfaces; core never assumes localStorage, a specific DB, authentication system or application shell.**
13. **Every embedding mode uses the same contract/conformance suite.**
14. **Experimental TypeScript algorithms may remain as research/reference implementations only.**

---

# 3. P0 — highest-return work

## P0.1 Make Go Core the only production routing engine

### Goal

Eliminate implementation drift and move expensive routing off the UI thread while immediately reusing the existing incremental scene engine.

### Files to add

- `src/engine/types.ts`
- `src/engine/EngineClient.ts`
- `src/engine/protocol.ts`
- `src/engine/autotrace.worker.ts`
- `src/engine/wasmLoader.ts`
- `src/engine/__tests__/EngineClient.test.ts`
- `src/engine/__tests__/protocolParity.test.ts`

### Files to change

- `src/App.tsx`
- `src/types.ts`
- `src/components/BenchmarkPanel.tsx`
- `go_engine/protocol.go`
- `go_engine/wasm_bridge_js.go`
- `public/`
- `vite.config.*` if required

### Atomic implementation steps

1. Define typed TypeScript protocol representation.
2. Implement `EngineClient.hello()` and capability/version negotiation.
3. Load Go WASM inside a Dedicated Worker, not `window`.
4. Expose an AutoTrace-owned stable worker interface; keep legacy globals only as compatibility aliases.
5. Implement request correlation with `requestId`.
6. Add `scene.open`, `scene.patch`, `scene.snapshot`, `scene.close` methods.
7. Replace `App.tsx::computeRouting` production path with `EngineClient`.
8. On graph load/preset change call `scene.open` once.
9. On node/edge/options edits generate minimal patches.
10. Coalesce rapid drag patches.
11. Reject stale worker responses by revision.
12. Recover deterministically from revision conflicts.
13. Add engine status: `loading`, `ready`, `degraded`, `error`.
14. Keep TS algorithms behind explicit research mode.
15. Add parity tests on frozen fixtures.
16. Remove production imports of TS routing/metrics after parity gates pass.

### Acceptance criteria

- Full routing never executes on browser main thread.
- Node dragging sends scene patches rather than complete graph reroutes.
- Stale responses cannot overwrite newer state.
- UI remains interactive during 300+ edge routing.
- Production metrics come from the same Go Core that produced routes.
- Native Go and WASM are structurally equivalent on compatibility corpus.

---

## P0.2 Build scene-level spatial index and sparse orthogonal routing graph

### Files to add

- `go_engine/core/scene_index.go`
- `go_engine/core/occupancy.go`
- `go_engine/core/visibility_graph.go`
- `go_engine/core/route_validator.go`
- tests for each

### Phase A — low-risk occupancy index

1. Introduce `SceneIndex` owned by scene state.
2. Precompute inflated obstacle geometry.
3. Build occupancy once per geometry/options revision.
4. Use row bitsets, interval rows or other representation selected by benchmarks.
5. Make blocked-state checks O(1) or O(log n), not O(nodes).
6. Cache port coordinates and node lookups.
7. Invalidate only touched regions on patches.
8. Reuse A* buffers to reduce allocations.

### Phase B — sparse orthogonal visibility graph

1. Add candidate vertices at obstacle corners/channel lines/port escape points.
2. Build horizontal/vertical visibility edges with sweeps.
3. Reuse graph across all edges in scene.
4. Incrementally invalidate affected regions.
5. Route with A* over sparse graph.
6. Retain verified grid A* as fallback while visibility routing matures.
7. Select strategy only from benchmark evidence.

### Route status and validation

Introduce explicit route status:

```go
type RouteStatus string

const (
    RouteOK       RouteStatus = "ok"
    RouteDegraded RouteStatus = "degraded"
    RouteNoPath   RouteStatus = "no_path"
)
```

Every successful route must pass invariants:

- correct source/target;
- finite geometry;
- no zero-length normalized segments;
- orthogonality for orthogonal mode;
- no forbidden obstacle intersection;
- valid port exit direction;
- endpoint geometry rules respected.

If preferred routing fails:

1. retry with widened budget;
2. retry verified fallback;
3. return `no_path`.

Never synthesize an unchecked L-shaped route.

### Performance targets

Initial targets to validate against corpus:

- 100 nodes / 200 edges: p95 full route < 50 ms native;
- 300 nodes / 600 edges: p95 full route < 150 ms native;
- single-node edit in 300/600 scene: p95 incremental patch < 16 ms when dependency locality is small;
- WASM budget measured separately;
- allocations/op materially reduced after cache/index reuse.

---

## P0.3 Create benchmark corpus and quality regression system

### Files to add

- `testdata/corpus/README.md`
- `testdata/corpus/*.json`
- `go_engine/core/corpus_test.go`
- `go_engine/core/router_benchmark_test.go`
- `go_engine/core/router_fuzz_test.go`
- `go_engine/core/quality_gate_test.go`
- `scripts/bench.sh`
- `scripts/bench.ps1`
- `scripts/compare-benchmarks.*`
- `benchmarks/baseline.json`
- `benchmarks/QUALITY_GATES.md`

### Corpus families

Include deterministic fixtures for chains, fan-in/out, trees, DAGs, grids, sparse/dense random graphs, many-port nodes, narrow channels, almost-touching obstacles, corridor traps, long-distance links, high crossing pressure, node movement sequences, adversarial search and malformed protocol inputs.

Scale buckets:

- S: 10–20 nodes;
- M: 50–100;
- L: 100–300;
- XL: 300–1,000;
- stress: >1,000 outside normal PR gate.

### Measure

Performance:

- p50/p95/p99;
- allocations/op and bytes/op;
- expanded states;
- heap operations;
- obstacle/index queries;
- rerouted/reused edges;
- visibility graph size;
- WASM startup;
- worker round-trip.

Correctness:

- invalid routes;
- obstacle intersections;
- invalid exits;
- non-orthogonal segments;
- route failures;
- panic/protocol failures.

Quality:

- crossings;
- bends;
- normalized wire length;
- label collisions;
- shared-path overlap;
- spacing violations;
- port alignment;
- route churn.

### Fuzz/property tests

Assert no panic, deterministic output, finite values, valid successful routes, snapshot isolation, strict revision rules, consistent open/patch/snapshot behavior, no dangling valid edges and stable encode/decode.

### CI gates

Fail on new hard violation, native/WASM mismatch, fuzz regression, unacceptable quality degradation or statistically significant performance regression beyond configured budget.

---

## P0.4 Establish a reusable headless-core boundary

### Goal

Make AutoTrace a library first and AutoTraceLab one consumer of that library.

This must be done before customization becomes broad, otherwise UI-specific concepts will leak into the public contract and become expensive to remove.

### Required embedding modes

The architecture must support at least:

1. **router-only:** host supplies nodes/ports/edges and receives paths;
2. **headless scene engine:** host uses revisioned scenes without renderer;
3. **viewer:** rendering + selection, no editing;
4. **editor:** full interaction and type registry;
5. **batch/server:** native Go without browser/WASM;
6. **WASM Worker:** browser embedding;
7. **future RPC/service adapter:** optional remote core without changing scene model.

### Core public objects

Stabilize a small public surface:

```text
Engine
Scene
ScenePatch
RoutingOptions
RegistrySnapshot
ThemeDefinition
BlockTypeDefinition
EdgeTypeDefinition
PortTypeDefinition
ShapeDefinition
IconDefinition
Capabilities
ValidationReport
```

Do not expose internal A* heap/search/index structures.

### Host interfaces

The headless core / SDK must not directly depend on application infrastructure. Define adapters/interfaces for:

- persistence;
- registry storage;
- asset/icon resolution;
- logging;
- metrics/telemetry;
- authorization decisions where required by host;
- time/ID generation if deterministic tests require injection.

The default AutoTraceLab implementation may provide simple local adapters, but they must not become core requirements.

### Package boundary direction

Near-term repository structure:

```text
go_engine/
  core/              # headless semantic + geometry + routing core
  protocol/          # eventually extract current protocol surface if useful

src/
  engine/            # TS client/worker adapter
  registry/          # TS registry client/types generated from contract
  renderer/          # rendering adapter
  features/          # AutoTraceLab-specific UI
  shared/
```

Long-term distribution may evolve to:

```text
@autotrace/sdk
@autotrace/react
@autotrace/admin
Go module: github.com/Homiakus/autotraceLab/go_engine/core
WASM artifact: autotrace-core.wasm
```

Do not perform a repository split until APIs stabilize; create clean boundaries first.

### Embedding API requirement

A host should be able to initialize with roughly this conceptual shape:

```ts
const autotrace = await createAutoTrace({
  engine: workerEngine,
  registry: hostRegistry,
  theme: hostTheme,
  assets: hostAssetResolver,
});
```

and optionally mount a renderer/editor separately.

### Acceptance criteria

- `go_engine/core` imports no UI/browser package.
- routing works in native Go tests with no React/JS runtime.
- the same scene fixture works via native Go and WASM Worker.
- host application identity does not appear in new stable API names.
- AutoTraceLab can be treated as a consumer of the SDK, not the owner of internal engine state.

---

## P0.5 Introduce versioned declarative type registries

### Goal

Make block types, connection types, port types, shapes, icons and themes configurable without code changes while keeping routing deterministic and embeddings portable.

### Fundamental rule

**A type is data, not executable UI code.**

Do not store arbitrary JavaScript callbacks/components in serialized type definitions. Extension points that truly require code must use explicit host-side plugin interfaces and remain outside portable registry packages.

### Registry entities

#### `BlockTypeDefinition`

Recommended fields:

```text
id / namespace
version
displayName
description
category
tags
shapeRef
iconRef
defaultSize
minSize / maxSize
autoSize policy
portTemplates[]
styleTokenOverrides
routing profile overrides
layout hints
metadataSchema
inspectorSchema
capabilities
status: draft | published | deprecated
```

#### `PortTypeDefinition`

```text
id / version
direction: input | output | bidirectional | neutral
semantic/data type
allowed sides
default placement
min spacing
visual token/icon
multiplicity
compatibility tags
```

#### `EdgeTypeDefinition`

```text
id / version
displayName
source compatibility rules
target compatibility rules
multiplicity
routing profile
clearance/channel policy
stroke token
width token
dash pattern
start marker
end marker
label policy
bridge/crossover policy
semantic metadata schema
```

#### `ShapeDefinition`

Separate **visual shape** from **routing obstacle geometry**.

A shape may define:

- visual primitive: rectangle, rounded rectangle, diamond, ellipse, capsule, hexagon, document, card, custom sanitized SVG path;
- obstacle model: rectangle, rounded rectangle, polygon or conservative bounds;
- anchor/port regions;
- default content slots;
- resizing rules.

Routing must never infer obstacle geometry by inspecting DOM/SVG pixels.

#### `IconDefinition` / `IconPackDefinition`

Use symbolic references, not arbitrary inline application code.

Support:

- built-in icon packs;
- custom sanitized SVG icons;
- categories/tags/search aliases;
- versioned icon packs;
- content hashes for reproducibility.

Never allow script execution, external event handlers or unsanitized SVG active content.

#### `ThemeDefinition`

Theme is a design-token graph rather than scattered colors:

```text
canvas.*
text.*
surface.*
border.*
node.*
port.*
edge.*
selection.*
hover.*
focus.*
error.*
warning.*
accent.*
font.*
spacing.*
radius.*
stroke.*
```

Support light/dark/high-contrast variants and host-provided token inheritance.

### IDs and namespaces

Use stable namespaced IDs, e.g.:

```text
core/block/process
core/edge/data
my-app/block/pump
my-company/icon/valve
```

A graph instance stores `typeId` and optionally a resolved/pinned type version depending on workspace reproducibility policy.

### Registry package format

Introduce a portable JSON package:

```text
manifest
  packageId
  version
  contractVersion
  dependencies
  contentHash
blocks[]
ports[]
edges[]
shapes[]
icons[]
themes[]
migrations[]
```

Requirements:

- JSON Schema validation;
- deterministic canonical serialization where hashing matters;
- import/export;
- dependency validation;
- namespaced conflict handling;
- version pinning;
- migration support;
- no executable code in portable package.

### Resolution precedence

Use predictable composition:

```text
core defaults
  -> installed registry package
  -> workspace theme/type override
  -> graph-level override
  -> instance override (only explicitly allowed fields)
  -> transient interaction state (selected/hover/error)
```

Do not allow arbitrary instance overrides for every property; otherwise type administration loses its value.

### Invalidation classes

Every schema property must declare or map to an invalidation class:

1. `render` — repaint only;
2. `layout` — recompute block/layout geometry, then affected routing if size/position changed;
3. `routingGeometry` — rebuild affected obstacle/port index and reroute dependencies;
4. `routingCost` — reroute affected/all relevant edges;
5. `semantic` — validate compatibility; reroute only if semantic change modifies topology/profile.

Examples:

- change edge color -> render only;
- change icon -> render only;
- change theme -> render only unless theme changes measured content geometry by explicit policy;
- change block width -> layout/routing geometry;
- change shape obstacle polygon -> routing geometry;
- move port -> routing geometry;
- change edge routing profile -> routing cost;
- rename block type -> semantic/render metadata only.

### Files to add

Suggested Go side:

- `go_engine/core/registry.go`
- `go_engine/core/type_definitions.go`
- `go_engine/core/registry_validation.go`
- `go_engine/core/registry_resolver.go`
- `go_engine/core/registry_migration.go`
- `go_engine/core/style_invalidation.go`
- tests

Suggested TS side:

- `src/registry/types.ts`
- `src/registry/RegistryClient.ts`
- `src/registry/resolve.ts`
- `src/registry/invalidation.ts`
- tests

### Acceptance criteria

- a new block type can be created from data without editing `DiagramCanvas.tsx`;
- a new edge type can be created without adding a routing switch branch;
- graph instances can reference types by stable IDs;
- registry round-trip is deterministic;
- invalid definitions are rejected with path-specific errors;
- theme/icon/color changes do not reroute the scene;
- shape/port geometry changes reroute only affected dependencies;
- portable registry packages contain no executable JS.

---

# 4. P1 — second wave after the P0 foundation

## P1.1 Add congestion-aware multi-edge routing

Cost function must lexicographically protect hard constraints:

1. invalid geometry: forbidden;
2. obstacle violation: forbidden;
3. invalid port direction: forbidden;
4. crossings: high penalty;
5. congested shared channel: penalty;
6. bends: penalty;
7. length: base cost;
8. route churn: stability penalty.

Add:

- `congestion.go`
- `route_order.go`
- `ripup_reroute.go`
- `nudging.go`

Steps:

1. Route difficult edges first.
2. Maintain scene segment occupancy/congestion field.
3. Apply crossing/shared-path penalties during search.
4. Detect worst offenders after first pass.
5. Rip-up/reroute bounded top-k offenders.
6. Stop on no improvement or budget.
7. Nudge overlapping orthogonal segments.
8. Keep deterministic tie-breaking.

---

## P1.2 Make incremental routing spatially precise

1. Store route bounding boxes / segment index.
2. Map spatial regions to affected edge IDs.
3. Dirty only edges intersecting changed obstacle inflation/dependency region.
4. Recompute only local visibility/occupancy structures.
5. Add explicit geometry/options revisions.
6. Separate render revision from layout revision and routing revision.

Target: local edits scale with affected geometry, not total graph size.

---

## P1.3 Stabilize layout as well as routing

Support:

- fixed/pinned nodes;
- fixed port sides/order;
- layout constraints;
- previous-position preservation;
- deterministic overlap removal;
- layout stability metrics.

Select one layered and one free-form production layout. Keep others research-only until gates pass.

---

## P1.4 Refactor frontend around engine, registry and renderer boundaries

Recommended structure:

```text
src/
  app/
  engine/
  registry/
  renderer/
  admin/
  features/
    canvas/
    routing-controls/
    inspector/
    benchmark/
    block-editor/
    type-library/
    appearance/
  shared/
    ui/
    geometry/
    types/
```

Changes:

- isolate graph state from view state;
- isolate registry state from scene instances;
- remove `any` at protocol/registry boundaries;
- memoize expensive visual derivations;
- render only changed entities where practical;
- support cancellation/abort for long operations;
- centralize command system;
- use renderer mapping driven by resolved type definitions rather than semantic switch statements.

---

## P1.5 Build a simple, broad customization and administration UI

### Goal

A non-developer should be able to configure appearance and domain object libraries without editing JSON or source code, while advanced users retain import/export and exact control.

### Navigation

Add a dedicated **Customization / Library** workspace with these sections:

1. Appearance;
2. Block types;
3. Connection types;
4. Port types;
5. Shapes;
6. Icons;
7. Routing profiles;
8. Registry packages;
9. Validation / migrations.

### Appearance editor

Provide live preview and simple controls for:

- light/dark/base mode;
- canvas background/grid;
- primary/accent/semantic colors;
- node surfaces/borders/text;
- edge defaults;
- selection/hover/focus states;
- fonts and scale;
- corner radius/style presets;
- density/spacing;
- optional shadows/elevation;
- port size/visibility;
- labels;
- accessibility/high-contrast preview.

UX requirements:

- immediate preview;
- undo/redo;
- reset token/section/theme;
- duplicate theme;
- export/import theme;
- compare to base theme;
- never reroute for render-only edits.

### Block type editor

Wizard flow:

1. name/category/tags;
2. choose shape;
3. choose icon;
4. choose default/min/max size;
5. configure content/label layout;
6. add input/output/bidirectional port templates;
7. place ports visually on sides/anchors;
8. configure metadata fields shown in inspector;
9. configure routing clearance/layout hints;
10. preview with sample connections;
11. validate;
12. save draft/publish.

Support duplicate-from-existing as the fastest path to customization.

### Connection type editor

Allow no-code configuration of:

- source/target compatible port types;
- multiplicity;
- routing profile;
- line style/width/color token;
- arrow/marker start/end;
- labels;
- crossover/bridge appearance;
- semantic metadata;
- priority/class used by global router.

### Port type editor

Allow configuration of:

- direction;
- semantic/data type;
- compatible connection types;
- default side/allowed sides;
- multiplicity;
- spacing;
- shape/icon/visual token;
- label behavior.

### Shape editor

Provide two levels:

**Simple mode:** choose built-in primitive and adjust supported parameters.

**Advanced mode:** import sanitized SVG path or polygon with explicit obstacle/anchor geometry preview.

Critical rule: user must be able to see both visual outline and routing obstacle outline, because they may differ.

### Icon manager

Features:

- built-in searchable icon catalog;
- custom SVG upload/import;
- tag/category management;
- pack import/export;
- preview at multiple sizes;
- sanitation/validation result;
- replace icon while preserving stable symbolic ID when desired.

### Routing profile editor

Create reusable profiles such as:

```text
Default
Compact
Wide-clearance
Signal
Power
Control
Bus
Presentation
```

Profile properties may include grid, clearance, channel spacing, bend/crossing weights, bridge policy, preferred direction and fallback policy.

### Lifecycle management

Every administrable definition needs:

- draft;
- published;
- deprecated;
- duplicate;
- version history;
- rollback;
- dependency view;
- usage count/reference search;
- migration preview before destructive changes.

Published type versions referenced by existing documents must not mutate silently if reproducibility mode is enabled.

### Import/export

Support:

- one definition;
- selected definitions with dependencies;
- complete workspace library;
- complete theme;
- portable registry package.

Before import show:

- incoming package identity/version;
- conflicts;
- dependencies;
- affected existing definitions;
- migration actions;
- validation errors.

### Acceptance criteria

- user creates a new block type from UI in minutes without code;
- user creates a new connection type and compatibility rule without code;
- user changes global visual style from one screen with live preview;
- user can duplicate, version, export/import and rollback definitions;
- invalid custom SVG/registry package cannot inject executable content;
- all UI actions use the same registry APIs available to embedding hosts.

---

## P1.6 Make customization portable across embedded applications

### Workspace configuration

Define a portable workspace object:

```text
WorkspaceDefinition
  registry packages
  active theme
  routing profiles
  feature flags/capabilities
  editor defaults
  optional host policy references
```

A host must be able to supply a workspace entirely in memory, from a file, DB or remote service.

### Persistence abstraction

Provide baseline adapters:

- in-memory;
- JSON/file for native tooling;
- browser local storage only in AutoTraceLab adapter, not core;
- host-supplied adapter.

### Reproducibility

A saved graph/workspace should record enough information to reproduce behavior:

- contract version;
- engine version where appropriate;
- registry package IDs/versions/hashes;
- active theme ID/version;
- routing profile IDs/versions;
- graph scene data.

### Capability negotiation

Extend `hello` so host can discover supported features, e.g.:

```text
incrementalScenes
registries
registryVersion
customShapes
customIcons
themes
routingProfiles
nativeEmbedding
wasmEmbedding
```

### Conformance kit

Create fixtures/tests every embedding adapter must pass:

- open/patch/snapshot/close;
- registry load/resolve;
- type compatibility validation;
- theme resolution;
- invalidation behavior;
- serialization round-trip;
- route parity;
- deterministic resolution order.

---

## P1.7 Security and robustness for portable customization

Because external applications may import user-generated packages, registry content must be treated as untrusted data.

Requirements:

- strict size/count/depth limits;
- JSON schema validation;
- canonical IDs and namespace validation;
- dependency cycle detection;
- SVG sanitization;
- no scripts/event handlers/foreign objects by default;
- safe URL/asset policy controlled by host;
- no arbitrary JS expressions in inspector schema;
- bounded custom polygon/path complexity;
- content hashing;
- explicit migration execution model;
- fuzz registry parser/resolver;
- graceful errors with JSON path / entity ID.

A malformed theme/icon/type package must not crash or poison the routing scene.

---

## P1.8 Upgrade toolchain, CI and release model

### Go

1. Run suite on current supported Go toolchain.
2. Update `go.mod` after compatibility passes.
3. Add `go test -race ./...` for native paths.
4. Add benchmark jobs.
5. Add fuzz smoke PR runs and longer scheduled fuzzing.
6. Capture pprof hotspots for representative corpus.
7. Evaluate PGO only after corpus is representative.

### Frontend

Add workflow for:

- `npm ci`;
- typecheck;
- tests;
- production build;
- Worker/WASM integration;
- registry schema/conformance tests;
- optional browser smoke.

### One package manager

Choose one canonical manager and lockfile. README, CI and release must match it.

### Permissions/provenance

- read-only permissions for test/build;
- write only for release job;
- provenance/attestations for WASM and distributable registry/SDK packages;
- SHA256 remains useful for offline verification.

### Versioned artifacts

Distinguish:

- CI artifact per successful commit;
- immutable engine artifact by commit;
- stable semver engine/SDK release;
- registry contract version;
- theme/type package version.

Do not couple all version numbers unnecessarily; define compatibility matrix.

---

# 5. P2 — after performance/correctness/customization foundation

## P2.1 Documentation as a product interface

Replace generic README with:

1. what AutoTraceLab and AutoTrace Core are;
2. architecture;
3. quick start;
4. native Go usage;
5. WASM Worker usage;
6. embedding SDK;
7. registry/type customization;
8. theme customization;
9. protocol/versioning;
10. benchmarks/quality;
11. artifact verification;
12. contributing/testing.

Add:

- `docs/ARCHITECTURE.md`
- `docs/EMBEDDING.md`
- `docs/CUSTOMIZATION.md`
- `docs/TYPE_REGISTRY.md`
- `docs/THEMING.md`
- `docs/ROUTING_CONTRACT.md`
- `docs/BENCHMARKING.md`
- `docs/PROTOCOL.md`
- `docs/ADR/`

## P2.2 One machine-readable contract source

Use JSON Schema or generated schema metadata as the source for portable models where practical.

Contract evolution rules:

- additive compatible changes preferred;
- removal/rename requires appropriate major contract bump;
- unknown fields tolerated where safe;
- capability negotiation via `hello`;
- responses include engine/contract metadata;
- type registry schemas and scene schemas evolve independently only when explicitly versioned.

## P2.3 Observability

Benchmark/admin diagnostics should expose:

- engine/runtime/version;
- scene revision;
- render/layout/routing/registry revisions;
- full vs incremental run;
- reused/rerouted edges;
- route failures;
- expanded states;
- visibility graph size;
- p50/p95;
- hard violations;
- stability/churn;
- registry resolution errors;
- cache hit/invalidation counts.

Composite score may remain for demos; release decisions use underlying vector.

## P2.4 Optional framework-neutral renderer layer

After the headless API and React renderer stabilize, evaluate a framework-neutral renderer boundary or Web Component for easy host integration.

Do not move canvas rendering into Go Core. Core should supply resolved geometry/state; renderer remains independently replaceable.

---

# 6. Customization model in detail

## 6.1 Scene instance should be minimal

Target instance model:

```text
BlockNode
  id
  typeId
  typeVersion? / resolution policy
  position
  explicit size only when instance differs from type/default/layout result
  port instances only when dynamically instantiated
  metadata
  allowed per-instance overrides

EdgeConnection
  id
  typeId
  source block/port
  target block/port
  metadata
  allowed per-instance overrides
  resolved route output
```

Do not copy icon/color/shape/default port rules into every node unless explicitly overridden.

## 6.2 Resolved model should be internal/derived

The engine/renderer can derive:

```text
ResolvedBlock
ResolvedPort
ResolvedEdge
ResolvedStyle
ResolvedRoutingProfile
ResolvedObstacleGeometry
```

Resolved objects can be cached by type version + override hash.

## 6.3 Semantic compatibility

Connection validation should be data-driven:

```text
CanConnect(sourcePort, targetPort, edgeType, registry) -> ValidationResult
```

Validate:

- direction;
- compatible data/semantic types;
- allowed edge types;
- multiplicity;
- host/workspace policies;
- optional domain constraints.

The router consumes only validated topology plus resolved routing profiles.

## 6.4 Shape vs obstacle geometry

Never assume a visual shape is the routing obstacle.

Examples:

- card with icon may route as rectangle;
- rounded rectangle may use conservative rectangle or rounded obstacle depending implementation;
- diamond should expose a polygonal obstacle and explicit anchor regions;
- decorative image does not alter obstacle unless type definition says so.

This separation is essential for custom shapes and deterministic routing.

## 6.5 Theme inheritance

Use token inheritance instead of copying style values:

```text
BaseTheme
  -> DarkTheme
      -> WorkspaceTheme
          -> Type token overrides
              -> Instance allowed overrides
                  -> Interaction state
```

Expose resolved token inspection in admin UI so users can answer “why is this edge this color?”.

---

# 7. Recommended objective function

Do not collapse correctness into one scalar. Use lexicographic gates:

```text
Tier 0: hard validity
  invalid routes == 0
  obstacle intersections == 0
  invalid ports == 0
  NaN/Inf == 0
  registry resolution hard errors == 0

Tier 1: semantic readability
  minimize crossings
  minimize shared-path conflicts
  minimize label collisions

Tier 2: route simplicity
  minimize bends
  minimize wire length

Tier 3: interaction stability
  minimize unaffected-edge churn
  minimize bend-point displacement

Tier 4: execution cost
  minimize p95 latency
  minimize allocations

Tier 5: customization/embedding quality
  render-only change causes 0 route invalidations
  registry resolution deterministic
  portable package round-trip lossless
  native/WASM/SDK conformance green
```

A faster invalid router must never beat a slower valid one.

---

# 8. Benchmark methodology

## 8.1 Native Go

Use standard Go benchmarks with allocation reporting and repeated runs.

```bash
go test ./... -run '^$' -bench . -benchmem -count 10
```

## 8.2 WASM/browser

Run same committed corpus through Worker/WASM and record separately:

- initialization;
- serialization/deserialization;
- worker messaging;
- route compute;
- end-to-end latency.

## 8.3 Incremental edit sequences

Every interactive fixture should include edit traces such as:

```text
open
-> move node
-> move node
-> add edge
-> change port
-> change edge color
-> change icon
-> change block shape geometry
-> remove node
```

Expected invalidation behavior must be part of the fixture.

Example:

- change edge color -> 0 rerouted edges;
- change icon -> 0 rerouted edges;
- move node -> only dependency-local reroutes;
- modify obstacle shape -> affected route dependency reroutes.

## 8.4 Registry benchmarks

Measure:

- registry load/validation time;
- resolution time;
- cache hit rate;
- package import size/time;
- theme resolution;
- invalidation fan-out after type edits.

---

# 9. Concrete CI quality gates

| Gate | PR policy |
|---|---|
| Go unit tests | required |
| Go race test | required for native packages |
| TypeScript typecheck | required |
| Frontend tests | required |
| Production build | required |
| WASM build | required |
| Protocol parity | required |
| Route hard violations | must remain 0 |
| Determinism corpus | required |
| Fuzz seed corpus | required |
| Registry schema tests | required |
| Registry resolution determinism | required |
| Native/WASM embedding conformance | required |
| Render-only invalidation tests | required: 0 reroutes |
| Medium benchmark regression | fail above agreed threshold |
| Quality-vector regression | fail if hard/crossing budget exceeded |
| XL stress | scheduled/informational until stable |
| Artifact provenance | required on distributable artifacts |

---

# 10. Implementation sequence

## Milestone M0 — freeze baseline

- [ ] Record native benchmark baseline.
- [ ] Record current TypeScript baseline.
- [ ] Commit deterministic corpus fixtures.
- [ ] Freeze protocol-v1 fixtures.
- [ ] Document current quality vector.
- [ ] Freeze representative current block/edge/port fixtures for future registry migration.

Exit: future engine and schema changes can be compared objectively.

## Milestone M1 — reusable core boundary + engine unification

- [ ] Define stable headless public core surface.
- [ ] Ensure core has no UI/browser dependencies.
- [ ] Add `src/engine` protocol/client/worker.
- [ ] Load Go WASM in Worker.
- [ ] Connect `hello`.
- [ ] Connect `scene.open/patch/snapshot/close`.
- [ ] Add revision/stale-response handling.
- [ ] Switch production canvas routing to Go Core.
- [ ] Keep TS engine research-only.
- [ ] Add native/WASM parity tests.

Exit: AutoTraceLab consumes the same reusable core external applications can consume.

## Milestone M2 — correctness gates

- [ ] Add `RouteStatus`.
- [ ] Add `ValidateRoute`.
- [ ] Remove unchecked fallback.
- [ ] Add property/fuzz tests.
- [ ] Add hard-violation metrics.
- [ ] Gate PRs on zero invalid routes.

Exit: invalid geometry cannot silently leave engine.

## Milestone M3 — spatial acceleration

- [ ] Add scene obstacle index.
- [ ] Replace per-neighbor node scans.
- [ ] Cache port geometry.
- [ ] Reuse search buffers.
- [ ] Add index invalidation on patches.
- [ ] Benchmark allocations/p95.

Exit: grid A* materially faster without quality loss.

## Milestone M4 — declarative registry foundation

- [ ] Define Block/Port/Edge/Shape/Icon/Theme schemas.
- [ ] Add namespaced IDs/versioning.
- [ ] Add registry resolver/validation.
- [ ] Add default built-in registry package matching current visuals/semantics.
- [ ] Migrate scene instances toward `typeId` references.
- [ ] Implement invalidation classes.
- [ ] Prove theme/icon/color changes reroute zero edges.
- [ ] Add registry import/export and deterministic round-trip tests.
- [ ] Add package migration framework.

Exit: new domain types can be represented as data without canvas/core source edits.

## Milestone M5 — sparse routing + global route quality

- [ ] Build orthogonal visibility graph.
- [ ] Reuse/incrementally invalidate graph.
- [ ] Add congestion map.
- [ ] Add deterministic route order.
- [ ] Add crossing/shared-path penalties.
- [ ] Add bounded rip-up/reroute.
- [ ] Add orthogonal nudging.
- [ ] Add route stability penalty.

Exit: large-scene quality/scaling improve within latency budget.

## Milestone M6 — customization/admin UX

- [ ] Add Appearance editor.
- [ ] Add Block Type editor.
- [ ] Add Edge Type editor.
- [ ] Add Port Type editor.
- [ ] Add Shape editor.
- [ ] Add Icon manager.
- [ ] Add Routing Profile editor.
- [ ] Add draft/publish/deprecate lifecycle.
- [ ] Add dependency/usage view.
- [ ] Add import preview/conflict resolution.
- [ ] Add version history/rollback.
- [ ] Add live preview and undo/redo.

Exit: broad customization is possible without code or manual JSON editing.

## Milestone M7 — embedding SDK and host adapters

- [ ] Define host adapter interfaces.
- [ ] Add in-memory/default adapters.
- [ ] Document native Go embedding.
- [ ] Document WASM Worker embedding.
- [ ] Add TS SDK façade.
- [ ] Add capability negotiation for registries/themes/custom assets.
- [ ] Add embedding conformance suite.
- [ ] Add workspace package export/import.
- [ ] Add reproducibility metadata/version locks.

Exit: another application can embed AutoTrace without depending on AutoTraceLab UI internals.

## Milestone M8 — delivery hardening

- [ ] Upgrade toolchain after compatibility run.
- [ ] Add full frontend CI.
- [ ] Choose one JS package manager.
- [ ] Restrict Actions permissions.
- [ ] Add artifact attestations.
- [ ] Add scheduled fuzz/stress jobs.
- [ ] Define semver/version compatibility matrix for engine/SDK/registry contract.

Exit: distributable engine/SDK artifacts are reproducible, tested and attributable.

## Milestone M9 — architecture/docs cleanup

- [ ] Replace generic README.
- [ ] Document architecture/embedding/customization/contracts.
- [ ] Split large frontend components after boundaries stabilize.
- [ ] Retire duplicated TS production algorithms.
- [ ] Move experiments to explicit research namespace.
- [ ] Add examples: minimal router, embedded viewer, embedded editor, custom domain library.

Exit: repository structure/documentation matches product architecture.

---

# 11. Definition of done for the Pareto program

The program is complete when all are true:

1. Go Core is the only normal production routing/metrics implementation.
2. Core is headless and reusable independently of AutoTraceLab React UI.
3. Browser routing runs in Worker and edits use incremental patches.
4. No route with hard geometric violation can return as successful.
5. Obstacle lookup no longer scans all nodes per A* neighbor.
6. Routing search structures are reused at scene level.
7. Large-scene and incremental performance are benchmarked continuously.
8. Native and WASM share contract/parity/conformance tests.
9. Routing PRs are evaluated on quality vectors, not screenshots alone.
10. Global congestion/rip-up routing is bounded and deterministic.
11. Block, connection and port types are declarative registry entities.
12. Shapes, icons and themes are managed through versioned definitions.
13. New block/edge types do not require canvas source changes.
14. Render-only customization causes zero route invalidation.
15. Routing-geometry edits invalidate only dependency-local routes/indexes where possible.
16. A non-developer can create/duplicate/edit/publish a block or connection type through UI.
17. Themes can be customized with live preview, undo/reset/import/export.
18. Registry packages can be safely imported/exported/versioned/rolled back.
19. Custom SVG/content is sanitized and portable packages execute no arbitrary code.
20. Another application can use router-only, headless scene or editor modes via documented APIs.
21. Host persistence/assets/telemetry are replaceable adapters.
22. Saved workspaces can pin registry/theme/routing profile versions for reproducibility.
23. Go/frontend/WASM/registry conformance are all covered by CI.
24. Distribution artifacts use least privilege and provenance.
25. Documentation explains actual supported execution and extension paths.

---

# 12. Pareto priority table

| Priority | Change | Expected leverage | Effort | Why now |
|---|---|---:|---:|---|
| P0 | Go Core + Worker + incremental UI | 10/10 | Medium | Removes duplication and UI blocking at once |
| P0 | Scene spatial index / occupancy | 10/10 | Medium | Removes dominant repeated obstacle work |
| P0 | Corpus + correctness/perf gates | 10/10 | Medium | Makes every later optimization trustworthy |
| P0 | Headless reusable-core boundary | 10/10 | Medium | Prevents UI/application coupling before API grows |
| P0 | Declarative versioned type registry | 10/10 | Medium/High | Foundation for reuse and no-code customization |
| P0 | Validated route status / no unsafe fallback | 9/10 | Low | Converts silent geometry corruption into explicit state |
| P1 | Appearance/theme token system + invalidation classes | 9/10 | Medium | Broad customization without routing cost |
| P1 | Admin UI for block/edge/port/shape/icon types | 9/10 | Medium/High | Makes customization practical for real users |
| P1 | Embedding SDK + host adapters + conformance kit | 9/10 | Medium | Turns core into reusable product component |
| P1 | Sparse orthogonal visibility graph | 9/10 | High | Best scaling path for interactive obstacle routing |
| P1 | Congestion + rip-up/reroute + nudging | 8/10 | Medium/High | Improves crossings/shared channels globally |
| P1 | Precise incremental invalidation | 8/10 | Medium | Makes local edits independent of total graph size |
| P1 | CI/least privilege/provenance/version policy | 8/10 | Low/Medium | Reliability and supply-chain gain |
| P1 | Layout stability constraints | 7/10 | Medium | Improves editor usability after local edits |
| P2 | Framework-neutral renderer option | 6/10 | Medium/High | Useful only after SDK/React renderer contracts stabilize |
| P2 | Documentation/examples cleanup | 7/10 | Low | Essential for third-party adoption once APIs exist |

---

# 13. Concrete first implementation slices for customization

To avoid a large speculative rewrite, implement customization in vertical slices.

## Slice C1 — theme without reroute

1. Add `ThemeDefinition` and design tokens.
2. Add one default theme matching existing UI.
3. Resolve styles through theme rather than direct hard-coded colors where practical.
4. Add a minimal Appearance panel.
5. Add test asserting theme switch does not call routing/scene patch.

**Value:** immediate visible customization and validates render/routing separation.

## Slice C2 — one registry-driven block type

1. Add `BlockTypeDefinition`.
2. Convert one existing block category to type registry.
3. Resolve shape/icon/default size/ports from registry.
4. Keep current instance format compatible via migration adapter.
5. Add “Duplicate type” UI.

**Value:** proves the model before migrating all types.

## Slice C3 — registry-driven edge + port compatibility

1. Add `PortTypeDefinition` and `EdgeTypeDefinition`.
2. Convert one real edge class.
3. Validate compatibility from registry.
4. Make line/marker/routing profile resolve from edge type.
5. Add simple editor UI.

**Value:** removes hard-coded connection semantics.

## Slice C4 — portable package

1. Export C1–C3 definitions into registry package.
2. Import into clean workspace.
3. Verify identical graph resolution/routing.
4. Add content hashes and migration/version metadata.

**Value:** proves portability and embedding readiness.

## Slice C5 — host embedding example

Create a minimal example application that imports the SDK, injects the registry/theme, opens a scene and renders/receives routes without importing AutoTraceLab application state.

**Value:** catches accidental coupling before it becomes public API debt.

---

# 14. External practice references used for the plan

- Go release history / toolchain: https://go.dev/doc/devel/release
- Go PGO: https://go.dev/doc/pgo
- Go fuzzing: https://go.dev/doc/security/fuzz/
- Web Workers: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
- GitHub build hardening: https://docs.github.com/en/code-security/tutorials/implement-supply-chain-best-practices/securing-builds
- GitHub artifact attestations: https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations
- libavoid interactive obstacle-avoiding routing: https://www.adaptagrams.org/documentation/libavoid.html
- libavoid routing phases/options: https://www.adaptagrams.org/documentation/router_8h.html
- Orthogonal Connector Routing (Wybrow, Marriott, Stuckey): https://people.eng.unimelb.edu.au/pstuckey/papers/gd09.pdf
- Eclipse Layout Kernel interactive layout concepts: https://eclipse.dev/elk/reference/options/org-eclipse-elk-interactiveLayout.html

---

## Final engineering rule

Do not optimize AutoTraceLab toward one attractive demo or one application shell. Optimize it toward a deterministic, validated, benchmarked and **embeddable** diagram engine with a declarative domain/type system.

The intended end state is:

> **AutoTrace Core = reusable headless engine.**  
> **Type Registry = portable domain vocabulary.**  
> **Theme/Shape/Icon system = portable appearance.**  
> **Renderer = replaceable view adapter.**  
> **AutoTraceLab = reference editor, benchmark laboratory and administration UI.**

The highest-value next implementation sequence is **M0 -> M1 -> C1/C2 -> M2/M3**: freeze the baseline, establish the headless/Worker boundary, prove style/type separation with a theme and one registry-driven block type, then harden correctness and routing performance. This prevents the customization layer from becoming another parallel implementation and makes every later feature directly reusable by external applications.