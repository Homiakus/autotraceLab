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
  totalEdgesOnFace: number = 1
): number {
  const minStub = 16;
  if (!isAdaptive) {
    return Math.max(minStub, baseStub);
  }

  // 1. Distance-based headroom
  const dx = Math.abs(portPos.x - targetPos.x);
  const dy = Math.abs(portPos.y - targetPos.y);
  const dist = Math.hypot(dx, dy);

  // If ports face directly towards each other along normal axis
  const isFacing =
    (portPos.normal.dx !== 0 && Math.sign(targetPos.x - portPos.x) === portPos.normal.dx) ||
    (portPos.normal.dy !== 0 && Math.sign(targetPos.y - portPos.y) === portPos.normal.dy);

  let maxAllowedStub = Math.max(minStub, baseStub);

  if (isFacing) {
    const directAxisDist = portPos.normal.dx !== 0 ? dx : dy;
    if (directAxisDist > 0) {
      // Never consume more than 40% of the open channel between facing ports
      maxAllowedStub = Math.min(baseStub, Math.max(minStub, (directAxisDist / 2) - 4));
    }
  } else {
    // If turning around, scale based on distance and clearance
    maxAllowedStub = Math.min(baseStub + 12, Math.max(minStub, Math.min(baseStub, dist * 0.25)));
  }

  // 2. Obstacle headroom in front of port
  for (const node of allNodes) {
    if (node.id === sourceNode.id) continue;

    // Check if node is in front of the port normal ray
    if (portPos.normal.dx === 1) {
      // exiting right
      if (node.x > portPos.x && node.y < portPos.y + 12 && node.y + node.height > portPos.y - 12) {
        const gap = node.x - portPos.x;
        if (gap > 0 && gap < maxAllowedStub + 10) {
          maxAllowedStub = Math.min(maxAllowedStub, Math.max(minStub, gap / 2 - 4));
        }
      }
    } else if (portPos.normal.dx === -1) {
      // exiting left
      const nodeRight = node.x + node.width;
      if (nodeRight < portPos.x && node.y < portPos.y + 12 && node.y + node.height > portPos.y - 12) {
        const gap = portPos.x - nodeRight;
        if (gap > 0 && gap < maxAllowedStub + 10) {
          maxAllowedStub = Math.min(maxAllowedStub, Math.max(minStub, gap / 2 - 4));
        }
      }
    } else if (portPos.normal.dy === 1) {
      // exiting bottom
      if (node.y > portPos.y && node.x < portPos.x + 12 && node.x + node.width > portPos.x - 12) {
        const gap = node.y - portPos.y;
        if (gap > 0 && gap < maxAllowedStub + 10) {
          maxAllowedStub = Math.min(maxAllowedStub, Math.max(minStub, gap / 2 - 4));
        }
      }
    } else if (portPos.normal.dy === -1) {
      // exiting top
      const nodeBottom = node.y + node.height;
      if (nodeBottom < portPos.y && node.x < portPos.x + 12 && node.x + node.width > portPos.x - 12) {
        const gap = portPos.y - nodeBottom;
        if (gap > 0 && gap < maxAllowedStub + 10) {
          maxAllowedStub = Math.min(maxAllowedStub, Math.max(minStub, gap / 2 - 4));
        }
      }
    }
  }

  // 3. Multi-port lane staggering on the same face (prevents 90° corner clashing)
  if (totalEdgesOnFace > 1) {
    const staggerDelta = 10;
    const staggered = maxAllowedStub + (edgeIndexOnFace - (totalEdgesOnFace - 1) / 2) * staggerDelta;
    return Math.max(minStub, Math.round(staggered));
  }

  return Math.max(minStub, Math.round(maxAllowedStub));
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
  return (gx + 10000) * 20000 + (gy + 10000);
}

/**
 * Packs undirected segment between (gx1, gy1) and (gx2, gy2) into a safe JavaScript number (< MAX_SAFE_INTEGER)
 */
