# AutoTrace Visual Semantics & HMI Contract

Status: **normative for AutoTraceLab visual analytics and human-machine interaction**  
Scope: visual-semantic annotations, linked analytical views, focus/lens behavior, comparison, uncertainty visualization, explanation, Digital Twin playback, LabTrace shell, accessibility and renderer behavior.  
Authority: subordinate to `MASTER_IMPLEMENTATION_PLAN.md`. This contract is complementary to `VISUAL_COMPOSITION_CONTRACT.md` and `HUMAN_READABILITY_METRICS.md`; it does not redefine layout mathematics.

---

# 1. Purpose

AutoTrace must not only calculate and lay out a system correctly. It must make the system state understandable to a human with minimal search and reading effort.

The HMI pipeline is therefore explicit:

```text
domain/process state
  -> canonical analysis facts / simulation result / diagnostics
  -> Visual Semantics Compiler
  -> renderer-neutral visual annotations + linked-view state
  -> LabTrace visualization primitives
  -> concrete renderer styles / interaction / motion
```

Primary product invariant:

> **Meaning precedes decoration.**
>
> Every persistent visual emphasis must correspond to a semantic reason, interaction state or explicitly selected presentation mode.

Secondary invariant:

> **See before read.**
>
> Important operating state should be recognizable from hierarchy, grouping, contrast, shape, pattern and coordinated emphasis before the user has to inspect exact numeric values.

---

# 2. Responsibility boundaries

Visual semantics is a new layer; it must not collapse existing architectural boundaries.

## 2.1 Core / simulation / analysis

Canonical computation owns facts such as:

- topology and connectivity;
- semantic role;
- critical-path membership;
- queue length;
- utilization;
- bottleneck contribution;
- failure/rework state;
- stochastic distribution;
- objective score;
- constraint diagnostics;
- confidence/provenance when such confidence is part of the data contract.

Core must not choose CSS colors, shadows, pixel fonts or component layouts.

## 2.2 Layout / composition

`VISUAL_COMPOSITION_CONTRACT.md` owns geometry and graph comprehension:

- rank/order;
- coordinates;
- branch/merge geometry;
- groups/lanes;
- adaptive ports;
- routing integration;
- whitespace and composition;
- mental-map stability.

Visual Semantics must not move nodes merely to make a status color more noticeable.

## 2.3 Visual Semantics

Visual Semantics owns presentation meaning:

- importance;
- severity;
- confidence presentation class;
- current activity;
- trend;
- comparison/delta class;
- focus membership;
- contextual de-emphasis;
- visual role;
- explanation linkage;
- coordinated selection and filtering.

The output is renderer-neutral.

## 2.4 Renderer / UI shell

Renderer/UI owns concrete presentation:

- exact palette;
- typography;
- stroke widths in device units;
- icons;
- shadows;
- glow implementation;
- component geometry outside canonical graph layout;
- responsive adaptation;
- animation implementation;
- pointer/keyboard/touch interaction.

---

# 3. Layer model

The intended product stack is:

```text
AutoTrace Core / Process Engine
        |
        v
Analysis Facts + Diagnostics + Provenance
        |
        v
Visual Semantics Compiler
        |
        +-- VisualAnnotationSet
        +-- InsightSet
        +-- ScenarioDeltaSet
        +-- PlaybackSemanticState
        +-- LinkedViewState
        v
LabTrace HMI
        |
        +-- TopologyView
        +-- TimelineView
        +-- ResourceLaneView
        +-- DistributionView
        +-- CompareView
        +-- InsightRail
        +-- Inspector
        `-- PlaybackControls
        v
