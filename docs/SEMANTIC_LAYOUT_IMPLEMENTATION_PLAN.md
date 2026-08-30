# AutoTrace — Semantic Layout & Perceptual Composition Implementation Plan

Status: **implementation specification for WS-K**  
Depends on: completed MP0–MP20 foundation and canonical Go Core.  
Normative perceptual rules: `VISUAL_COMPOSITION_CONTRACT.md`.  
Target layout ID: `semantic_hierarchical_v1`.

---

# 0. Goal

Replace topology-insensitive rectangular/matrix placement as the quality default for workflow/process diagrams with a deterministic semantic layout pipeline that:

- understands source/sink, hierarchy, branches, merges, feedback and lanes;
- preserves a clear narrative flow;
- can move adaptive ports within declared constraints;
- treats labels and typography as geometry;
- supports compound graphs and swimlanes;
- preserves the user mental map under incremental edits;
- uses artistic/perceptual principles only after correctness/readability;
- exposes explainable quality metrics;
- runs canonically in Go native and Go/WASM.

Existing `sugiyama`, `orthogonal_grid`, `force_directed` and manual placement remain reference/fallback algorithms.

---

# 1. Target architecture

```text
Scene
  |
  v
SemanticAnalyzer
  |-- connected components
  |-- SCC / feedback
  |-- source / sink
  |-- hierarchy
  |-- lanes
  |-- semantic importance
  |-- narrative backbone
  v
ConstraintResolver
  |-- hard
  |-- strong
  |-- medium
  `-- weak
  v
SemanticHierarchicalLayout
  |-- rank/layer assignment
  |-- crossing-reduction ordering
  |-- branch/merge geometry
  |-- compound groups
  |-- lanes
  |-- label-aware footprints
  v
AdaptivePortPlanner
  |-- side candidates
  |-- capacity
  |-- order/grouping
  |-- anchor assignment
  v
CanonicalRouter
  v
PerceptualComposition
  |-- hierarchy
  |-- continuity
  |-- proximity/common region
  |-- alignment
  |-- whitespace
  |-- balance/rhythm
  |-- semantic symmetry
  |-- thirds/golden soft guides
  v
BoundedJointRefiner
  |-- local node moves
  |-- local port moves
  |-- local reroute/relabel
  v
Validator + Quality Vectors + Diagnostics
```

---

# 2. New Go Core modules

Recommended files; names may change only if responsibilities remain separated.

```text
go_engine/core/
  semantic_graph.go
  semantic_components.go
  semantic_scc.go
  semantic_backbone.go
  semantic_importance.go

  layout_constraints.go
  layout_constraint_resolver.go
  layout_snapshot.go

  semantic_layout.go
  semantic_layering.go
  semantic_ordering.go
  semantic_coordinates.go
  semantic_branches.go
  semantic_compound.go
  semantic_partitions.go
  semantic_feedback.go
  component_composer.go

  port_constraints.go
  port_candidates.go
  port_planner.go
  port_ordering.go
  port_capacity.go

  composition_profile.go
  composition_frame.go
  composition_guides.go
  composition_balance.go
  composition_whitespace.go
  composition_rhythm.go
  composition_refiner.go

  readability_metrics.go
  stability_metrics.go
  composition_metrics.go
  layout_diagnostics.go
```

Avoid a single giant `semantic_layout.go` that silently contains unrelated formulas.

---

# 3. Public contract additions

Keep public APIs small and versioned.

Conceptual public types:

```go
type LayoutAlgorithm string

const (
    LayoutManual                 LayoutAlgorithm = "manual"
    LayoutOrthogonalGrid         LayoutAlgorithm = "orthogonal_grid"
    LayoutSugiyama               LayoutAlgorithm = "sugiyama"
    LayoutForceDirected          LayoutAlgorithm = "force_directed"
    LayoutSemanticHierarchicalV1 LayoutAlgorithm = "semantic_hierarchical_v1"
)

type LayoutRequest struct {
    Algorithm                 LayoutAlgorithm
    CompositionProfileID      string
    CompositionFrame          *CompositionFrame
    PreserveExistingPositions bool
    AllowNodeMovement         bool
    AllowPortMovement         bool
    PreviousLayout            *LayoutSnapshot
    Constraints               []LayoutConstraint
    Budget                    LayoutBudget
}

