# AutoTraceLab — React/TypeScript → Go mathematical parity migration plan

Status: **normative migration plan**  
Baseline audited commit: `3bfe10a9e8df7ad4931074d76bf79fe4eba62b96`  
Target: `go_engine/core` becomes the canonical headless mathematical engine **without losing any algorithmic principle currently implemented in `src/algorithms`**.  
Scope: geometry, placement, routing, post-processing, labels, metrics, nonlinear optimization, co-optimization and render-independent crossing/curve geometry.

---

# 0. Non-negotiable migration rule

The migration is **not** “rewrite TypeScript files in Go”. It is a controlled transfer of mathematical behavior.

For every algorithmic family the migration order is:

1. extract the mathematical contract from TypeScript;
2. freeze representative and adversarial fixtures;
3. encode invariants and tolerances;
4. implement the same model in `go_engine/core`;
5. run differential TS↔Go tests;
6. only after parity, optimize the Go implementation;
7. prove that optimization preserves the contract;
8. switch the UI production path to Go;
9. keep the TS implementation as a reference oracle until the final cutover gate;
10. delete/deprecate the TS production implementation only after all parity gates pass.

**No TypeScript algorithm may be removed merely because a Go function with the same name exists.**

The canonical rule is:

> **Behavioral/mathematical parity first; Go-specific optimization second; source-of-truth cutover third.**

---

# 1. Current parity gap to close

The TypeScript side currently contains these independent algorithmic families:

| Family | Current TypeScript source | Current Go state | Migration target |
|---|---|---|---|
| Block/port geometry | `src/algorithms/blockGeometry.ts` | partial | exact semantic parity |
| Orthogonal A* | `orthogonalAStarRouter.ts` | simplified | full weighted/congestion-aware parity |
| Artifact cleaner | `wireArtifactCleaner.ts` | strongly simplified in `core` | full multi-pass parity |
| Label solver | `labelLayout.ts` | simplified | strict collision-aware parity |
| Metrics/QualityVector | `metrics.ts` | simplified | canonical metric parity |
| NLP optimization | `nlpOptimizer.ts` | legacy only, different objective | canonical Go implementation |
| Unified co-optimization | `unifiedOptimizer.ts` | absent | canonical Go implementation |
| Sugiyama layout | `sugiyamaLayout.ts` | absent | Go production/reference implementation |
| Force-directed layout | `forceLayout.ts` | absent | Go implementation |
| Orthogonal-grid layout | `orthogonalGridLayout.ts` | absent | Go implementation |
| Lee wave router | `leeWaveRouter.ts` | absent | Go reference/fallback implementation |
| Manhattan channel router | `manhattanChannelRouter.ts` | absent | Go fast deterministic implementation |
| Smooth G¹ spline router | `splineRouter.ts` | absent | Go geometry implementation |
| Bridge jumps / G¹ corner rendering | `bridgeJumps.ts` | absent | render-independent Go geometry primitives |

The migration must also preserve the newer Go-only advantages:

- revisioned scenes;
- `scene.open` / `scene.patch`;
- dirty-edge rerouting;
- route reuse;
- conflict detection;
- native/WASM shared core.

Therefore the final target is **not a literal port of the old React runtime**. It is:

```text
TypeScript mathematical behavior
        +
Go incremental scene architecture
        +
Go performance-oriented data structures
        =
Canonical AutoTrace Core
```

---

# 2. Definition of “parity”

Parity is split into four levels. A migration task is not complete until its required level is explicitly met.

## P0 — contract parity

- same accepted inputs;
- same default values;
- same distinction between “unset” and valid zero values;
- same interpretation of sides, directions, flags and weights;
- same failure semantics.

## P1 — invariant parity

Examples:

- port lies on the correct perimeter;
- pinned nodes do not move;
- an orthogonal route does not enter an obstacle;
- source/target normal constraints hold;
- no forbidden collinear sharing;
- strict label constraints are evaluated identically.

## P2 — numerical/structural parity

For deterministic algorithms:

- same layer/order assignment;
- same path topology;
- same bend count;
- same candidate selection;
- same metric values within declared tolerance.

Exact equality is required for integer/discrete decisions where feasible. Floating-point geometry uses explicit tolerances.

## P3 — quality parity

When Go intentionally changes internal search/data structures:

- hard violations must never increase;
- canonical QualityVector must be equal or Pareto-better;
- normalized wire length/bends/crossings may vary only inside declared gate;
- deterministic stability must not regress.

---

# 3. M0 — freeze the mathematical contract before more divergence

**Priority: P0 / blocking.**

## 3.1 Add a canonical parity specification

Create:

- `docs/MATHEMATICAL_CONTRACT.md`
- `docs/PARITY_MATRIX.md`
- `testdata/parity/README.md`

`MATHEMATICAL_CONTRACT.md` must document formulas and decision rules, not implementation details.

For every family record:

- input variables;
- defaults;
- valid ranges;
- cost function;
- hard constraints;
- tie-breaking;
- rounding/snap rules;
- stopping condition;
- fallback behavior;
- deterministic requirements;
- error/failure result.

`PARITY_MATRIX.md` must have one row per function/algorithm and columns:

```text
TS function
Go target
contract frozen
golden fixtures
property tests
Go implementation
differential parity
optimized parity
production cutover
TS deprecated
```

## 3.2 Freeze TypeScript oracle behavior

Do not refactor algorithm mathematics until fixtures are generated.

Add:

- `src/tests/parity/exportParityFixtures.ts`
- `src/tests/parity/parityScenarios.ts`
- `src/tests/parity/canonicalize.ts`

The TypeScript fixture generator must serialize:

```json
{
  "contractVersion": 1,
  "seed": 0,
  "input": {},
  "output": {},
  "invariants": {},
  "metadata": {
    "algorithm": "...",
    "sourceCommit": "..."
  }
}
```

## 3.3 Floating-point policy

Declare one policy globally:

