# AutoTraceLab — MASTER IMPLEMENTATION PLAN

Status: **single authoritative orchestration plan**  
Historical foundation: **MP0–MP20 completed**.  
Active programs: **MP21–MP60 / WS-K + WS-L + WS-M**.  
Target: deterministic reusable AutoTrace Core in Go with semantic graph understanding, human-readability optimization, stable multidomain entity identity, semantic projection algebra, accessible visual semantics and a coherent 2D/2.5D LabTrace reasoning environment.

---

# 0. Authority and documentation topology

This document is authoritative for:

- program boundaries;
- milestone ordering/dependencies;
- rollout/default gates;
- cross-workstream invariants;
- global Definition of Done.

Detailed task lists are delegated to responsibility-specific normative documents. If wording conflicts, this master plan wins on ordering/boundaries/gates; the detailed contract wins inside its owned semantic responsibility unless that would violate a master invariant.

Normative documents:

```text
MATHEMATICAL_CONTRACT.md
  canonical mathematical semantics

ROUTING_CONTRACT.md
  route validity and routing semantics

VISUAL_COMPOSITION_CONTRACT.md
  semantic layout, perception, composition, mental-map invariants

ADAPTIVE_PORT_PLACEMENT.md
  movable-port semantics and constraints

HUMAN_READABILITY_METRICS.md
  readability/stability/composition metrics

SEMANTIC_LAYOUT_IMPLEMENTATION_PLAN.md
  detailed WS-K / MP21–MP40 execution

UI_VISUAL_AUDIT.md
  current-state HMI audit/baseline

VISUAL_SEMANTICS_HMI_CONTRACT.md
  visual semantics, linked views, lenses, comparison, playback, HMI

VISUAL_SEMANTICS_IMPLEMENTATION_PLAN.md
  detailed WS-L / MP41–MP50 execution

SEMANTIC_PROJECTION_SPACE_CONTRACT.md
  entity/facet/dimension identity, projection algebra, 2D/2.5D semantics

SEMANTIC_PROJECTION_SPACE_IMPLEMENTATION_PLAN.md
  detailed WS-M / MP51–MP60 execution

rule/4.md
  condensed semantic-layout implementation invariants
```

The architectural rule remains:

> **Canonical engineering mathematics and deterministic semantic decisions belong in reusable Core/SDK contracts, not in React screens.**

Go is the canonical production mathematical engine for layout/routing and for multidomain projection/coupling calculations that become authoritative engineering decisions. React/renderer owns concrete presentation and 2D/2.5D interaction, never authoritative identity or projection algebra.

---

# 1. Product end state

AutoTrace is one system with separated responsibilities:

```text
Host application
  |
  v
AutoTrace Contract / SDK
  |-- scene/model contracts
  |-- registry/domain vocabulary
  |-- entity/facet/dimension contracts
  |-- projection contracts
  |-- layout/routing contracts
  |-- capability/version negotiation
  v
Canonical Runtime
  |-- Model + Semantic Validation
  |-- Semantic Entity / Facet / Relation model
  |-- Semantic Graph Analyzer
  |-- Semantic Projection Engine
  |     |-- slicing/filtering
  |     |-- projection algebra
  |     |-- cross-domain coupling analytics
  |     `-- projection diagnostics
  |-- Layout Constraint Resolver
  |-- Semantic Hierarchical / Compound / Partition Layout
  |-- Adaptive Port Planner
  |-- Routing / Route Validation
  |-- Perceptual Composition
  |-- Readability / Stability / Composition Metrics
  |-- Incremental SceneEngine
  `-- Versioned Diagnostics + Provenance
        |
        v
ProjectionResult / Analysis Facts / Simulation Results
        |
        v
Visual Semantics Compiler
  |-- VisualAnnotationSet
  |-- LinkedViewState
  |-- ScenarioDeltaSet
  |-- InsightSet
  `-- PlaybackSemanticState
        |
        v
LabTrace HMI
  |-- TopologyView
  |-- ProjectionExplorer
  |-- TimelineView
  |-- ResourceLaneView
  |-- DistributionView
  |-- CompareView
  |-- Inspector / InsightRail
  `-- PlaybackControls
        |
        v
2D / 2.5D Renderer + Theme
```

