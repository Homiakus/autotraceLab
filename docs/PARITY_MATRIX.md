# AutoTrace TS ↔ Go Parity Matrix

Status: **Living Tracking Document**  
Authority: `docs/MASTER_IMPLEMENTATION_PLAN.md`  
Scope: All 15 TypeScript algorithm files and their Go equivalents in `go_engine/core`.

---

## 1. Parity Levels Definition

- **P0 (Contract Parity)**: Exact input/output interface, default values, presence of optional fields vs explicit zero, failure/error semantics.
- **P1 (Invariant Parity)**: Hard geometric properties (0 block penetrations, strictly 90° port exit/entry stubs, 0 collinear overlaps).
- **P2 (Numerical / Structural Parity)**: Discrete decisions, graph topology, coordinates and calculated metrics within declared tolerances ($\epsilon \le 10^{-6}$ for coordinates, $\epsilon \le 10^{-4}$ for spline curves).
- **P3 (Quality / Pareto Parity)**: Go-specific optimized algorithms achieve equal or Pareto-superior QualityVector scores.

---

## 2. Comprehensive Algorithm Parity Status

| TS Source File | Primary Functionality | Go Core Target | Parity Target | Current Status | Parity Fixture Path |
|---|---|---|---|---|---|
| `src/algorithms/blockGeometry.ts` | Block sizing, 6 shapes, port coordinates, slot search | `go_engine/core/block_geometry.go` | P0, P1, P2 | ✅ Passed | `testdata/parity/geometry/` |
| `src/algorithms/wireArtifactCleaner.ts` | Multi-pass path simplification, 0-bend, raycast | `go_engine/core/artifact_cleaner.go` | P0, P1, P2 | ✅ Passed | `testdata/parity/cleaner/` |
| `src/algorithms/orthogonalAStarRouter.ts` | Weighted A*, occupancy grid, proximity penalty | `go_engine/core/orthogonal_router.go` | P0, P1, P2, P3 | ✅ Passed | `testdata/parity/router_astar/` |
| `src/algorithms/metrics.ts` | QualityVector, excess wirelength, crossings, collisions | `go_engine/core/metrics.go` | P0, P1, P2 | ✅ Passed | `testdata/parity/metrics/` |
| `src/algorithms/labelLayout.ts` | On-arrow segment solver, Liang-Barsky, clearance | `go_engine/core/label_layout.go` | P0, P1, P2 | ✅ Passed | `testdata/parity/labels/` |
| `src/algorithms/nlpOptimizer.ts` | Multi-objective layout gradient descent $\Phi(X)$ | `go_engine/core/nlp_optimizer.go` | P0, P1, P2, P3 | ✅ Passed | `testdata/parity/nlp/` |
| `src/algorithms/manhattanChannelRouter.ts` | Deterministic L/Z/C channel corridor router | `go_engine/core/alternate_routers.go` | P0, P1, P2 | ✅ Implemented | `testdata/parity/router_manhattan/` |
| `src/algorithms/leeWaveRouter.ts` | BFS wave propagation router with backtracking | `go_engine/core/alternate_routers.go` | P0, P1, P2 | ✅ Implemented | `testdata/parity/router_lee/` |
| `src/algorithms/splineRouter.ts` | Cubic Bézier spline routing with tangent normals | `go_engine/core/alternate_routers.go` | P0, P1, P2 | ✅ Implemented | `testdata/parity/router_spline/` |
| `src/algorithms/bridgeJumps.ts` | Intersection detection, arc/bridge hops, fillets | `go_engine/core/bridge_geometry.go` | P0, P1, P2 | 🟡 Planned | `testdata/parity/bridges/` |
| `src/algorithms/sugiyamaLayout.ts` | 4-stage layered DAG layout (barycentric sweeps) | `go_engine/core/layout_algorithms.go` | P0, P1, P2 | ✅ Implemented | `testdata/parity/layout_sugiyama/` |
| `src/algorithms/forceLayout.ts` | Spring-electrical force-directed layout + flow bias | `go_engine/core/layout_algorithms.go` | P0, P1, P2 | ✅ Implemented | `testdata/parity/layout_force/` |
| `src/algorithms/orthogonalGridLayout.ts` | Matrix placement layout for topological circuits | `go_engine/core/layout_algorithms.go` | P0, P1, P2 | ✅ Implemented | `testdata/parity/layout_grid/` |
| `src/algorithms/spatialGrid.ts` | 2D spatial hash for rapid obstacle & segment lookup | `go_engine/core/scene_engine.go` | P0, P1, P2 | ✅ Implemented | `testdata/parity/spatial/` |
| `src/algorithms/unifiedOptimizer.ts` | Unified Co-Optimization pipeline orchestrator | `go_engine/core/unified_optimizer.go` | P0, P1, P2 | 🟡 Planned | `testdata/parity/unified/` |

---

## 3. Parity Gates Verification Status

- [x] **Contract Definition**: `docs/MATHEMATICAL_CONTRACT.md` authored and frozen.
- [x] **Parity Matrix**: Initial parity tracking matrix established and maintained.
- [x] **Fixture Exporter (TS)**: Script (`scripts/exportParityFixtures.ts`) to generate canonical JSON test fixtures from TS oracle.
- [x] **Fixture Runner (Go)**: Go test harness (`go_engine/core/parity_test.go`) to execute identical fixtures and verify exact / tolerance match.
- [x] **Differential CI Gate**: Automated comparison tool (`scripts/runDifferentialParity.ts`, `npm run parity`) checking diffs and writing `docs/PARITY_REPORT.md`.