- discrete indices/counts/IDs: exact equality;
- snapped coordinates: exact equality after snap;
- ordinary geometry: default absolute epsilon `1e-9` or a function-specific declared epsilon;
- trig-derived circle/spline coordinates: comparison after canonical rounding used by the public contract;
- cost values: declared absolute + relative tolerance;
- NaN/Inf: always invalid unless explicitly specified.

Do not compare raw JS and Go floating values without canonicalization.

## 3.4 Deterministic tie-breaking policy

Every algorithm with equal-cost alternatives must specify stable ordering based on deterministic keys, e.g.:

```text
cost -> direction rank -> y -> x -> node/edge ID
```

Do not rely on JavaScript `Map` iteration or Go map iteration for externally visible decisions.

### M0 exit gate

- every `src/algorithms/*.ts` family represented in `PARITY_MATRIX.md`;
- all public/default semantics documented;
- initial parity fixture corpus committed;
- no production cutover to Go before M1–M12 family gates pass for the selected production pipeline.

---

# 4. M1 — fix cross-language data semantics first

**Priority: P0 / blocking all geometry parity.**

Current Go scalar fields collapse valid zero values and “not set”. This already changes mathematics.

## 4.1 Optional-number parity

TypeScript examples:

```ts
relativePosition?: number
customOffset?: number
pinNumber?: number
order?: number
cornerRadius?: number
labelClearance?: number
minWireDistance?: number
```

Go must preserve presence independently from value.

Preferred contract-side representation:

```go
type OptionalFloat64 struct {
    Value float64
    Set   bool
}

type OptionalInt struct {
    Value int
    Set   bool
}
```

or pointer fields where JSON/API ergonomics remain acceptable.

Do not use `value > 0` as “present”.

## 4.2 Booleans with default-true semantics

Fields such as `adaptivePortExitOffset?: boolean` require three states:

- unset => default;
- true;
- false.

Use optional bool semantics in the canonical protocol/model where required.

## 4.3 RoutingOptions parity

Bring `go_engine/core/types.go` to full TypeScript option coverage:

- `cornerRadius`;
- `adaptiveCornerRadius`;
- `labelClearance`;
- `strictLabels`;
- `minWireDistance`;
- `optimalBlockDistance`;
- `optimalWireDistance`;
- NLP params;
- complete weight semantics.

## 4.4 DerivedBlockGeometry parity

Go currently omits some derived regions. Add canonical named structs instead of positional arrays:

```go
type Rect struct { MinX, MinY, MaxX, MaxY float64 }
```

Expose/retain:

- visual bounds;
- routing bounds;
- obstacle bounds;
- header bounds;
- content bounds;
- anchors;
- validation violations.

## 4.5 Tests

Add:

- `go_engine/core/types_parity_test.go`
- JSON round-trip tests for explicit zero/unset;
- fixtures for `relativePosition=0`, `customOffset=0`, `order=0`, `pinNumber=0`, explicit false booleans.

### M1 exit gate

No TS↔Go fixture changes meaning solely because JSON zero values were collapsed into defaults.

---

# 5. M2 — block and port geometry parity

**Source:** `src/algorithms/blockGeometry.ts`  
**Target:** `go_engine/core/block_geometry.go` + new focused helpers.

## 5.1 Preserve exact constants

Canonical constants:

```text
BASE_GRID = 4
PLACEMENT_GRID = 10
ROUTING_GRID = 10
DEFAULT_CORNER_MARGIN = 14
DEFAULT_PORT_PITCH = 20
MIN_BLOCK_WIDTH = 120
MIN_BLOCK_HEIGHT = 72
HEADER_HEIGHT = 24
BODY_PADDING = 12
```

Move them into one package-level source of truth and test them through behavior rather than duplicating literals.

## 5.2 Minimum block size

Preserve:

```text
hPorts = 2*cornerMargin + max(0, max(nLeft,nRight)-1)*portPitch
wPorts = 2*cornerMargin + max(0, max(nTop,nBottom)-1)*portPitch
```

and text-derived minimum dimensions + placement-grid ceiling snap.

Add Unicode policy explicitly. `len(string)` in Go counts bytes, while JS `.length` counts UTF-16 code units. Choose and document a canonical text-width model; do not silently retain byte-count behavior for Cyrillic/non-ASCII titles.

Preferred improvement after parity fixture freeze: move both runtimes to a shared deterministic text-measure approximation based on runes/grapheme policy or renderer-supplied measured dimensions.

## 5.3 Port deterministic ordering

Exact priority:

1. group presence/group ID;
2. explicit `order` if present;
3. explicit `pinNumber` if present;
4. stable ID.

Presence must matter independently from zero value.

## 5.4 Adaptive distribution

Preserve:

```text
t_i = (i + 1) / (N + 1)
pos = clamp(round(sideLength * t_i), cornerMargin, sideLength-cornerMargin)
```

Fixed mode must accept full `[0,1]`, including exactly `0` and `1` subject to the same corner clamp.

## 5.5 Shape perimeter mappings

Golden-test all sides for:

- rectangle;
- rounded;
- chip_ic;
- diamond;
- hexagon;
- circle.

For every shape include:

- one port;
- multiple ports;
- fixed 0/0.5/1;
- custom offset;
- all four faces;
- non-square dimensions;
- minimum dimensions.

## 5.6 Derived geometry validation

Port-spacing violation threshold must match TS behavior. Add actual `Violations` computation in Go rather than returning `Valid: true` unconditionally.

## 5.7 Missing geometry functions

Port to Go:

- `ApplyBlockAutoSizing`;
- `FindDeterministicFreeSlot`;
- any normalization/geometry helper still living only in TypeScript.

For free-slot placement preserve deterministic right-column first attempt and deterministic spiral order.

### Files

- modify `go_engine/core/block_geometry.go`;
- add `go_engine/core/placement_free_slot.go`;
- add `go_engine/core/block_geometry_parity_test.go`;
- fixtures: `testdata/parity/geometry/*.json`.

### M2 exit gate

100% fixture parity for deterministic geometry outputs after canonical float rounding.

---

# 6. M3 — shared computational geometry primitives

Before routing/labels are migrated, create one tested geometry foundation.

Add:

- `go_engine/core/geometry_primitives.go`
- `go_engine/core/intersections.go`
- `go_engine/core/spatial_types.go`

## Required primitives

- point/segment orientation;
- segment AABB;
- AABB overlap;
- orthogonal segment vs AABB;
- general segment intersection;
- endpoint-touch classification;
- Liang–Barsky line clipping for label checks;
- segment length / Manhattan length;
- normalized orthogonal segment key;
- point-on-segment tolerance;
- collinearity;
- shared-segment overlap length;
- path bounds;
- polygon/perimeter helpers required by future shapes.

## One tolerance policy

No family should invent its own arbitrary `0.001`, `0.5`, `1.5` rules without a named semantic constant.

Create named tolerances such as:

```go
const (
    CoordinateEpsilon = ...
    OrthogonalTolerance = ...
    CollinearTolerance = ...
    EndpointTouchTolerance = ...
)
```

Only preserve different thresholds where they are genuinely part of the contract.

### M3 exit gate

All later collision logic must consume these primitives; no duplicate private intersection implementations in router, labels and metrics.

---

# 7. M4 — adaptive port-stub mathematics

**Source:** `computeAdaptivePortStub()` in `orthogonalAStarRouter.ts`  
**Target:** `go_engine/core/port_stub.go`.

Port the complete model, not only a fixed `clearance+10` escape.

## 7.1 Distance-based headroom

Preserve:

- minimum stub `16`;
- direct-axis facing detection;
- facing-port channel consumption cap;
- non-facing distance scaling.

## 7.2 Obstacle ray headroom

For every source face:

- cast along face normal;
- detect blocks occupying the local ray band;
- reduce stub according to nearest obstacle gap;
- never go below minimum stub.

## 7.3 Multi-port lane staggering

Preserve face-edge distribution and stagger formula:

```text
staggered = base + (edgeIndex - (edgeCount-1)/2) * 6
```

subject to minimum stub.

## 7.4 Precompute face-edge ordering once

Do not repeatedly scan all edges inside each route. Build deterministic:

```text
(nodeID, side) -> ordered edge IDs
```

as scene routing context.

### Tests

Fixtures must include:

- facing ports near/far;
- obstacle immediately ahead;
- obstacle outside ray band;
- 2/3/5 wires on one face;
- all four normals;
- adaptive disabled.

### M4 exit gate

Go returns the same source/target stub lengths as TypeScript fixtures.

---

# 8. M5 — full artifact-cleaner parity

**Source:** `wireArtifactCleaner.ts`  
**Target:** replace minimal `go_engine/core/artifact_cleaner.go` with a complete implementation built from shared primitives.

## Pass 0 — direct laser connection

Recognize co-axial facing ports and return a zero-bend path only when strict collision checks pass.

## Pass 1 — strict endpoint stubs

Use independently computed source and target stub lengths; do not replace them with one shared clearance-derived value.

## Pass 2 — collinear/zero-length normalization

Deterministically remove:

- duplicate adjacent points;
- zero-length segments;
- redundant collinear intermediate points.

## Pass 3 — micro-jog/staircase removal

Port the exact short-jog tests and bounded iterative improvement behavior. Endpoint protected regions must never be rewritten accidentally.

## Pass 4 — interior orthogonal shortcutting

Try valid L-shaped replacements only when both candidate segments pass strict obstacle/body/face validation.

## Pass 5 — hard endpoint normal lock

Guarantee first and final path segments remain collinear with source/target normals and satisfy minimum stubs.

## Collision semantics to restore

The TypeScript cleaner distinguishes:

1. physical node body — forbidden for all nodes;
2. running tangentially along a block face — forbidden;
3. inflated clearance — ignored only for permitted endpoint nodes.

Go must restore all three.

### Files

- rewrite `go_engine/core/artifact_cleaner.go`;
- add `go_engine/core/path_validator.go` if not already introduced by routing work;
- add `artifact_cleaner_parity_test.go`;
- fixtures under `testdata/parity/artifacts/`.

### Property tests

For any successful cleaned orthogonal path:

- endpoints unchanged;
- endpoint normals valid;
- point count never increases without documented reconstruction reason;
- no illegal block-face run;
- no physical body intersection;
- idempotence: `Clean(Clean(path)) == Clean(path)` after canonicalization.

### M5 exit gate

Differential fixture parity + cleaner idempotence + zero new hard violations.

---

# 9. M6 — restore the full Orthogonal A* mathematical objective

**Source:** `orthogonalAStarRouter.ts`  
**Target:** `go_engine/core/orthogonal_router.go` plus scene-level routing context.

This is the most important migration stage.

## 9.1 Exact option normalization

Preserve TS semantics:

```text
gridSize = clamp(options.gridSize || 10, 6, 20)
clearanceScale = clearanceWeight / 80
clearance = max(8, obstacleClearance * clearanceScale)
bendCost = bendPenalty * bendWeight / 25
crossingPenaltyFactor = crossingWeight*0.8 + 15
straightBonusFactor = straightnessWeight/100 * 12
stepBaseCost = max(2, gridSize*(wirelengthWeight/40 + 0.5))
channelSpacing = minWireDistance || channelSpacing || 16
```

Freeze exact default behavior before any tuning.

## 9.2 State space

State must include direction:

```text
(x, y, incomingDirection)
```

because bend cost and reversal constraints make coordinate-only state invalid.

Use a packed Go key to avoid allocation, but keep the same semantic state.

## 9.3 No immediate 180° reversal

Preserve exactly.

## 9.4 Strict physical obstacles

The physical body of every block is forbidden, including source/target blocks except for the geometrically valid port escape segment semantics.

Clearance envelope may have endpoint exceptions matching the TS contract.

## 9.5 Restore segment exclusivity

TypeScript forbids traversal on an already routed segment. Go legacy currently only penalizes it.

Canonical rule for the parity phase:

```text
if routedGridSegments contains candidate segment -> candidate is forbidden
```

If later research wants shared buses, that must become an explicit routing policy, not an accidental change.

## 9.6 Restore occupancy and proximity fields

Scene routing context must maintain:

- cell usage count;
- occupied undirected grid segments;
- wire-proximity field within channel spacing radius.

## 9.7 Restore full step objective

Canonical parity objective:

```text
stepCost =
    stepBaseCost
  + bendPenaltyWhenApplicable
  - straightContinuationReward
  + cellUsage * crossingPenaltyFactor
  + proximityPenalty * 10
  - targetApproachAlignmentReward
```

then clamp to positive minimum as in TS.

Document the precise target-approach condition.

## 9.8 Restore adaptive stubs and face staggering

Use M4, not fixed stubs.

## 9.9 Restore deterministic channel nudge/fallback context

Port the fallback corridor logic as a **verified fallback**. Unlike current unchecked fallback behavior, every emitted fallback path must pass `ValidateRoute`.

If no valid path exists, return explicit status:

```text
ok | degraded | no_path
```

## 9.10 Spatial index optimization only after parity

The TypeScript implementation already uses a 128px spatial hash for obstacles. Restore equivalent semantics first.

Then benchmark alternatives:

- spatial hash;
- row interval occupancy;
- bitsets;
- sparse visibility graph.

The optimized structure may differ, but route invariants and quality gates must remain unchanged/Pareto-better.

## 9.11 Search budget parity and production policy

Keep a declared search limit. Record:

- expanded states;
- heap pushes/pops;
- reason for termination.

Do not silently return illegal Manhattan geometry on budget exhaustion.

### Files

- modify `go_engine/core/orthogonal_router.go`;
- add `go_engine/core/routing_context.go`;
- add `go_engine/core/scene_index.go`;
- add `go_engine/core/congestion_field.go`;
- add `go_engine/core/route_status.go`;
- add `go_engine/core/orthogonal_router_parity_test.go`;
- fixtures `testdata/parity/astar/`.

### A* fixture families

- direct aligned;
- one obstacle;
- narrow corridor;
- source/target close together;
- same-face multi-edge;
- forced bend;
- multiple equal-cost routes;
- existing-wire exclusion;
- proximity-pressure routes;
- target approach from each side;
- no-path;
- search-budget exhaustion.

### M6 exit gate

- zero hard violations across parity corpus;
- deterministic topology matches oracle where contract requires it;
- QualityVector no worse than TS;
- no unchecked fallback;
- Go optimized obstacle lookup preserves same accepted/rejected cells.

---

# 10. M7 — migrate alternative router families

These should be independent strategies behind one common interface.

Define:

```go
type Router interface {
    Route(ctx *RoutingContext, req RouteRequest) RouteResult
}
```

or equivalent stable internal interface.

## M7.1 Lee wave router

Source: `leeWaveRouter.ts`.

Port:

- grid-bound construction;
- obstacle rasterization;
- 4-neighbor BFS wave;
- O(1) queue-head traversal;
- start/end cell clearing semantics;
- deterministic backtracking;
- adaptive stubs;
- cleanup pipeline.

Role after migration:

- reference shortest-grid oracle;
- debugging/visualization source;
- optional verified fallback;
- not necessarily default production router.

Add optional debug wave events as data, not UI constructs.

## M7.2 Manhattan channel router

Source: `manhattanChannelRouter.ts`.

Port:

- L/Z/C corridor selection;
- intervening-block envelope detection;
- channel spacing and nudge;
- backward-loop handling;
- mixed-normal cases;
- adaptive face stubs;
- cleaner call.

Role: very fast deterministic router/fallback for easy scenes.

## M7.3 Smooth G¹ spline router

Source: `splineRouter.ts`.

Split into:

1. topological/control geometry;
2. cubic Bézier sampling/render representation.

Preserve:

```text
B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t)t^2 P2 + t^3 P3
```

and the existing control-handle rules, source/target tangent constraints and G¹ weight scaling.

Do not couple Go Core to SVG strings.

### Files

- `go_engine/core/router.go`;
- `router_lee.go`;
- `router_manhattan.go`;
- `router_spline.go`;
- family parity tests.

### M7 exit gate

Every TS router has a Go strategy with fixture/property parity and route validation.

---

# 11. M8 — migrate all layout mathematics

Create a common layout interface:

```go
type LayoutEngine interface {
    Layout(nodes []BlockNode, edges []EdgeConnection, opts LayoutOptions) LayoutResult
}
```

`LayoutResult` must include optional algorithm steps/debug snapshots without UI strings being required for core correctness.

## M8.1 Sugiyama

Source: `sugiyamaLayout.ts`.

Port all four mathematical stages.

### Stage A — cycle breaking

- DFS recursion-stack back-edge detection;
- deterministic neighbor ordering;
- explicit set of logically reversed edges.

### Stage B — layer/rank assignment

- in-degree on DAG view;
- source initialization;
- processed-parent rule;
- deterministic stall fallback;
- layer index assignment.

### Stage C — crossing reduction

Port forward + backward barycentric sweeps.

For each node:

```text
barycenter = mean(index(neighbor))
```

Perform the same number/order of sweeps for parity phase.

### Stage D — coordinate assignment

Preserve:

- per-layer maximum width;
- layer spacing;
- total layer heights;
- vertical centering;
- node spacing;
- layer/order fields.

### Stage E — port-aware micro-alignment

For a single direct incoming edge, compute target node Y such that source/target port levels align, snap and accept only when peer overlap constraints remain valid.

## M8.2 Force-directed layout

Source: `forceLayout.ts`.

Preserve parity constants initially:

```text
kRepulse = 80000
kSpring = 0.05
kFlow = 0.4
desiredDistance = 220
```

Mathematics:

- Coulomb-like inverse-square repulsion;
- bounding-size amplification;
- Hooke-like edge spring;
- left-to-right flow penalty;
- linear cooling schedule;
- movement clipping;
- pinned-node invariant;
- final normalization/snap.

After parity, expose constants as validated options only if benchmarks justify it.

## M8.3 Orthogonal grid layout

Source: `orthogonalGridLayout.ts`.

Preserve:

- in/out degree scoring;
- deterministic sort;
- column count `ceil(sqrt(n*1.5))`, min 2;
- fixed slot dimensions and origins for parity phase.