One physical/logical entity may own multiple domain facets. A rendered facet copy is never a second authoritative entity.

---

# 2. Non-negotiable architectural boundaries

1. Core imports no React, DOM or browser UI package.
2. A block/edge/port/entity/facet type is data, not a React component or switch branch.
3. Visual style is not routing/layout geometry.
4. Renderer does not define authoritative semantic identity.
5. One entity may own multiple facets; facet duplication in views does not duplicate identity.
6. Identity merge/split is a canonical model operation, never a view action.
7. Projection decides membership/slice; lens decides emphasis. They remain separate contracts.
8. Projection/lens/camera changes MUST NOT silently mutate canonical model state.
9. Camera changes MUST NOT silently mutate canonical graph geometry.
10. Canonical projection algebra is deterministic and versioned.
11. Cross-domain causal semantics require explicit model/evidence; correlation/centrality does not become causality automatically.
12. High domain degree/coupling does not automatically mean high risk.
13. Semantic importance may produce renderer-neutral hints; renderer chooses concrete style.
14. Critical meaning MUST NOT rely on hue, animation or z-depth alone.
15. Every successful production route is validated.
16. Every externally visible deterministic decision has stable tie-breaking.
17. Native Go and WASM execute the same canonical mathematics where the feature is implemented canonically in Go.
18. Hard constraints are feasibility conditions, never weak scalar penalties.
19. Existing validated algorithms remain fallback/reference until replacements pass explicit gates.
20. No one composite score is release truth.
21. Art serves comprehension; decorative composition never outranks semantic readability.
22. Presentation state is versioned separately from canonical domain/process state.
23. Motion represents event/flow/state change; persistent decorative motion is not a semantic channel.
24. A migrated UI preserves canonical model/simulation output unless a separately approved domain change says otherwise.
25. Ambiguous multidomain identity is reported as ambiguous; migration must not guess silently.
26. Arbitrary free 3D camera is not the default analytical navigation model.
27. Every 2.5D analytical view has a usable Flat/non-depth equivalent.
28. Pointer movement/camera motion must not trigger global semantic recomputation.

---

# 3. Consolidated workstreams

The program has thirteen coordinated workstreams.

## WS-A — Mathematical contract and historical oracle [FOUNDATION COMPLETE]

Canonical math, deterministic serialization/numeric semantics, parity fixtures and invariant/property tests.

## WS-B — Canonical Go mathematical core [FOUNDATION COMPLETE]

Geometry, routing, labels, metrics, existing layouts and optimization primitives.

## WS-C — Incremental scene engine and performance [FOUNDATION COMPLETE]

Revisioned scenes, local invalidation, spatial/occupancy indexes, bounded search and allocation control.

## WS-D — Reusable headless boundary and SDK [FOUNDATION COMPLETE]

Native/WASM/headless/viewer/editor/batch embedding and capability negotiation.

## WS-E — Declarative registry and customization [FOUNDATION COMPLETE]

Portable domain vocabulary, shapes, themes, routing profiles and packages.

## WS-F — Customization/admin UX [FOUNDATION COMPLETE]

Non-developer customization without source-code changes.

## WS-G — Renderer and frontend execution [FOUNDATION COMPLETE]

AutoTraceLab consumes Core/SDK rather than owning production mathematics.

## WS-H — Benchmarking, verification and observability [ACTIVE EXTENSION]

Route, semantic-layout, composition, accessibility, HMI comprehension, projection algebra, multidomain identity and 2.5D regression families.

## WS-I — Security, CI and release engineering [ACTIVE EXTENSION]

Native/WASM/security/release gates extended with semantic-layout, HMI and projection invariants.

## WS-J — Documentation and adoption [ACTIVE EXTENSION]

Contracts, migration guides, example packs and domain adoption.

## WS-K — Semantic Layout & Perceptual Composition [ACTIVE]

Purpose: automatically construct a readable visual explanation of a graph.

