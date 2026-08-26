# AutoTraceLab — Pareto implementation plan

Status: proposed  
Baseline commit: `6f0bcac419e04d062b22470920774537301b2778`  
Priority model: maximize routing quality, interactive latency, correctness and maintainability per unit of engineering effort.

## 0. Executive summary

AutoTraceLab already contains two valuable foundations:

1. a browser UI with several experimental TypeScript layout/routing algorithms;
2. an importable Go core with a versioned protocol and revisioned incremental scenes.

The largest current loss is that these foundations are not yet one runtime. `src/App.tsx` still calls the TypeScript algorithms synchronously on the browser main thread, while `go_engine/core` is a separate production-oriented path. At the same time, the Go orthogonal A* checks every node from the `blocked` predicate for almost every expanded grid state, and its emergency fallback can return a route that has not been proven obstacle-free.

The Pareto strategy is therefore:

- **P0.1 — One production engine:** make Go Core the single source of truth for routing/metrics and call it from the UI through a Web Worker + WASM, using `scene.open` / `scene.patch` for incremental updates.
- **P0.2 — Replace per-state obstacle scans:** add a reusable spatial/occupancy index and then a sparse orthogonal visibility graph so route search no longer performs O(nodes) obstacle checks on every A* expansion.
- **P0.3 — Make quality measurable:** add a representative benchmark corpus, correctness invariants, fuzz/property tests and performance/quality regression gates.
- **P1 — Improve global route quality:** congestion-aware routing, route ordering, rip-up/reroute, channel nudging and stability penalties.
- **P1 — Harden delivery:** current Go 1.22 is obsolete relative to the current Go 1.27 toolchain; add full frontend CI, least-privilege Actions permissions, provenance attestations and one package-manager policy.

These items should be implemented in this order. New routing algorithms should not be added before P0 is complete, because otherwise the project accumulates more duplicated code without a reliable way to prove improvement.

---

## 1. Current-state findings

### 1.1 Two routing implementations are evolving independently

Relevant files:

- `src/algorithms/*.ts`
- `src/App.tsx`
- `go_engine/*.go`
- `go_engine/core/*.go`
- `go_engine/wasm_bridge_js.go`
- `go_engine/protocol.go`

Examples of duplicated concepts include block geometry, labels, metrics, artifact cleaning, orthogonal routing and NLP optimization. The newer `go_engine/core` package is already becoming a stable importable API, but the UI does not use it as the normal execution path.

**Risk:** numerical and behavioral drift, duplicated bug fixes, benchmark results that describe a different implementation from the one shipped to consumers.

### 1.2 Browser routing is synchronous and runs on the UI thread

`src/App.tsx::computeRouting` directly executes CPU-heavy TypeScript routing and metrics. It is called after layout, on option changes, and after node movement.

**Risk:** graph size directly becomes UI jank. Increasing algorithm quality by doing more work makes interaction worse.

### 1.3 Go A* has a high-cost obstacle predicate

`go_engine/core/orthogonal_router.go::routeOne` creates a `blocked(x,y)` closure that loops through all nodes. A* invokes this predicate for neighboring states, so the effective work grows roughly with:

`expanded_states × neighbors × node_count`

before heap/map overhead is counted.

The implementation also rebuilds routing search structures for each edge instead of sharing a scene-level representation.

### 1.4 Route failure is not a first-class result

If A* does not find a goal, `routeOne` constructs a simple fallback bend sequence. That fallback is not itself proven clear of obstacles.

**Rule for a production router:** it is better to return an explicit `NO_ROUTE` / degraded result than to silently output an illegal route.

### 1.5 Incremental scene architecture exists but is underused

`go_engine/core/scene_engine.go` already supports:

- revisioned scenes;
- conflict detection;
- route reuse;
- dirty-node / dirty-edge rerouting;
- snapshots;
- a protocol surface in `go_engine/protocol.go`.

This is high-value infrastructure. The fastest path forward is to promote it into the default UI execution model rather than build another incremental layer in TypeScript.

### 1.6 Current metrics are useful but insufficient as release gates

`go_engine/core/metrics.go` currently measures wire length, bends, crossings, label collisions and a composite score. Missing hard production invariants include:

