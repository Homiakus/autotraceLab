import {
  BlockNode,
  EdgeConnection,
  Point,
  BenchmarkMetrics,
  QualityVector,
  LayoutAlgorithmType,
  RoutingAlgorithmType,
  RoutingOptions,
} from '../types';
import { runSugiyamaLayout } from './sugiyamaLayout';
import { runForceDirectedLayout } from './forceLayout';
import { runOrthogonalGridLayout } from './orthogonalGridLayout';
import { routeOrthogonalAStar } from './orthogonalAStarRouter';
import { routeLeeWave } from './leeWaveRouter';
import { routeManhattanChannel } from './manhattanChannelRouter';
import { routeSmoothSplines } from './splineRouter';
import { runUnifiedCoOptimization } from './unifiedOptimizer';
import { computeOptimizedLabels } from './labelLayout';
import { getPortCoordinatesAccurate } from './blockGeometry';

/**
 * Checks if two line segments (p1, p2) and (p3, p4) intersect
 */
export function doSegmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  function ccw(a: Point, b: Point, c: Point): boolean {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  }
  // Exclude endpoints touching
  const isTouching =
    (Math.abs(p1.x - p3.x) < 1 && Math.abs(p1.y - p3.y) < 1) ||
    (Math.abs(p1.x - p4.x) < 1 && Math.abs(p1.y - p4.y) < 1) ||
    (Math.abs(p2.x - p3.x) < 1 && Math.abs(p2.y - p3.y) < 1) ||
    (Math.abs(p2.x - p4.x) < 1 && Math.abs(p2.y - p4.y) < 1);
  if (isTouching) return false;

  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

/**
 * Strictly detects illegal collinear wire overlaps (where two arrows coincide/share a line segment).
 * Arrows are ONLY permitted to cross perpendicularly at isolated points, never coincide collinear!
 * (rule/2.md §46, §90; rule/3.md §35)
 */
export function detectCollinearOverlaps(edges: EdgeConnection[]): { totalOverlapLength: number; overlapCount: number } {
  let totalOverlapLength = 0;
  let overlapCount = 0;

  const hSegs: { minX: number; maxX: number; y: number; edgeId: string }[] = [];
  const vSegs: { minY: number; maxY: number; x: number; edgeId: string }[] = [];

  for (let e = 0; e < edges.length; e++) {
    const pts = edges[e].path;
    if (!pts || pts.length < 2) continue;
    const edgeId = edges[e].id;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      if (Math.abs(p1.y - p2.y) < 1.5) {
        hSegs.push({
          minX: Math.min(p1.x, p2.x),
          maxX: Math.max(p1.x, p2.x),
          y: p1.y,
          edgeId,
        });
      } else if (Math.abs(p1.x - p2.x) < 1.5) {
        vSegs.push({
          minY: Math.min(p1.y, p2.y),
          maxY: Math.max(p1.y, p2.y),
          x: p1.x,
          edgeId,
        });
      }
    }
  }

  // Check horizontal collinear overlaps
  for (let i = 0; i < hSegs.length; i++) {
    const s1 = hSegs[i];
    for (let j = i + 1; j < hSegs.length; j++) {
      const s2 = hSegs[j];
      if (s1.edgeId === s2.edgeId) continue;
      if (Math.abs(s1.y - s2.y) < 1.5) {
        const overlapMin = Math.max(s1.minX, s2.minX);
        const overlapMax = Math.min(s1.maxX, s2.maxX);
        const overlapLen = overlapMax - overlapMin;
        if (overlapLen > 2) {
          totalOverlapLength += overlapLen;
          overlapCount++;
        }
      }
    }
  }

  // Check vertical collinear overlaps
  for (let i = 0; i < vSegs.length; i++) {
    const s1 = vSegs[i];
    for (let j = i + 1; j < vSegs.length; j++) {
      const s2 = vSegs[j];
      if (s1.edgeId === s2.edgeId) continue;
      if (Math.abs(s1.x - s2.x) < 1.5) {
        const overlapMin = Math.max(s1.minY, s2.minY);
        const overlapMax = Math.min(s1.maxY, s2.maxY);
        const overlapLen = overlapMax - overlapMin;
        if (overlapLen > 2) {
          totalOverlapLength += overlapLen;
          overlapCount++;
        }
      }
    }
  }

  return { totalOverlapLength: Math.round(totalOverlapLength), overlapCount };
}

