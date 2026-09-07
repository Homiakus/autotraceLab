# AutoTraceLab — Visual Semantics & HMI Implementation Plan

Status: **normative detailed execution plan for WS-L / MP41–MP50**  
Scope: unified LabTrace shell, visual-semantic contracts, linked views, focus lenses, uncertainty, comparison, Insight Rail, Digital Twin playback, accessibility, migration and rollout.  
Authority: subordinate to `MASTER_IMPLEMENTATION_PLAN.md`; detailed HMI semantics are defined in `VISUAL_SEMANTICS_HMI_CONTRACT.md`.

---

# 1. Program objective

The goal of WS-L is to turn AutoTraceLab from a set of capable but visually fragmented engineering screens into a coherent visual reasoning environment.

Target pipeline:

```text
canonical process/graph facts
  -> visual-semantic annotations
  -> shared linked-view state
  -> LabTrace visualization primitives
  -> focus / compare / playback / explanation
  -> accessible theme-aware renderer
```

The program must preserve the existing mathematical and architectural boundaries:

- no React/DOM dependency in Go Core;
- no duplicate domain mathematics in UI;
- no UI-only reinterpretation of canonical metrics;
- no visualization that silently mutates the process model;
- no cosmetic redesign that outranks comprehension.

---

# 2. Relationship to WS-K / MP21–MP40

WS-K optimizes **how a graph is geometrically explained**.

WS-L optimizes **how the state and analysis of that graph/process are presented to a human across the whole interface**.

The programs are coupled but independent enough for parallel execution.

Dependencies:

```text
MP21 schema discipline
  -> MP41 HMI baseline/contracts

MP25 semantic importance ------------+
MP37 quality/readability metrics -----+--> MP43 richer visual semantics
MP38 diagnostics/explainability ------+

MP41 -> MP42 unified shell
MP41 -> MP43 visual-semantic compiler
MP42 + MP43 -> MP44 Canvas lenses
MP42 + MP43 -> MP45 linked views
MP43 + stochastic results -> MP46 uncertainty/compare
MP43 + diagnostics -> MP47 Insight Rail
MP45 + event history -> MP48 playback
MP42..MP48 -> MP49 hardening/migration
MP49 -> MP50 rollout/default gate
```

WS-L does not need to wait for MP40 before prototyping or migrating screens. However, HMI features that expose semantic-layout-specific diagnostics must gracefully handle older/fallback layout modes.

---

# 3. Milestone overview

| Milestone | Result | Status |
|---|---|---|
| MP41 | HMI contract + measurable baseline | PLANNED |
| MP42 | Unified LabTrace shell + shared design primitives | PLANNED |
| MP43 | Visual Semantics compiler + encoding grammar | PLANNED |
| MP44 | Canvas semantic overlays + focus/lens system | PLANNED |
| MP45 | Linked topology/timeline/resource views | PLANNED |
| MP46 | Uncertainty/distribution + baseline/what-if comparison | PLANNED |
| MP47 | Insight Rail + evidence/provenance interaction | PLANNED |
| MP48 | Digital Twin playback + motion semantics | PLANNED |
| MP49 | Migration, accessibility, responsive, performance, regression | PLANNED |
| MP50 | HMI rollout/default gate | PLANNED |

---

# 4. MP41 — HMI contract and baseline [BLOCKING]

## Purpose

Freeze what currently exists and define the new presentation boundary before migrating UI.

## Tasks

- [ ] approve `VISUAL_SEMANTICS_HMI_CONTRACT.md`;
- [ ] preserve `UI_VISUAL_AUDIT.md` as current-state baseline;
- [ ] define version constants for visual semantics/view state;
- [ ] define `VisualSemanticFact`;
- [ ] define `VisualAnnotation`;
- [ ] define `VisualRole` and trend/status enums;
- [ ] define `LinkedViewState`;
- [ ] define `ScenarioDelta`;
- [ ] define `InsightItem`;
- [ ] define `PlaybackSemanticState`;
- [ ] define presentation-state versioning separate from domain model schemas;
- [ ] inventory every current process screen and its local CSS/shell primitives;
- [ ] capture desktop/tablet/mobile screenshots for current baseline;
- [ ] define representative human tasks and baseline timing/error protocol;
- [ ] define visual regression fixture set;
- [ ] record current bundle/runtime interaction baseline.

