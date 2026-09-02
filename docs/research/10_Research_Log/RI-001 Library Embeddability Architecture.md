---
type: research-iteration
id: RI-001
topic: "AutoTrace SDK Embeddability & Architecture Improvement Loop"
status: complete
date: 2026-09-02
tags:
  - iteration
  - audit
  - refactor
---

# 📝 Research Iteration RI-001: Library Embeddability & Packaging Upgrade

## 1. Objective
Устранить выявленные при аудите барьеры встраивания библиотеки `@autotrace/sdk` во внешние приложения, превратить её в Zero-Dependency SDK с поддержкой чистого синхронного роутинга и сформировать проверяемую исследовательскую базу знаний в формате Obsidian.

## 2. Completed Actions
1. **Packaging Refactor:**
   - Очищен `package.json`: все runtime-зависимости (React, Express, Vite, Tailwind, Lucide, @google/genai) перенесены в `devDependencies`.
   - `dependencies` выставлен в `{}` (0 внешних зависимостей в проде).
   - `files` скорректирован до `["dist/lib"]`.
2. **API Ergonomics & Pure Functions:**
   - В `src/sdk/index.ts` добавлены прямой экспорт всех типов и чистая синхронная функция `routeOrthogonal(nodes, edges, options?)`.
   - Реэкспортированы утилиты геометрии и метрик (`getPortCoordinates`, `deriveBlockGeometry`, `calculateMinimumBlockSize`, `cleanOrthogonalArtifacts`, `simplifyOrthogonalPath`, `calculateBenchmarkMetrics`, `classifyBlockChange`, `classifyEdgeChange`).
3. **WASM / Worker Resiliency:**
   - `WasmLoader` расширен интерфейсом `WasmLoaderOptions` с поддержкой `wasmBinary: ArrayBuffer | Uint8Array` и кастомных раннеров.
   - `TypeScriptBackend` защищен от утечек памяти при забытых `scene.close()` через bounded eviction (лимит активных сцен).
4. **Research Workspace:**
   - Сформирован структурированный Obsidian Vault в `docs/research/` по стандарту Master Prompt:
     - `00_Home/Research Dashboard.md`
     - `01_Scope/Research Brief.md`
     - `01_Scope/Research Questions.md`
     - `01_Scope/Terminology.md`
     - `03_Entities/Products/AutoTrace SDK.md`
     - `05_Analysis/Comparisons/Diagram Routing Engines Benchmark.md`
     - `08_Reports/Embedding Guide.md`

## 3. Verification Evidence
* `npm run test:sdk`: ✅ **Passed** (включая проверку синхронного роутинга `routeOrthogonal`).
* `npm test`: ✅ **41/41 Passed** (0 failures, 425 ms).
* `npm run build:lib`: ✅ **Passed** (ESM `index.js`, CJS `index.cjs`, `.d.ts` declaration maps).
* `go test ./...`: ✅ **Passed** (0.076s).