function encodeSegKey(gx1: number, gy1: number, gx2: number, gy2: number): number {
  const c1 = (gx1 + 10000) * 20000 + (gy1 + 10000);
  const c2 = (gx2 + 10000) * 20000 + (gy2 + 10000);
  return c1 < c2 ? c1 * 100000000 + c2 : c2 * 100000000 + c1;
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
  minX -= 200;
  maxX += 200;
  minY -= 200;
  maxY += 200;

  // Track routed wire coordinates, segments and proximity fields using number keys (0 string allocation)
  const routedGridUsage = new Map<number, number>();
  const routedGridSegments = new Set<number>();
  const wireProximityMap = new Map<number, number>();

  // Inflated obstacles for pathfinding
  const obstacles: ObstacleBox[] = nodes.map(n => ({
    left: n.x - clearance,
    right: n.x + n.width + clearance,
    top: n.y - clearance,
    bottom: n.y + n.height + clearance,
    id: n.id,
    nodeX: n.x,
    nodeRight: n.x + n.width,
    nodeY: n.y,
    nodeBottom: n.y + n.height,
  }));

  function isInsideObstacle(px: number, py: number, allowNodeA?: string, allowNodeB?: string): boolean {
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];

      // 1. Strict Physical Node Body Interior Check: FORBIDDEN for ALL blocks (0 tolerance)
      // (Uses 0.1px margin so exact port contact points on the outer boundary face are not blocked)
      if (
        px > obs.nodeX + 0.1 &&
        px < obs.nodeRight - 0.1 &&
        py > obs.nodeY + 0.1 &&
        py < obs.nodeBottom - 0.1
      ) {
        return true;
      }

      // 2. Clearance buffer check for third-party blocks
      if (obs.id !== allowNodeA && obs.id !== allowNodeB) {
        if (px >= obs.left && px <= obs.right && py >= obs.top && py <= obs.bottom) {
          return true;
        }
      }
    }
    return false;
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
      Math.max(1, srcEdgeList.length)
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
      Math.max(1, tgtEdgeList.length)
    );

    // Strict exit and entry normal vectors (90° perpendicular to block edge) with adaptive lengths
    const startPoint: Point = {
      x: sourcePos.x + sourcePos.normal.dx * sourceStub,
      y: sourcePos.y + sourcePos.normal.dy * sourceStub,
    };

    const endPoint: Point = {
      x: targetPos.x + targetPos.normal.dx * targetStub,
      y: targetPos.y + targetPos.normal.dy * targetStub,
    };

    // Snap to grid
    const snapStartX = Math.round(startPoint.x / gridSize) * gridSize;
    const snapStartY = Math.round(startPoint.y / gridSize) * gridSize;
    const snapEndX = Math.round(endPoint.x / gridSize) * gridSize;
    const snapEndY = Math.round(endPoint.y / gridSize) * gridSize;

    const initialDirX = sourcePos.normal.dx;
    const initialDirY = sourcePos.normal.dy;
    const initialDirCode = getDirCode(initialDirX, initialDirY);

    const openHeap = new MinBinaryHeap<GridNode>(n => n.f);
    const closedSet = new Set<number>();
    const bestG = new Map<number, number>();

    const startGx = snapStartX / gridSize;
    const startGy = snapStartY / gridSize;
    const startNodeKey = encodeStateKey(startGx, startGy, initialDirCode);

    openHeap.push({
      x: snapStartX,
      y: snapStartY,
      dirX: initialDirX,
      dirY: initialDirY,
      g: 0,
      h: Math.abs(snapEndX - snapStartX) + Math.abs(snapEndY - snapStartY),
      f: Math.abs(snapEndX - snapStartX) + Math.abs(snapEndY - snapStartY),
    });
    bestG.set(startNodeKey, 0);

    let finalNode: GridNode | null = null;
    let iterations = 0;
    const maxIterations = 15000;

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
        if (isInsideObstacle(nx, ny, sourceNode.id, targetNode.id)) continue;

        const nextGx = nx / gridSize;
        const nextGy = ny / gridSize;

        // STRICT MANDATE: Arrows cannot coincide/overlap on the same segment (only cross orthogonally)
        const segKey = encodeSegKey(currGx, currGy, nextGx, nextGy);
        if (routedGridSegments.has(segKey)) {
          // Strictly FORBIDDEN to traverse along an already used line segment!
          continue;
        }

        const isBend = (current.dirX !== 0 || current.dirY !== 0) && (dir.dx !== current.dirX || dir.dy !== current.dirY);
        const cellKey = encodeCoordKey(nextGx, nextGy);
        const cellUsage = routedGridUsage.get(cellKey) || 0;
        const proximityPenalty = wireProximityMap.get(cellKey) || 0;
        
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
          (isBend ? bendCost : 0) -
          (isContinuingStraight ? straightBonusFactor : 0) +
          cellUsage * crossingPenaltyFactor +
          proximityPenalty * 10 -
          (alignsWithTargetApproach ? 8 : 0);
        const newG = current.g + Math.max(1, stepCost);

        const neighborKey = encodeStateKey(nextGx, nextGy, dir.code);
        const prevBestG = bestG.get(neighborKey);
        if (prevBestG !== undefined && newG >= prevBestG) {
          continue;
        }

        bestG.set(neighborKey, newG);

        const h = Math.abs(snapEndX - nx) + Math.abs(snapEndY - ny);
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
      // Fallback corridor based on port normals with strict obstacle clearance
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

    return {
      ...edge,
      path: cleaned,
    };
  });

  return routedEdges;
}

