# AutoTrace — Human Readability, Stability and Composition Metrics

Status: **normative metric specification for semantic layout**  
Parent: `VISUAL_COMPOSITION_CONTRACT.md`.

---

# 1. Purpose

AutoTrace needs measurable evidence that a layout is easier to understand, not merely more compact or visually decorative.

This document defines three separate metric vectors:

```text
ReadabilityVector
StabilityVector
CompositionVector
```

The existing `QualityVector` remains authoritative for general route/layout quality. These new vectors extend it; they do not replace it.

A single `HumanReadabilityScore` may be shown in UI as a summary, but MUST NOT be used as the sole release gate.

---

# 2. Metric hierarchy

Acceptance is lexicographic by quality tier:

```text
Tier 0  hard validity
Tier 1  topological readability
Tier 2  cognitive simplicity
Tier 3  mental-map stability
Tier 4  perceptual composition
Tier 5  economy/performance
```

Metrics from a lower tier cannot silently compensate for a violation/regression in a higher tier.

---

# 3. ReadabilityVector

Recommended canonical fields:

```text
sourceRankViolations
sinkRankViolations
backwardFlowEdges
crossingsAbsolute
crossingsPerEdge
crossingDensity
ambiguousSharedPaths
junctionAmbiguities
mainBackboneBends
mainBackboneStraightness
mainBackboneContinuity
branchCoherence
mergeClarity
junctionClarity
parallelFlowCoherence
feedbackClarity
portOrderInversions
portConstraintViolations
preferredSideDeviation
hierarchyFragmentation
laneViolations
labelCollisions
labelAmbiguities
labelsOnArrowRatio
```

---

# 4. Source/sink rank metrics

`sourceRankViolations` counts explicit semantic sources placed outside required source rank constraints.

`sourceRankViolations` is not computed from raw in-degree alone when an explicit semantic source category exists.

Equivalent rule for sinks.

Hard vs soft classification depends on active constraints/profile.

---

# 5. Backward-flow metric

For an established narrative direction/backbone, classify edge progression.

A backward-flow edge is one that visually travels against the semantic forward direction beyond permitted local routing detours.

Do not count explicitly classified feedback edges as ordinary backward-flow violations; measure them under `feedbackClarity` instead.

Expose:

```text
backwardFlowEdgesAbsolute
backwardFlowRate
```

---

# 6. Crossings

Preserve existing crossing truth and expose size-normalized views.

At minimum:

```text
crossingsAbsolute
crossingsPerEdge
crossingDensity
```

Do not treat connected junctions as crossings.

Do not hide crossings through rendering bridges in the geometric metric; bridge rendering may improve ambiguity, but the topology still contains a visual crossing.

Crossings are Tier 1 and generally outrank bends, wire length and artistic composition.

---

# 7. Main-backbone metrics

For the `NarrativeBackbone`, calculate:

```text
mainBackboneBends
mainBackboneLength
mainBackboneStraightness
mainBackboneContinuity
```

`mainBackboneStraightness` may be normalized against route length and number of backbone segments.

A layout with a slightly longer total wire length may be preferred when it makes the primary narrative substantially straighter and crossing-free.

---

# 8. Branch coherence

Branch coherence measures whether a branch forms a visually consistent substructure rather than weaving through unrelated branches.

Possible components:

- side consistency around branch point;
- branch internal crossing count;
- branch-vs-other-branch crossings;
- route-direction consistency;
- subtree compactness inside its allocated region;
- unnecessary alternation around the main backbone.

Return normalized 0..1 where 1 is best, but retain raw diagnostic components.

---

# 9. Merge clarity

Merge clarity considers:

- incoming edge crossings near merge;
- approach-side consistency;
- weighted spread of incoming routes;
- unnecessary final bends;
- label collisions near merge;
- port ordering.

A merge aligned near the median of coherent incoming branches usually scores better, subject to constraints.

---

# 10. Junction clarity

A high-quality junction should make connection semantics obvious.

