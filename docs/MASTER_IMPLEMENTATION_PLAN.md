# AutoTraceLab — MASTER IMPLEMENTATION PLAN

Status: **single authoritative implementation plan**  
Supersedes as execution authority: `PARETO_IMPLEMENTATION_PLAN.md`, `REACT_TO_GO_MATHEMATICAL_PARITY_PLAN.md`  
Baseline reviewed: `234866430c14bd64f6b214e6b0267b8785678fad`  
Target: a deterministic, validated, high-performance, reusable AutoTrace Core in Go, preserving all useful TypeScript mathematics, with incremental execution, portable type registries, broad no-code customization and production-grade embedding/delivery.

---

# 0. Authority and execution rule

This document is the only normative execution order for the project.

The two previous plans remain as detailed audit/reference material, but when ordering or wording conflicts, this master plan wins.

The central correction made during consolidation is:

> **Do not make Go Core the sole production source of truth before mathematical parity for the selected production pipeline has been demonstrated.**

The required order is:

```text
freeze contract + TS oracle
        ↓
fix cross-language data semantics
        ↓
port mathematics family-by-family
        ↓
prove differential/invariant parity
        ↓
integrate with Go incremental SceneEngine
        ↓
optimize Go data structures/algorithms
        ↓
prove quality is equal or Pareto-better
        ↓
shadow rollout
        ↓
production cutover to Go/WASM Worker
        ↓
TS reference-only
        ↓
TS retirement
```

Architecture/customization work that does not change mathematical behavior may proceed in parallel, but must not create a second routing/geometry truth.

---

# 1. Product end state

AutoTrace must become five clearly separated products/layers:

```text
AutoTrace Core
  deterministic headless mathematics + scene engine

AutoTrace Contract / SDK
  stable scene, registry, protocol and capability contracts

AutoTrace Registry
  portable domain vocabulary: block/edge/port/shape/icon/theme/routing-profile definitions

AutoTrace Renderer / Adapters
  React today; other renderers/hosts later

AutoTraceLab
  reference editor + benchmark laboratory + customization/admin UI
```

The target architecture is:

```text
Host application
  |
  | HostAdapter: persistence/assets/auth/telemetry/IDs
  v
AutoTrace SDK
  |-- EngineClient
  |-- RegistryClient
  |-- Theme API
  |-- scene/patch types
  |-- capability negotiation
  v
Runtime adapter
  |-- native Go
  |-- Go/WASM Dedicated Worker
  `-- future RPC/service adapter
  v
AutoTrace Headless Core
  |-- Model + Semantic Validation
  |-- Geometry Resolver
  |-- Placement/Layout
  |-- Scene/Spatial Index
  |-- Routing
  |-- Route Validation/Postprocess
  |-- Labels
  |-- Metrics/QualityVector
  |-- NLP / Unified Co-Optimization
  |-- Incremental SceneEngine
  `-- Versioned Contracts
```

Non-negotiable boundaries:

1. Core imports no React, DOM or browser UI package.
2. A block/edge/port type is data, not a React component or switch branch.
3. Visual style is not routing geometry.
4. Host persistence/auth/assets are adapters, not core logic.
5. Browser main thread never performs production full routing after cutover.
6. Every successful production route is validated.
7. Every externally visible deterministic decision has stable tie-breaking.
8. Native Go and WASM execute the same canonical core mathematics.

---

# 2. Consolidated workstreams

The program has ten workstreams. They are coordinated by the milestone dependency graph in §5.

## WS-A — Mathematical contract and TypeScript oracle

Purpose: prevent silent loss of existing behavior during migration.

Deliverables:

- `docs/MATHEMATICAL_CONTRACT.md`
- `docs/PARITY_MATRIX.md`
- `testdata/parity/`
- headless TypeScript fixture exporter
- canonical numeric/JSON serializer
- deterministic seed/tie-break policy
- TS↔Go differential runner

Parity levels:

- **P0 contract parity:** inputs/defaults/unset-vs-zero/failure semantics;
- **P1 invariant parity:** geometric/semantic hard properties;
- **P2 numerical/structural parity:** discrete decisions/path topology/metrics within declared tolerance;
- **P3 quality parity:** optimized Go is equal or Pareto-better even if internal search differs.

## WS-B — Canonical Go mathematical core

Purpose: migrate all useful mathematical principles from `src/algorithms` into importable `go_engine/core`.

Required families:

1. block/port geometry;
2. auto-sizing;
3. deterministic free-slot placement;
4. shared intersection/obstacle primitives;
5. adaptive port stubs + face-lane staggering;
6. full multi-pass artifact cleaner;
7. weighted/congestion-aware Orthogonal A*;
8. Manhattan channel router;
9. Lee wave router;
10. G¹ spline geometry/router;
11. Sugiyama layout;
12. force-directed layout;
13. orthogonal-grid layout;
14. strict on-arrow label solver;
15. complete canonical metrics/QualityVector;
16. NLP optimizer with the same canonical objective;
17. Unified Co-Optimization orchestrator;
18. renderer-independent bridge/G¹ corner primitives.

## WS-C — Incremental scene engine and performance

Purpose: combine migrated mathematics with the strongest Go-only architecture already present.

Deliverables:

- revisioned scene state;
- `open/patch/snapshot/close`;
- precise dependency invalidation;
- route reuse;
- scene-level spatial/occupancy index;
- sparse orthogonal visibility graph where justified;
- congestion/rip-up/reroute/nudging;
- bounded deterministic search;
- buffer/cache reuse and allocation control.

Rule: **performance optimization comes after parity for the affected behavior**, unless the optimization is purely internal and proven output-preserving by the differential harness.

## WS-D — Reusable headless boundary and SDK

Embedding modes required:

1. router-only;
2. headless SceneEngine;
3. viewer;
4. editor;
5. native batch/server;
6. WASM Worker;
7. future RPC/service adapter.

Stable public objects should remain small:

```text
Engine
Scene
ScenePatch
RoutingOptions
RouteResult / RouteStatus
Capabilities
ValidationReport
RegistrySnapshot
WorkspaceDefinition
BlockTypeDefinition
PortTypeDefinition
EdgeTypeDefinition
ShapeDefinition
IconDefinition
ThemeDefinition
RoutingProfileDefinition
```

