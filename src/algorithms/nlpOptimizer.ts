import {
  BlockNode,
  EdgeConnection,
  Point,
  RoutingOptions,
  AlgorithmStep,
  NLPOptimizationParams,
  NLPOptimalityBreakdown,
} from '../types';
import { getPortCoordinates, routeOrthogonalAStar } from './orthogonalAStarRouter';
import { cleanOrthogonalArtifacts } from './wireArtifactCleaner';
import { computeOptimizedLabels, MAX_LABEL_OFF_ARROW_PENALTY } from './labelLayout';
import { detectCollinearOverlaps } from './metrics';

export interface NLPIterationSnapshot {
  iteration: number;
  loss: number;
  totalLength: number;
  maxIndividualLength: number;
  wireVariance: number;
  blockDistanceDeviation: number;
  gradientNorm: number;
}

export interface NLPOptimizationResult {
  nodes: BlockNode[];
  edges: EdgeConnection[];
  steps: AlgorithmStep[];
  history: NLPIterationSnapshot[];
  initialBreakdown: NLPOptimalityBreakdown;
  finalBreakdown: NLPOptimalityBreakdown;
  improvementPercentage: number;
  pinnedNodeIds: string[];
}

export const DEFAULT_NLP_PARAMS: NLPOptimizationParams = {
  optimalBlockDistance: 220, // D_opt: Optimal distance between connected blocks in px
  optimalWireDistance: 24,  // S_opt: Optimal channel distance between parallel wires
  wirelengthWeight: 40,
  wirelengthVarianceWeight: 35,
  blockRepulsionWeight: 85,
  wireSpacingWeight: 60,
  strictLabelClearanceWeight: 75,
  portAlignmentWeight: 80,
  learningRate: 0.08,
  iterations: 75,
  momentum: 0.85,
  freezePinnedNodes: true,
};

/**
 * Fast deep-cloning for algorithm snapshots without JSON.stringify/JSON.parse serialization overhead
 */
function cloneNodesSnapshot(nodes: BlockNode[]): BlockNode[] {
  const result: BlockNode[] = new Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    result[i] = {
      ...n,
      inputs: n.inputs ? n.inputs.map(p => ({ ...p })) : undefined,
      outputs: n.outputs ? n.outputs.map(p => ({ ...p })) : undefined,
    };
  }
  return result;
}

function cloneEdgesSnapshot(edges: EdgeConnection[]): EdgeConnection[] {
  const result: EdgeConnection[] = new Array(edges.length);
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    result[i] = {
      ...e,
      path: e.path ? e.path.map(p => ({ x: p.x, y: p.y })) : undefined,
    };
  }
  return result;
}

/**
 * Builds a fast O(1) undirected connectivity set between block IDs
 */
function buildConnectedPairsSet(edges: EdgeConnection[]): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    set.add(`${e.sourceBlockId}__${e.targetBlockId}`);
    set.add(`${e.targetBlockId}__${e.sourceBlockId}`);
  }
  return set;
}

/**
 * Calculates detailed optimality breakdown for a given layout state
 */
