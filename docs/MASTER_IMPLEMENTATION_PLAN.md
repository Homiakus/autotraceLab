# AutoTraceLab — MASTER IMPLEMENTATION PLAN

Status: **single authoritative implementation plan**  
Historical execution baseline: MP0–MP20 completed.  
Active program baseline: `601befd3e2bfed1decf776922f473119576f5205`.  
Target: a deterministic, validated, high-performance, reusable AutoTrace Core in Go with semantic graph understanding, adaptive ports, human-readability optimization, perceptual composition, incremental stability, portable registries and production-grade embedding.

---

# 0. Authority and execution rule

This document is the only normative execution order for the project.

Historical plans remain useful audit/reference material, but when ordering, acceptance criteria or architecture wording conflicts, this master plan wins.

Detailed normative contracts are split by responsibility:

- `MATHEMATICAL_CONTRACT.md` — canonical mathematical semantics;
- `ROUTING_CONTRACT.md` — route validity and routing semantics;
- `VISUAL_COMPOSITION_CONTRACT.md` — semantic layout, perception, composition and mental-map invariants;
- `ADAPTIVE_PORT_PLACEMENT.md` — movable-port semantics and constraints;
- `HUMAN_READABILITY_METRICS.md` — readability/stability/composition metric definitions;
- `SEMANTIC_LAYOUT_IMPLEMENTATION_PLAN.md` — detailed MP21–MP40 implementation specification;
- `rule/4.md` — non-negotiable semantic-layout implementation invariants.

The central architecture rule remains:

> **Go Core is the canonical production mathematical engine. New semantic layout/composition mathematics must be implemented canonically in Go and exposed through the existing native/WASM/SDK boundary.**

The new semantic-layout program does not reopen the TS-to-Go migration. Existing TS algorithms remain historical/reference fixtures where useful, while new production math is Go-first with native/WASM conformance.

---

# 1. Product end state

AutoTrace consists of five separated products/layers:

```text
AutoTrace Core
  deterministic headless mathematics + scene/layout/routing engine

AutoTrace Contract / SDK
  stable scene, registry, protocol, layout and capability contracts

AutoTrace Registry
  portable domain vocabulary and semantic/layout hints

AutoTrace Renderer / Adapters
  React today; other renderers/hosts later

AutoTraceLab
  reference editor + benchmark laboratory + customization/admin UI
```

Target architecture:

```text
Host application
  |
  | HostAdapter: persistence/assets/auth/telemetry/IDs/text metrics
  v
AutoTrace SDK
  |-- EngineClient
  |-- RegistryClient
  |-- Theme API
  |-- layout API
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
  |-- Semantic Graph Analyzer
  |-- Layout Constraint Resolver
  |-- Semantic Hierarchical Layout
  |-- Compound / Partition Layout
  |-- Adaptive Port Planner
  |-- Perceptual Composition
  |-- Scene / Spatial Index
  |-- Routing
  |-- Route Validation / Postprocess
  |-- Labels
  |-- Readability / Stability / Composition Metrics
  |-- Bounded Joint Refinement
  |-- Incremental SceneEngine
  `-- Versioned Contracts + Diagnostics