```text
K1 semantic analysis
K2 typed constraints
K3 narrative backbone
K4 hierarchical layering/order
K5 branch/merge geometry
K6 compound graphs
K7 partitions/swimlanes
K8 SCC/feedback/self-loop/parallel geometry
K9 adaptive ports
K10 port order/capacity/grouping
K11 label-aware geometry
K12 routing integration
K13 perceptual composition
K14 accessibility visual semantics
K15 mental-map stabilization
K16 bounded joint refinement
K17 quality metrics
K18 diagnostics/explainability
K19 benchmark/human evaluation
K20 rollout/default switch
```

Detailed plan: `SEMANTIC_LAYOUT_IMPLEMENTATION_PLAN.md`.

## WS-L — Visual Semantics & HMI [ACTIVE PLANNED]

Purpose: turn analytical state into coordinated, accessible visual reasoning.

```text
L1 current UI/task baseline
L2 LabTrace shell
L3 shared visual primitives
L4 VisualSemanticFact/Annotation
L5 encoding grammar
L6 focus/lens system
L7 Canvas overlays
L8 linked topology/timeline/resource/projection state
L9 uncertainty/distribution
L10 comparison/diff
L11 Insight Rail/provenance
L12 Digital Twin playback
L13 Engineering HUD disclosure
L14 accessibility/CVD/grayscale/non-depth semantics
L15 responsive/mobile
L16 visualization performance
L17 process-screen migration
L18 human task/visual regression
L19 rollout/default switch
```

Detailed plan: `VISUAL_SEMANTICS_IMPLEMENTATION_PLAN.md`.

## WS-M — Multidomain Semantic Projection Space [ACTIVE PLANNED]

Purpose: model one system once and expose disciplined multidimensional 2D/2.5D projections without duplicating entity identity.

```text
M1 authoritative SemanticEntity identity
M2 EntityFacet model
M3 generic SemanticDimension model
M4 typed intra/cross-domain relations
M5 ProjectionSpec/ProjectionResult
M6 slice/projection algebra
M7 coupling/bridge analytics
M8 projection diagnostics/provenance
M9 projection-stable layout
M10 identity columns / facet stacks
M11 constrained 2.5D camera/viewpoints
M12 projection/lens orthogonality
M13 multidomain/lifecycle/scenario diff
M14 cross-domain Digital Twin propagation
M15 accessibility Flat fallback
M16 projection indexes/caching/performance
M17 domain migration
M18 human task evaluation
M19 rollout/default switch
```

Detailed plan: `SEMANTIC_PROJECTION_SPACE_IMPLEMENTATION_PLAN.md`.

---

# 4. Global quality priorities

## 4.1 Layout quality order

```text
Tier 0 hard validity
  > Tier 1 topological readability
  > Tier 2 cognitive simplicity
  > Tier 3 mental-map stability
  > Tier 4 perceptual composition
  > Tier 5 economy/performance
```

Default:

```text
readability > stability > composition > compactness
```

## 4.2 HMI quality order

```text
truth/correctness
  > task comprehension
  > accessibility
  > cross-view consistency
  > mental-context preservation
  > information density
  > aesthetic preference
```

## 4.3 Projection quality order

```text
identity correctness
  > projection/set correctness
  > causal/type correctness
  > selected-entity continuity
  > flat/2.5D semantic equivalence
  > cross-projection mental-map stability
  > visual depth/composition
  > visual novelty
```

A more visually impressive 2.5D result never justifies identity ambiguity, wrong membership or inaccessible critical meaning.

---

# 5. Perceptual and 2.5D principles

High priority: hierarchy, continuity, proximity, common region, alignment, negative space, visual movement and figure-ground separation.

Conditional: balance, rhythm, scale, unity, semantically justified symmetry.

Weak/profile-dependent: thirds/golden-ratio/Fibonacci guides.

2.5D adds:

```text
semantic planes, not arbitrary depth
identity columns, not fake flow edges
one canonical depth dimension at a time
Flat / Shallow / Layered / CrossDomain viewpoints
one-action return to Flat
no critical state encoded only by perspective
```

Free 3D camera, if ever added, remains exploratory/secondary.

---