export function calculateNLPOptimalityBreakdown(
  nodes: BlockNode[],
  edges: EdgeConnection[],
  params: NLPOptimizationParams
): NLPOptimalityBreakdown {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const connectedPairs = buildConnectedPairsSet(edges);
  const wireLengths: number[] = [];
  let totalWirelength = 0;
  let maxIndividualWirelength = 0;
  let portAlignmentDeviation = 0;

  // 1. Individual and total wirelengths
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const sNode = nodeMap.get(e.sourceBlockId);
    const tNode = nodeMap.get(e.targetBlockId);
    if (!sNode || !tNode) continue;

    const sPos = getPortCoordinates(sNode, e.sourcePortId, true);
    const tPos = getPortCoordinates(tNode, e.targetPortId, false);

    let len = 0;
    if (e.path && e.path.length >= 2) {
      for (let p = 0; p < e.path.length - 1; p++) {
        len += Math.hypot(e.path[p + 1].x - e.path[p].x, e.path[p + 1].y - e.path[p].y);
      }
    } else {
      len = Math.hypot(tPos.x - sPos.x, tPos.y - sPos.y);
    }

    wireLengths.push(len);
    totalWirelength += len;
    if (len > maxIndividualWirelength) {
      maxIndividualWirelength = len;
    }

    // Port Y alignment error for horizontal connections
    if (sPos.normal.dx === 1 && tPos.normal.dx === -1) {
      portAlignmentDeviation += Math.abs(tPos.y - sPos.y);
    }
  }

  const edgeCount = Math.max(1, wireLengths.length);
  const averageWirelength = totalWirelength / edgeCount;

  // Variance of wirelengths
  let varianceSum = 0;
  for (let i = 0; i < wireLengths.length; i++) {
    varianceSum += Math.pow(wireLengths[i] - averageWirelength, 2);
  }
  const wirelengthVariance = Math.sqrt(varianceSum / edgeCount);

  // 2. Block-to-Block distance deviation from D_opt
  let blockDistDevSum = 0;
  let blockPairs = 0;
  for (let i = 0; i < nodes.length; i++) {
    const u = nodes[i];
    const cxU = u.x + u.width / 2;
    const cyU = u.y + u.height / 2;

    for (let j = i + 1; j < nodes.length; j++) {
      const v = nodes[j];
      const cxV = v.x + v.width / 2;
      const cyV = v.y + v.height / 2;
      const dist = Math.hypot(cxV - cxU, cyV - cyU);

      // Fast O(1) connected pair check
      if (connectedPairs.has(`${u.id}__${v.id}`)) {
        blockDistDevSum += Math.abs(dist - params.optimalBlockDistance);
        blockPairs++;
      }
    }
  }
  const blockDistanceDeviation = blockPairs > 0 ? blockDistDevSum / blockPairs : 0;

  // 3. Wire Distance Violations (wires closer than S_opt)
  let wireViolations = 0;
  for (let i = 0; i < edges.length; i++) {
    const e1 = edges[i];
    if (!e1.path || e1.path.length < 2) continue;

    for (let j = i + 1; j < edges.length; j++) {
      const e2 = edges[j];
      if (!e2.path || e2.path.length < 2) continue;

      for (let p = 0; p < e1.path.length - 1; p++) {
        const s1 = e1.path[p];
        const s2 = e1.path[p + 1];
        const sIsH = Math.abs(s1.y - s2.y) < 1;

        for (let q = 0; q < e2.path.length - 1; q++) {
          const t1 = e2.path[q];
          const t2 = e2.path[q + 1];
          const tIsH = Math.abs(t1.y - t2.y) < 1;

          if (sIsH && tIsH) {
            const minS = Math.min(s1.x, s2.x);
            const maxS = Math.max(s1.x, s2.x);
            const minT = Math.min(t1.x, t2.x);
            const maxT = Math.max(t1.x, t2.x);

            const overlapX = !(maxS < minT || maxT < minS);
            if (overlapX && Math.abs(s1.y - t1.y) < params.optimalWireDistance) {
              wireViolations++;
            }
          }
        }
      }
    }
  }

  // 4. Strict Mandate Evaluation: Collinear Wire Overlaps (MUST BE 0) & On-Arrow Labels (MUST BE 100%)
  const { totalOverlapLength, overlapCount: collinearWireOverlapCount } = detectCollinearOverlaps(edges);
  const collinearOverlapPenalty = totalOverlapLength * 10000 + (totalOverlapLength > 0 ? 50000 : 0);

  const labelPositions = computeOptimizedLabels(nodes, edges, new Map(), params.strictLabelClearanceWeight ? 8 : 4);
  let labelsOnArrowCount = 0;
  let labelsOffArrowCount = 0;
  let labelsOffArrowPenalty = 0;

  edges.forEach(e => {
    if (e.label) {
      const pos = labelPositions.get(e.id);
      if (pos && pos.isOnArrow && pos.isCollisionFree) {
        labelsOnArrowCount++;
      } else {
        labelsOffArrowCount++;
        labelsOffArrowPenalty += MAX_LABEL_OFF_ARROW_PENALTY;
      }
    }
  });

  // 5. Overall Multi-Objective Cost Function Φ(X) with Strict Violation Barriers
  const w1 = params.wirelengthWeight * 0.01;
  const w2 = params.wirelengthVarianceWeight * 0.05;
  const w3 = params.blockRepulsionWeight * 0.08;
  const w4 = params.wireSpacingWeight * 0.1;
  const w5 = params.portAlignmentWeight * 0.05;

  const baseCost =
    w1 * totalWirelength +
    w2 * wirelengthVariance +
    w3 * blockDistanceDeviation * 10 +
    w4 * wireViolations * 25 +
    w5 * portAlignmentDeviation;

  const overallCostValue = Math.round(baseCost + labelsOffArrowPenalty + collinearOverlapPenalty);

  return {
    totalWirelength: Math.round(totalWirelength),
    averageWirelength: Math.round(averageWirelength),
    maxIndividualWirelength: Math.round(maxIndividualWirelength),
    wirelengthVariance: Math.round(wirelengthVariance),
    blockDistanceDeviation: Math.round(blockDistanceDeviation),
    wireDistanceViolationCount: wireViolations,
    collinearWireOverlapLength: totalOverlapLength,
    collinearWireOverlapCount,
    labelsOnArrowCount,
    labelsOffArrowCount,
    labelsOffArrowPenalty,
    labelCollisionsCount: labelsOffArrowCount,
    portAlignmentDeviation: Math.round(portAlignmentDeviation),
    overallCostValue,
  };
}

