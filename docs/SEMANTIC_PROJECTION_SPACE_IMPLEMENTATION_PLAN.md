# AutoTraceLab — Multidomain Semantic Projection Implementation Plan

Status: **normative detailed execution plan for WS-M / MP51–MP60**  
Scope: canonical entity/facet/dimension model, projection algebra, cross-domain relation semantics, coupling analytics, projection-stable layout, 2D/2.5D renderer, slice controls, multidomain diff, Digital Twin propagation, performance, validation and rollout.  
Authority: subordinate to `MASTER_IMPLEMENTATION_PLAN.md`; detailed semantics are defined in `SEMANTIC_PROJECTION_SPACE_CONTRACT.md`.

---

# 1. Program objective

WS-M turns AutoTrace from a graph/document renderer into a multidomain engineering reasoning system where one authoritative entity may participate in multiple domain-specific facets and be explored through stable 2D/2.5D projections.

Target pipeline:

```text
canonical entities + domain/process facts
  -> Entity/Facet/Dimension graph
  -> Semantic Projection Engine
  -> ProjectionResult + coupling diagnostics
  -> projection-stable semantic layout
  -> Visual Semantics
  -> 2D / 2.5D LabTrace renderer
```

The program must preserve one authoritative identity per semantic entity, explicit facet ownership, deterministic projection algebra, mental-map stability across slices, accessible flat fallback and canonical model parity across view changes.

---

# 2. Relationship to WS-K and WS-L

```text
WS-K semantic layout / geometry / stability
       |                              
       +------------------------------+
                                      v
WS-M entity/facet/projection ---> ProjectionResult
                                      |
                                      +--> WS-K projection-stable layout
                                      +--> WS-L visual semantics / linked views
                                      v
                                2D / 2.5D HMI
```

Dependencies:

```text
MP21 schema/version discipline
  -> MP51 projection contract/baseline
  -> MP52 Entity/Facet/Dimension model
  -> MP53 relation + identity semantics
  -> MP54 projection algebra/query engine
  -> MP55 coupling analytics
  -> MP56 projection-stable layout
  -> MP57 2D/2.5D renderer
  -> MP58 slice/diff interaction
  -> MP59 Digital Twin + validation/performance
  -> MP60 rollout/default gate

MP35 mental-map stability ------> MP56
MP43 Visual Semantics ----------> MP57/58
MP45 LinkedViewState -----------> MP58
MP46 CompareView ---------------> MP58
MP48 playback ------------------> MP59
```

---

# 3. Milestone overview

| Milestone | Result | Status |
|---|---|---|
| MP51 | Projection contract + multidomain baseline | PLANNED |
| MP52 | Canonical Entity/Facet/Dimension model | PLANNED |
| MP53 | Relation taxonomy + identity/coupling semantics | PLANNED |
| MP54 | Projection algebra + query engine | PLANNED |
| MP55 | Cross-domain coupling analytics | PLANNED |
| MP56 | Projection-stable layout + mental-map bridge | PLANNED |
| MP57 | Canonical 2D/2.5D renderer + camera presets | PLANNED |
| MP58 | Slice explorer + multidomain/lifecycle/scenario diff | PLANNED |
| MP59 | Digital Twin cross-domain playback + hardening | PLANNED |
| MP60 | Domain migration + rollout/default gate | PLANNED |

---

# 4. MP51 — Contract and baseline [BLOCKING]

- [ ] approve `SEMANTIC_PROJECTION_SPACE_CONTRACT.md`;
- [ ] define version constants for entity/facet/dimension/projection contracts;
- [ ] inventory current domain-specific duplicate entity patterns;
- [ ] identify existing stable IDs that may become canonical entity IDs;
- [ ] capture representative multidomain fixture families;
- [ ] define projection determinism corpus;
- [ ] define identity merge/split migration policy;
- [ ] define baseline human tasks;
- [ ] define flat rendering baseline for every planned 2.5D fixture;
- [ ] add ADR: constrained 2.5D vs arbitrary free 3D.