Never expose A* heap nodes, occupancy internals, visibility-graph caches or other replaceable implementation details.

## WS-E — Declarative registry and customization model

Purpose: make domain vocabulary and appearance administrable without source edits.

Entities:

- `BlockTypeDefinition`
- `PortTypeDefinition`
- `EdgeTypeDefinition`
- `ShapeDefinition`
- `IconDefinition` / `IconPackDefinition`
- `ThemeDefinition`
- `RoutingProfileDefinition`
- `RegistryPackage`
- `WorkspaceDefinition`

Stable namespaced IDs, e.g.:

```text
core/block/process
core/edge/data
my-app/block/pump
my-company/icon/valve
```

Instances store `typeId` plus minimal allowed overrides. Resolved geometry/style is derived and cached.

## WS-F — Customization/admin UX

Required sections:

- Appearance;
- Block Types;
- Connection Types;
- Port Types;
- Shapes;
- Icons;
- Routing Profiles;
- Registry Packages;
- Validation/Migrations.

Lifecycle:

```text
draft -> published -> deprecated
```

Support duplicate, version history, rollback, usage/dependency view, import/export and migration preview.

## WS-G — Renderer and frontend execution

Purpose: AutoTraceLab becomes a consumer of Core/Registry instead of owning mathematical state.

Target frontend modules:

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
```

Production routing must eventually run in a Dedicated Worker via Go/WASM. Experimental TS algorithms remain only in an explicit research/reference namespace until retirement.

## WS-H — Benchmarking, verification and observability

Corpus families:

- chains;
- fan-in/fan-out;
- trees;
- DAGs;
- grids;
- sparse/dense deterministic random graphs;
- many-port nodes;
- narrow corridors;
- almost-touching obstacles;
- corridor traps;
- long-distance nets;
- high crossing/congestion pressure;
- edit/movement traces;
- malformed/adversarial protocol and registry inputs.

Scale buckets:

- S 10–20 nodes;
- M 50–100;
- L 100–300;
- XL 300–1,000;
- stress >1,000 scheduled/informational until stable.

Measure performance, allocations, hard violations, route quality, route churn, incremental reuse and registry invalidation.

## WS-I — Security, CI and release engineering

Required:

- Go unit/race/fuzz/bench;
- frontend typecheck/test/build;
- WASM Worker integration;
- protocol + parity + conformance gates;
- registry schema/security tests;
- least-privilege Actions;
- one JS package manager;
- artifact provenance/attestations;
- immutable per-commit artifacts plus semver stable releases;
- version compatibility matrix.

## WS-J — Documentation and adoption

Replace bootstrap README and add architecture/embedding/customization/routing/benchmark/protocol docs plus examples.

---

# 3. Canonical mathematical contract to preserve

This section is the migration checklist for mathematical content. Implementation details may improve, but these principles may not disappear accidentally.

## 3.1 Block and port geometry

Preserve:

- base/placement/routing grids;
- minimum block dimensions;
- title/subtitle/content contribution to minimum size;
- port-count contribution using corner margin and pitch;
- deterministic port ordering by group → explicit order → pin number → stable ID;
- fixed and adaptive placement;
- valid explicit zero values for `relativePosition`, `customOffset`, `order`, `pinNumber` where contract permits;
- perimeter mapping for rectangle/rounded/chip/circle/diamond/hexagon;
- port normals;
- block routing clearance;
- port-spacing violations;
- derived visual/routing/obstacle/content/header bounds;
- deterministic free-slot placement.

Go contract types must preserve field presence separately from scalar zero where TypeScript used optional fields.

## 3.2 Shared geometry primitives

Create one canonical package for:

- epsilon/almost-equal policy;
- AABB overlap;
- orthogonal/general segment intersection;
- segment/AABB intersection;
- Liang–Barsky clipping for general label-wire collision use;
- point/segment distance where needed;
- collinearity and overlap length;
- block-face tangency detection;
- route simplification and canonical rounding.

All routing, cleaning, labels, validation and metrics must call these primitives instead of implementing subtly different variants.

## 3.3 Adaptive port escape

Port exact behavior or freeze an explicitly improved canonical equivalent.

The model must account for:

- port normal;
- source-target relation;
- obstacle clearance;
- base stub;
- free space in front of a face;
- number/order of edges sharing the same face;
- deterministic lane staggering.

No router should independently invent endpoint escape rules.

## 3.4 Artifact cleaner

The canonical cleaner is obstacle-aware and multi-pass.

Required properties/passes:

1. direct 0-bend facing-port detection when safe;
2. strict source/target normal stubs;
3. zero-length and collinear merge;
4. micro-jog/staircase removal;
5. U-turn elimination where safe;
6. obstacle-aware orthogonal shortcut/raycast;
7. strict body intersection prevention;
8. prohibition on running along forbidden block faces;
9. endpoint stub hard-lock after simplification;
10. final route validation.

Cleaning may never turn a valid route into an unchecked invalid route.

## 3.5 Orthogonal A*

Preserve the richer TypeScript search semantics before further optimization.

Canonical state includes position and previous movement direction.

Base objective contains at least:

```text
step cost
+ bend penalty
+ occupancy/congestion penalty
+ proximity/channel penalty
- straight-continuation reward
- target-entry alignment reward
```

Hard constraints:

- no obstacle-body penetration;
- required source/target normal escape;
- no immediate 180° reversal unless explicitly allowed by future contract;
- forbidden collinear shared segments cannot be made acceptable by a low scalar penalty;
- no unchecked fallback route.

TypeScript’s existing spatial hash principle must be preserved or replaced by an equal/better scene index before Go becomes canonical.

A search failure returns explicit status:

```go
ok | degraded | no_path
```

Fallback sequence:

1. preferred search;
2. bounded wider-budget retry;
3. independently verified fallback;
4. `no_path`.

## 3.6 Alternate/reference routers

### Manhattan channel

Preserve deterministic L/Z/C corridor construction, obstacle bypass, adaptive stubs and lane staggering. Use as fast production profile/fallback only after validation gates.

### Lee wave

Preserve BFS wave propagation + shortest backtracking semantics. It is valuable as a reference/debug oracle even if not the default production router.

### G¹ spline

Preserve tangent-normal endpoint constraints and cubic Bézier geometry. Separate topological routing from visual spline sampling where possible.

## 3.7 Layout algorithms

### Sugiyama

Preserve four logical phases:

1. cycle breaking / feedback-arc handling;
2. layer/rank assignment;
3. barycentric crossing reduction with deterministic sweeps;
4. coordinate assignment + port-aware micro-alignment.

Pinned/fixed constraints must be added explicitly rather than silently changing semantics.

### Force-directed

Preserve:

- pairwise repulsion;
- edge spring attraction;
- left-to-right/flow bias;
- cooling/step limiting;
- pinned-node invariance;
- deterministic initialization/rounding for parity tests.

### Orthogonal grid

Preserve deterministic degree/topology scoring and matrix placement behavior as a simple production/reference layout.

## 3.8 Label solver

Canonical label placement is a constrained placement problem, not midpoint rendering.

For each edge:

- enumerate candidate positions along its own path segments;
- prefer suitable long/horizontal segments;
- test multiple deterministic `t` candidates;
- reject collisions with blocks;
- reject collisions with other wires;
- reject collisions with previously placed labels;
- validate manual positions as actually on-arrow;
- expose leader-line/violation state when displaced;
- assign the strict maximum penalty when no valid on-arrow placement exists.

Preserve `MAX_LABEL_OFF_ARROW_PENALTY = 50000` unless changed by a versioned mathematical-contract decision.

## 3.9 Canonical metrics and QualityVector

Metrics are an independent truth layer and must not be simplified to make a router look better.

Required components include:

- actual route length;
- theoretical port-anchor Manhattan lower bound;
- normalized excess wirelength;
- bend count;
- general crossing count;
- collinear shared-path overlap count/length;
- node-node overlap;
- wire-through-node collision;
- clean port exits;
- port misalignment;
- straight-edge ratio;
- label collisions;
- labels-on-arrow percentage;
- diagram area ratio;
- density deviation;
- void ratio;
- aspect penalty;
- congestion overflow when available;
- hard violation count;
- stability/churn metrics after incremental integration.

Do not use one scalar as the primary release criterion.

Decision tiers:

```text
Tier 0 hard validity
Tier 1 crossings/shared-path/labels
Tier 2 bends/wirelength
Tier 3 stability/churn
Tier 4 runtime/allocations
Tier 5 embedding/customization conformance
```

A hard-invalid result cannot beat a valid result regardless of composite score.

## 3.10 NLP optimizer

Port the objective, not merely the fact that both versions use gradient descent.

Canonical objective must represent the selected version of:

```text
Φ(X) =
  w1 * total routed wirelength
