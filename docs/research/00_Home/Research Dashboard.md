---
type: research-dashboard
status: active
research_topic: "AutoTrace SDK (@autotrace/sdk): High-Performance Deterministic Embeddable Routing Engine"
research_version: 1.0.0
confidence: high
last_updated: 2026-09-02
tags:
  - dashboard
  - research
  - autotrace
  - routing
---

# 🗺️ AutoTrace Library Research Dashboard

## Research Objective
Establish an evidence-based, verifiable architectural foundation for **`@autotrace/sdk`** and its Go/WASM core as a zero-overhead, deterministic, high-performance embeddable routing & layout engine for modern diagram editors (React, Vue, Svelte), desktop applications (Electron, Tauri), server-side microservices (Go, Node.js), and EDA/CAD systems.

---

## Current Research Status Matrix

| Dimension | Target Standard | AutoTrace Status | Evidence Strength | Next Action |
| :--- | :--- | :---: | :---: | :--- |
| **Packaging & Zero-Deps** | 0 runtime deps, subpath exports | ✅ **100% Zero-Deps** | ●●● Verified | Monitored in CI |
| **Pure Synchronous DX** | `routeOrthogonal(nodes, edges)` | ✅ **Active** | ●●● Verified | Add benchmark suite |
| **Stateful Reactive Sessions** | Diff patches & revision conflict checks | ✅ **Active** | ●●● Verified | Memory limits enforced |
| **90° Port Invariants** | Perpendicular outflow/inflow on all faces | ✅ **100% Strict** | ●●● Verified | 16/16 combinations passed |
| **Collinear Overlaps** | 0 px wire coincidences | ✅ **0 px Overlap** | ●●● Verified | Penalty 50,000 + Cleaner |
| **WASM / Worker Interop** | Isomorphic loader with binary buffers | ✅ **Active** | ●●● Verified | Tested in Browser/Node |
| **Go Native Core** | Standalone Go module with Context | ✅ **Active** | ●●● Verified | 0.076s test pass rate |

---

## Key Navigation (MOC Links)
* 📋 **Research Brief**: [[01_Scope/Research Brief|Research Brief]]
* ❓ **Research Questions**: [[01_Scope/Research Questions|Research Questions & Hypothesis]]
* 📖 **Controlled Terminology**: [[01_Scope/Terminology|Controlled Terminology]]
* 🧱 **Entities**: [[03_Entities/Products/AutoTrace SDK|AutoTrace SDK]] | [[03_Entities/Products/ELK.js|ELK.js]] | [[03_Entities/Products/Dagre|Dagre]] | [[03_Entities/Products/libavoid|libavoid]]
* ⚖️ **Evidence Ledger**: [[04_Evidence/Evidence Ledger|Evidence Ledger]]
* ⚡ **Benchmark Analysis**: [[05_Analysis/Comparisons/Diagram Routing Engines Benchmark|Diagram Routing Engines Benchmark]]
* 📊 **Reports**: [[08_Reports/Executive Summary|Executive Summary]] | [[08_Reports/Embedding Guide|Embedding Guide]]
* 📝 **Research Log**: [[10_Research_Log/RI-001 Library Embeddability Architecture|Iteration RI-001]]