Theme / Renderer
```

`Visual Semantics Compiler` may live in the SDK/UI-support layer. It must not introduce React/DOM dependencies into canonical Go mathematics.

---

# 4. Canonical semantic data contracts

Exact implementation language may differ, but v1 public semantics should be able to express the following concepts.

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
  | 'changed';

export type TrendDirection = 'up' | 'down' | 'stable' | 'unknown';

export interface VisualSemanticFact {
  entityId: string;
  factId: string;
  kind: string;
  value?: number | string | boolean;
  unit?: string;
  normalizedValue?: number;
  confidence?: number;
  source?: string;
  evidenceIds?: string[];
  timestamp?: number;
}

export interface VisualAnnotation {
  entityId: string;
  role: VisualRole;
  importance?: number;   // normalized [0,1]
  severity?: number;     // normalized [0,1]
  confidence?: number;   // normalized [0,1]
  activity?: number;     // normalized [0,1]
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

Normalized fields are presentation inputs, not raw domain truth. The compiler must preserve links to the underlying fact/evidence.

---

# 5. Visual encoding grammar

The renderer must use a controlled visual grammar. A semantic concept should not randomly change encoding between Process Math, Simulation, Risk and Digital Twin.

Default channel ownership:

| Channel | Canonical primary meaning |
|---|---|
| hue | entity/type/category |
| saturation/chroma | severity or semantic emphasis |
| luminance/contrast | foreground/background hierarchy and activity, accessibility bounded |
| stroke width | quantitative load/intensity/throughput when scale is valid |
| opacity | contextual de-emphasis or confidence support, never sole critical cue |
| dash/pattern | estimated, hypothetical, inactive or special relation class |
| halo/glow | transient activity, selection or hotspot |
| size | semantic importance only where geometry semantics permit |
| icon/shape | redundant categorical/status encoding |
| motion | event, flow or state transition only |

## 5.1 Non-color redundancy

Critical semantics must survive:

- grayscale;
- common color-vision deficiencies;
- low-saturation themes;
- print/export where color may be unavailable.

At least one non-hue cue must accompany:

- danger/failure;
- warning;
- selected/focused state;
- estimated/hypothetical state;
- junction-vs-crossing semantics;
- active failure/rework path.

## 5.2 Quantitative encoding

A continuous visual channel may represent a continuous quantity only when:

- scale is defined;
- domain and clamp behavior are explicit;
- legend is available when interpretation is not obvious;
- zero and missing values are distinguished;
- transformed/log scales are labeled;
- cross-scenario comparisons use compatible domains unless explicitly normalized.

---

# 6. Semantic hierarchy

The interface must maintain a stable hierarchy:

```text
Level 1: current task / primary state
Level 2: operational exceptions and selected focus
Level 3: contextual measurements
Level 4: exact detail / inspector
Level 5: engineering diagnostics / algorithm internals
```

Normal operation must not expose Level-5 information with the same visual weight as Level-1 state.

Algorithm names, route timing, bend counts, solver internals and debug overlays belong to an `Engineering HUD` or diagnostics profile unless directly relevant to the current task.

---

# 7. Focus / lens contract

A focus lens changes emphasis, not truth or canonical geometry.

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
```

Each lens defines:

- included entity predicate;
- optional quantitative scale;
- context opacity/emphasis policy;
- legend;
- default linked analytical view;
- optional ranking;
- reason/explanation IDs.

A lens should preserve scene position to protect the mental map.

Context must usually remain visible at reduced emphasis rather than disappear completely.

---

# 8. Linked-view coordination

All analytical views must be able to share one interaction context.

Conceptual contract:

```ts
export interface LinkedViewState {
  selectedEntityIds: string[];
  hoveredEntityId?: string;
  focusedEntityIds?: string[];
  activeLens?: string;
  timeCursor?: number;
  timeWindow?: [number, number];
  scenarioIds?: string[];
  baselineScenarioId?: string;
  candidateScenarioId?: string;
  filters?: Record<string, unknown>;
}
```

Required behaviors:

- selecting an entity in topology highlights its timeline/resource/risk records;
- selecting a resource lane highlights associated topology nodes/edges;
- brushing a time interval filters or emphasizes the same interval in relevant views;
- scenario selection propagates consistently;
- clearing selection restores previous lens/context without changing domain data.

Selection state is presentation state, not canonical process state.

---

# 9. Canonical visualization primitives

## 9.1 TopologyView

Answers:

- what is connected;
- what causes what;
- where is the current semantic focus;
- which path/resource/state is important.

Supports:

- semantic overlays;
- focus lenses;
- heatmaps;
- selection;
- compare/diff annotations;
- playback activity.

## 9.2 TimelineView

Answers:

- what happened when;
- what waited;
- which operations overlap;
- where latency accumulates.

Supports:

- job/operation rows;
- event markers;
- waiting vs execution distinction;
- time cursor;
- zoom/window;
- linked selection.