```

---

# 2. Non-negotiable architectural boundaries

1. Core imports no React, DOM or browser UI package.
2. A block/edge/port type is data, not a React component or switch branch.
3. Visual style is not routing/layout geometry.
4. Semantic importance may produce renderer-neutral hints; renderer decides concrete color/font/stroke/icon presentation.
5. Host persistence/auth/assets/text measurement are adapters, not core logic.
6. Browser main thread never performs production full layout/routing after Go/WASM cutover.
7. Every successful production route is validated.
8. Every externally visible deterministic decision has stable tie-breaking.
9. Native Go and WASM execute the same canonical mathematics.
10. Hard constraints are feasibility conditions, never low scalar penalties.
11. Existing validated algorithms remain fallback/reference until replacements pass explicit gates.
12. No one composite score is the release truth.
13. Art serves comprehension; decorative composition never outranks semantic readability.

---

# 3. Consolidated workstreams

The program has eleven coordinated workstreams.

## WS-A — Mathematical contract and historical oracle [FOUNDATION COMPLETE]

- canonical mathematical contract;
- parity fixtures/history;
- deterministic numeric/JSON semantics;
- invariant/property tests.

## WS-B — Canonical Go mathematical core [FOUNDATION COMPLETE]

- block/port geometry;
- canonical routers;
- label solver;
- metrics;
- existing layouts;
- cleaner;
- co-optimization primitives.

## WS-C — Incremental scene engine and performance [FOUNDATION COMPLETE]

- revisioned scenes;
- dependency-local invalidation;
- route reuse;
- spatial/occupancy indices;
- bounded search;
- congestion/rip-up/nudging;
- allocation control.

## WS-D — Reusable headless boundary and SDK [FOUNDATION COMPLETE]

Embedding modes:

- router-only;
- layout+router;
- headless SceneEngine;
- viewer/editor;
- native batch/server;
- WASM Worker;
- future RPC/service adapter.

## WS-E — Declarative registry and customization [FOUNDATION COMPLETE]

Domain types, shapes, icons, themes, routing profiles and portable packages remain data-driven and versioned.

## WS-F — Customization/admin UX [FOUNDATION COMPLETE]

Non-developers can edit appearance/domain types without source-code changes.

## WS-G — Renderer and frontend execution [FOUNDATION COMPLETE]

AutoTraceLab consumes Core/SDK rather than owning production mathematics.

## WS-H — Benchmarking, verification and observability [ACTIVE EXTENSION]

Existing route/performance corpus is extended with semantic-layout, composition, accessibility, human-readability and incremental mental-map families.

## WS-I — Security, CI and release engineering [ACTIVE EXTENSION]

Existing native/WASM/registry/security gates are extended with semantic-layout contract, deterministic corpus and quality-vector regression gates.

## WS-J — Documentation and adoption [ACTIVE EXTENSION]

Documentation must track new semantic layout/composition APIs and domain migration.

## WS-K — Semantic Layout & Perceptual Composition [ACTIVE]

Purpose: make AutoTrace optimize the visual explanation of a graph rather than rectangle packing.

Subareas:

```text
K1  Semantic analysis
K2  Typed constraint model
K3  Narrative backbone
K4  Hierarchical layering/order
K5  Branch/merge geometry
K6  Compound graphs/subcircuits
K7  Partitions/swimlanes
K8  Feedback/SCC/self-loop geometry
K9  Adaptive port assignment
K10 Port order/capacity/grouping
K11 Label-aware sizing/typography
K12 Canonical routing integration
K13 Perceptual composition
K14 Accessibility visual semantics
K15 Mental-map stabilization
K16 Bounded joint refinement
K17 Readability/stability/composition metrics
K18 Diagnostics/explainability
K19 Human/automated benchmark program
K20 Shadow rollout/default switch
```

---

# 4. Canonical quality order

Layout comparison is lexicographic/Pareto by tier.

## Tier 0 — hard validity

Examples:

- finite coordinates;
- legal containment;
- fixed-node/port invariance;
- allowed port sides;
- capacity/min spacing;
- valid endpoint normals;
- no forbidden node/wire intersection;
- no invalid route;
- no unchecked fallback.

A Tier-0-invalid result cannot beat a valid result.

## Tier 1 — topological readability

- crossings;
- ambiguous shared paths;
- junction ambiguity;
- backward non-feedback flow;
- main-backbone discontinuity;
- port-order inversions;
- label ambiguity/collisions.

## Tier 2 — cognitive simplicity

- main-backbone bends/straightness;
- branch coherence;
- merge/junction clarity;
- feedback clarity;
- parallel-flow coherence;
- unnecessary detours/congestion.

## Tier 3 — mental-map stability

- node movement;
- rank/order changes;
- group/lane movement;
- branch-side changes;
- port side/order changes;
- route/label churn.

## Tier 4 — perceptual composition

- hierarchy;
- continuity/proximity/common region;
- alignment;
- negative space;
- balance;
- rhythm;
- semantically justified symmetry;
- focal guides;
- thirds/golden-ratio soft priors.

## Tier 5 — economy/performance

- wire length;
- area/compactness;
- aspect-frame fit;
- runtime;
- allocations.

Default policy:

```text
readability > stability > composition > compactness
```

---

# 5. Perceptual/artistic principles

AutoTrace intentionally borrows composition principles from art/design, but gives them explicit engineering priority.

## High priority

- visual hierarchy;
- continuity;
- proximity;
- common region;
- alignment;
- negative space;
- visual movement / eye path;
- figure-ground separation.

## Medium / conditional

- balance;
- rhythm;
- repetition;
- scale;
- unity/variety;
- symmetry only for semantically equivalent structures;
- closure where it improves grouping.

## Weak/profile-dependent

- rule of thirds;
- golden-ratio focal guides;
- Fibonacci/modular spacing ratios.

Golden ratio is a **soft composition prior**, not a readability law:

```text
phi = 1.61803398875...
0.61803398875...
0.38196601125...
```

No block or canvas is required to be a golden rectangle. A golden/thirds improvement never justifies a hard violation or ordinary crossing regression in default profiles.

---

# 6. Completed foundation MP0–MP20

MP0–MP20 are historical completed foundation milestones. Their detailed implementation remains represented by the existing code/contracts/tests and Git history.

| Milestone | Result | Status |
|---|---|---|
| MP0 | governance/baseline freeze | COMPLETED |
| MP1 | cross-language data semantics | COMPLETED |
| MP2 | parity/metamorphic harness | COMPLETED |
| MP3 | geometry foundation parity | COMPLETED |
| MP4 | endpoint escape/cleaner | COMPLETED |
| MP5 | Orthogonal A* canonical parity | COMPLETED |
| MP6 | alternate routers | COMPLETED |
| MP7 | existing layout parity | COMPLETED |
| MP8 | labels + canonical metrics | COMPLETED |
| MP9 | NLP objective parity | COMPLETED |
| MP10 | unified co-optimization/bridge geometry | COMPLETED |
| MP11 | incremental mathematics integration | COMPLETED |
| MP12 | Worker/SDK shadow integration | COMPLETED |
| MP13 | declarative registry | COMPLETED |
| MP14 | invalidation/customization vertical slices | COMPLETED |
| MP15 | Go routing/performance optimization | COMPLETED |
| MP16 | full customization/admin workspace | COMPLETED |
| MP17 | embedding SDK/host adapters | COMPLETED |
| MP18 | Go production cutover | COMPLETED |
| MP19 | CI/security/release hardening | COMPLETED |
| MP20 | documentation/cleanup/final Go architecture | COMPLETED |

Existing Sugiyama, force-directed and orthogonal-grid behavior remains available as baseline/reference/fallback. MP21+ is a quality evolution, not a rewrite of MP0–MP20 history.

---

# 7. Active dependency graph MP21–MP40

```text
MP21 Contract/baseline
  -> MP22 Semantic graph
  -> MP23 Constraint system
  -> MP24 Components/SCC/feedback
  -> MP25 Narrative backbone/importance
  -> MP26 Layering/order
  -> MP27 Compound graphs
  -> MP28 Swimlanes/partitions
  -> MP29 Label-aware coordinates
  -> MP30 Adaptive port candidates
  -> MP31 Port order/capacity/grouping
  -> MP32 Routing integration
  -> MP33 Perceptual composition
  -> MP34 Accessibility semantics
  -> MP35 Mental-map stability
  -> MP36 Bounded joint refinement
  -> MP37 Quality/readability metrics
  -> MP38 Diagnostics/explainability
  -> MP39 Verification/human evaluation
  -> MP40 Shadow rollout/default gate
