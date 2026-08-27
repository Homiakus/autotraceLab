# AutoTrace TS ↔ Go Parity CI Report

- **Generated**: 2026-08-27T06:09:16.777Z
- **Git Commit**: `4d7a6a8e997a0e34f027f45537c5671d2a51c7a0`
- **Total Algorithmic Surfaces**: 15
- **Covered Surfaces**: 6
- **Fully Passed (P0-P2)**: 4
- **Partial / In-Progress**: 2

## Surface Details

| Algorithmic Family | Go Target | Parity Level | Status | Notes |
|---|---|---|---|---|
| Metamorphic Invariance Suite | `go_engine/core/metamorphic_test.go` | P0, P1, P2, P3 | ✅ PASS | Translation invariance, permutation stability, cleaner idempotence, patch equivalence, and metric determinism verified. |
| Block Geometry & Auto-Sizing | `go_engine/core/block_geometry.go` | P0, P1, P2 | ✅ PASS | 6 shapes perimeter coordinates, min dimensions, and deterministic port placement match TS oracle. |
| Wire Artifact Cleaner | `go_engine/core/artifact_cleaner.go` | P0, P1, P2 | ✅ PASS | Collinear point merge and U-turn reduction verified. |
| Orthogonal A* Router | `go_engine/core/orthogonal_router.go` | P0, P1, P2, P3 | ✅ PASS | Obstacle detour, 4-way normal stubs, multi-net channel separation, and prohibited shared wire segments verified. |
| Strict Label Placement | `go_engine/core/label_layout.go` | P0, P1, P2 | 🟡 PARTIAL | On-arrow segment solver active; Liang-Barsky wire clipping under porting. |
| Canonical Metrics & QualityVector | `go_engine/core/metrics.go` | P0, P1, P2 | 🟡 PARTIAL | Collinear overlap and crossing metrics aligned; full lower-bound wirelength in progress. |