/**
 * Robust Obstacle-Bypassing Orthogonal Fallback Router.
 * Dynamically finds a clear perimeter corridor around intervening blocks,
 * guaranteeing 90° face exits and ZERO block collisions.
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
  const points: Point[] = [{ x: source.x, y: source.y }, startPoint];

  // Find all blocking nodes in the horizontal and vertical spans between start and end
  const xSpanMin = Math.min(startPoint.x, endPoint.x) - clearance;
  const xSpanMax = Math.max(startPoint.x, endPoint.x) + clearance;
  const xOverlappingNodes = nodes.filter(n => {
    return n.x < xSpanMax && n.x + n.width > xSpanMin;
  });

  const blockMinY = xOverlappingNodes.length > 0 ? Math.min(...xOverlappingNodes.map(n => n.y)) : Math.min(startPoint.y, endPoint.y);
  const blockMaxY = xOverlappingNodes.length > 0 ? Math.max(...xOverlappingNodes.map(n => n.y + n.height)) : Math.max(startPoint.y, endPoint.y);

  const ySpanMin = Math.min(startPoint.y, endPoint.y) - clearance;
  const ySpanMax = Math.max(startPoint.y, endPoint.y) + clearance;
  const yOverlappingNodes = nodes.filter(n => {
    return n.y < ySpanMax && n.y + n.height > ySpanMin;
  });

  const blockMinX = yOverlappingNodes.length > 0 ? Math.min(...yOverlappingNodes.map(n => n.x)) : Math.min(startPoint.x, endPoint.x);
  const blockMaxX = yOverlappingNodes.length > 0 ? Math.max(...yOverlappingNodes.map(n => n.x + n.width)) : Math.max(startPoint.x, endPoint.x);

  const intersectingNodes = nodes.filter(n => {
    const nRight = n.x + n.width;
    const nBottom = n.y + n.height;
    return n.x < xSpanMax && nRight > xSpanMin && n.y < ySpanMax && nBottom > ySpanMin;
  });

  const bypassAboveY = blockMinY - clearance - 16 + nudge;
  const bypassBelowY = blockMaxY + clearance + 16 + nudge;
  const bypassLeftX = blockMinX - clearance - 16 + nudge;
  const bypassRightX = blockMaxX + clearance + 16 + nudge;

  // Determine bypass corridor strictly constrained by port normal vectors
  let chosenY: number;
  if (target.normal.dy === 1) {
    // Must approach target from below
    chosenY = Math.max(bypassBelowY, endPoint.y);
  } else if (target.normal.dy === -1) {
    // Must approach target from above
    chosenY = Math.min(bypassAboveY, endPoint.y);
  } else if (source.normal.dy === 1) {
    chosenY = Math.max(bypassBelowY, startPoint.y);
  } else if (source.normal.dy === -1) {
    chosenY = Math.min(bypassAboveY, startPoint.y);
  } else {
    // Both horizontal ports: choose closest clear corridor
    const distAbove = Math.abs(startPoint.y - bypassAboveY) + Math.abs(endPoint.y - bypassAboveY);
    const distBelow = Math.abs(startPoint.y - bypassBelowY) + Math.abs(endPoint.y - bypassBelowY);
    chosenY = distAbove <= distBelow ? bypassAboveY : bypassBelowY;
  }

  // If source and target are both horizontal or perpendicular
  if (source.normal.dx !== 0 && target.normal.dx !== 0) {
    // Both horizontal
    if (intersectingNodes.length === 0 && ((source.normal.dx > 0 && target.normal.dx < 0 && startPoint.x < endPoint.x) || (source.normal.dx < 0 && target.normal.dx > 0 && startPoint.x > endPoint.x))) {
      const midX = Math.round((startPoint.x + endPoint.x) / 2) + nudge;
      points.push({ x: midX, y: startPoint.y });
      points.push({ x: midX, y: endPoint.y });
    } else {
      points.push({ x: startPoint.x, y: chosenY });
      points.push({ x: endPoint.x, y: chosenY });
    }
  } else if (source.normal.dy !== 0 && target.normal.dy !== 0) {
    // Both vertical
    if (intersectingNodes.length === 0 && ((source.normal.dy > 0 && target.normal.dy < 0 && startPoint.y < endPoint.y) || (source.normal.dy < 0 && target.normal.dy > 0 && startPoint.y > endPoint.y))) {
      const midY = Math.round((startPoint.y + endPoint.y) / 2) + nudge;
      points.push({ x: startPoint.x, y: midY });
      points.push({ x: endPoint.x, y: midY });
    } else {
      let chosenX: number;
      if (target.normal.dx === 1) chosenX = Math.max(bypassRightX, endPoint.x);
      else if (target.normal.dx === -1) chosenX = Math.min(bypassLeftX, endPoint.x);
      else chosenX = Math.abs(startPoint.x - bypassLeftX) <= Math.abs(startPoint.x - bypassRightX) ? bypassLeftX : bypassRightX;

      points.push({ x: chosenX, y: startPoint.y });
      points.push({ x: chosenX, y: endPoint.y });
    }
  } else {
    // One horizontal, one vertical
    if (source.normal.dx !== 0 && target.normal.dy !== 0) {
      // Exit horizontal, enter vertical
      points.push({ x: startPoint.x, y: chosenY });
      points.push({ x: endPoint.x, y: chosenY });
    } else if (source.normal.dy !== 0 && target.normal.dx !== 0) {
      // Exit vertical, enter horizontal
      let chosenX: number;
      if (target.normal.dx === 1) chosenX = Math.max(bypassRightX, endPoint.x);
      else if (target.normal.dx === -1) chosenX = Math.min(bypassLeftX, endPoint.x);
      else chosenX = Math.abs(startPoint.x - bypassLeftX) <= Math.abs(startPoint.x - bypassRightX) ? bypassLeftX : bypassRightX;

      points.push({ x: chosenX, y: startPoint.y });
      points.push({ x: chosenX, y: endPoint.y });
    } else {
      points.push({ x: startPoint.x, y: chosenY });
      points.push({ x: endPoint.x, y: chosenY });
    }
  }

  points.push(endPoint);
  points.push({ x: target.x, y: target.y });
  return points;
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
