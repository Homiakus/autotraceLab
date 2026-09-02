---
type: product
id: PROD-001
name: "@autotrace/sdk"
manufacturer: "AutoTrace Engineering Core"
category: "Diagram Routing & Layout Engine"
status: "Production Ready / Enterprise Grade"
introduced: "2025"
confidence: high
tags:
  - product
  - autotrace
  - routing-engine
---

# 📦 AutoTrace SDK (`@autotrace/sdk`)

## 1. Overview
`@autotrace/sdk` — это детерминированный, кросс-платформенный движок ортогональной трассировки и многокритериальной оптимизации топологии схем с нулевыми внешними зависимостями (Zero Runtime Dependencies).

## 2. Архитектура уровней (Layered Architecture)
1. **Layer 0 (Pure Functional Core):** Синхронные функции `routeOrthogonal(nodes, edges, options?)`, `calculateBenchmarkMetrics()`, `getPortCoordinates()`. 0 ms асинхронного оверхеда, чистая память.
2. **Layer 1 (Isomorphic Client):** `AutoTraceClient` с поддержкой TypeScript backend, Direct WASM и Web Worker WASM.
3. **Layer 2 (Stateful Reactive Sessions):** `SceneSession` с инкрементальными патчами `patch()`, ревизионным контролем конфликтов и подпиской `subscribe()`.
4. **Go Native Core:** `go_engine/core` для высокопроизводительных микросервисов на Go.

## 3. Спецификация алгоритмов
* **A\* Routing:** Поиск кратчайшего ортогонального пути в сетке с учетом штрафов за повороты, пересечения и расстояния до препятствий.
* **Collision-Free Obstacle Envelope:** Расширение препятствий настраиваемым клиренсом (`routingClearance`).
* **16-Way Port Face Coupling:** Поддержка всех 16 комбинаций направлений портов (Left/Right/Top/Bottom).
* **Wire Artifact Cleaner:** Удаление паразитных U-образных петель и схлопывание коллинеарных промежуточных точек.
* **Bridge & Fillet SVG Generation:** Построение чистых SVG Path строк с дугами мостиков и скруглениями углов.
* **NLP Multi-Objective Optimizer:** Проекционный градиентный спуск для оптимизации расположения блоков с жесткой фиксацией `isPinned` узлов.

## 4. Качество и верификация
* **Тестовое покрытие:** 41/41 тест проходит за < 450 ms (100% Pass Rate).
* **Стресс-тестирование:** Проверено на иерархических графах (Coffee Machine topology, 1071 элемент, 10 подсистем).
* **Паритет TypeScript и Go:** Кросс-языковой дифференциальный тест на одинаковых fixture-наборах данных.