/**
 * Calculates all benchmark metrics and QualityVector according to rule/2.md §88-§90 and rule/3.md §94-§97
 */
export function calculateBenchmarkMetrics(
  nodes: BlockNode[],
  edges: EdgeConnection[],
  execTimeMs: number,
  layoutName: string,
  routingName: string,
  options?: RoutingOptions
): BenchmarkMetrics {
  let totalWirelength = 0;
  let minTheoreticalWirelength = 0;
  let bendCount = 0;

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // 1. Calculate wirelength, bends and lower-bound Manhattan lengths
  for (let e = 0; e < edges.length; e++) {
    const edge = edges[e];
    const pts = edge.path || [];
    if (pts.length < 2) continue;

    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i + 1].x - pts[i].x;
      const dy = pts[i + 1].y - pts[i].y;
      totalWirelength += Math.hypot(dx, dy);
    }

    const sNode = nodeMap.get(edge.sourceBlockId);
    const tNode = nodeMap.get(edge.targetBlockId);
    if (sNode && tNode) {
      const sPos = getPortCoordinatesAccurate(sNode, edge.sourcePortId, true);
      const tPos = getPortCoordinatesAccurate(tNode, edge.targetPortId, false);
      minTheoreticalWirelength += Math.abs(sPos.x - tPos.x) + Math.abs(sPos.y - tPos.y);
    } else {
      minTheoreticalWirelength += Math.abs(pts[0].x - pts[pts.length - 1].x) + Math.abs(pts[0].y - pts[pts.length - 1].y);
    }

    for (let i = 1; i < pts.length - 1; i++) {
      const v1x = pts[i].x - pts[i - 1].x;
      const v1y = pts[i].y - pts[i - 1].y;
      const v2x = pts[i + 1].x - pts[i].x;
      const v2y = pts[i + 1].y - pts[i].y;

      const dot = v1x * v2x + v1y * v2y;
      const len1 = Math.hypot(v1x, v1y);
      const len2 = Math.hypot(v2x, v2y);

      if (len1 > 0 && len2 > 0) {
        const cosAngle = dot / (len1 * len2);
        if (Math.abs(cosAngle) < 0.95) {
          bendCount++;
        }
      }
    }
  }

  // 2. Calculate edge crossings with broadphase AABB bounding checks
  let crossingsCount = 0;
  interface SegmentEntry {
    p1: Point;
    p2: Point;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    edgeId: string;
  }
  const allSegments: SegmentEntry[] = [];

  for (let e = 0; e < edges.length; e++) {
    const pts = edges[e].path || [];
    const edgeId = edges[e].id;
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      allSegments.push({
        p1,
        p2,
        minX: Math.min(p1.x, p2.x),
        maxX: Math.max(p1.x, p2.x),
        minY: Math.min(p1.y, p2.y),
        maxY: Math.max(p1.y, p2.y),
        edgeId,
      });
    }
  }

  for (let i = 0; i < allSegments.length; i++) {
    const s1 = allSegments[i];
    for (let j = i + 1; j < allSegments.length; j++) {
      const s2 = allSegments[j];
      if (s1.edgeId === s2.edgeId) continue;
      // Quick AABB rejection
      if (s1.maxX < s2.minX || s2.maxX < s1.minX || s1.maxY < s2.minY || s2.maxY < s1.minY) {
        continue;
      }
      if (doSegmentsIntersect(s1.p1, s1.p2, s2.p1, s2.p2)) {
        crossingsCount++;
      }
    }
  }

  // 3. Calculate block overlaps (node-node and edge-through-node)
  let blockOverlapCount = 0;
  let wireBlockCollisionCount = 0;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const u = nodes[i];
      const v = nodes[j];
      const overlap = !(
        u.x + u.width < v.x ||
        v.x + v.width < u.x ||
        u.y + u.height < v.y ||
        v.y + v.height < u.y
      );
      if (overlap) blockOverlapCount++;
    }
  }

  // Check if edge segments puncture non-endpoint blocks
  for (let e = 0; e < edges.length; e++) {
    const edge = edges[e];
    const sourceNode = nodeMap.get(edge.sourceBlockId);
    const targetNode = nodeMap.get(edge.targetBlockId);
    const pts = edge.path || [];

    for (let i = 0; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;

      for (let n = 0; n < nodes.length; n++) {
        const node = nodes[n];
        if (node.id === sourceNode?.id || node.id === targetNode?.id) continue;
        if (midX > node.x + 2 && midX < node.x + node.width - 2 && midY > node.y + 2 && midY < node.y + node.height - 2) {
          wireBlockCollisionCount++;
        }
      }
    }
  }

  const overlapCount = blockOverlapCount + wireBlockCollisionCount;

  // 4. Port Alignment & Straight Wire Score
  let cleanPortExits = 0;
  let straightWiresCount = 0;
  let portMisalignmentSum = 0;

  edges.forEach(e => {
    const pts = e.path || [];
    if (pts.length === 2) {
      straightWiresCount++;
    }
    if (pts.length >= 2) {
      const startDx = pts[1].x - pts[0].x;
      const startDy = pts[1].y - pts[0].y;
      const endDx = pts[pts.length - 1].x - pts[pts.length - 2].x;
      const endDy = pts[pts.length - 1].y - pts[pts.length - 2].y;

      // Valid port normals
      if (
        (Math.abs(startDx) > 0 && Math.abs(startDy) < 1) ||
        (Math.abs(startDy) > 0 && Math.abs(startDx) < 1)
      ) {
        cleanPortExits++;
      }

      // Check alignment of facing ports
      const sNode = nodeMap.get(e.sourceBlockId);
      const tNode = nodeMap.get(e.targetBlockId);
      if (sNode && tNode) {
        const sPos = getPortCoordinatesAccurate(sNode, e.sourcePortId, true);
        const tPos = getPortCoordinatesAccurate(tNode, e.targetPortId, false);
        if (sPos.side === 'right' && tPos.side === 'left') {
          portMisalignmentSum += Math.abs(sPos.y - tPos.y);
        } else if (sPos.side === 'bottom' && tPos.side === 'top') {
          portMisalignmentSum += Math.abs(sPos.x - tPos.x);
        }
      }
    }
  });

  const portAlignmentScore = edges.length > 0 ? Math.round((cleanPortExits / edges.length) * 100) : 100;
  const straightRatio = edges.length > 0 ? straightWiresCount / edges.length : 1;

  // 5. Collinear Overlap Detection & Strict On-Arrow Label Measurement
  const { totalOverlapLength, overlapCount: collinearOverlapCount } = detectCollinearOverlaps(edges);
  const labelMap = computeOptimizedLabels(nodes, edges, new Map(), options?.labelClearance || 8);
  let totalLabels = 0;
  let labelsOnArrow = 0;
  let labelCollisions = 0;

  edges.forEach(e => {
    if (e.label) {
      totalLabels++;
      const pos = labelMap.get(e.id);
      if (pos) {
        if (pos.isOnArrow) {
          labelsOnArrow++;
        }
        if (!pos.isCollisionFree) {
          labelCollisions++;
        }
      }
    }
  });
  const labelsOnArrowPercentage = totalLabels > 0 ? Math.round((labelsOnArrow / totalLabels) * 100) : 100;

  // 6. Compactness & Area Metrics (rule/3.md §17-§22, §54)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let totalBlockArea = 0;

  nodes.forEach(n => {
    if (n.x < minX) minX = n.x;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y < minY) minY = n.y;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
    totalBlockArea += n.width * n.height;
  });

  if (minX === Infinity) {
    minX = 0; maxX = 500; minY = 0; maxY = 300; totalBlockArea = 100000;
  }

  const diagramWidth = Math.max(10, maxX - minX);
  const diagramHeight = Math.max(10, maxY - minY);
  const diagramArea = diagramWidth * diagramHeight;
  const areaRatio = totalBlockArea > 0 ? diagramArea / totalBlockArea : 1.0;
  const actualDensity = diagramArea > 0 ? totalBlockArea / diagramArea : 0.5;

  const graphDensity = nodes.length > 0 ? edges.length / nodes.length : 1.0;
  const targetDensity = Math.max(0.3, Math.min(0.65, 0.65 - 0.06 * graphDensity));
  const densityDeviation = Math.abs(actualDensity - targetDensity);
  const voidRatio = Math.max(0, (diagramArea - totalBlockArea) / diagramArea);

  const targetAspect = 1.8;
  const actualAspect = diagramWidth / diagramHeight;
  const aspectPenalty = Math.abs(Math.log(actualAspect / targetAspect));

  const normalizedWirelength = minTheoreticalWirelength > 0
    ? Math.max(0, (totalWirelength / minTheoreticalWirelength) - 1)
    : 0;

  // 7. Hard Violations (must be strictly 0) (rule/2.md §90; rule/3.md §50)
  const hardViolations = blockOverlapCount + wireBlockCollisionCount + collinearOverlapCount + labelCollisions;

  // 8. Quality Vector
  const qualityVector: QualityVector = {
    hardViolations,
    crossings: crossingsCount,
    collinearOverlapCount,
    collinearOverlapLength: totalOverlapLength,
    congestionOverflow: 0,
    bends: bendCount,
    straightWiresCount,
    straightEdgeRatio: straightRatio,
    portMisalignmentScore: Math.round(portMisalignmentSum),
    portAlignmentScore,
    areaRatio: Math.round(areaRatio * 100) / 100,
    densityDeviation: Math.round(densityDeviation * 100) / 100,
    voidRatio: Math.round(voidRatio * 100) / 100,
    aspectPenalty: Math.round(aspectPenalty * 100) / 100,
    normalizedWirelength: Math.round(normalizedWirelength * 100) / 100,
    labelCollisions,
    labelsOnArrowPercentage,
    compositeScore: 0,
  };

  // 9. Composite Weighted Pareto Optimality Score (rule/3.md §52, §53, §60)
  const weights = options?.weights || {
    crossingWeight: 95,
    straightnessWeight: 90,
    g1SplineWeight: 65,
    portAlignmentWeight: 80,
    clearanceWeight: 90,
    wirelengthWeight: 15,
    bendWeight: 25,
    labelOverlapWeight: 75,
  };

  const offArrowPenalty = (totalLabels - labelsOnArrow) * 40;
  const collinearPenalty = totalOverlapLength * 2 + collinearOverlapCount * 25;
  const hardViolationPenalty = hardViolations * 100;

  const penalties =
    (weights.crossingWeight / 100) * (crossingsCount * 20) +
    (weights.clearanceWeight / 100) * (overlapCount * 30) +
    (weights.straightnessWeight / 100) * ((1 - straightRatio) * 20) +
    (weights.bendWeight / 100) * (bendCount * 1.5) +
    (weights.wirelengthWeight / 100) * (normalizedWirelength * 15) +
    offArrowPenalty +
    collinearPenalty +
    hardViolationPenalty;

  const compositeOptimalityScore = Math.max(5, Math.min(100, Math.round(100 - penalties)));
  qualityVector.compositeScore = compositeOptimalityScore;

  return {
    algorithmName: layoutName,
    routingName,
    executionTimeMs: Math.round(execTimeMs * 100) / 100,
    totalWirelength: Math.round(totalWirelength),
    bendCount,
    crossingsCount,
    overlapCount,
    collinearOverlapLength: totalOverlapLength,
    collinearOverlapCount,
    labelsOnArrowPercentage,
    portAlignmentScore,
    straightWiresCount,
    eliminatedArtifactsCount: Math.max(0, edges.length * 2 - bendCount),
    compositeOptimalityScore,
    qualityVector,
  };
}

