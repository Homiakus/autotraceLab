---
type: guide
title: "Руководство по встраиванию @autotrace/sdk в сторонние приложения"
updated: 2026-09-02
tags:
  - guide
  - embedding
  - autotrace
---

# 🚀 Руководство по встраиванию AutoTrace SDK

## 1. Установка
```bash
npm install @autotrace/sdk
```
*(Библиотека не имеет внешних runtime-зависимостей! Вес в gzip ~25 kB)*.

---

## 2. Сценарий A: Чистый синхронный расчет (Zero-Overhead / 60 FPS Canvas)
Идеально для React Flow, Vue Flow, Konva, Canvas и SVG-редакторов при перетаскивании узлов мышой:

```ts
import { routeOrthogonal, renderEdgeToSvgPath, BlockNode, EdgeConnection } from '@autotrace/sdk';

// 1. Входные узлы и соединения
const nodes: BlockNode[] = [
  {
    id: 'node1',
    title: 'Input Block',
    category: 'source',
    x: 100, y: 150, width: 120, height: 80,
    inputs: [],
    outputs: [{ id: 'out1', name: 'Out', type: 'output', side: 'right' }],
  },
  {
    id: 'node2',
    title: 'Processing Block',
    category: 'processor',
    x: 400, y: 220, width: 140, height: 90,
    inputs: [{ id: 'in1', name: 'In', type: 'input', side: 'left' }],
    outputs: [],
  },
];

const edges: EdgeConnection[] = [
  {
    id: 'edge1',
    sourceBlockId: 'node1',
    sourcePortId: 'out1',
    targetBlockId: 'node2',
    targetPortId: 'in1',
  },
];

// 2. Мгновенная синхронная трассировка (0ms Promise overhead)
const routedEdges = routeOrthogonal(nodes, edges, {
  gridSize: 10,
  obstacleClearance: 12,
  smoothCorners: true,
  cornerRadius: 8,
  jumpBridges: true,
});

// 3. Генерация готового SVG-path атрибута d="..."
const svgPathD = renderEdgeToSvgPath(routedEdges[0], routedEdges, {
  smoothCorners: true,
  cornerRadius: 8,
  enableBridges: true,
});

console.log('SVG Path:', svgPathD); // M 220 190 L 310 190 ...
```

---

## 3. Сценарий B: Реактивная сессия редактора (`SceneSession`)
Идеально для сложных схем с инкрементальными изменениями (патчами) и сохранением состояния:

```ts
import { createAutoTraceClient } from '@autotrace/sdk';

const client = createAutoTraceClient();

// 1. Открытие сцены
const session = await client.openScene({
  id: 'my-diagram',
  nodes,
  edges,
});

// 2. Реактивная подписка на изменения
const unsubscribe = session.subscribe((snapshot) => {
  console.log('Сцена обновлена, ревизия:', snapshot.revision);
});

// 3. Быстрый инкрементальный патч при перемещении одного узла
await session.patch({
  nodes: {
    upsert: [{ ...node1, x: 150, y: 180 }],
  },
});

// 4. Получение границ сцены и SVG путей
const bounds = session.getBounds();
const paths = session.toSvgPaths({ enableBridges: true });

// 5. Завершение работы
await session.close();
await client.destroy();
```

---

## 4. Сценарий C: Встраивание в Go бэкенд (`go_engine/core`)
```go
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/Homiakus/autotraceLab/go_engine/core"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	result, err := core.RouteWithContext(ctx, core.RouteRequest{
		GraphID: "server-diagram",
		Nodes:   nodes,
		Edges:   edges,
		Options: core.DefaultRoutingOptions(),
	})
	if err != nil {
		panic(err)
	}

	fmt.Printf("Успешно проложено %d ребер за %.2f ms\n", len(result.Edges), result.DurationMs)
}
```
