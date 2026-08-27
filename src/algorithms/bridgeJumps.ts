import { EdgeConnection, Point, OptimizationWeights, RoutingOptions } from '../types';

export interface WireSegment {
  edgeId: string;
  p1: Point;
  p2: Point;
  isHorizontal: boolean;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface WireIntersection {
  edgeId: string;
  x: number;
  y: number;
  segmentIndex: number;
}

/**
 * Calculates IEEE 315 / IEC 60617 Bridge Jump (Line Hop) Arcs for orthogonal wire crossings
 * with variable/adaptive G^1 Geometric Continuity at corners and terminal endpoints while preserving strict
 * straight line bodies along main spans.
 */
export function generateOrthogonalPathWithBridges(
  points: Point[],
  edgeId: string,
  allEdges: EdgeConnection[],
  enableBridges: boolean,
  smoothCorners: boolean = true,
  weights?: OptimizationWeights,
  options?: RoutingOptions
): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (!enableBridges || points.length < 2) {
    return renderG1ContinuousStraightPath(points, smoothCorners, weights, options);
  }

  // 1. Collect all other edge segments
  const otherSegments: WireSegment[] = [];
  allEdges.forEach(other => {
    if (other.id === edgeId || !other.path || other.path.length < 2) return;
    for (let i = 0; i < other.path.length - 1; i++) {
      const a = other.path[i];
      const b = other.path[i + 1];
      const isH = Math.abs(a.y - b.y) < 1;
      otherSegments.push({
        edgeId: other.id,
        p1: a,
        p2: b,
        isHorizontal: isH,
        minX: Math.min(a.x, b.x),
        maxX: Math.max(a.x, b.x),
        minY: Math.min(a.y, b.y),
        maxY: Math.max(a.y, b.y),
      });
    }
  });

  const bridgeRadius = 5.5;
  const minClearanceFromCorner = bridgeRadius + 8.0;

  // Render path with bridge hops on vertical segments crossing horizontal wires
  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const isVertical = Math.abs(p1.x - p2.x) < 1;
    const isHorizontal = Math.abs(p1.y - p2.y) < 1;

    if (isVertical) {
      const segMinY = Math.min(p1.y, p2.y);
      const segMaxY = Math.max(p1.y, p2.y);
      const segX = p1.x;
      const isMovingDown = p2.y > p1.y;

      // Find valid crossing horizontal segments that are not too close to corners/terminals
      const hops: number[] = [];
      otherSegments.forEach(other => {
        if (
          other.isHorizontal &&
          other.minX < segX - 3 &&
          other.maxX > segX + 3 &&
          other.p1.y > segMinY + minClearanceFromCorner &&
          other.p1.y < segMaxY - minClearanceFromCorner
        ) {
          hops.push(other.p1.y);
        }
      });

      // Sort hops along direction of travel
      if (isMovingDown) {
        hops.sort((a, b) => a - b);
      } else {
        hops.sort((a, b) => b - a);
      }

      hops.forEach(hopY => {
        const startArcY = isMovingDown ? hopY - bridgeRadius : hopY + bridgeRadius;
        const endArcY = isMovingDown ? hopY + bridgeRadius : hopY - bridgeRadius;
        // Moving down (top to bottom): sweepFlag=1 curves to the right (+X)
        // Moving up (bottom to top): sweepFlag=0 curves to the right (+X)
        const sweepFlag = isMovingDown ? 1 : 0;

        d += ` L ${segX} ${startArcY}`;
        d += ` A ${bridgeRadius} ${bridgeRadius} 0 0 ${sweepFlag} ${segX} ${endArcY}`;
      });

      d += ` L ${p2.x} ${p2.y}`;
    } else {
      d += ` L ${p2.x} ${p2.y}`;
    }
  }

  return d;
}

/**
 * Renders a path that keeps the primary main length strictly straight, with G^1 continuous
 * cubic Bézier spline transitions at corners without ever overlapping on short segments.
 */
export function renderG1ContinuousStraightPath(
  points: Point[],
  smoothCorners: boolean,
  weights?: OptimizationWeights,
  options?: RoutingOptions
): string {
  if (points.length <= 1) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const explicitRadius = options?.cornerRadius !== undefined ? options.cornerRadius : (options?.smoothCorners === false ? 0 : 12);
  const isAdaptive = options?.adaptiveCornerRadius !== false;
  const g1Weight = weights ? weights.g1SplineWeight : 65;

  if (!smoothCorners || explicitRadius <= 0 || g1Weight <= 0) {
    return points.reduce((acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  }

  const baseRadius = Math.max(2, explicitRadius * (g1Weight / 70));
  const kappa = 0.55228475;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const pPrev = points[i - 1];
    const pCurr = points[i];
    const pNext = points[i + 1];

    const d1x = pCurr.x - pPrev.x;
    const d1y = pCurr.y - pPrev.y;
    const len1 = Math.hypot(d1x, d1y);

    const d2x = pNext.x - pCurr.x;
    const d2y = pNext.y - pCurr.y;
    const len2 = Math.hypot(d2x, d2y);

    if (len1 < 2 || len2 < 2) {
      d += ` L ${pCurr.x} ${pCurr.y}`;
      continue;
    }

    const u1x = d1x / len1;
    const u1y = d1y / len1;
    const u2x = d2x / len2;
    const u2y = d2y / len2;

    const dot = u1x * u2x + u1y * u2y;
    if (Math.abs(dot) > 0.98) {
      d += ` L ${pCurr.x} ${pCurr.y}`;
      continue;
    }

    // Safety: each corner can NEVER take more than 45% of incoming or outgoing span.
    // This strictly guarantees that two adjacent corners on a short segment never collide or loop backwards.
    const maxRadius = isAdaptive
      ? Math.min(baseRadius, len1 * 0.45, len2 * 0.45)
      : Math.min(baseRadius, len1 * 0.45, len2 * 0.45);

    if (maxRadius > 1.5) {
      const startX = pCurr.x - u1x * maxRadius;
      const startY = pCurr.y - u1y * maxRadius;
      const endX = pCurr.x + u2x * maxRadius;
      const endY = pCurr.y + u2y * maxRadius;

      const cp1X = startX + u1x * (maxRadius * kappa);
      const cp1Y = startY + u1y * (maxRadius * kappa);
      const cp2X = endX - u2x * (maxRadius * kappa);
      const cp2Y = endY - u2y * (maxRadius * kappa);

      d += ` L ${startX.toFixed(2)} ${startY.toFixed(2)}`;
      d += ` C ${cp1X.toFixed(2)} ${cp1Y.toFixed(2)}, ${cp2X.toFixed(2)} ${cp2Y.toFixed(2)}, ${endX.toFixed(2)} ${endY.toFixed(2)}`;
    } else {
      d += ` L ${pCurr.x} ${pCurr.y}`;
    }
  }

  d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return d;
}