type LayoutResult struct {
    Scene                Scene
    Snapshot             LayoutSnapshot
    Quality              QualityVector
    Readability          ReadabilityVector
    Stability            StabilityVector
    Composition          CompositionVector
    Diagnostics          []LayoutDiagnostic
    Status               LayoutStatus
    AlgorithmVersion     string
    CompositionVersion   string
}
```

`scene.open` semantics MUST NOT silently become “auto-layout everything”. Expose layout as an explicit operation or explicit `open` option with versioned behavior.

---

# 4. Port contract additions

Preserve current fields while adding explicit semantics.

Conceptual additions:

```go
type PortConstraintMode string

const (
    PortFree          PortConstraintMode = "free"
    PortFixedSide     PortConstraintMode = "fixed_side"
    PortFixedOrder    PortConstraintMode = "fixed_order"
    PortFixedRatio    PortConstraintMode = "fixed_ratio"
    PortFixedPosition PortConstraintMode = "fixed_position"
)

type PortCapacity struct {
    Mode  string // one | many | bounded
    Limit int
}
```

Rules:

- existing fixed ports remain bit-for-bit invariant;
- `allowedSides` is hard;
- `preferredSide` is soft/strong;
- `order` must preserve relative order when declared hard;
- group members remain contiguous where group policy requires it;
- `minSpacing` remains hard;
- adaptive derived anchors are not authoritative persisted identity.

---

# 5. Constraint API

Implement a typed constraint model before new layout algorithms rely on ad-hoc flags.

Required v1 constraints:

```text
FixedPosition
SoftPosition
FirstLayer
LastLayer
SameLayer
Before
After
AlignX
AlignY
KeepTogether
KeepApart
InsideRegion
OutsideRegion
MinDistance
PreserveOrder
LaneMembership
GroupContainment
```

Each has:

```text
constraint ID
entity IDs
strength
parameters
source: user | registry | semantic | previous-layout | algorithm
```

Conflict resolution MUST produce a diagnostic; hard-hard conflicts return explicit invalid-constraints status rather than arbitrary solver behavior.

---

# 6. Composition profile API

Initial profiles:

```text
technical_readability
process_flow
balanced
presentation_artistic
manual_preserve
```

Conceptual configuration:

```go
type CompositionProfile struct {
    ID string

    FlowDirection string
    AutoOrientation bool

    ContinuityStrength      float64
    GroupingStrength        float64
    AlignmentStrength       float64
    NegativeSpaceStrength   float64
    BalanceStrength         float64
    RhythmStrength          float64
    SymmetryStrength        float64
    RuleOfThirdsStrength    float64
    GoldenRatioStrength     float64

    PreserveMentalMap       float64
    PortSideHysteresis      float64
    MaxCompositionExpansion float64

    PreferredAspectMin      float64
    PreferredAspectMax      float64
}
```

All defaults live in one canonical layer and are versioned.

---

# 7. Milestone dependency graph

```text
MP21 Contract/baseline
  -> MP22 Semantic graph
  -> MP23 Constraint system
  -> MP24 Components/SCC/feedback decomposition
  -> MP25 Narrative backbone/importance
  -> MP26 Layering/order
  -> MP27 Compound graphs
  -> MP28 Swimlanes/partitions
  -> MP29 Label-aware coordinates
  -> MP30 Port candidate model
  -> MP31 Port order/capacity/grouping
  -> MP32 Routing integration
  -> MP33 Perceptual composition
  -> MP34 Accessibility/visual semantics
  -> MP35 Mental-map stability
  -> MP36 Bounded joint refinement
  -> MP37 Quality/readability metrics
  -> MP38 Diagnostics/explainability
  -> MP39 Corpus/human evaluation
  -> MP40 Shadow rollout/default gate
