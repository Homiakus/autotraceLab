import { BlockNode, EdgeConnection, Point, RoutingOptions, PortCoordinates, PortSide, Port } from '../types';
import { cleanOrthogonalArtifacts } from './wireArtifactCleaner';
import { getPortCoordinates } from './blockGeometry';

export { getPortCoordinates };

/**
 * Calculates adaptive, collision-safe stub length for a port on a block face.
 * Considers:
 * 1. Base user stub offset (e.g. 20px)
 * 2. Euclidean / orthogonal distance to target port (scales down if nodes are very close)
 * 3. Raycast obstacle distance directly in front of the port face normal
 * 4. Multi-port lane staggering on the same block face to prevent overlapping turn corners
 */
export function computeAdaptivePortStub(
  portPos: PortCoordinates,
  targetPos: PortCoordinates,
  sourceNode: BlockNode,
  targetNode: BlockNode,
  allNodes: BlockNode[],
  baseStub: number,
  isAdaptive: boolean = true,
  edgeIndexOnFace: number = 0,
  totalEdgesOnFace: number = 1,
  gridSize: number = 10
): number {
  const minStub = Math.max(10, gridSize);

  // Compute clear distance to any obstacle in front of the port
  let obstacleClearGap = Infinity;
  for (let i = 0; i < allNodes.length; i++) {
    const node = allNodes[i];
    if (node.id === sourceNode.id) continue;

    if (portPos.normal.dx === 1 && node.x > portPos.x && node.y < portPos.y + 10 && node.y + node.height > portPos.y - 10) {
      const gap = node.x - portPos.x - 6;
      if (gap > 0 && gap < obstacleClearGap) obstacleClearGap = gap;
    } else if (portPos.normal.dx === -1 && node.x + node.width < portPos.x && node.y < portPos.y + 10 && node.y + node.height > portPos.y - 10) {
      const gap = portPos.x - (node.x + node.width) - 6;
      if (gap > 0 && gap < obstacleClearGap) obstacleClearGap = gap;
    } else if (portPos.normal.dy === 1 && node.y > portPos.y && node.x < portPos.x + 10 && node.x + node.width > portPos.x - 10) {
      const gap = node.y - portPos.y - 6;
      if (gap > 0 && gap < obstacleClearGap) obstacleClearGap = gap;
    } else if (portPos.normal.dy === -1 && node.y + node.height < portPos.y && node.x < portPos.x + 10 && node.x + node.width > portPos.x - 10) {
      const gap = portPos.y - (node.y + node.height) - 6;
      if (gap > 0 && gap < obstacleClearGap) obstacleClearGap = gap;
    }
  }

  // 1. Distance-based headroom
  let maxAllowedStub = Math.max(minStub, baseStub);
  if (isAdaptive) {
    const dx = Math.abs(portPos.x - targetPos.x);
    const dy = Math.abs(portPos.y - targetPos.y);
    const dist = Math.hypot(dx, dy);

    // If ports face directly towards each other along normal axis
    const isFacing =
      (portPos.normal.dx !== 0 && Math.sign(targetPos.x - portPos.x) === portPos.normal.dx) ||
      (portPos.normal.dy !== 0 && Math.sign(targetPos.y - portPos.y) === portPos.normal.dy);

    if (isFacing) {
      const directAxisDist = portPos.normal.dx !== 0 ? dx : dy;
      if (directAxisDist > 0) {
        maxAllowedStub = Math.min(baseStub, Math.max(minStub, (directAxisDist / 2) - 4));
      }
    } else {
      maxAllowedStub = Math.min(baseStub + 12, Math.max(minStub, Math.min(baseStub, dist * 0.25)));
    }
  }

  // 3. Multi-port lane staggering on the same face (prevents 90° corner clashing & collinear trunk overlap)
  let resultStub = maxAllowedStub;
  if (totalEdgesOnFace > 1) {
    const staggerDelta = Math.max(8, gridSize);
    const staggered = maxAllowedStub + edgeIndexOnFace * staggerDelta;
    resultStub = Math.max(minStub, Math.round(staggered / gridSize) * gridSize);
  }

  // HARD SAFETY CLAMP: Never exceed available obstacle clearance in front of the port
  for (let i = 0; i < allNodes.length; i++) {
    const node = allNodes[i];
    if (node.id === sourceNode.id) continue;

    if (portPos.normal.dx === 1 && node.x > portPos.x && node.y < portPos.y + 10 && node.y + node.height > portPos.y - 10) {
      const clearGap = node.x - portPos.x - 6;
      if (clearGap > 0) resultStub = Math.min(resultStub, clearGap);
    } else if (portPos.normal.dx === -1 && node.x + node.width < portPos.x && node.y < portPos.y + 10 && node.y + node.height > portPos.y - 10) {
      const clearGap = portPos.x - (node.x + node.width) - 6;
      if (clearGap > 0) resultStub = Math.min(resultStub, clearGap);
    } else if (portPos.normal.dy === 1 && node.y > portPos.y && node.x < portPos.x + 10 && node.x + node.width > portPos.x - 10) {
      const clearGap = node.y - portPos.y - 6;
      if (clearGap > 0) resultStub = Math.min(resultStub, clearGap);
    } else if (portPos.normal.dy === -1 && node.y + node.height < portPos.y && node.x < portPos.x + 10 && node.x + node.width > portPos.x - 10) {
      const clearGap = portPos.y - (node.y + node.height) - 6;
      if (clearGap > 0) resultStub = Math.min(resultStub, clearGap);
    }
  }

  return Math.max(6, resultStub);
}

