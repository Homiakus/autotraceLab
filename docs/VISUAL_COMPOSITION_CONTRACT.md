# AutoTrace Visual Composition & Human Readability Contract

Status: **normative for semantic/composition layout work**  
Scope: AutoTrace Core, layout, adaptive ports, labels, composition refinement, metrics, renderer hints and incremental stability.  
Authority: subordinate to `MASTER_IMPLEMENTATION_PLAN.md`; this document defines the detailed mathematical and perceptual contract for WS-K / MP21–MP40.

---

# 1. Purpose

AutoTrace must optimize diagrams for human comprehension, not merely pack rectangles into a compact bounding box.

The canonical semantic-layout pipeline MUST treat a diagram as a visual explanation of a graph:

```text
scene
  -> semantic graph analysis
  -> constraint resolution
  -> narrative backbone
  -> hierarchical / compound / partitioned placement
  -> label-aware node geometry
  -> adaptive port planning
  -> canonical routing
  -> perceptual composition refinement
  -> bounded local co-refinement
  -> validation + readability/composition metrics
  -> decision diagnostics
```

The primary invariant is:

> **Art serves comprehension.**
>
> Proportion, symmetry, rhythm, negative space, golden-ratio guides and rule-of-thirds guides may improve a layout only after semantic correctness and readability constraints are satisfied.

---

# 2. Architectural boundaries

The following layers are distinct and MUST remain distinct.

## 2.1 Semantics

Semantics answer what the graph means:

- source / sink;
- primary / secondary flow;
- process phase;
- hierarchy / subcircuit;
- lane / responsibility;
- feedback / exception flow;
- semantic importance;
- edge type and direction;
- physical vs logical port constraints.

## 2.2 Layout / composition

Layout answers where geometry is placed:

- node rank and order;
- group frames;
- lane positions;
- node coordinates;
- port side and anchor when movable;
- routing channels;
- label-reservation footprints;
- visual whitespace;
- focal-point alignment;
- composition frame.

## 2.3 Rendering / style

Rendering answers how the already-resolved semantic geometry is drawn:

- color;
- font face;
- stroke;
- shadow;
- opacity;
- icons;
- marker appearance;
- line dash patterns.

Core MAY return renderer-neutral semantic emphasis hints. Core MUST NOT depend on React, DOM, SVG pixels or browser font rendering.

---

# 3. Global decision order

No single weighted score may decide layout acceptance.

Layout variants MUST be compared by ordered quality tiers.

## Tier 0 — hard validity

A result with any unapproved Tier-0 violation cannot beat a Tier-0-valid result.

Tier-0 violations include at minimum:

- NaN / Inf coordinates;
- missing source/target endpoint;
- illegal node overlap where overlap is forbidden;
- wire through forbidden node interior;
- invalid group containment;
- invalid lane containment when lane membership is hard;
- fixed-node movement;
- fixed-port movement;
- `allowedSides` violation;
- port-capacity violation;
- minimum port-spacing violation;
- invalid fixed order where order is hard;
- invalid routing endpoint normal;
- invalid route geometry;
- forbidden shared collinear segment;
- unchecked routing fallback;
- invalid label constraint classified as hard by the active profile.

## Tier 1 — topological readability

Compare only after Tier 0 ties:

1. edge crossings;
2. ambiguous shared paths;
3. ambiguous junction-vs-crossing geometry;
4. backward-flow edges relative to the chosen narrative direction;
5. main-backbone discontinuity;
6. port-order inversions;
7. unresolved label ambiguity/collisions.

## Tier 2 — cognitive simplicity

Then compare:

- main-backbone bend count;
- branch coherence;
- merge clarity;
- junction clarity;
- edge continuity;
- avoidable detours;
- parallel-flow coherence;
- branch first-segment separation;
- feedback-loop clarity.

## Tier 3 — mental-map stability

Then compare:

