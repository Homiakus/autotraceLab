# AutoTraceLab — Visual Semantics & HMI Implementation Plan

Status: **normative detailed execution plan for WS-L / MP41–MP50**  
Scope: unified LabTrace shell, visual-semantic contracts, linked views, focus lenses, multidomain projection integration, uncertainty, comparison, Insight Rail, Digital Twin playback, accessibility, migration and rollout.  
Authority: subordinate to `MASTER_IMPLEMENTATION_PLAN.md`; HMI semantics are defined in `VISUAL_SEMANTICS_HMI_CONTRACT.md`; entity/facet/projection semantics are defined in `SEMANTIC_PROJECTION_SPACE_CONTRACT.md`.

---

# 1. Program objective

WS-L turns AutoTraceLab from visually fragmented engineering screens into one coherent visual reasoning environment.

```text
canonical process/graph facts
  -> optional ProjectionResult
  -> visual-semantic annotations
  -> shared LinkedViewState
  -> LabTrace visualization primitives
  -> focus / projection / compare / playback / explanation
  -> accessible theme-aware 2D/2.5D renderer
```

WS-L must not duplicate domain mathematics, projection algebra or entity identity logic in UI code.

---

# 2. Relationship to WS-K / WS-M

WS-K answers **where graph geometry goes and how it remains readable/stable**.

WS-L answers **how system state/analysis is visually presented and coordinated**.

WS-M answers **which multidimensional semantic slice/facets/relations exist in a projection**.

```text
MP21 schema discipline
  +--> MP41 HMI baseline/contracts
  |      -> MP42 LabTrace shell
  |      -> MP43 Visual Semantics compiler
  |
  +--> MP51 projection baseline/contracts
         -> MP52 Entity/Facet/Dimension identity
         -> MP53 relation semantics
         -> MP54 projection algebra

MP42 + MP43 ----------------------> MP44 lenses
MP42 + MP43 + MP52 --------------> MP45 linked views on stable IDs
MP43 + MP46-compatible facts ----> MP46 uncertainty/compare
MP43 + diagnostics --------------> MP47 Insight Rail
MP45 + playback history ---------> MP48 playback
MP54 + MP45 ---------------------> MP58 multidomain slice/diff HMI
MP48 + MP53/54 ------------------> MP59 cross-domain Twin
```

Important implementation rule:

> MP45 must not freeze a long-lived linked-view ID contract around temporary screen-local IDs. Prefer MP52 `SemanticEntity`/`EntityFacet` identity; if MP45 prototypes earlier, isolate it behind a compatibility adapter and migrate before MP49.

WS-L default rollout MP50 is not globally blocked by WS-M, but any multidomain projection/2.5D capability exposed as default is separately gated by MP60.

---

# 3. Milestone overview

| Milestone | Result | Status |
|---|---|---|
| MP41 | HMI contract + measurable baseline | PLANNED |
| MP42 | Unified LabTrace shell + shared primitives | PLANNED |
| MP43 | Visual Semantics compiler + encoding grammar | PLANNED |
| MP44 | Canvas semantic overlays + focus/lens system | PLANNED |
| MP45 | Linked topology/timeline/resource/projection state | PLANNED |
| MP46 | Uncertainty/distribution + comparison | PLANNED |
| MP47 | Insight Rail + evidence/provenance | PLANNED |
| MP48 | Digital Twin playback + motion semantics | PLANNED |
| MP49 | Migration/accessibility/responsive/performance/regression | PLANNED |
| MP50 | HMI rollout/default gate | PLANNED |

---

# 4. MP41 — HMI contract and baseline [BLOCKING]

- [ ] approve `VISUAL_SEMANTICS_HMI_CONTRACT.md`;
- [ ] preserve `UI_VISUAL_AUDIT.md` as current-state baseline;
- [ ] register `SEMANTIC_PROJECTION_SPACE_CONTRACT.md` as a peer contract, without duplicating it;
- [ ] version VisualSemanticFact/VisualAnnotation/LinkedViewState/ScenarioDelta/InsightItem/PlaybackSemanticState;
- [ ] reserve `ProjectionViewState` integration point;
- [ ] inventory current screen-local IDs and identify which can map to future SemanticEntity IDs;
- [ ] inventory current process shells/local CSS;
- [ ] capture desktop/tablet/mobile screenshots;
- [ ] define human-task baseline;
- [ ] define visual regression fixture set;
- [ ] record current bundle/runtime interaction baseline.