## 9.3 ResourceLaneView

Answers:

- which resources are saturated;
- where capacity is idle;
- where queues are caused by availability.

Supports:

- capacity bands;
- occupancy;
- availability/failure windows;
- queue association;
- bottleneck emphasis.

## 9.4 FlowView

Used only when quantity flow is meaningful.

A Sankey-like representation must not be used solely for decoration or where edge width would falsely imply conserved quantity.

## 9.5 HeatmapOverlay

Supported semantic fields may include:

- utilization;
- queue pressure;
- risk;
- failure probability;
- uncertainty;
- change magnitude;
- objective contribution.

Only one primary continuous heat scale should dominate a view at a time unless a proven multivariate encoding is used.

## 9.6 DistributionView

Required for stochastic results where a single percentile would hide important shape.

Supports:

- histogram/density;
- percentile markers;
- threshold/SLA marker;
- probability of violation;
- baseline/candidate overlay or small multiples;
- explicit sample count/seed/model context where relevant.

## 9.7 CompareView

A first-class baseline/what-if representation.

Supports:

- absolute delta;
- relative delta;
- directionality;
- affected entities;
- bottleneck migration;
- topology/resource additions/removals;
- risk and uncertainty delta;
- trade-off summary.

## 9.8 InsightRail

Evidence-backed explanation surface. See section 12.

## 9.9 PlaybackControls

Temporal navigation for Digital Twin. See section 13.

---

# 10. KPI hierarchy contract

KPI cards are summaries, not the primary information architecture.

A screen with N metrics must explicitly classify them:

```text
primary outcome
secondary outcomes
constraints / thresholds
diagnostics
```

The renderer may use unequal size/contrast/position when the semantic hierarchy justifies it.

A KPI should support, where available:

- current value;
- unit;
- baseline;
- target/SLA;
- delta;
- trend;
- severity;
- uncertainty/confidence;
- click-through entity or explanation.

Avoid displaying a flat grid of equally emphasized metrics when one or two determine the current decision.

---

# 11. Uncertainty and stochastic visualization

Stochastic outputs must preserve distribution meaning.

The HMI should prefer:

```text
distribution + percentile + threshold probability
```

over:

```text
one percentile value only
```

The renderer must distinguish:

- observed/deterministic value;
- sampled stochastic result;
- inferred/estimated value;
- hypothetical what-if result.

Confidence and uncertainty must not be visually conflated with severity.

A highly uncertain low-risk estimate and a highly certain high-risk estimate need different encodings.

---

# 12. Insight and explanation contract

An insight is not free-form decoration. It is a structured, evidence-linked explanation.

Conceptual type:

```ts
export interface InsightItem {
  id: string;
  kind: 'bottleneck' | 'risk' | 'opportunity' | 'change' | 'failure' | 'uncertainty' | 'diagnostic';
  severity?: number;
  title: string;
  summary: string;
  entityIds: string[];
  metricIds?: string[];
  evidenceIds?: string[];
  confidence?: number;
  baselineValue?: number;
  candidateValue?: number;
  unit?: string;
  source: 'computed' | 'diagnostic' | 'heuristic';
}
```

Rules:

1. computed facts must remain distinguishable from heuristic interpretations;
2. insight text must link to entities/metrics/evidence where available;
3. selection of an insight should focus linked views;
4. the system must not invent causal certainty where only correlation or objective contribution is known;
5. confidence must be shown when materially relevant;
6. duplicate insights should be merged/ranked rather than spam the rail.

---

# 13. Motion and Digital Twin playback

Motion semantics:

> **Motion represents change.**

Permitted persistent use is narrow. Decorative perpetual motion is prohibited in analytical views.

Meaningful animated events include:

- job enters/leaves operation;
- resource becomes busy/idle;
- queue grows/shrinks;
- failure begins/ends;
- rework returns to an earlier operation;
- batch opens/closes;
- active path changes;
- selection/focus transition.

Playback state:

```ts
export interface PlaybackSemanticState {
  playing: boolean;
  cursorSeconds: number;
  speed: number;
  activeEventIds: string[];
  activeEntityIds: string[];
  queuedEntityIds?: string[];
  failedResourceIds?: string[];
}
```

Required controls:

- play/pause;
- step event backward/forward where deterministic event history exists;
- scrub timeline;
- speed selection;
- reset;
- visible current time.

`prefers-reduced-motion` and application motion preference must provide a non-animated equivalent using static state transitions/highlights.

---

# 14. Scenario comparison and semantic diff

Baseline/candidate comparison must be native to the UI.

`ScenarioDelta` should support:

```ts
export interface ScenarioDelta {
  metricId: string;
  baseline?: number;
  candidate?: number;
  absoluteDelta?: number;
  relativeDelta?: number;
  direction?: 'better' | 'worse' | 'neutral' | 'unknown';
  affectedEntityIds?: string[];
}
```

Graph diff classes should distinguish at minimum:

```text
unchanged
added
removed
modified
affected-by-change
bottleneck-moved-from
bottleneck-moved-to
```

Better/worse direction is objective-aware. Increasing a metric is not universally positive.

---

# 15. LabTrace shell contract

`LabTraceWorkbench` becomes the canonical shell for AutoTraceLab analytical workbenches.

Stable zones:

```text
header
navigation/sidebar
command/toolbar
workspace
secondary analytical pane
inspector
insight rail
overlays/status
```

Domain screens fill slots; they should not each redefine global shell geometry and theme primitives.

Recommended component hierarchy:

```text
LabTraceWorkbench
  LabTraceHeader
  LabTraceSidebar
  LabTraceCommandBar
  VisualizationWorkspace
    TopologyView
    TimelineView
    ResourceLaneView
    DistributionView
    CompareView
  Inspector
  InsightRail
  OverlayLayer
```

The exact arrangement is responsive and mode-dependent.

---

# 16. Shared design-system primitives

The HMI layer should provide common primitives such as:

```text
MetricCard
MetricDelta
MetricThreshold
SeverityBadge
ConfidenceBadge
EntityChip
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

Domain applications must prefer these over local reimplementations.

---

# 17. CSS/theme convergence

Long-lived component-local global CSS blocks are transitional only.

Migration target:

```text
shared design tokens
  + shared primitives
  + scoped component styles / utility classes
  + domain-neutral visualization components
```

Rules:

- no new process screen should introduce an independent global visual language;
- semantic status tokens come from shared tokens;
- spacing/type/radius/elevation scales are centralized;
- light/dark/engineering themes must apply consistently;
- visualization palettes must be tested against all supported base themes;
- domain-specific styling may extend, not fork, the design system.

---

# 18. Progressive disclosure and Engineering HUD

Normal-user view prioritizes task state.

Engineering diagnostics may include:

- active layout/router;
- execution time;
- bends/crossings;
- optimization vector;
- route validation diagnostics;
- semantic-layout decisions;
- debug wave cells;
- constraint traces.

These belong behind an explicit diagnostics/HUD mode unless they are the user's current task.

The UI should never require enabling Engineering HUD for normal process interpretation.

---

# 19. Accessibility

Minimum contract:

- keyboard access to primary commands;
- visible focus states;
- screen-reader labels for controls and major visualization summaries;
- non-color redundancy;
- contrast validation;
- reduced-motion mode;
- touch target sizing;
- grayscale/CVD visual regression profiles;
- textual equivalents for critical chart conclusions;
- zoom/text scaling without destroying main workflows.

Where a visualization cannot expose all geometry semantically to assistive technologies, it must expose an equivalent structured summary/table for the key decision task.

---

# 20. Responsive/mobile contract

AutoTraceLab must preserve semantic context across desktop/tablet/mobile.

Desktop may use simultaneous panes.

Narrow-screen adaptation should prefer:

- bottom sheets;
- drawers;
- view tabs;
- collapsible inspector;
- persistent compact scenario/time context;
- single-primary-visualization focus.

Do not simply shrink desktop panels below usable size.

Linked selection, active lens, time cursor and scenario state must survive responsive rearrangement.

---

# 21. Performance

Visual semantics must not negate existing graph virtualization work.

Required principles:

- derive annotations incrementally where possible;
- memoize by scene/result revision;
- avoid O(N*M) cross-view scans on pointer movement;
- index entity-to-run/resource/insight relationships;
- virtualize long timelines/lists;
- decimate or aggregate dense distributions where visually equivalent;
- throttle transient hover propagation where necessary;
- keep playback render work bounded;
- avoid layout thrash from DOM measurement loops.

Performance targets must be measured for representative large scenes and long simulation histories.

---

# 22. Presentation state vs domain state

Presentation state includes:

- zoom/pan;
- selected entities;
- active lens;
- open panels;
- time cursor/window;
- scenario comparison selection;
- active visualization mode;
- legend options;
- Engineering HUD state.

Domain state includes:

- process graph;
- scenario parameters;
- simulation result;
- resources;
- failures;
- constraints;
- objective definitions.

Presentation changes must not silently mutate domain state.

Persisted workspace state should version presentation state separately from domain model schemas.

---

# 23. Provenance

Every derived visual emphasis that could affect an engineering decision should be traceable to a reason.

Examples:

```text
Why is this node red?
  -> risk.severity = 0.83
  -> source: Monte Carlo scenario S42