- route intersects obstacle;
- route is non-orthogonal when orthogonal routing is requested;
- invalid source/target port exit;
- zero-length / duplicate segments;
- self-overlap and shared-path pathologies;
- route stability/churn after a small edit;
- route failure count;
- p95/p99 latency and allocations;
- native-vs-WASM contract/parity.

### 1.7 CI covers only part of the system

`.github/workflows/go-engine.yml` tests and vets Go, then builds WASM and publishes immutable releases. It does not validate the frontend on normal changes. The workflow also grants `contents: write` at workflow scope, although test/build steps do not need write permission.

There are also both `package-lock.json` and `bun.lock`, while the README instructs users to run npm. That permits dependency-resolution drift between environments.

### 1.8 Project documentation does not describe the actual architecture

The current root `README.md` is still the generic AI Studio bootstrap README. It does not document AutoTraceLab's architecture, routing contract, quality goals, benchmarks, WASM consumption model or development workflow.

---

## 2. Target architecture

```text
React UI
  |
  | typed commands / graph patches
  v
EngineClient (TypeScript)
  |
  v
Dedicated Web Worker
  |
  v
Go/WASM protocol adapter
  |
  v
go_engine/core
  |-- SceneEngine
  |-- SceneIndex
  |-- OrthogonalRouter
  |-- RouteQuality
  |-- Labels
  |-- Metrics
  `-- Contract validation
```

Principles:

1. **Go Core is the production source of truth.**
2. **The browser main thread never performs full routing.**
3. **A scene owns reusable geometry/search indexes.**
4. **Every graph edit is revisioned and incremental.**
5. **All routes are validated before being returned.**
6. **Quality and speed are compared against a frozen corpus.**
7. **TypeScript algorithms may remain temporarily as research/reference implementations, but never silently compete with production behavior.**

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
- `public/` build assets / loader packaging as required
- `vite.config.*` if worker/WASM asset handling needs explicit configuration

### Atomic implementation steps

1. Define a typed TypeScript representation of protocol v1.
2. Implement `EngineClient.hello()` and reject unsupported contract/protocol versions before graph work starts.
3. Load the Go WASM runtime inside a Dedicated Worker, not in `window`.
4. Move the stable request endpoint away from the `businessOSAutoTraceRequest` global naming dependency. Keep it as a compatibility alias, but expose an AutoTrace-owned worker interface.
5. Implement worker request correlation with `requestId`.
6. Add `scene.open`, `scene.patch`, `scene.snapshot`, `scene.close` methods to `EngineClient`.
7. Replace `App.tsx::computeRouting` production path with `EngineClient`.
8. On graph load/preset change call `scene.open` once.
9. On node drag/options/edge edits generate a minimal patch rather than submitting the full graph.
10. Coalesce rapid drag patches. Only the newest revision may update React state.
11. Treat `AUTOTRACE_REVISION_CONFLICT` as recoverable: request a snapshot or reopen the scene deterministically.
12. Add engine status to the UI: `loading`, `ready`, `degraded`, `error`.
13. Keep TypeScript algorithms behind an explicit `researchEngine` flag during migration.
14. Add parity tests on frozen fixtures.
15. When parity and quality gates are green, remove production imports of TS routing/metrics from `App.tsx`.

### Acceptance criteria

- Full routing never executes on the browser main thread.
- Dragging a node sends a scene patch, not a complete graph route request.
- Stale worker responses cannot overwrite newer graph revisions.
- The UI remains interactive during a 300+ edge routing run.
- Production metrics are calculated by the same Go Core that calculated the route.
- For the frozen compatibility corpus, native Go and WASM return structurally equivalent results.

### Target effect

**Very high.** Removes an entire class of duplicated behavior and allows future algorithmic improvements to benefit UI, WASM consumers and Go consumers simultaneously.

---

## P0.2 Build a scene-level spatial index and sparse orthogonal routing graph

### Goal

Remove the largest avoidable algorithmic cost in `routeOne` and create reusable routing infrastructure.

### Files to add

- `go_engine/core/scene_index.go`
- `go_engine/core/occupancy.go`
- `go_engine/core/visibility_graph.go`
- `go_engine/core/route_validator.go`
- `go_engine/core/scene_index_test.go`
- `go_engine/core/visibility_graph_test.go`
- `go_engine/core/route_validator_test.go`

### Files to change

- `go_engine/core/orthogonal_router.go`
- `go_engine/core/scene_engine.go`
- `go_engine/core/types.go`
- `go_engine/core/api.go`

### Phase A — low-risk occupancy index

1. Introduce `SceneIndex` owned by `sceneState`.
2. Precompute inflated obstacle rectangles using routing clearance.
3. Build grid occupancy once per scene/options revision.
4. Represent occupancy compactly: row bitsets, packed cells, or interval rows depending on benchmark results.
5. Change `routeOne` so blocked-state checks are O(1) or O(log n), not O(nodes).
6. Cache port coordinates and node lookup maps in the scene index.
7. On `scene.patch`, invalidate only occupancy regions touched by changed/removed blocks.
8. Add allocation-aware reusable buffers for the A* open/closed structures.

### Phase B — sparse orthogonal visibility graph

Use the architecture proven in interactive orthogonal connector routers such as libavoid: construct an orthogonal visibility graph, perform route search over sparse candidate vertices, then perform crossing/shared-path detection and nudging.

1. Add candidate vertices at obstacle corners / channel lines / port escape points.
2. Build horizontal and vertical visibility edges using sweeps instead of dense all-cell expansion.
3. Reuse the graph for all edges in the same scene.
4. Invalidate only visibility graph regions affected by a patch.
5. Route using A* over sparse graph nodes.
6. Retain grid A* as a verified fallback engine while the visibility implementation matures.
7. Select engine automatically using scene density and graph size only after benchmark evidence exists.

### Eliminate unsafe fallback

Change route result semantics from "always returns a path" to an explicit status:

```go
type RouteStatus string