+ w2 * wirelength variance/deviation
+ w3 * connected block distance deviation / repulsion barriers
+ w4 * wire spacing violations
+ w5 * port alignment deviation
+ strict collinear overlap barrier
+ strict label violation barrier
```

Required:

- pinned nodes have zero updates when freeze is enabled;
- configurable learning rate, iterations and momentum are actually consumed;
- gradients/forces are documented;
- clipping/snap/bounds are part of the contract;
- history records canonical comparable metrics;
- rerouting/label evaluation points in the loop are explicit;
- `wireProximityCost` must not remain a placeholder zero if it is part of Φ.

## 3.11 Unified Co-Optimization

Port as a Go orchestrator over canonical modules, not as duplicated math.

Stages:

1. cycle/topology decomposition;
2. port-aware barycentric ordering;
3. dynamic layer/channel sizing;
4. pin-to-pin alignment;
5. overlap relaxation;
6. canonical routing;
7. artifact cleaning;
8. label placement;
9. quality evaluation;
10. bounded improvement/refinement where justified.

## 3.12 Bridge jumps and G¹ corner geometry

Core should return renderer-neutral primitives rather than SVG strings.

Support conceptual primitives:

```text
Line
Arc / BridgeHop
CubicBezier
```

Preserve adaptive corner radius and standard cubic circular approximation coefficient where used (`κ ≈ 0.55228475`). Renderer decides SVG/Canvas/native presentation.

---

# 4. Data semantics and versioning rules

Cross-language data semantics are a blocking prerequisite.

## 4.1 Optional presence

Fields that distinguish absent from explicit zero/false require presence-aware Go representation or custom marshaling.

Examples:

- relative position 0;
- custom offset 0;
- order 0;
- pin number 0 where legal;
- corner radius 0 = deliberately square;
- `adaptive... = false`;
- `smoothCorners = false`;
- explicit routing weight 0.

Tests must cover JSON omission, explicit zero and explicit false separately.

## 4.2 Defaults

Defaults live in one canonical layer and are versioned. Do not duplicate different defaults across React controls, protocol decoding and Go algorithms.

## 4.3 Floating-point policy

- IDs/counts/discrete choices: exact;
- snapped coordinates: exact after canonical snap;
- ordinary geometric calculations: declared absolute epsilon;
- trig/spline output: compare after canonical public rounding;
- cost values: absolute + relative tolerance;
- NaN/Inf: hard failure unless explicitly documented.

## 4.4 Determinism

Every equal-cost choice must use stable keys, for example:

```text
cost -> algorithm-specific rank -> direction rank -> y -> x -> stable ID
```

Never rely on Go map iteration order.

## 4.5 Version domains

Keep separate compatibility domains:

- engine version;
- scene/protocol contract version;
- mathematical metric/version contract;
- registry schema/package version;
- theme/type package versions;
- SDK version.

Do not bump all versions together without necessity.

---

# 5. Single milestone dependency graph

This replaces the old independent M0–M9 and M0–M16 sequences.

## MP0 — Governance and baseline freeze [BLOCKING]

- [x] Create `MATHEMATICAL_CONTRACT.md`.
- [x] Create `PARITY_MATRIX.md`.
- [x] Record source commit for every TS oracle fixture.
- [x] Freeze current protocol-v1 fixtures.
- [x] Freeze representative scene/type fixtures.
- [x] Record TS and Go benchmark/QualityVector baselines separately.
- [x] Define epsilon, canonical rounding and deterministic tie-break policies.
- [x] Define metric/quality contract version.

Exit: every later behavioral change is measurable against a frozen reference. [COMPLETED]

## MP1 — Cross-language contract semantics [BLOCKING]

- [x] Presence-aware optional numbers/booleans.
- [x] Canonical defaults.
- [x] JSON round-trip tests.
- [x] TS↔Go type mapping tests.
- [x] Native↔WASM serialization equivalence.
- [x] Correct explicit zero/false behavior.

Exit: the same JSON input means the same mathematical state in TS, Go native and Go/WASM. [COMPLETED]

## MP2 — Differential parity harness [BLOCKING]

Add:

- [x] TS fixture exporter (`scripts/exportParityFixtures.ts`);
- [x] Go fixture runner (`go_engine/core/parity_test.go`);
- [x] canonical JSON normalizer;
- [x] differential CLI/script (`scripts/runDifferentialParity.ts`);
- [x] golden comparator (`npm run parity`);
- [x] property/metamorphic test harness (`go_engine/core/metamorphic_test.go`);
- [x] CI reporting showing exact differing component/path (`docs/PARITY_REPORT.md`).

Initial metamorphic properties:

- [x] translation invariance where applicable;
- [x] stable result under input-order permutations when contract says order-independent;
- [x] pinned-node invariance;
- [x] open-final-scene equals equivalent patch sequence;
- [x] normalization idempotence;
- [x] cleaner idempotence;
- [x] metric determinism.

Exit: a developer can run one command and see TS↔Go differences for every covered family. [COMPLETED]

## MP3 — Geometry foundation parity [BLOCKING selected production path]

- [x] shared geometry primitives;
- [x] block minimum sizing;
- [x] auto-sizing;
- [x] deterministic port ordering;
- [x] fixed/adaptive port coordinates;
- [x] six current shapes;
- [x] derived block geometry/violations;
- [x] deterministic free-slot placement;
- [x] normalization semantics.

Exit: golden geometry fixtures pass, including explicit-zero cases. [COMPLETED]

## MP4 — Endpoint escape + artifact cleaner parity

- [x] adaptive port stub;
- [x] face lane staggering;
- [x] obstacle/body/face intersection predicates;
- [x] all cleaner passes;
- [x] idempotence/property tests;
- [x] final route validation.

Exit: canonical TS cleaner and Go cleaner agree structurally or Go is explicitly approved Pareto-better with zero hard violations. [COMPLETED]

## MP5 — Orthogonal A* mathematical parity [BLOCKING production router]

- [x] weighted options/defaults;
- [x] state/direction semantics;
- [x] obstacle lookup semantics;
- [x] occupancy/proximity fields;
- [x] shared-segment prohibition;
- [x] bend cost;
- [x] straight reward;
- [x] target-entry alignment;
- [x] deterministic tie-breaking;
- [x] validated failure/fallback status;
- [x] route metadata/bends/length.

At this stage preserve observable TypeScript behavior. Go-specific search redesign is MP15.

Exit: A* differential fixtures and hard invariants green. [COMPLETED]

## MP6 — Alternate routers parity

- [x] Manhattan channel (`RouteManhattanChannel`);
- [x] Lee wave (`RouteLeeWave`);
- [x] G¹ spline geometry (`RouteSmoothSplines`);
- [x] route validation for each;
- [x] classify each as production/reference/research by benchmark evidence.

Exit: no TS-only routing family remains undocumented/unported. [COMPLETED]

## MP7 — Layout parity

- [x] Sugiyama cycle breaking;
- [x] layer assignment;
- [x] barycentric sweeps;
- [x] coordinate/port alignment;
- [x] force-directed model;
- [x] orthogonal-grid model;
- [x] pinned/stability constraints where contractually appropriate.

Exit: deterministic layout fixtures meet structural/quality parity. [COMPLETED]

## MP8 — Labels + metrics parity [BLOCKING benchmark truth]

- [x] strict label collision solver;
- [x] multi-candidate on-arrow search;
- [x] manual label validation;
- [x] label/wire/label collision primitives;
- [x] complete canonical QualityVector;
- [x] lower-bound normalized wirelength;
- [x] overlap/crossing/compactness/density/aspect metrics;
- [x] hard-violation classification;
- [x] metric version metadata.

Exit: TS/Go benchmark results mean the same thing. [COMPLETED]

## MP9 — NLP parity

- [x] freeze exact canonical Φ;
- [x] port all terms;
- [x] connected-pair model;
- [x] spacing violations;
- [x] strict label/overlap barriers;
- [x] momentum parameter;
- [x] gradient clipping/snap/bounds;
- [x] history/breakdown parity;
- [x] final canonical rerouting.

Exit: component-wise objective values and invariants match declared contract. [COMPLETED]

## MP10 — Unified Co-Optimization + bridge geometry

- [x] Go orchestrator over canonical modules;
- [x] no duplicated hidden formulas;
- [x] port-aware crossing reduction;
- [x] dynamic channels;
- [x] pin alignment;
- [x] relaxation;
- [x] routing/cleaning/labels/metrics;
- [x] renderer-neutral bridges;
- [x] renderer-neutral G¹ fillets.

Exit: the highest-quality TS pipeline has a canonical Go equivalent. [COMPLETED]

## MP11 — Incremental mathematics integration [BLOCKING cutover]

Merge canonical algorithms into existing `SceneEngine`.

- [x] full `open` equals final state after equivalent patches;
- [x] dirty edge/node dependency semantics;
- [x] route reuse correctness;
- [x] options/math-version revisions;
- [x] geometry-cache invalidation;
- [x] metrics update semantics;
- [x] stale revision conflicts;
- [x] snapshot isolation;
- [x] cancellation/obsolete result handling.

Exit: incremental execution cannot change final mathematical correctness. [COMPLETED]

## MP12 — Reusable core boundary + Worker/SDK shadow integration

Add/complete:

```text
src/engine/types.ts
src/engine/protocol.ts
src/engine/EngineClient.ts
src/engine/autotrace.worker.ts
src/engine/wasmLoader.ts
```

- [ ] `hello` capability negotiation;
- [ ] request IDs;
- [ ] `open/patch/snapshot/close` client;
- [ ] Worker loads Go/WASM;
- [ ] stale response rejection;
- [ ] conflict recovery;
- [ ] engine health/status;
- [ ] shadow execution alongside current TS production path;
- [ ] parity telemetry/report in development/benchmark mode.

Do **not** switch default production routing yet.

Exit: same scenes can execute through TS and Worker/Go in shadow mode.

## MP13 — Declarative registry foundation

Go files:

```text
go_engine/core/registry.go
go_engine/core/type_definitions.go
go_engine/core/registry_validation.go
go_engine/core/registry_resolver.go
go_engine/core/registry_migration.go
go_engine/core/style_invalidation.go
```

TS side:

```text
src/registry/types.ts
src/registry/RegistryClient.ts
src/registry/resolve.ts
src/registry/invalidation.ts
```

Implement:

- [ ] block/port/edge/shape/icon/theme/routing-profile schemas;
- [ ] namespaced IDs;
- [ ] version pinning;
- [ ] deterministic resolution precedence;
- [ ] built-in registry matching current behavior;
- [ ] instance `typeId` migration adapter;
- [ ] JSON Schema validation;
- [ ] import/export;
- [ ] dependency/conflict validation;
- [ ] migration framework;
- [ ] deterministic canonical serialization/hash.

Exit: one existing domain block + edge family can be represented entirely by registry data without canvas/core switch branches.

## MP14 — Invalidation model + customization vertical slices

Canonical invalidation classes:

```text
render
layout
routingGeometry
routingCost
semantic
```

Required proofs:

- edge color -> 0 reroutes;
- icon -> 0 reroutes;
- theme -> 0 reroutes unless explicit measured geometry policy says otherwise;
- block size/port/obstacle geometry -> dependency-local reroute;
- routing profile -> relevant route-cost reroute;
- semantic-only rename -> no geometric reroute.

Vertical slices:

### C1 theme without reroute
- default tokenized theme;
- live Appearance panel;
- switch/reset/import/export;
- zero-reroute test.

### C2 one registry-driven block type
- resolve shape/icon/size/ports;
- compatible old instance migration;
- Duplicate Type UI.

### C3 registry-driven edge/port compatibility
- source/target rules;
- routing profile and marker/style resolution;
- simple editor.

### C4 portable package
- export/import dependencies;
- hashes/version metadata;
- identical resolution/routing in clean workspace.

### C5 minimal host embedding example
- inject registry/theme;
- open scene;
- receive/render routes without AutoTraceLab app state.

Exit: render/semantic customization is demonstrably separated from routing mathematics.

## MP15 — Go-specific performance and routing quality optimization

Only now replace parity-oriented internals with faster/better algorithms under P3 quality gates.

### Scene spatial index

- [ ] precompute inflated obstacles;
- [ ] occupancy rows/bitsets/intervals or benchmark-selected structure;
- [ ] O(1)/O(log n) blocked queries;
- [ ] cached port geometry;
- [ ] local invalidation;
- [ ] reusable A* buffers.

### Sparse orthogonal visibility graph

- [ ] port escape/corner/channel vertices;
- [ ] horizontal/vertical sweep edges;
- [ ] scene reuse;
- [ ] incremental invalidation;
- [ ] sparse A*;
- [ ] verified grid A* fallback until quality gate passes.

### Global routing

- [ ] deterministic difficult-edge-first ordering;
- [ ] congestion occupancy;
- [ ] crossing/shared-path costs;
- [ ] bounded top-k rip-up/reroute;
- [ ] no-improvement stopping condition;
- [ ] orthogonal nudging;
- [ ] route stability/churn penalty.

Performance hypotheses to validate, not blindly enforce:

- 100 nodes / 200 edges native p95 < 50 ms;
- 300 / 600 full native p95 < 150 ms;
- small local edit in 300 / 600 p95 < 16 ms when dependency locality permits;
- separate WASM/Worker budget;
- allocations/op materially reduced.

Any threshold may change only through documented benchmark/ADR evidence.

Exit: Go is measurably faster/scalable and equal or Pareto-better on canonical quality vectors.

## MP16 — Full customization/admin workspace

Appearance editor:

- canvas/grid;
- theme/base/accent/semantic colors;
- node/edge/port/label tokens;
- typography/scale;
- density/spacing;
- radius/stroke/shadows;
- light/dark/high-contrast;
- live preview;
- undo/redo/reset;
- theme import/export.

Block type editor:

```text
name/category/tags
-> shape
-> icon
-> size policy
-> content/label behavior
-> port templates
-> visual port placement
-> metadata/inspector schema
-> routing/layout hints
-> preview
-> validate
-> draft/publish
```

Also implement edge, port, shape, icon and routing-profile editors.

Shape editor must show **visual outline and routing obstacle outline simultaneously**.

Lifecycle for all definitions:

- draft;
- publish;
- deprecate;
- duplicate;
- version history;
- rollback;
- usage/reference search;
- dependency view;
- migration preview.

Exit: non-developer can create and publish usable domain types without code or hand-edited JSON.

## MP17 — Embedding SDK and host adapters

- [ ] persistence interface;
- [ ] registry storage interface;
- [ ] asset/icon resolver;
- [ ] logging/telemetry adapter;
- [ ] host authorization/policy interface where necessary;
- [ ] injectable ID/time sources for deterministic tests;
- [ ] in-memory adapter;
- [ ] native file/JSON example;
- [ ] AutoTraceLab browser-storage adapter outside Core;
- [ ] TS SDK façade;
- [ ] native Go example;
- [ ] WASM Worker example;
- [ ] viewer/editor embedding example;
- [ ] capability negotiation for registries/themes/custom assets;
- [ ] workspace export/import;
- [ ] reproducibility metadata/version locks.

Embedding conformance suite must test scene lifecycle, registry resolution, compatibility, theme resolution, invalidation, serialization, route parity and deterministic resolution.

Exit: another application can embed AutoTrace without importing AutoTraceLab UI internals.

## MP18 — Shadow rollout and production cutover

Cutover stages:

### C0 — TS production, Go hidden comparison
Collect parity/quality differences.

### C1 — Go opt-in developer mode
No user-default change.

### C2 — Go opt-in experimental UI
Expose diagnostics/fallback.

### C3 — Go default for validated production pipeline
TS remains fallback/reference.

### C4 — Go default with incremental Worker path
All normal production routing/metrics from canonical Core.

### C5 — TS algorithms moved to explicit reference/research namespace
No normal imports from `App.tsx`.

### C6 — remove legacy root-Go duplication after importable Core parity
`go_engine` becomes protocol/runtime shell only.

### C7 — retire TS production/reference implementations only when:
- all required parity surfaces green;
- representative release history shows no regression;
- fixtures preserve historical oracle behavior;
- replacement documentation exists.

Exit: Go Core is legitimately the single production mathematical source of truth.

## MP19 — CI, security and release hardening

### CI required gates

| Gate | Policy |
|---|---|
| Go unit | required |
| Go race | required native |
| TS typecheck | required |
| frontend tests | required |
| production build | required |
| WASM build | required |
| mathematical parity covered surfaces | required |
| protocol parity | required |
| hard route violations | zero |
| deterministic corpus | required |
| property/metamorphic seed corpus | required |
| fuzz smoke | required/bounded PR |
| scheduled long fuzz/stress | required scheduled |
| registry schema/security | required |
| native/WASM conformance | required |
| render-only invalidation | 0 reroutes |
| quality-vector regression | gated |
| benchmark regression | statistically gated |

Security for portable customization:

- strict payload size/count/depth limits;
- schema validation;
- canonical IDs/namespaces;
- dependency-cycle detection;
- sanitized SVG;
- no scripts/event handlers/foreign objects by default;
- host-controlled URL/asset policy;
- no arbitrary JS expressions in portable inspector schemas;
- bounded polygon/path complexity;
- content hashes;
- explicit migration model;
- fuzz parser/resolver;
- graceful path-specific errors.

Delivery:

- choose one JS package manager/lockfile;
- update Go toolchain after compatibility run;
- least-privilege workflow permissions;
- CI artifact per successful commit;
- immutable engine artifact by commit;
- stable semver releases;
- artifact attestations/provenance;
- optional SBOM;
- compatibility matrix for engine/SDK/contracts/registries.

Exit: production artifacts are tested, attributable, reproducible and secure enough for embedding.

## MP20 — Documentation, cleanup and final architecture

- [ ] replace generic README;
- [ ] `ARCHITECTURE.md`;
- [ ] `MATHEMATICAL_CONTRACT.md`;
- [ ] `ROUTING_CONTRACT.md`;
- [ ] `PARITY_MATRIX.md`;
- [ ] `BENCHMARKING.md`;
- [ ] `PROTOCOL.md`;
- [ ] `EMBEDDING.md`;
- [ ] `TYPE_REGISTRY.md`;
- [ ] `CUSTOMIZATION.md`;
- [ ] `THEMING.md`;
- [ ] ADR directory;
- [ ] minimal router example;
- [ ] embedded viewer example;
- [ ] embedded editor example;
- [ ] custom-domain registry example;
- [ ] remove stale legacy globals/duplicates after compatibility period;
- [ ] split oversized React components after engine/registry boundaries stabilize.

Exit: repository structure and documentation match the actual product architecture.

---

# 6. Dependency and parallelism policy

The critical path is:

```text
MP0 -> MP1 -> MP2 -> MP3 -> MP4 -> MP5
                         |             |
                         v             v
                        MP7           MP6
                         \             /
                          -> MP8 -> MP9 -> MP10 -> MP11 -> MP12 -> MP15 -> MP18
