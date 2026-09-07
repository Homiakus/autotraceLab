# AutoTrace — Multidomain Semantic Projection Space Contract

Status: **normative for multidomain entity/facet semantics, projection algebra and 2D/2.5D representation**  
Scope: physical/logical entity identity, domain facets, semantic dimensions, multidomain relations, slice/projection algebra, coupling analytics, projection-stable layout, constrained 2.5D rendering, cross-domain Digital Twin state and accessibility.  
Authority: subordinate to `MASTER_IMPLEMENTATION_PLAN.md`. This contract complements `VISUAL_COMPOSITION_CONTRACT.md` and `VISUAL_SEMANTICS_HMI_CONTRACT.md`; it does not redefine routing mathematics or renderer styling.

---

# 1. Purpose

A real engineering object usually participates in more than one model. AutoTrace therefore models one stable entity identity with one or more domain-specific facets and exposes the system through deterministic multidimensional projections.

> **One entity, many facets, many projections.**

A view may duplicate a visual representation of an entity, but it must not duplicate the authoritative identity.

> **Projection changes presentation, not truth.**

Slicing, stacking, overlaying or rotating a projection must not silently create, delete or mutate canonical engineering facts.

---

# 2. Architectural position

```text
Canonical domain/process model
        |
        v
Entity / Facet / Relation / Dimension model
        |
        v
Semantic Projection Engine
        |-- filtering / slicing
        |-- projection algebra
        |-- facet expansion/collapse
        |-- cross-domain coupling analysis
        `-- projection diagnostics
        |
        v
ProjectionResult
        |--> Semantic Layout / mental-map stabilization
        |--> Visual Semantics Compiler
        v
2D / 2.5D LabTrace Renderer
```

Canonical model owns identities/facts; Projection Engine owns view membership/slices; Layout owns readable stable geometry; Visual Semantics owns emphasis; renderer owns concrete drawing/interaction.

---

# 3. Canonical mathematical model

Let

\[
\mathcal{S}=(E,F,R,D,A,B)
\]

where `E` are stable entities, `F` facets, `R` typed relations, `D` semantic dimensions, `A` attributes/facts and `B` dimension bindings.

Each facet belongs to exactly one authoritative entity:

\[
owner:F\rightarrow E
\]

and has a partial assignment over dimensions:

\[
b_f:D\rightharpoonup Value
\]

Missing binding means unknown/not-applicable according to the dimension contract; it must not silently become a default.

---

# 4. Entity identity contract

```ts
export interface SemanticEntity {
  id: string;
  kind: string;
  label?: string;
  externalIds?: Record<string, string>;
  facetIds: string[];
  provenanceIds?: string[];
}
```

Rules:

1. `Entity.id` is stable across projection changes.
2. A facet does not create a second entity merely because another discipline owns different properties.
3. Similar-looking objects are not merged without identity evidence/rules.
4. One physical object may contain multiple logical entities where semantics require it.
5. Identity merge/split operations are model changes, not presentation actions.
6. Derived 2.5D visual copies all reference the same entity ID.

---

# 5. Facet contract

```ts
export interface EntityFacet {
  id: string;
  entityId: string;
  facetType: string;
  bindings: Record<string, string | number | boolean>;
  portIds?: string[];
  propertyIds?: string[];
  relationIds?: string[];
  provenanceIds?: string[];
}
```

A facet may own domain-specific ports, properties, units, relations, constraints, failure modes and state variables.

Example: one pump may expose electrical terminals/current, a mechanical shaft/torque and hydraulic suction/discharge pressure/flow as three facets of one entity.

---

# 6. Semantic dimensions

```ts
export interface SemanticDimension {
  id: string;
  label: string;
  kind: 'categorical' | 'ordinal' | 'hierarchical' | 'continuous' | 'temporal';
  valueIds?: string[];
  order?: string[];
  hierarchyId?: string;
  unit?: string;
  unknownPolicy: 'exclude' | 'include-as-unknown' | 'error';
}
```

Standard dimension families should include Domain, Hierarchy, Lifecycle, State, Responsibility, Location and Scenario. Domain is important but must not be hard-coded as the only possible depth axis.

---

# 7. Domain membership

Canonical membership is normally categorical/set-valued. Optional normalized membership may exist for ranking:

\[
m(e,d)\in[0,1]
\]

but it does not replace explicit facets.

Derived:

\[
domainDegree(e)=|\{d\mid \exists f\in Facets(e):b_f(Domain)=d\}|
\]

`domainDegree` is descriptive, not a risk score.

---

# 8. Relation taxonomy

```ts
export type RelationClass =
  | 'intra-domain'
  | 'cross-domain-coupling'
  | 'cross-domain-causal'
  | 'traceability'
  | 'containment'
  | 'dependency'
  | 'identity-visualization';
