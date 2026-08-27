# AutoTrace Mathematical Contract & Invariant Proofs

## 1. 9-Component Canonical QualityVector

The layout and routing quality of any topology $G = (V, E)$ is evaluated using the canonical 9-component `QualityVector`:

$$Q(G) = \begin{bmatrix} L \\ B \\ X \\ O \\ D \\ U \\ S \\ A \\ C \end{bmatrix}$$

where:
1. **$L$ (Total Wire Length)**: Sum of Euclidean lengths across all routed wire segments $\sum_{e \in E} \text{len}(e)$.
2. **$B$ (Total Bends)**: Total orthogonal direction changes $\sum_{e \in E} \text{bends}(e)$.
3. **$X$ (Crossings Count)**: Number of perpendicular $90^\circ$ wire-over-wire crossings.
4. **$O$ (Collinear Overlaps)**: Total length of illegal shared collinear wire segments ($\sum \text{overlap} \equiv 0$).
5. **$D$ (Detour Ratio)**: $\sum \frac{\text{len}(e)}{\text{ManhattanDistance}(\text{src}(e), \text{tgt}(e))}$.
6. **$U$ (Wire Uniformity / Spacing Variance)**: Variance of inter-wire channel clearance.
7. **$S$ (Port Inflow/Outflow Stress)**: Count of non-normal port egress/ingress angle violations ($\equiv 0$).
8. **$A$ (Pin-to-Pin Alignment Score)**: Horizontal and vertical collinear alignment between directly connected terminals.
9. **$C$ (Channel Congestion)**: Maximum wire density across any single routing grid channel track.

---

## 2. Hard Invariants

1. **Port Normal Invariant**: Every wire leaving a port on side $S \in \{\text{left}, \text{right}, \text{top}, \text{bottom}\}$ must leave along the outward surface normal $\vec{n}_S$ by at least $d \ge 10\text{px}$ before executing any orthogonal turn.
2. **Obstacle Clearance Invariant**: For any block obstacle $B_k$, the routed path $P_i$ must not intersect the open interior $(x - \delta, x + w + \delta) \times (y - \delta, y + h + \delta)$.
3. **Zero Collinear Overlap Invariant**: Parallel overlapping segments of distinct nets sharing the same track coordinates have infinite cost penalty and are strictly forbidden.
4. **Deterministic Invariance**: Two identical inputs $\{V, E, \text{Options}\}$ processed in any order on any platform (Go native vs WASM) must produce bit-for-bit identical vertex coordinates and metric vectors.
5. **Incremental Equivalence**: For any sequence of state transitions $S_0 \xrightarrow{\Delta_1} S_1 \xrightarrow{\Delta_2} S_2$, the computed state $S_2$ is mathematically identical to a fresh computation on $S_2$ from scratch.