```

MP27/MP28 may partly proceed after MP23/MP24 in parallel with MP25/MP26 if shared constraint contracts are frozen first. MP30/MP31 may prototype in parallel, but production integration waits for MP29 coordinate contracts.

---

# 8. MP21 — Contract, baseline and version domains [BLOCKING]

## Deliverables

- [ ] approve `VISUAL_COMPOSITION_CONTRACT.md` as normative;
- [ ] add semantic-layout algorithm/version constants;
- [ ] define `ReadabilityVector`, `StabilityVector`, `CompositionVector` schemas;
- [ ] define `LayoutSnapshot` schema;
- [ ] define `CompositionProfile` and `CompositionFrame` schemas;
- [ ] freeze baseline corpus for current Sugiyama/Grid/manual layouts;
- [ ] record current crossings/bends/wirelength/area/stability metrics;
- [ ] add semantic-layout version domain separate from routing metric version when appropriate;
- [ ] add ADR explaining why golden ratio is soft, not hard.

## Acceptance

- schemas round-trip Go native ↔ WASM ↔ TS SDK;
- explicit-zero/false presence semantics covered;
- no current production layout output changes merely from adding schemas;
- baseline results reproducibly regenerate.

---

# 9. MP22 — Semantic graph analyzer [BLOCKING]

## Deliverables

- [ ] connected components;
- [ ] explicit source/sink recognition;
- [ ] degree fallback source/sink inference;
- [ ] hierarchy depth;
- [ ] lane membership extraction;
- [ ] edge semantic class extraction;
- [ ] fan-in/fan-out;
- [ ] articulation analysis;
- [ ] bounded betweenness approximation or exact mode by graph size/budget;
- [ ] deterministic component/node metadata.

## Acceptance

Corpus:

```text
chain
fan-out
fan-in
diamond
multiple-source
multiple-sink
disconnected
nested-group
```

Tests:

- deterministic under input permutation;
- explicit category outranks degree inference;
- no mutation of scene input;
- O(V+E) for basic graph decomposition excluding optional centrality analysis;
- centrality mode has declared complexity/budget.

---

# 10. MP23 — Typed layout constraints [BLOCKING]

## Deliverables

- [ ] hard/strong/medium/weak strength model;
- [ ] v1 constraint types;
- [ ] deterministic conflict resolver;
- [ ] diagnostics for conflict and relaxation;
- [ ] registry/scene/API adapters;
- [ ] preserve current `isPinned` behavior through `FixedPosition` mapping.

## Acceptance

- fixed nodes never move;
- conflicting hard constraints produce explicit failure;
- adding a weak constraint cannot invalidate an otherwise feasible hard solution;
- deterministic tie resolution;
- serialization/parity tests green.

---

# 11. MP24 — Components, SCC and feedback decomposition

## Deliverables

- [ ] Tarjan/Kosaraju deterministic SCC implementation;
- [ ] condensation DAG;
- [ ] feedback-edge candidate classification;
- [ ] self-loop classification;
- [ ] parallel-edge grouping metadata;
- [ ] component-local layout boundaries;
- [ ] feedback corridor metadata.

## Acceptance

- SCC IDs deterministic independent of map iteration;
- self-loops never enter ordinary inter-node routing planning;
- disconnected components can be independently recomputed;
- condensation graph is acyclic;
- feedback classification preserves original edge identity.

---

# 12. MP25 — Narrative backbone and importance

## Deliverables

- [ ] single-path backbone;
- [ ] co-primary path support;
- [ ] critical-subgraph hook when process duration exists;
- [ ] normalized junction/importance feature vector;
- [ ] branch-mass computation;
- [ ] renderer-neutral node/edge semantic emphasis hints.

## Acceptance

- explicit user/semantic priority beats pure centrality;
- metrics normalized/capped and inspectable;
- no hard-coded “one main path always” assumption;
- equal-cost selection deterministic;
- synthetic critical-path and co-primary fixtures pass.

---

# 13. MP26 — Semantic layering and crossing-reduction ordering

## Deliverables

- [ ] constrained rank assignment;
- [ ] source-first/sink-last support;
- [ ] same-layer/before/after constraints;
- [ ] stable long-edge treatment;
- [ ] port-aware barycentric ordering reuse where valid;
- [ ] deterministic forward/backward sweeps;
- [ ] auto-orientation comparison when direction unspecified;
- [ ] previous-order bias for incremental mode.

## Acceptance

- zero rank hard violations;
- crossings <= canonical Sugiyama baseline on agreed corpus or documented Pareto exception;
- source/sink semantic fixtures correct;
- permutations yield same canonical result;
- previous order retained when quality tie exists.

---

# 14. MP27 — Compound graphs and subcircuits

## Deliverables

- [ ] recursive child layout;
- [ ] group padding/header footprint;
- [ ] group ports;
- [ ] expanded/collapsed representation contract;
- [ ] cross-hierarchy edge handling;
- [ ] stable group outer frame where feasible;
- [ ] local expand/collapse re-layout.

## Acceptance

- child nodes remain inside group hard bounds;
- collapse/expand does not globally move unrelated components beyond configured stability budget;
- cross-hierarchy routes validate;
- group labels never overlap reserved child content under supported profiles;
- nested depth stress corpus bounded and deterministic.

---

# 15. MP28 — Swimlanes / partitions

## Deliverables

- [ ] lane model and order;
- [ ] lane header geometry;
- [ ] hard/soft lane membership;
- [ ] cross-lane edge cost;
- [ ] lane-aware layering/coordinate assignment;
- [ ] groups inside lanes;
- [ ] lane-preserving incremental edits.

## Acceptance

- hard lane membership never violated;
- lane order deterministic;
- cross-lane routes remain valid;
- adding a node to one lane produces bounded changes to unaffected lanes;
- lane header/content collision tests green.

---

# 16. MP29 — Label-aware coordinate assignment and typography metrics

## Deliverables

- [ ] renderer-neutral text measurement contract;
- [ ] effective node footprint includes node/port labels;
- [ ] edge-label reservation hook;
- [ ] group/lane label footprints;
- [ ] long/multiline/Unicode/CJK fixtures;
- [ ] RTL-ready geometry contract;
- [ ] content-change invalidation mapping.

## Acceptance

- no node clipping in measured fixtures;
- no port label outside reserved geometry unless allowed by style profile;
- deterministic conservative fallback when host text metrics unavailable;
- language/content changes cause only required invalidation;
- layout math remains DOM-independent.

---

# 17. MP30 — Adaptive port candidate model

## Deliverables

- [ ] explicit constraint-mode mapping;
- [ ] deterministic candidate anchors on allowed sides;
- [ ] shape-aware candidate generation;
- [ ] preferred-side bias;
- [ ] previous-side hysteresis input;
- [ ] candidate route-estimate API;
- [ ] derived-anchor snapshot support.

## Acceptance

- fixed port invariance = 100%;
- every adaptive anchor lies on an allowed side;
- min-spacing hard constraints always satisfied;
- unsupported side/shape configuration returns explicit failure;
- deterministic candidates and tie breaks.

---

# 18. MP31 — Port order, capacity and grouping

## Deliverables

- [ ] one/many/bounded capacity;
- [ ] fixed relative order;
- [ ] contiguous port groups;
- [ ] neighbor-order-aware inversion minimization;
- [ ] shared anchor/stub policy;
- [ ] edge-group/bus metadata;
- [ ] deterministic conflict resolution.

## Acceptance

- no capacity overflow;
- no avoidable hard order violation;
- port-order inversions <= baseline on port-heavy corpus;
- adding allowed side freedom cannot force a worse Tier-0 result;
- grouped ports/edges remain semantically distinguishable.

---

# 19. MP32 — Canonical routing integration

## Deliverables

- [ ] chosen port anchors feed canonical router;
- [ ] endpoint normals/stubs remain authoritative;
- [ ] feedback corridors integrated;
- [ ] self-loop router primitive;
- [ ] parallel-edge lane spacing;
- [ ] bus/shared-trunk routing where allowed;
- [ ] route result returns port-anchor decisions;
- [ ] no router-specific hidden port movement.

## Acceptance

- all successful routes pass existing route validator;
- no new unchecked fallback;
- no duplicate endpoint-placement mathematics inside routers;
- crossings/bends/wirelength measured after canonical cleaning;
- Go native/WASM output equivalent.

---

# 20. MP33 — Perceptual composition engine

## Deliverables

- [ ] provisional composition frame;
- [ ] alignment guides;
- [ ] negative-space halos with saturation;
- [ ] visual-mass/balance metric;
- [ ] semantic rhythm/modular spacing;
- [ ] semantically conditional symmetry;
- [ ] rule-of-thirds guides;
- [ ] golden-ratio focal guides;
- [ ] bounded composition movement;
- [ ] `MaxCompositionExpansion` enforcement.

## Required order inside the pass

```text
continuity/grouping/alignment
  -> whitespace
  -> balance/rhythm
  -> semantic symmetry
  -> thirds/golden weak tie-breaking