Required tasks:

```text
identify bottleneck
identify critical path
find highest-risk stage
find resource with highest waiting contribution
interpret SLA miss probability
compare baseline vs what-if
locate active failure/rework event
```

Additional multidomain baseline tasks, when fixtures exist:

```text
identify same entity across domain views
find shared electrical/hydraulic entity
trace a cross-domain dependency
```

Exit: presentation/domain/projection ownership unambiguous; current behavior reproducible; no long-lived screen-local ID assumption enters shared contracts.

---

# 5. MP42 — Unified LabTrace shell and shared visual primitives [BLOCKING]

- [ ] promote `LabTraceWorkbench` to canonical shell;
- [ ] stable zones: header/sidebar/command bar/projection+view controls/workspace/secondary pane/inspector/insight rail/overlays/status;
- [ ] responsive zone policy;
- [ ] centralized spacing/type/radius/elevation/status/chart tokens;
- [ ] shared metric/status/legend/empty/error/loading/EngineeringHUD primitives;
- [ ] reserve shared `ProjectionControls` slot without implementing projection algebra locally;
- [ ] shared panel/drawer/sheet behavior;
- [ ] keyboard command surface;
- [ ] touch target/mobile drawer policy;
- [ ] compatibility adapter for incremental screen migration;
- [ ] review rule forbidding new independent shell/visual languages.

Exit: one representative process screen fully uses LabTrace shell; no duplicate global header/shell; themes and responsive zones work; projection controls can be plugged in without shell redesign.

---

# 6. MP43 — Visual Semantics compiler and encoding grammar [BLOCKING]

- [ ] visual-semantic annotation types;
- [ ] compiler inputs by revision/result ID;
- [ ] entity-level and optional facet-level annotation scope;
- [ ] role/importance/severity/confidence/activity/trend derivation without DOM access;
- [ ] reason/evidence/relation IDs;
- [ ] deterministic conflict precedence;
- [ ] normalization/clamping contracts;
- [ ] missing/zero/unknown/estimated/hypothetical distinction;
- [ ] objective-aware better/worse;
- [ ] renderer channel mapping profile;
- [ ] non-color and future non-depth redundancy;
- [ ] legend metadata;
- [ ] revision cache/indexes;
- [ ] provenance lookup;
- [ ] grayscale/CVD tests;
- [ ] `cross-domain-bridge` role adapter for MP55 facts when available.

Default emphasis precedence may be:

```text
active failure
  > selected/focused
  > critical/bottleneck
  > warning/risk
  > cross-domain bridge/change
  > normal/context
```

Precedence affects emphasis only; lower-priority facts remain inspectable.

Exit: deterministic accessible annotations; no critical meaning hue-only; no projection membership calculation in compiler.

---

# 7. MP44 — Canvas semantic overlays and focus/lens system

Required lenses:

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
CrossDomainCoupling (enabled when MP55 facts exist)
```

- [ ] lens registry/API;
- [ ] semantic overlay layer separate from base geometry;
- [ ] context de-emphasis;
- [ ] active lens legend;
- [ ] quantitative heat scales;
- [ ] critical/bottleneck/risk/queue/failure/rework/change overlays;
- [ ] compare/delta overlay;
- [ ] cross-domain coupling overlay adapter;
- [ ] lens switching changes zero canonical positions;
- [ ] lens switching changes zero ProjectionResult membership;
- [ ] preserve selection/projection/time state;
- [ ] keyboard/touch controls;
- [ ] EngineeringHUD separation;
- [ ] provenance drill-down.

Exit: target state faster to locate; unrelated context retained; lens semantics survive grayscale/CVD; lens/projection orthogonality tests pass where MP54 exists.

---

# 8. MP45 — Linked topology, timeline, resource and projection state [BLOCKING FOR SHARED ID MODEL]

- [ ] shared `LinkedViewState` controller;
- [ ] integrate `ProjectionViewState` field;
- [ ] stable entity IDs across topology/simulation/resources;
- [ ] stable facet IDs where applicable;
- [ ] consume MP52 identity contract or compatibility adapter with explicit migration deadline;
- [ ] shared `TimelineView`;
- [ ] shared `ResourceLaneView`;
- [ ] entity selection propagation across views;
- [ ] optional facet selection with entity fallback;
- [ ] hover preview without global scans;
- [ ] time-window brushing;
- [ ] scenario/lens/projection propagation;
- [ ] preserve selection across projection/viewpoint changes;
- [ ] preserve state across responsive rearrangement;
- [ ] virtualization/indexing;
- [ ] synchronized inspector.

Reference workflow:

```text
select Pump P1 in hydraulic facet
  -> SemanticEntity P1 selected
  -> electrical/mechanical facet instances highlight
  -> relevant resource lane + timeline records highlight
  -> inspector keeps selected facet detail
  -> Insight Rail uses same entity/facet/evidence IDs
