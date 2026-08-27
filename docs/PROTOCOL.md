# AutoTrace Engine Protocol v2 Specification

## 1. Overview

Communication between the host application (Browser / Worker) and the AutoTrace engine (Go WASM / Subprocess) occurs via the standard Protocol Version 2 envelope over JSON-RPC.

## 2. Request Envelope

```json
{
  "protocol": 2,
  "requestId": "req_1787814802100_1",
  "operation": "scene.open",
  "payload": {
    "graphId": "main_diagram",
    "revision": 1,
    "nodes": [...],
    "edges": [...],
    "options": {...}
  }
}
```

## 3. Supported Operations

| Operation | Description | Payload Schema |
|---|---|---|
| `hello` | Capability negotiation & version check | `{}` |
| `layout` | Stateless orthogonal routing & metrics | `{ graphId?, nodes, edges, options }` |
| `scene.open` | Initialize incremental stateful scene | `{ graphId, revision, nodes, edges, options }` |
| `scene.patch` | Atomic incremental diff update | `{ graphId, patch: { baseRevision, revision, changedBlocks, changedEdges, removedBlockIds, removedEdgeIds } }` |
| `scene.update_options` | Update routing weights & tolerances | `{ graphId, options }` |
| `scene.snapshot` | Query current scene state & metrics | `{ graphId }` |
| `scene.close` | Release scene memory | `{ graphId }` |
| `nlp.optimize` | Continuous mathematical optimization | `{ nodes, edges, options, params }` |
| `unified.co_optimize`| 5-stage joint co-optimization | `{ nodes, edges, options }` |

## 4. Error Responses

Standardized structured error codes:
- `AUTOTRACE_PROTOCOL_MISMATCH`: Client sent incompatible protocol version.
- `AUTOTRACE_REVISION_CONFLICT`: Optimistic lock violation on `scene.patch` (client must re-sync).
- `AUTOTRACE_SCENE_NOT_FOUND`: Referenced `graphId` has not been opened or has been closed.
- `AUTOTRACE_INVALID_PAYLOAD`: Payload decoding or validation error.
- `AUTOTRACE_INVALID_GRAPH`: Topology validation failed.
- `AUTOTRACE_UNSUPPORTED_OPERATION`: Requested operation is not recognized by engine.
- `AUTOTRACE_TIMEOUT`: Request exceeded client timeout budget.
- `AUTOTRACE_CANCELLED`: Operation was cancelled by client abort signal.