```

## Acceptance

- Tier-0 never worsens;
- Tier-1 may not regress beyond explicit profile budget;
- golden/thirds strength = 0 produces no guide attraction;
- no node required to become a golden rectangle;
- area expansion never exceeds profile maximum;
- repeated run idempotent within canonical rounding.

---

# 21. MP34 — Accessibility and visual semantic contract

## Deliverables

- [ ] renderer-neutral semantic role/emphasis hints;
- [ ] edge semantic classes;
- [ ] junction-vs-crossing distinction metadata;
- [ ] theme conformance rules for non-color redundancy;
- [ ] high-contrast/grayscale regression fixtures;
- [ ] accessibility documentation references.

## Acceptance

- no connectivity/semantic state relies exclusively on hue;
- junctions remain distinguishable from crossings in supported renderers;
- high-contrast and grayscale snapshots preserve graph interpretation;
- render-only accessibility changes trigger zero reroutes unless measured geometry changes.

---

# 22. MP35 — Mental-map and incremental stability

## Deliverables

- [ ] full `LayoutSnapshot` state;
- [ ] importance-weighted movement cost;
- [ ] rank/order stability;
- [ ] branch-side stability;
- [ ] component/group-frame stability;
- [ ] port-side hysteresis;
- [ ] local repair region calculation;
- [ ] incremental-vs-full quality equivalence policy.

## Acceptance

- adding one leaf to representative graphs does not move unrelated nodes beyond approved budget;
- port side does not flap for marginal wire-length changes;
- pinned nodes remain invariant;
- collapse/expand localized where feasible;
- final incremental result remains Tier-0 valid and inside approved quality envelope versus full recompute.

---

# 23. MP36 — Bounded joint refinement

## Deliverables

- [ ] deterministic candidate move enumeration;
- [ ] local node moves;
- [ ] local port side/offset moves;
- [ ] affected-edge reroute only;
- [ ] affected-label replace only;
- [ ] lexicographic acceptance comparator;
- [ ] no-improvement stop;
- [ ] deterministic work/iteration budget;
- [ ] cancellation support;
- [ ] fast/normal/quality/offline profiles.

## Acceptance

- never accepts Tier-0 regression;
- all accepted moves record quality delta;
- deterministic for same work budget;
- bounded memory/work;
- quality profile is Pareto-better/equal to fast profile on release corpus except explicitly documented budget trade-offs.

---

# 24. MP37 — Readability, stability and composition metrics

## Deliverables

Implement versioned vectors from `VISUAL_COMPOSITION_CONTRACT.md`.

At minimum:

```text
ReadabilityVector
  backwardFlowEdges
  sourceRankViolations
  sinkRankViolations
  mainBackboneBends
  mainBackboneStraightness
  branchCoherence
  junctionClarity
  portOrderInversions
  portConstraintViolations
  preferredSideDeviation
  hierarchyFragmentation
  laneViolations
  feedbackClarity
  labelAmbiguities