Required fixtures:

```text
motor + pump + hydraulic circuit
servo axis + drive + mechanics + control
valve + actuator + hydraulics/pneumatics + PLC
sensor + process + electrical + control
multi-domain safety loop
Design vs AsBuilt
Nominal vs FailureCase
Baseline vs Candidate
```

Exit: ownership boundaries are unambiguous; no schema forces one entity per domain; fixture identities are reproducible; flat fallback exists.

---

# 5. MP52 — Canonical Entity / Facet / Dimension model [BLOCKING]

- [ ] implement `SemanticEntity`;
- [ ] implement `EntityFacet`;
- [ ] implement `SemanticDimension`;
- [ ] implement dimension value/ordering/hierarchy contracts;
- [ ] define facet-local ports/properties/state references;
- [ ] define entity-level vs facet-level property ownership;
- [ ] define missing/unknown/not-applicable semantics;
- [ ] define external identity/provenance mapping;
- [ ] define scenario/lifecycle state attachment without identity duplication;
- [ ] add native/WASM/SDK serialization;
- [ ] add backward-compatible mapping from current node/domain metadata where possible.

Invariants:

```text
facet -> exactly one entity
entity ID stable across projections
projection copies are not canonical entities
unknown != default
facet deletion != entity deletion unless explicitly requested
```

Exit: round-trip deterministic; invalid references fail explicitly; existing single-domain scenes map without semantic loss; cross-language conformance green.

---

# 6. MP53 — Relation taxonomy and identity/coupling semantics [BLOCKING]

- [ ] typed relation contract;
- [ ] `intra-domain`;
- [ ] `cross-domain-coupling`;
- [ ] `cross-domain-causal`;
- [ ] `traceability`;
- [ ] `dependency`;
- [ ] derived `identity-visualization` relation;
- [ ] relation provenance/evidence IDs;
- [ ] causal strength/confidence hooks where supported;
- [ ] endpoint validation at entity/facet level;
- [ ] ambiguity policy for collapsed entity projection;
- [ ] explicit compatibility mapping for legacy edges.

Exit: identity links cannot be confused with physical flow in metadata; causal relation requires explicit source/evidence semantics; relation projection deterministic.

---

# 7. MP54 — Projection algebra and query engine [BLOCKING]

- [ ] implement `ProjectionSpec`;
- [ ] implement `DimensionSlice` and filters;
- [ ] implement `ProjectionResult`;
- [ ] entity/facet/relation projection levels;
- [ ] `flat`, `overlay`, `stack`, `exploded`, `cross-domain` modes;
- [ ] facet collapse/expand/hybrid policies;
- [ ] context policies: none/ghost/neighbors/all-muted;
- [ ] union `A ∪ B`;
- [ ] intersection `A ∩ B`;
- [ ] difference `A − B`;
- [ ] symmetric difference `A △ B`;
- [ ] deterministic ordering/tie-breaking;
- [ ] diagnostics: why visible/hidden/different;
- [ ] projection cache keyed by model + projection revision;
- [ ] local invalidation after facet/relation edits.

Metamorphic gates:

```text
A ∩ B = B ∩ A
A ∪ B = B ∪ A
A △ B = B △ A
A − A = ∅
A ∩ A = A
A ∪ A = A
```

Exit: set semantics pass at entity/facet/relation levels; same request/revision yields identical result; projection cannot mutate canonical state.

---

# 8. MP55 — Cross-domain coupling analytics

- [ ] `domainDegree`;
- [ ] cross-domain relation degree;
- [ ] interface density by subsystem/group;
- [ ] typed cross-domain centrality profile;
- [ ] multi-discipline review candidate ranking;
- [ ] coupling hotspot diagnostics;
- [ ] failure-propagation metric hook based on explicit causal/FMEA semantics;
- [ ] normalization/scaling contracts;
- [ ] metric provenance/version IDs;
- [ ] VisualSemanticFact adapter;
- [ ] Insight Rail adapters.