## Required baseline tasks

```text
identify bottleneck
identify critical path
find highest-risk stage
find resource with highest waiting contribution
interpret SLA miss probability
compare baseline vs what-if
locate active failure/rework event
```

## Exit gate

- contracts compile/round-trip where shared across packages;
- no domain behavior changes;
- baseline screenshots reproducible;
- baseline task protocol documented;
- every existing process view mapped to future LabTrace zones/primitives;
- no unresolved ownership ambiguity between Core, Visual Semantics and Renderer.

---

# 5. MP42 — Unified LabTrace shell and shared visual primitives [BLOCKING]

## Purpose

Remove the architectural cause of visual fragmentation before adding more analytical views.

## Tasks

- [ ] promote `LabTraceWorkbench` to canonical analytical shell;
- [ ] define stable zones: header/sidebar/command bar/workspace/secondary pane/inspector/insight rail/overlays/status;
- [ ] add responsive zone policy;
- [ ] create common spacing/type/radius/elevation scales;
- [ ] unify semantic status tokens;
- [ ] define chart/visualization palette tokens distinct from arbitrary domain colors;
- [ ] implement common primitives:
  - [ ] `MetricCard`;
  - [ ] `MetricDelta`;
  - [ ] `MetricThreshold`;
  - [ ] `SeverityBadge`;
  - [ ] `ConfidenceBadge`;
  - [ ] `EntityChip`;
  - [ ] `VisualLegend`;
  - [ ] `EmptyState`;
  - [ ] `ErrorState`;
  - [ ] `LoadingState`;
  - [ ] `EngineeringHUD`;
- [ ] define shared panel/drawer/sheet behavior;
- [ ] define keyboard command surface;
- [ ] define touch target minimums and mobile drawer behavior;
- [ ] add a compatibility adapter so existing screens can migrate incrementally;
- [ ] forbid new screen-global visual languages in review rules.

## Shell acceptance

All migrated screens must support:

```text
light/dark/theme tokens
shared density
shared status semantics
keyboard focus
mobile rearrangement
persistent selection/scenario context
```

## Exit gate

- at least one representative process screen runs entirely inside LabTrace shell;
- no duplicate top-level header/shell in that screen;
- theme switching works through shared tokens;
- narrow-screen zone rearrangement works without loss of context;
- shared primitives have unit/story/fixture coverage appropriate to project tooling.

---

# 6. MP43 — Visual Semantics compiler and encoding grammar [BLOCKING]

## Purpose

Create the semantic bridge between engineering facts and renderer emphasis.

## Tasks

- [ ] implement visual-semantic annotation types;
- [ ] define compiler inputs by revision/result ID;
- [ ] derive role/importance/severity/confidence/activity/trend without DOM access;
- [ ] preserve reason/evidence IDs;
- [ ] define deterministic conflict precedence for multiple annotations on one entity;
- [ ] define scale normalization/clamping contracts;
- [ ] distinguish missing/zero/unknown/estimated/hypothetical;
- [ ] define objective-aware better/worse direction;
- [ ] implement renderer mapping profile for visual channels;
- [ ] ensure critical states have non-color redundancy;
- [ ] add legend metadata to every continuous/multistate encoding;
- [ ] implement annotation caching by semantic revision;
- [ ] index entity-to-fact/insight/run/resource relationships;
- [ ] expose provenance lookup;
- [ ] add grayscale/CVD semantic tests.

## Conflict precedence example

Presentation conflicts should be resolved explicitly, e.g.:

```text
active failure
  > selected/focused
  > critical/bottleneck
  > warning/risk
  > changed
  > normal/context
```

This precedence affects emphasis only; it does not destroy lower-priority semantic facts.

## Exit gate

- same facts produce deterministic annotations;
- no critical meaning is hue-only;
- annotations link back to reasons/evidence;
- lens changes do not mutate canonical process/layout state;
- missing and zero are visually/semantically distinct;
- scale normalization is documented and tested.