- weighted node movement;
- layer/rank changes;
- sibling-order changes;
- port-side changes;
- port-order changes;
- branch-side changes;
- group-frame movement;
- lane movement.

## Tier 4 — perceptual composition

Then compare:

- visual hierarchy;
- Gestalt proximity;
- common-region coherence;
- alignment;
- negative-space quality;
- visual balance;
- rhythm;
- semantically justified symmetry;
- focal-point composition;
- rule-of-thirds deviation;
- golden-ratio guide deviation.

## Tier 5 — economy

Finally compare:

- total wire length;
- normalized excess wire length;
- area;
- aspect-frame fit;
- runtime;
- allocations.

A lower-tier improvement MUST NOT silently buy a higher-tier regression unless an explicit versioned profile policy permits a bounded regression and the result remains within release gates.

---

# 4. Constraint strength model

Constraints MUST have explicit strength.

```text
HARD
STRONG
MEDIUM
WEAK
```

Typical mapping:

| Constraint | Default strength |
|---|---|
| fixed node position | HARD |
| fixed port position | HARD |
| allowed port side | HARD |
| port capacity | HARD |
| group containment | HARD |
| explicit lane membership | HARD |
| source-first / sink-last when explicitly requested | HARD |
| preferred port side | STRONG |
| explicit manual sibling order | STRONG or HARD by API option |
| preserve previous rank | MEDIUM |
| preserve previous port side | MEDIUM + hysteresis |
| visual balance | WEAK–MEDIUM |
| symmetry | WEAK–MEDIUM, only if semantically justified |
| rule of thirds | WEAK |
| golden ratio | WEAK |

Hard constraints are feasibility conditions, not scalar penalties.

---

# 5. Semantic graph analysis

The canonical analyzer MUST derive or consume:

- connected components;
- strongly connected components (SCCs);
- sources and sinks;
- semantic categories;
- hierarchy depth;
- lane/partition membership;
- in/out degree;
- articulation importance;
- approximate or exact betweenness where budget permits;
- fan-in / fan-out;
- edge direction and semantic flow class;
- candidate narrative backbone;
- branch mass;
- feedback edges;
- self-loops;
- parallel-edge groups;
- edge grouping / bus eligibility.

Explicit semantic metadata outranks topology inference. Degree-based inference is fallback only.

---

# 6. Narrative backbone

The visual narrative is not required to be exactly one path.

The analyzer MUST support a `NarrativeBackbone` that may be:

- one primary path;
- multiple co-primary paths;
- a primary tree;
- a critical subgraph;
- an explicitly user-selected backbone.

A canonical backbone result should distinguish at least:

```text
PrimaryEdges
SecondaryEdges
FeedbackEdges
ExceptionEdges
```

When process-duration data exists, critical-path membership MAY contribute to semantic importance. Critical-path semantics MUST NOT be inferred from geometry alone.

---

# 7. Importance and junction scoring

Node importance is a normalized composite feature, never an unbounded raw sum.

Inputs MAY include:

- semantic priority;
- backbone membership;
- normalized `log1p(fanIn)`;
- normalized `log1p(fanOut)`;
- normalized betweenness;
- articulation status;
- hierarchy-boundary importance;
- lane-boundary importance.

Individual topology metrics MUST be normalized, capped where appropriate and kept inspectable in diagnostics.

Importance may influence:

- whitespace halo;
- position stability weight;
- focal-point attraction;
- renderer-neutral emphasis hints;
- branch allocation.

Importance MUST NOT override Tier-0 constraints.

---

# 8. Layering and ordering

The semantic hierarchical layout MUST support:

- left-to-right;
- top-to-bottom;
- explicit direction;
- auto-orientation by bounded comparison when direction is not fixed;
- source-first constraints;
- sink-last constraints;
- same-layer constraints;
- before/after constraints;
- deterministic tie breaking;
- long-edge handling;
- crossing-reduction sweeps;
- stable incremental ordering.