```

Permitted parallelism:

- MP27/MP28 may proceed after MP23/MP24 contracts stabilize;
- MP30/MP31 may prototype after MP23, but production integration waits for MP29;
- UI/benchmark visualization can proceed in parallel after schemas freeze;
- no branch/module may define a second formula for the same semantic/layout decision.

---

# 8. MP21 — Contract and baseline [BLOCKING]

- [ ] approve `VISUAL_COMPOSITION_CONTRACT.md` as normative;
- [ ] approve `ADAPTIVE_PORT_PLACEMENT.md`;
- [ ] approve `HUMAN_READABILITY_METRICS.md`;
- [ ] add `semantic_hierarchical_v1` algorithm/version constants;
- [ ] define `LayoutRequest`/`LayoutResult` extensions;
- [ ] define `LayoutSnapshot`;
- [ ] define `CompositionProfile` and `CompositionFrame`;
- [ ] define Readability/Stability/Composition vectors;
- [ ] freeze current Sugiyama/Grid/manual semantic-layout baseline corpus;
- [ ] record benchmark/quality baseline;
- [ ] add ADR for perceptual-prior priority and golden-ratio status.

Exit:

- contracts native/WASM/TS round-trip;
- explicit zero/false semantics preserved;
- existing production output unchanged by schema-only work;
- baseline is reproducible.

---

# 9. MP22 — Semantic graph analyzer [BLOCKING]

- [ ] connected components;
- [ ] explicit source/sink semantics;
- [ ] degree-based fallback only;
- [ ] hierarchy depth;
- [ ] lane membership;
- [ ] semantic edge classes;
- [ ] fan-in/fan-out;
- [ ] articulation importance;
- [ ] bounded centrality/betweenness mode;
- [ ] deterministic semantic metadata.

Exit:

- chain/fan/diamond/multi-source/multi-sink/disconnected/nested fixtures green;
- explicit semantics outrank heuristics;
- deterministic under input permutations.

---

# 10. MP23 — Typed layout constraints [BLOCKING]

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

Strength:

```text
HARD
STRONG
MEDIUM
WEAK
```

- [ ] typed contract;
- [ ] deterministic conflict resolution;
- [ ] conflict diagnostics;
- [ ] `isPinned` compatibility mapping;
- [ ] registry/scene/API adapters.

Exit:

- fixed nodes invariant;
- hard-hard conflicts fail explicitly;
- weak preferences cannot invalidate feasible hard solutions.

---

# 11. MP24 — Components, SCC, feedback, self/parallel edges

- [ ] deterministic SCC decomposition;
- [ ] condensation DAG;
- [ ] feedback-edge classification;
- [ ] dedicated feedback corridor metadata;
- [ ] self-loop classification;
- [ ] parallel-edge grouping metadata;
- [ ] disconnected-component local boundaries.

Exit:

- SCC deterministic;
- condensation acyclic;
- self-loops bypass ordinary inter-node side planning;
- unrelated components can be independently recomputed.

---

# 12. MP25 — Narrative backbone and semantic importance

The backbone may be:

```text
single primary path
multiple co-primary paths
primary tree
critical subgraph
explicit user-selected subgraph
```

- [ ] backbone extraction;
- [ ] critical-path hook when process duration exists;
- [ ] normalized importance features;
- [ ] junction scoring;
- [ ] branch mass;
- [ ] renderer-neutral importance hints.

Exit:

- no single-main-path assumption;
- explicit semantic priority beats centrality;
- metrics normalized/capped and diagnostic.

---

# 13. MP26 — Semantic layering and crossing ordering

- [ ] constrained ranks;
- [ ] source-first/sink-last;
- [ ] same-layer/before/after;
- [ ] deterministic long-edge handling;
- [ ] port-aware crossing reduction;
- [ ] stable forward/backward sweeps;
- [ ] auto LTR/TB orientation when unspecified;
- [ ] previous-order stability bias.

Exit:

- zero hard rank violations;
- crossings <= approved baseline or explicit Pareto evidence;
- permutation determinism;
- prior order wins quality ties.

---

# 14. MP27 — Compound graphs/subcircuits

- [ ] recursive child layout;
- [ ] group padding/header footprint;
- [ ] group ports;
- [ ] expanded/collapsed contract;
- [ ] cross-hierarchy edges;
- [ ] stable outer frames;
- [ ] local collapse/expand re-layout.

Exit:

- children remain contained;
- cross-hierarchy routes validate;
- unrelated scene movement bounded under collapse/expand;
- nested-depth stress deterministic.

---

# 15. MP28 — Swimlanes/partitions

- [ ] ordered lane model;
- [ ] lane headers;
- [ ] hard/soft membership;
- [ ] cross-lane costs;
- [ ] lane-aware ranks/coordinates;
- [ ] groups inside lanes;
- [ ] incremental lane stability.

Exit:

- hard membership/order preserved;
- cross-lane routing validates;
- local lane edits have bounded external movement.

---

# 16. MP29 — Label-aware sizing and typography

Labels are effective layout geometry.

- [ ] renderer-neutral text measurement contract;
- [ ] title/subtitle/body footprints;
- [ ] port label footprints;
- [ ] edge/group/lane label reservation;
- [ ] long/multiline/Unicode/CJK fixtures;
- [ ] RTL-ready geometry contract;
- [ ] content-change invalidation mapping.

Exit:

- no measured clipping in supported fixtures;
- conservative deterministic fallback without host metrics;
- Go Core remains DOM-independent.

---

# 17. MP30 — Adaptive port candidates

Canonical modes:

```text
FREE
FIXED_SIDE
FIXED_ORDER
FIXED_RATIO
FIXED_POSITION
```

- [ ] shape-aware candidate anchors;
- [ ] `allowedSides` hard feasibility;
- [ ] `preferredSide` preference;
- [ ] previous-side hysteresis input;
- [ ] route-cost estimate hook;
- [ ] derived anchor snapshot.

Exit:

- fixed-port invariance 100%;
- every adaptive anchor is on allowed geometry;
- min spacing always satisfied;
- deterministic candidates/ties.

---

# 18. MP31 — Port ordering, grouping and capacity

Port capacity:

```text
one
many
bounded(N)
```

- [ ] capacity contract;
- [ ] fixed/soft order;
- [ ] contiguous port groups;
- [ ] neighbor-order-aware inversion minimization;
- [ ] shared anchor/stub policy;
- [ ] bus/edge grouping metadata.

Exit:

- no capacity overflow;
- no hard-order violations;
- order inversions <= baseline;
- added side freedom cannot create a worse Tier-0 feasibility result.

---

# 19. MP32 — Canonical routing integration

- [ ] port planner resolves endpoint anchor/normal;
- [ ] routers consume resolved endpoints;
- [ ] endpoint escape remains shared/canonical;
- [ ] feedback corridors;
- [ ] self-loop primitive;
- [ ] parallel-edge lanes;
- [ ] permitted buses/shared trunks;
- [ ] port decisions returned in result/diagnostics.

Exit:

- every successful route validates;
- no router hides port-movement logic;
- no unchecked fallback;
- native/WASM equivalent.

---

# 20. MP33 — Perceptual composition

Pass order:

```text
semantic continuity/grouping/alignment
  -> whitespace
  -> balance/rhythm
  -> semantic symmetry
  -> rule-of-thirds/golden weak tie-breaks
