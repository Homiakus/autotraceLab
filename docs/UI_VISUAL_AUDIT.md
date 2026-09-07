# AutoTraceLab — UI / Visual Representation Audit

Status: **current-state audit and migration baseline**  
Date: 2026-09-07  
Scope: AutoTraceLab React UI, process workbenches, LabTrace shell, diagram canvas, visualization patterns, visual hierarchy and cross-view consistency.  
Authority: descriptive/audit document. Normative requirements are defined in `VISUAL_SEMANTICS_HMI_CONTRACT.md`; execution order is defined in `MASTER_IMPLEMENTATION_PLAN.md` and `VISUAL_SEMANTICS_IMPLEMENTATION_PLAN.md`.

---

# 1. Executive finding

AutoTraceLab already has strong engineering-editor mechanics and a substantial amount of visual functionality, but it does not yet consistently transform analytical meaning into immediate visual understanding.

The main deficiency is **not lack of graphics**. The project already contains:

- graph topology;
- hierarchical subcircuits;
- rich ports and typed colors;
- timelines;
- KPIs;
- resource simulation views;
- risk/reliability views;
- themes and density modes;
- inspectors;
- overlays;
- interaction, zoom and pan;
- diagnostics and benchmark information.

The deficiency is that most information is still represented as **equally weighted cards, rows, tables, labels and local visual conventions**. The user often has to read the interface before understanding the system.

Target principle:

> **The user should be able to see the important state before reading the detailed values.**

AutoTraceLab should evolve from a collection of technically capable screens into a unified **visual reasoning environment** where topology, time, resources, risk, uncertainty, optimization and explanation are linked views of the same semantic model.

---

# 2. Current strengths

## 2.1 Diagram editor foundation

`DiagramCanvas` already provides a strong interactive substrate:

- pan/zoom/fit;
- touch interaction and pinch zoom;
- viewport culling for large scenes;
- node/edge/port selection;
- drag-to-connect and tap-to-connect;
- edge labels;
- bridge jumps;
- obstacle/debug overlays;
- hierarchy breadcrumbs;
- subcircuit drill-down;
- external input/output rails;
- node inspector integration;
- multiple node shapes;
- image-backed nodes;
- adaptive/fixed ports;
- typed port colors.

This should be preserved. The next UX iteration should extend it with semantic overlays and focus/lens modes rather than replace it.

## 2.2 Existing theme infrastructure

The root theme system already has a useful token foundation:

- canvas/primary/secondary/elevated/sunken surfaces;
- text hierarchy;
- border hierarchy;
- semantic success/warning/danger/info states;
- configurable accent;
- multiple engineering themes;
- motion timing/easing tokens;
- reduced-motion support.

The problem is adoption consistency, not absence of tokens.

## 2.3 Appearance/admin UI

The appearance subsystem already supports:

- theme presets;
- accent presets and custom accent;
- contrast checks;
- density selection;
- motion preference;
- theme previews.

This is a good basis for a shared HMI design system.

## 2.4 Process analytics already exists

Process-oriented screens already calculate and display useful information including:

- makespan;
- P95 cycle time;
- throughput;
- average wait;
- batch fill;
- partial rate;
- reliability/risk metrics;
- timelines;
- batch cycles;
- resource utilization;
- bottlenecks;
- Monte Carlo and stochastic simulation outputs;
- compatibility and changeover information.

The next step is to link these facts to the topology and encode their meaning visually.

---

# 3. Primary weaknesses

## 3.1 Fragmented visual identity

The repository currently contains two broad UI families:

1. a tokenized dark/engineering Canvas UI using shared variables and Tailwind;
2. multiple process applications with large component-local `<style>` blocks, often using a light `#f6f8fb` / white-card / gray-border visual language.

Process Math, Simulation, Risk, Batch, Digital Twin, Reliability, Optimizer and Universal Process screens frequently define their own shells, headers, cards, tables and typography.

Consequences:

- duplicated design rules;
- inconsistent spacing and typography;
- inconsistent status semantics;
- theme support varies by screen;
- different responsive behavior;
- higher maintenance cost;
- the user experiences multiple tools rather than one system.

The existing `LabTraceWorkbench` is the correct architectural starting point for convergence.

## 3.2 Data display without sufficient semantic encoding

Many screens correctly expose metrics but present them as visually equivalent rectangles.

Example failure mode:

```text
Makespan | P95 | Throughput | Wait | Batch fill | Risk | Score | Status
```