```

Registry/customization can proceed partly in parallel:

```text
MP0/MP1
   -> MP13 -> MP14 -> MP16 -> MP17
```

But it must consume canonical geometry/routing contracts and cannot define a second mathematical model.

CI/security can be layered continuously, with final hardening at MP19.

Rules for parallel work:

1. no two branches/modules redefine the same formula;
2. shared primitives are merged before dependent algorithm ports;
3. fixture/oracle updates require explicit contract change, never incidental implementation changes;
4. performance optimization PRs include before/after quality vectors;
5. registry/render changes state invalidation class explicitly;
6. production cutover is impossible while blocking parity gates remain red.

---

# 7. Atomic implementation waves

These waves turn the milestones into practical commit-sized work.

## Wave A — prove the ground truth [COMPLETED]

A01 create mathematical contract skeleton. [COMPLETED]  
A02 create parity matrix covering every current TS algorithm file/export. [COMPLETED]  
A03 define canonical numeric tolerance/rounding. [COMPLETED]  
A04 define deterministic tie-break policy. [COMPLETED]  
A05 add TS headless scenario runner. [COMPLETED]  
A06 add canonical fixture serializer. [COMPLETED]  
A07 commit initial geometry/routing/layout/label/metric fixtures. [COMPLETED]  
A08 add Go fixture decoder/runner. [COMPLETED]  
A09 add TS↔Go differential script. [COMPLETED]  
A10 add first parity CI report. [COMPLETED]

## Wave B — fix representation before algorithms

B01 inventory every optional TS field.  
B02 add presence-aware Go optional values/custom marshal layer.  
B03 explicit zero/false fixtures.  
B04 unify defaults.  
B05 protocol round-trip tests.  
B06 native/WASM contract equivalence.

## Wave C — geometry core

C01 shared epsilon/rounding package.  
C02 AABB/segment primitives.  
C03 minimum size.  
C04 auto-size.  
C05 deterministic port sort.  
C06 adaptive/fixed port positions.  
C07 six-shape perimeter mapping.  
C08 derived geometry + violations.  
C09 deterministic free-slot placement.  
C10 golden + metamorphic geometry tests.

## Wave D — endpoint and cleaner

D01 adaptive stubs.  
D02 face edge grouping/staggering.  
D03 strict node body and face checks.  
D04 0-bend safety.  
D05 merge pass.  
D06 micro-jog/staircase pass.  
D07 U-turn pass.  
D08 raycast shortcut pass.  
D09 endpoint hard-lock.  
D10 validator + cleaner idempotence.

## Wave E — canonical A*

E01 freeze option/default mapping.  
E02 deterministic heap/tie ordering.  
E03 port escape/entry state.  
E04 obstacle semantics.  
E05 occupied segment map.  
E06 proximity field.  
E07 bend/straight/target alignment costs.  
E08 forbid illegal shared segments.  
E09 bounded search + explicit status.  
E10 verified fallback.  
E11 route metadata.  
E12 differential A* corpus.

## Wave F — alternate routers/layouts

F01 Manhattan.  
F02 Lee.  
F03 spline primitives.  
F04 Sugiyama cycle/rank.  
F05 Sugiyama barycentric sweeps.  
F06 Sugiyama coordinate/pin alignment.  
F07 force-directed model.  
F08 orthogonal grid.  
F09 comparative router/layout corpus.

## Wave G — labels/metrics

G01 all-segment index.  
G02 Liang–Barsky/AABB label collision.  
G03 candidate-T solver.  
G04 strict off-arrow/manual behavior.  
G05 label-label/wire-label collisions.  
G06 crossing/collinear metrics.  
G07 block/wire hard violations.  
G08 theoretical lower-bound normalized wirelength.  
G09 compactness/density/void/aspect.  
G10 canonical QualityVector + version.  
G11 component parity tests.

## Wave H — NLP/co-optimization

H01 canonical Φ specification.  
H02 component breakdown parity.  
H03 connected distance/barrier forces.  
H04 spacing/wire penalties.  
H05 label/overlap barriers.  
H06 momentum/clipping/snap/bounds.  
H07 pinned invariants/history.  
H08 canonical reroute evaluation.  
H09 Unified Co-Optimization orchestration.  
H10 renderer-neutral bridge/fillet descriptors.

## Wave I — incremental + Worker

I01 integrate geometry cache with SceneEngine.  
I02 options/math revision.  
I03 dependency-local dirty sets.  
I04 open-vs-patch equivalence corpus.  
I05 typed TS protocol.  
I06 WASM worker loader.  
I07 EngineClient correlation/revision control.  
I08 shadow Go execution.  
I09 benchmark UI shows TS/Go differential.  
I10 stale/cancel/recovery tests.

## Wave J — registry/customization

J01 registry core types.  
J02 validation/resolution.  
J03 built-in current-look registry.  
J04 typeId migration layer.  
J05 theme/token engine.  
J06 invalidation classes.  
J07 registry-driven sample block.  
J08 registry-driven sample edge/port.  
J09 package import/export/hash.  
J10 simple Appearance/Type UI vertical slice.

## Wave K — optimize only after proof

K01 scene obstacle index.  
K02 occupancy structure benchmark bake-off.  
K03 cached ports/search buffers.  
K04 sparse visibility graph.  
K05 congestion.  
K06 deterministic route order.  
K07 rip-up/reroute.  
K08 nudging.  
K09 stability/churn costs.  
K10 P3 quality/performance proof.

## Wave L — full productization

L01 full admin workspace.  
L02 shape/icon managers.  
L03 routing-profile editor.  
L04 lifecycle/version/migrations.  
L05 SDK host adapters.  
L06 embedding examples/conformance.  
L07 Go default rollout.  
L08 remove duplicated root-Go algorithms.  
L09 TS reference-only then retirement.  
L10 release/security/docs cleanup.

Each atomic commit should update relevant parity/implementation checkboxes and tests in the same change whenever practical.

---

# 8. Benchmark and quality gates

## 8.1 Hard validity

A successful route must satisfy:

- finite coordinates;
- correct source/target;
- endpoint normal rules;
- orthogonality in orthogonal mode;
- no zero-length normalized segments;
- no forbidden block interior intersection;
- no forbidden block-face traversal;
- no prohibited shared collinear wire segment;
- no unchecked fallback.

Hard validity is a release blocker.

## 8.2 Differential parity

For covered pre-optimization families:

- discrete outputs exact where contract defines deterministic result;
- geometric floats inside declared tolerance;
- all invariant booleans identical;
- every mismatch attributed by JSON path/component.

## 8.3 Optimized quality

After MP15 exact path equality is not always required. Instead require lexicographic/Pareto gates:

1. hard violations cannot worsen;
2. crossings/shared paths/label collisions cannot exceed approved budget;
3. bends/wirelength must be within approved quality envelope;
4. route churn must not regress materially;
5. performance improvement must be statistically supported.

## 8.4 Incremental correctness

For every edit trace:

```text
full recompute(final state)
==
incremental open + patches(final state)
```

within the same canonical quality/geometry semantics.

## 8.5 Customization invalidation

Every definition property maps to exactly one primary invalidation class. Tests count rerouted/relaid/repainted entities.

---

# 9. Registry/customization contract in one place

## 9.1 Resolution precedence

```text
core defaults
-> installed registry package
-> workspace overrides
-> graph override
-> explicitly allowed instance override
-> transient interaction state
```

## 9.2 Shape vs obstacle

Never infer routing obstacles from rendered DOM/SVG pixels.

A shape definition contains separate visual and obstacle geometry. Decorative image/icon changes are render-only.

## 9.3 Portable package

Conceptual structure:

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
routingProfiles[]
migrations[]
```