Sources and sinks MUST use explicit semantic categories when present. Raw in-degree/out-degree inference is fallback only.

---

# 9. Branch and merge geometry

## 9.1 Branches

The main narrative flow should remain visually continuous whenever possible.

Secondary branches should be assigned to sides using branch mass, conflict cost and previous-layout stability.

Conceptual branch mass may include:

```text
node count
+ edge count factor
+ nested group area
+ label footprint
+ semantic importance factor
```

## 9.2 Merges

Merge nodes SHOULD be placed near a weighted median of incoming branch centers when compatible with layer and hard constraints.

This is a soft geometric principle intended to reduce bends, crossings and visual imbalance.

## 9.3 Symmetry

Symmetry is encouraged only when branches are semantically equivalent or intentionally paired.

A critical path and an exception path MUST NOT be made visually equivalent solely for geometric symmetry.

---

# 10. Compound graphs and subcircuits

Compound layout is first-class.

Required cases:

- nested groups;
- expanded groups;
- collapsed groups;
- cross-hierarchy edges;
- group labels;
- group ports;
- recursive layout;
- group padding;
- stable outer geometry under internal edits when feasible.

Collapse/expand MUST use incremental mental-map preservation. Expanding one group should not cause global re-layout unless constraints make local accommodation impossible.

---

# 11. Partitions and swimlanes

The layout model MUST support ordered partitions / swimlanes.

Required concepts:

- lane ID;
- lane order;
- lane orientation;
- lane header footprint;
- hard/soft lane membership;
- cross-lane routing cost;
- lane spacing;
- group-within-lane handling;
- lane-preserving incremental layout.

Lane geometry is semantic layout structure, not merely renderer decoration.

---

# 12. SCC and feedback-loop policy

Finding SCCs is not sufficient; feedback geometry must be explicit.

The semantic layout SHOULD preserve a forward narrative inside an SCC when possible and route feedback through dedicated feedback corridors.

The model SHOULD support:

- preferred feedback side;
- deterministic feedback-lane ordering;
- feedback stacking;
- feedback corridor spacing;
- feedback edge priority;
- clear entry/exit into the main narrative.

Feedback edges MUST not be allowed to destroy main-backbone continuity merely to reduce wire length.

---

# 13. Self-loops and parallel edges

Self-loops require dedicated candidate geometry:

- side selection;
- loop stacking;
- loop spacing;
- endpoint/port choice;
- label reservation.

Parallel edges require deterministic:

- ordering;
- spacing;
- label reservation;
- shared-trunk policy when allowed;
- separation when semantic distinction would otherwise be ambiguous.

---

# 14. Edge grouping and buses

Edge grouping is allowed only when semantics permit shared visual trunks.

Contracts SHOULD support:

```text
edgeGroupId
sourcePortGroupId
targetPortGroupId
allowSharedTrunk
```

A grouped trunk MUST remain semantically unambiguous. A visual bus must never make separate logical relations appear to be one relation if the diagram domain requires them to remain distinct.

The v1 design SHOULD remain extensible to hyperedge-like one-to-many / many-to-one junction models without requiring core architectural replacement.

---

# 15. Adaptive port contract

Logical port identity is separate from derived geometric anchor.

Canonical model:

```text
PortIdentity / constraints
  id
  type
  data type
  allowed sides
  preferred side
  order
  group
  capacity
  minimum spacing

DerivedPortAnchor
  side
  relative offset
  x/y
  normal
```

Derived anchors SHOULD NOT be persisted as authoritative data for freely adaptive ports unless a snapshot is used specifically for mental-map stabilization.

## 15.1 Port constraint modes

The model MUST represent at least:

```text
FREE
FIXED_SIDE
FIXED_ORDER
FIXED_RATIO
FIXED_POSITION
```

Backward-compatible mapping:

- `placementMode=fixed` with coordinate -> `FIXED_POSITION`;
- adaptive with one allowed side -> `FIXED_SIDE`;
- adaptive with order -> order constraint plus permitted side policy;
- adaptive without side restriction -> `FREE` within block policy.