## M8.4 Layout stability upgrade after parity

Only after exact family migration, integrate Go incremental advantages:

- previous-position stability penalty;
- pinned/fixed coordinates;
- partial relayout;
- local overlap removal;
- deterministic scene patch invalidation.

This is an enhancement phase, not part of initial parity.

### Files

- `go_engine/core/layout.go`;
- `layout_sugiyama.go`;
- `layout_force.go`;
- `layout_grid.go`;
- parity tests and fixtures.

### M8 exit gate

Layer assignments/order and snapped final coordinates match frozen fixtures, subject only to documented float canonicalization.

---

# 12. M9 — strict label-placement solver parity

**Source:** `labelLayout.ts`  
**Target:** rewrite `go_engine/core/label_layout.go`.

## 12.1 Preserve candidate set

Canonical candidate fractions:

```text
0.50, 0.45, 0.55, 0.40, 0.60, 0.35, 0.65,
0.30, 0.70, 0.25, 0.75, 0.20, 0.80
```

## 12.2 Segment indexing

Build all segments once:

```text
edgeId, segmentIndex, p1, p2, length, orientation
```

Use a spatial index later if needed, but preserve solver behavior first.

## 12.3 Strict collision model

Candidate label AABB must reject collision with:

1. any block (+ clearance);
2. any other edge segment;
3. any already placed label.

General wire intersections with the label box use shared Liang–Barsky primitive.

## 12.4 Segment preference

Preserve weighted preference for longer segments and horizontal segments.

## 12.5 Manual offsets

A manually moved label must be evaluated geometrically:

- is it still on its own edge?
- is it collision-free?
- if not, apply max penalty;
- leader-line metadata is render-independent output.

Do not infer “off arrow” from coordinate magnitude.

## 12.6 Strict penalty

Preserve:

```text
MAX_LABEL_OFF_ARROW_PENALTY = 50000
```

and return it whenever the strict rule fails.

## 12.7 Text-size semantics

Resolve JS vs Go Unicode length mismatch. Prefer a deterministic label measure abstraction:

```go
type TextMeasurer interface {
    Measure(text string, style TextStyle) Size
}
```

Core may provide deterministic fallback approximation for headless use; browser host may pass measured dimensions where protocol permits. Routing/optimization must consume resolved dimensions, not Go byte length.

### M9 exit gate

- same candidate selected in frozen fixtures;
- same strict penalty decisions;
- collision tests include block/wire/label;
- custom-offset semantics match.

---

# 13. M10 — canonical metrics and QualityVector parity

**Source:** `metrics.ts`  
**Target:** replace simplified `go_engine/core/metrics.go` with one canonical implementation.

## 13.1 Route length

Use actual path segment Euclidean length:

```text
L = Σ hypot(dx_i, dy_i)
```

## 13.2 Theoretical lower bound

Use Manhattan distance between resolved source/target port anchors:

```text
L_min = Σ (|sx-tx| + |sy-ty|)
```

Canonical normalized wirelength:

```text
normalizedWirelength = max(0, L/L_min - 1)
```

Do not normalize by an arbitrary `200*edgeCount` constant.

## 13.3 Bend count

Use the same angular/cosine decision rule as the TypeScript metric contract, or explicitly canonicalize all orthogonal paths first and then use exact direction transitions. Freeze one definition and use it everywhere.

## 13.4 Crossing count

Use shared general segment intersection + broadphase AABB rejection. Exclude endpoint touching consistently.

## 13.5 Block/wire hard violations

Count separately:

- block-block overlap;
- wire-through-nonendpoint-block;
- collinear shared segments;
- label collisions.

Do not hide them inside one aggregate only.

## 13.6 Port alignment

Compute:

- clean endpoint exits;
- facing-port misalignment sum;
- port alignment percentage.

Never hardcode `100`.

## 13.7 Compactness

Restore:

- diagram bounding area;
- total block area;
- area ratio;
- actual density;
- graph density;
- target density;
- density deviation;
- void ratio;
- aspect penalty around target aspect `1.8`.

## 13.8 Hard violations

Canonical:

```text
hardViolations =
    blockOverlapCount
  + wireBlockCollisionCount
  + collinearOverlapCount
  + labelCollisions
```

plus any subsequently standardized route validity class.

## 13.9 Composite score

First migrate the TypeScript weighted Pareto score exactly. Then, if improving the score formulation, bump contract/metric version and keep old score available for benchmark comparability.

### Version metrics

Introduce:

```text
metricContractVersion
qualityVectorVersion
```

A benchmark baseline is meaningless if scoring semantics change silently.

### Files

- `go_engine/core/metrics.go`;
- `metrics_parity_test.go`;
- `testdata/parity/metrics/`;
- `benchmarks/baseline-v<version>.json`.

### M10 exit gate

Metric-by-metric differential parity on fixed scenes; composite score difference zero after canonical rounding for parity fixtures.

---

# 14. M11 — migrate the true NLP objective, not a lookalike optimizer

**Source:** `nlpOptimizer.ts`  
**Target:** new `go_engine/core/nlp_optimizer.go`.

The legacy Go implementation is not the same mathematical problem and must not be promoted as parity without correction.

## 14.1 Canonical default parameters

Freeze TS defaults:

```text
D_opt = 220
S_opt = 24
wirelengthWeight = 40
wirelengthVarianceWeight = 35
blockRepulsionWeight = 85
wireSpacingWeight = 60
strictLabelClearanceWeight = 75
portAlignmentWeight = 80
learningRate = 0.08
iterations = 75
momentum = 0.85
freezePinnedNodes = true
```

## 14.2 Canonical optimality breakdown

Compute from real routed paths where the TS contract does so:

- total wirelength;
- average wirelength;
- max individual wirelength;
- RMS/std-like wirelength dispersion used by TS;
- connected-block deviation from `D_opt`;
- parallel wire spacing violations against `S_opt`;
- collinear overlap length/count;
- on-arrow/off-arrow labels;
- label penalties;
- port alignment deviation;
- overall objective.

`wireProximityCost` must never remain a placeholder zero if it participates in the objective.