```

- [ ] provisional composition frame;
- [ ] continuity/alignment guides;
- [ ] bounded whitespace halos;
- [ ] visual-mass balance;
- [ ] semantic rhythm/modular spacing;
- [ ] semantically conditional symmetry;
- [ ] thirds guides;
- [ ] golden-ratio focal guides;
- [ ] bounded refinement movement;
- [ ] `MaxCompositionExpansion`.

Exit:

- Tier 0 never worsens;
- default Tier-1 budget does not allow ordinary crossing regressions for artistic gain;
- guide strength 0 has no optimization effect;
- no golden-rectangle requirement;
- max expansion respected;
- idempotent after canonical rounding.

---

# 21. MP34 — Accessibility/visual semantic contract

- [ ] renderer-neutral role/emphasis hints;
- [ ] edge semantic classes;
- [ ] junction-vs-crossing metadata;
- [ ] non-color redundancy requirements;
- [ ] high-contrast/grayscale regression profiles;
- [ ] color-vision-deficiency review profiles.

Exit:

- connectivity/state never relies on hue alone;
- junction semantics remain clear in supported renderers;
- render-only accessibility changes trigger zero reroutes unless measured geometry changes.

---

# 22. MP35 — Mental-map and incremental stability

`LayoutSnapshot` preserves at least:

```text
node positions
ranks
sibling order
port sides/order/offsets
branch-side assignments
group/component frames
lane positions
narrative backbone
```

- [ ] importance-weighted movement cost;
- [ ] rank/order stability;
- [ ] branch-side stability;
- [ ] group/component stability;
- [ ] port-side hysteresis;
- [ ] local repair region;
- [ ] full-vs-incremental quality policy.

Exit:

- one-leaf edits cause bounded unrelated movement;
- tiny wire-length changes do not flap port sides;
- pinned elements invariant;
- collapse/expand local when feasible.

---

# 23. MP36 — Bounded joint refinement

Canonical search is staged/bounded, not an unbounded global optimum claim.

- [ ] deterministic local node moves;
- [ ] local port side/offset moves;
- [ ] affected-edge rerouting;
- [ ] affected-label replacement;
- [ ] lexicographic comparator;
- [ ] no-improvement stopping;
- [ ] deterministic work/iteration budget;
- [ ] cancellation;
- [ ] interactive/normal/quality/offline profiles.

Exit:

- never accepts Tier-0 regression;
- every accepted move has measurable vector delta;
- deterministic under equal budget;
- memory/work bounded.

---

# 24. MP37 — Readability/Stability/Composition vectors

Implement `HUMAN_READABILITY_METRICS.md`.

Required families:

```text
ReadabilityVector
  source/sink rank violations
  backward flow
  crossings absolute/normalized
  main-backbone bends/straightness
  branch/merge/junction clarity
  port constraints/order/preferences
  hierarchy/lane/feedback clarity
  label ambiguity

