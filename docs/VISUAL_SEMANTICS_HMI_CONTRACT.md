# AutoTrace Visual Semantics & HMI Contract

Status: **normative for AutoTraceLab visual analytics and human-machine interaction**  
Scope: visual-semantic annotations, linked analytical views, focus/lens behavior, multidomain projection state, comparison, uncertainty visualization, explanation, Digital Twin playback, LabTrace shell, accessibility and renderer behavior.  
Authority: subordinate to `MASTER_IMPLEMENTATION_PLAN.md`. This contract complements `VISUAL_COMPOSITION_CONTRACT.md`, `HUMAN_READABILITY_METRICS.md` and `SEMANTIC_PROJECTION_SPACE_CONTRACT.md`; it does not redefine layout mathematics, canonical entity identity or projection algebra.

---

# 1. Purpose

AutoTrace must not only calculate and lay out a system correctly. It must make system structure, state and change understandable to a human with minimal search and reading effort.

The presentation pipeline is explicit:

```text
canonical domain/process state
  -> analysis facts / simulation / diagnostics / provenance
  -> optional Semantic Projection Engine
  -> ProjectionResult
  -> Visual Semantics Compiler
  -> renderer-neutral annotations + linked view state
  -> LabTrace visualization primitives
  -> concrete 2D/2.5D renderer / interaction / motion
```

Primary invariants:

> **Meaning precedes decoration.**

> **See before read.**

> **Projection decides what is in the view; a lens decides what is emphasized in the view.**

Persistent visual emphasis must correspond to semantic reason, interaction state or explicit presentation mode.

---

# 2. Responsibility boundaries

## 2.1 Core / simulation / analysis

Canonical computation owns facts such as topology, connectivity, semantic role, critical-path membership, queue length, utilization, bottleneck contribution, failures/rework, stochastic distributions, objectives, constraints, causal relations and evidence/provenance where defined by domain contracts.

Core must not choose CSS colors, shadows, device fonts or UI panel geometry.

## 2.2 Multidomain Semantic Projection

`SEMANTIC_PROJECTION_SPACE_CONTRACT.md` owns:

- authoritative `SemanticEntity` identity;
- `EntityFacet` ownership;
- semantic dimensions;
- typed intra/cross-domain relations;
- projection membership/slicing;
- projection algebra;
- cross-domain coupling metrics when canonical;
- projection diagnostics;
- canonical 2.5D projection semantics.

Visual Semantics must not recreate facet or projection algebra locally.

## 2.3 Layout / composition

`VISUAL_COMPOSITION_CONTRACT.md` owns rank/order, coordinates, branches, groups/lanes, ports, routing integration, whitespace/composition and mental-map stability.

Projection/lens/camera changes do not authorize arbitrary node movement. Projection-stable layout is coordinated with WS-M/MP56.

## 2.4 Visual Semantics

Visual Semantics owns renderer-neutral presentation meaning:

- importance;
- severity;
- confidence presentation class;
- activity;
- trend;
- comparison/delta class;
- focus membership;
- contextual de-emphasis;
- visual role;
- explanation linkage;
- selection/filter coordination.

## 2.5 Renderer / UI shell

Renderer owns exact palette, typography, stroke widths, icons, shadows, concrete 2D/2.5D projection drawing, camera animation, responsive composition, hit testing and pointer/keyboard/touch interaction.

Renderer must not infer authoritative identity from visual proximity or depth.

---

# 3. Layer model

```text
AutoTrace Core / Process Engine
        |
        v
Canonical Facts + Diagnostics + Provenance
        |
        +-----------------------------+
        |                             |
        v                             v
Semantic Projection Engine      direct flat scene
        |
        v
ProjectionResult
        |
        v
Visual Semantics Compiler
        |-- VisualAnnotationSet
        |-- InsightSet
        |-- ScenarioDeltaSet
        |-- PlaybackSemanticState
        `-- LinkedViewState
        |
        v
LabTrace HMI
        |-- TopologyView
        |-- ProjectionExplorer
        |-- TimelineView
        |-- ResourceLaneView
        |-- DistributionView
        |-- CompareView
        |-- InsightRail / Inspector
        `-- PlaybackControls
        |
        v
Theme / 2D / 2.5D Renderer
```