## 14.3 Canonical cost function

Preserve the TS formulation:

```text
Φ(X) =
  w1 * totalWirelength
+ w2 * wirelengthVariance
+ w3 * blockDistanceDeviation * 10
+ w4 * wireDistanceViolations * 25
+ w5 * portAlignmentDeviation
+ labelsOffArrowPenalty
+ collinearOverlapPenalty
```

with the same weight scaling and rounding semantics documented in the contract.

## 14.4 Gradient forces

Port the TypeScript force families:

- hard minimum separation barrier;
- connected-pair harmonic attraction around `D_opt`;
- non-connected soft repulsion;
- port alignment gradients;
- any wire-spacing force currently applied during iterations;
- pinned node zero-gradient invariant.

Document each formula directly in `MATHEMATICAL_CONTRACT.md`.

## 14.5 Momentum and update

Use `params.momentum`; never hardcode a different value.

Preserve:

- learning rate;
- velocity state;
- gradient clipping;
- coordinate bounds if contractually retained;
- snap policy;
- stopping iteration count.

## 14.6 Automatic anchor behavior

If no node is pinned, preserve TS behavior of pinning one deterministic root/reference node.

## 14.7 Rerouting schedule

Document exactly when routing and label metrics are recomputed during NLP. If Go changes the schedule for speed, differential quality gates must prove the result remains Pareto-equivalent/better; otherwise retain parity schedule.

## 14.8 Result/history parity

Go result should expose:

- initial breakdown;
- final breakdown;
- per-iteration history;
- improvement percentage;
- pinned IDs;
- optional debug snapshots behind a flag.

### M11 exit gate

For deterministic fixtures, pinned invariants and objective components match TS within tolerance; final QualityVector is equal/Pareto-better.

---

# 15. M12 — migrate Unified Co-Optimization as the production orchestrator

**Source:** `unifiedOptimizer.ts`  
**Target:** `go_engine/core/cooptimizer.go`.

This should eventually become the main “high quality” pipeline rather than scattering the logic across UI handlers.

## Stage 1 — cycle breaking / topological layers

Reuse the canonical Sugiyama graph primitives rather than duplicate DFS/layer code.

## Stage 2 — port-aware barycentric ordering

Preserve source/target port-relative contributions to layer ordering.

Avoid repeated `edges.filter` scans in Go: pre-index incoming/outgoing edges by node and layer while preserving exact scores.

## Stage 3 — dynamic channel sizing

Preserve relationship between inter-layer wire count and channel width.

## Stage 4 — forward pin alignment

For each target node:

- derive ideal node Y from source port Y and target relative port offset;
- aggregate multiple incoming desired positions;
- snap;
- resolve peer overlap deterministically.

## Stage 5 — backward refinement

For single outgoing relationships, align source toward target when peer overlap remains valid.

## Stage 6 — route with canonical A*

Use M6 implementation and shared routing context.

## Stage 7 — artifact cleaning

Use M5 only; no duplicate cleaner code.

## Stage 8 — label placement

Use M9 strict solver.

## Stage 9 — final quality evaluation

Use M10 canonical metric implementation.

## Stage 10 — optional NLP refinement

After strict parity of existing unified optimizer is established, allow an explicit high-quality mode:

```text
Sugiyama/coarse placement
-> pin-aware alignment
-> NLP refinement
-> routing
-> rip-up/reroute
-> cleaner
-> labels
-> metrics
```

Do not silently change the legacy parity profile; expose profiles/version them.

### M12 exit gate

Unified pipeline produces zero hard violations on reference corpus and matches/Pareto-dominates TypeScript quality vectors.

---

# 16. M13 — bridge jumps and G¹ rendering mathematics

**Source:** `bridgeJumps.ts`.

The Go Core should own **geometry**, not SVG path strings.

## 16.1 Define render-independent path primitives

Example:

```go
type PathPrimitive interface{ isPathPrimitive() }

type LinePrimitive struct { From, To Point }
type CubicPrimitive struct { From, C1, C2, To Point }
type ArcPrimitive struct { /* geometric arc descriptor */ }
type BridgePrimitive struct { Center Point; Radius float64; ... }
```

The protocol may serialize tagged structs instead of Go interfaces.

## 16.2 Bridge jump detection

Preserve crossing policy:

- detect perpendicular crossing;
- select which segment hops according to canonical policy;
- bridge radius `5.5` for parity profile;
- sort multiple hops in travel order;
- avoid bridges too close to segment endpoints.

## 16.3 Adaptive G¹ corner fillets

Preserve base-radius scaling and the cubic circular approximation constant:

```text
κ = 4/3 * (sqrt(2)-1) ≈ 0.55228475
```

For corner radius `r`, construct control points collinear with incoming/outgoing unit tangents.

Preserve endpoint straight-stub allowances and adaptive radius cap from adjacent segment lengths.

## 16.4 Renderer responsibility

React/SVG/Canvas renderer converts primitives to its own commands. Core must never return SVG-specific `M/L/C/A` strings as its canonical geometry model.

### M13 exit gate

Sampled primitive geometry matches TS path geometry within declared tolerance; renderer-independent output works native and WASM.

---

# 17. M14 — integrate migrated mathematics with incremental SceneEngine

This stage is where Go should become strictly better than the old React execution model.

## 17.1 Dependency graph

Scene state should cache/index:

- node geometry by ID;
- port anchors;
- obstacle envelopes;
- spatial obstacle index;
- routed segments;
- proximity/congestion field;
- route bounds;
- labels/label bounds;
- layout adjacency;
- incoming/outgoing edges.

## 17.2 Patch invalidation classes

A patch must classify effects:

```text
semantic-only
render-only
layout
routing-geometry
routing-cost
full-topology
```

Only affected derived data are invalidated.

## 17.3 Local routing rebuild

When one block moves:

1. update its geometry/index cells;
2. mark directly connected edges dirty;
3. mark routes spatially intersecting old/new clearance envelope dirty;
4. update congestion dependencies;
5. reuse unaffected route objects;
6. rerun labels only for affected/local collision neighborhood where safe;
7. recompute metrics incrementally or fall back to full metric pass depending cost.

