import { BlockNode, EdgeConnection, Point } from '../types';

export const MAX_LABEL_OFF_ARROW_PENALTY = 50000;

export interface OptimizedLabelPosition {
  edgeId: string;
  x: number; // Center X of label
  y: number; // Center Y of label
  width: number;
  height: number;
  anchorPoint: Point; // The exact point along the arrow's segment where it resides
  isOnArrow: boolean; // STRICT RULE: Must be TRUE (sitting on its own arrow)
  segmentIndex: number; // Index of the segment in edge.path
  penalty: number; // 0 if strictly on arrow with 0 collisions, 50,000 if not on arrow
  hasLeaderLine: boolean; // False when on arrow, true only if displaced/violation
  leaderLine?: Point[];
  angle: number; // 0 for horizontal, 90 for vertical
  isCollisionFree: boolean;
  clearanceDistance: number;
}

interface Segment {
  p1: Point;
  p2: Point;
  length: number;
  isHorizontal: boolean;
  edgeId: string;
  segIndex: number;
}

interface LabelAABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Checks if a 2D line segment intersects or lies within an Axis-Aligned Bounding Box (AABB)
 */
function isSegmentIntersectingAABB(p1: Point, p2: Point, box: LabelAABB): boolean {
  // 1. Check if either endpoint is inside the box
  if (
    (p1.x >= box.minX && p1.x <= box.maxX && p1.y >= box.minY && p1.y <= box.maxY) ||
    (p2.x >= box.minX && p2.x <= box.maxX && p2.y >= box.minY && p2.y <= box.maxY)
  ) {
    return true;
  }

  // 2. Segment bounding box overlap check (Quick rejection)
  const segMinX = Math.min(p1.x, p2.x);
  const segMaxX = Math.max(p1.x, p2.x);
  const segMinY = Math.min(p1.y, p2.y);
  const segMaxY = Math.max(p1.y, p2.y);

  if (segMaxX < box.minX || segMinX > box.maxX || segMaxY < box.minY || segMinY > box.maxY) {
    return false;
  }

  // 3. For strictly orthogonal lines (horizontal or vertical), bounding box overlap implies intersection
  const isOrthogonal = Math.abs(p1.x - p2.x) < 0.5 || Math.abs(p1.y - p2.y) < 0.5;
  if (isOrthogonal) {
    return true;
  }

  // 4. General line-segment box intersection via Liang-Barsky parametric clipping
  let t0 = 0.0;
  let t1 = 1.0;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  const p = [-dx, dx, -dy, dy];
  const q = [p1.x - box.minX, box.maxX - p1.x, p1.y - box.minY, box.maxY - p1.y];

  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-6) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0 <= t1;
}

const CANDIDATE_T: readonly number[] = [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75, 0.2, 0.8];

/**
 * Validates if candidate label bounding box has ZERO collisions with:
 * 1. All block nodes (with padding)
 * 2. Any OTHER edge wire traces (edgeId !== currentEdgeId)
 * 3. All previously positioned labels
 */
export function checkLabelCollisionStrict(
  cx: number,
  cy: number,
  width: number,
  height: number,
  currentEdgeId: string,
  nodes: BlockNode[],
  allSegments: Segment[],
  placedBoxes: LabelAABB[],
  clearance: number = 6
): boolean {
  const halfW = width / 2;
  const halfH = height / 2;

  const boxMinX = cx - halfW - clearance;
  const boxMaxX = cx + halfW + clearance;
  const boxMinY = cy - halfH - clearance;
  const boxMaxY = cy + halfH + clearance;

  // 1. Check against Block Nodes
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nodeLeft = node.x - clearance;
    const nodeRight = node.x + node.width + clearance;
    const nodeTop = node.y - clearance;
    const nodeBottom = node.y + node.height + clearance;

    const overlapsNode = !(
      boxMaxX < nodeLeft ||
      boxMinX > nodeRight ||
      boxMaxY < nodeTop ||
      boxMinY > nodeBottom
    );

    if (overlapsNode) return true; // Collision with block node!
  }

  // 2. Check against OTHER Wire Segments (wires belonging to other edges must NOT pass through this label)
  const box: LabelAABB = { minX: boxMinX, maxX: boxMaxX, minY: boxMinY, maxY: boxMaxY };
  for (let i = 0; i < allSegments.length; i++) {
    const seg = allSegments[i];
    if (seg.edgeId === currentEdgeId) continue; // Sits on own wire

    if (isSegmentIntersectingAABB(seg.p1, seg.p2, box)) {
      return true; // Collision with another wire!
    }
  }

  // 3. Check against previously placed Label Boxes
  for (let i = 0; i < placedBoxes.length; i++) {
    const placed = placedBoxes[i];
    const overlapsLabel = !(
      boxMaxX < placed.minX ||
      boxMinX > placed.maxX ||
      boxMaxY < placed.minY ||
      boxMinY > placed.maxY
    );

    if (overlapsLabel) return true; // Collision with another label!
  }

  return false; // 100% collision-free
}

