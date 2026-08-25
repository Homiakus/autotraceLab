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

Planned next extraction: NLP/global optimization, full artifact cleaner parity, scene patch/incremental APIs, and removal of duplicated root-package implementations after parity gates pass.