StabilityVector
  nodeMovement
  weightedNodeMovement
  rankChanges
  siblingOrderChanges
  portSideChanges
  portOrderChanges
  branchSideChanges
  groupFrameMovement
  routeChurn

CompositionVector
  visualBalance
  negativeSpace
  rhythm
  alignment
  semanticSymmetry
  gestaltGrouping
  focalPoint
  ruleOfThirds
  goldenComposition
  frameExpansion
```

## Acceptance

- raw + normalized variants where scale matters;
- metric determinism;
- metric computation cannot mutate layout;
- one composite score is never a release gate;
- benchmark report exposes vector deltas.

---

# 25. MP38 — Diagnostics / explainability

## Deliverables

- [ ] `LayoutDiagnostic` public/debug contract;
- [ ] constraint reason reporting;
- [ ] semantic importance breakdown;
- [ ] branch-side decisions;
- [ ] port side/anchor decisions;
- [ ] composition guide influence;
- [ ] fallback/status reason;
- [ ] benchmark UI quality breakdown.

## Acceptance

For representative fixtures, diagnostics can answer:

- why node is on this rank;
- why branch is above/below;
- why port changed side;
- why node did not move despite a composition preference;
- whether golden/thirds affected the final layout;
- which quality tier blocked a candidate move.

Diagnostics are deterministic and do not expose replaceable internal heap/search node structures.

---

# 26. MP39 — Verification corpus and human evaluation

## Automated corpus

Add:

```text
testdata/layout_semantic/
testdata/layout_composition/
testdata/layout_incremental/
testdata/layout_accessibility/
```

Families include all cases in `VISUAL_COMPOSITION_CONTRACT.md` plus scale buckets S/M/L/XL.

## Metamorphic gates

- deterministic rerun;
- input permutation invariance;
- fixed-node/port invariance;
- translation invariance where applicable;
- adaptive side feasibility;
- small-edit bounded movement;
- disabled-guide neutrality;
- unrelated-component locality;
- native/WASM equivalence.

## Visual artifacts

Generate for benchmark/release review:

```text
before.svg/png
after.svg/png
metrics.json
diagnostics.json
```

Pixel equality is not the core gate; structural metrics and invariants are.

## Human A/B protocol

Separate comprehension tasks from aesthetic preference.

Comprehension tasks:

- find source/sink;
- trace primary path;
- identify merge/branch;
- identify feedback/exception;
- identify lane/ownership;
- find relation between two nodes.

Measure completion time, error rate and confidence. Store subjective “looks better” separately.

## Acceptance

- automated corpus Tier-0 zero;
- no statistically meaningful comprehension regression versus current best baseline;
- preferred new default must show measurable improvement on at least one key readability dimension without unacceptable regressions;
- all benchmark seeds/version metadata reproducible.

---

# 27. MP40 — Shadow rollout and default gate

Rollout:

```text
S0 hidden benchmark only
S1 developer opt-in
S2 UI experimental profile
S3 selected process/workflow templates
S4 default for eligible workflow/process scenes
S5 broaden default after release history
```

Fallback remains available:

```text
semantic_hierarchical_v1
  -> semantic fast
  -> canonical Sugiyama
  -> preserve-input-layout + route