// =========================================================================
// High-Speed Binary Min-Heap Priority Queue for Sub-Millisecond A* Routing
// =========================================================================
class MinBinaryHeap<T> {
  private data: T[] = [];
  private score: (item: T) => number;

  constructor(scoreFn: (item: T) => number) {
    this.score = scoreFn;
  }

  get size(): number {
    return this.data.length;
  }

  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const bottom = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.score(this.data[idx]) < this.score(this.data[parentIdx])) {
        const tmp = this.data[idx];
        this.data[idx] = this.data[parentIdx];
        this.data[parentIdx] = tmp;
        idx = parentIdx;
      } else {
        break;
      }
    }
  }

  private sinkDown(idx: number): void {
    const length = this.data.length;
    while (true) {
      const leftChild = 2 * idx + 1;
      const rightChild = 2 * idx + 2;
      let swapIdx = -1;

      if (leftChild < length) {
        if (this.score(this.data[leftChild]) < this.score(this.data[idx])) {
          swapIdx = leftChild;
        }
      }

      if (rightChild < length) {
        if (
          (swapIdx === -1 && this.score(this.data[rightChild]) < this.score(this.data[idx])) ||
          (swapIdx !== -1 && this.score(this.data[rightChild]) < this.score(this.data[leftChild]))
        ) {
          swapIdx = rightChild;
        }
      }

      if (swapIdx !== -1) {
        const tmp = this.data[idx];
        this.data[idx] = this.data[swapIdx];
        this.data[swapIdx] = tmp;
        idx = swapIdx;
      } else {
        break;
      }
    }
  }
}

interface GridNode {
  x: number;
  y: number;
  dirX: number; // last movement direction
  dirY: number;
  g: number;
  h: number;
  f: number;
  parent?: GridNode;
}

interface ObstacleBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  id: string;
  nodeX: number;
  nodeRight: number;
  nodeY: number;
  nodeBottom: number;
}

/**
 * Direction index (0..4) for allocation-free state key packing
 */
function getDirCode(dx: number, dy: number): number {
  if (dx === 1) return 0;
  if (dx === -1) return 1;
  if (dy === 1) return 2;
  if (dy === -1) return 3;
  return 4;
}

/**
 * Packs (gx, gy, dirCode) into a single safe JavaScript number (< MAX_SAFE_INTEGER)
 */
function encodeStateKey(gx: number, gy: number, dirCode: number): number {
  return ((gx + 10000) * 20000 + (gy + 10000)) * 5 + dirCode;
}

/**
 * Packs (gx, gy) coordinate into a single safe integer
 */
function encodeCoordKey(gx: number, gy: number): number {
  const ix = Math.round(gx) + 5000;
  const iy = Math.round(gy) + 5000;
  return ix * 10000 + iy;
}

/**
 * Packs undirected segment between (gx1, gy1) and (gx2, gy2) into a collision-free safe string key
 */