# 6. Historical foundation MP0–MP20

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
| MP10 | co-optimization/bridge geometry | COMPLETED |
| MP11 | incremental mathematics | COMPLETED |
| MP12 | Worker/SDK shadow integration | COMPLETED |
| MP13 | declarative registry | COMPLETED |
| MP14 | invalidation/customization slices | COMPLETED |
| MP15 | Go routing/performance optimization | COMPLETED |
| MP16 | customization/admin workspace | COMPLETED |
| MP17 | embedding SDK/host adapters | COMPLETED |
| MP18 | Go production cutover | COMPLETED |
| MP19 | CI/security/release hardening | COMPLETED |
| MP20 | documentation/cleanup/final Go architecture | COMPLETED |

Existing layouts remain reference/fallback. Active programs evolve quality/contracts rather than rewrite history.

---

# 7. Active dependency graph MP21–MP60

The milestone numbers group programs; they do **not** require a naïve global MP21→MP60 serial execution.

## 7.1 WS-K

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
  -> MP40 Semantic-layout rollout/default gate
```

## 7.2 WS-L

```text
MP21 schema discipline
  -> MP41 HMI baseline/contracts
     -> MP42 LabTrace shell
     -> MP43 Visual Semantics compiler
        -> MP44 lenses/overlays
        -> MP46 uncertainty/compare
        -> MP47 Insight Rail
        -> MP48 playback
     -> MP49 migration/hardening
     -> MP50 HMI default gate
```

## 7.3 WS-M

```text
MP21 schema discipline
  -> MP51 projection contract/baseline
  -> MP52 Entity/Facet/Dimension model
  -> MP53 relation/identity/coupling semantics
  -> MP54 projection algebra/query engine
  -> MP55 coupling analytics
  -> MP56 projection-stable layout
  -> MP57 2D/2.5D renderer/viewpoints
  -> MP58 slice explorer + multidomain diff
  -> MP59 cross-domain Twin + hardening
  -> MP60 multidomain rollout/default gate