StabilityVector
  node movement
  rank/order changes
  group/lane movement
  branch-side change
  port side/order change
  route/label churn

CompositionVector
  balance
  negative space
  rhythm
  alignment
  semantic symmetry
  Gestalt grouping
  focal points
  thirds/golden score
  frame expansion
```

Exit:

- raw + normalized metrics where scale matters;
- deterministic metrics;
- no metric computation mutation;
- composite summary not used as sole release gate.

---

# 25. MP38 — Diagnostics and explainability

- [ ] constraint decisions;
- [ ] importance breakdown;
- [ ] branch-side decisions;
- [ ] rank/order reasons;
- [ ] port side/anchor reasons;
- [ ] composition guide influence;
- [ ] rejected-candidate tier reason;
- [ ] fallback reason/status;
- [ ] benchmark UI breakdown.

Exit: representative fixtures can answer “why is this node/port/branch here?” deterministically without exposing internal heap/search implementation.

---

# 26. MP39 — Verification and human evaluation

New corpus roots:

```text
testdata/layout_semantic/
testdata/layout_composition/
testdata/layout_incremental/
testdata/layout_accessibility/
```

Required families include:

- chain/fan/diamond/multi-merge;
- multi-source/multi-sink/co-primary;
- SCC/feedback/self-loop;
- parallel/bus;
- nested hierarchy/collapse-expand/cross-hierarchy;
- swimlanes/cross-lane;
- mixed fixed/adaptive/many ports/capacity;
- long/multiline/Unicode/CJK text;
- disconnected components;
- incremental edits;
- finite page/infinite canvas.

Metamorphic gates:

- deterministic rerun;
- permutation invariance;
- fixed-node/port invariance;
- adaptive allowed-side feasibility;
- translation invariance where applicable;
- unrelated-component locality;
- small-edit movement budget;
- disabled-guide neutrality;
- native/WASM equivalence.

Human evaluation separates comprehension from beauty preference.

Comprehension tasks:

- find source/sink;
- trace primary path;
- identify branch/merge;
- identify feedback/exception;
- identify lane/ownership;
- identify connectivity.

Measures:

- completion time;
- error rate;
- confidence;
- subjective comprehension;
- separate aesthetic preference.

Exit:

- Tier-0 corpus zero;
- no meaningful comprehension regression;
- new default shows measurable readability gain without unacceptable trade-offs;
- seeds/versions reproducible.

---

# 27. MP40 — Shadow rollout and default gate

Stages:

```text
S0 hidden benchmark
S1 developer opt-in
S2 experimental UI profile
S3 selected process/workflow templates
S4 default for eligible process/workflow scenes
S5 broaden default after release history
```

Fallback ladder:

```text
semantic_hierarchical_v1
  -> semantic fast
  -> canonical Sugiyama
  -> preserve-input-layout + canonical routing