No arbitrary executable JS in portable packages.

## 9.4 Workspace reproducibility

Persist enough metadata to reproduce behavior:

- scene/protocol contract version;
- mathematical/metric version;
- engine version where relevant;
- registry package IDs/versions/hashes;
- active theme;
- routing profiles;
- graph data.

---

# 10. CI/release acceptance policy

A PR touching mathematical behavior must include:

- contract/parity-matrix impact;
- fixture impact;
- invariant tests;
- TS↔Go differential result until TS retirement;
- native/WASM result where relevant;
- QualityVector delta;
- benchmark delta for performance-sensitive code.

A PR touching customization must include:

- schema/version impact;
- invalidation class;
- registry round-trip;
- security validation where external data is involved.

A PR touching public SDK/protocol must include:

- compatibility classification;
- capability negotiation impact;
- conformance tests;
- migration/documentation.

---

# 11. Pareto order — what delivers the most value first

Within the dependency constraints, engineering priority is:

| Rank | Work | Leverage | Reason |
|---|---|---:|---|
| 1 | parity harness + canonical contract | 10/10 | prevents losing existing math and makes every later change measurable |
| 2 | optional/default semantics | 10/10 | fixes silent cross-language correctness drift |
| 3 | geometry + cleaner + A* parity | 10/10 | establishes trustworthy production-routing foundation |
| 4 | labels + canonical metrics | 10/10 | makes quality measurements real rather than incomparable |
| 5 | incremental SceneEngine integration | 10/10 | major interactive advantage unique to Go architecture |
| 6 | Worker shadow path | 10/10 | removes future UI blocking while preserving safe rollout |
| 7 | scene spatial index | 10/10 | removes dominant repeated obstacle work after semantics are frozen |
| 8 | declarative registry/invalidation model | 10/10 | foundation for reusable core and no-code customization |
| 9 | visibility/congestion/rip-up routing | 9/10 | large quality/scaling gain once benchmark truth exists |
| 10 | embedding SDK/host adapters | 9/10 | turns project into reusable engine product |
| 11 | full admin customization UX | 9/10 | makes portability usable by non-developers |
| 12 | remaining layouts/routers/NLP/coopt | 8–9/10 | preserves full research/quality surface and advanced optimization |
| 13 | CI/security/provenance | 8/10 | required for dependable distribution |
| 14 | component/docs cleanup | 6–7/10 | valuable after architectural boundaries stabilize |