Penalize:

- overlapping port labels;
- too-small first-segment separation;
- visually ambiguous connected vs non-connected crossings;
- immediate edge reversals;
- dense edge fans without spacing;
- avoidable port-order inversions.

Renderer-neutral junction metadata may improve the final presentation, but geometry metrics remain independent of color/style.

---

# 11. Port metrics

Separate hard validity from preference.

```text
portConstraintViolations  // hard
portOrderInversions
preferredSideDeviation
portSideChanges            // StabilityVector
portOrderChanges           // StabilityVector
```

`preferredSideDeviation` should be normalized by number of adaptive ports with an explicit preference.

---

# 12. Hierarchy metrics

`hierarchyFragmentation` penalizes layouts where members of one compound group are visually split or interleaved with unrelated groups beyond declared cross-hierarchy needs.

Possible inputs:

- external nodes inside group frame;
- child nodes outside group;
- unnecessary cross-boundary edges;
- group aspect/area inflation;
- group-member interleaving.

Hard containment violations remain Tier 0; fragmentation is the soft readability component.

---

# 13. Lane metrics

For swimlanes/partitions:

```text
laneViolations          // hard when membership hard
crossLaneEdges
crossLaneBends
laneOrderChanges        // stability
laneWhitespaceImbalance // composition/diagnostic
```

Cross-lane edges are not inherently bad. Penalize only relative to semantic/profile intent.

---

# 14. Feedback clarity

Feedback should look intentionally backward/recursive rather than like accidental bad routing.

Measure:

- use of dedicated feedback corridors;
- feedback crossings with primary flow;
- feedback-vs-feedback congestion;
- clarity of entry/exit;
- number of avoidable main-path disruptions.

Expose raw counts plus normalized `feedbackClarity` 0..1.

---

# 15. Labels

Preserve canonical label metrics and add readability interpretation.

At minimum:

```text
labelCollisions
labelWireCollisions
labelNodeCollisions
labelsOnArrowRatio
labelAmbiguities
```

A label may be collision-free yet ambiguous if it visually appears closer to a different edge/node than to its owner; optional proximity ambiguity metrics may be introduced once validated.

---

# 16. StabilityVector

Recommended fields:

```text
nodeMovementTotal
nodeMovementMean
nodeMovementP95
importanceWeightedNodeMovement
rankChanges
siblingOrderChanges
componentFrameMovement
groupFrameMovement
laneMovement
branchSideChanges
portSideChanges
portOrderChanges
portOffsetMovement
routeChurn
labelChurn
```

Stability is evaluated between a previous `LayoutSnapshot` and new layout.

---

# 17. Importance-weighted movement

Conceptual form:

```text
weightedMovement = sum(
    normalizedImportance(node) * distance(oldPos, newPos)
)
```

Pinned/fixed nodes have hard invariance and do not use a penalty as a substitute.

Use normalized metrics by graph scale/diagonal when comparing different-sized scenes.

---

# 18. Route churn

Route churn should distinguish:

- changed route topology;
- changed bends;
- changed total length;
- moved unchanged topology.

A small local edit should not cause widespread route churn without quality evidence.

---

# 19. CompositionVector

Recommended fields:

```text
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
componentPackingQuality
```

These are Tier 4 and cannot compensate for Tier 0/1 regressions.

---

# 20. Visual balance

Approximate node/group visual mass using measured geometry and semantic importance.

Conceptual diagnostic:

```text
mass = effectiveVisualArea * importance * emphasisFactor
```

Compare mass centroid to target composition frame and evaluate extreme regional imbalance.

Do not require mathematical centering when semantic flow deliberately creates asymmetry.

---

# 21. Negative space

Measure whether reserved whitespace is:

- sufficient around important junctions;
- consistent inside semantic groups;
- not excessively wasteful;
- within `MaxCompositionExpansion`.

Possible components:

```text
importantNodeHaloSatisfaction
localWhitespaceVariance
groupWhitespaceConsistency
unusedAreaPenalty
```