---

# 7. MP44 — Canvas semantic overlays and focus/lens system

## Purpose

Make the existing strong DiagramCanvas visually explain operational meaning.

## Required lenses

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

## Tasks

- [ ] add lens registry/API;
- [ ] add semantic overlay layer separate from base node/edge rendering;
- [ ] add context de-emphasis policy;
- [ ] add active lens legend;
- [ ] add quantitative heat scale support;
- [ ] add critical-path emphasis;
- [ ] add bottleneck emphasis with contribution/usage reason;
- [ ] add risk/uncertainty overlays;
- [ ] add queue/resource-pressure overlay;
- [ ] add failure/rework path overlay;
- [ ] add compare/delta overlay;
- [ ] keep canonical positions unchanged when lenses change;
- [ ] preserve selection while switching lenses;
- [ ] support keyboard/touch lens controls;
- [ ] move existing layout/router/bend/crossing metadata behind `EngineeringHUD` by default;
- [ ] provide tooltip/inspector provenance for visual emphasis.

## Exit gate

- lens switching causes zero graph re-layout unless separately requested;
- figure-ground separation improves target-task time on pilot fixtures;
- unrelated context remains available;
- no lens hides a Tier-0 error state;
- lens semantics survive grayscale/CVD profiles.

---

# 8. MP45 — Linked topology, timeline and resource views

## Purpose

Turn separate representations into coordinated views of one semantic model.

## Tasks

- [ ] implement shared `LinkedViewState` store/controller;
- [ ] define stable entity IDs across topology/simulation/resource records;
- [ ] extract shared `TimelineView` primitive;
- [ ] extract shared `ResourceLaneView` primitive;
- [ ] support selection propagation topology -> timeline/resource;
- [ ] support selection propagation resource/timeline -> topology;
- [ ] support hover preview without excessive recomputation;
- [ ] support time-window brushing;
- [ ] support scenario filter propagation;
- [ ] support active lens propagation;
- [ ] preserve view state across panel collapse/responsive rearrangement;
- [ ] virtualize long timelines/resource lists;
- [ ] add combined bottleneck workflow;
- [ ] add combined queue/wait workflow;
- [ ] add synchronized inspector state.

## Exit gate

Representative workflow:

```text
select bottleneck node
  -> corresponding resource lane highlights
  -> relevant timeline runs highlight
  -> inspector shows exact values
  -> Insight Rail can explain reason
```

must work with one semantic selection, not per-view manual synchronization.

---

# 9. MP46 — Uncertainty/distribution and scenario comparison

## Purpose

Make stochastic behavior and optimization trade-offs visible rather than reducing them to flat KPI cards.

## Distribution tasks

- [ ] shared `DistributionView`;
- [ ] histogram/density representation;
- [ ] P50/P90/P95/P99 markers where available;
- [ ] SLA/threshold marker;
- [ ] violation probability;
- [ ] sample count/seed/model context;
- [ ] baseline/candidate overlay or small-multiple mode;
- [ ] uncertainty/confidence distinction;
- [ ] scalable rendering for large sample sets.

## Comparison tasks

- [ ] shared `CompareView`;
- [ ] absolute/relative deltas;
- [ ] objective-aware better/worse classification;
- [ ] KPI delta components;
- [ ] topology diff overlay classes;
- [ ] resource additions/removals/capacity changes;
- [ ] bottleneck migration;
- [ ] risk/uncertainty delta;
- [ ] affected-entity navigation;
- [ ] scale-compatibility warning/normalization labeling;
- [ ] before/after summary suitable for export.

## Exit gate

A user can answer without manually comparing screens:

- did the scenario improve the target objective?;
- what trade-off worsened?;
- where did the bottleneck move?;
- how did the distribution/SLA probability change?;
- which entities caused the delta?

---

# 10. MP47 — Insight Rail and evidence/provenance interaction

## Purpose

Expose computed explanation as a first-class part of the visual system.

## Tasks

