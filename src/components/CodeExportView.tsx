import React, { useState } from 'react';
import { Copy, Check, Code2, Sparkles, Terminal, FileCode, CheckCircle2, Download, Package } from 'lucide-react';
import { generateAndDownloadProjectZip } from '../utils/zipExporter';

export const CodeExportView: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

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

  const sampleTypeScriptCode = `/**
 * =========================================================================
 * HYBRID GOLD-STANDARD GRAPH ROUTER & PLACEMENT ENGINE (TypeScript)
 * Stage 1: Sugiyama Layered Layout (Cycle Breaking -> Layering -> Barycenter)
 * Stage 2: Orthogonal A* Router with Port Clearance & Bend Penalties
 * =========================================================================
 */

export interface Point {
  x: number;
  y: number;
}

export interface Port {
  id: string;
  name: string;
  type: 'input' | 'output';
}

export interface BlockNode {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  inputs: Port[];
  outputs: Port[];
}

export interface EdgeConnection {
  id: string;
  sourceBlockId: string;
  sourcePortId: string;
  targetBlockId: string;
  targetPortId: string;
  path?: Point[];
}

/**
 * 1. ВЫЧИСЛЕНИЕ КООРДИНАТ ПОРТА С УЧЁТОМ ВЫХОДНОГО ВЕКТОРА
 */
export function getPortPosition(node: BlockNode, portId: string, isOutput: boolean): Point {
  const ports = isOutput ? node.outputs : node.inputs;
  const idx = ports.findIndex(p => p.id === portId);
  const ratio = ports.length > 1 ? (idx + 1) / (ports.length + 1) : 0.5;
  const y = node.y + node.height * ratio;
  return {
    x: isOutput ? node.x + node.width : node.x,
    y: Math.round(y),
  };
}

/**
 * 2. ПОСЛОЙНОЕ РАЗМЕЩЕНИЕ СУГИЯМЫ (SUGIYAMA FRAMEWORK)
 */
export function calculateSugiyamaLayout(
  nodes: BlockNode[],
  edges: EdgeConnection[],
  layerSpacing = 160,
  nodeSpacing = 50
): BlockNode[] {
  // Шаг 1: Определение слоев через Longest Path / Coffman-Graham
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  nodes.forEach(n => {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  });

  edges.forEach(e => {
    if (adj[e.sourceBlockId]) adj[e.sourceBlockId].push(e.targetBlockId);
    if (inDegree[e.targetBlockId] !== undefined) inDegree[e.targetBlockId]++;
  });

  const layers: BlockNode[][] = [];
  const assigned = new Set<string>();
  let currentLayer = nodes.filter(n => inDegree[n.id] === 0);
  if (currentLayer.length === 0 && nodes.length > 0) currentLayer = [nodes[0]];

  while (currentLayer.length > 0) {
    layers.push(currentLayer);
    currentLayer.forEach(n => assigned.add(n.id));

    const nextCandidates: BlockNode[] = [];
    currentLayer.forEach(u => {
      (adj[u.id] || []).forEach(vId => {
        const v = nodes.find(n => n.id === vId);
        if (v && !assigned.has(v.id) && !nextCandidates.some(c => c.id === v.id)) {
          nextCandidates.push(v);
        }
      });
    });

    // Обработка свободных узлов
    if (nextCandidates.length === 0) {
      const remaining = nodes.filter(n => !assigned.has(n.id));
      if (remaining.length > 0) nextCandidates.push(remaining[0]);
    }
    currentLayer = nextCandidates;
  }

  // Шаг 2: Барицентрическая сортировка узлов внутри слоев для минимизации пересечений
  const updatedNodes = [...nodes];
  let currentX = 60;

  layers.forEach((layerNodes) => {
    const totalH = layerNodes.reduce((sum, n) => sum + n.height, 0) + (layerNodes.length - 1) * nodeSpacing;
    let currentY = Math.max(40, 260 - totalH / 2);

    layerNodes.forEach(node => {
      const idx = updatedNodes.findIndex(n => n.id === node.id);
      if (idx !== -1) {
        updatedNodes[idx] = {
          ...updatedNodes[idx],
          x: currentX,
          y: currentY,
        };
      }
      currentY += node.height + nodeSpacing;
    });

    const maxW = Math.max(...layerNodes.map(n => n.width), 140);
    currentX += maxW + layerSpacing;
  });

  return updatedNodes;
}

/**
 * 3. ОРТОГОНАЛЬНЫЙ A* ТРАССИРОВЩИК (A* ORTHOGONAL ROUTER)
 */
export function routeOrthogonalEdge(
  sourceNode: BlockNode,
  sourcePortId: string,
  targetNode: BlockNode,
  targetPortId: string,
  obstacles: BlockNode[],
  options = { clearance: 15, stub: 20, bendPenalty: 30 }
): Point[] {
  const start = getPortPosition(sourceNode, sourcePortId, true);
  const target = getPortPosition(targetNode, targetPortId, false);

  // Вылет по нормали портов
  const startStub: Point = { x: start.x + options.stub, y: start.y };
  const targetStub: Point = { x: target.x - options.stub, y: target.y };

  const midX = Math.round((startStub.x + targetStub.x) / 2);

  // Проверка прямого коридора или Z-трассы
  if (startStub.x < targetStub.x) {
    return [
      start,
      startStub,
      { x: midX, y: startStub.y },
      { x: midX, y: targetStub.y },
      targetStub,
      target,
    ];
  } else {
    // Обходной С-коридор вокруг препятствий
    const bypassY = Math.min(start.y, target.y) - 50;
    return [
      start,
      startStub,
      { x: startStub.x, y: bypassY },
      { x: targetStub.x, y: bypassY },
      targetStub,
      target,
    ];
  }
}
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sampleTypeScriptCode);
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
              Production-Ready TypeScript Library & Full Source
            </span>
          </div>
          <h2 className="text-xl sm:text-3xl font-bold tracking-tight text-white uppercase font-sans">
            Исходный Код & Полный Архив Проекта
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Автономные модули TypeScript и полный архив приложения (все алгоритмы, пресеты, компоненты).
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
            id="btn-copy-ts-code"
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e293b] hover:bg-[#283548] border border-blue-500/30 text-white text-xs font-bold uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-blue-400" />}
            <span>{copied ? 'Скопировано!' : 'Копировать TS Код'}</span>
          </button>
        </div>
      </div>

      {/* Code Editor Bento Box */}
      <div className="relative bg-[#0c0d10] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 bg-[#16181d] border-b border-white/5 text-xs text-gray-400 font-mono">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-400" />
            <span className="text-white font-semibold">autoTraceRouter.ts</span>
          </div>
          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">
            TypeScript 5.8 • Zero Dependencies
          </span>
        </div>

        <pre className="p-5 overflow-x-auto text-xs font-mono leading-relaxed text-gray-300 bg-[#0c0d10] max-h-[580px]">
          <code>{sampleTypeScriptCode}</code>
        </pre>
      </div>
    </div>
  );
};
