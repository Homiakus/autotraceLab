import { BlockNode, EdgeConnection, Point, RoutingOptions } from '../types';
import { getPortCoordinates, computeAdaptivePortStub } from './orthogonalAStarRouter';

/**
 * G^1 Continuous Spline Router with Straight Main Segments and Tangent Landing Stubs.
 * Guarantees:
 * 1. Strict straight exit & entry normal vectors at ports.
 * 2. Main length kept straight as long as possible.
 * 3. G^1 tangent continuous cubic Bézier transitions between segments.
 */
export function routeSmoothSplines(
  nodes: BlockNode[],
  edges: EdgeConnection[],
  options: RoutingOptions
): EdgeConnection[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const isAdaptive = options.adaptivePortExitOffset !== false;
  const baseStub = options.portExitOffset || 24;
  const g1Weight = options.weights ? options.weights.g1SplineWeight : 65;

  return edges.map((edge) => {
    const sourceNode = nodeMap.get(edge.sourceBlockId);
    const targetNode = nodeMap.get(edge.targetBlockId);
    if (!sourceNode || !targetNode) return edge;

    const sourcePos = getPortCoordinates(sourceNode, edge.sourcePortId, true);
    const targetPos = getPortCoordinates(targetNode, edge.targetPortId, false);

    const sourceStub = computeAdaptivePortStub(
      sourcePos,
      targetPos,
      sourceNode,
      targetNode,
      nodes,
      baseStub,
      isAdaptive
    );

    const targetStub = computeAdaptivePortStub(
      targetPos,
      sourcePos,
      targetNode,
      sourceNode,
      nodes,
      baseStub,
      isAdaptive
    );

    // 1. Guaranteed straight exit stub along port normal with adaptive length
    const stubStart: Point = {
      x: sourcePos.x + sourcePos.normal.dx * sourceStub,
      y: sourcePos.y + sourcePos.normal.dy * sourceStub,
    };

    // 2. Guaranteed straight landing entry stub along port normal with adaptive length
    const stubEnd: Point = {
      x: targetPos.x + targetPos.normal.dx * targetStub,
      y: targetPos.y + targetPos.normal.dy * targetStub,
    };

    // If ports are co-axial (same Y or same X), line is 100% straight
    if (Math.abs(stubStart.y - stubEnd.y) < 2 && sourcePos.normal.dx === 1 && targetPos.normal.dx === -1) {
      return {
        ...edge,
        path: [
          { x: sourcePos.x, y: sourcePos.y },
          { x: targetPos.x, y: targetPos.y },
        ],
      };
    }

    const dx = stubEnd.x - stubStart.x;
    const dy = stubEnd.y - stubStart.y;

    // Build straight-majority path with G^1 S-spline bridge
    const points: Point[] = [{ x: sourcePos.x, y: sourcePos.y }, stubStart];

    if (sourcePos.normal.dx === 1 && targetPos.normal.dx === -1 && dx > 20) {
      // Forward horizontal connection with vertical delta:
      // Straight segment 1 -> G^1 Smooth S-curve in channel -> Straight segment 2
      const midX = stubStart.x + dx * 0.5;
      const handleDist = Math.min(Math.abs(dx) * 0.4, (g1Weight / 100) * 80 + 20);

      const cp1: Point = { x: midX - handleDist * 0.5, y: stubStart.y };
      const cp2: Point = { x: midX + handleDist * 0.5, y: stubEnd.y };

      const curve = sampleCubicBezier(stubStart, cp1, cp2, stubEnd, 16);
      points.push(...curve.slice(1, -1));
    } else {
      // General spline with guaranteed normal tangents
      const dist = Math.hypot(dx, dy);
      const handleDist = Math.max(20, Math.min(dist * 0.35, 100)) * (g1Weight / 70);

      const cp1: Point = {
        x: stubStart.x + sourcePos.normal.dx * handleDist,
        y: stubStart.y + sourcePos.normal.dy * handleDist,
      };

      const cp2: Point = {
        x: stubEnd.x + targetPos.normal.dx * handleDist,
        y: stubEnd.y + targetPos.normal.dy * handleDist,
      };

      const curve = sampleCubicBezier(stubStart, cp1, cp2, stubEnd, 18);
      points.push(...curve.slice(1, -1));
    }

    points.push(stubEnd);
    points.push({ x: targetPos.x, y: targetPos.y });

    return {
      ...edge,
      path: points,
    };
  });
}

function sampleCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, segments: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    const x = mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x;
    const y = mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y;
    points.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }
  return points;
}
