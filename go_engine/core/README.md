# AutoTrace Go Core

Importable computation package for AutoTrace consumers.

Import path:

```go
import core "github.com/Homiakus/autotraceLab/go_engine/core"
```

Current extracted surface:

- versioned contract identity (`ContractVersion`, `EngineID`);
- scene validation;
- block/port geometry;
- deterministic orthogonal A* routing;
- route cleanup;
- label placement;
- benchmark/quality metrics;
- typed `RouteRequest` / `RouteResult` API.

The root `go_engine` package remains the WASM/native compatibility shell during migration. New protocol consumers are routed through this package. Legacy global functions remain temporarily for AutoTraceLab UI compatibility.

## Master migration requirement

`go_engine/core` is **not** considered the canonical replacement for the TypeScript/React mathematical engine until the blocking parity and cutover gates in the master program are complete.

The single authoritative implementation plan is:

- [`docs/MASTER_IMPLEMENTATION_PLAN.md`](../../docs/MASTER_IMPLEMENTATION_PLAN.md)

The previous Pareto and React→Go parity plans remain reference/audit material only. If their ordering conflicts with the master plan, the master plan wins.

The required order is:

**contract + TypeScript oracle freeze → cross-language data semantics → family-by-family mathematical parity → incremental SceneEngine integration → Go-specific optimization → shadow rollout → production Go/WASM cutover → TypeScript reference-only → retirement.**

Go-specific optimizations must not weaken mathematical contracts, hard constraints, objective functions, default semantics or deterministic behavior. Where optimized output intentionally differs from the frozen TypeScript reference, the canonical QualityVector and hard-validity gates must prove that the Go result is equal or Pareto-better.

The consolidated program covers full artifact-cleaner parity, weighted/congestion-aware Orthogonal A*, alternate routers, all layout families, strict labels, canonical metrics, NLP/global optimization, Unified Co-Optimization, renderer-independent bridge/G¹ geometry, incremental scene integration, scene-level spatial/visibility indexes, reusable SDK boundaries, versioned registries, customization/admin UX and production delivery.