```

Default gate requires:

1. Tier-0 release corpus zero;
2. deterministic/native/WASM green;
3. fixed/constrained port invariants green;
4. crossings/readability equal or Pareto-better than approved baseline;
5. incremental movement inside approved budgets;
6. bounded composition expansion;
7. no DOM/render-pixel dependency in Core;
8. diagnostics and metric vectors available;
9. performance inside approved budget;
10. opt-in/release-history review free of blocker regressions.

---

# 28. Atomic waves M–R

Historical Waves A–L correspond to completed foundation work. Active semantic-layout work continues:

## Wave M — contracts and semantics

M01 composition contract.  
M02 semantic-layout schemas.  
M03 layout snapshot.  
M04 quality-vector extensions.  
M05 baseline corpus.  
M06 connected components/source/sink.  
M07 hierarchy/lanes.  
M08 SCC/feedback.  
M09 importance.  
M10 narrative backbone.

## Wave N — constraints/hierarchical geometry

N01 typed constraints.  
N02 conflict resolver.  
N03 constrained rank assignment.  
N04 crossing ordering.  
N05 branch allocation.  
N06 merge placement.  
N07 component composition.  
N08 compound graphs.  
N09 collapse/expand stability.  
N10 swimlanes.

## Wave O — labels/adaptive ports/routing

O01 text measurement.  
O02 label-aware footprint.  
O03 port constraint modes.  
O04 side candidates.  
O05 capacity.  
O06 order/group solver.  
O07 hysteresis.  
O08 self-loop/parallel/bus ports.  
O09 endpoint integration.  
O10 routing integration.

## Wave P — perceptual composition

P01 frame.  
P02 continuity/alignment.  
P03 whitespace.  
P04 balance.  
P05 rhythm/modular spacing.  
P06 semantic symmetry.  
P07 thirds.  
P08 golden focal guides.  
P09 bounded move set.  
P10 max-expansion enforcement.

## Wave Q — stability/co-refinement/metrics

Q01 snapshot restoration.  
Q02 movement costs.  
Q03 branch/port hysteresis.  
Q04 local dirty-region refinement.  
Q05 lexicographic comparator.  
Q06 bounded work budgets.  
Q07 readability metrics.  
Q08 stability metrics.  
Q09 composition metrics.  
Q10 diagnostics.

## Wave R — verification/rollout

R01 semantic corpus.  
R02 metamorphic corpus.  
R03 native/WASM conformance.  
R04 accessibility profiles.  
R05 visual benchmark artifacts.  
R06 human A/B protocol.  
R07 benchmark dashboard.  
R08 developer opt-in.  
R09 workflow opt-in.  
R10 production default gate.

Each atomic behavioral commit updates tests and metric/benchmark evidence in the same change whenever practical.

---

# 29. CI/release acceptance policy

A PR touching semantic layout/composition must state:

- affected contract/version;
- constraint semantics impact;
- deterministic fixture impact;
- Readability/Stability/Composition vector delta;
- existing QualityVector delta;
- native/WASM conformance result;
- incremental stability delta when relevant;
- runtime/allocation delta when performance-sensitive;
- diagnostics impact for significant new decisions.

Required CI gates after each milestone becomes implemented:

| Gate | Policy |
|---|---|
| Go unit/race | required |
| frontend typecheck/tests/build | required |
| WASM build | required |
| semantic contract round-trip | required |
| deterministic corpus | required |
| metamorphic corpus | required |
| Tier-0 layout violations | zero |
| fixed-node/port invariance | required |
| allowed-side/capacity invariance | required |
| native/WASM layout conformance | required |
| readability regression | gated |
| stability regression | gated |
| composition expansion | gated |
| benchmark regression | statistically gated |

---

# 30. Performance and bounded-search policy

Do not make wall-clock-dependent nondeterminism canonical.

Preferred control:

```text
iteration/work-unit budgets
```

Profiles:

```text
interactive
normal
quality
offline
```

Wall-clock p95 targets are benchmark hypotheses and may evolve by ADR evidence. Canonical output must remain deterministic for the same deterministic work budget where practical.

No quality profile may bypass Tier-0 validation.

---

# 31. LBC/domain migration policy

Current domain scene builders that manually calculate matrix rows/columns or hard-code non-physical left/right port geometry should migrate to semantic intent gradually.

Migration order:

1. preserve current scene output as fixture;
2. classify which positions/ports are physical vs merely visual;
3. replace non-physical fixed ports with adaptive constraints;
4. replace row/column placement with semantic group/order/lane hints;
5. compare semantic layout with baseline vectors;
6. keep manual/fixed overrides for domain exceptions;
7. enable new default only after domain-specific regression review.

Domain builders must not reimplement semantic layout locally.

---

# 32. Anti-regression rules

Do not:

- weaken validity to improve aesthetic scores;
- trade a crossing for golden-ratio alignment in default profiles;
- force golden rectangles;
- use degree heuristics over explicit semantics;
- assume every graph has one main path;
- choose adaptive ports independently when ordering matters;
- let routers secretly move port anchors;
- overload capacity for geometry convenience;
- treat labels as post-render-only geometry;
- read DOM/SVG pixels from Core;
- flatten compound graphs to simplify solving;
- treat swimlanes as decorative backgrounds only;
- treat self-loops as ordinary source-target routing;
- infer bus grouping from similar geometry alone;
- force symmetry across semantically unequal branches;
- allow unbounded whitespace expansion;
- continuously move the composition frame while deriving golden guides from it;
- globally rearrange a scene for a small edit without objective evidence;
- rely on hue alone for semantics;
- use unseeded randomness or Go map iteration for visible decisions;
- hide quality regressions inside one composite score;
- publish unchecked fallback geometry.

See `rule/4.md` for the condensed invariant list.

---

# 33. Definition of Done — WS-K / semantic layout program

WS-K is complete only when all statements are true:

1. `semantic_hierarchical_v1` exists canonically in Go Core.
2. Native Go/WASM semantic layout is deterministic and conformant.
3. Semantic graph analysis covers source/sink/components/SCC/hierarchy/lanes.
4. Narrative backbone supports one or multiple co-primary structures.
5. Typed hard/strong/medium/weak layout constraints are public/versioned.
6. Hard conflicts fail explicitly with diagnostics.
7. Compound graphs/subcircuits are first-class.
8. Swimlanes/partitions are first-class.
9. Feedback/SCC/self-loop/parallel-edge geometry has explicit policy.
10. Labels/typography contribute to layout footprint.
11. Fixed ports never move.
12. Adaptive ports choose only permitted sides/anchors.
13. Port capacity/order/groups are validated.
14. Routers consume planner-resolved endpoints instead of moving ports independently.
15. Main narrative readability outranks compact rectangle packing.
16. Composition supports hierarchy/continuity/proximity/alignment/whitespace/balance/rhythm.
17. Symmetry is semantic/conditional.
18. Golden ratio and thirds are optional weak priors.
19. Composition cannot introduce Tier-0 regression.
20. Mental-map snapshots and hysteresis prevent avoidable layout flapping.
21. Joint refinement is bounded and deterministic.
22. Readability/Stability/Composition vectors are versioned and visible.
23. Raw + normalized metrics exist where scale matters.
24. One composite score is not release truth.
25. Decision diagnostics explain meaningful layout/port/composition choices.
26. Semantic/incremental/accessibility/composition corpora pass.
27. Human evaluation separates comprehension from beauty preference.
28. Existing layouts remain available as reference/fallback.
29. LBC/domain builders can migrate from matrix coordinates to semantic intent without losing physical/manual constraints.
30. Production default is switched only through MP40 gates.

---

# 34. Immediate execution queue

The next implementation commits after this documentation wave should be executed in this order unless a blocking defect requires an ADR:

1. MP21 schemas/version constants for `semantic_hierarchical_v1`.
2. `LayoutSnapshot`, `CompositionFrame`, `CompositionProfile` types.
3. Readability/Stability/Composition vector types.
4. semantic-layout baseline corpus exporter.
5. MP22 connected components/source/sink/hierarchy analyzer.
6. MP23 typed constraint contract and hard-conflict resolver.
7. MP24 SCC/feedback/self-loop/parallel classification.
8. MP25 narrative backbone/importance features.
9. MP26 constrained layering/crossing ordering.
10. MP27 compound layout.
11. MP28 swimlane support.
12. MP29 text-measurement/label-aware geometry contract.
13. MP30–31 adaptive port planner/order/capacity.
14. MP32 canonical router integration.
15. MP33 perceptual composition.
16. MP35 incremental mental-map stabilization.
17. MP36 bounded joint refinement.
18. MP37 metrics and MP38 diagnostics.
19. MP39 full verification/human protocol.
20. MP40 shadow rollout/default decision.

---

# 35. Final engineering rule

> **Preserve correctness, understand semantics, minimize crossings, make the narrative obvious, preserve the mental map, then refine composition; only after that optimize compactness.**

The intended end state is not a prettier rectangle packer. It is an AutoTrace engine that automatically constructs a clear visual explanation of a technical/process graph while preserving deterministic engineering constraints.
