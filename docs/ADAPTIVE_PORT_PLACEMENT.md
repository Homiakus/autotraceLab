# AutoTrace — Adaptive Port Placement Contract

Status: **normative for movable port geometry**  
Parent contracts: `VISUAL_COMPOSITION_CONTRACT.md`, `ROUTING_CONTRACT.md`, `MATHEMATICAL_CONTRACT.md`.

---

# 1. Principle

A port has two different concepts:

1. **logical identity and constraints** — persistent semantic data;
2. **derived geometric anchor** — layout output when the port is movable.

The layout/router MUST NOT confuse these layers.

```text
Port identity
  -> constraint resolver
  -> candidate sides/anchors
  -> joint ordering/routing evaluation
  -> DerivedPortAnchor
```

For process/workflow diagrams, ports should be adaptive by default when their physical location has no domain meaning. For physical connector/pinout/electrical diagrams, fixed physical location remains authoritative.

---

# 2. Backward-compatible interpretation

Existing model mapping:

| Existing fields | Canonical meaning |
|---|---|
| `placementMode=fixed` + explicit coordinate | fixed position |
| adaptive + one `allowedSide` | fixed side, movable offset |
| adaptive + multiple `allowedSides` | side selected by planner |
| adaptive + no `allowedSides` | sides derived from block policy |
| `preferredSide` | strong/soft preference, never a hard substitute for `allowedSides` |
| `order` | relative ordering constraint according to policy |
| `groupId` | contiguous/grouped placement constraint according to policy |
| `minSpacing` | hard minimum spacing |

Existing fixed behavior MUST remain invariant.

---

# 3. Constraint modes

Canonical modes:

```text
FREE
FIXED_SIDE
FIXED_ORDER
FIXED_RATIO
FIXED_POSITION
```

Modes may be combined with explicit order/group/capacity policies where the contract permits.

`FIXED_POSITION` is strongest and cannot be moved by routing, composition or cleanup.

---

# 4. Allowed vs preferred

These are separate concepts.

```text
allowedSides = [left, right]
preferredSide = right
```

Selecting `top` is a hard violation.

Selecting `left` is valid but incurs a preference penalty.

Metrics MUST therefore separate:

```text
portConstraintViolations  // hard
preferredSideDeviation    // soft
```

---

# 5. Capacity

A port can define:

```text
one
many
bounded(N)
```

Optional policies may include:

- shared anchor allowed/forbidden;
- shared normal stub allowed/forbidden;
- bus merge allowed/forbidden;
- maximum edges per side/group.

Capacity overflow is Tier 0.

---

# 6. Candidate generation

For an adaptive port, generate deterministic candidates only on permitted sides.

Candidate inputs:

- exact block shape perimeter;
- corner exclusion margin;
- minimum port spacing;
- neighboring ports;
- group/order constraints;
- label footprint;
- source-target direction;
- routing clearance;
- previous anchor/side from `LayoutSnapshot`.

Candidate sampling may be discrete/grid-based or analytically generated, but public output must obey canonical rounding/snap rules.

---

# 7. Joint assignment

Do not assign ports independently when edges share a side or ordering matters.

For each relevant block/face group:

1. derive neighbor ordering from semantic/layout geometry;
2. enumerate feasible side distributions;
3. assign port groups/order;
4. estimate routing/crossing effect;
5. select lexicographically best feasible assignment;
6. run canonical routing;
7. optionally refine locally within bounded budget.

Priority order:

```text
hard feasibility
crossings
order inversions
backward/awkward escape
bends
congestion
mental-map side stability
preferred-side deviation
wire length
compactness
```

---

# 8. Grouping and order

`groupId` may require ports to remain contiguous.

`order` may be:

- HARD: cannot invert;
- STRONG: preserve unless doing so creates a more important readability violation;
- unset: planner may order by connected-neighbor geometry.

Stable ID is the final deterministic tie-break.

---

# 9. Port hysteresis

Incremental mode receives previous side/order/offset from `LayoutSnapshot`.

Keep previous side unless switching:

- removes a hard violation;
- removes a crossing;
- removes a hard/strong order inversion;
- materially reduces bends/congestion;
- crosses a versioned profile threshold.

Tiny wire-length gains MUST NOT cause side flapping.

---

# 10. Routing integration

The port planner is upstream of routers.

Routers receive resolved anchors and endpoint normals. Routers MAY compute adaptive escape/stub length, but MUST NOT independently change logical port side/anchor without going through the planner/refinement contract.

Conceptual split:

```text
PortPlanner: where the endpoint is
EndpointEscape: how the route leaves that endpoint
Router: how the connection reaches the other endpoint
```

---

# 11. Self-loops

Self-loops use dedicated candidates and do not participate in ordinary source-target side selection.

Evaluate:

- available sides;
- other ports;
- loop stacking index;
- label footprint;
- local obstacle clearance;
- previous loop side.

---

# 12. Parallel edges and buses

Parallel edges may share port/trunk geometry only when declared semantically allowed.

Planner/router metadata should support:

```text
edgeGroupId
allowSharedAnchor
allowSharedStub
allowSharedTrunk
```

Shared trunks are never inferred solely because routes happen to be similar.

---

# 13. Physical-layout exception

For domains where port location is physical truth (connector pins, IC pins, physical tubing locations, equipment interfaces):

- use fixed side/position/order as required;
- adaptive composition may move the enclosing block only if allowed;
- no aesthetic prior may alter physical pin topology.

---

# 14. Acceptance tests

Required hard tests:

- fixed ports never move;
- candidates only on allowed sides;
- min spacing always satisfied;
- capacity always satisfied;
- fixed order preserved;
- shape perimeter coordinate valid;
- endpoint normal correct;
- serialization keeps optional-zero semantics.

Required quality tests:

- port-heavy fan-in/fan-out;
- crossing inversion case;
- mixed fixed/adaptive;
- multi-group face;
- many ports on small block;
- side capacity pressure;
- self-loop plus ordinary edges;
- parallel edges;
- incremental small edit;
- previous-side hysteresis;
- physical fixed-pin fixture.

Metamorphic tests:

- deterministic rerun;
- input permutation invariance;
- adding an allowed side cannot make the best feasible Tier-0 solution invalid;
- translation invariance where geometry contract permits;
- fixed-port invariance under unrelated changes.

---

# 15. Diagnostics

Debug/benchmark mode should report decisions such as:

```text
P1: kept on LEFT because FIXED_SIDE
P2: RIGHT -> BOTTOM removed 1 crossing and 2 bends
P3: stayed RIGHT due hysteresis; alternative saved only 4 px
P4/P5/P6 reordered to match neighbor order; no hard order constraint
P7: candidate rejected because minSpacing violation
```

---

## Final rule

> **Move a port only when its semantic/physical contract allows movement, and choose the movement for readability before wire-length convenience.**
