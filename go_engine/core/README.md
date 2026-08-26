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

## Mathematical parity requirement

`go_engine/core` is not considered the canonical replacement for the TypeScript/React mathematical engine until the differential parity gates are complete. Migration must preserve the mathematical contracts, hard constraints, objective functions, default semantics and deterministic behavior of the reference implementations before Go-specific optimizations are allowed to replace them.

The normative migration program is documented in:

- [`docs/REACT_TO_GO_MATHEMATICAL_PARITY_PLAN.md`](../../docs/REACT_TO_GO_MATHEMATICAL_PARITY_PLAN.md)
- [`docs/PARETO_IMPLEMENTATION_PLAN.md`](../../docs/PARETO_IMPLEMENTATION_PLAN.md)

The required order is **contract/fixture freeze -> cross-language parity -> Go optimization -> production cutover -> TypeScript retirement**.

Planned extraction/parity work includes full artifact-cleaner parity, the complete weighted/congestion-aware Orthogonal A* model, strict labels and canonical QualityVector metrics, layout families, NLP/global optimization, unified co-optimization, render-independent bridge/G¹ geometry, and scene patch/incremental integration.