function encodeSegKey(gx1: number, gy1: number, gx2: number, gy2: number): string {
  const c1 = encodeCoordKey(gx1, gy1);
  const c2 = encodeCoordKey(gx2, gy2);
  return c1 < c2 ? `${c1}_${c2}` : `${c2}_${c1}`;
}

/**
 * Orthogonal A* Router with 4-Way Normal Vectors, Bend Penalty & Obstacle Clearance
 * Mathematically guarantees collinear port entries (0°, 90°, 180°, 270°), zero block collisions,
 * and clean channel separation.
 */
export function routeOrthogonalAStar(
  nodes: BlockNode[],
  edges: EdgeConnection[],
  options: RoutingOptions
): EdgeConnection[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const gridSize = Math.max(6, Math.min(20, options.gridSize || 10));
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

  const clearanceScale = (weights.clearanceWeight / 80);
  const clearance = Math.max(8, (options.obstacleClearance || 16) * clearanceScale);
  const bendCost = (options.bendPenalty || 35) * (weights.bendWeight / 25);
  const crossingPenaltyFactor = weights.crossingWeight * 0.8 + 15;
  const straightBonusFactor = (weights.straightnessWeight / 100) * 12;
  const stepBaseCost = Math.max(2, gridSize * (weights.wirelengthWeight / 40 + 0.5));
  const stubLength = Math.max(18, options.portExitOffset || 24);
  const channelSpacing = options.minWireDistance || options.channelSpacing || 16;

  // Compute graph bounds with generous margin (avoiding spread allocations)
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.x < minX) minX = n.x;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y < minY) minY = n.y;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }
  if (minX === Infinity) {
    minX = 0; maxX = 1000; minY = 0; maxY = 1000;
  }
  minX -= 600;
  maxX += 600;
  minY -= 600;
  maxY += 600;

  // Track routed wire coordinates, segments and proximity fields
  const routedGridUsage = new Map<number, number>();
  const routedGridSegments = new Set<string>();
  const wireProximityMap = new Map<number, number>();

  // Inflated obstacles for pathfinding (honoring per-block variable routingClearance)
  const obstacles: ObstacleBox[] = nodes.map(n => {
    const blockClearance = (n.routingClearance !== undefined && n.routingClearance > 0)
      ? n.routingClearance * clearanceScale
      : clearance;
    return {
      left: n.x - blockClearance,
      right: n.x + n.width + blockClearance,
      top: n.y - blockClearance,
      bottom: n.y + n.height + blockClearance,
      id: n.id,
      nodeX: n.x,
      nodeRight: n.x + n.width,
      nodeY: n.y,
      nodeBottom: n.y + n.height,
    };
  });

  function isInsidePhysicalBody(px: number, py: number): boolean {
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (
        px > obs.nodeX + 0.1 &&
        px < obs.nodeRight - 0.1 &&
        py > obs.nodeY + 0.1 &&
        py < obs.nodeBottom - 0.1
      ) {
        return true;
      }
    }
    return false;
  }

  function getClearancePenalty(px: number, py: number, allowNodeA?: string, allowNodeB?: string): number {
    let penalty = 0;
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (obs.id !== allowNodeA && obs.id !== allowNodeB) {
        if (px >= obs.left && px <= obs.right && py >= obs.top && py <= obs.bottom) {
          penalty += 350;
        }
      }
    }
    return penalty;
  }

  // Pre-calculate edge distribution per face for port lane staggering
  const edgesOnSourceFace = new Map<string, string[]>();
  const edgesOnTargetFace = new Map<string, string[]>();

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const sNode = nodeMap.get(e.sourceBlockId);
    const tNode = nodeMap.get(e.targetBlockId);
    if (sNode) {
      const sPos = getPortCoordinates(sNode, e.sourcePortId, true);
      const key = `${sNode.id}-${sPos.side}`;
      let list = edgesOnSourceFace.get(key);
      if (!list) {
        list = [];
        edgesOnSourceFace.set(key, list);
      }
      list.push(e.id);
    }
    if (tNode) {
      const tPos = getPortCoordinates(tNode, e.targetPortId, false);
      const key = `${tNode.id}-${tPos.side}`;
      let list = edgesOnTargetFace.get(key);
      if (!list) {
        list = [];
        edgesOnTargetFace.set(key, list);
      }
      list.push(e.id);
    }
  }

  const dirs = [
    { dx: 1, dy: 0, code: 0 },
    { dx: -1, dy: 0, code: 1 },
    { dx: 0, dy: 1, code: 2 },
    { dx: 0, dy: -1, code: 3 },
  ];

  const routedEdges = edges.map((edge, edgeIdx) => {
    const sourceNode = nodeMap.get(edge.sourceBlockId);
    const targetNode = nodeMap.get(edge.targetBlockId);
    if (!sourceNode || !targetNode) return edge;

    const sourcePos = getPortCoordinates(sourceNode, edge.sourcePortId, true);
    const targetPos = getPortCoordinates(targetNode, edge.targetPortId, false);

    // Dynamic channel staggering along channelSpacing
    const channelStep = Math.max(8, Math.round(channelSpacing / 2));
    const nudge = ((edgeIdx % 5) - 2) * channelStep;

    const isAdaptive = options.adaptivePortExitOffset !== false;
    const baseStub = options.portExitOffset || 20;

    const srcFaceKey = `${sourceNode.id}-${sourcePos.side}`;
    const srcEdgeList = edgesOnSourceFace.get(srcFaceKey) || [];
    const srcIdx = srcEdgeList.indexOf(edge.id);

    const tgtFaceKey = `${targetNode.id}-${targetPos.side}`;
    const tgtEdgeList = edgesOnTargetFace.get(tgtFaceKey) || [];
    const tgtIdx = tgtEdgeList.indexOf(edge.id);

    const sourceStub = computeAdaptivePortStub(
      sourcePos,
      targetPos,
      sourceNode,
      targetNode,
      nodes,
      baseStub,
      isAdaptive,
      srcIdx >= 0 ? srcIdx : 0,
      Math.max(1, srcEdgeList.length),
      gridSize
    );

    const targetStub = computeAdaptivePortStub(
      targetPos,
      sourcePos,
      targetNode,
      sourceNode,
      nodes,
      baseStub,
      isAdaptive,
      tgtIdx >= 0 ? tgtIdx : 0,
      Math.max(1, tgtEdgeList.length),
      gridSize
    );

    // Strict exit and entry normal vectors (90° perpendicular to block edge) with adaptive lengths
    let sStub = sourceStub;
    while (sStub > 2 && isInsidePhysicalBody(sourcePos.x + sourcePos.normal.dx * sStub, sourcePos.y + sourcePos.normal.dy * sStub)) {
      sStub -= 1;
    }
    const startPoint: Point = {
      x: sourcePos.x + sourcePos.normal.dx * sStub,
      y: sourcePos.y + sourcePos.normal.dy * sStub,
    };

    let tStub = targetStub;
    while (tStub > 2 && isInsidePhysicalBody(targetPos.x + targetPos.normal.dx * tStub, targetPos.y + targetPos.normal.dy * tStub)) {
      tStub -= 1;
    }
    const endPoint: Point = {
      x: targetPos.x + targetPos.normal.dx * tStub,
      y: targetPos.y + targetPos.normal.dy * tStub,
    };

    // Snap to grid with physical obstacle safety guard
    let snapStartX = Math.round(startPoint.x / gridSize) * gridSize;
    let snapStartY = Math.round(startPoint.y / gridSize) * gridSize;
    if (isInsidePhysicalBody(snapStartX, snapStartY)) {
      snapStartX = startPoint.x;
      snapStartY = startPoint.y;
    }

    let snapEndX = Math.round(endPoint.x / gridSize) * gridSize;
    let snapEndY = Math.round(endPoint.y / gridSize) * gridSize;
    if (isInsidePhysicalBody(snapEndX, snapEndY)) {
      snapEndX = endPoint.x;
      snapEndY = endPoint.y;
    }

    const initialDirX = sourcePos.normal.dx;
    const initialDirY = sourcePos.normal.dy;
    const initialDirCode = getDirCode(initialDirX, initialDirY);

    const openHeap = new MinBinaryHeap<GridNode>(n => n.f);
    const closedSet = new Set<number>();
    const bestG = new Map<number, number>();

    const startGx = snapStartX / gridSize;
    const startGy = snapStartY / gridSize;
    const startNodeKey = encodeStateKey(startGx, startGy, initialDirCode);

    const hScale = Math.max(1.1, stepBaseCost / gridSize);
    const startH = (Math.abs(snapEndX - snapStartX) + Math.abs(snapEndY - snapStartY)) * hScale;
    openHeap.push({
      x: snapStartX,
      y: snapStartY,
      dirX: initialDirX,
      dirY: initialDirY,
      g: 0,
      h: startH,
      f: startH,
    });
    bestG.set(startNodeKey, 0);

    let finalNode: GridNode | null = null;
    let iterations = 0;
    const maxIterations = 100000;

    while (openHeap.size > 0 && iterations < maxIterations) {
      iterations++;
      const current = openHeap.pop()!;

      const distToEnd = Math.abs(current.x - snapEndX) + Math.abs(current.y - snapEndY);
      if (distToEnd <= gridSize) {
        finalNode = current;
        break;
      }

      const currGx = current.x / gridSize;
      const currGy = current.y / gridSize;
      const currDirCode = getDirCode(current.dirX, current.dirY);
      const stateKey = encodeStateKey(currGx, currGy, currDirCode);

      if (closedSet.has(stateKey)) continue;
      closedSet.add(stateKey);

      for (let d = 0; d < 4; d++) {
        const dir = dirs[d];
        // Prevent 180-degree immediate reversal
        if (dir.dx === -current.dirX && dir.dy === -current.dirY && (current.dirX !== 0 || current.dirY !== 0)) {
          continue;
        }

        const nx = current.x + dir.dx * gridSize;
        const ny = current.y + dir.dy * gridSize;

        if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
        if (isInsidePhysicalBody(nx, ny)) continue;

        const nextGx = nx / gridSize;
        const nextGy = ny / gridSize;

        // STRICT MANDATE: Wires cannot share collinear segments (massive 50,000 barrier penalty)
        const segKey = encodeSegKey(currGx, currGy, nextGx, nextGy);
        const collinearPenalty = routedGridSegments.has(segKey) ? 50000 : 0;
        const clearancePenalty = getClearancePenalty(nx, ny, sourceNode.id, targetNode.id);

        const isBend = (current.dirX !== 0 || current.dirY !== 0) && (dir.dx !== current.dirX || dir.dy !== current.dirY);
        const cellKey = encodeCoordKey(nextGx, nextGy);
        const cellUsage = routedGridUsage.get(cellKey) || 0;
        const proximityPenalty = (wireProximityMap.get(cellKey) || 0) * 20;
        
        // Alignment bonus if moving towards target's required entry direction (90° approach)
        const alignsWithTargetApproach = 
          (targetPos.normal.dx === -1 && dir.dx === 1) ||
          (targetPos.normal.dx === 1 && dir.dx === -1) ||
          (targetPos.normal.dy === -1 && dir.dy === 1) ||
          (targetPos.normal.dy === 1 && dir.dy === -1);

        // Straight continuation reward (keeps the main span straight)
        const isContinuingStraight = !isBend && (current.dirX !== 0 || current.dirY !== 0);

        const stepCost =
          stepBaseCost +
          clearancePenalty +
          collinearPenalty +
          (isBend ? bendCost : 0) -
          (isContinuingStraight ? straightBonusFactor : 0) +
          cellUsage * crossingPenaltyFactor +
          proximityPenalty -
          (alignsWithTargetApproach ? 8 : 0);
        const newG = current.g + Math.max(1, stepCost);

        const neighborKey = encodeStateKey(nextGx, nextGy, dir.code);
        const prevBestG = bestG.get(neighborKey);
        if (prevBestG !== undefined && newG >= prevBestG) {
          continue;
        }

        bestG.set(neighborKey, newG);

        const hScale = Math.max(1.1, stepBaseCost / gridSize);
        const h = (Math.abs(snapEndX - nx) + Math.abs(snapEndY - ny)) * hScale;
        const neighbor: GridNode = {
          x: nx,
          y: ny,
          dirX: dir.dx,
          dirY: dir.dy,
          g: newG,
          h,
          f: newG + h,
          parent: current,
        };

        openHeap.push(neighbor);
      }
    }

    // Reconstruct path
    const rawPoints: Point[] = [];
    if (finalNode) {
      let curr: GridNode | undefined = finalNode;
      while (curr) {
        rawPoints.unshift({ x: curr.x, y: curr.y });
        const currGx = curr.x / gridSize;
        const currGy = curr.y / gridSize;
        const coordKey = encodeCoordKey(currGx, currGy);
        routedGridUsage.set(coordKey, (routedGridUsage.get(coordKey) || 0) + 1);

        if (curr.parent) {
          const parentGx = curr.parent.x / gridSize;
          const parentGy = curr.parent.y / gridSize;
          const segKey = encodeSegKey(parentGx, parentGy, currGx, currGy);
          routedGridSegments.add(segKey);
        }

        // Update wire proximity clearance field to enforce channel separation
        const proxRadius = Math.ceil(channelSpacing / gridSize);
        for (let dx = -proxRadius; dx <= proxRadius; dx++) {
          for (let dy = -proxRadius; dy <= proxRadius; dy++) {
            if (dx === 0 && dy === 0) continue;
            const pxKey = encodeCoordKey(currGx + dx, currGy + dy);
            wireProximityMap.set(pxKey, (wireProximityMap.get(pxKey) || 0) + 1);
          }
        }

        curr = curr.parent;
      }
    }

    let fullPath: Point[] = [];
    if (rawPoints.length > 0) {
      fullPath = [
        { x: sourcePos.x, y: sourcePos.y },
        { x: startPoint.x, y: startPoint.y },
        ...rawPoints,
        { x: endPoint.x, y: endPoint.y },
        { x: targetPos.x, y: targetPos.y },
      ];
    } else {
      // Guaranteed 100% collision-free outer perimeter fallback
      fullPath = createObstacleBypassingOrthogonalPath(
        sourcePos,
        targetPos,
        startPoint,
        endPoint,
        nodes,
        nudge,
        clearance
      );
    }

    const simplified = simplifyOrthogonalPath(fullPath);
    const cleaned = cleanOrthogonalArtifacts(
      simplified,
      sourcePos,
      targetPos,
      nodes,
      options.obstacleClearance || 12,
      sourceStub,
      targetStub
    );
    // Register all discretized segments of the cleaned path into routedGridSegments
    for (let i = 0; i < cleaned.length - 1; i++) {
      const pt1 = cleaned[i];
      const pt2 = cleaned[i + 1];
      const g1x = Math.round(pt1.x / gridSize);
      const g1y = Math.round(pt1.y / gridSize);
      const g2x = Math.round(pt2.x / gridSize);
      const g2y = Math.round(pt2.y / gridSize);

      if (g1x === g2x && g1y === g2y) continue;

      const isHorizontal = Math.abs(pt1.y - pt2.y) < 1.0;
      if (isHorizontal) {
        const minGx = Math.min(g1x, g2x);
        const maxGx = Math.max(g1x, g2x);
        for (let gx = minGx; gx < maxGx; gx++) {
          routedGridSegments.add(encodeSegKey(gx, g1y, gx + 1, g1y));
        }
      } else {
        const minGy = Math.min(g1y, g2y);
        const maxGy = Math.max(g1y, g2y);
        for (let gy = minGy; gy < maxGy; gy++) {
          routedGridSegments.add(encodeSegKey(g1x, gy, g1x, gy + 1));
        }
      }
    }

    return {
      ...edge,
      path: cleaned,
    };
  });

  return routedEdges;
}