Visual Semantics may live in SDK/UI-support. It must not introduce React/DOM dependencies into canonical Go mathematics.

---

# 4. Canonical visual-semantic contracts

```ts
export type VisualRole =
  | 'primary'
  | 'secondary'
  | 'context'
  | 'critical'
  | 'bottleneck'
  | 'warning'
  | 'failure'
  | 'uncertain'
  | 'inactive'
  | 'changed'
  | 'cross-domain-bridge';

export type TrendDirection = 'up' | 'down' | 'stable' | 'unknown';

export interface VisualSemanticFact {
  entityId: string;
  facetId?: string;
  factId: string;
  kind: string;
  value?: number | string | boolean;
  unit?: string;
  normalizedValue?: number;
  confidence?: number;
  source?: string;
  evidenceIds?: string[];
  relationIds?: string[];
  timestamp?: number;
}

export interface VisualAnnotation {
  entityId: string;
  facetId?: string;
  role: VisualRole;
  importance?: number;
  severity?: number;
  confidence?: number;
  activity?: number;
  trend?: TrendDirection;
  quantitativeLoad?: number;
  isEstimated?: boolean;
  isHypothetical?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
  isContext?: boolean;
  reasonIds?: string[];
}
```

Normalized fields are presentation inputs, not raw truth. Entity/facet IDs must resolve through the canonical multidomain contract when WS-M is active.

---

# 5. Projection state contract

Projection state is presentation/query state around a canonical `ProjectionSpec`; it is not domain state.

```ts
export interface ProjectionViewState {
  projectionId?: string;
  projectionRevision?: string;
  depthDimensionId?: string;
  visibleSliceIds?: string[];
  mode?: 'flat' | 'overlay' | 'stack' | 'exploded' | 'cross-domain';
  viewpoint?: 'flat' | 'shallow' | 'layered' | 'cross-domain';
  facetPolicy?: 'collapse-to-entity' | 'expand-visible-facets' | 'hybrid';
  contextPolicy?: 'none' | 'ghost' | 'neighbors' | 'all-muted';
  expandedEntityIds?: string[];
}
```

Rules:

1. UI may edit a `ProjectionSpec` only through explicit projection controls.
2. A lens cannot change projection membership.
3. A camera preset cannot change projection membership or canonical layout geometry.
4. Selection remains based on stable entity/facet IDs across projection transitions.
5. `ProjectionViewState` is persisted separately from domain model state.

---

# 6. Visual encoding grammar

Default channel ownership:

| Channel | Primary meaning |
|---|---|
| hue | entity/type/category/domain family where appropriate |
| saturation/chroma | severity/emphasis |
| luminance/contrast | hierarchy/activity, accessibility bounded |
| stroke width | valid quantitative load/throughput |
| opacity | context/confidence support, never sole critical cue |
| dash/pattern | estimated/hypothetical/inactive/relation class |
| halo/glow | transient activity/selection/hotspot |
| size | semantic importance only where geometry allows |
| icon/shape | redundant category/status semantics |
| motion | event/flow/state transition only |
| z-depth / semantic plane | selected projection dimension only |
| identity column | same authoritative entity across facet planes |

Depth must never be the sole carrier of failure, warning, selection or identity.

---

# 7. Non-color and non-depth redundancy

Critical semantics must survive:

- grayscale;
- common color-vision deficiencies;
- low-saturation themes;
- Flat mode;
- print/export;
- reduced motion.

At least one non-hue cue accompanies danger/failure, warning, selected/focused, estimated/hypothetical and active failure/rework.

At least one non-depth cue accompanies:

- same-entity identity across facets;
- active semantic plane;
- cross-domain relation class;
- critical state represented in a stacked view.

---

# 8. Semantic hierarchy

```text
Level 1: current task / primary state
Level 2: operational exceptions / active projection/lens
Level 3: contextual measurements / neighboring facets
Level 4: exact detail / inspector / provenance
Level 5: engineering diagnostics / algorithm internals
```