- [ ] implement `InsightItem` contract;
- [ ] implement `InsightRail` shared primitive;
- [ ] rank/deduplicate insights;
- [ ] link insight -> entities;
- [ ] link insight -> metrics;
- [ ] link insight -> evidence/provenance;
- [ ] distinguish `computed`, `diagnostic`, `heuristic`;
- [ ] show confidence when materially relevant;
- [ ] support baseline/candidate deltas;
- [ ] allow insight selection to set focus/selection;
- [ ] expose “why highlighted?” from Canvas/inspector;
- [ ] map MP38 layout diagnostics into Engineering HUD/inspector where relevant;
- [ ] prevent unsupported causal wording;
- [ ] define empty/no-significant-insight state.

## Initial insight families

```text
Bottleneck
Risk
Opportunity / capacity what-if
SLA miss
Failure
Rework hotspot
Queue concentration
Uncertainty / weak evidence
Scenario change
Engineering diagnostic
```

## Exit gate

Every high-severity insight can answer:

```text
what happened?
where?
why is the system saying this?
what metric/evidence supports it?
how confident is it when confidence matters?
```

---

# 11. MP48 — Digital Twin playback and motion semantics

## Purpose

Make Digital Twin temporally explorable rather than only a post-simulation report.

## Tasks

- [ ] canonical playback clock/controller;
- [ ] play/pause/reset;
- [ ] speed controls;
- [ ] event stepping;
- [ ] timeline scrubber;
- [ ] synchronized topology cursor;
- [ ] active job/operation emphasis;
- [ ] queue growth/decay representation;
- [ ] resource busy/idle transitions;
- [ ] failure/recovery events;
- [ ] rework feedback events;
- [ ] batch open/close events;
- [ ] active path/flow motion;
- [ ] event detail inspector;
- [ ] reduced-motion static equivalent;
- [ ] bounded frame/update work;
- [ ] deterministic playback from deterministic event history.

## Motion rules

Allowed:

```text
event transition
flow progression
selection/focus transition
state change
```

Not allowed:

```text
permanent decorative pulses
unrelated floating effects
continuous glow merely to appear active
animation that obscures exact state
```

## Exit gate

- topology and timeline stay time-synchronized;
- current event is inspectable;
- reduced-motion mode conveys identical semantic state;
- playback remains responsive on approved long-history fixtures;
- pausing yields a stable deterministic visual state.

---

# 12. MP49 — Migration, accessibility, responsive behavior, performance and regression

## Purpose

Converge all major product screens and prove the new system is robust.

## Migration order

Recommended sequence:

```text
1. Universal Process Lab
2. Process Math
3. Simulation
4. Risk / Monte Carlo
5. Batch
6. Digital Twin
7. Reliability
8. Optimizer
9. LBC-specific atlas/workbenches
10. remaining legacy/reference screens or explicit deprecation
```

For each screen:

- [ ] move to LabTrace shell;
- [ ] replace local status colors with shared semantic tokens;
- [ ] replace duplicated KPI cards/tables with shared primitives where appropriate;
- [ ] remove component-global CSS that duplicates shared shell/design rules;
- [ ] preserve domain-specific content only;
- [ ] add linked selection where semantic IDs exist;
- [ ] add accessibility labels/summary;
- [ ] add responsive fixture;
- [ ] add screenshot regression fixture;
- [ ] compare task completion with baseline.

## Accessibility hardening

- [ ] keyboard paths;
- [ ] visible focus;
- [ ] reduced motion;
- [ ] CVD profiles;
- [ ] grayscale;
- [ ] high contrast;
- [ ] text scaling;
- [ ] screen-reader summaries for critical visual findings;
- [ ] touch targets;
- [ ] non-color redundancy audit.

## Performance hardening

- [ ] large graph + overlays benchmark;
- [ ] 10k+ run timeline benchmark where representative;
- [ ] long simulation playback benchmark;
- [ ] annotation compiler profiling;
- [ ] linked-hover propagation profiling;
- [ ] distribution decimation/aggregation benchmark;
- [ ] memory retention/leak checks for scenario switching;
- [ ] mobile performance profile.

## Exit gate