const (
    RouteOK       RouteStatus = "ok"
    RouteDegraded RouteStatus = "degraded"
    RouteNoPath   RouteStatus = "no_path"
)
```

Every path must pass `ValidateRoute` before it is returned.

Minimum route invariants:

- starts at the expected source port;
- ends at the expected target port;
- every segment is finite;
- no zero-length segment after normalization;
- orthogonal router returns only horizontal/vertical segments;
- does not cross inflated non-endpoint obstacles;
- respects required port exit direction;
- does not enter source/target node interior except through allowed endpoint geometry.

If the preferred algorithm fails validation:

1. retry with widened search budget;
2. retry with verified fallback router;
3. return `no_path` if still impossible.

Never synthesize an unvalidated L-shaped route.

### Acceptance criteria

- `blocked()` no longer iterates every node per neighbor expansion.
- Scene index is reused across multiple edges.
- Scene patches rebuild only affected index regions.
- Zero invalid routes in the regression corpus.
- No silent `no goal -> unchecked path` behavior remains.

### Performance targets

Treat these as gates to validate, not assumed results:

- 100 nodes / 200 edges: p95 full route < 50 ms native.
- 300 nodes / 600 edges: p95 full route < 150 ms native.
- single-node edit in 300/600 scene: p95 incremental patch < 16 ms when only a small edge subset is dirty.
- WASM p95 should remain within an explicit budget derived from native baseline.
- allocations/op decrease materially after index/buffer reuse.

If realistic fixtures show these thresholds are inappropriate, record the measured baseline and update thresholds through an ADR rather than silently weakening CI.

---

## P0.3 Create the benchmark corpus and quality regression system

### Goal

Stop optimizing by visual impression. Every routing change must prove that it improves or preserves the dimensions that matter.

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

Include deterministic seeds and committed fixtures for:

1. simple chains;
2. fan-in / fan-out;
3. trees;
4. layered DAGs;
5. grids;
6. sparse random graphs;
7. dense random graphs;
8. many ports on one node;
9. narrow channels;
10. almost-touching obstacles;
11. nested corridor traps;
12. long-distance connections;
13. high edge crossing pressure;
14. node movement sequences;
15. adversarial route-search cases;
16. malformed protocol inputs.

Recommended scale buckets:

- S: 10 / 20 nodes;
- M: 50 / 100 nodes;
- L: 100 / 300 nodes;
- XL: 300 / 1,000 nodes;
- stress: >1,000 nodes outside normal PR gating.

### Measure both performance and quality

Performance:

- p50 / p95 / p99 wall time;
- allocations/op and bytes/op;
- A* expanded states;
- heap pushes/pops;
- obstacle/index queries;
- rerouted vs reused edge count;
- visibility graph vertices/edges;
- WASM startup time;
- worker request round-trip overhead.

Hard correctness:

- invalid routes;
- obstacle intersections;
- invalid port exits;
- non-orthogonal segments;
- route failures;
- protocol errors/panics.

Quality:

- crossings;
- bends;
- total/normalized wire length;
- label collisions;
- shared-path overlap length;
- channel spacing violations;
- port alignment;
- route churn after local edits.

### Add a route stability metric

For interactive editors, visual stability matters. Add a metric comparing unchanged edges before/after a local edit:

- fraction of unaffected edges whose path changed;
- normalized path edit distance;
- total moved bend-point distance.

This prevents a router from getting a slightly shorter total path by needlessly redrawing the entire diagram after a small edit.

### Fuzz/property tests

Fuzz compact graph/patch encodings and assert:

- no panic;
- deterministic output for identical input/options;
- route validation always holds for status `ok`;
- output contains finite numbers only;
- snapshot isolation holds;
- revision rules cannot be bypassed;
- `open -> patch -> snapshot` is internally consistent;
- removing a node cannot leave a valid dangling edge;
- encode/decode round trips preserve contract fields.

### CI gates

PR CI should fail on:

- any new hard routing violation;
- any native/WASM contract mismatch;
- >5% benchmark regression on stable medium fixtures unless explicitly approved;
- substantial route-stability regression;
- fuzz seed regression.

Use repeated samples and statistical comparison for noisy microbenchmarks; do not gate on a single timing sample.

---

# 4. P1 — second wave after the P0 foundation

## P1.1 Add congestion-aware multi-edge routing

### Why

Routing every edge independently finds locally good paths but can produce globally poor bundles, repeated shared segments and avoidable crossings.

### Implementation

Add to `go_engine/core`:

- `congestion.go`
- `route_order.go`
- `ripup_reroute.go`
- `nudging.go`

Cost function should become multi-objective and lexicographically protect hard constraints:

1. invalid geometry: forbidden;
2. obstacle violation: forbidden;
3. invalid port direction: forbidden;
4. crossings: high penalty;
5. shared congested channel: penalty;
6. bends: penalty;
7. length: base cost;
8. route churn from previous valid path: stability penalty.

Atomic steps:

1. Route difficult edges first: constrained ports, narrow corridors, longest obstacle interaction.
2. Maintain a scene-level segment occupancy/congestion field.
3. Add crossing and shared-path penalties during search, not only to post-hoc metrics.
4. Detect worst offending edges after first pass.
5. Rip up and reroute only the top-k offenders.
6. Stop when score no longer improves or iteration budget is reached.
7. Add orthogonal segment nudging to separate visually overlapping routes while preserving topology.
8. Keep deterministic tie-breaking by stable edge ID / geometry key.

Acceptance:

- no hard violations;
- corpus median crossings decrease;
- bends/wire length may only worsen within configured budgets;
- runtime remains bounded by an explicit iteration budget.

---

## P1.2 Make incremental routing spatially precise

Current `scene_engine.go` reroutes an edge when its previous path touches a changed obstacle. Extend this model:

1. store edge route bounding boxes / segment index;
2. map spatial cells to affected edge IDs;
3. dirty an edge if changed obstacle inflation intersects its indexed route region;
4. recompute only dependency-local visibility/occupancy structures;
5. add an explicit `optionsRevision`; option changes that affect geometry invalidate appropriate caches;
6. separate style-only options from topology-affecting options.

Target: local edits should scale with affected geometry, not total graph size.

---

## P1.3 Stabilize layout as well as routing

Borrow the useful principles of interactive graph layout systems such as ELK:

- preserve previous node positions where possible;
- support fixed/pinned nodes;
- support fixed port sides/order;
- apply constraints incrementally;
- minimize unnecessary movement after edits.

Add:

- `Pinned`, `LayoutLocked`, optional layer/order constraints to node contract;
- layout stability metrics;
- deterministic overlap removal;
- a separation-constraint stage after force/layered placement.

Do not try to make every layout algorithm production-grade simultaneously. Select one layered layout and one free-form layout as supported paths; keep the rest as research modes until they meet gates.

---

## P1.4 Refactor the frontend around engine/state boundaries

Several components are already very large (`DiagramCanvas.tsx`, `ControlPanel.tsx`, `CreateBlockModal.tsx`, `InspectorPanel.tsx`). Split by responsibility after engine integration, not before.

Recommended structure:

```text
src/
  app/
  engine/
  features/
    canvas/
    routing-controls/
    inspector/
    benchmark/
    block-editor/
  shared/
    ui/
    geometry/
    types/