```

Exit: one semantic selection drives all relevant views; no durable screen-local-ID coupling remains before MP49.

---

# 9. MP46 — Uncertainty/distribution and scenario comparison

Distribution:

- [ ] shared DistributionView;
- [ ] histogram/density;
- [ ] P50/P90/P95/P99 as available;
- [ ] SLA/threshold marker;
- [ ] violation probability;
- [ ] sample/seed/model context;
- [ ] baseline/candidate overlay/small multiples;
- [ ] uncertainty/confidence distinction;
- [ ] scalable rendering;
- [ ] projection/slice scope labeling when data population changes.

Comparison:

- [ ] shared CompareView;
- [ ] absolute/relative/objective-aware deltas;
- [ ] KPI delta components;
- [ ] topology/resource diff;
- [ ] bottleneck migration;
- [ ] risk/uncertainty delta;
- [ ] affected-entity navigation;
- [ ] scale compatibility warnings;
- [ ] adapter for MP54 projection algebra diffs: entity/facet/relation/property/identity change;
- [ ] export-ready before/after summary.

Exit: users can determine target improvement, trade-offs, bottleneck migration, distribution change and affected entities without manual screen comparison.

---

# 10. MP47 — Insight Rail and evidence/provenance

- [ ] `InsightItem` contract with entity/facet/relation IDs;
- [ ] shared InsightRail;
- [ ] rank/deduplicate;
- [ ] link insight -> entities/facets/metrics/relations/evidence;
- [ ] computed/diagnostic/heuristic distinction;
- [ ] confidence where material;
- [ ] baseline/candidate deltas;
- [ ] insight selection updates focus/selection;
- [ ] “why highlighted?” from Canvas/ProjectionExplorer/inspector;
- [ ] MP38 layout diagnostics in EngineeringHUD/inspector;
- [ ] MP55 coupling facts support when available;
- [ ] prohibit causal wording without causal relation/evidence;
- [ ] no-significant-insight state.

Insight families:

```text
Bottleneck
Risk
Opportunity
SLA miss
Failure
Rework hotspot
Queue concentration
Uncertainty
Scenario change
Cross-domain bridge/coupling hotspot
Engineering diagnostic
```

Exit: every high-severity insight can answer what/where/why/evidence/confidence and which canonical entity/facet/relation it refers to.

---

# 11. MP48 — Digital Twin playback and motion semantics

- [ ] playback clock/controller;
- [ ] play/pause/reset/speed/event step/scrub;
- [ ] synchronized topology + timeline;
- [ ] active entity/facet/event/relation IDs;
- [ ] job/operation/queue/resource/failure/rework/batch states;
- [ ] active path/flow motion;
- [ ] event inspector;
- [ ] reduced-motion static equivalent;
- [ ] bounded render/update work;
- [ ] deterministic playback from deterministic history;
- [ ] integration hook for MP59 cross-domain causal propagation;
- [ ] freeze time while projection changes without losing event identity.

Exit: topology/timeline synchronized; current event inspectable; reduced-motion parity; stable deterministic paused frame.

---

# 12. MP49 — Migration, accessibility, responsive, performance and regression

Migration order:

```text
1. Universal Process Lab
2. Process Math
3. Simulation
4. Risk / Monte Carlo
5. Batch
6. Digital Twin
7. Reliability
8. Optimizer
9. LBC-specific workbenches
10. remaining legacy/reference screens
```

For each screen:

- [ ] LabTrace shell;
- [ ] shared status tokens/primitives;
- [ ] no duplicate shell-global CSS;
- [ ] stable semantic entity ID mapping;
- [ ] linked selection where IDs exist;
- [ ] projection-safe state model;
- [ ] accessibility summary;
- [ ] responsive fixture;
- [ ] screenshot regression;
- [ ] canonical math/simulation parity;
- [ ] task comparison.

Accessibility:

- [ ] keyboard/focus;
- [ ] reduced motion;
- [ ] CVD/grayscale/high contrast;
- [ ] text scaling;
- [ ] screen-reader summaries;
- [ ] touch targets;
- [ ] Flat fallback and non-depth cues for any MP57 2.5D view.

Performance:

- [ ] large graph + overlays;
- [ ] long timeline/resource views;
- [ ] annotation compiler;
- [ ] linked-hover propagation;
- [ ] distribution aggregation;
- [ ] playback;
- [ ] projection/camera integration once MP57 exists;
- [ ] memory retention/leaks;
- [ ] mobile profile.

Exit: major screens feel like one product; no blocker accessibility issues; canonical results unchanged; no temporary ID adapter remains in active migrated flows unless explicitly versioned/deprecated.

---

# 13. MP50 — HMI rollout/default gate

Stages:

```text
H0 internal primitives
H1 developer opt-in LabTrace shell
H2 selected screen migration
H3 semantic overlays + linked views opt-in
H4 new HMI default for selected workflows
H5 default for active process applications
H6 remove obsolete duplicate shell/style paths after release history
```

Default gate:

1. MP41 baseline/contracts complete;
2. LabTrace shell stable;
3. deterministic evidence-linked annotations;
4. non-color/CVD/grayscale gates green;
5. linked-view state consistency green;
6. stable entity identity contract or fully isolated compatibility adapter;
7. stochastic views preserve distribution/threshold meaning;
8. comparison objective-aware;
9. Insight provenance/cause discipline green;
10. playback/reduced-motion parity green;
11. migrated screens preserve canonical outputs;
12. performance/visual regression budgets green;
13. human-task evaluation target met;
14. release history has no blocker navigation/accessibility regressions.

MP50 does not automatically enable multidomain 2.5D; projection default follows MP60.

Rollback is presentation-only and must never require changing canonical process results.

---

# 14. Atomic waves S–V

## Wave S — contract and shell

S01 UI inventory.  
S02 screenshot/task baseline.  
S03 VisualSemanticFact/Annotation.  
S04 LinkedViewState + ProjectionViewState integration point.  
S05 presentation-state versioning.  
S06 LabTrace stable zones.  
S07 shared tokens.  
S08 shared primitives.  
S09 Engineering HUD separation.  
S10 first migrated vertical slice.

## Wave T — semantic Canvas and linked analytics

T01 annotation compiler.  
T02 channel mapping/legends.  
T03 Canvas overlays.  
T04 lens registry.  
T05 critical/bottleneck.  
T06 risk/queue/uncertainty/change.  
T07 TimelineView.  
T08 ResourceLaneView.  
T09 linked entity/facet selection.  
T10 time/scenario/projection synchronization.

## Wave U — uncertainty, compare, explain, playback

U01 DistributionView.  
U02 percentile/SLA semantics.  
U03 ScenarioDelta.  
U04 CompareView.  
U05 topology/projection diff adapter.  
U06 Insight compiler.  
U07 InsightRail.  
U08 provenance drill-down.  
U09 playback.  
U10 reduced-motion parity.

## Wave V — migration and rollout

V01 Universal Process Lab.  
V02 Process Math.  
V03 Simulation.  
V04 Risk/Batch.  
V05 Digital Twin.  
V06 Reliability/Optimizer/LBC.  
V07 accessibility/CVD/mobile/Flat fallback.  
V08 performance/visual regression.  
V09 human task evaluation.  
V10 HMI default switch.

---

# 15. CI and review policy

A WS-L PR states where relevant:

- affected visual-semantic/presentation contract;
- entity/facet ID impact;
- projection state impact;
- canonical math impact (`none` expected for most HMI);
- linked-view impact;
- accessibility/non-color/non-depth impact;
- responsive/mobile impact;
- visual regression impact;
- performance impact;
- provenance/causal wording impact;
- human-task impact.

Required gates as implemented:

| Gate | Policy |
|---|---|
| frontend typecheck/tests/build | required |
| visual semantic contract tests | required |
| deterministic annotations | required |
| shared primitive tests | required |
| screenshot regression | required for affected views |
| keyboard/accessibility | required |
| grayscale/CVD | required for semantic changes |
| Flat/non-depth parity | required for 2.5D integrations |
| mobile fixtures | required for shell changes |
| linked entity/facet consistency | required after MP45 |
| canonical process result parity | required during migration |
| visualization/playback performance | gated |
| lens/projection orthogonality | required once MP54 integrated |

---

# 16. Human evaluation

Measure time, error rate, confidence, interaction count, reorientation errors, subjective comprehension and aesthetic preference separately.

A/B families:

- current vs LabTrace shell;
- flat KPI vs semantic hierarchy;
- unlinked vs linked views;
- P95-only vs distribution+threshold;
- manual vs CompareView;
- static Twin vs playback;
- separate domain views vs identity-preserving multidomain projection when MP57 is available.

---

# 17. Risks and controls

- **Over-encoding:** one dominant lens, explicit legend, limited simultaneous channels.
- **Semantic/style coupling:** facts/annotations/provenance contracts; UI does not recompute domain truth.
- **Identity drift:** MP52 stable IDs before final MP45 contract; adapters isolated/deprecated.
- **Projection/lens confusion:** orthogonal contracts and tests.
- **3D novelty trap:** Flat fallback and MP60 human-task gate.
- **Dashboard sprawl:** every view answers a distinct user question.
- **Animation overload:** event-only motion and reduced-motion parity.
- **Local CSS regression:** shared shell/primitives first.
- **Large-scene performance:** indexing, virtualization, culling, bounded updates.

---

# 18. Definition of Done — WS-L

WS-L is done only when:

1. HMI contract implemented;
2. LabTrace canonical shell;
3. shared primitives replace duplicated shell-level UI;
4. annotations renderer-neutral/evidence-linked;
5. lenses cover primary analytical tasks;
6. lenses preserve geometry and projection membership;
7. linked views operate on stable entity IDs;
8. facet-aware selection is supported where relevant;
9. stochastic outputs show distribution/threshold meaning;
10. comparison is objective-aware and projection-diff-ready;
11. Insight Rail preserves evidence and causal discipline;
12. Twin playback synchronized;
13. projection/time selection can coexist without identity loss;
14. reduced-motion parity;
15. Engineering HUD secondary;
16. active screens share one visual language;
17. accessibility/CVD/grayscale/mobile gates pass;
18. Flat fallback works for any 2.5D integrations;
19. performance budgets pass;
20. visual regression maintained;
21. human tasks show no material regression and target gains;
22. UI migration changes no canonical result;
23. MP50 passes before legacy shell cleanup;
24. multidomain default remains gated independently by MP60.

---

# 19. Immediate execution queue

Recommended combined order with WS-M:

1. MP41 baseline/contracts and MP51 projection contract proceed together after MP21 schema discipline.
2. MP42 LabTrace shell can proceed immediately.
3. MP52 stable `SemanticEntity`/`EntityFacet` contract should land before finalizing MP45 IDs.
4. MP43 VisualAnnotation compiler must accept entity-level and optional facet-level scope.
5. MP53 relation taxonomy and MP54 Flat projection engine proceed in parallel with MP44 lenses.
6. MP45 linked views bind to stable IDs.
7. MP46 CompareView receives MP54 projection-diff adapter when ready.
8. MP47 InsightRail receives MP55 coupling/provenance facts when ready.
9. MP48 playback defines entity/facet/event IDs usable by MP59.
10. MP49 migrates active screens and removes temporary ID assumptions.
11. MP50 can roll out new HMI independently of 2.5D.
12. MP57–MP60 separately gate multidomain 2.5D default.

---

# 20. Final engineering rule

> **Build the shared HMI around stable semantic identity first; then let projections, lenses, comparison and playback become coordinated views of the same system instead of separate applications.**