- major active process screens share one shell/design language;
- no blocker accessibility regressions;
- target performance budgets met;
- visual regression corpus stable;
- migration does not change canonical simulation/math results;
- representative human tasks show no material comprehension regression.

---

# 13. MP50 — HMI rollout and default gate

## Stages

```text
H0 hidden/internal primitives
H1 developer opt-in LabTrace shell
H2 selected process screen migration
H3 semantic overlays + linked views opt-in
H4 new HMI default for selected workflows
H5 default for active process applications
H6 remove obsolete duplicate shell/style paths after release history
```

## Default gate

1. MP41 contracts/baseline complete;
2. LabTrace shell stable on supported viewport classes;
3. visual-semantic annotations deterministic for canonical facts;
4. non-color redundancy/CVD/grayscale gates pass;
5. linked view state has no blocker consistency defects;
6. stochastic views expose distribution/threshold meaning where required;
7. comparison accurately represents objective-aware delta;
8. Insight Rail preserves evidence/provenance distinction;
9. playback/reduced-motion parity passes;
10. migrated screens preserve canonical model/simulation outputs;
11. performance inside approved budgets;
12. visual regression corpus reviewed;
13. human task evaluation shows target comprehension gains or clear Pareto improvement;
14. release history contains no blocker navigation/accessibility regressions.

## Rollback/fallback

The HMI must support feature-level rollback without changing Core mathematics:

```text
new linked visualization
  -> LabTrace static visualization
  -> legacy/reference presentation if still supported
```

No rollback path may require changing canonical simulation results.

---

# 14. Atomic waves S–V

WS-L work should be kept in atomic, testable slices.

## Wave S — contract and shell

S01 current UI inventory.  
S02 screenshot/task baseline.  
S03 VisualSemanticFact contract.  
S04 VisualAnnotation contract.  
S05 LinkedViewState contract.  
S06 presentation-state versioning.  
S07 LabTrace stable zones.  
S08 shared token scale.  
S09 shared metric/status primitives.  
S10 Engineering HUD separation.

## Wave T — semantic Canvas and linked analytics

T01 annotation compiler.  
T02 visual channel mapping.  
T03 legend metadata.  
T04 Canvas overlay layer.  
T05 focus lens registry.  
T06 critical/bottleneck lenses.  
T07 risk/queue/uncertainty lenses.  
T08 TimelineView extraction.  
T09 ResourceLaneView extraction.  
T10 linked selection/time brushing.

## Wave U — uncertainty, compare, explain and playback

U01 DistributionView.  
U02 percentile/SLA markers.  
U03 ScenarioDelta compiler.  
U04 CompareView.  
U05 topology semantic diff.  
U06 InsightItem compiler.  
U07 InsightRail.  
U08 provenance drill-down.  
U09 playback clock/events.  
U10 reduced-motion parity.

## Wave V — migration and rollout

V01 Universal Process Lab migration.  
V02 Process Math migration.  
V03 Simulation migration.  
V04 Risk/Batch migration.  
V05 Digital Twin migration.  
V06 Reliability/Optimizer migration.  
V07 accessibility/CVD/mobile gates.  
V08 performance/visual regression gates.  
V09 human task evaluation.  
V10 default switch + legacy cleanup gate.

---

# 15. CI and review policy

A PR touching WS-L behavior should state, where relevant:

- affected visual-semantic contract;
- affected shared primitive;
- presentation-state compatibility;
- canonical domain/math impact (`none` expected for most UI changes);
- accessibility impact;
- visual regression impact;
- responsive impact;
- performance impact;
- linked-selection behavior;
- evidence/provenance behavior;
- baseline task impact for large UX changes.

Required CI families as they become available:

| Gate | Policy |
|---|---|
| frontend typecheck/tests/build | required |
| visual semantic contract tests | required |
| shared primitive tests | required |
| deterministic annotation fixtures | required |
| screenshot regression | required for affected views |
| keyboard/accessibility checks | required |
| grayscale/CVD semantic checks | required for status/lens changes |
| mobile viewport fixtures | required for shell changes |
| canonical process result parity | required for migrated process apps |
| performance benchmark | gated for heavy visualization changes |

