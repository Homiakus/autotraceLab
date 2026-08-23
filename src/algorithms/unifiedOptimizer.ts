import { BlockNode, EdgeConnection, RoutingOptions, AlgorithmStep, Point } from '../types';
import { getPortCoordinates, routeOrthogonalAStar } from './orthogonalAStarRouter';
import { cleanOrthogonalArtifacts } from './wireArtifactCleaner';
import { computeOptimizedLabels } from './labelLayout';

export interface UnifiedOptimizationResult {
  nodes: BlockNode[];
  edges: EdgeConnection[];
  steps: AlgorithmStep[];
  alignmentScore: number;
  straightWiresCount: number;
  eliminatedArtifactsCount: number;
}

/**
 * Unified Co-Optimization Engine (Joint Placement & Artifact-Free Wire Routing).
 * 
 * Synchronously optimizes:
 * 1. Global Topological Flow & Feedback Cycle Breaking (DAG decomposition)
 * 2. Port-Aware Barycentric Ordering (Minimizing edge crossings based on pin positions)
 * 3. Exact Pin-to-Pin Micro-Alignment (Vertical Y-snapping for 0-bend direct laser lines)
 * 4. Safe Non-Overlap Collision Relaxation
 * 5. Dynamic Routing Channel & Track Allocation
 * 6. Multi-Pass Orthogonal Artifact Cleaning (Staircase & jog removal, collinear merging)
 */
