import React, { useState } from 'react';
import { Copy, Check, Code2, Sparkles, Terminal, FileCode, CheckCircle2, Download, Package } from 'lucide-react';
import { generateAndDownloadProjectZip } from '../utils/zipExporter';

export const CodeExportView: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [activeTab, setActiveTab] = useState<'dsl' | 'typescript' | 'json'>('dsl');

  const handleDownloadZip = async () => {
    try {
      setIsDownloadingZip(true);
      await generateAndDownloadProjectZip();
    } catch (err) {
      console.error('Failed to generate ZIP archive:', err);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const sampleCompactDsl = `// =========================================================================
// AutoTrace Compact Textual DSL (Clean Human & LLM-Friendly Diagram Model)
// =========================================================================

block SENSOR [shape=rounded, title="CMOS Camera 4K", category=source, x=60, y=100, w=170, h=120, clearance=12] {
  in[top]    VDD: power [pin=1]
  in[top]    GND: ground [pin=2]
  out[right] MIPI_0: bus [pos=0.3]
  out[right] MIPI_1: bus [pos=0.7]
}

block NPU [shape=chip_ic, title="Tensor NPU Core", category=processor, x=380, y=100, w=200, h=140, pinned=true] {
  in[left]   LANE0: bus [pos=0.3]
  in[left]   LANE1: bus [pos=0.7]
  out[right] DETECTIONS: bus [pos=0.5]
}

block DISPLAY [shape=rectangle, title="AMOLED Display Panel", category=sink, x=720, y=100, w=180, h=100] {
  in[left]   SPI_IN: bus [pos=0.5]
}

// 100% Deterministic Orthogonal Wire Traces with Labels
SENSOR.MIPI_0 -> NPU.LANE0 [label="MIPI 2.5 Gbps", color="#38bdf8"]
SENSOR.MIPI_1 -> NPU.LANE1 [label="MIPI 2.5 Gbps", color="#38bdf8"]
NPU.DETECTIONS -> DISPLAY.SPI_IN [label="Bounding Boxes", color="#10b981"]`;

  const sampleJsonSchema = JSON.stringify({
    "$schema": "https://autotrace.dev/schemas/v1/diagram.json",
    "nodes": [
      {
        "id": "MCU",
        "title": "STM32F401 Microcontroller",
        "shape": "chip_ic",
        "x": 100,
        "y": 120,
        "width": 180,
        "height": 110,
        "ports": [
          { "id": "vdd", "name": "VDD", "type": "input", "side": "top", "dataType": "power" },
          { "id": "tx", "name": "UART_TX", "type": "output", "side": "right", "dataType": "signal" }
        ]
      }
    ],
    "edges": [
      {
        "id": "e1",
        "sourceBlockId": "MCU",
        "sourcePortId": "tx",
        "targetBlockId": "SENSOR",
        "targetPortId": "rx",
        "label": "Telemetry Stream"
      }
    ]
  }, null, 2);

  const sampleTypeScriptCode = `/**
 * =========================================================================
 * HYBRID GOLD-STANDARD GRAPH ROUTER & PLACEMENT ENGINE (TypeScript)
 * Stage 1: Sugiyama Layered Layout (Cycle Breaking -> Layering -> Barycenter)
 * Stage 2: Orthogonal A* Router with Port Clearance & Bend Penalties
 * =========================================================================
 */

import { routeOrthogonal, parseDSL, formatDSL } from '@autotrace/sdk';

// 1. Parse diagram from human-readable compact text DSL
const { nodes, edges } = parseDSL(\`
  block MCU [shape=chip_ic, title="STM32F401"] {
    out[right] TX: signal
  }
  block SENSOR [shape=rounded, title="BME280"] {
    in[left] RX: signal
  }
  MCU.TX -> SENSOR.RX [label="SPI 10MHz"]
\`);

// 2. Compute 100% collision-free orthogonal routing
const routedEdges = routeOrthogonal(nodes, edges, {
  gridSize: 10,
  obstacleClearance: 14,
  bendPenalty: 35,
});

console.log('Routed Nets:', routedEdges.length);`;

  const getActiveCode = () => {
    switch (activeTab) {
      case 'dsl': return sampleCompactDsl;
      case 'typescript': return sampleTypeScriptCode;
      case 'json': return sampleJsonSchema;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in text-[#e0e2e5]">
      {/* Header Bento Box */}
      <div className="bg-[#16181d] rounded-xl border border-white/5 p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-[10px] text-blue-400 font-mono uppercase tracking-widest font-semibold">
              Compact DSL & Production-Ready SDK
            </span>
          </div>
          <h2 className="text-xl sm:text-3xl font-bold tracking-tight text-white uppercase font-sans">
            Компактный DSL & Экспорт Схемы
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Лаконичный текстовый формат для LLM и разработчиков, чистый TypeScript SDK и схема JSON.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            id="btn-download-full-zip"
            onClick={handleDownloadZip}
            disabled={isDownloadingZip}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition-all active:scale-95 whitespace-nowrap disabled:opacity-50"
          >
            {isDownloadingZip ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Упаковка ZIP...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-emerald-200" />
                <span>Скачать Полный Архив (.ZIP)</span>
              </>
            )}
          </button>

          <button
            id="btn-copy-code"
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e293b] hover:bg-[#283548] border border-blue-500/30 text-white text-xs font-bold uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-blue-400" />}
            <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
          </button>
        </div>
      </div>

      {/* Code Editor Bento Box */}
      <div className="relative bg-[#0c0d10] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#16181d] border-b border-white/5 text-xs text-gray-400 font-mono">
          {/* Format Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('dsl')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'dsl'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              📐 Compact AutoTrace DSL
            </button>
            <button
              onClick={() => setActiveTab('typescript')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'typescript'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              ⚡ TypeScript API
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'json'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              📦 JSON Schema
            </button>
          </div>

          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-mono hidden sm:inline">
            Zero Runtime Dependencies
          </span>
        </div>

        <pre className="p-5 overflow-x-auto text-xs font-mono leading-relaxed text-gray-300 bg-[#0c0d10] max-h-[580px]">
          <code>{sampleTypeScriptCode}</code>
        </pre>
      </div>
    </div>
  );
};