## 17.4 Stability objective

After parity, add optional route-change penalty so incremental edits do not unnecessarily change distant paths.

This is a new Go capability and must be behind a versioned profile until quality evidence is established.

### M14 exit gate

Opening a scene and applying a patch must be semantically equivalent to routing the same final scene from scratch, modulo explicitly enabled stability policy.

---

# 18. M15 — cross-language differential test harness

This is the proof layer required before cutover.

## 18.1 Canonical JSON adapter

Build one CLI/test adapter on each side:

```text
TS oracle: input JSON -> canonical JSON output
Go core:   input JSON -> canonical JSON output
```

Algorithms must be invokable headlessly.

Suggested files:

- `src/tests/parity/oracleCli.ts`;
- `go_engine/cmd/parity/main.go`;
- `scripts/run-parity.mjs`;
- `scripts/run-parity.ps1`;
- `scripts/run-parity.sh`.

## 18.2 Comparison modes

- exact JSON for discrete outputs;
- numeric tolerance for geometry;
- invariant-only comparison for intentionally optimized alternative paths;
- QualityVector Pareto comparison for approved non-identical outputs.

## 18.3 Fixture hierarchy

```text
testdata/parity/
  types/
  geometry/
  stubs/
  intersections/
  artifacts/
  astar/
  lee/
  manhattan/
  spline/
  labels/
  metrics/
  sugiyama/
  force/
  grid/
  nlp/
  cooptimizer/
  bridges/
  scenes/
```

## 18.4 Random differential tests

Generate deterministic seeded scenes:

- random DAGs;
- cyclic graphs;
- dense port faces;
- mixed block shapes;
- narrow channels;
- randomized pinned sets;
- labels of varied lengths;
- varied routing weights.

Run the same seed through both engines.

## 18.5 Metamorphic/property tests

Examples:

- translation invariance: translating every node by `(dx,dy)` translates output geometry by the same vector;
- ID-renaming invariance where IDs do not participate in tie-break except deterministic ordering;
- route validity preserved after cleaning;
- cleaner idempotence;
- pinned-node invariance;
- scene.open(final) equivalent to open+patch sequence;
- metrics invariant under edge list reordering where mathematically expected;
- no NaN/Inf under finite inputs;
- output deterministic under repeated execution.

## 18.6 CI gate

Add `.github/workflows/math-parity.yml`.

PR gate should run:

1. frontend oracle tests;
2. Go unit tests;
3. differential fixtures;
4. randomized seed subset;
5. native/WASM contract tests;
6. quality regression corpus.

Nightly/deeper gate:

- large seed suite;
- fuzzing;
- performance benchmarks;
- stress scenes.

---

# 19. M16 — Go-specific performance optimization after parity

No optimization may change behavior silently.

## 19.1 Allocation reduction

Prefer:

- packed integer state keys;
- reusable heaps/buffers;
- preallocated adjacency slices;
- indexed node/edge arrays;
- pooled scratch state when benchmark evidence supports it.

## 19.2 Scene spatial index

Replace O(nodes) per-state scans with benchmark-selected representation.

Candidate stack:

1. spatial hash for rapid parity and simple dynamic updates;
2. row interval/bitset occupancy for grid A*;
3. sparse orthogonal visibility graph for large scenes.

## 19.3 Pre-index graph relationships

Replace repeated filter/search operations with:

```text
nodeByID
incomingEdges[node]
outgoingEdges[node]
edgesByFace[node,side]
segmentsBySpatialCell
labelsBySpatialCell
```

## 19.4 Deterministic heap ordering

Heap comparison must include stable secondary keys; otherwise Go scheduling/internal ordering can produce route churn.

## 19.5 Benchmarks

Every optimization PR records:

- ns/op;
- B/op;
- allocs/op;
- expanded states;
- route quality vector;
- parity gate status.

Optimization is accepted only if correctness/parity gates remain green.

---

# 20. Production cutover sequence

Do **not** switch everything at once.

## C0 — shadow mode

React continues to display TS result; worker runs Go in parallel on fixture/dev sessions and logs differential summary.

## C1 — geometry/metrics shadow parity

Use Go geometry/metrics internally for comparison but retain TS production rendering path.

## C2 — Go routing opt-in

Developer/research toggle selects Go router; both outputs can be compared in BenchmarkPanel.

## C3 — Go routing default

Allowed only after M2–M6, M9 and M10 gates pass for production Orthogonal A* pipeline.

Keep TS router selectable as oracle/reference.

## C4 — Go layout default

Allowed after selected production layout (likely Sugiyama) passes M8 parity and quality gates.

## C5 — Go high-quality optimizer default

Allowed after M11–M12.

## C6 — TS algorithms become reference-only

Move them conceptually under research/reference ownership; production UI may no longer import them directly.

## C7 — final TS algorithm retirement

Only after at least one release cycle with:

- zero parity regressions;
- corpus quality gates green;
- native/WASM parity green;
- no production dependency on TS algorithm modules.

At retirement, retain frozen fixtures and mathematical specification permanently.

---

# 21. Recommended atomic implementation PR/commit order

The following order minimizes risk and makes each change independently testable.

## Wave A — proof infrastructure

1. Add `MATHEMATICAL_CONTRACT.md` skeleton and `PARITY_MATRIX.md`.
2. Add TS parity fixture exporter.
3. Add canonical JSON comparator.
4. Add first geometry fixtures.
5. Add `math-parity.yml` non-blocking workflow.
6. Fix optional-field semantics in Go types/protocol.
7. Make parity workflow blocking for M1/M2-covered surfaces.

## Wave B — geometry foundation

8. Port exact geometry/ordering/zero semantics.
9. Add DerivedBlockGeometry violations/header/content bounds.
10. Port auto-sizing.
11. Port deterministic free-slot placement.
12. Add shared intersection primitives.
13. Remove duplicate geometry predicates after tests pass.

## Wave C — routing quality foundation

