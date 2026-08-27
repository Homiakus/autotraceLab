# AutoTrace Headless Embedding SDK Guide

## 1. Installation & Quickstart

AutoTrace provides a zero-dependency headless SDK for embedding into React, Vue, Svelte, or native TypeScript applications.

```typescript
import { createAutoTraceClient, InMemoryStorageAdapter } from '@autotrace/sdk';

// 1. Initialize client with optional custom storage adapter
const client = createAutoTraceClient({
  storage: new InMemoryStorageAdapter(),
});

// 2. Open an incremental scene
const result = await client.openScene(
  'substation_topology',
  [
    { id: 'gen1', title: 'Generator', x: 50, y: 50, width: 120, height: 60, outputs: [{ id: 'out', side: 'right', type: 'output' }] },
    { id: 'tx1', title: 'Transformer', x: 350, y: 50, width: 140, height: 80, inputs: [{ id: 'in', side: 'left', type: 'input' }] },
  ],
  [
    { id: 'w1', sourceBlockId: 'gen1', sourcePortId: 'out', targetBlockId: 'tx1', targetPortId: 'in' },
  ],
  {
    gridSize: 10,
    cornerType: 'fillet',
    lineJumpType: 'arc',
  }
);

console.log('Routed edges:', result.edges);
console.log('Quality metrics:', result.metrics);
```

## 2. Declarative Type Registry

```typescript
import { globalRegistryStore } from '@autotrace/sdk';

// Register custom domain block type
globalRegistryStore.importPackage({
  id: 'cad/package/hydraulic',
  name: 'Hydraulic Components',
  version: '1.0.0',
  blockTypes: [
    {
      id: 'cad/block/pump',
      name: 'Hydraulic Pump',
      category: 'processor',
      status: 'published',
      version: '1.0.0',
      shapeId: 'core/shape/circle',
      defaultWidth: 100,
      defaultHeight: 100,
      minWidth: 80,
      minHeight: 80,
      ports: [
        { id: 'inlet', name: 'IN', type: 'input', preferredSide: 'left' },
        { id: 'outlet', name: 'OUT', type: 'output', preferredSide: 'right' },
      ],
    },
  ],
});
```