/**
 * Strict On-Arrow Mathematical Label Placement (Строгое размещение подписи на стрелке)
 * 
 * Strict Mandate from User:
 * "Подписи стрелок должны находиться на стрелке своей (если нет то максимальный штраф)"
 * 
 * Strategy:
 * 1. For each edge, search points along its own path segments (longest horizontal/vertical spans).
 * 2. Find a point (cx, cy) on the edge where the label box:
 *    - Sits directly ON the wire segment (cx, cy is strictly on the segment).
 *    - Does NOT intersect any block node.
 *    - Does NOT intersect any OTHER wire trace.
 *    - Does NOT intersect any other label box.
 * 3. If found: isOnArrow = true, penalty = 0.
 * 4. If NO collision-free spot exists along the arrow path (e.g. arrow is too short or blocked):
 *    Penalty = MAX_LABEL_OFF_ARROW_PENALTY (50,000), signaling a severe NLP constraint violation!
 */
export function computeOptimizedLabels(
  nodes: BlockNode[],
  edges: EdgeConnection[],
  customOffsets: Map<string, Point> = new Map(),
  labelClearance: number = 8
): Map<string, OptimizedLabelPosition> {
  const resultMap = new Map<string, OptimizedLabelPosition>();
  const clearance = Math.max(4, labelClearance);

  // 1. Extract and index all wire segments from all edges in the diagram
  const allSegments: Segment[] = [];
  const edgeSegmentsMap = new Map<string, Segment[]>();

  for (let e = 0; e < edges.length; e++) {
    const edge = edges[e];
    const pts = edge.path || [];
    const segs: Segment[] = [];

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (len > 1) {
        const seg: Segment = {
          p1,
          p2,
          length: len,
          isHorizontal: Math.abs(p2.y - p1.y) < 1.5,
          edgeId: edge.id,
          segIndex: i,
        };
        allSegments.push(seg);
        segs.push(seg);
      }
    }
    edgeSegmentsMap.set(edge.id, segs);
  }

  const placedBoxes: LabelAABB[] = [];

  // 2. Process each edge label
  for (let e = 0; e < edges.length; e++) {
    const edge = edges[e];
    if (!edge.label || !edge.path || edge.path.length < 2) continue;

    const labelText = edge.label;
    const textWidth = Math.max(52, labelText.length * 7.2 + 18);
    const textHeight = 22;

    // Handle user manual custom offset (dragged manually by user)
    if (customOffsets.has(edge.id)) {
      const customPos = customOffsets.get(edge.id)!;
      const defaultAnchor = edge.path[Math.floor(edge.path.length / 2)];
      const distFromAnchor = Math.hypot(customPos.x - defaultAnchor.x, customPos.y - defaultAnchor.y);
      
      // Check if manually dragged position is still on the wire
      const edgeSegs = edgeSegmentsMap.get(edge.id) || [];
      let isOnWire = false;
      for (let s = 0; s < edgeSegs.length; s++) {
        const seg = edgeSegs[s];
        const minX = Math.min(seg.p1.x, seg.p2.x) - 4;
        const maxX = Math.max(seg.p1.x, seg.p2.x) + 4;
        const minY = Math.min(seg.p1.y, seg.p2.y) - 4;
        const maxY = Math.max(seg.p1.y, seg.p2.y) + 4;
        if (seg.isHorizontal && Math.abs(customPos.y - seg.p1.y) < 5 && customPos.x >= minX && customPos.x <= maxX) {
          isOnWire = true;
          break;
        } else if (!seg.isHorizontal && Math.abs(customPos.x - seg.p1.x) < 5 && customPos.y >= minY && customPos.y <= maxY) {
          isOnWire = true;
          break;
        }
      }

      const isColliding = checkLabelCollisionStrict(
        customPos.x,
        customPos.y,
        textWidth,
        textHeight,
        edge.id,
        nodes,
        allSegments,
        placedBoxes,
        clearance
      );

      const penalty = isOnWire && !isColliding ? 0 : MAX_LABEL_OFF_ARROW_PENALTY;

      placedBoxes.push({
        minX: customPos.x - textWidth / 2,
        maxX: customPos.x + textWidth / 2,
        minY: customPos.y - textHeight / 2,
        maxY: customPos.y + textHeight / 2,
      });

      resultMap.set(edge.id, {
        edgeId: edge.id,
        x: customPos.x,
        y: customPos.y,
        width: textWidth,
        height: textHeight,
        anchorPoint: defaultAnchor,
        isOnArrow: isOnWire,
        segmentIndex: 0,
        penalty,
        hasLeaderLine: !isOnWire && distFromAnchor > 14,
        leaderLine: !isOnWire && distFromAnchor > 14 ? [defaultAnchor, customPos] : undefined,
        angle: 0,
        isCollisionFree: !isColliding,
        clearanceDistance: clearance,
      });
      continue;
    }

    // Get segments of current edge
    const edgeSegments = edgeSegmentsMap.get(edge.id) || [];
    if (edgeSegments.length === 0) continue;

    // Sort candidate segments by suitability:
    // Prefer long segments (length >= textWidth) and prefer horizontal over vertical
    const sortedSegments = [...edgeSegments].sort((a, b) => {
      const scoreA = a.length * (a.isHorizontal ? 1.5 : 1.0);
      const scoreB = b.length * (b.isHorizontal ? 1.5 : 1.0);
      return scoreB - scoreA;
    });

    let bestPlacement: {
      pos: Point;
      segIndex: number;
      segment: Segment;
      isCollisionFree: boolean;
      isOnArrow: boolean;
      penalty: number;
    } | null = null;

    // Search candidate positions STRICTLY ALONG THE ARROW SEGMENTS
    for (const seg of sortedSegments) {
      // If segment is too short to reasonably host the text without bleeding into corner bends, still test middle
      for (const t of CANDIDATE_T) {
        const cx = Math.round(seg.p1.x + (seg.p2.x - seg.p1.x) * t);
        const cy = Math.round(seg.p1.y + (seg.p2.y - seg.p1.y) * t);

        const isColliding = checkLabelCollisionStrict(
          cx,
          cy,
          textWidth,
          textHeight,
          edge.id,
          nodes,
          allSegments,
          placedBoxes,
          clearance
        );

        if (!isColliding) {
          // Found an exact on-arrow, 0-collision placement!
          bestPlacement = {
            pos: { x: cx, y: cy },
            segIndex: seg.segIndex,
            segment: seg,
            isCollisionFree: true,
            isOnArrow: true,
            penalty: 0,
          };
          break;
        }
      }
      if (bestPlacement) break;
    }

    // If on-arrow placement succeeded:
    if (bestPlacement && bestPlacement.isCollisionFree) {
      placedBoxes.push({
        minX: bestPlacement.pos.x - textWidth / 2,
        maxX: bestPlacement.pos.x + textWidth / 2,
        minY: bestPlacement.pos.y - textHeight / 2,
        maxY: bestPlacement.pos.y + textHeight / 2,
      });

      resultMap.set(edge.id, {
        edgeId: edge.id,
        x: bestPlacement.pos.x,
        y: bestPlacement.pos.y,
        width: textWidth,
        height: textHeight,
        anchorPoint: bestPlacement.pos,
        isOnArrow: true,
        segmentIndex: bestPlacement.segIndex,
        penalty: 0,
        hasLeaderLine: false,
        angle: 0,
        isCollisionFree: true,
        clearanceDistance: clearance,
      });
    } else {
      // Constraint Violation: Arrow is too short or clamped, cannot fit label on arrow without collision!
      // Assign MAXIMUM PENALTY to force NLP optimizer to expand this edge
      const primarySeg = sortedSegments[0];
      const fallbackAnchor: Point = {
        x: Math.round((primarySeg.p1.x + primarySeg.p2.x) / 2),
        y: Math.round((primarySeg.p1.y + primarySeg.p2.y) / 2),
      };

      placedBoxes.push({
        minX: fallbackAnchor.x - textWidth / 2,
        maxX: fallbackAnchor.x + textWidth / 2,
        minY: fallbackAnchor.y - textHeight / 2,
        maxY: fallbackAnchor.y + textHeight / 2,
      });

      resultMap.set(edge.id, {
        edgeId: edge.id,
        x: fallbackAnchor.x,
        y: fallbackAnchor.y,
        width: textWidth,
        height: textHeight,
        anchorPoint: fallbackAnchor,
        isOnArrow: false, // Flagged violation
        segmentIndex: primarySeg.segIndex,
        penalty: MAX_LABEL_OFF_ARROW_PENALTY, // MAXIMUM PENALTY!
        hasLeaderLine: false,
        angle: 0,
        isCollisionFree: false,
        clearanceDistance: clearance,
      });
    }
  }

  return resultMap;
}