```

## 7.4 Critical cross-program dependencies

```text
MP52 stable identity --------------------> MP45 final linked-view ID contract
MP35 mental-map stability --------------> MP56 projection stability
MP43 visual semantics ------------------> MP57/58 renderer semantics
MP45 LinkedViewState -------------------> MP58 projection interaction
MP46 CompareView -----------------------> MP58 lifecycle/scenario diff
MP48 playback --------------------------> MP59 cross-domain playback
MP53 causal relation semantics ---------> MP59 causal propagation
MP54 projection algebra ---------------> MP58 slice/diff
MP55 coupling facts --------------------> MP44 coupling lens + MP47 insights
```

Strong rule:

> **Do not freeze MP45 on temporary screen-local IDs if MP52 can provide stable SemanticEntity/EntityFacet identity.**

If MP45 prototypes earlier, use an isolated compatibility adapter and remove it before MP49 completion.

---

# 8. WS-K milestone summary MP21–MP40

Detailed acceptance: `SEMANTIC_LAYOUT_IMPLEMENTATION_PLAN.md`.

| MP | Result | Blocking intent |
|---|---|---|
| 21 | contracts/version/baseline | foundation |
| 22 | semantic graph analyzer | semantic facts |
| 23 | typed hard/soft constraints | feasibility |
| 24 | components/SCC/feedback/self/parallel | topology classes |
| 25 | narrative backbone/importance | visual narrative |
| 26 | semantic layering/order | topology readability |
| 27 | compound/subcircuit layout | hierarchy |
| 28 | swimlanes/partitions | responsibility/location grouping |
| 29 | label-aware geometry | text correctness |
| 30 | adaptive port candidates | endpoint freedom |
| 31 | port order/group/capacity | port validity/readability |
| 32 | canonical routing integration | validated routes |
| 33 | perceptual composition | bounded visual refinement |
| 34 | accessibility semantics | non-color readability |
| 35 | mental-map stability | incremental continuity |
| 36 | bounded joint refinement | coupled local optimization |
| 37 | quality vectors | measurable readability/stability/composition |
| 38 | diagnostics/explainability | decision reasons |
| 39 | verification/human evaluation | evidence |
| 40 | rollout/default gate | production switch |

MP40 requires zero Tier-0 release violations, deterministic native/WASM conformance, constrained-port invariants, acceptable readability/stability/performance and release-history review.

---

# 9. WS-L milestone summary MP41–MP50

Detailed acceptance: `VISUAL_SEMANTICS_IMPLEMENTATION_PLAN.md`.

| MP | Result | Key dependency |
|---|---|---|
| 41 | HMI contract/task baseline | MP21 |
| 42 | unified LabTrace shell | MP41 |
| 43 | Visual Semantics compiler | MP41 + canonical facts |
| 44 | Canvas lenses/overlays | MP42/43; MP55 enriches coupling lens |
| 45 | linked views/state | MP42/43; MP52 before final ID freeze |
| 46 | uncertainty/distribution/compare | MP42/43 |
| 47 | Insight Rail/provenance | MP43; MP55 enrichment |
| 48 | Digital Twin playback | MP45/event history |
| 49 | migration/accessibility/perf/regression | MP42–48 |
| 50 | HMI rollout/default gate | MP49 |

MP50 can roll out the new shared HMI without enabling 2.5D by default. Multidomain projection default remains MP60-controlled.

---

# 10. WS-M milestone summary MP51–MP60

Detailed acceptance: `SEMANTIC_PROJECTION_SPACE_IMPLEMENTATION_PLAN.md`.

## MP51 — Projection contract and multidomain baseline [BLOCKING]

Freeze fixtures, identity migration rules, projection task baseline and ADR for constrained 2.5D vs arbitrary 3D.

## MP52 — Canonical Entity/Facet/Dimension model [BLOCKING]

Version `SemanticEntity`, `EntityFacet`, `SemanticDimension`, dimension bindings, external identity/provenance and scenario/lifecycle attachment without identity duplication.

Core invariants:

```text
facet -> exactly one entity
entity ID stable across projections
projection copy != canonical entity
unknown != default
view action != identity edit
```

## MP53 — Relation taxonomy + identity/coupling semantics [BLOCKING]

Canonical classes include intra-domain, cross-domain coupling, cross-domain causal, traceability, dependency and derived identity-visualization.

Identity link is not flow. Cross-domain causal link requires explicit evidence/model semantics.

## MP54 — Projection algebra/query engine [BLOCKING]

Implement deterministic `ProjectionSpec -> ProjectionResult` with Flat/Overlay/Stack/Exploded/CrossDomain membership, facet policies, context policies and set algebra:

```text
A ∪ B
A ∩ B
A − B
A △ B
```

Metamorphic set identities are release tests.

## MP55 — Cross-domain coupling analytics

Version domain degree, cross-domain relation degree, interface density and optional typed centrality. Failure-propagation metrics require causal/FMEA semantics. Provide renderer-neutral VisualSemanticFact/Insight adapters.

## MP56 — Projection-stable layout [BLOCKING FOR 2.5D DEFAULT]

Extend mental-map snapshots with entity base-plane anchors, facet depth offsets, identity-column reservation, deterministic plane order and bounded projection-change movement.

Slice changes do not globally re-layout by default.

## MP57 — Canonical 2D/2.5D renderer

Required viewpoints:

```text
Flat
Shallow
Layered
CrossDomain
```

Implement semantic planes, identity columns, depth-aware hit testing, readable labels, keyboard/touch controls and Flat fallback. Free camera is not a v1 requirement.

## MP58 — Slice explorer + multidomain/lifecycle/scenario diff

Projection controls, saved projections, dimension/depth selection, facet collapse/expand, ghost context and workflows such as:

```text
Electrical ∩ Hydraulic
Design △ AsBuilt
Nominal △ FailureCase
Baseline △ Candidate
```

Integrate with LinkedViewState, CompareView and lenses while preserving orthogonality.

## MP59 — Cross-domain Digital Twin + hardening

Preserve entity/facet/event identity across time and slices. Show explicit cross-domain causal event chains and latency where known. Add Flat accessibility fallback, projection performance/caching, deterministic/metamorphic and human-task gates.

## MP60 — Multidomain migration/rollout/default gate

Migrate only identities proven by evidence. Ambiguous duplicates remain separate/flagged until resolved.

Default requires:

1. identity invariants green;
2. deterministic/metamorphic projection algebra green;
3. projection state cannot mutate canonical model;
4. projection-stable movement inside budget;
5. canonical viewpoints reproducible;
6. Flat/non-depth equivalence for critical meaning;
7. coupling analytics explainable/versioned;
8. diffs handle identity merge/split explicitly;
9. cross-domain Twin identity/event synchronization green;
10. accessibility/CVD/grayscale/reduced-motion green;
11. performance/caching green;
12. migrated fixtures preserve engineering facts;
13. human-task benefit demonstrated;
14. release history free of blocker identity/navigation defects.

---

# 11. Atomic waves M–Z

Historical Waves A–L cover the completed foundation.

## WS-K

```text
Wave M contracts/semantics
Wave N constraints/hierarchical geometry
Wave O labels/adaptive ports/routing
Wave P perceptual composition
Wave Q stability/co-refinement/metrics
Wave R verification/rollout
```

See `SEMANTIC_LAYOUT_IMPLEMENTATION_PLAN.md` for atomics.

## WS-L

```text
Wave S HMI contracts/shell
Wave T semantic Canvas/linked analytics
Wave U uncertainty/compare/explain/playback
Wave V migration/rollout
```

See `VISUAL_SEMANTICS_IMPLEMENTATION_PLAN.md`.

## WS-M

```text
Wave W semantics/projection core
  W01 contract/ADR
  W02 SemanticEntity
  W03 EntityFacet
  W04 SemanticDimension
  W05 bindings
  W06 relation taxonomy
  W07 identity-visualization
  W08 ProjectionSpec
  W09 ProjectionResult
  W10 diagnostics