---

# 12. Definition of Done for the entire program

The master program is complete only when all statements are true:

1. `go_engine/core` is the legitimate canonical production mathematical engine.
2. Every useful algorithmic family from `src/algorithms` is either migrated, explicitly superseded by a proven better canonical implementation, or retained intentionally as documented research-only behavior.
3. Cross-language optional/default semantics are lossless.
4. Frozen TS oracle fixtures and historical parity artifacts remain available after TS retirement.
5. All successful routes pass hard validation.
6. No unchecked fallback exists.
7. Canonical geometry/cleaner/labels/metrics use shared primitives.
8. Canonical metrics have one versioned semantic definition.
9. NLP objective contains no placeholder/unimplemented terms.
10. Unified Co-Optimization is composition over canonical modules rather than a duplicate hidden engine.
11. SceneEngine incremental final results are equivalent to canonical full recomputation.
12. Browser production routing/metrics run through Go/WASM Worker, not the main thread.
13. Stale worker results cannot overwrite newer revisions.
14. Obstacle lookup no longer scans all nodes for every A* neighbor in optimized production mode.
15. Search/index structures are reused at scene level.
16. Congestion/rip-up/nudging are bounded, deterministic and benchmarked.
17. Large-scene and local-edit performance are continuously measured.
18. Native and WASM pass the same contract/conformance corpus.
19. Block, edge and port types are declarative registry data.
20. Shapes/icons/themes/routing profiles are versioned definitions.
21. New domain types do not require canvas/core switch edits.
22. Visual-only changes trigger zero reroutes.
23. Geometry/routing changes invalidate dependency-local work where possible.
24. A non-developer can create/duplicate/edit/publish domain types via UI.
25. Theme customization has live preview, undo/reset and import/export.
26. Registry packages are safe, deterministic, versioned and portable.
27. Custom SVG/content is sanitized and cannot execute arbitrary code.
28. Router-only, headless, viewer/editor and native/WASM embedding modes are documented and conformant.
29. Host persistence/assets/telemetry/policy are replaceable adapters.
30. Saved workspaces can reproduce registry/theme/routing behavior through version/hash locks.
31. Go/frontend/WASM/parity/registry/conformance tests are CI-gated.
32. JS package manager policy is singular and deterministic.
33. Release workflows use least privilege and provenance.
34. README and architecture docs describe the actual system.
35. Legacy root-Go duplicates and TS production algorithms are removed only after their retirement gates.
36. AutoTraceLab is demonstrably a consumer of AutoTrace Core/SDK, not the owner of the mathematical engine.