```

Identity-visualization relations connect visible facet instances of the same entity and are derived presentation relations, not physical flow. Cross-domain coupling expresses interfaces/dependencies. Cross-domain causal relations require explicit directional model/evidence; correlation must not be silently upgraded to causality.

---

# 9. Projection specification

```ts
export interface ProjectionSpec {
  id?: string;
  axes: ProjectionAxis[];
  slices: DimensionSlice[];
  filters?: ProjectionFilter[];
  mode: 'flat' | 'overlay' | 'stack' | 'exploded' | 'cross-domain';
  depthDimensionId?: string;
  contextPolicy?: 'none' | 'ghost' | 'neighbors' | 'all-muted';
  facetPolicy?: 'collapse-to-entity' | 'expand-visible-facets' | 'hybrid';
  relationPolicy?: RelationProjectionPolicy;
  scenarioIds?: string[];
  timeCursor?: number;
}
```

Projection is deterministic and pure with respect to the same model revision.

---

# 10. Slice algebra

For slices/projections `A` and `B` support:

```text
A ∪ B    union
A ∩ B    intersection
A − B    difference
A △ B    symmetric difference
```

Examples include Electrical ∩ Hydraulic, Design △ AsBuilt and Nominal △ FailureCase.

Every operation declares its semantic level: entity, facet, relation, fact or structured projection tuple. Entity-level symmetric difference must not be presented as though every property differs.

---

# 11. Projection result

```ts
export interface ProjectionResult {
  modelRevision: string;
  projectionRevision: string;
  entityIds: string[];
  facetInstances: ProjectedFacetInstance[];
  relationInstances: ProjectedRelationInstance[];
  identityColumns?: IdentityColumn[];
  dimensionAxes: ResolvedProjectionAxis[];
  diagnostics: ProjectionDiagnostic[];
  couplingSummary?: CouplingSummary;
}
```

Projected facet instances are presentation inputs, never authoritative facet records.

---

# 12. 2D / 2.5D representation modes

Required modes:

- **Flat** — canonical 2D detailed/edit/print/accessibility view.
- **Overlay** — several slices on one plane with visual-semantic differentiation.
- **Stack** — discrete parallel planes along one semantic dimension.
- **Exploded** — planes separated strongly to reveal identity/coupling columns.
- **CrossDomain** — view approximately along the depth/domain axis to reveal integration hotspots.

---

# 13. Canonical camera policy

2.5D is constrained analytical projection, not free-form 3D navigation.

Required presets:

```text
Flat
Shallow
Layered
CrossDomain
```

Arbitrary free rotation is not a v1 requirement and must never be the default. If exploratory free camera is later added, one action must restore a canonical viewpoint.

---

# 14. Identity columns

When one entity has visible facets on several planes, the renderer provides a stable identity mechanism. Identity columns link only facets of the same entity, remain selectable as one entity, support collapse-to-entity mode and use a visual grammar distinct from physical/causal flow.

---

# 15. Projection-stable layout and mental map

For neighboring projections `q1`, `q2`, minimize displacement of shared entities:

\[
L_{projection}=\sum_{e\in E_{shared}}w_e\|x_e^{q_2}-x_e^{q_1}\|^2
\]

subject to higher-priority validity/readability constraints.

Rules: slicing must not globally re-layout by default; same entity retains its base-plane anchor where feasible; facet expansion changes depth/offset locally; camera changes do not alter canonical graph geometry; projection state is snapshot separately from canonical layout state.

---

# 16. Cross-domain coupling analytics

Useful renderer-neutral metrics include:

\[
domainDegree(e)=|Domains(e)|
\]

\[
cdDegree(e)=|\{r\in R: e\in endpoints(r), domain(src(r))\neq domain(dst(r))\}|
\]

and subsystem interface density:

\[
interfaceDensity(S)=\frac{|R_{cross}(S)|}{max(1,|E(S)|)}
\]

Typed cross-domain centrality may be added with explicit metric/version. Failure-propagation potential must be based on causal/impact/FMEA semantics, never raw domain degree alone.

---

# 17. Projection vs lens

Projection and Visual Semantics are orthogonal.

- Projection decides **what semantic slice exists in the view**.
- Lens decides **what meaning is emphasized inside that view**.

A risk lens over an Electrical+Mechanical+Hydraulic stack is valid; changing the lens must not change slice membership.

---

# 18. Dimension-to-visual mapping

Example:

```text
X = process order
Y = hierarchy/lane
Depth = domain
Visual lens = risk
Opacity = context/confidence support
Stroke = throughput/load
Time = playback cursor
```

Only one dimension is canonical depth at a time. Critical semantics must remain accessible without depth perception.

---

# 19. Digital Twin integration

Entity/facet identity persists over time. Cross-domain event propagation may be shown only through explicit model/event relations. Users may freeze time and change projection without losing event identity. Reduced-motion mode shows identical semantic state statically.

---

# 20. Scenario and lifecycle diff

Projection algebra generalizes baseline/what-if comparison. Diff distinguishes entity, facet, property, relation, state, coupling and identity-mapping changes. Identity merge/split requires special warning because ordinary deltas may no longer be directly comparable.

---

# 21. Editing semantics

Changing slice, plane order, projection mode, camera preset, facet collapse/expand, lens or context policy is presentation state and must not alter canonical data.

Assigning/removing facets, editing dimension bindings, merging/splitting identity or editing relations are canonical model operations with validation, undo/redo and provenance.

---

# 22. Accessibility and flat fallback

Every 2.5D view requires Flat mode, layer/slice list, keyboard traversal, explicit facet/domain labels, non-depth identity cues, screen-reader projection summary, high-contrast/grayscale semantics and reduced-motion support. No critical fact may depend only on z-depth, perspective or transparency.

---

# 23. Performance and scale

Required: entity/facet/relation indexes, dimension inverted indexes, projection caching by model/projection revision, incremental local recomputation, visible-plane/relation culling, bounded identity-column rendering, virtualization and deterministic work budgets for expensive analytics. Pointer/camera motion must not trigger global semantic recomputation.

---

# 24. Persistence/versioning

Persist separately:

```text
CanonicalModelState
ProjectionDefinition
UserViewState
LayoutSnapshot
```

Derived pixel coordinates, animation frames and compiled VisualAnnotations are not authoritative model state.

---

# 25. Diagnostics

The system should answer why an entity is visible, why it appears on several layers, why facets are linked, why an entity is cross-domain, why a relation is causal/coupling/identity, why an item appears in `A △ B`, why an entity moved and what evidence supports identity mapping.

---

# 26. Anti-patterns

Do not duplicate authoritative entities per domain; infer identity from proximity; use identity columns as flow; hard-code Domain as the only dimension; persist derived 2.5D copies as entities; globally re-layout every slice; encode critical state only in depth; default to arbitrary 3D rotation; let camera mutate semantic state; infer causality from correlation; call domain degree a risk score; let filters delete canonical data; mix projection state with domain state; recompute semantics on pointer motion; or let domain UI modules invent competing facet semantics.

---

# 27. Validation invariants

1. Every facet references exactly one valid entity.
2. Every relation endpoint resolves.
3. Dimension bindings are valid.
4. Projection output ordering is deterministic.
5. Projection algebra satisfies set identities at the declared semantic level.
6. Identity visual links connect only same-entity instances.
7. Slice/lens/camera changes do not mutate canonical state.
8. Camera transitions preserve selected entity.
9. Same-entity facets remain linked.
10. Flat fallback preserves critical semantics.
11. Diffs report identity changes explicitly.
12. Projection cache invalidation is revision-correct.

Metamorphic examples:

```text
A ∩ B = B ∩ A
A ∪ B = B ∪ A
A △ B = B △ A
A − A = ∅
A ∩ A = A
A ∪ A = A
camera preset changes preserve semantic IDs
lens changes preserve projection membership
unrelated facet edit preserves unrelated projection results
```

---

# 28. Human evaluation

Tasks include finding components spanning most domains, tracing electrical→mechanical→hydraulic failure propagation, finding common entities between domains, comparing Design vs AsBuilt, finding bottleneck migration and identifying multidisciplinary interface-review hotspots.

Measure correctness, time, confidence, interaction count, reorientation errors, wrong-identity selections and aesthetic preference separately.

---

# 29. Relationship to existing contracts

- `VISUAL_COMPOSITION_CONTRACT.md` owns readable geometry and mental-map primitives.
- `VISUAL_SEMANTICS_HMI_CONTRACT.md` owns emphasis, lenses, linked views, insight and playback presentation.
- `SEMANTIC_PROJECTION_SPACE_CONTRACT.md` owns entity/facet/dimension/projection semantics and 2.5D meaning.
- `MATHEMATICAL_CONTRACT.md` remains authoritative for any projection analytics promoted to canonical engineering math.

---

# 30. Final engineering rule

> **Model one system once, expose many disciplined projections, preserve identity and the mental map, and use 2.5D only when depth answers a real semantic question.**