Wave X algebra/coupling
  X01 union/intersection
  X02 difference/symmetric difference
  X03 entity/facet/relation algebra levels
  X04 indexes/cache
  X05 local invalidation
  X06 domain degree
  X07 cross-domain degree
  X08 interface density
  X09 typed centrality
  X10 failure-propagation hook/provenance

Wave Y stable geometry/2.5D HMI
  Y01 projection anchors
  Y02 plane ordering
  Y03 identity columns
  Y04 facet expand/collapse stability
  Y05 Flat/Shallow
  Y06 Layered/CrossDomain
  Y07 hit testing/selection identity
  Y08 projection controls
  Y09 saved projections
  Y10 multidomain diff

Wave Z Twin/hardening/rollout
  Z01 playback facet state
  Z02 cross-domain causal path
  Z03 freeze time + slice switching
  Z04 Flat accessibility
  Z05 keyboard/screen-reader projection navigation
  Z06 performance
  Z07 metamorphic/semantic regression
  Z08 human evaluation
  Z09 domain migration pack
  Z10 default gate
```

Atomic behavioral changes update tests/benchmark evidence in the same change whenever practical.

---

# 12. CI/release acceptance policy

A PR touching WS-K states affected contract, constraint semantics, deterministic fixtures, quality-vector delta, native/WASM conformance, stability/performance and diagnostics impact.

A PR touching WS-L states visual-semantic contract, entity/facet ID impact, projection state impact, canonical math impact, accessibility/non-color/non-depth impact, responsive/visual regression/performance and provenance/human-task impact.

A PR touching WS-M states entity/facet/dimension impact, identity migration, relation taxonomy, projection algebra, canonical math, projection stability, flat/2.5D equivalence, cache/performance, Twin event identity and human-task impact.

Required gate families as milestones become implemented:

| Gate | Policy |
|---|---|
| Go unit/race | required |
| frontend typecheck/tests/build | required |
| WASM build | required |
| semantic contract round-trip | required |
| deterministic corpus | required |
| metamorphic corpus | required |
| Tier-0 layout violations | zero |
| native/WASM canonical math conformance | required where applicable |
| fixed/allowed-side/capacity invariants | required |
| readability/stability/composition regressions | gated |
| visual-semantic fixtures | required for WS-L |
| linked-view entity/facet consistency | required after MP45 |
| screenshot/semantic visual regression | required for affected HMI |
| grayscale/CVD/non-color semantics | required |
| Flat/non-depth critical equivalence | required for 2.5D |
| keyboard/reduced-motion/responsive | required |
| canonical process-result parity during UI migration | required |
| entity/facet reference validity | zero invalid after MP52 |
| deterministic projection | required after MP54 |
| projection algebra set identities | required after MP54 |
| projection does not mutate canonical model | required |
| lens/projection orthogonality | required after MP54 integration |
| projection mental-map stability | gated after MP56 |
| canonical viewpoint screenshot regression | required after MP57 |
| projection/cache/camera performance | gated after MP57 |
| Digital Twin entity/event identity | required after MP59 |

---

# 13. Performance and bounded-work policy

Canonical output must not depend on wall-clock race timing where deterministic work budgets can be used.

Profiles remain:

```text
interactive
normal
quality
offline
```

New multidomain requirements:

- dimension inverted indexes;
- entity/facet/relation indexes;
- ProjectionResult caching by model/projection revision;
- local invalidation;
- culling/aggregation of dense cross-domain relations;
- bounded active semantic planes;
- no semantic recomputation on ordinary camera motion;
- bounded identity-column rendering;
- long-history playback + slice-switch benchmark;
- memory retention/leak tests for saved projections/scenario switching.

No profile bypasses Tier-0 or identity/projection validity.

---

# 14. Domain migration policy

## 14.1 Layout migration

Existing domain builders migrate manual matrix/left-right visual assumptions to semantic intent gradually while preserving physical/manual constraints and baseline fixtures.

## 14.2 HMI migration

Domain workbenches migrate through LabTrace shell/primitives rather than forking theme/status/selection semantics.

## 14.3 Multidomain identity migration

For every candidate duplicated entity across domain models:

```text
1. collect stable IDs / evidence
2. determine same-entity vs related-but-distinct
3. map proven same identity to one SemanticEntity + multiple facets
4. preserve facet-specific ports/properties/relations
5. retain unresolved ambiguity explicitly
6. validate domain-local legacy view
7. validate Flat multidomain view
8. validate projection algebra
9. validate FMEA/Twin/provenance references
10. only then enable stack/2.5D presentation
```

Never merge entities solely because names or geometry are similar.

---

# 15. Anti-regression rules

Do not:

- weaken validity for aesthetics;
- trade crossings for decorative ratios in default profiles;
- use degree heuristics over explicit semantics;
- assume one main path;
- let routers secretly move planned endpoints;
- treat labels as post-render-only geometry;
- read DOM/SVG pixels from canonical Core;
- flatten compound semantics to simplify implementation;
- rely on hue alone;
- hide regressions in one composite score;
- use decoration/motion as substitute for hierarchy;
- give every KPI equal visual weight when hierarchy is known;
- hide material uncertainty behind one percentile;
- call correlation/centrality/heuristic contribution causal;
- let a lens change canonical geometry or projection membership;
- let a camera change canonical geometry/model state;
- put engineering debug telemetry in primary user hierarchy by default;
- create process screens with independent shell/theme/status semantics;
- persist VisualAnnotations as authoritative truth;
- duplicate a physical/logical entity per domain without an identity model;
- infer same identity from proximity/name alone;
- use identity columns as physical flow edges;
- hard-code Domain as the only semantic dimension;
- persist 2.5D facet copies as canonical entities;
- globally re-layout on every slice change without necessity;
- encode critical meaning only in depth/perspective/transparency;
- make arbitrary 3D rotation the default;
- compute causality from timing/correlation alone;
- call high domain degree a risk score;
- let projection filters delete canonical data;
- treat entity-level XOR as proof every property differs;
- recompute projection semantics on pointer/camera motion;
- silently merge ambiguous legacy domain nodes;
- allow UI/projection migration to change canonical simulation results accidentally.

---

# 16. Definition of Done — WS-K

WS-K is complete when canonical semantic layout exists in Go; constraints, hierarchy, lanes, feedback/self/parallel geometry, labels, adaptive ports, routing, perceptual composition, mental-map stability, bounded refinement, quality vectors, diagnostics, verification and MP40 rollout gates all pass.

See detailed 30-point acceptance in `SEMANTIC_LAYOUT_IMPLEMENTATION_PLAN.md` / `VISUAL_COMPOSITION_CONTRACT.md`.

---

# 17. Definition of Done — WS-L

WS-L is complete when:

1. LabTrace is canonical shell;
2. shared visual primitives replace shell-level duplication;
3. annotations are renderer-neutral/evidence-linked;
4. lenses preserve geometry and projection membership;
5. linked views operate on stable entity IDs;
6. facet selection works where needed;
7. distributions/thresholds expose stochastic meaning;
8. comparison is objective-aware and projection-diff-ready;
9. Insight Rail preserves provenance/causal discipline;
10. playback is synchronized and reduced-motion equivalent;
11. Engineering HUD is secondary;
12. active screens share one visual language;
13. accessibility/CVD/grayscale/mobile gates pass;
14. Flat fallback exists for any 2.5D integrations;
15. performance/visual regression gates pass;
16. human tasks show no material regression and target gains;
17. migration preserves canonical outputs;
18. MP50 passes before legacy shell cleanup.

---

# 18. Definition of Done — WS-M

WS-M is complete when:

1. one authoritative entity can own multiple domain facets;
2. entity/facet/dimension contracts are versioned/validated;
3. dimensions are generic rather than Domain-only;
4. relation classes distinguish identity/coupling/causal semantics;
5. projection algebra is deterministic/metamorphically tested;
6. projection/view actions cannot mutate canonical model;
7. coupling analytics are explainable/versioned;
8. projection changes preserve mental map inside budgets;
9. identity columns preserve one-entity selection;
10. Flat/Overlay/Stack/Exploded/CrossDomain semantics are defined;
11. canonical viewpoints avoid arbitrary 3D default;
12. critical meaning has non-depth equivalent;
13. multidomain/lifecycle/scenario diff works;
14. identity merge/split is specially reported;
15. Digital Twin preserves entity/facet/event identity across slices;
16. accessibility/reduced-motion gates pass;
17. large projection performance passes;
18. migration never guesses ambiguous identity silently;
19. human-task evaluation demonstrates benefit;
20. MP60 passes before broad default rollout.

---

# 19. Immediate integrated execution queue

Avoid treating MP numbers as one serial queue. Execute highest-leverage dependency cuts:

## Foundation cut

1. MP21 schema/version discipline and semantic-layout contract baseline.
2. MP41 HMI baseline/contracts **in parallel with** MP51 projection baseline/ADR.
3. MP52 `SemanticEntity` / `EntityFacet` / `SemanticDimension` contract early, before final MP45 ID freeze.
4. Continue MP22–MP25 semantic graph/importance while MP42 LabTrace shell proceeds.
5. MP53 typed multidomain relation taxonomy and provenance.

## First coherent vertical slice

6. MP43 VisualAnnotation compiler using stable entity ID + optional facet ID.
7. MP54 deterministic Flat Projection Engine + set algebra/metamorphic tests.
8. MP44 critical/bottleneck/risk lenses; projection membership remains untouched.
9. MP45 linked topology/timeline/resource views bound to SemanticEntity IDs.
10. MP55 coupling facts feed `CrossDomainCoupling` lens + Insight Rail.
11. MP46 CompareView accepts both scenario deltas and projection-algebra diff adapters.

## Stable multidomain geometry

12. Progress WS-K through MP26–MP35, especially mental-map stability.
13. MP56 projection anchors / identity-column reservation on top of MP35.
14. MP57 Flat + Stack first; then Shallow/Layered/CrossDomain presets.
15. MP58 ProjectionExplorer + Electrical∩Hydraulic / Design△AsBuilt workflows.

## Temporal and rollout cut

16. MP47 provenance/Insight Rail.
17. MP48 Digital Twin playback with stable entity/facet/event IDs.
18. MP59 cross-domain causal playback + accessibility/performance/metamorphic hardening.
19. MP49 HMI migration/hardening can complete independently of 2.5D default.
20. MP39/40 semantic-layout verification/rollout as WS-K reaches gates.
21. MP50 shared HMI default when its own gates pass.
22. MP60 multidomain/2.5D default only after identity/projection/task gates pass.

This order minimizes rework by establishing stable identity before linked-view and multidomain interaction contracts harden.

---

# 20. Final engineering rule

> **Preserve correctness; preserve identity; understand semantics; choose the projection; minimize ambiguity and crossings; preserve the mental map; encode operational meaning; coordinate time, domain and scenario views; explain evidence and uncertainty; only then refine composition and visual depth.**

The intended end state is not a prettier graph and not a freely rotating 3D node cloud. It is one canonical engineering model that can be explored as several disciplined, stable and evidence-linked views of the same system.