---

# 13. Immediate execution queue

The next commits should be executed in this exact order unless a blocking defect requires an ADR:

1. `docs/MATHEMATICAL_CONTRACT.md` skeleton covering all families.
2. `docs/PARITY_MATRIX.md` with one row per TS public algorithm/export and Go target.
3. `testdata/parity/README.md` + canonical fixture format.
4. TS headless fixture exporter and canonicalizer.
5. Go fixture runner and JSON differential script.
6. explicit-zero/false contract fixtures.
7. presence-aware Go optional-field implementation.
8. shared Go geometry primitives.
9. block/port geometry + auto-size + free-slot parity.
10. make covered geometry parity blocking in CI.
11. adaptive stub/face-lane parity.
12. full artifact-cleaner parity + route validator.
13. Orthogonal A* parity.
14. labels + metrics parity.
15. integrate the validated pipeline into incremental SceneEngine.
16. add Worker/Go shadow execution while TS remains default.
17. begin registry foundation and theme C1 in parallel.
18. after parity, implement scene spatial index and benchmark it.
19. only after P3 proof, switch validated production pipeline to Go default.
20. continue remaining router/layout/NLP/coopt/customization/SDK milestones without violating the same gates.

---

# 14. Anti-regression rules

Do not:

- delete TS math before the corresponding retirement gate;
- treat matching function names as parity evidence;
- compare incomparable TS and Go composite scores;
- hide hard validity inside a weighted score;
- optimize by weakening obstacle/label/port constraints;
- let React components become semantic type definitions;
- let themes trigger routing by default;
- infer obstacle geometry from rendered pixels;
- add executable code to portable registry packages;
- duplicate default values across layers;
- depend on Go map iteration for deterministic output;
- publish unchecked fallback geometry;
- merge performance claims based on one timing sample;
- refactor giant UI components before engine/registry boundaries stabilize unless needed for correctness.