/**
 * Runs full benchmark suite across all layout & routing combinations for comparative research
 */
export function runComparativeSuite(
  initialNodes: BlockNode[],
  initialEdges: EdgeConnection[],
  options: RoutingOptions
): BenchmarkMetrics[] {
  const layouts: { type: LayoutAlgorithmType; name: string }[] = [
    { type: 'sugiyama', name: 'Sugiyama (Послойный)' },
    { type: 'orthogonal_grid', name: 'Orthogonal Grid (Матричный)' },
    { type: 'force_directed', name: 'Force-Directed (Силовой)' },
  ];

  const routers: { type: RoutingAlgorithmType; name: string }[] = [
    { type: 'orthogonal_astar', name: 'Orthogonal A*' },
    { type: 'lee_wave', name: 'Lee Maze Wave' },
    { type: 'manhattan_channel', name: 'Manhattan Channel' },
    { type: 'smooth_spline', name: 'Smooth Spline' },
  ];

  const results: BenchmarkMetrics[] = [];

  layouts.forEach(layout => {
    let positionedNodes = initialNodes;
    const tStartLayout = performance.now();

    if (layout.type === 'sugiyama') {
      positionedNodes = runSugiyamaLayout(initialNodes, initialEdges).nodes;
    } else if (layout.type === 'orthogonal_grid') {
      positionedNodes = runOrthogonalGridLayout(initialNodes, initialEdges).nodes;
    } else if (layout.type === 'force_directed') {
      positionedNodes = runForceDirectedLayout(initialNodes, initialEdges, 60).nodes;
    }
    const layoutDuration = performance.now() - tStartLayout;

    routers.forEach(router => {
      const tStartRoute = performance.now();
      let routedEdges: EdgeConnection[] = [];

      if (router.type === 'orthogonal_astar') {
        routedEdges = routeOrthogonalAStar(positionedNodes, initialEdges, options);
      } else if (router.type === 'lee_wave') {
        routedEdges = routeLeeWave(positionedNodes, initialEdges, options).edges;
      } else if (router.type === 'manhattan_channel') {
        routedEdges = routeManhattanChannel(positionedNodes, initialEdges, options);
      } else if (router.type === 'smooth_spline') {
        routedEdges = routeSmoothSplines(positionedNodes, initialEdges, options);
      }
      const routeDuration = performance.now() - tStartRoute;

      const metric = calculateBenchmarkMetrics(
        positionedNodes,
        routedEdges,
        layoutDuration + routeDuration,
        layout.name,
        router.name,
        options
      );
      results.push(metric);
    });
  });

  // Also include Unified Joint Co-Optimization
  const tStartCoOpt = performance.now();
  const coOptResult = runUnifiedCoOptimization(initialNodes, initialEdges, options);
  const coOptDuration = performance.now() - tStartCoOpt;
  const coOptMetric = calculateBenchmarkMetrics(
    coOptResult.nodes,
    coOptResult.edges,
    coOptDuration,
    'Joint Co-Optimization',
    'Artifact-Free Orthogonal',
    options
  );
  coOptMetric.straightWiresCount = coOptResult.straightWiresCount;
  coOptMetric.eliminatedArtifactsCount = coOptResult.eliminatedArtifactsCount;
  coOptMetric.portAlignmentScore = coOptResult.alignmentScore;
  results.push(coOptMetric);

  return results;
}