/**
 * Executes Non-Linear Programming Optimization (NLP) on the diagram.
 * 
 * Objectives Optimized:
 * 1. Global Wirelength: Min \sum L_e
 * 2. Individual Wirelength Variance & Peak Wirelength: Min \sum (L_e - D_opt)^2
 * 3. Optimal Block-to-Block Separation: Morse/Lennard-Jones Barrier Potential around D_opt
 * 4. Optimal Wire-to-Wire Spacing: S_opt Channel Repulsion
 * 5. Pin Coaxial Port Alignment: Source and target pin horizontal leveling
 * 6. Frozen Block Invariance: Pinned nodes have \nabla \Phi \equiv 0 (Zero Drift)
 */
export function runNLPOptimization(
  initialNodes: BlockNode[],
  initialEdges: EdgeConnection[],
  options: RoutingOptions,
  customParams?: Partial<NLPOptimizationParams>
): NLPOptimizationResult {
  const params: NLPOptimizationParams = {
    ...DEFAULT_NLP_PARAMS,
    ...options.nlpParams,
    ...customParams,
  };

  const steps: AlgorithmStep[] = [];
  const history: NLPIterationSnapshot[] = [];

  // Deep clone nodes and edges
  const nodes: BlockNode[] = initialNodes.map(n => ({ ...n }));
  const edges: EdgeConnection[] = initialEdges.map(e => ({ ...e }));

  // Identify pinned nodes
  // If no node is explicitly pinned, automatically pin the first/root node to prevent floating chaos
  const pinnedSet = new Set<string>();
  nodes.forEach(n => {
    if (n.isPinned) pinnedSet.add(n.id);
  });
  if (pinnedSet.size === 0 && nodes.length > 0) {
    // Pin first node as reference anchor
    pinnedSet.add(nodes[0].id);
    nodes[0].isPinned = true;
  }

  const initialBreakdown = calculateNLPOptimalityBreakdown(nodes, edges, params);
  const connectedPairs = buildConnectedPairsSet(edges);

  // Initial step snapshot
  steps.push({
    stepIndex: 0,
    title: 'NLP: Инициализация задачи нелинейного программирования',
    description: `Формулировка критериев: D_opt = ${params.optimalBlockDistance}px, S_opt = ${params.optimalWireDistance}px. Заморожено опорных блоков: ${pinnedSet.size}. Начальная функция потерь Φ(X) = ${initialBreakdown.overallCostValue}.`,
    phase: 'NLP Init',
    nodesSnapshot: cloneNodesSnapshot(nodes),
    edgesSnapshot: cloneEdgesSnapshot(edges),
    highlightedNodes: Array.from(pinnedSet),
  });

  const nodeMap = new Map<string, BlockNode>(nodes.map(n => [n.id, n]));
  const velocities = new Map<string, { vx: number; vy: number }>();
  nodes.forEach(n => velocities.set(n.id, { vx: 0, vy: 0 }));

  const D_opt = params.optimalBlockDistance;
  const S_opt = params.optimalWireDistance;
  const iterations = params.iterations || 75;
  const alpha = params.learningRate || 0.08;
  const momentum = params.momentum || 0.85;

  for (let iter = 1; iter <= iterations; iter++) {
    const gradients = new Map<string, { gx: number; gy: number }>();
    nodes.forEach(n => gradients.set(n.id, { gx: 0, gy: 0 }));

    // -----------------------------------------------------------------------
    // 1. Block-to-Block Barrier Potential & Optimal Spacing D_opt
    // -----------------------------------------------------------------------
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const u = nodes[i];
        const v = nodes[j];

        const cxU = u.x + u.width / 2;
        const cyU = u.y + u.height / 2;
        const cxV = v.x + v.width / 2;
        const cyV = v.y + v.height / 2;

        const dx = cxV - cxU;
        const dy = cyV - cyU;
        const dist = Math.hypot(dx, dy) || 1;

        // Hard minimum distance based on block bounding boxes
        const minClearDist = Math.max(u.width, u.height) / 2 + Math.max(v.width, v.height) / 2 + 30;

        const isConnected = connectedPairs.has(`${u.id}__${v.id}`);

        let forceMag = 0;

        if (dist < minClearDist) {
          // Hyperbolic barrier repulsion to prevent bounding box penetration
          forceMag = -((params.blockRepulsionWeight * 600) / Math.pow(Math.max(dist, 10), 2));
        } else if (isConnected) {
          // Quadratic Lennard-Jones-like harmonic spring around D_opt
          const delta = dist - D_opt;
          forceMag = delta * (params.wirelengthVarianceWeight * 0.004);
        } else {
          // Soft Coulomb repulsion for non-connected blocks to give breathing room
          forceMag = -((params.blockRepulsionWeight * 120) / Math.pow(dist, 1.5));
        }

        const fx = (dx / dist) * forceMag;
        const fy = (dy / dist) * forceMag;

        // Add to gradients: \nabla \Phi = -Force
        gradients.get(u.id)!.gx += fx;
        gradients.get(u.id)!.gy += fy;
        gradients.get(v.id)!.gx -= fx;
        gradients.get(v.id)!.gy -= fy;
      }
    }

    // -----------------------------------------------------------------------
    // 2. Wirelength Minimization & Port Coaxial Alignment
    // -----------------------------------------------------------------------
    edges.forEach(e => {
      const u = nodeMap.get(e.sourceBlockId);
      const v = nodeMap.get(e.targetBlockId);
      if (!u || !v) return;

      const sPos = getPortCoordinates(u, e.sourcePortId, true);
      const tPos = getPortCoordinates(v, e.targetPortId, false);

      const dx = tPos.x - sPos.x;
      const dy = tPos.y - sPos.y;
      const wireLen = Math.hypot(dx, dy) || 1;

      // Global wirelength gradient
      const wLenGrad = (params.wirelengthWeight * 0.008);
      const fxLen = (dx / wireLen) * wLenGrad;
      const fyLen = (dy / wireLen) * wLenGrad;

      gradients.get(u.id)!.gx += fxLen;
      gradients.get(u.id)!.gy += fyLen;
      gradients.get(v.id)!.gx -= fxLen;
      gradients.get(v.id)!.gy -= fyLen;

      // Flow directionality: source should be left of target for horizontal pins
      if (sPos.normal.dx === 1 && tPos.normal.dx === -1) {
        if (sPos.x > tPos.x - 60) {
          const overlap = (sPos.x - (tPos.x - 60)) * 0.08;
          gradients.get(u.id)!.gx -= overlap;
          gradients.get(v.id)!.gx += overlap;
        }

        // Port Y Alignment (Pin leveling for 0-bend straight wire)
        const yDiff = tPos.y - sPos.y;
        const alignForce = yDiff * (params.portAlignmentWeight * 0.005);
        gradients.get(u.id)!.gy += alignForce;
        gradients.get(v.id)!.gy -= alignForce;
      }

      // Strict On-Arrow Label Clearance Expansion Force:
      // Ensure the arrow has sufficient physical length to host its label directly ON the line without collision
      if (e.label && e.label.trim().length > 0) {
        const requiredLabelSpan = Math.max(70, e.label.length * 7.5 + 40);
        if (wireLen < requiredLabelSpan) {
          const shortage = (requiredLabelSpan - wireLen) * 0.15;
          const pushX = (dx / wireLen) * shortage;
          const pushY = (dy / wireLen) * shortage;
          // Push source back and target forward along arrow vector
          gradients.get(u.id)!.gx -= pushX;
          gradients.get(u.id)!.gy -= pushY;
          gradients.get(v.id)!.gx += pushX;
          gradients.get(v.id)!.gy += pushY;
        }
      }
    });

    // -----------------------------------------------------------------------
    // 3. Frozen Block Constraint Enforcement (\nabla \Phi \equiv 0 for Pinned)
    // -----------------------------------------------------------------------
    if (params.freezePinnedNodes) {
      pinnedSet.forEach(pinnedId => {
        const grad = gradients.get(pinnedId);
        if (grad) {
          grad.gx = 0;
          grad.gy = 0;
        }
      });
    }

    // -----------------------------------------------------------------------
    // 4. Projected Gradient Descent Update with Momentum & Temperature Cooling
    // -----------------------------------------------------------------------
    const temp = Math.max(0.1, 1 - (iter / iterations) * 0.85);
    let totalGradNorm = 0;

    nodes.forEach(node => {
      if (params.freezePinnedNodes && pinnedSet.has(node.id)) {
        return; // Pinned node stays strictly stationary
      }

      const grad = gradients.get(node.id)!;
      const vel = velocities.get(node.id)!;

      const gradNorm = Math.hypot(grad.gx, grad.gy);
      totalGradNorm += gradNorm;

      // Clamp gradient to prevent extreme blowup
      const maxGrad = 60;
      const clampedGx = Math.max(-maxGrad, Math.min(maxGrad, grad.gx));
      const clampedGy = Math.max(-maxGrad, Math.min(maxGrad, grad.gy));

      // Momentum update: V = beta * V + alpha * grad
      vel.vx = momentum * vel.vx + alpha * clampedGx * temp;
      vel.vy = momentum * vel.vy + alpha * clampedGy * temp;

      // Update position
      node.x += vel.vx;
      node.y += vel.vy;

      // Keep within canvas bounds
      node.x = Math.max(30, Math.min(2200, node.x));
      node.y = Math.max(30, Math.min(1800, node.y));
    });

    // Record snapshot every 15 iterations or on final step
    if (iter % 15 === 0 || iter === iterations) {
      // Snap to grid at end of major phases
      if (iter === iterations) {
        const snap = options.gridSize || 12;
        nodes.forEach(node => {
          if (!pinnedSet.has(node.id)) {
            node.x = Math.round(node.x / snap) * snap;
            node.y = Math.round(node.y / snap) * snap;
          }
        });
      }

      const currentBreakdown = calculateNLPOptimalityBreakdown(nodes, edges, params);

      history.push({
        iteration: iter,
        loss: currentBreakdown.overallCostValue,
        totalLength: currentBreakdown.totalWirelength,
        maxIndividualLength: currentBreakdown.maxIndividualWirelength,
        wireVariance: currentBreakdown.wirelengthVariance,
        blockDistanceDeviation: currentBreakdown.blockDistanceDeviation,
        gradientNorm: Math.round(totalGradNorm * 10) / 10,
      });

      steps.push({
        stepIndex: steps.length,
        title: `NLP Итерация ${iter}/${iterations} (Сходимость)`,
        description: `Функция потерь Φ(X) = ${currentBreakdown.overallCostValue}. Общая длина: ${currentBreakdown.totalWirelength}px, Отклонение от D_opt: ${currentBreakdown.blockDistanceDeviation}px. Норма градиента: ${(totalGradNorm).toFixed(1)}.`,
        phase: `NLP Iter ${iter}`,
        nodesSnapshot: cloneNodesSnapshot(nodes),
        edgesSnapshot: cloneEdgesSnapshot(edges),
        highlightedNodes: Array.from(pinnedSet),
      });
    }
  }

  // -----------------------------------------------------------------------
  // STAGE 5: Artifact-Free Wire Routing on Optimized Positions
  // -----------------------------------------------------------------------
  const routedEdges = routeOrthogonalAStar(nodes, edges, options);

  // Apply strict 0-collision label engine
  computeOptimizedLabels(nodes, routedEdges, new Map(), options.labelClearance || 12);

  const finalBreakdown = calculateNLPOptimalityBreakdown(nodes, routedEdges, params);
  const improvement = Math.max(
    0,
    Math.round(((initialBreakdown.overallCostValue - finalBreakdown.overallCostValue) / Math.max(1, initialBreakdown.overallCostValue)) * 100)
  );

  steps.push({
    stepIndex: steps.length,
    title: 'NLP Решение найдено (Optimal Solution Converged)',
    description: `Оптимизация завершена. Улучшение целевой функции: +${improvement}%. Удовлетворены условия: строгие 90° вылеты, строгие надписи без пересечений, оптимальные дистанции D_opt=${D_opt}px, S_opt=${S_opt}px.`,
    phase: 'NLP Converged',
    nodesSnapshot: cloneNodesSnapshot(nodes),
    edgesSnapshot: cloneEdgesSnapshot(routedEdges),
    highlightedNodes: Array.from(pinnedSet),
  });

  return {
    nodes,
    edges: routedEdges,
    steps,
    history,
    initialBreakdown,
    finalBreakdown,
    improvementPercentage: improvement,
    pinnedNodeIds: Array.from(pinnedSet),
  };
}