---

# 22. Rhythm

Rhythm measures consistency of spacing at the semantic phase level.

A useful implementation should distinguish:

- within-phase spacing;
- between-phase spacing;
- sibling spacing;
- repeated pattern consistency.

Do not score all nearest-neighbor distances toward one constant.

---

# 23. Alignment

Measure meaningful alignment guides:

- main backbone;
- same-rank nodes;
- group members;
- lane structures;
- branch rows/columns.

Only semantically meaningful alignments count as positive evidence.

---

# 24. Semantic symmetry

Symmetry score applies only to semantically equivalent/paired branches.

If branches differ in priority/meaning, asymmetric presentation is not a penalty by default.

The semantic analyzer supplies branch-equivalence metadata or profile hints.

---

# 25. Gestalt grouping

Composition may score:

- proximity inside group vs outside group;
- common-region containment;
- repeated alignment patterns;
- separation between unrelated groups;
- continuity of related paths.

Do not infer semantic similarity solely from rendered color.

---

# 26. Rule of thirds and golden composition

These are weak metrics.

`ruleOfThirds` measures proximity of selected focal entities to candidate thirds guides when the active profile enables them.

`goldenComposition` measures analogous proximity to 0.381966 / 0.618034 focal guides.

Rules:

- only selected high-importance focal entities participate;
- disabled strength => metric may still be reported diagnostically, but it has zero optimization influence;
- no hard thresholds;
- no required golden rectangle;
- no Tier-0/Tier-1 trade.

---

# 27. Frame expansion

```text
frameExpansion = finalArea / provisionalSemanticArea
```

or an equivalent robust dimension-wise measure.

The active profile defines the allowed maximum. Exceeding the hard maximum is a composition constraint violation.

---

# 28. Raw vs normalized metrics

Whenever graph size materially changes interpretation, expose both.

Examples:

```text
crossingsAbsolute
crossingsPerEdge

nodeMovementTotal
nodeMovementPerNode
nodeMovementNormalizedByFrameDiagonal

portOrderInversions
portOrderInversionRate
```

Never compare only raw values across S/M/L/XL benchmark classes.

---

# 29. HumanReadabilityScore

A UI summary may be derived only after vectors are calculated.

Requirements:

- version the formula;
- expose component breakdown;
- never hide hard violations;
- never use it as sole release gate;
- do not treat beauty preference as comprehension truth.

Suggested UI form:

```text
Validity               PASS
Topological readability  94
Cognitive simplicity     89
Mental-map stability     92
Composition              78
```

The aggregate number is optional.

---

# 30. Benchmark comparison policy

For each corpus scene, record:

```text
algorithm/version
composition profile/version
routing version
scene hash
seed/work budget
QualityVector
ReadabilityVector
StabilityVector
CompositionVector
runtime
allocations where available
```

Compare baseline and candidate using lexicographic/Pareto gates.

A candidate can be accepted with longer wire length if it removes crossings or materially improves the narrative path.

---

# 31. Human A/B validation

Algorithmic metrics should be validated against human comprehension.

Separate two questions:

1. Which diagram is easier to understand?
2. Which diagram looks more aesthetically pleasing?

Tasks:

- find start/end;
- follow a named path;
- identify a branch;
- identify a merge;
- identify feedback;
- identify lane ownership;
- identify whether two nodes are connected.

Measure:

```text
completion time
error rate
confidence
subjective comprehension
subjective aesthetic preference
```

Tune readability weights against comprehension evidence, not only preference.

---

# 32. Release gates

Semantic layout release requires:

- Tier-0 violations = 0;
- crossing/readability metrics equal or Pareto-better than baseline envelope;
- stability within incremental budgets;
- composition within max expansion;
- metric determinism;
- raw and normalized metric reports;
- native/WASM equivalence;
- no use of one composite score as acceptance truth.

---

## Final metric rule

> **Measure comprehension-related structure first, stability second, artistic composition third, and compactness last.**
