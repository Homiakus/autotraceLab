# AutoTrace Mathematical & Algorithmic Contract

Status: **Canonical Specification**  
Version: `v1.0.0`  
Contract Authority: `docs/MASTER_IMPLEMENTATION_PLAN.md`  
Scope: AutoTrace Core (Go native & Go/WASM), TypeScript Oracle, Protocol Contracts.

---

## 1. Core Principles & Numerical Policy

### 1.1 Numerical Policy & Epsilon Standard
- **Discrete Values & Identifiers**: Exact match ($==$).
- **Snapped Coordinates**: Exact match ($==$) after canonical grid snapping ($snap(x, G) = \text{round}(x / G) \times G$).
- **Floating-Point Geometric Comparisons**: Declared absolute tolerance $\epsilon = 10^{-6}$. Two points $P_1, P_2$ are coincident if $|x_1 - x_2| < \epsilon \land |y_1 - y_2| < \epsilon$.
- **Trigonometric & Spline Outputs**: Serialized and compared after canonical rounding to $10^{-4}$ (4 decimal places).
- **Objective Function / Cost Calculations**: Absolute tolerance $\epsilon_{abs} = 10^{-3}$, relative tolerance $\epsilon_{rel} = 10^{-4}$.
- **Invalid Numbers**: `NaN`, `+Inf`, and `-Inf` are hard contract violations and must never appear in valid scene states, routes, or metrics.

### 1.2 Deterministic Tie-Breaking Policy
All algorithmic choices (A* path exploration, barycentric layer sorting, spiral slot finding, port allocation, label placement) must be 100% deterministic and independent of language runtimes or map iteration orders.

Canonical priority ordering for tie-breaking:
$$\text{Priority} = (\text{Cost}, \text{Algorithm Rank}, \text{Direction Rank}, y, x, \text{Entity ID})$$

Direction rank order (canonical 4-way):
1. `Right` (0)
2. `Bottom` (1)
3. `Left` (2)
4. `Top` (3)

### 1.3 Optional Value & Presence Semantics
Explicit values must NEVER be conflated with `unset` / `default`:
- $0 \neq \text{undefined}$ (e.g., `relativePosition: 0` means explicitly anchored at port origin, whereas `undefined` allows adaptive computation).
- `false` $\neq \text{undefined}$ (e.g., `smoothCorners: false` explicitly commands sharp orthogonal 90° bends).
- `customOffset: 0` $\neq \text{undefined}$ (explicit 0 offset from face).
- `order: 0` $\neq \text{undefined}$ (explicit first slot in port ordering).
- `cornerRadius: 0` $\neq \text{undefined}$ (strictly square corners).

---

## 2. Geometry Contract

### 2.1 Block Minimum Sizing & Auto-Sizing Formula
Every block dimension $(W, H)$ must satisfy:
$$W \ge \max(W_{min}, W_{content}, W_{ports})$$
$$H \ge \max(H_{min}, H_{content}, H_{ports})$$

Where port height contribution on vertical faces (Left/Right) with $N$ ports is:
$$H_{ports} = 2 \times \text{cornerMargin} + (N - 1) \times \text{portPitch}$$

Defaults:
- Base Grid $G = 10\text{px}$
- $\text{cornerMargin} = 14\text{px}$
- $\text{portPitch} = 20\text{px}$
- $W_{min} = 120\text{px}$, $H_{min} = 60\text{px}$

### 2.2 Port Placement & Ordering
Ports on each side are ordered deterministically by:
$$\text{Group} \to \text{Explicit Order} \to \text{Pin Number} \to \text{Port ID}$$

Port coordinate calculation:
- **Fixed/Percentage**: $pos = \text{sideLength} \times relativePosition$
- **Adaptive/Equispaced**: $pos_i = \text{cornerMargin} + i \times \frac{\text{sideLength} - 2\cdot \text{cornerMargin}}{\max(1, N - 1)}$

### 2.3 Six Supported Shapes & Perimeter Mapping
All shapes calculate precise perimeter anchor points and surface normals:
1. `rectangle`: Box boundary $[x, y, w, h]$.
2. `rounded`: Box with corner radius $R = \min(cornerRadius, \min(w, h)/2)$.
3. `chip_ic`: Rectangle with designated notch and pin spacing indicators.
4. `circle`: Ellipse centered at $(x + w/2, y + h/2)$ with radii $(w/2, h/2)$.
5. `diamond`: Rhombus connecting top, right, bottom, left midpoints.
6. `hexagon`: 6-vertex polygon with chamfered horizontal or vertical corners.

### 2.4 Obstacle Envelopes & Clearance
Each block generates an inflated obstacle bounding box:
$$\text{ObstacleAABB} = [x - \text{clearance}, y - \text{clearance}, w + 2\cdot\text{clearance}, h + 2\cdot\text{clearance}]$$
Default clearance: $10\text{px}$ (or profile specific).

---

## 3. Shared Geometric Primitives Contract

All routing, cleaning, labeling, and metrics modules MUST share identical geometric primitives:
- `IntersectAABB(boxA, boxB) -> bool`
- `IntersectSegments(segA, segB) -> (bool, Point)`
- `CollinearOverlap(segA, segB) -> (bool, float overlapLength)`
- `PointSegmentDistance(pt, seg) -> float`
- `LiangBarskyClip(seg, aabb) -> (bool, Segment)`
- `BlockFaceTangency(seg, block) -> bool` (detects if wire runs along forbidden boundary face).

---

## 4. Routing & Wire Contract