Why is this edge thick?
  -> throughput normalized to active lens domain

Why is this block muted?
  -> not part of active Bottleneck lens; retained as context

Why is this insight shown?
  -> resource utilization + wait contribution + bottleneck classifier
```

The renderer need not expose provenance continuously, but inspector/tooltip/Insight Rail must make it reachable.

---

# 24. Human-comprehension acceptance

Visual changes are evaluated by tasks, not taste alone.

Representative tasks:

- locate primary source/sink;
- identify bottleneck;
- identify critical path;
- identify highest-risk stage;
- find where waiting accumulates;
- determine whether SLA is likely to be missed;
- explain baseline-to-candidate change;
- locate active failure during playback;
- identify which resource caused a queue.

Measures:

- completion time;
- error rate;
- confidence;
- interaction count;
- separate subjective comprehension;
- separate aesthetic preference.

Aesthetic preference may break ties among equally comprehensible designs; it cannot override a material comprehension regression.

---

# 25. Visual regression strategy

Required screenshot/visual regression families:

```text
empty
small chain
branch/merge
large graph
subcircuit
critical-path lens
bottleneck lens
risk heatmap
uncertainty distribution
compare baseline/candidate
Digital Twin playback frame
failure/rework frame
light/dark/high-contrast
grayscale/CVD profiles
mobile/tablet/desktop
```

Visual snapshots are not sufficient alone. Semantic assertions must accompany them where possible.

---

# 26. Anti-patterns

Do not:

- add glass/blur/gradients as a substitute for hierarchy;
- encode the same semantic state differently in each process screen;
- rely on color alone;
- make every KPI equally prominent;
- animate without event meaning;
- use Sankey width where quantity is not conserved/meaningful;
- hide uncertainty behind a single percentile;
- label a correlation as a causal explanation;
- remove all context in focus mode;
- re-layout topology merely because the visual lens changed;
- put engineering debug metrics in the primary user hierarchy;
- fork the shell for each domain;
- let local CSS redefine global tokens;
- compare scenarios with incompatible unlabeled scales;
- persist derived visual annotations as authoritative domain truth;
- let visualization transformations mutate simulation data.

---

# 27. Definition of Done

The Visual Semantics/HMI program is complete only when:

1. visual-semantic facts/annotations are versioned and renderer-neutral;
2. critical meaning is not hue-only;
3. LabTrace is the common shell for process analytical screens;
4. primary visual primitives are shared rather than locally reimplemented;
5. Canvas supports semantic focus lenses;
6. topology/timeline/resource selection is linked;
7. stochastic outputs have distribution/threshold views;
8. baseline/what-if comparison is first-class;
9. Insight Rail explanations link to evidence/entities;
10. Digital Twin has synchronized temporal playback;
11. motion has semantic meaning and reduced-motion fallback;
12. normal UI separates operational context from Engineering HUD diagnostics;
13. domain screens no longer depend on independent visual languages;
14. accessibility/CVD/grayscale regression gates pass;
15. desktop/tablet/mobile preserve linked semantic state;
16. large-scene/timeline performance meets approved budgets;
17. human-task evaluation shows no material comprehension regression and demonstrates gains on target tasks;
18. renderer behavior remains subordinate to canonical engineering facts and layout validity.

---

# 28. Final rule

> **Compute the truth, preserve the geometry, encode the meaning, coordinate the views, explain the reason, then decorate.**