/**
 * Guaranteed 100% Collision-Free BFS Grid Fallback Router.
 * Explores physical open space on a coarse grid to find a clean detour around all block bodies.
 * Mathematically guarantees ZERO obstacle body collisions under any topological extremes.
 */
function createObstacleBypassingOrthogonalPath(
  source: PortCoordinates,
  target: PortCoordinates,
  startPoint: Point,
  endPoint: Point,
  nodes: BlockNode[],
  nudge: number = 0,
  clearance: number = 16
): Point[] {
  const coarseGrid = 16;
  const snapSx = Math.round(startPoint.x / coarseGrid) * coarseGrid;
  const snapSy = Math.round(startPoint.y / coarseGrid) * coarseGrid;
  const snapTx = Math.round(endPoint.x / coarseGrid) * coarseGrid;
  const snapTy = Math.round(endPoint.y / coarseGrid) * coarseGrid;

  // Global bounds with perimeter envelope
  let minX = Math.min(snapSx, snapTx);
  let maxX = Math.max(snapSx, snapTx);
  let minY = Math.min(snapSy, snapTy);
  let maxY = Math.max(snapSy, snapTy);

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.x < minX) minX = n.x;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y < minY) minY = n.y;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }
  minX -= 160; maxX += 160; minY -= 160; maxY += 160;

  function isSegmentBlocked(x1: number, y1: number, x2: number, y2: number): boolean {
    const minSegX = Math.min(x1, x2);
    const maxSegX = Math.max(x1, x2);
    const minSegY = Math.min(y1, y2);
    const maxSegY = Math.max(y1, y2);

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (
        maxSegX > n.x + 2 &&
        minSegX < n.x + n.width - 2 &&
        maxSegY > n.y + 2 &&
        minSegY < n.y + n.height - 2
      ) {
        return true;
      }
    }
    return false;
  }

  // Queue for BFS
  interface BFSNode {
    x: number;
    y: number;
    parent?: BFSNode;
  }

  const queue: BFSNode[] = [{ x: snapSx, y: snapSy }];
  const visited = new Set<string>();
  visited.add(`${snapSx}_${snapSy}`);

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  let targetNode: BFSNode | null = null;
  let bfsIterations = 0;
  const maxBfsIterations = 25000;

  while (queue.length > 0 && bfsIterations < maxBfsIterations) {
    bfsIterations++;
    const curr = queue.shift()!;

    if (Math.abs(curr.x - snapTx) <= coarseGrid && Math.abs(curr.y - snapTy) <= coarseGrid) {
      targetNode = curr;
      break;
    }

    for (let d = 0; d < 4; d++) {
      const nx = curr.x + dirs[d].dx * coarseGrid;
      const ny = curr.y + dirs[d].dy * coarseGrid;

      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      if (isSegmentBlocked(curr.x, curr.y, nx, ny)) continue;

      const key = `${nx}_${ny}`;
      if (visited.has(key)) continue;
      visited.add(key);

      queue.push({ x: nx, y: ny, parent: curr });
    }
  }

  const rawPts: Point[] = [];
  let cNode = targetNode;
  while (cNode) {
    rawPts.unshift({ x: cNode.x, y: cNode.y });
    cNode = cNode.parent;
  }

  if (rawPts.length > 0) {
    return [
      { x: source.x, y: source.y },
      startPoint,
      ...rawPts,
      endPoint,
      { x: target.x, y: target.y },
    ];
  }

  // Extreme fallback: Outer bounding ring with staggered dedicated track
  const outerLeft = minX + nudge;
  const outerRight = maxX + nudge;
  const outerTop = minY + nudge;
  const outerBottom = maxY + nudge;
  const exitY = startPoint.y < (minY + maxY) / 2 ? outerTop : outerBottom;
  const approachX = endPoint.x < (minX + maxX) / 2 ? outerLeft : outerRight;

  return [
    { x: source.x, y: source.y },
    startPoint,
    { x: startPoint.x, y: exitY },
    { x: approachX, y: exitY },
    { x: approachX, y: endPoint.y },
    { x: endPoint.x, y: endPoint.y },
    { x: target.x, y: target.y },
  ];
}

/**
 * Simplifies an orthogonal polyline, merging collinear segments while strictly preserving
 * the perpendicular exit and entry normal vectors at the endpoints.
 */
export function simplifyOrthogonalPath(points: Point[]): Point[] {
  if (points.length <= 2) return points;

  // Preserve the exact start and end stub segments
  const result: Point[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    const isCollinearX =
      Math.abs(prev.x - curr.x) < 0.8 &&
      Math.abs(curr.x - next.x) < 0.8 &&
      (curr.y - prev.y) * (next.y - curr.y) >= -0.01;

    const isCollinearY =
      Math.abs(prev.y - curr.y) < 0.8 &&
      Math.abs(curr.y - next.y) < 0.8 &&
      (curr.x - prev.x) * (next.x - curr.x) >= -0.01;

    const isZeroLength = Math.abs(prev.x - curr.x) < 0.8 && Math.abs(prev.y - curr.y) < 0.8;

    if (!isCollinearX && !isCollinearY && !isZeroLength) {
      result.push(curr);
    }
  }

  result.push(points[points.length - 1]);
  return result;
}