Normal operation must not give Level-5 information the same visual weight as Level-1 state.

---

# 9. Focus / lens contract

Required v1 lenses:

```text
CriticalPath
Bottlenecks
Risk
Queues
Failures
Rework
ResourcePressure
Uncertainty
Changes
CrossDomainCoupling
```

A lens defines included/emphasized semantic facts, quantitative scale if any, context policy, legend, ranking and reason IDs.

A lens changes emphasis, not truth, projection membership or canonical geometry.

Example:

```text
Projection: Domain = electrical + mechanical + hydraulic, mode = stack
Lens: Risk
```

Changing Risk to Bottlenecks keeps the same projection unless the user explicitly changes it.

---

# 10. Linked-view coordination

```ts
export interface LinkedViewState {
  selectedEntityIds: string[];
  selectedFacetIds?: string[];
  hoveredEntityId?: string;
  hoveredFacetId?: string;
  focusedEntityIds?: string[];
  activeLens?: string;
  projection?: ProjectionViewState;
  timeCursor?: number;
  timeWindow?: [number, number];
  scenarioIds?: string[];
  baselineScenarioId?: string;
  candidateScenarioId?: string;
  filters?: Record<string, unknown>;
}
```

Required behaviors:

- selecting any facet instance selects/highlights the authoritative entity everywhere;
- facet-level selection may remain available as a secondary detail state;
- topology selection highlights timeline/resource/risk/projection records;
- a resource/timeline selection highlights related entity/facets;
- brushing time propagates to Twin/projection state where relevant;
- projection changes preserve selected entity and time cursor;
- scenario selection propagates consistently;
- clearing focus never mutates domain data.

Final MP45 stable-ID implementation should consume MP52 entity/facet identity or an explicitly temporary compatibility adapter.

---

# 11. Canonical visualization primitives

## 11.1 TopologyView

Connectivity, causality, semantic focus, overlays, comparison and playback.

## 11.2 ProjectionExplorer

Controls/selects semantic dimensions and slices. Supports Flat/Overlay/Stack/Exploded/CrossDomain, facet collapse/expand, ghost context and canonical viewpoints. It delegates membership algebra to the Projection Engine.

## 11.3 IdentityColumn / FacetStack

Visual primitives for one entity represented across multiple planes. They must be visually distinct from physical/causal relations and select as one entity.

## 11.4 TimelineView

Shows execution/waiting/events and shares time/selection/projection context.

## 11.5 ResourceLaneView

Shows capacity/occupancy/failure/queues and links to entity/facet instances.

## 11.6 FlowView

Allowed only where width represents meaningful quantity.

## 11.7 HeatmapOverlay

One dominant continuous scale at a time unless a validated multivariate encoding is used.

## 11.8 DistributionView

Shows stochastic shape, percentiles, threshold/SLA probability and model/sample context.

## 11.9 CompareView

Supports metric, topology, resource and projection-algebra diffs including entity/facet/relation changes and identity merge/split warnings.

## 11.10 InsightRail

Evidence-backed explanation surface.

## 11.11 PlaybackControls

Temporal navigation for Digital Twin, including cross-domain propagation.

---

# 12. KPI hierarchy

KPI cards are summaries, not the primary information architecture.

Classify metrics into primary outcome, secondary outcomes, constraints/thresholds and diagnostics. A KPI should expose value/unit, baseline, target/SLA, delta, trend, severity, uncertainty and click-through evidence where available.

---

# 13. Uncertainty and stochastic visualization

Prefer distribution + percentile + threshold probability over a single percentile when distribution shape matters.

Distinguish observed/deterministic, sampled stochastic, inferred/estimated and hypothetical what-if. Confidence/uncertainty must not be conflated with severity.

Projection/slice choice must not silently alter the statistical population without an explicit scope label.

---

# 14. Insight and explanation contract

