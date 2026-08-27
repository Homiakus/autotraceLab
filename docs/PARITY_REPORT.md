# AutoTrace TS ↔ Go Parity CI Report

- **Generated**: 2026-08-27T07:05:20.725Z
- **Git Commit**: `db9fb7692c7c54af3ba88638ca5f3a57931e8ede`
- **Total Algorithmic Surfaces**: 15
- **Covered Surfaces**: 9
- **Fully Passed (P0-P2)**: 9
- **Partial / In-Progress**: 0

## Surface Details

| Algorithmic Family | Go Target | Parity Level | Status | Notes |
|---|---|---|---|---|
| Metamorphic Invariance Suite | `go_engine/core/metamorphic_test.go` | P0, P1, P2, P3 | ✅ PASS | Translation invariance, permutation stability, cleaner idempotence, patch equivalence, and metric determinism verified. |
| Block Geometry & Auto-Sizing | `go_engine/core/block_geometry.go` | P0, P1, P2 | ✅ PASS | 6 shapes perimeter coordinates, min dimensions, and deterministic port placement match TS oracle. |
| Wire Artifact Cleaner | `go_engine/core/artifact_cleaner.go` | P0, P1, P2 | ✅ PASS | Collinear point merge and U-turn reduction verified. |
| Orthogonal A* Router | `go_engine/core/orthogonal_router.go` | P0, P1, P2, P3 | ✅ PASS | Obstacle detour, 4-way normal stubs, multi-net channel separation, and prohibited shared wire segments verified. |
| Strict Label Placement | `go_engine/core/label_layout.go` | P0, P1, P2 | ✅ PASS | On-arrow candidate search, obstacle avoidance, Liang-Barsky wire clipping, and penalty computation verified. |
| Canonical Metrics & QualityVector | `go_engine/core/metrics.go` | P0, P1, P2 | ✅ PASS | Collinear overlap, crossings, wirelength, compactness, void ratio, aspect penalty, and 9-component QualityVector verified. |
| Non-Linear Programming (NLP) Optimizer | `go_engine/core/nlp_optimizer.go` | P0, P1, P2, P3 | ✅ PASS | Multi-objective loss Φ(X), pinned anchor invariance, analytic forces, and projected gradient descent with momentum verified. |
| Bridge Jumps & G¹ Geometry | `go_engine/core/bridge_geometry.go` | P0, P1, P2 | ✅ PASS | IEEE 315 / IEC 60617 semicircular line hop arcs and G¹ cubic Bézier corner fillets (κ ≈ 0.55228) verified. |
| Unified Co-Optimization Engine | `go_engine/core/unified_optimizer.go` | P0, P1, P2, P3 | ✅ PASS | DAG topological layering, port-aware barycentric sweeps, dynamic channel allocation, pin micro-alignment, and artifact-free routing verified. |
