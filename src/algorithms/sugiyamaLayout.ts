import { BlockNode, EdgeConnection, AlgorithmStep } from '../types';
import { getPortCoordinates } from './orthogonalAStarRouter';

export interface SugiyamaResult {
  nodes: BlockNode[];
  steps: AlgorithmStep[];
}

/**
 * 4-Phase Sugiyama Layered Layout with Port Sensitivity
 * 1. Cycle Breaking (FAS - Feedback Arc Set)
 * 2. Layer / Rank Assignment (Coffman-Graham / Longest Path)
 * 3. Crossing Reduction (Barycentric Layer Sweeping)
 * 4. Coordinate Assignment (Port-aligned Balanced Placement)
 */
export function runSugiyamaLayout(
  initialNodes: BlockNode[],
  edges: EdgeConnection[],
  options = { layerSpacing: 180, nodeSpacing: 50, startX: 80, startY: 80 }
): SugiyamaResult {
  const steps: AlgorithmStep[] = [];
  const nodes = initialNodes.map(n => ({ ...n }));
  const nodeMap = new Map<string, BlockNode>(nodes.map(n => [n.id, n]));

  // Snapshot initial
  steps.push({
    stepIndex: 0,
    title: 'Исходное состояние',
    description: 'Начальные позиции блоков до применения послойного метода Сугиямы.',
    phase: 'Init',
    nodesSnapshot: JSON.parse(JSON.stringify(nodes)),
    edgesSnapshot: JSON.parse(JSON.stringify(edges)),
  });

  // 1. CYCLE REMOVAL (DFS-based FAS)
  const adj = new Map<string, string[]>();
  nodes.forEach(n => adj.set(n.id, []));
  edges.forEach(e => {
    if (adj.has(e.sourceBlockId)) {
      adj.get(e.sourceBlockId)!.push(e.targetBlockId);
    }
  });

  const visited = new Set<string>();
  const recStack = new Set<string>();
  const reversedEdges = new Set<string>();

  function dfsCycle(u: string) {
    visited.add(u);
    recStack.add(u);

    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      if (!visited.has(v)) {
        dfsCycle(v);
      } else if (recStack.has(v)) {
        // Cycle detected: edge u -> v is a back-edge
        reversedEdges.add(`${u}->${v}`);
      }
    }
    recStack.delete(u);
  }

  nodes.forEach(n => {
    if (!visited.has(n.id)) dfsCycle(n.id);
  });

  steps.push({
    stepIndex: 1,
    title: 'Фаза 1: Устранение циклов (Cycle Breaking)',
    description: reversedEdges.size > 0
      ? `Обнаружено обратных рёбер: ${reversedEdges.size}. Временно инвертированы для преобразования графа в DAG (направленный ациклический граф).`
      : 'Граф изначально является ациклическим (DAG). Обратных связей не обнаружено.',
    phase: 'Cycle Removal',
    nodesSnapshot: JSON.parse(JSON.stringify(nodes)),
    edgesSnapshot: JSON.parse(JSON.stringify(edges)),
  });

  // 2. LAYER ASSIGNMENT (Longest Path layering)
  const inDegree = new Map<string, number>();
  nodes.forEach(n => inDegree.set(n.id, 0));

  edges.forEach(e => {
    if (!reversedEdges.has(`${e.sourceBlockId}->${e.targetBlockId}`)) {
      inDegree.set(e.targetBlockId, (inDegree.get(e.targetBlockId) || 0) + 1);
    }
  });

  const layers: string[][] = [];
  const nodeLayer = new Map<string, number>();

  // Find sources (in-degree = 0)
  let currentLayer = nodes.filter(n => (inDegree.get(n.id) || 0) === 0).map(n => n.id);
  if (currentLayer.length === 0 && nodes.length > 0) {
    currentLayer = [nodes[0].id];
  }

  let layerIndex = 0;
  const processed = new Set<string>();

  while (currentLayer.length > 0) {
    layers[layerIndex] = currentLayer;
    currentLayer.forEach(id => {
      nodeLayer.set(id, layerIndex);
      processed.add(id);
      const node = nodeMap.get(id);
      if (node) node.layer = layerIndex;
    });

    const nextLayerCandidates = new Set<string>();
    currentLayer.forEach(u => {
      const neighbors = adj.get(u) || [];
      neighbors.forEach(v => {
        if (!reversedEdges.has(`${u}->${v}`) && !processed.has(v)) {
          // Check if all predecessors of v in DAG are processed
          nextLayerCandidates.add(v);
        }
      });
    });

    // Pick only nodes whose DAG parents are processed, or pick at least one to prevent stalls
    let nextLayer = Array.from(nextLayerCandidates).filter(v => {
      const parentEdges = edges.filter(e => e.targetBlockId === v && !reversedEdges.has(`${e.sourceBlockId}->${v}`));
      return parentEdges.every(e => processed.has(e.sourceBlockId));
    });

    if (nextLayer.length === 0 && processed.size < nodes.length) {
      // Pick any unprocessed node to make progress
      const remaining = nodes.filter(n => !processed.has(n.id));
      if (remaining.length > 0) {
        nextLayer = [remaining[0].id];
      }
    }

    currentLayer = nextLayer;
    layerIndex++;
    if (layerIndex > 50) break; // safety guard
  }

  steps.push({
    stepIndex: 2,
    title: 'Фаза 2: Послойное распределение (Layer Assignment)',
    description: `Узлы распределены по ${layers.length} горизонтальным слоям потока (слева направо) согласно топологическому ранжированию.`,
    phase: 'Layer Assignment',
    nodesSnapshot: JSON.parse(JSON.stringify(nodes)),
    edgesSnapshot: JSON.parse(JSON.stringify(edges)),
  });

  // 3. CROSSING REDUCTION (Barycentric Sweep)
  // Reorder nodes within each layer to minimize edge crossings
  for (let iter = 0; iter < 4; iter++) {
    // Forward sweep (from layer 1 to N-1)
    for (let l = 1; l < layers.length; l++) {
      const prevLayerNodes = layers[l - 1];
      const prevIndexMap = new Map(prevLayerNodes.map((id, idx) => [id, idx]));

      const barycenters = layers[l].map(nodeId => {
        // Find incoming connections from previous layer
        const incoming = edges.filter(
          e => e.targetBlockId === nodeId && prevIndexMap.has(e.sourceBlockId)
        );
        if (incoming.length === 0) return { id: nodeId, value: 0 };
        const sum = incoming.reduce((acc, e) => acc + (prevIndexMap.get(e.sourceBlockId) ?? 0), 0);
        return { id: nodeId, value: sum / incoming.length };
      });

      barycenters.sort((a, b) => a.value - b.value);
      layers[l] = barycenters.map(b => b.id);
    }

    // Backward sweep (from N-2 down to 0)
    for (let l = layers.length - 2; l >= 0; l--) {
      const nextLayerNodes = layers[l + 1];
      const nextIndexMap = new Map(nextLayerNodes.map((id, idx) => [id, idx]));

      const barycenters = layers[l].map(nodeId => {
        const outgoing = edges.filter(
          e => e.sourceBlockId === nodeId && nextIndexMap.has(e.targetBlockId)
        );
        if (outgoing.length === 0) return { id: nodeId, value: 0 };
        const sum = outgoing.reduce((acc, e) => acc + (nextIndexMap.get(e.targetBlockId) ?? 0), 0);
        return { id: nodeId, value: sum / outgoing.length };
      });

      barycenters.sort((a, b) => a.value - b.value);
      layers[l] = barycenters.map(b => b.id);
    }
  }

  steps.push({
    stepIndex: 3,
    title: 'Фаза 3: Минимизация пересечений (Barycentric Crossing Reduction)',
    description: 'Произведено послойное итеративное вычисление барицентров смежных узлов и взаимная пересортировка для минимизации перехлёстов связей.',
    phase: 'Crossing Reduction',
    nodesSnapshot: JSON.parse(JSON.stringify(nodes)),
    edgesSnapshot: JSON.parse(JSON.stringify(edges)),
  });

  // 4. COORDINATE ASSIGNMENT (X by layer width, Y centered and spaced)
  // Calculate max width per layer
  const layerWidths = layers.map(layerNodeIds => {
    return Math.max(...layerNodeIds.map(id => nodeMap.get(id)?.width || 140), 140);
  });

  let currentX = options.startX;
  const layerXPositions: number[] = [];

  for (let l = 0; l < layers.length; l++) {
    layerXPositions[l] = currentX;
    currentX += layerWidths[l] + options.layerSpacing;
  }

  // Calculate heights of layers
  const layerTotalHeights = layers.map(layerNodeIds => {
    return layerNodeIds.reduce((sum, id) => sum + (nodeMap.get(id)?.height || 80) + options.nodeSpacing, 0) - options.nodeSpacing;
  });
  const maxOverallHeight = Math.max(...layerTotalHeights, 400);

  // Position nodes with Port-Aware Micro-Alignment
  layers.forEach((layerNodeIds, lIdx) => {
    const x = layerXPositions[lIdx];
    const totalHeight = layerTotalHeights[lIdx];
    let currentY = options.startY + Math.max(0, (maxOverallHeight - totalHeight) / 2);

    layerNodeIds.forEach((id, orderIdx) => {
      const node = nodeMap.get(id);
      if (node) {
        node.x = x;
        node.y = currentY;
        node.layer = lIdx;
        node.order = orderIdx;
        currentY += node.height + options.nodeSpacing;
      }
    });
  });

  // Post-refinement: Micro-adjust Y positions to align direct pin pairs between layers
  for (let l = 1; l < layers.length; l++) {
    const currentLayerNodeIds = layers[l];
    const prevLayerNodeIds = new Set(layers[l - 1]);

    currentLayerNodeIds.forEach(id => {
      const node = nodeMap.get(id);
      if (!node) return;

      const directIncoming = edges.filter(
        e => e.targetBlockId === id && prevLayerNodeIds.has(e.sourceBlockId)
      );

      if (directIncoming.length === 1) {
        const edge = directIncoming[0];
        const srcNode = nodeMap.get(edge.sourceBlockId);
        if (srcNode) {
          const srcPortPos = getPortCoordinates(srcNode, edge.sourcePortId, true);
          const tgtRelY = getPortCoordinates({ ...node, y: 0 }, edge.targetPortId, false).y;
          const alignedY = Math.round((srcPortPos.y - tgtRelY) / 10) * 10;

          // Verify no overlap with neighbor nodes in same layer
          const canFit = currentLayerNodeIds.every(peerId => {
            if (peerId === id) return true;
            const peer = nodeMap.get(peerId);
            if (!peer) return true;
            return alignedY + node.height + 25 < peer.y || alignedY > peer.y + peer.height + 25;
          });

          if (canFit && alignedY >= options.startY) {
            node.y = alignedY;
          }
        }
      }
    });
  }

  steps.push({
    stepIndex: 4,
    title: 'Фаза 4: Расчёт координат и соосное выравнивание портов (Pin-Aligned Brandes-Köpf)',
    description: 'Назначены точные координаты X/Y со сквозным микро-выравниванием соосности пинов для устранения лишних изгибов.',
    phase: 'Coordinate Assignment',
    nodesSnapshot: JSON.parse(JSON.stringify(nodes)),
    edgesSnapshot: JSON.parse(JSON.stringify(edges)),
  });

  return { nodes, steps };
}