export function runUnifiedCoOptimization(
  initialNodes: BlockNode[],
  initialEdges: EdgeConnection[],
  options: RoutingOptions
): UnifiedOptimizationResult {
  const steps: AlgorithmStep[] = [];
  const nodes = initialNodes.map(n => ({ ...n }));
  const edges = initialEdges.map(e => ({ ...e }));
  const nodeMap = new Map<string, BlockNode>(nodes.map(n => [n.id, n]));
  const weights = options.weights || {
    crossingWeight: 95,
    straightnessWeight: 90,
    g1SplineWeight: 65,
    portAlignmentWeight: 80,
    clearanceWeight: 90,
    wirelengthWeight: 15,
    bendWeight: 25,
    labelOverlapWeight: 75,
  };

  // Snapshot 0: Initial
  steps.push({
    stepIndex: 0,
    title: 'Исходное состояние (Initial State)',
    description: 'Начальные позиции блоков и связи до запуска сквозной совместной оптимизации (Co-Optimization).',
    phase: 'Init',
    nodesSnapshot: JSON.parse(JSON.stringify(nodes)),
    edgesSnapshot: JSON.parse(JSON.stringify(edges)),
  });

  // =========================================================================
  // STAGE 1: Cycle Breaking & Topological Layer Assignment
  // =========================================================================
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
        reversedEdges.add(`${u}->${v}`);
      }
    }
    recStack.delete(u);
  }

  nodes.forEach(n => {
    if (!visited.has(n.id)) dfsCycle(n.id);
  });

  // Calculate in-degree for DAG
  const inDegree = new Map<string, number>();
  nodes.forEach(n => inDegree.set(n.id, 0));
  edges.forEach(e => {
    if (!reversedEdges.has(`${e.sourceBlockId}->${e.targetBlockId}`)) {
      inDegree.set(e.targetBlockId, (inDegree.get(e.targetBlockId) || 0) + 1);
    }
  });

  const layers: string[][] = [];
  const processed = new Set<string>();
  let currentLayer = nodes.filter(n => (inDegree.get(n.id) || 0) === 0).map(n => n.id);
  if (currentLayer.length === 0 && nodes.length > 0) {
    currentLayer = [nodes[0].id];
  }

  let layerIdx = 0;
  while (currentLayer.length > 0 && layerIdx < 20) {
    layers[layerIdx] = currentLayer;
    currentLayer.forEach(id => {
      processed.add(id);
      const node = nodeMap.get(id);
      if (node) node.layer = layerIdx;
    });

    const candidates = new Set<string>();
    currentLayer.forEach(u => {
      (adj.get(u) || []).forEach(v => {
        if (!reversedEdges.has(`${u}->${v}`) && !processed.has(v)) {
          candidates.add(v);
        }
      });
    });

    let nextLayer = Array.from(candidates).filter(v => {
      const parentEdges = edges.filter(
        e => e.targetBlockId === v && !reversedEdges.has(`${e.sourceBlockId}->${v}`)
      );
      return parentEdges.every(e => processed.has(e.sourceBlockId));
    });

    if (nextLayer.length === 0 && processed.size < nodes.length) {
      const remaining = nodes.filter(n => !processed.has(n.id));
      if (remaining.length > 0) nextLayer = [remaining[0].id];
    }

    currentLayer = nextLayer;
    layerIdx++;
  }

  // =========================================================================
  // STAGE 2: Port-Aware Barycentric Crossing Minimization
  // =========================================================================
  const sweepIterations = Math.max(3, Math.min(15, Math.round(weights.crossingWeight / 8)));
  for (let sweep = 0; sweep < sweepIterations; sweep++) {
    // Forward sweep
    for (let l = 1; l < layers.length; l++) {
      const prevNodes = layers[l - 1];
      const prevNodeIndex = new Map(prevNodes.map((id, idx) => [id, idx]));

      const scores = layers[l].map(nodeId => {
        const incoming = edges.filter(
          e => e.targetBlockId === nodeId && prevNodeIndex.has(e.sourceBlockId)
        );
        if (incoming.length === 0) return { id: nodeId, score: 0 };

        // Calculate port-weighted barycenter
        let totalWeight = 0;
        let weightedSum = 0;
        incoming.forEach(e => {
          const srcIdx = prevNodeIndex.get(e.sourceBlockId) ?? 0;
          const srcNode = nodeMap.get(e.sourceBlockId);
          const tgtNode = nodeMap.get(nodeId);
          if (srcNode && tgtNode) {
            const srcPos = getPortCoordinates(srcNode, e.sourcePortId, true);
            const portRelative = srcPos.y - srcNode.y;
            weightedSum += srcIdx * 1000 + portRelative;
            totalWeight += 1;
          }
        });
        return { id: nodeId, score: totalWeight > 0 ? weightedSum / totalWeight : 0 };
      });

      scores.sort((a, b) => a.score - b.score);
      layers[l] = scores.map(s => s.id);
    }

    // Backward sweep
    for (let l = layers.length - 2; l >= 0; l--) {
      const nextNodes = layers[l + 1];
      const nextNodeIndex = new Map(nextNodes.map((id, idx) => [id, idx]));

      const scores = layers[l].map(nodeId => {
        const outgoing = edges.filter(
          e => e.sourceBlockId === nodeId && nextNodeIndex.has(e.targetBlockId)
        );
        if (outgoing.length === 0) return { id: nodeId, score: 0 };

        let totalWeight = 0;
        let weightedSum = 0;
        outgoing.forEach(e => {
          const tgtIdx = nextNodeIndex.get(e.targetBlockId) ?? 0;
          const tgtNode = nodeMap.get(e.targetBlockId);
          const srcNode = nodeMap.get(nodeId);
          if (tgtNode && srcNode) {
            const tgtPos = getPortCoordinates(tgtNode, e.targetPortId, false);
            const portRelative = tgtPos.y - tgtNode.y;
            weightedSum += tgtIdx * 1000 + portRelative;
            totalWeight += 1;
          }
        });
        return { id: nodeId, score: totalWeight > 0 ? weightedSum / totalWeight : 0 };
      });

      scores.sort((a, b) => a.score - b.score);
      layers[l] = scores.map(s => s.id);
    }
  }

  // =========================================================================
  // STAGE 3: Exact Pin-to-Pin Micro-Alignment & Coordinate Assignment
  // =========================================================================
  const layerWidths = layers.map(layerNodeIds => {
    return Math.max(...layerNodeIds.map(id => nodeMap.get(id)?.width || 150), 150);
  });

  // Calculate dynamic channel width based on inter-layer wire density
  const layerChannelSpacing: number[] = [];
  for (let l = 0; l < layers.length - 1; l++) {
    const currentLayerSet = new Set(layers[l]);
    const nextLayerSet = new Set(layers[l + 1]);
    const crossEdges = edges.filter(
      e => currentLayerSet.has(e.sourceBlockId) && nextLayerSet.has(e.targetBlockId)
    );
    // Expand channel if multiple parallel wires
    const dynamicSpacing = Math.max(160, 140 + crossEdges.length * 14);
    layerChannelSpacing.push(dynamicSpacing);
  }
  layerChannelSpacing.push(160);

  let currentX = 80;
  const layerX: number[] = [];
  for (let l = 0; l < layers.length; l++) {
    layerX[l] = currentX;
    currentX += layerWidths[l] + (layerChannelSpacing[l] || 160);
  }

  // Vertical placement with iterative Pin-Y Snapping
  const nodeSpacing = 45;
  const startY = 80;

  // Step 3.1: Initial baseline Y placement for Layer 0
  if (layers.length > 0) {
    let y0 = startY;
    layers[0].forEach(id => {
      const node = nodeMap.get(id);
      if (node) {
        node.x = layerX[0];
        node.y = y0;
        y0 += node.height + nodeSpacing;
      }
    });
  }

  // Step 3.2: Forward Pin-Alignment from Layer 1 to N-1
  for (let l = 1; l < layers.length; l++) {
    const layerNodeIds = layers[l];
    const prevLayerNodeIds = new Set(layers[l - 1]);

    // Position each node in layer l trying to align with connected source pins
    const desiredYPositions: { id: string; desiredY: number; node: BlockNode }[] = [];

    layerNodeIds.forEach(id => {
      const node = nodeMap.get(id);
      if (!node) return;

      node.x = layerX[l];

      const incomingEdges = edges.filter(
        e => e.targetBlockId === id && prevLayerNodeIds.has(e.sourceBlockId)
      );

      if (incomingEdges.length > 0) {
        // Calculate the ideal Y position of this node to perfectly align input pin with source output pin
        const targetOffsets: number[] = [];
        incomingEdges.forEach(e => {
          const srcNode = nodeMap.get(e.sourceBlockId);
          if (srcNode) {
            const srcPortPos = getPortCoordinates(srcNode, e.sourcePortId, true);
            // Pin offset relative to node top
            const tgtPort = node.inputs.find(p => p.id === e.targetPortId) || node.inputs[0];
            const portRelativeY = tgtPort
              ? (node.height / (node.inputs.length + 1)) * (node.inputs.indexOf(tgtPort) + 1)
              : node.height / 2;

            // Ideal node Y so that node.y + portRelativeY == srcPortPos.y
            const idealNodeY = srcPortPos.y - portRelativeY;
            targetOffsets.push(idealNodeY);
          }
        });

        const medianDesiredY =
          targetOffsets.reduce((sum, val) => sum + val, 0) / targetOffsets.length;
        desiredYPositions.push({ id, desiredY: medianDesiredY, node });
      } else {
        // Fallback default
        desiredYPositions.push({ id, desiredY: startY + desiredYPositions.length * 120, node });
      }
    });

    // Resolve vertical overlaps while respecting desired Pin-Y alignments
    let runningY = startY;
    desiredYPositions.forEach((item, idx) => {
      const targetY = Math.max(runningY, item.desiredY);
      item.node.y = Math.round(targetY / 10) * 10;
      runningY = item.node.y + item.node.height + nodeSpacing;
    });
  }

  // Step 3.3: Backward Pin-Alignment refinement (Centering sources to sinks)
  for (let l = layers.length - 2; l >= 0; l--) {
    const layerNodeIds = layers[l];
    const nextLayerNodeIds = new Set(layers[l + 1]);

    layerNodeIds.forEach(id => {
      const node = nodeMap.get(id);
      if (!node) return;

      const outgoing = edges.filter(
        e => e.sourceBlockId === id && nextLayerNodeIds.has(e.targetBlockId)
      );

      if (outgoing.length === 1) {
        const edge = outgoing[0];
        const tgtNode = nodeMap.get(edge.targetBlockId);
        if (tgtNode) {
          const tgtPortPos = getPortCoordinates(tgtNode, edge.targetPortId, false);
          const srcPort = node.outputs.find(p => p.id === edge.sourcePortId) || node.outputs[0];
          const srcRelativeY = srcPort
            ? (node.height / (node.outputs.length + 1)) * (node.outputs.indexOf(srcPort) + 1)
            : node.height / 2;

          const alignedY = Math.round((tgtPortPos.y - srcRelativeY) / 10) * 10;

          // Check if shifting to alignedY causes overlap with peers in same layer
          const peerNodes = layerNodeIds.map(pid => nodeMap.get(pid)!).filter(Boolean);
          const canShift = peerNodes.every(peer => {
            if (peer.id === id) return true;
            const overlap = !(alignedY + node.height + 20 < peer.y || alignedY > peer.y + peer.height + 20);
            return !overlap;
          });

          if (canShift && alignedY >= startY) {
            node.y = alignedY;
          }
        }
      }
    });
  }

  steps.push({
    stepIndex: 1,
    title: 'Фаза 1 & 2: Оптимальное размещение блоков с соосностью пинов (Pin-Aligned Placement)',
    description: 'Блоки размещены по слоям с выравниванием по высоте Y для обеспечения 100% прямолинейных 0-изгибных трасс.',
    phase: 'Placement',
    nodesSnapshot: JSON.parse(JSON.stringify(nodes)),
    edgesSnapshot: JSON.parse(JSON.stringify(edges)),
  });

  // =========================================================================
  // STAGE 4: Artifact-Free Multi-Pass Orthogonal Wire Routing
  // =========================================================================
  let straightCount = 0;
  let eliminatedArtifacts = 0;
  let alignedPortPairs = 0;

  // Run base orthogonal router first
  const routedBase = routeOrthogonalAStar(nodes, edges, options);

  const optimizedEdges: EdgeConnection[] = routedBase.map(edge => {
    const srcNode = nodeMap.get(edge.sourceBlockId);
    const tgtNode = nodeMap.get(edge.targetBlockId);
    if (!srcNode || !tgtNode) return edge;

    const srcPos = getPortCoordinates(srcNode, edge.sourcePortId, true);
    const tgtPos = getPortCoordinates(tgtNode, edge.targetPortId, false);

    // Check if ports are aligned
    if (Math.abs(srcPos.y - tgtPos.y) <= 4 || Math.abs(srcPos.x - tgtPos.x) <= 4) {
      alignedPortPairs++;
    }

    const rawPath = edge.path || [
      { x: srcPos.x, y: srcPos.y },
      { x: tgtPos.x, y: tgtPos.y },
    ];

    const initialBendCount = Math.max(0, rawPath.length - 2);

    // Clean artifacts: staircase, redundant jogs, U-turns, collinear merges
    const cleanedPath = cleanOrthogonalArtifacts(
      rawPath,
      srcPos,
      tgtPos,
      nodes,
      options.obstacleClearance || 12
    );

    const finalBendCount = Math.max(0, cleanedPath.length - 2);
    if (finalBendCount < initialBendCount) {
      eliminatedArtifacts += (initialBendCount - finalBendCount);
    }

    if (cleanedPath.length === 2) {
      straightCount++;
    }

    return {
      ...edge,
      path: cleanedPath,
    };
  });

  steps.push({
    stepIndex: 2,
    title: 'Фаза 3: Трассировка без артефактов изгиба (Artifact-Free Wire Clean)',
    description: `Устранено паразитных изгибов: ${eliminatedArtifacts}. Сформировано абсолютно прямых 0-изгибных связей: ${straightCount}.`,
    phase: 'Routing',
    nodesSnapshot: JSON.parse(JSON.stringify(nodes)),
    edgesSnapshot: JSON.parse(JSON.stringify(optimizedEdges)),
  });

  const alignmentScore = edges.length > 0 ? Math.round((alignedPortPairs / edges.length) * 100) : 100;

  return {
    nodes,
    edges: optimizedEdges,
    steps,
    alignmentScore,
    straightWiresCount: straightCount,
    eliminatedArtifactsCount: eliminatedArtifacts,
  };
}