14. Port adaptive stub solver.
15. Port strict segment/body/face validator.
16. Port complete artifact cleaner.
17. Restore full A* weights/default normalization.
18. Restore used-segment exclusion.
19. Restore proximity field.
20. Restore target approach/straightness rewards.
21. Restore verified fallback and explicit `no_path`.
22. Restore/replace TS spatial hash with Go scene index.
23. Benchmark and optimize allocations.

## Wave D — labels and metrics

24. Port strict label candidate solver.
25. Add wire-vs-label and label-vs-label collision.
26. Correct text measurement contract.
27. Port full metrics.
28. Version QualityVector.
29. Freeze benchmark baseline from canonical Go+TS-parity pipeline.

## Wave E — alternative routers

30. Port Manhattan router.
31. Port Lee router.
32. Port spline geometry.
33. Add common Router interface.
34. Add comparative router corpus.

## Wave F — layouts

35. Port orthogonal-grid layout.
36. Port force-directed layout.
37. Port Sugiyama cycle breaking/layers.
38. Port barycentric sweeps.
39. Port coordinate assignment.
40. Port pin-alignment refinement.
41. Add common Layout interface.

## Wave G — optimization/orchestration

42. Port exact NLP breakdown.
43. Port exact NLP force/update model.
44. Restore momentum/defaults/pinning.
45. Port unified co-optimizer using shared modules.
46. Add optional Go-enhanced high-quality profile only after parity profile is stable.

## Wave H — rendering geometry

47. Define renderer-independent path primitives.
48. Port bridge detection.
49. Port adaptive G¹ fillets.
50. Update React renderer to consume primitives.

## Wave I — incremental integration

51. Attach scene indexes/caches to SceneEngine revisions.
52. Add precise dirty-region invalidation.
53. Make open+patch equivalent to full recompute.
54. Add route stability policy.
55. Wire React to Worker/WASM production path.

## Wave J — cutover

56. Shadow compare TS/Go.
57. Make Go routing default.
58. Make Go layout default.
59. Make Go co-optimization default.
60. Remove direct production imports from `src/algorithms`.
61. Mark TS algorithms reference-only.
62. After release soak, delete or archive reference runtime code while retaining fixtures/spec.

---

# 22. Acceptance gates by subsystem

## Geometry gate

- exact defaults/presence semantics;
- all shape/side fixtures pass;
- Unicode sizing policy explicitly tested;
- deterministic ordering exact.

## Routing gate

- hard violations = 0;
- no shared forbidden segments;
- endpoint normal = valid;
- no unchecked fallback;
- deterministic repeated output;
- quality equal/Pareto-better than TS.

## Cleaner gate

- strict body/face avoidance;
- idempotent;
- endpoint stubs preserved;
- no micro-jog regressions.

## Labels gate

- own-arrow rule evaluated geometrically;
- other wires/labels/blocks considered;
- penalty parity;
- manual offsets parity.

## Metrics gate

- every QualityVector component independently parity-tested;
- metric version explicit;
- no hardcoded fake 100/0 placeholders.

## Layout gate

- layer/order parity;
- pinned behavior;
- no overlap regression;
- deterministic tie-breaks.

## NLP gate

- same parameter defaults;
- same objective components;
- same pinned/reference semantics;
- finite history;
- quality improves or stays equal according to objective.

## Core integration gate

- native == WASM contract result after canonicalization;
- scene patch final state == full recompute;
- no UI dependency in `go_engine/core`;
- production UI no longer computes heavy routing on main thread.

---

# 23. What must not be copied literally

Some TypeScript implementation details should be preserved only as behavior, not architecture.

Do **not** carry forward:

- React/UI dependencies into Go;
- SVG path strings as core geometry;
- repeated `edges.filter()`/`nodes.find()` scans;
- JSON deep-clone snapshots inside hot loops;
- JS allocation-oriented key strings;
- browser `performance.now()` dependencies in core;
- accidental iteration-order behavior;
- unchecked fallback geometry;
- duplicated implementations of intersection/metric formulas.

Instead preserve the mathematical output using Go-native efficient structures.

---

# 24. Final target repository structure

Recommended end state:

```text
go_engine/core/
  types.go
  options.go
  geometry_primitives.go
  block_geometry.go
  placement_free_slot.go
  intersections.go
  spatial_index.go

  layout.go
  layout_sugiyama.go
  layout_force.go
  layout_grid.go

  router.go
  routing_context.go
  router_astar.go
  router_manhattan.go
  router_lee.go
  router_spline.go
  port_stub.go
  congestion_field.go
  route_validator.go
  artifact_cleaner.go

  label_layout.go
  metrics.go
  nlp_optimizer.go
  cooptimizer.go

  path_primitives.go
  bridges.go
  g1_fillet.go

  scene_engine.go
  scene_invalidation.go
  api.go

  *_parity_test.go
  *_property_test.go
  *_benchmark_test.go

testdata/parity/
benchmarks/
docs/MATHEMATICAL_CONTRACT.md
docs/PARITY_MATRIX.md
```

The exact file split may evolve, but these responsibility boundaries should remain.

---

# 25. Definition of Done for the entire migration

The React→Go mathematical migration is complete only when all of the following are true:

1. every mathematical family from `src/algorithms` is represented in Go or explicitly documented as intentionally reference-only with a Go-equivalent production capability;
2. every retained principle has a written mathematical contract;
3. optional/default semantics are cross-language correct;
4. differential fixtures cover normal + adversarial cases;
5. Go geometry, route validity, labels and metrics pass parity gates;
6. selected production layout/router/co-optimizer pass QualityVector gates;
7. no successful Go route violates a hard invariant;
8. native and WASM results are contract-equivalent;
9. `scene.open` + arbitrary valid patch sequence converges to the same derived final scene as full recomputation;
10. the React UI does not own canonical routing/layout mathematics;
11. `src/algorithms` is no longer imported by the production execution path;
12. performance optimization did not weaken the mathematical contract;
13. benchmark score semantics are versioned;
14. parity and property tests remain permanent CI gates after the TS oracle is retired.

At that point `go_engine/core` may be declared the single canonical AutoTrace mathematical engine.