### 4.1 Endpoint Escape & Normal Vectors
- Wire MUST exit source port strictly along source outward normal vector $\vec{n}_{src}$ by at least $\text{minStubLength}$ ($10\text{px}$).
- Wire MUST enter target port strictly along target outward normal vector $-\vec{n}_{tgt}$ by at least $\text{minStubLength}$.
- Adaptive stub calculation adjusts stub length based on source-target relative orientation and lane-staggering index $k$:
  $$\text{stubLength}(k) = \text{baseStub} + k \times \text{laneSpacing}$$

### 4.2 Multi-Pass Wire Artifact Cleaner
Cleaning must be strictly obstacle-aware and idempotent: $\text{Clean}(\text{Clean}(\text{path})) \equiv \text{Clean}(\text{path})$.
Passes in order:
1. **Direct 0-bend check**: If source and target ports face each other with collinear normals and unobstructed corridor, produce 1 straight segment.
2. **Endpoint Normal Stub Lock**: Lock initial and final stub segments.
3. **Collinear Point Merge**: Remove intermediate redundant points along straight lines ($P_{i-1}, P_i, P_{i+1}$ collinear $\implies$ remove $P_i$).
4. **Micro-jog & Staircase Removal**: Merge step offsets $< \text{jogTolerance}$ ($10\text{px}$) if clearance allows.
5. **U-Turn Elimination**: Replace 3-segment U-turns with single bypass or direct step where obstacle-free.
6. **Obstacle-Aware Raycast Shortcut**: Check diagonal/orthogonal shortcuts between non-adjacent vertices.
7. **Final Validation Pass**: Verify path is valid orthogonal and obstacle-free.

### 4.3 Orthogonal A* Routing
- **Search State**: $(x, y, \text{prevDirection})$.
- **Step Size**: Routing grid $G_{route} = 10\text{px}$ or $5\text{px}$.
- **Cost Function**:
  $$f(n) = g(n) + h(n)$$
  $$g(n) = \text{len} + C_{bend} \cdot \text{bends} + C_{occ} \cdot \text{occupancy} + C_{prox} \cdot \text{proximity} - R_{straight} - R_{align}$$
  $$h(n) = \text{ManhattanDist}(n, \text{target}) + \text{EstBendCost}(n, \text{target})$$
- **Hard Constraints**:
  - Zero intersection with block interior obstacle boxes (except port stubs).
  - Prohibition of collinear overlaps with existing wires.
  - Prohibition of running along block faces without clearance.
- **Route Status**:
  - `ok`: Valid route passing all geometric checks.
  - `degraded`: Path found with soft penalty violations (e.g. detour).
  - `no_path`: No valid obstacle-free path found. Unchecked fallback routes are forbidden.

---

## 5. Label Solver Contract

- Labels MUST be placed directly on the arrow path segment ($\text{isOnArrow} = \text{true}$).
- Candidate locations tested at discrete parameter values $t \in [0.2, 0.5, 0.8]$ along eligible segments (preferring long horizontal segments).
- Collision test: Label bounding box must NOT overlap:
  - Any block AABB.
  - Any other wire path (tested via Liang-Barsky line clipping).
  - Any previously placed label AABB.
- If no collision-free segment exists:
  - Displace label to nearest clear position.
  - Set $\text{isOnArrow} = \text{false}$.
  - Apply penalty $\text{MAX\_LABEL\_OFF\_ARROW\_PENALTY} = 50,000$.

---

## 6. Metrics & QualityVector Contract

### 6.1 Metrics Definitions
1. **Actual Wirelength**: $\sum \|\text{seg}_i\|$.
2. **Theoretical Lower Bound**: Manhattan distance between port endpoints $\|x_2 - x_1\| + \|y_2 - y_1\|$.
3. **Normalized Excess Wirelength**: $\frac{\text{Actual} - \text{LowerBound}}{\max(1, \text{LowerBound})}$.
4. **Bend Count**: Number of 90° direction changes.
5. **Crossing Count**: Perpendicular intersections between distinct wire segments.
6. **Collinear Shared Length**: Total length of overlapping parallel wire segments (Target: 0).
7. **Hard Violations Count**: Sum of (block penetrations + non-normal port entries + collinear overlaps).

### 6.2 Quality Vector & Lexicographical Priority
Optimization decisions must strictly obey lexicographical hierarchy:
- **Tier 0 (Hard Validity)**: Hard violations must be 0.
- **Tier 1 (Crossings & Shared Paths)**: Min collinear overlaps, min crossings, max labels on arrow.
- **Tier 2 (Geometry)**: Min bends, min excess wirelength.
- **Tier 3 (Stability & Churn)**: Min route variation during incremental edits.
- **Tier 4 (Performance)**: Execution latency and memory allocations.

---

## 7. NLP Optimizer Contract

Objective Function $\Phi(X)$ for block positions $X$:
$$\Phi(X) = w_1 \cdot \text{Wirelength}(X) + w_2 \cdot \text{LengthVariance}(X) + w_3 \cdot \text{BlockRepulsion}(X) + w_4 \cdot \text{SpacingViolations}(X) + w_5 \cdot \text{PortAlignment}(X) + \text{Barriers}$$

Invariants:
- Pinned nodes: $\nabla_{X_{pinned}} \Phi(X) \equiv 0$ (Positions remain strictly constant).
- Gradient updates clipped to $[- \Delta_{max}, \Delta_{max}]$ and snapped to placement grid.
- Objective evaluation returns finite real numbers; NaNs are treated as fatal errors.