---

# 16. Human evaluation protocol

Do not measure only preference.

For representative users/tasks record:

```text
time to correct answer
error rate
confidence
interaction count
subjective comprehension
separate aesthetic preference
```

A/B targets:

- current screen vs unified LabTrace screen;
- flat KPI presentation vs semantic hierarchy;
- unlinked vs linked topology/timeline/resource;
- P95-only vs distribution+threshold;
- manual comparison vs CompareView;
- static Twin report vs synchronized playback for temporal questions.

The program should optimize task comprehension, not novelty.

---

# 17. Risks and controls

## Risk: over-encoding

Too many simultaneous channels can make the scene harder to read.

Control:

- one dominant lens at a time;
- explicit legend;
- limited persistent semantic channels;
- user task testing.

## Risk: semantic/style coupling

UI code may begin recomputing domain meaning.

Control:

- facts/annotations contract;
- provenance IDs;
- canonical metrics remain upstream;
- parity tests during migration.

## Risk: dashboard sprawl

Adding every chart could reduce clarity.

Control:

- canonical primitive list;
- every new view must answer a distinct user question;
- progressive disclosure.

## Risk: animation overload

Control:

- event-only motion;
- reduced-motion parity;
- playback pause yields stable state.

## Risk: local CSS regression

Control:

- shared shell/primitives first;
- review rule against new independent global visual languages;
- staged migration.

## Risk: large-scene performance

Control:

- incremental annotation compiler;
- relation indexes;
- virtualization;
- bounded hover/playback updates;
- benchmark gates.

---

# 18. Definition of Done — WS-L

WS-L is complete only when all are true:

1. `VISUAL_SEMANTICS_HMI_CONTRACT.md` is implemented, not aspirational only.
2. LabTrace is the canonical shell for active analytical workbenches.
3. Shared design/visualization primitives replace duplicated shell-level implementations.
4. Visual semantic annotations are renderer-neutral and evidence-linked.
5. Focus lenses exist for critical path, bottlenecks, risk, queues, failures, rework, resource pressure, uncertainty and changes.
6. Lenses preserve canonical geometry/mental map.
7. Topology, timeline and resource lanes are linked.
8. Stochastic results expose distribution and threshold probability.
9. Baseline/what-if comparison is first-class and objective-aware.
10. Insight Rail explains major findings with provenance/confidence where relevant.
11. Digital Twin supports synchronized playback.
12. Motion encodes events and has reduced-motion parity.
13. Engineering HUD diagnostics no longer compete with normal operational hierarchy.
14. Major process screens share one visual language.
15. Accessibility/CVD/grayscale/mobile gates pass.
16. Large-scene and long-history performance is inside approved budgets.
17. Visual regression corpus is maintained.
18. Human task evaluation shows no material comprehension regression and measurable gains on target tasks.
19. UI migration changes no canonical mathematical/simulation result unless separately approved as a domain change.
20. MP50 rollout/default gate is passed before legacy shell/style paths are removed.

---

# 19. Immediate execution queue

After this documentation wave, recommended first implementation sequence is:

1. MP41 contracts and baseline screenshot/task fixtures.
2. Promote `LabTraceWorkbench` zones and shared presentation state.
3. Extract shared metric/status primitives.
4. Add Engineering HUD progressive disclosure.
5. Implement `VisualAnnotation` compiler for existing process metrics.
6. Add Canvas bottleneck/critical/risk lenses.
7. Extract existing timeline into shared `TimelineView`.
8. Build shared `ResourceLaneView` and linked selection.
9. Add `DistributionView` for risk/Digital Twin results.
10. Add first baseline/what-if `CompareView`.
11. Add structured `InsightRail`.
12. Add synchronized Digital Twin playback.
13. Migrate Universal Process Lab as reference vertical slice.
14. Migrate Simulation/Risk/Batch/Digital Twin.
15. Run accessibility/performance/human-task gates before default switch.

---

# 20. Final engineering rule

> **The HMI must make the system easier to understand before it makes the system more visually impressive.**
