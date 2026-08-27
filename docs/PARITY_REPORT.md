# AutoTrace TS ↔ Go Parity CI Report

- **Generated**: 2026-08-27T05:56:10.562Z
- **Git Commit**: `cf0c6d81d6e6b7b186a34605b8274683a5f18d48`
- **Total Algorithmic Surfaces**: 15
- **Covered Surfaces**: 5
- **Fully Passed (P0-P2)**: 2
- **Partial / In-Progress**: 3

## Surface Details

| Algorithmic Family | Go Target | Parity Level | Status | Notes |
|---|---|---|---|---|
| Block Geometry & Auto-Sizing | `go_engine/core/block_geometry.go` | P0, P1, P2 | ✅ PASS | 6 shapes perimeter coordinates, min dimensions, and deterministic port placement match TS oracle. |
| Wire Artifact Cleaner | `go_engine/core/artifact_cleaner.go` | P0, P1, P2 | ✅ PASS | Collinear point merge and U-turn reduction verified. |
| Orthogonal A* Router | `go_engine/core/orthogonal_router.go` | P0, P1, P2, P3 | 🟡 PARTIAL | Obstacle detour and deterministic grid routing active; congestion fields in progress. |
| Strict Label Placement | `go_engine/core/label_layout.go` | P0, P1, P2 | 🟡 PARTIAL | On-arrow segment solver active; Liang-Barsky wire clipping under porting. |
| Canonical Metrics & QualityVector | `go_engine/core/metrics.go` | P0, P1, P2 | 🟡 PARTIAL | Collinear overlap and crossing metrics aligned; full lower-bound wirelength in progress. |