## 15.2 Capacity

Port capacity MUST be explicit where the domain requires it:

```text
one
many
bounded(N)
```

The model SHOULD also support policy for shared anchor/stub/bus use.

## 15.3 Candidate planning

Adaptive placement MUST choose among deterministic candidates on allowed sides.

Candidate evaluation includes:

- hard feasibility;
- source-target direction;
- crossing impact;
- order inversions;
- bend count;
- local congestion;
- preferred-side deviation;
- port-group coherence;
- previous-side stability;
- wire length only after higher priorities.

Port side, order and edge routing are coupled. A planner MUST NOT choose each adaptive port independently when doing so creates avoidable crossings or order inversions.

---

# 16. Port hysteresis

Adaptive ports MUST preserve the previous side unless switching produces a meaningful improvement.

A side switch is justified by one or more of:

- removing a hard violation;
- eliminating a crossing;
- eliminating a port-order inversion;
- materially reducing bends/congestion;
- exceeding a versioned improvement threshold.

A tiny wire-length improvement alone SHOULD NOT cause side flapping across incremental edits.

Thresholds are profile parameters and MUST be benchmarked rather than hard-coded as universal constants.

---

# 17. Label-aware geometry and typography

Labels are part of layout geometry, not an afterthought.

The layout footprint MUST be able to account for:

- node title;
- subtitle;
- body content;
- port labels;
- edge labels;
- group labels;
- lane labels;
- annotations.

The renderer/host MUST be able to provide measured or conservatively estimated text bounds through a renderer-neutral text-measurement contract.

Core MUST NOT inspect DOM pixels.

Language/content changes that alter measured geometry map to layout invalidation; pure text changes that do not change measured geometry may remain semantic/render-only where contractually safe.

Test corpus MUST include:

- short labels;
- long labels;
- multiline labels;
- Unicode;
- CJK;
- RTL-ready geometry cases even if full RTL UI is deferred.

---

# 18. Perceptual composition principles

The composition engine uses perceptual principles as bounded priors.

## 18.1 High-priority perceptual principles

These are usually more useful than decorative ratios:

- hierarchy;
- continuity;
- proximity;
- common region;
- alignment;
- negative space;
- visual movement / eye path;
- figure-ground separation.

## 18.2 Medium / conditional principles

- balance;
- rhythm;
- repetition;
- scale;
- unity;
- variety;
- symmetry when semantically justified;
- closure where it helps grouping.

## 18.3 Low/profile-dependent geometric priors

- rule of thirds;
- golden-ratio focal guides;
- Fibonacci/modular spacing scales.

These MUST remain soft. They can break ties among nearly equivalent readable solutions; they cannot justify a crossing, hard-constraint violation or major mental-map regression.

---

# 19. Golden ratio and rule of thirds

Golden ratio constant:

```text
phi = 1.61803398875...
1 / phi = 0.61803398875...
1 / phi^2 = 0.38196601125...
```

Use of phi is explicitly non-dogmatic:

- node aspect ratio MUST remain content/port constrained;
- no node is required to be a golden rectangle;
- no canvas is required to be a golden rectangle;
- golden guides are optional focal/alignment candidates;
- profile strength defaults should be low compared with crossings/continuity;
- evidence for universal golden-ratio aesthetic superiority is treated as mixed, therefore phi is a composition prior, not a readability law.

Rule-of-thirds guides are treated similarly.

## 19.1 Avoid circular frame dependence

Do not continuously derive focal guides from a bounding frame that is simultaneously moving under those same guides.

Recommended deterministic sequence:

```text
Pass 1: semantic layout
Pass 2: freeze provisional composition frame
Pass 3: compute thirds / golden guides
Pass 4: bounded composition refinement
Pass 5: optional bounded frame adjustment
Pass 6: finalize
```

---

# 20. Composition frame