```

Changes:

- remove `any` from stepper and protocol-facing data;
- isolate graph state from view state;
- stop storing derived metrics in several places;
- memoize expensive visual derivations;
- only render changed graph entities where practical;
- add cancellation/abort semantics to long engine operations;
- add keyboard-accessible and testable commands for run/reopen/reset.

---

## P1.5 Upgrade toolchain and CI

### Go

The module currently declares Go 1.22 and CI explicitly installs 1.22.x. As of 2026-08-19 the current stable release is Go 1.27.

Steps:

1. Run the full suite on Go 1.27.
2. Update `go.mod` after compatibility passes.
3. Use a CI matrix only if an older supported version is intentionally part of the compatibility promise.
4. Add `go test -race ./...` for native code paths.
5. Add benchmark jobs that do not block on high-variance XL stress tests.
6. Add fuzz smoke runs on PRs and longer scheduled fuzzing.
7. Add pprof-based hotspot capture for representative benchmark scenarios.
8. Evaluate PGO only after the corpus is representative; PGO is a final multiplier, not a substitute for removing algorithmic costs.

### Frontend

Add `.github/workflows/frontend.yml`:

- checkout;
- current supported Node LTS;
- `npm ci`;
- typecheck;
- tests;
- production build;
- worker/WASM integration test;
- optional browser smoke test.

### One package manager

README currently says npm, so default recommendation:

- keep `package-lock.json`;
- add `"packageManager"` to `package.json`;
- remove `bun.lock` unless Bun is intentionally the canonical manager;
- CI must use the same manager as local setup.

### GitHub Actions permissions

Change global write permission to least privilege:

- test/build jobs: `contents: read`;
- release job only: required write permissions;
- pin action major versions and review upgrades.

### Build provenance

The repository distributes WASM artifacts. Add GitHub artifact attestations for the WASM package and optionally SBOM provenance. Keep SHA256 files for offline/manual verification, but provenance should identify the source repository, commit and workflow that created the artifact.

### Release policy

Current workflow creates an immutable GitHub Release for every matching main commit. Preserve immutable commit-addressed artifacts for consumers, but distinguish:

- CI artifact for every successful commit;
- stable semver release only for tagged engine versions;
- manifest fields: engine version, contract version, Go version, commit, hashes.

This reduces release-list noise without losing reproducibility.

---

# 5. P2 — important, but after performance/correctness foundation

## P2.1 Documentation as a real product interface

Replace generic root README with:

1. what AutoTraceLab is;
2. architecture diagram;
3. quick start;
4. Go Core usage;
5. WASM/Worker usage;
6. protocol/versioning policy;
7. benchmark command;
8. quality metrics;
9. release/artifact verification;
10. contributing/testing instructions.

Add:

- `docs/ARCHITECTURE.md`
- `docs/ROUTING_CONTRACT.md`
- `docs/BENCHMARKING.md`
- `docs/PROTOCOL.md`
- `docs/ADR/`

## P2.2 Formal contract schema

Create one machine-readable contract source, e.g. JSON Schema or generated schema metadata, and generate/validate language-side representations where practical.

Contract evolution rules:

- additive changes do not break existing clients;
- removing/renaming fields requires a major contract version;
- unknown fields are tolerated where safe;
- capability negotiation uses `hello`;
- every response includes engine and contract metadata.

## P2.3 Observability in BenchmarkPanel

Expose engineering metrics that help diagnose routing rather than only a composite score:

- engine/runtime;
- revision;
- full vs incremental run;
- reused/rerouted edges;
- route failures;
- expanded states;
- visibility graph size;
- p50/p95 from repeated benchmark;
- allocations for native benchmark reports;
- hard violation count;
- stability/churn score.

Composite score may remain for demos, but release decisions must use the underlying vector.

---

# 6. Recommended objective function

Do not collapse correctness into one weighted scalar. Use a lexicographic gate:

```text
Tier 0: hard validity
  invalid routes == 0
  obstacle intersections == 0
  invalid ports == 0
  NaN/Inf == 0

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
```

Weighted scores are acceptable inside one tier, but a faster invalid router must never beat a slower valid one.

---

# 7. Benchmark methodology

## 7.1 Native Go

Use standard Go benchmarks with allocation reporting and repeated runs. Keep benchmark setup outside timed sections where possible.

Commands should eventually support:

```bash
go test ./... -run '^$' -bench . -benchmem -count 10
```

Store machine-readable summaries and compare statistically rather than reading one number manually.

## 7.2 WASM/browser

Run the same committed corpus through the worker/WASM path in a real browser harness. Record separately:

- WASM initialization;
- serialization/deserialization;
- worker messaging;
- route compute;
- end-to-end request latency.

This separates Go algorithm cost from browser integration cost.

## 7.3 Incremental sequences

Every interactive fixture must include an edit trace, e.g.:

```text
open -> move node -> move node -> add edge -> change port -> remove node
```

Measure both correctness and the number of edges/index regions invalidated per edit.

---

# 8. Concrete CI quality gates

Initial recommended gates after baseline capture:

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
| Medium benchmark regression | fail above agreed threshold |
| Quality-vector regression | fail if crossings/invalidity budget exceeded |
| XL stress | scheduled / informational until stable |
| Artifact provenance | required on distributable release artifacts |

---

# 9. Implementation sequence

## Milestone M0 — freeze baseline

- [ ] Record native benchmark baseline.
- [ ] Record current TypeScript benchmark baseline.
- [ ] Commit deterministic corpus fixtures.
- [ ] Freeze protocol-v1 fixtures.
- [ ] Document current quality-vector values.

Exit: future changes can be compared objectively.

## Milestone M1 — engine unification

- [ ] Add `src/engine` protocol/client/worker.
- [ ] Load Go WASM in worker.
- [ ] Connect `hello`.
- [ ] Connect `scene.open`.
- [ ] Connect `scene.patch`.
- [ ] Add revision/stale-response handling.
- [ ] Switch canvas production routing to Go Core.
- [ ] Keep TS engine only under explicit research flag.
- [ ] Add native/WASM parity tests.

Exit: UI production behavior is generated by Go Core and does not block the main thread.

## Milestone M2 — correctness gates

- [ ] Add `RouteStatus`.
- [ ] Add `ValidateRoute`.
- [ ] Remove unchecked fallback route.
- [ ] Add property/fuzz tests.
- [ ] Add hard-violation metrics.
- [ ] Gate PRs on zero invalid routes.

Exit: invalid geometry cannot silently leave the engine.

## Milestone M3 — spatial acceleration

- [ ] Add scene obstacle index.
- [ ] Replace per-neighbor node scans.
- [ ] Cache port geometry.
- [ ] Reuse search buffers.
- [ ] Add index invalidation on patches.
- [ ] Benchmark allocations and p95.

Exit: grid A* is materially faster without quality loss.

## Milestone M4 — sparse routing graph

- [ ] Build orthogonal visibility graph.
- [ ] Reuse graph across edges.
- [ ] Incrementally invalidate visibility regions.
- [ ] Route corpus through sparse A*.
- [ ] Keep verified grid fallback.
- [ ] Select strategy through measured heuristics.

Exit: large-scene routing scales with sparse geometry rather than canvas grid area.

## Milestone M5 — global route quality

- [ ] Add congestion map.
- [ ] Add deterministic route order.
- [ ] Add crossing/shared-path search penalties.
- [ ] Add bounded rip-up/reroute.
- [ ] Add orthogonal nudging.
- [ ] Add route stability penalty.

Exit: quality vector improves on representative corpus within latency budget.

## Milestone M6 — delivery hardening

- [ ] Upgrade Go toolchain to supported current version after green compatibility run.
- [ ] Add frontend CI.
- [ ] Choose one JS package manager.
- [ ] Restrict Actions permissions.
- [ ] Add artifact attestations.
- [ ] Split commit artifacts from stable semver releases.
- [ ] Add scheduled fuzz/stress jobs.

Exit: every distributable artifact is reproducible, tested and attributable to source.

## Milestone M7 — architecture/docs cleanup

- [ ] Replace generic README.
- [ ] Document contract and architecture.
- [ ] Split large frontend components by feature after engine boundary stabilizes.
- [ ] Retire duplicated TS production algorithms.
- [ ] Move remaining experimental algorithms to an explicit research namespace.

Exit: repository structure matches the actual product architecture.

---

# 10. Definition of done for the Pareto program

The Pareto plan is complete when all of the following are true:

1. Go Core is the only normal production routing/metrics implementation.
2. Browser routing runs in a worker and local graph edits use incremental scene patches.
3. No route with a hard geometric violation can be returned as successful.
4. Obstacle lookup no longer scans all nodes per A* neighbor.
5. Routing search structures are reused at scene level.
6. Large-scene and incremental performance are tracked by committed benchmarks.
7. Native and WASM behavior share contract/parity tests.
8. Every routing PR is evaluated on a quality vector, not screenshots alone.
9. Global congestion/rip-up routing is bounded and deterministic.
10. Go/frontend/WASM are all covered by CI.
11. Distribution artifacts use least-privilege build permissions and provenance.
12. Documentation explains the architecture and actual supported execution path.

---

# 11. Pareto priority table

| Priority | Change | Expected leverage | Effort | Why now |
|---|---|---:|---:|---|
| P0 | Go Core + Worker + incremental UI | 10/10 | Medium | Removes duplication and UI blocking at once |
| P0 | Scene spatial index / occupancy | 10/10 | Medium | Removes dominant repeated obstacle work |
| P0 | Corpus + correctness/perf gates | 10/10 | Medium | Makes every later optimization trustworthy |
| P0 | Validated route status / no unsafe fallback | 9/10 | Low | Converts silent geometry corruption into explicit state |
| P1 | Sparse orthogonal visibility graph | 9/10 | High | Best scaling path for interactive obstacle routing |
| P1 | Congestion + rip-up/reroute + nudging | 8/10 | Medium/High | Improves crossings/shared channels globally |
| P1 | Precise incremental invalidation | 8/10 | Medium | Makes local edits independent of total graph size |
| P1 | Go 1.27 + full CI + least privilege + provenance | 8/10 | Low/Medium | Immediate reliability/security gain |
| P1 | Layout stability constraints | 7/10 | Medium | Improves editor usability after local edits |
| P2 | Frontend component decomposition | 6/10 | Medium | Valuable after engine boundary stabilizes |
| P2 | Documentation/schema cleanup | 6/10 | Low | Important for consumers and long-term maintenance |

---

# 12. External practice references used for this plan

- Go release history / current stable toolchain: https://go.dev/doc/devel/release
- Go profile-guided optimization: https://go.dev/doc/pgo
- Go fuzzing: https://go.dev/doc/security/fuzz/
- Web Workers: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
- GitHub build-system hardening: https://docs.github.com/en/code-security/tutorials/implement-supply-chain-best-practices/securing-builds
- GitHub artifact attestations: https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations
- libavoid — object-avoiding orthogonal routing for interactive diagram editors: https://www.adaptagrams.org/documentation/libavoid.html
- libavoid router phases/options, including orthogonal visibility graph, rerouting and nudging: https://www.adaptagrams.org/documentation/router_8h.html
- Orthogonal Connector Routing (Wybrow, Marriott, Stuckey): https://people.eng.unimelb.edu.au/pstuckey/papers/gd09.pdf
- Eclipse Layout Kernel interactive layout concepts: https://eclipse.dev/elk/reference/options/org-eclipse-elk-interactiveLayout.html

---

## Final engineering rule

Do not optimize AutoTraceLab toward a single visually attractive demo. Optimize it toward a deterministic, validated and benchmarked routing engine whose quality degrades gracefully as graph size and density increase.

The highest-value next commit after this plan is **M0 + M1 start**: freeze the corpus/baseline and wire the existing Go scene engine into a browser Worker. Everything after that becomes cheaper to measure, safer to change and easier to reuse.