When every item has similar area, contrast and typographic weight, the user must read all of them to find the important condition.

Required evolution:

```text
semantic fact
  -> importance / severity / confidence / activity / trend
  -> visual annotation
  -> renderer encoding
```

The system must visually distinguish:

- normal context;
- current bottleneck;
- critical path;
- elevated risk;
- uncertainty;
- active flow;
- changed state;
- inferred/estimated information;
- stale or missing data.

## 3.3 Weak overview-to-detail hierarchy

The Canvas HUD can simultaneously expose hierarchy, layout algorithm, router, execution time, bends, crossings and optimization actions. This is useful for engineering diagnostics but visually competes with the primary task.

The interface needs explicit progressive disclosure:

```text
Primary task context
  > operational state
    > selected entity details
      > engineering diagnostics
```

Advanced algorithmic diagnostics should live in an `Engineering HUD` / diagnostics layer rather than dominate the normal view.

## 3.4 Topology and simulation are insufficiently linked

Topology, timeline, resource utilization, Monte Carlo results and risk are currently mostly separate visual contexts.

A user should be able to select an entity once and see the same semantic entity highlighted across:

- topology;
- timeline;
- resource lanes;
- risk view;
- distributions;
- inspector;
- insight rail.

This requires a shared linked-selection and linked-filtering contract.

## 3.5 Missing semantic focus modes

Large graphs need task-oriented visual lenses.

Required focus modes include at minimum:

```text
Critical path
Bottlenecks
Risk
Queues
Failures
Rework
Resource pressure
Uncertainty
Changes / delta
```

A focus mode should increase figure-ground separation by emphasizing relevant entities and muting unrelated context while preserving the mental map.

## 3.6 Uncertainty is under-visualized

Stochastic and Monte Carlo modes should not reduce distributions to a single P95 number.

Required visual forms:

- distribution/histogram or density view;
- P50/P90/P95/P99 markers where meaningful;
- SLA/target markers;
- confidence/credible intervals where applicable;
- probability of threshold violation;
- scenario-to-scenario distribution delta.

## 3.7 What-if and optimization lack a first-class delta language

Optimization is most useful when the user immediately sees what changed.

A canonical compare mode should encode:

- baseline;
- candidate;
- absolute delta;
- relative delta;
- topology/resource changes;
- bottleneck migration;
- quality/risk trade-offs;
- affected entities.

The graph itself should support semantic diff overlays rather than requiring the user to compare two unrelated screens mentally.

## 3.8 Digital Twin is too report-like

A Digital Twin should expose temporal behavior, not only final statistics.

Required evolution:

- playback clock;
- play/pause/step;
- speed controls;
- event cursor;
- queue growth/decay;
- resource busy/idle transitions;
- job movement or path activity;
- failure/recovery events;
- rework feedback;
- synchronized timeline and topology.

Motion must encode events, not decoration.

## 3.9 Missing first-class insight/explanation surface

The system already computes enough information to answer questions such as:

- What is the bottleneck?
- Why did P95 increase?
- Which resource dominates waiting?
- What changed after adding one unit of capacity?
- Which assumption has low confidence?

These explanations should not be hidden in tables.

A canonical `Insight Rail` should summarize:

```text
finding
severity
affected entities
metric impact
reason/evidence
confidence
baseline/candidate delta
```

The insight layer must remain evidence-driven and must distinguish computed fact from heuristic interpretation.

---

# 4. Visual-semantic gap

The project already has a strong semantic layout program. However, graph composition and HMI visual semantics are different problems.

`VISUAL_COMPOSITION_CONTRACT.md` answers questions such as:

- where nodes should be placed;
- how the narrative path should flow;
- how branches/merges should be composed;
- how ports should be assigned;
- how whitespace and hierarchy should improve readability.

The new HMI layer must answer:

- which state is important now;
- what should be visually emphasized;
- how risk, uncertainty, activity and confidence are encoded;
- how multiple analytical views coordinate;
- how a baseline differs from a candidate;
- how temporal events are played back;
- what explanation should accompany the visualization.

These responsibilities must not be merged into one algorithm.

---

# 5. Canonical visual channels

The UI needs a controlled visual grammar rather than per-screen ad hoc styling.

Recommended default mapping:

| Visual channel | Primary semantic meaning |
|---|---|
| hue | entity/type/category |
| saturation | severity / semantic emphasis |
| luminance/contrast | foreground importance / activity, with accessibility constraints |
| stroke width | load / intensity / throughput where quantitative mapping is valid |
| opacity | confidence / contextual de-emphasis; never sole carrier of critical state |
| dash/pattern | estimated, hypothetical, unavailable or non-primary relation |
| halo/glow | active hotspot / selected / current event; not persistent decoration |
| size | semantic importance only when geometry distortion is acceptable |
| motion | event/change/flow only |
| icon/shape | redundant categorical or status cue |

No critical meaning may rely on hue alone.

---

# 6. Target workspace

The target AutoTraceLab workspace should converge toward:

```text
+------------------------------------------------------------------+
| LabTrace Header                         Scenario | Run | Compare   |
+-------------+----------------------------------------------------+
|             | Toolbar / Lens / Time / View controls             |
| Navigator   +----------------------------------------------------+
| Layers      |                                                    |
| Scenarios   |                Topology / Canvas                   |
| Filters     |                                                    |
|             |                                                    |
+-------------+----------------------------------------------------+
|             Linked Timeline / Resource Lanes / Distribution      |
+---------------------------------------------+--------------------+
| Context / status                            | Insight Rail       |
+---------------------------------------------+--------------------+
```

This is not a fixed desktop-only layout. On narrow screens the same zones must become drawers/sheets/tabs while preserving semantic state.

---

# 7. Canonical visualization primitives

AutoTraceLab should standardize a small set of reusable analytical primitives:

1. `TopologyView` — causal/structural graph.
2. `TimelineView` — operation/job temporal sequence.
3. `ResourceLaneView` — capacity and occupancy over time.
4. `FlowView` — workload/quantity flow when Sankey-like encoding is semantically valid.
5. `HeatmapOverlay` — risk/utilization/queue/uncertainty mapped onto topology.
6. `DistributionView` — stochastic output and threshold probability.
7. `CompareView` — baseline/candidate and delta.
8. `InsightRail` — evidence-backed explanations.
9. `PlaybackControls` — temporal Digital Twin navigation.
10. `VisualLegend` — active semantic encoding and scale.

The goal is not to maximize the number of charts. New visualization types require a distinct user question they answer better than existing primitives.

---

# 8. Priority changes

Highest leverage order:

1. unify shells through LabTrace;
2. define Visual Semantics contract and shared view state;
3. add semantic overlays/focus lenses to Canvas;
4. link topology, timeline and resource lanes;
5. add first-class uncertainty/distribution visualization;
6. add baseline/what-if comparison;
7. add Insight Rail and explanation/provenance;
8. add Digital Twin playback and meaningful motion;
9. migrate remaining process screens from local CSS to shared primitives;
10. harden accessibility, mobile behavior, visual regression and performance.

---

# 9. UX acceptance metrics

The redesign should be measured as an engineering change, not judged only by aesthetic preference.

Representative task metrics:

- time to identify bottleneck;
- error rate identifying critical path;
- time to locate highest-risk entity;
- time to explain why P95 changed;
- time to compare baseline and what-if;
- time to locate an active failure during playback;
- cross-view selection consistency errors;
- number of visual states requiring legend lookup;
- mobile task completion rate;
- keyboard-only task completion rate.

Human testing should separately collect:

- comprehension;
- confidence;
- visual comfort;
- aesthetic preference.

A prettier screen that slows comprehension is a regression.

---

# 10. Current qualitative baseline

Approximate audit baseline, intended only to prioritize engineering effort:

| Area | Baseline |
|---|---:|
| functional richness | 9/10 |
| canvas/editor mechanics | 8.5/10 |
| theme infrastructure | 8/10 |
| information density | 8/10 |
| visual hierarchy | 6/10 |
| cross-screen consistency | 4.5/10 |
| semantic visualization | 5/10 |
| cause-effect visualization | 3.5/10 |
| scenario comparison | 4/10 |
| visual storytelling / explanation | 3/10 |
| unified-product feel | 5/10 |

These values are not release metrics. MP41 must replace them with reproducible baseline tasks and screenshots/fixtures.

---

# 11. Audit conclusion

AutoTraceLab should not pursue a cosmetic redesign as the primary solution.

The correct product evolution is:

```text
engineering data
  -> semantic facts
  -> visual semantics
  -> coordinated views
  -> focus + comparison + explanation
  -> accessible renderer presentation
```

The target is not a more decorative dashboard.

> **The target is a visual reasoning system in which the state, flow, uncertainty, risk and cause of change are visible before the user has to inspect raw numbers.**