---

# 15. Source-plan reconciliation

All meaningful requirements from the previous plans are preserved here as follows:

| Previous source | Preserved in master |
|---|---|
| Pareto P0 Go/Worker | MP12 shadow integration + MP18 gated cutover |
| Pareto spatial index | MP15 after parity |
| Pareto benchmark corpus | WS-H, MP0/MP2, §8 |
| Pareto headless reusable core | WS-D, MP12/MP17 |
| Pareto registry/customization | WS-E/F, MP13/14/16 |
| Pareto congestion/visibility/rip-up | MP15 |
| Pareto CI/security/provenance | MP19 |
| Pareto docs/embedding | MP17/20 |
| Mathematical parity M0–M16 | MP0–MP15 with corrected dependencies |
| Mathematical cutover C0–C7 | MP18 |
| 62 atomic migration slices | normalized into Waves A–L |
| Go-only incremental advantages | MP11 + MP15 |
| full React mathematical surface | §3 + MP3–MP10 |

The old plans therefore remain useful as historical detail, but **no new implementation should choose ordering directly from them without checking this master plan first**.

---

## Final engineering rule

> **Preserve proven mathematics, make correctness explicit, optimize only against a canonical quality vector, and keep semantics/geometry/rendering/host integration separate.**

The intended end state is not “the React app rewritten in Go”. It is a reusable AutoTrace platform in which the best TypeScript mathematical principles, the stronger Go incremental architecture, modern routing data structures, portable customization and a clean embedding SDK converge into one canonical system.