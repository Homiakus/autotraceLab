# AutoTrace Architecture & System Design

## 1. System Overview

AutoTrace is a high-performance, deterministic orthogonal graph layout, routing, and declarative visual modeling engine. It delivers dual-runtime capability across high-throughput native Go and client-side TypeScript / WebAssembly (WASM).

```
+-----------------------------------------------------------------------+
|                           Host Application                            |
|             (React Web App, Standalone Viewer, Custom CAD)            |
+-----------------------------------------------------------------------+
                                   |
                         AutoTrace SDK Facade
                         (src/sdk/index.ts)
                                   |
         +-------------------------+-------------------------+
         |                                                   |
  Declarative Registry Store                          EngineClient
  (src/registry/RegistryClient.ts)                    (src/engine/EngineClient.ts)
  - Namespaced Types (core/block/*)                   - Protocol v2 Envelope
  - Shape & Envelope Definitions                      - JSON-RPC over Web Worker
  - Theme Tokens & Appearance                         - Automatic Retries & Conflict Recovery
         |                                                   |
         |                                           autotrace.worker.ts
         |                                           (src/engine/wasmLoader.ts)
         |                                                   |
         +-------------------------+-------------------------+
                                   |
                       Go Core Routing Engine
                       (go_engine/core/)
                       - SceneSpatialIndex (2D Grid Index)
                       - SparseVisibilityGraph (Roadmap)
                       - RouteOrthogonalAStar (Channel A*)
                       - BridgeGeometry & G1 Bézier Fillets
                       - UnifiedCoOptimizer & NLPOptimizer
                       - Canonical DetailedMetrics & QualityVector
```

---

## 2. Layered Architecture

### Layer 1: Core Mathematical Engine (`go_engine/core/`)
- Single mathematical source of truth.
- Free of UI or DOM dependencies.
- Completely deterministic with zero random seeds.
- Includes metamorphic invariance test suites and continuous differential parity harness.

### Layer 2: Protocol & Serialization Boundary (`go_engine/protocol.go`, `src/engine/`)
- Standardized `CONTRACT_PROTOCOL_VERSION = 2`.
- JSON-RPC over Web Worker or Native Subprocess.
- Atomic scene lifecycle: `scene.open`, `scene.patch`, `scene.update_options`, `scene.snapshot`, `scene.close`.
- Optimistic concurrency control via monotonic revision tracking (`AUTOTRACE_REVISION_CONFLICT`).

### Layer 3: Declarative Type Registry (`src/registry/`, `go_engine/core/registry.go`)
- Namespaced identifiers (`core/block/process`, `core/edge/signal`).
- Separation of concerns:
  - `InvalidationRender`: title, color, icon -> 0 wire reroutes.
  - `InvalidationSemantic`: tags, metadata -> 0 wire reroutes.
  - `InvalidationRoutingGeometry`: position moves, clearance changes -> net-local reroute.
  - `InvalidationRoutingCost`: weight tuning -> global reroute.

### Layer 4: Embedding SDK & Host Adapters (`src/sdk/`)
- Headless embedding SDK for third-party host integration.
- Pluggable storage adapters (`LocalStorageAdapter`, `InMemoryStorageAdapter`).
- Zero direct coupling to AutoTraceLab UI state.