Non-goals: raw domain count is not automatically risk; centrality is not automatically criticality; correlation is not causality.

Exit: every derived ranking explainable; metrics deterministic; risk semantics remain upstream/domain-authoritative.

---

# 9. MP56 — Projection-stable layout and mental-map bridge [BLOCKING FOR 2.5D DEFAULT]

- [ ] extend `LayoutSnapshot` with projection anchor metadata;
- [ ] define entity base-plane anchor separate from facet depth offset;
- [ ] preserve anchors across neighboring slices;
- [ ] local facet expansion/collapse;
- [ ] identity-column reservation;
- [ ] inter-plane edge corridor metadata;
- [ ] cross-domain stack plane spacing contract;
- [ ] projection-change movement cost;
- [ ] context ghost placement policy;
- [ ] deterministic plane ordering;
- [ ] integrate projection stability into Tier-3 mental-map comparison;
- [ ] preserve selected entity and viewport focus across projection changes;
- [ ] fallback when hard constraints make stable placement infeasible.

Exit: slice change does not cause global re-layout by default; shared entities remain trackable; unrelated movement bounded; flat/stack transitions retain semantic IDs.

---

# 10. MP57 — Canonical 2D/2.5D renderer and camera presets

- [ ] discrete semantic planes;
- [ ] identity columns;
- [ ] cross-domain coupling/causal edge styles through Visual Semantics tokens;
- [ ] canonical viewpoints `Flat`, `Shallow`, `Layered`, `CrossDomain`;
- [ ] one-action return to Flat;
- [ ] readable labels in supported presets;
- [ ] depth-aware hit testing without semantic ambiguity;
- [ ] plane labels + active slice indication;
- [ ] optional bounded perspective;
- [ ] no free-camera requirement for v1;
- [ ] keyboard/touch viewpoint controls;
- [ ] accessible flat equivalent;
- [ ] flat/default print/export policy.

Exit: viewpoints deterministic/reproducible; critical information survives Flat; same entity instances select as one entity; identity columns are visually distinct from flow.

---

# 11. MP58 — Slice explorer, axis mapping and multidomain diff

- [ ] projection control surface;
- [ ] choose depth dimension;
- [ ] choose visible slices;
- [ ] reorder planes where contract permits;
- [ ] `2D / Overlay / Stack / Exploded / CrossDomain` switch;
- [ ] facet collapse/expand;
- [ ] ghost context;
- [ ] saved projections;
- [ ] integrate projection state into `LinkedViewState`;
- [ ] dimension mapping to X/Y/depth where supported;
- [ ] one canonical depth dimension at a time;
- [ ] Electrical ∩ Hydraulic workflow;
- [ ] Design △ AsBuilt workflow;
- [ ] Nominal △ FailureCase workflow;
- [ ] Baseline △ Candidate workflow;
- [ ] entity/facet/relation/property change classification;
- [ ] identity merge/split warning;
- [ ] CompareView integration;
- [ ] lens/projection orthogonality tests.

Exit: user can find common/unique/shared entities and lifecycle/scenario changes without rebuilding separate diagrams.

---

# 12. MP59 — Cross-domain Digital Twin, accessibility, performance and verification

Digital Twin:

- [ ] facet/entity state at playback cursor;
- [ ] cross-domain event propagation visualization;
- [ ] causal chain drill-down;
- [ ] inter-domain latency display when known;
- [ ] freeze time while changing projection;
- [ ] preserve event identity across slices;
- [ ] reduced-motion cross-domain state;
- [ ] event-to-evidence linkage.

Accessibility:

- [ ] flat equivalent for every 2.5D view;
- [ ] layer list/tree navigation;
- [ ] keyboard entity/facet traversal;
- [ ] screen-reader projection summary;
- [ ] non-depth identity cue;
- [ ] high contrast/grayscale/CVD;
- [ ] text scaling;
- [ ] reduced motion.

Performance:

- [ ] dimension inverted indexes;
- [ ] projection cache benchmark;
- [ ] 10k+ entity/facet benchmark where representative;
- [ ] relation culling/aggregation;
- [ ] camera motion without semantic recompute;
- [ ] local-edit projection benchmark;
- [ ] long-history playback + slice switching;
- [ ] memory retention checks.

Verification:

- [ ] deterministic projection corpus;
- [ ] algebra metamorphic tests;
- [ ] identity invariants;
- [ ] lens/projection orthogonality;
- [ ] flat/stack semantic equivalence;
- [ ] native/WASM equivalence where projection math is canonical Go;
- [ ] screenshot regression for canonical viewpoints;
- [ ] human task comparison.

Exit: no critical accessibility dependence on depth; latency budgets met; cross-domain playback synchronized; deterministic/metamorphic gates green.

---

# 13. MP60 — Domain migration and rollout/default gate

Migration order:

```text
1. synthetic multidomain benchmark system
2. Universal Process Lab reference slice
3. Digital Twin reference slice
4. LBC/process equipment multidomain fixture where appropriate
5. electrical/mechanical/hydraulic engineering example packs
6. additional domain registries
```

For each family:

- [ ] identify canonical entity IDs;
- [ ] map duplicated domain nodes to facets only when identity is proven;
- [ ] preserve domain-specific ports/properties;
- [ ] preserve legacy view as fixture;
- [ ] validate relation typing/projection/flat fallback;
- [ ] compare human tasks;
- [ ] document ambiguous identity rather than guessing.

Rollout:

```text
M0 contract/fixtures only
M1 developer projection inspector
M2 flat multi-facet view
M3 opt-in stack/exploded view
M4 selected multidomain workflows default
M5 cross-domain analytics + Twin integration default
M6 broader domain adoption after release history
```

Default gate:

1. identity invariants pass;
2. projection algebra deterministic/metamorphic gates pass;
3. no projection action mutates canonical model;
4. projection-stable movement inside approved budgets;
5. canonical camera presets reproducible;
6. flat fallback preserves critical meaning;
7. coupling analytics explainable/versioned;
8. diff handles identity changes explicitly;
9. Twin event identity synchronized;
10. accessibility/CVD/grayscale/reduced-motion gates pass;
11. performance gates pass;
12. migrated fixtures preserve engineering facts;
13. human-task evaluation shows target gains;
14. release history has no blocker identity/navigation defects.

---

# 14. Atomic waves W–Z

## Wave W — semantics and projection core

W01 contract/ADR.  
W02 SemanticEntity.  
W03 EntityFacet.  
W04 SemanticDimension.  
W05 dimension bindings.  
W06 relation taxonomy.  
W07 identity visualization relation.  
W08 ProjectionSpec.  
W09 ProjectionResult.  
W10 projection diagnostics.

## Wave X — algebra and coupling

X01 union/intersection.  
X02 difference/symmetric difference.  
X03 entity/facet/relation semantics.  
X04 projection indexes/cache.  
X05 local invalidation.  
X06 domain degree.  
X07 cross-domain degree.  
X08 interface density.  
X09 cross-domain centrality profile.  
X10 failure-propagation hook/provenance.

## Wave Y — stable geometry and 2.5D HMI

Y01 projection anchors.  
Y02 stack plane ordering.  
Y03 identity columns.  
Y04 facet expand/collapse stability.  
Y05 Flat/Shallow presets.  
Y06 Layered/CrossDomain presets.  
Y07 hit testing/selection identity.  
Y08 projection control surface.  
Y09 saved projections.  
Y10 multidomain/lifecycle/scenario diff.

## Wave Z — Twin, hardening and rollout

Z01 playback facet state.  
Z02 cross-domain causal event path.  
Z03 time freeze + slice switching.  
Z04 flat accessibility equivalent.  
Z05 keyboard/screen-reader projection navigation.  
Z06 large projection benchmarks.  
Z07 metamorphic/semantic regression.  
Z08 human task evaluation.  
Z09 domain migration pack.  
Z10 default gate.

---

# 15. CI and review policy

