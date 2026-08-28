export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ScreenRectLike {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface InferredCanvasEdge {
  edgeId: string;
  sourceBlockId: string;
  targetBlockId: string;
  sourceDistance: number;
  targetDistance: number;
}

export interface CanvasTopologyInference {
  edges: InferredCanvasEdge[];
  dependenciesByTarget: Record<string, string[]>;
  warnings: string[];
}

export function distancePointToRect(point: ScreenPoint, rect: ScreenRectLike): number {
  const dx = point.x < rect.left ? rect.left - point.x : point.x > rect.right ? point.x - rect.right : 0;
  const dy = point.y < rect.top ? rect.top - point.y : point.y > rect.bottom ? point.y - rect.bottom : 0;
  return Math.hypot(dx, dy);
}

export function nearestBlockToPoint(
  point: ScreenPoint,
  blocks: ScreenRectLike[],
  thresholdPx = 48,
): { id: string; distance: number } | null {
  let best: { id: string; distance: number } | null = null;
  for (const block of blocks) {
    const distance = distancePointToRect(point, block);
    if (!best || distance < best.distance) best = { id: block.id, distance };
  }
  if (!best || best.distance > thresholdPx) return null;
  return best;
}

function pointOnSvgPathInScreen(path: SVGPathElement, atEnd: boolean): ScreenPoint | null {
  try {
    const length = path.getTotalLength();
    const local = path.getPointAtLength(atEnd ? length : 0);
    const ctm = path.getScreenCTM();
    if (!ctm) return null;
    return {
      x: local.x * ctm.a + local.y * ctm.c + ctm.e,
      y: local.x * ctm.b + local.y * ctm.d + ctm.f,
    };
  } catch {
    return null;
  }
}

function primaryPath(group: SVGGElement): SVGPathElement | null {
  const paths = Array.from(group.querySelectorAll<SVGPathElement>('path'));
  if (paths.length === 0) return null;
  return paths.find(path => path.getAttribute('stroke') !== 'transparent' && path.getAttribute('d'))
    || paths.find(path => path.getAttribute('d'))
    || null;
}

/**
 * Reads the currently rendered AutoTrace SVG. Edge paths are directional: the start point is treated as source,
 * the end point as target. Endpoints are associated with the nearest rendered block rectangle.
 *
 * This is intentionally an adapter around the existing DOM contract (`block-node-*`, `edge-group-*`) so the
 * mathematical layer can use the real canvas topology without coupling to the routing algorithms or App state.
 */
export function inferCanvasTopology(thresholdPx = 48): CanvasTopologyInference {
  const warnings: string[] = [];
  const blocks: ScreenRectLike[] = Array.from(document.querySelectorAll<SVGGElement>('[id^="block-node-"]'))
    .map(group => {
      const rect = group.getBoundingClientRect();
      return {
        id: group.id.replace(/^block-node-/, ''),
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      };
    });

  const inferred: InferredCanvasEdge[] = [];
  const edgeGroups = Array.from(document.querySelectorAll<SVGGElement>('[id^="edge-group-"]'));

  for (const group of edgeGroups) {
    const edgeId = group.id.replace(/^edge-group-/, '');
    const path = primaryPath(group);
    if (!path) {
      warnings.push(`Связь ${edgeId}: SVG path не найден`);
      continue;
    }
    const start = pointOnSvgPathInScreen(path, false);
    const end = pointOnSvgPathInScreen(path, true);
    if (!start || !end) {
      warnings.push(`Связь ${edgeId}: не удалось преобразовать координаты path`);
      continue;
    }

    const source = nearestBlockToPoint(start, blocks, thresholdPx);
    const target = nearestBlockToPoint(end, blocks, thresholdPx);
    if (!source || !target) {
      warnings.push(`Связь ${edgeId}: endpoint не сопоставлен блоку в пределах ${thresholdPx}px`);
      continue;
    }
    if (source.id === target.id) {
      warnings.push(`Связь ${edgeId}: оба endpoint сопоставлены одному блоку ${source.id}`);
      continue;
    }

    inferred.push({
      edgeId,
      sourceBlockId: source.id,
      targetBlockId: target.id,
      sourceDistance: source.distance,
      targetDistance: target.distance,
    });
  }

  const dependenciesByTarget: Record<string, string[]> = {};
  for (const edge of inferred) {
    dependenciesByTarget[edge.targetBlockId] ||= [];
    if (!dependenciesByTarget[edge.targetBlockId].includes(edge.sourceBlockId)) {
      dependenciesByTarget[edge.targetBlockId].push(edge.sourceBlockId);
    }
  }

  return { edges: inferred, dependenciesByTarget, warnings };
}
