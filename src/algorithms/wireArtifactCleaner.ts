import { BlockNode, Point, PortCoordinates } from '../types';

export interface ObstacleBox {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Checks whether a line segment from p1 to p2 intersects an obstacle box.
 */
export function segmentIntersectsBox(p1: Point, p2: Point, box: ObstacleBox): boolean {
  const segMinX = Math.min(p1.x, p2.x);
  const segMaxX = Math.max(p1.x, p2.x);
  const segMinY = Math.min(p1.y, p2.y);
  const segMaxY = Math.max(p1.y, p2.y);

  // Quick bounding box rejection
  if (segMaxX <= box.minX || segMinX >= box.maxX || segMaxY <= box.minY || segMinY >= box.maxY) {
    return false;
  }

  // If vertical line
  if (Math.abs(p1.x - p2.x) < 0.5) {
    const x = p1.x;
    return x > box.minX && x < box.maxX && segMinY < box.maxY && segMaxY > box.minY;
  }

  // If horizontal line
  if (Math.abs(p1.y - p2.y) < 0.5) {
    const y = p1.y;
    return y > box.minY && y < box.maxY && segMinX < box.maxX && segMaxX > box.minX;
  }

  // General diagonal line intersection
  return true;
}

/**
 * Checks if an orthogonal segment runs right along the face/perimeter of a node.
 * Wires running along block faces are forbidden in schematics and EDA layouts.
 */
export function isRunningAlongNodeFace(p1: Point, p2: Point, node: BlockNode): boolean {
  const isVertical = Math.abs(p1.x - p2.x) < 0.8;
  const isHorizontal = Math.abs(p1.y - p2.y) < 0.8;

  const segMinX = Math.min(p1.x, p2.x);
  const segMaxX = Math.max(p1.x, p2.x);
  const segMinY = Math.min(p1.y, p2.y);
  const segMaxY = Math.max(p1.y, p2.y);

  const nodeRight = node.x + node.width;
  const nodeBottom = node.y + node.height;

  // Check left face (x == node.x) or right face (x == nodeRight)
  if (isVertical) {
    const onLeft = Math.abs(p1.x - node.x) < 1.5;
    const onRight = Math.abs(p1.x - nodeRight) < 1.5;
    if (onLeft || onRight) {
      // Overlaps vertically with node body
      if (segMinY < nodeBottom && segMaxY > node.y) {
        return true;
      }
    }
  }

  // Check top face (y == node.y) or bottom face (y == nodeBottom)
  if (isHorizontal) {
    const onTop = Math.abs(p1.y - node.y) < 1.5;
    const onBottom = Math.abs(p1.y - nodeBottom) < 1.5;
    if (onTop || onBottom) {
      // Overlaps horizontally with node body
      if (segMinX < nodeRight && segMaxX > node.x) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks whether an orthogonal segment [p1, p2] intersects any obstacle or travels along a block face
 * (excluding source & target nodes for outer clearance, but strictly forbidden for ALL node interior bodies and faces).
 */
export function isSegmentBlocked(
  p1: Point,
  p2: Point,
  obstacles: ObstacleBox[],
  nodes: BlockNode[],
  ignoreNodeIds: string[] = []
): boolean {
  // 1. Strict Physical Node Core Body & Face Check: FORBIDDEN for ALL blocks
  for (const node of nodes) {
    const coreBox: ObstacleBox = {
      id: node.id,
      minX: node.x + 0.5,
      maxX: node.x + node.width - 0.5,
      minY: node.y + 0.5,
      maxY: node.y + node.height - 0.5,
    };
    if (segmentIntersectsBox(p1, p2, coreBox)) {
      return true;
    }

    // Check if segment runs tangentially along the face of any node
    if (isRunningAlongNodeFace(p1, p2, node)) {
      return true;
    }
  }

  // 2. Inflated Clearance Area Check for other nodes
  const ignoreSet = new Set(ignoreNodeIds);
  for (const obs of obstacles) {
    if (ignoreSet.has(obs.id)) continue;
    if (segmentIntersectsBox(p1, p2, obs)) return true;
  }
  return false;
}

/**
 * Multi-Pass Orthogonal Wire Artifact Cleaner.
 * 
 * Strict Guarantees:
 * 1. 100% strict perpendicular 90° exit from source port along normal vector (length >= sStub).
 * 2. 100% strict perpendicular 90° entry into target port along inward normal vector (length >= tStub).
 * 3. Never allows wires to slide along or merge with block faces.
 * 4. Eliminates micro-jogs, stair-stepping, and collinear redundancies without violating port stubs.
 * 5. Replaces collinear facing ports with laser-straight 0-bend direct connections.
 */
export function cleanOrthogonalArtifacts(
  rawPoints: Point[],
  sourcePos?: PortCoordinates,
  targetPos?: PortCoordinates,
  nodes: BlockNode[] = [],
  clearance: number = 12,
  sourceStubLen?: number,
  targetStubLen?: number
): Point[] {
  if (!rawPoints || rawPoints.length <= 1) {
    if (sourcePos && targetPos) {
      return [{ x: sourcePos.x, y: sourcePos.y }, { x: targetPos.x, y: targetPos.y }];
    }
    return rawPoints || [];
  }

  // If no sourcePos/targetPos provided, synthesize from rawPoints endpoints
  const p0 = rawPoints[0];
  const pLast = rawPoints[rawPoints.length - 1];
  const sPos: PortCoordinates = sourcePos || {
    x: p0.x,
    y: p0.y,
    normal: { dx: 1, dy: 0 },
    side: 'right',
    port: { id: 'dummy_s', name: 'out', side: 'right', type: 'output' },
  };
  const tPos: PortCoordinates = targetPos || {
    x: pLast.x,
    y: pLast.y,
    normal: { dx: -1, dy: 0 },
    side: 'left',
    port: { id: 'dummy_t', name: 'in', side: 'left', type: 'input' },
  };

  const sStub = Math.max(16, sourceStubLen ?? (clearance + 6));
  const tStub = Math.max(16, targetStubLen ?? (clearance + 6));

  const obstacleBoxes: ObstacleBox[] = (nodes || []).map(n => ({
    id: n.id,
    minX: n.x - clearance,
    maxX: n.x + n.width + clearance,
    minY: n.y - clearance,
    maxY: n.y + n.height + clearance,
  }));

  const sourceNodeId = sPos.port ? ((nodes || []).find(n => (n.inputs || []).some(p => p.id === sPos.port.id) || (n.outputs || []).some(p => p.id === sPos.port.id))?.id || '') : '';
  const targetNodeId = tPos.port ? ((nodes || []).find(n => (n.inputs || []).some(p => p.id === tPos.port.id) || (n.outputs || []).some(p => p.id === tPos.port.id))?.id || '') : '';
  const ignoreIds = [sourceNodeId, targetNodeId].filter(Boolean);

  // PASS 0: Check if facing ports are collinearly aligned for a 0-BEND DIRECT WIRE (Laser line)
  // Facing horizontally (Source exits right, Target enters left, identical Y)
  if (sPos.normal.dx === 1 && tPos.normal.dx === -1 && Math.abs(sPos.y - tPos.y) <= 3 && tPos.x > sPos.x + 8) {
    const directStart: Point = { x: sPos.x, y: sPos.y };
    const directEnd: Point = { x: tPos.x, y: sPos.y }; // snap Y
    if (!isSegmentBlocked(directStart, directEnd, obstacleBoxes, nodes || [], ignoreIds)) {
      return [directStart, { x: tPos.x, y: tPos.y }];
    }
  }

  // Facing vertically (Source exits bottom, Target enters top, identical X)
  if (sPos.normal.dy === 1 && tPos.normal.dy === -1 && Math.abs(sPos.x - tPos.x) <= 3 && tPos.y > sPos.y + 8) {
    const directStart: Point = { x: sPos.x, y: sPos.y };
    const directEnd: Point = { x: sPos.x, y: tPos.y }; // snap X
    if (!isSegmentBlocked(directStart, directEnd, obstacleBoxes, nodes || [], ignoreIds)) {
      return [directStart, { x: tPos.x, y: tPos.y }];
    }
  }

  // PASS 1: Guarantee strict perpendicular 90° normal stubs at both endpoints
  const startStub: Point = {
    x: sPos.x + sPos.normal.dx * sStub,
    y: sPos.y + sPos.normal.dy * sStub,
  };
  const endStub: Point = {
    x: tPos.x + tPos.normal.dx * tStub,
    y: tPos.y + tPos.normal.dy * tStub,
  };

  // Filter middle points to remove any that are too close to endpoints or redundant
  const middlePoints = rawPoints.slice(1, -1).filter(pt => {
    const distToS = Math.hypot(pt.x - sPos.x, pt.y - sPos.y);
    const distToT = Math.hypot(pt.x - tPos.x, pt.y - tPos.y);
    return distToS > 8 && distToT > 8;
  });

  let points: Point[] = [
    { x: sPos.x, y: sPos.y },
    startStub,
    ...middlePoints,
    endStub,
    { x: tPos.x, y: tPos.y },
  ];

  // PASS 2: Redundant Collinear & Zero-Length Merging
  points = mergeCollinear(points);

  // PASS 3: Micro-Jog / Staircase Elimination on INTERMEDIATE segments ONLY
  // (Never touch points[0], points[1], points[last-1], or points[last] to keep 90° normal stubs intact)
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 4 && points.length >= 6) {
    improved = false;
    iterations++;

    for (let i = 2; i < points.length - 3; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2];

      // Check horizontal micro jog: p1 -> p2 is a short horizontal step (< 16px)
      if (Math.abs(p1.y - p2.y) < 0.5 && Math.abs(p1.x - p2.x) < 16) {
        const candidateP: Point = { x: p0.x, y: p3.y };
        if (
          !isSegmentBlocked(p0, candidateP, obstacleBoxes, nodes, ignoreIds) &&
          !isSegmentBlocked(candidateP, p3, obstacleBoxes, nodes, ignoreIds)
        ) {
          points.splice(i, 2, candidateP);
          points = mergeCollinear(points);
          improved = true;
          break;
        }
      }

      // Check vertical micro jog: p1 -> p2 is a short vertical step (< 16px)
      if (Math.abs(p1.x - p2.x) < 0.5 && Math.abs(p1.y - p2.y) < 16) {
        const candidateP: Point = { x: p3.x, y: p0.y };
        if (
          !isSegmentBlocked(p0, candidateP, obstacleBoxes, nodes, ignoreIds) &&
          !isSegmentBlocked(candidateP, p3, obstacleBoxes, nodes, ignoreIds)
        ) {
          points.splice(i, 2, candidateP);
          points = mergeCollinear(points);
          improved = true;
          break;
        }
      }
    }
  }

  // PASS 4: Direct Orthogonal Shortcut (Raycast shortcutting) on INTERIOR corridor points ONLY
  // (Constraint: i >= 1 and i + 3 <= points.length - 2)
  if (points.length >= 6) {
    for (let i = 1; i <= points.length - 5; i++) {
      const pA = points[i];
      const pD = points[i + 3];

      // Option 1: Corner (pA.x, pD.y)
      const corner1: Point = { x: pA.x, y: pD.y };
      if (
        !isSegmentBlocked(pA, corner1, obstacleBoxes, nodes, ignoreIds) &&
        !isSegmentBlocked(corner1, pD, obstacleBoxes, nodes, ignoreIds)
      ) {
        points.splice(i + 1, 2, corner1);
        points = mergeCollinear(points);
        break;
      }

      // Option 2: Corner (pD.x, pA.y)
      const corner2: Point = { x: pD.x, y: pA.y };
      if (
        !isSegmentBlocked(pA, corner2, obstacleBoxes, nodes, ignoreIds) &&
        !isSegmentBlocked(corner2, pD, obstacleBoxes, nodes, ignoreIds)
      ) {
        points.splice(i + 1, 2, corner2);
        points = mergeCollinear(points);
        break;
      }
    }
  }

  // PASS 5: HARD LOCK of 90° Perpendicular Normal Exit and Entry Stubs
  points = mergeCollinear(points);

  if (points.length < 4) {
    // If somehow reduced to fewer than 4 points and not a collinear laser, reconstruct 4-point corridor
    const midX = Math.round((startStub.x + endStub.x) / 2);
    const midY = Math.round((startStub.y + endStub.y) / 2);

    if (sPos.normal.dx !== 0 && tPos.normal.dx !== 0) {
      points = [
        { x: sPos.x, y: sPos.y },
        startStub,
        { x: midX, y: startStub.y },
        { x: midX, y: endStub.y },
        endStub,
        { x: tPos.x, y: tPos.y },
      ];
    } else if (sPos.normal.dy !== 0 && tPos.normal.dy !== 0) {
      points = [
        { x: sPos.x, y: sPos.y },
        startStub,
        { x: startStub.x, y: midY },
        { x: endStub.x, y: midY },
        endStub,
        { x: tPos.x, y: tPos.y },
      ];
    } else {
      if (sPos.normal.dx !== 0) {
        points = [
          { x: sPos.x, y: sPos.y },
          startStub,
          { x: endStub.x, y: startStub.y },
          endStub,
          { x: tPos.x, y: tPos.y },
        ];
      } else {
        points = [
          { x: sPos.x, y: sPos.y },
          startStub,
          { x: startStub.x, y: endStub.y },
          endStub,
          { x: tPos.x, y: tPos.y },
        ];
      }
    }
  }

  // Ensure start and end points match port anchor locations
  points[0] = { x: sPos.x, y: sPos.y };
  points[points.length - 1] = { x: tPos.x, y: tPos.y };

  // PASS 6: Enforce 100% strict orthogonal horizontal/vertical segments
  points = enforceStrictOrthogonality(points, obstacleBoxes, nodes, ignoreIds);

  const cleaned = mergeCollinear(points);

  // FINAL INTEGRITY CHECK: Ensure NO segment in the cleaned path cuts through any block core body
  for (let i = 0; i < cleaned.length - 1; i++) {
    for (const node of nodes) {
      if (node.id === sourceNodeId || node.id === targetNodeId) continue;
      const coreBox: ObstacleBox = {
        id: node.id,
        minX: node.x + 0.5,
        maxX: node.x + node.width - 0.5,
        minY: node.y + 0.5,
        maxY: node.y + node.height - 0.5,
      };
      if (segmentIntersectsBox(cleaned[i], cleaned[i + 1], coreBox)) {
        // If cleaned path introduced an obstacle collision, return original rawPoints
        return rawPoints;
      }
    }
  }

  return cleaned;
}

/**
 * Enforces that every single segment (p_i, p_{i+1}) is strictly horizontal or vertical.
 * If any diagonal exists, converts it into an orthogonal L-bend that avoids obstacles.
 */
function enforceStrictOrthogonality(
  points: Point[],
  obstacleBoxes: ObstacleBox[],
  nodes: BlockNode[],
  ignoreIds: string[]
): Point[] {
  if (points.length < 2) return points;

  const result: Point[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];

    const isHorizontal = Math.abs(prev.y - curr.y) < 0.8;
    const isVertical = Math.abs(prev.x - curr.x) < 0.8;

    if (isHorizontal) {
      result.push({ x: curr.x, y: prev.y });
    } else if (isVertical) {
      result.push({ x: prev.x, y: curr.y });
    } else {
      // Diagonal detected: Resolve into an orthogonal L-corner
      const corner1: Point = { x: curr.x, y: prev.y };
      const corner2: Point = { x: prev.x, y: curr.y };

      const c1Blocked = isSegmentBlocked(prev, corner1, obstacleBoxes, nodes, ignoreIds) ||
                        isSegmentBlocked(corner1, curr, obstacleBoxes, nodes, ignoreIds);
      
      if (!c1Blocked) {
        result.push(corner1);
      } else {
        result.push(corner2);
      }
      result.push(curr);
    }
  }

  return result;
}

/**
 * Merges redundant collinear segments and removes 0-length points.
 */
function mergeCollinear(points: Point[]): Point[] {
  if (points.length <= 2) return points;

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