A PR touching WS-M must state where relevant: entity/facet/dimension contract impact, identity migration impact, projection algebra impact, relation taxonomy impact, canonical math impact, projection-stability impact, flat/2.5D equivalence, accessibility, cache/performance, Twin event identity and human-task impact.

Required gates:

| Gate | Policy |
|---|---|
| entity/facet reference validity | zero invalid |
| deterministic projection | required |
| projection algebra metamorphic tests | required |
| canonical model no-mutation by view state | required |
| native/WASM parity for canonical projection math | required where applicable |
| projection mental-map stability | gated |
| flat/2.5D semantic equivalence | required |
| screenshot canonical-view regression | required |
| keyboard/accessibility | required |
| grayscale/CVD/non-depth semantics | required |
| projection/cache performance | statistically gated |
| Digital Twin event identity | required |

---

# 16. Human evaluation program

A/B tasks:

```text
separate domain diagrams vs Semantic Projection Space
flat domain switching vs stable slice/ghost context
manual cross-reference vs identity columns
manual document comparison vs projection algebra diff
static domain views vs cross-domain Digital Twin playback
```

Measure answer accuracy, time, confidence, interactions, lost-context/reorientation events, wrong-identity selections and separate aesthetic preference.

The 2.5D mode ships only if it improves real multidomain tasks rather than visual novelty alone.

---

# 17. Risks and controls

- **Identity collapse error:** explicit identity evidence/provenance, conservative migration, auditable merge/split.
- **3D novelty trap:** constrained viewpoints, Flat fallback, human-task gates.
- **Projection explosion:** one depth dimension, saved task projections, progressive disclosure, bounded active planes.
- **Semantic duplication:** shared canonical contracts and registry-driven extensions.
- **Mental-map loss:** projection anchors, MP35/56 stability budget, local expansion.
- **False causal inference:** explicit causal relation class/evidence, Insight provenance.
- **Performance collapse:** indexing, culling, aggregation, caches and performance gates.

---

# 18. Definition of Done — WS-M

WS-M is complete only when:

1. one entity can own multiple domain facets;
2. facet/entity identity is versioned and validated;
3. dimensions are generic, not hard-coded to Domain;
4. relation classes distinguish identity, coupling and causal meaning;
5. projection algebra is deterministic/metamorphically tested;
6. projections cannot mutate canonical state;
7. coupling analytics are explainable/versioned;
8. projection changes preserve mental map within budgets;
9. identity columns preserve one-entity selection across layers;
10. Flat/Overlay/Stack/Exploded/CrossDomain semantics are defined;
11. canonical viewpoints avoid arbitrary 3D as default;
12. critical meaning has non-depth flat equivalent;
13. diff supports domain/lifecycle/scenario slices;
14. identity merge/split is specially reported;
15. Digital Twin preserves entity/event identity across slices;
16. accessibility/reduced-motion gates pass;
17. large-scene projection performance passes;
18. migration never guesses ambiguous identity silently;
19. human-task evaluation demonstrates benefit;
20. MP60 gate passes before broad default rollout.

---

# 19. Immediate execution queue

1. MP51 fixtures and ADR.
2. `SemanticEntity`, `EntityFacet`, `SemanticDimension`.
3. typed relation classes and provenance.
4. deterministic Flat `ProjectionSpec -> ProjectionResult`.
5. set algebra + metamorphic tests.
6. projection cache/indexes.
7. coupling diagnostics.
8. projection anchors in `LayoutSnapshot`.
9. Flat + Stack renderer with identity columns.
10. Shallow/Layered/CrossDomain presets.
11. slice explorer + saved projections.
12. integrate with `LinkedViewState` and Visual Semantics lenses.
13. Design/AsBuilt and Baseline/Candidate diff.
14. cross-domain Digital Twin playback.
15. MP59 hardening and MP60 rollout gate.

---

# 20. Final engineering rule

> **Do not build several diagrams of one system when one canonical model with stable identity and disciplined projections can explain all of them.**