Composition requires an explicit frame model.

Conceptual modes:

```text
InfiniteCanvas
Viewport
PresentationSlide
PrintPage
FixedRegion
```

A `CompositionFrame` SHOULD contain:

- mode;
- target width/height when finite;
- margins;
- preferred orientation;
- maximum expansion ratio;
- print/viewport constraints where applicable.

Infinite canvas still requires a provisional frame for balance metrics; that frame is derived from the first semantic placement and bounded during composition refinement.

---

# 21. Negative space

Whitespace is a first-class composition resource.

Important nodes may receive larger visual breathing room, but the effect MUST saturate.

Conceptual form:

```text
halo = baseHalo * clamp(1 + importance*k, minFactor, maxFactor)
```

A global/profile-level `MaxCompositionExpansion` prevents important hubs from expanding the diagram without bound.

Whitespace around a node MUST NOT be represented as visual style only; routing/layout need the effective reservation geometry when whitespace is intended to affect paths.

---

# 22. Rhythm and modular spacing

Spacing may use a modular scale, but no Fibonacci sequence is universally mandatory.

A profile MAY define a scale such as:

```text
1.25
1.414...
1.5
1.618...
```

Derived spacing tokens MUST ultimately respect canonical placement/routing grids and content constraints.

Semantic phase boundaries may receive larger gaps than nodes inside one coherent phase.

---

# 23. Visual balance

Visual mass is a derived metric, not a physical truth.

Conceptually:

```text
mass(node) = visualArea * normalizedImportance * emphasisFactor
```

Balance metrics MAY consider mass center and region occupancy.

Perfect symmetry is not required. Controlled asymmetry is acceptable and often desirable when it expresses semantic hierarchy.

---

# 24. Accessibility and semantic visual hints

Core may emit semantic rendering hints, but accessibility is validated across renderer profiles.

Required principles:

- color MUST NOT be the sole carrier of semantic meaning;
- meaningful graphical elements need adequate adjacent contrast under accessibility profiles;
- error/warning/success/flow classes SHOULD have redundant shape/marker/line/label cues;
- high-contrast and monochrome/grayscale profiles MUST remain comprehensible;
- layout must not depend on hue differences to distinguish connectivity.

Recommended regression profiles:

- normal light;
- normal dark;
- high contrast;
- grayscale/print;
- common color-vision-deficiency simulations.

The exact renderer conformance thresholds belong in theme/accessibility documentation; geometry tests verify that semantic distinction is not encoded exclusively through color.

---

# 25. Edge visual hierarchy

Semantic analysis SHOULD classify edges, e.g.:

```text
primary
secondary
feedback
exception
reference
control
data
physical
```

Core MAY return an `edgeImportance`/role hint. Renderer determines concrete stroke/color/marker presentation.

A junction must be visually distinguishable from a non-connected crossing. Bridge hops or other renderer-neutral primitives may be used when necessary.

---

# 26. Disconnected components

Disconnected components MUST be laid out independently before scene-level component composition/packing.

Component packing considers:

- component frame;
- semantic order;
- category;
- time/phase metadata;
- importance;
- previous component position;
- target composition frame.

Simple rectangle packing is a fallback, not the sole quality objective.

---

# 27. Bounded joint refinement

The full problem is combinatorial. AutoTrace MUST use a deterministic bounded staged heuristic rather than claiming an unconstrained global optimum.

Recommended pipeline:

```text
1 semantic decomposition
2 constraint resolution
3 layering/rank assignment
4 crossing-reduction ordering
5 initial coordinates
6 compound/lane placement
7 port-side assignment
8 port ordering/anchor assignment
9 canonical routing
10 label placement/reservation
11 perceptual composition pass
12 local node moves
13 local port moves
14 local reroute/relabel
15 quality evaluation
16 stop or repeat within deterministic budget
```

Refinement ends on one of:

- no lexicographic improvement;
- deterministic iteration limit;
- deterministic work budget;
- caller cancellation;
- quality target reached.

No random non-seeded search is allowed in canonical mode.

---

# 28. Runtime / quality profiles

The API SHOULD support budgeted modes such as:

```text
interactive
normal
quality
offline
```

Exact time thresholds are benchmark hypotheses, not contractual constants. Deterministic work-unit/iteration budgets are preferred where wall-clock differences could otherwise change output.

Fallback ladder:

```text
SemanticHierarchicalHighQuality
  -> SemanticHierarchicalFast
  -> canonical Sugiyama
  -> preserve-input-layout + canonical routing
```

Every successful fallback MUST still pass validation.

---

# 29. Mental-map snapshot

Incremental stability needs more than old x/y values.

A layout snapshot SHOULD retain enough derived state to preserve the mental map:

```text
node positions
layer assignments
sibling order
port sides
port order
port offsets
branch side assignments
component/group frames
lane positions
narrative backbone
```

Movement cost SHOULD be importance-weighted and bounded by hard constraints.

Small local edits should produce local movement whenever feasible. Full-scene rearrangement requires objective evidence that local repair cannot meet hard/readability constraints.

---

# 30. Readability, stability and composition vectors

Do not collapse all quality into one scalar.

## 30.1 ReadabilityVector

At minimum:

- `backwardFlowEdges`;
- `sourceRankViolations`;
- `sinkRankViolations`;
- `mainBackboneBends`;
- `mainBackboneStraightness`;
- `branchCoherence`;
- `junctionClarity`;
- `portOrderInversions`;
- `portConstraintViolations`;
- `preferredSideDeviation`;
- `hierarchyFragmentation`;
- `laneViolations`;
- `feedbackClarity`;
- `labelAmbiguities`.

## 30.2 StabilityVector

At minimum:

- total node movement;
- importance-weighted node movement;
- rank changes;
- sibling-order changes;
- port-side changes;
- port-order changes;
- branch-side changes;
- group-frame movement;
- route churn.

## 30.3 CompositionVector

At minimum:

- visual balance;
- negative-space score;
- rhythm score;
- alignment score;
- semantic symmetry score;
- Gestalt grouping score;
- focal-point score;
- rule-of-thirds score;
- golden-composition score;
- frame expansion ratio.

Metrics MUST expose both raw counts and normalized rates where graph size materially changes interpretation.

A derived `HumanReadabilityScore` MAY exist for UI summaries, but it MUST NOT replace the vectors or release gates.

---

# 31. Diagnostics and explainability

Every canonical semantic layout SHOULD be able to emit deterministic decision diagnostics in debug/benchmark mode.

Examples:

```text
node A: source -> constrained to first semantic rank
node HUB: high articulation/backbone score -> larger whitespace reservation
node M: merge -> aligned near weighted incoming median
port P3: moved right -> bottom to remove one crossing
branch B: kept above backbone to preserve previous branch side
composition: golden guide moved HUB by 4 px; no Tier-1 metric changed
```

Diagnostics MUST expose reasons without coupling public API to internal solver data structures.

---

# 32. Testing contract

Required deterministic corpus families:

```text
linear-chain
single-branch
balanced-branch
asymmetric-branch
fan-out
fan-in
diamond
multi-merge
multiple-sources
multiple-sinks
critical-path
co-primary-backbones
feedback-loop
large-SCC
self-loop
parallel-edges
bus-group
nested-hierarchy
collapse-expand
cross-hierarchy
swimlanes
cross-lane-flow
many-ports
mixed-fixed-adaptive-ports
port-capacity
long-labels
multiline-labels
unicode-labels
CJK-labels
RTL-ready-label-geometry
disconnected-components
incremental-leaf-edit
incremental-group-expand
incremental-port-change
fixed-page
infinite-canvas
```

Metamorphic properties include:

- deterministic rerun;
- input permutation invariance where contract says order independent;
- translation invariance where applicable;
- pinned/fixed-node invariance;
- fixed-port invariance;
- adaptive anchors always on allowed sides;
- additional port freedom cannot make the best feasible Tier-0 result invalid;
- disconnected unrelated component does not alter another component beyond bounded component-packing effects;
- normalization idempotence;
- small-edit movement is bounded under the declared stability profile;
- disabling golden/thirds strengths produces zero direct guide effect;
- composition refinement never creates a Tier-0 violation.

---

# 33. Human evaluation

Algorithmic metrics are necessary but not sufficient.

A benchmark protocol SHOULD test comprehension separately from aesthetic preference.

Tasks include:

- find source;
- find sink;
- follow A -> B;
- identify primary path;
- identify merge;
- identify exception/feedback path;
- identify ownership/lane;
- compare two branch structures.

Measure:

- task completion time;
- error rate;
- confidence;
- subjective comprehension;
- subjective aesthetic preference as a separate measure.

Do not train/tune a readability metric solely from “which looks prettier?” responses.

---

# 34. Zoom, export and presentation profiles

The architecture SHOULD remain compatible with semantic zoom and output profiles:

- screen/infinite canvas;
- viewport/dashboard;
- presentation slide;
- A4/A3 portrait/landscape;
- SVG export;
- grayscale print.

At low zoom, structure and primary flow dominate. At high zoom, labels, ports and metadata become readable. Renderer-level semantic zoom may hide details, but underlying graph connectivity and hierarchy remain invariant.

---

# 35. Composition profiles

Initial profiles SHOULD include:

## `technical_readability`

- crossings/continuity: dominant;
- compactness: medium;
- mental-map stability: high;
- golden ratio: very low;
- thirds: very low;
- symmetry: only semantic.

## `process_flow`

- source/sink narrative: dominant;
- backbone continuity: dominant;
- branch clarity: high;
- lane/group coherence: high;
- visual balance: medium;
- golden/thirds: low.

## `balanced`

- readability: dominant;
- mental map: high;
- balance/whitespace/rhythm: medium;
- golden/thirds: low-to-medium.

## `presentation_artistic`

- Tier 0/1 remain non-negotiable;
- whitespace/balance/rhythm/alignment: high;
- golden/thirds: medium;
- compactness: lower priority.

## `manual_preserve`

- user positions/order: dominant;
- local repair only;
- port movement allowed only within declared constraints;
- composition influence minimal.

Profile parameters MUST be versioned and canonical defaults MUST live in one layer.

---

# 36. Acceptance invariant

A new semantic/composition implementation is eligible for production only if all are true:

1. Tier-0 violations are zero on the release corpus.
2. Fixed nodes and fixed ports never move.
3. Adaptive ports remain inside allowed constraints and capacity.
4. Determinism and permutation/metamorphic tests pass.
5. Crossings/readability are no worse than approved baseline budgets.
6. Small-edit mental-map regression stays inside approved budgets.
7. Composition refinement respects `MaxCompositionExpansion`.
8. Golden/thirds priors can be disabled independently and never act as hidden hard constraints.
9. Native Go and WASM produce the same canonical semantic-layout result under the same version/profile.
10. Every new public behavior is versioned, documented and represented in diagnostics/metrics.

---

# 37. Reference principles

The contract intentionally adopts mature graph-layout concepts such as layered layout, port constraints/candidates, compound graphs, partitions/swimlanes, edge grouping, incremental stability and explicit quality trade-offs. Useful external references include Eclipse Layout Kernel (ELK), yFiles hierarchical layout documentation, Graphviz rank constraints, WCAG non-text contrast/use-of-color guidance and graph-drawing readability literature.

Golden-ratio use is deliberately conservative: it is retained as an optional composition prior, not presented as an empirically universal law of aesthetic quality.

---

## Final rule

> **Semantic correctness first; crossings and continuity second; stable mental models next; perceptual composition after that; compactness and decorative proportion last.**