```ts
export interface InsightItem {
  id: string;
  kind:
    | 'bottleneck'
    | 'risk'
    | 'opportunity'
    | 'change'
    | 'failure'
    | 'uncertainty'
    | 'cross-domain-coupling'
    | 'diagnostic';
  severity?: number;
  title: string;
  summary: string;
  entityIds: string[];
  facetIds?: string[];
  relationIds?: string[];
  metricIds?: string[];
  evidenceIds?: string[];
  confidence?: number;
  source: 'computed' | 'diagnostic' | 'heuristic';
}
```

Computed facts remain distinguishable from heuristic interpretations. Cross-domain causal language requires explicit causal/evidence semantics; high coupling or centrality alone is not causality or risk.

---

# 15. Motion and Digital Twin playback

> **Motion represents change.**

Meaningful events include operation entry/exit, resource transitions, queue growth, failure/recovery, rework, batch transitions, active path changes and cross-domain propagation.

Playback state may include active entity/facet/relation/event IDs. Freezing time and changing projection must preserve event identity. Reduced-motion mode provides the same state through static emphasis and event stepping.

---

# 16. Scenario, lifecycle and multidomain diff

CompareView must integrate with projection algebra where available.

Examples:

```text
Baseline △ Candidate
Design △ AsBuilt
Nominal △ FailureCase
Electrical ∩ Hydraulic
```

Diff distinguishes entity, facet, relation, property, state and identity mapping changes. Better/worse classification remains objective-aware. Identity merge/split requires special handling rather than ordinary numeric delta.

---

# 17. Canonical 2.5D interaction policy

Required canonical viewpoints:

```text
Flat
Shallow
Layered
CrossDomain
```

The default HMI avoids arbitrary free rotation because it harms label reading, mental map, comparison and accessibility. If an exploratory free camera is later supported, it must be secondary and have one-action reset.

Camera motion is renderer state. It does not invoke semantic recomputation and does not mutate canonical layout.

---

# 18. LabTrace shell contract

`LabTraceWorkbench` is the canonical shell.

Stable zones:

```text
header
navigation/sidebar
command/toolbar
projection/lens controls
workspace
secondary analytical pane
inspector
insight rail
overlays/status
```

Recommended hierarchy:

```text
LabTraceWorkbench
  LabTraceHeader
  LabTraceSidebar
  LabTraceCommandBar
  ProjectionControls
  VisualizationWorkspace
    TopologyView
    ProjectionExplorer
    TimelineView
    ResourceLaneView
    DistributionView
    CompareView
  Inspector
  InsightRail
  OverlayLayer
```

Domain screens fill slots rather than redefine the shell.

---

# 19. Shared design-system primitives

Preferred shared primitives:

```text
MetricCard
MetricDelta
MetricThreshold
SeverityBadge
ConfidenceBadge
EntityChip
FacetChip
DimensionChip
ProjectionControls
ProjectionLegend
IdentityColumn
FacetStack
InsightCallout
VisualLegend
Timeline
ResourceLane
DistributionPlot
HeatmapLegend
ScenarioCompare
PlaybackControls
EngineeringHUD
EmptyState
ErrorState
LoadingState
```

---

# 20. CSS/theme convergence

No new process screen should introduce an independent global visual language. Semantic status, projection planes, relation classes and identity cues come from shared tokens/profiles. Domain-specific styling extends rather than forks the design system.

---

# 21. Progressive disclosure / Engineering HUD

Layout/router algorithms, execution time, bends/crossings, optimization vectors, route validation and projection diagnostics are Level-5 information unless directly relevant to the task. Normal process interpretation must not require Engineering HUD.

---

# 22. Accessibility

Minimum contract:

- keyboard access;
- visible focus;
- screen-reader control labels and critical visualization summaries;
- non-color/non-depth redundancy;
- contrast validation;
- reduced motion;
- touch targets;
- grayscale/CVD profiles;
- text scaling;
- Flat equivalent for every 2.5D analytical view;
- structured layer/facet list for assistive navigation.

---

# 23. Responsive/mobile contract

Desktop may use simultaneous panes and shallow/layered 2.5D. Narrow screens should prefer one primary visualization, drawers/sheets/tabs and often Flat/Overlay mode. Linked selection, active lens, projection/slice, time cursor and scenario state survive responsive rearrangement.

Do not shrink a desktop 2.5D stack until labels/hit targets become unusable.