```

## Production gate

`semantic_hierarchical_v1` becomes default only when:

1. Tier-0 corpus = zero violations;
2. deterministic/native/WASM gates green;
3. fixed and constrained port invariants green;
4. crossings/readability equal or Pareto-better than approved baseline;
5. incremental movement inside approved budget;
6. composition expansion bounded;
7. no hidden dependence on DOM/render pixels;
8. diagnostics and metrics available;
9. performance inside approved interactive/normal budgets;
10. at least one release cycle of opt-in telemetry/benchmark review is free of blocker regressions.

---

# 28. Atomic implementation waves M–R

The historical Waves A–L remain the completed migration/productization program. New semantic-layout work continues with new wave letters.

## Wave M — contracts and semantics

M01 visual composition contract.  
M02 semantic-layout schemas.  
M03 layout snapshot schema.  
M04 quality-vector extensions.  
M05 baseline corpus exporter.  
M06 semantic analyzer components.  
M07 source/sink semantics.  
M08 SCC decomposition.  
M09 importance features.  
M10 narrative backbone.

## Wave N — constraints and hierarchical geometry

N01 typed constraint base.  
N02 conflict resolver.  
N03 constrained rank assignment.  
N04 crossing ordering.  
N05 branch allocation.  
N06 merge positioning.  
N07 component composer.  
N08 compound groups.  
N09 collapse/expand stability.  
N10 swimlanes.

## Wave O — text and adaptive ports

O01 text measurement contract.  
O02 label-aware footprints.  
O03 adaptive port modes.  
O04 side candidates.  
O05 port capacity.  
O06 port group/order solver.  
O07 hysteresis.  
O08 self-loop ports.  
O09 parallel/bus policy.  
O10 canonical router integration.

## Wave P — perceptual composition

P01 composition frame.  
P02 alignment/continuity guides.  
P03 whitespace halos.  
P04 balance.  
P05 rhythm/modular spacing.  
P06 semantic symmetry.  
P07 rule-of-thirds.  
P08 golden-ratio guides.  
P09 bounded composition move set.  
P10 max-expansion enforcement.

## Wave Q — incremental co-refinement and metrics

Q01 layout snapshot restoration.  
Q02 movement/stability cost.  
Q03 branch/port hysteresis.  
Q04 local dirty-region refinement.  
Q05 lexicographic comparator.  
Q06 bounded iteration/work budgets.  
Q07 readability metrics.  
Q08 stability metrics.  
Q09 composition metrics.  
Q10 diagnostics.

## Wave R — validation and rollout

R01 full semantic corpus.  
R02 metamorphic corpus.  
R03 native/WASM conformance.  
R04 accessibility/render profiles.  
R05 visual benchmark artifacts.  
R06 human A/B protocol.  
R07 benchmark dashboard.  
R08 developer opt-in.  
R09 process/workflow opt-in.  
R10 production default gate.

Every wave item that changes mathematical behavior must include tests and benchmark delta in the same change whenever practical.

---

# 29. Key algorithmic guardrails

Do not:

- replace explicit semantics with degree heuristics when metadata exists;
- use one weighted scalar to trade a crossing for prettier proportions;
- move fixed ports/nodes during “cleanup”;
- make golden ratio or thirds hard constraints;
- optimize each port independently when ordering creates crossings;
- let routers secretly choose different endpoint anchors;
- let text measurement depend on DOM from Go Core;
- globally rearrange a scene for a small local edit without diagnostic evidence;
- infer connection from color;
- treat a bus/shared trunk as semantically safe by default;
- accept runtime improvements that weaken Tier-0/Tier-1 quality without an explicit approved profile budget;
- rely on Go map iteration for any externally visible choice.

---

# 30. Definition of Done for WS-K

WS-K is complete only when all statements are true:

1. `semantic_hierarchical_v1` is implemented canonically in Go Core.
2. Native Go and Go/WASM are deterministic and conformant.
3. Semantic source/sink/hierarchy/lane/SCC analysis is versioned and tested.
4. Typed hard/soft layout constraints exist.
5. Compound graphs and swimlanes are first-class.
6. Labels and typography participate in effective geometry.
7. Fixed ports remain fixed; adaptive ports can select allowed sides/anchors.
8. Port capacity/order/grouping are validated.
9. Self-loops, parallel edges, feedback corridors and allowed buses have explicit policies.
10. Main narrative/backbone is more important than compact rectangle packing.
11. Perceptual composition includes hierarchy, continuity, proximity, alignment, whitespace, balance and rhythm.
12. Symmetry is semantic/conditional.
13. Golden ratio and rule of thirds are optional weak priors.
14. Composition cannot introduce a Tier-0 regression.
15. Mental-map snapshots and port hysteresis prevent avoidable layout flapping.
16. Joint refinement is bounded and deterministic.
17. Readability/Stability/Composition vectors are exposed alongside existing QualityVector.
18. Raw and normalized metrics are available.
19. Decision diagnostics explain significant node/port/composition choices.
20. Automated semantic, incremental, accessibility and composition corpora pass.
21. Human A/B protocol exists and keeps comprehension separate from beauty preference.
22. Shadow rollout demonstrates acceptable performance and quality.
23. Existing layouts remain available as reference/fallback.
24. LBC/domain scene builders can migrate from fixed matrix coordinates to semantic intent without losing manual override capability.
25. Documentation matches actual contracts and code.

---

## Final implementation rule

> **Do not optimize the rectangle; optimize the explanation.**
>
> AutoTrace should first make the graph semantically obvious, then stable, then perceptually well composed, and only then compact.