---

# 24. Performance

Required principles:

- incremental annotation compilation;
- indexes for entity/facet/run/resource/insight relationships;
- projection result reuse from canonical engine;
- no global semantic recomputation on hover/camera motion;
- virtualization/culling for long timelines and many planes;
- aggregation of dense cross-domain relations;
- bounded playback work;
- no DOM measurement loops in canonical math.

---

# 25. Presentation state vs domain state

Presentation/query state includes zoom/pan, selection, lens, projection/slices, canonical viewpoint, open panels, time cursor/window, comparison selection, visualization mode, legends and Engineering HUD.

Domain state includes authoritative entities/facets/relations, process graph, scenario parameters, simulation results, resources, failures, constraints and objectives.

Presentation/query changes must not silently mutate domain state.

---

# 26. Provenance

Any visual emphasis that could affect an engineering decision should be traceable to a reason. Examples include risk severity, throughput mapping, context de-emphasis, cross-domain bridge classification and identity mapping. Inspector/tooltip/Insight Rail must make provenance reachable.

---

# 27. Human-comprehension acceptance

Representative tasks now include:

```text
identify bottleneck / critical path / risk
find waiting/SLA issue
compare baseline vs candidate
locate failure/rework event
identify same physical entity across domain facets
find components shared by electrical and hydraulic slices
trace cross-domain failure propagation
find multidisciplinary coupling hotspots
compare Design vs AsBuilt
```

Measure completion time, error rate, confidence, interaction count, reorientation errors and subjective comprehension; aesthetic preference is separate.

---

# 28. Visual regression strategy

Required fixtures include ordinary topology/process cases plus:

```text
Flat multidomain
Stack multidomain
Exploded identity columns
CrossDomain viewpoint
projection + Risk lens
Electrical ∩ Hydraulic
Design △ AsBuilt
cross-domain Twin playback frame
flat/high-contrast/grayscale equivalents
mobile projection controls
```

Screenshot regression is accompanied by semantic assertions.

---

# 29. Anti-patterns

Do not:

- use decoration as hierarchy;
- encode the same state differently per process screen;
- rely on hue or z-depth alone;
- make every KPI equal;
- animate without event meaning;
- hide stochastic shape when material;
- label correlation/centrality as causal explanation;
- remove all context in focus mode;
- re-layout merely because lens/camera changed;
- put debug metrics in primary hierarchy;
- fork shell/theme/status semantics;
- persist VisualAnnotations or 2.5D facet copies as authoritative model data;
- let renderer infer entity identity;
- let a lens change projection membership;
- let camera movement trigger semantic recomputation;
- use arbitrary 3D rotation as the default;
- silently change statistical scope when changing projection;
- let UI migration alter canonical simulation/model outputs.

---

# 30. Definition of Done

The Visual Semantics/HMI program is complete only when:

1. visual-semantic facts/annotations are versioned and renderer-neutral;
2. critical meaning is not hue/depth-only;
3. LabTrace is common shell;
4. shared visual primitives replace local shell-level reimplementation;
5. Canvas has semantic lenses;
6. projection and lens semantics are explicitly orthogonal;
7. `LinkedViewState` can preserve stable entity/facet selection and projection state;
8. topology/timeline/resource views are linked;
9. stochastic outputs expose distribution/threshold meaning;
10. baseline/what-if and projection-algebra comparison are first-class where available;
11. Insight Rail preserves provenance and causal discipline;
12. Digital Twin has synchronized temporal and cross-domain playback hooks;
13. motion has reduced-motion parity;
14. Engineering HUD is progressively disclosed;
15. domain screens share one visual language;
16. every 2.5D view has usable Flat/accessibility fallback;
17. desktop/tablet/mobile preserve semantic context;
18. large-scene/timeline/projection performance meets budgets;
19. human-task evaluation shows no material comprehension regression and target gains;
20. renderer remains subordinate to canonical identity, projection semantics, engineering facts and layout validity.

---

# 31. Final rule

> **Compute the truth, preserve identity and geometry, choose the projection, encode the meaning, coordinate the views, explain the reason, then decorate.**
