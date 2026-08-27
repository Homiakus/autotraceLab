import {
  BlockNode,
  Port,
  PortCoordinates,
  PortSide,
  DerivedBlockGeometry,
  Point,
  BlockShape,
} from '../types';

export const BASE_GRID = 4;
export const PLACEMENT_GRID = 10;
export const ROUTING_GRID = 10;

export const DEFAULT_CORNER_MARGIN = 14;
export const DEFAULT_PORT_PITCH = 20;
export const MIN_BLOCK_WIDTH = 120;
export const MIN_BLOCK_HEIGHT = 72;
export const HEADER_HEIGHT = 24;
export const BODY_PADDING = 12;

/**
 * Calculates the strictly required minimum dimensions for a block based on:
 * 1. Port counts per side (with safe corner margins and port pitch)
 * 2. Title, subtitle, and text content length
 * 3. Minimum base dimensions
 * (rule/2.md §7, §8, §9, §102)
 */
export function calculateMinimumBlockSize(
  node: Pick<BlockNode, 'title' | 'subtitle' | 'inputs' | 'outputs' | 'shape'>,
  cornerMargin = DEFAULT_CORNER_MARGIN,
  portPitch = DEFAULT_PORT_PITCH
): { minWidth: number; minHeight: number; wPorts: number; hPorts: number } {
  const allPorts: Port[] = [...(node.inputs || []), ...(node.outputs || []), ...((node as any).ports || [])];

  let nLeft = 0;
  let nRight = 0;
  let nTop = 0;
  let nBottom = 0;

  for (let i = 0; i < allPorts.length; i++) {
    const p = allPorts[i];
    const side = p.side || (p.type === 'output' ? 'right' : 'left');
    switch (side) {
      case 'left':
        nLeft++;
        break;
      case 'right':
        nRight++;
        break;
      case 'top':
        nTop++;
        break;
      case 'bottom':
        nBottom++;
        break;
    }
  }

  const nVertical = Math.max(nLeft, nRight);
  const nHorizontal = Math.max(nTop, nBottom);

  const hPorts = 2 * cornerMargin + Math.max(0, nVertical - 1) * portPitch;
  const wPorts = 2 * cornerMargin + Math.max(0, nHorizontal - 1) * portPitch;

  // Text content width estimation
  const titleCharWidth = 7.5;
  const titleLen = (node.title || '').length;
  const wTitle = titleLen * titleCharWidth + 48; // Title + icon + controls

  const subtitleLen = (node.subtitle || '').length;
  const wSubtitle = subtitleLen * 6.5 + 24;

  const wContent = Math.max(wTitle, wSubtitle, MIN_BLOCK_WIDTH);
  const hContent = HEADER_HEIGHT + BODY_PADDING * 2 + 24;

  const snap = (v: number) => Math.ceil(v / PLACEMENT_GRID) * PLACEMENT_GRID;

  const minWidth = snap(Math.max(MIN_BLOCK_WIDTH, wPorts, wContent));
  const minHeight = snap(Math.max(MIN_BLOCK_HEIGHT, hPorts, hContent));

  return { minWidth, minHeight, wPorts, hPorts };
}

/**
 * Normalizes and automatically sizes a block according to rule/2.md §8, §74
 */
export function applyBlockAutoSizing(node: BlockNode): BlockNode {
  const { minWidth, minHeight } = calculateMinimumBlockSize(node);
  const isAuto = node.autoSize ?? true;

  const width = isAuto ? Math.max(minWidth, node.width || minWidth) : Math.max(minWidth, node.width || minWidth);
  const height = isAuto ? Math.max(minHeight, node.height || minHeight) : Math.max(minHeight, node.height || minHeight);

  return {
    ...node,
    autoSize: isAuto,
    minWidth,
    minHeight,
    width,
    height,
  };
}

/**
 * Deterministically sorts ports according to rule/2.md §20, §21
 * Priority: Group -> Explicit Order -> Pin Number -> ID
 */
export function sortPortsDeterministically(ports: Port[]): Port[] {
  return [...ports].sort((a, b) => {
    // 1. Group ID
    if (a.groupId && !b.groupId) return -1;
    if (!a.groupId && b.groupId) return 1;
    if (a.groupId && b.groupId && a.groupId !== b.groupId) {
      return a.groupId.localeCompare(b.groupId);
    }

    // 2. Explicit Order index
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;

    // 3. Pin Number
    if (a.pinNumber !== undefined && b.pinNumber !== undefined) {
      return a.pinNumber - b.pinNumber;
    }
    if (a.pinNumber !== undefined) return -1;
    if (b.pinNumber !== undefined) return 1;

    // 4. Stable ID
    return a.id.localeCompare(b.id);
  });
}

/**
 * Calculates port position on a side using Fixed anchor reservation or Adaptive even distribution
 * (rule/2.md §17-§19, §102)
 */
/**
 * Calculates port position on a side using Fixed anchor reservation or Adaptive even distribution
 * with exact perimeter mapping for all 6 shapes (rectangle, rounded, chip_ic, circle, diamond, hexagon)
 * (rule/2.md §17-§19, §74, §102)
 */
export function getPortCoordinatesAccurate(
  node: BlockNode,
  portId: string,
  isOutputHint = true
): PortCoordinates {
  const allPorts: Port[] = [...(node.inputs || []), ...(node.outputs || []), ...((node as any).ports || [])];
  let foundPort = allPorts.find((p) => p.id === portId);

  if (!foundPort) {
    const isDirectSide = portId === 'left' || portId === 'right' || portId === 'top' || portId === 'bottom';
    const fallbackSide: PortSide = isDirectSide ? (portId as PortSide) : isOutputHint ? 'right' : 'left';
    foundPort = {
      id: portId,
      name: portId,
      type: isOutputHint ? 'output' : 'input',
      side: fallbackSide,
      placementMode: 'adaptive',
    };
  }

  const side: PortSide = foundPort.side || (foundPort.type === 'output' ? 'right' : 'left');
  const isFixed = foundPort.placementMode === 'fixed';

  // Group and sort ports on this specific face
  const sameSidePorts = sortPortsDeterministically(
    allPorts.filter((p) => (p.side || (p.type === 'output' ? 'right' : 'left')) === side)
  );

  const portIndex = sameSidePorts.findIndex((p) => p.id === foundPort!.id);
  const count = sameSidePorts.length;

  const cornerMargin = DEFAULT_CORNER_MARGIN;
  const isHorizontal = side === 'top' || side === 'bottom';
  const sideLength = isHorizontal ? node.width : node.height;

  let posOnSide: number;

  if (isFixed && foundPort.relativePosition !== undefined && foundPort.relativePosition >= 0 && foundPort.relativePosition <= 1) {
    // Fixed relative position
    const rawPos = sideLength * foundPort.relativePosition;
    posOnSide = Math.max(cornerMargin, Math.min(sideLength - cornerMargin, rawPos));
    if (foundPort.customOffset !== undefined) {
      posOnSide = Math.max(cornerMargin, Math.min(sideLength - cornerMargin, foundPort.customOffset));
    }
  } else {
    // Adaptive distribution: t_i = (i + 1) / (N + 1)
    const effectiveCount = Math.max(1, count);
    const effectiveIdx = portIndex >= 0 ? portIndex : 0;
    const t = (effectiveIdx + 1) / (effectiveCount + 1);
    const rawPos = sideLength * t;
    posOnSide = Math.max(cornerMargin, Math.min(sideLength - cornerMargin, Math.round(rawPos)));
  }

  const shape: BlockShape = node.shape || 'rounded';
  let x = node.x;
  let y = node.y;
  let normal = { dx: 1, dy: 0 };

  if (shape === 'diamond') {
    const halfW = node.width / 2;
    const halfH = node.height / 2;

    switch (side) {
      case 'left': {
        const distFromCenterY = Math.abs(posOnSide - halfH) / halfH;
        x = node.x + distFromCenterY * halfW;
        y = node.y + posOnSide;
        normal = { dx: -1, dy: 0 };
        break;
      }
      case 'right': {
        const distFromCenterY = Math.abs(posOnSide - halfH) / halfH;
        x = node.x + node.width - distFromCenterY * halfW;
        y = node.y + posOnSide;
        normal = { dx: 1, dy: 0 };
        break;
      }
      case 'top': {
        const distFromCenterX = Math.abs(posOnSide - halfW) / halfW;
        x = node.x + posOnSide;
        y = node.y + distFromCenterX * halfH;
        normal = { dx: 0, dy: -1 };
        break;
      }
      case 'bottom': {
        const distFromCenterX = Math.abs(posOnSide - halfW) / halfW;
        x = node.x + posOnSide;
        y = node.y + node.height - distFromCenterX * halfH;
        normal = { dx: 0, dy: 1 };
        break;
      }
    }
  } else if (shape === 'hexagon') {
    const halfH = node.height / 2;
    const chamferW = node.width * 0.16;

    switch (side) {
      case 'left': {
        const distFromCenterY = Math.abs(posOnSide - halfH) / halfH;
        x = node.x + distFromCenterY * chamferW;
        y = node.y + posOnSide;
        normal = { dx: -1, dy: 0 };
        break;
      }
      case 'right': {
        const distFromCenterY = Math.abs(posOnSide - halfH) / halfH;
        x = node.x + node.width - distFromCenterY * chamferW;
        y = node.y + posOnSide;
        normal = { dx: 1, dy: 0 };
        break;
      }
      case 'top': {
        const clampedPos = Math.max(chamferW, Math.min(node.width - chamferW, posOnSide));
        x = node.x + clampedPos;
        y = node.y;
        normal = { dx: 0, dy: -1 };
        break;
      }
      case 'bottom': {
        const clampedPos = Math.max(chamferW, Math.min(node.width - chamferW, posOnSide));
        x = node.x + clampedPos;
        y = node.y + node.height;
        normal = { dx: 0, dy: 1 };
        break;
      }
    }
  } else if (shape === 'circle') {
    const radius = Math.min(node.width, node.height) / 2;
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const frac = posOnSide / sideLength;
    const angleSpan = Math.PI / 2.0; // 90 degree quadrant per side face

    switch (side) {
      case 'left': {
        const theta = Math.PI + (frac - 0.5) * angleSpan;
        x = cx + radius * Math.cos(theta);
        y = cy + radius * Math.sin(theta);
        normal = { dx: -1, dy: 0 };
        break;
      }
      case 'right': {
        const theta = 0 + (frac - 0.5) * angleSpan;
        x = cx + radius * Math.cos(theta);
        y = cy + radius * Math.sin(theta);
        normal = { dx: 1, dy: 0 };
        break;
      }
      case 'top': {
        const theta = -Math.PI / 2 + (frac - 0.5) * angleSpan;
        x = cx + radius * Math.cos(theta);
        y = cy + radius * Math.sin(theta);
        normal = { dx: 0, dy: -1 };
        break;
      }
      case 'bottom': {
        const theta = Math.PI / 2 + (frac - 0.5) * angleSpan;
        x = cx + radius * Math.cos(theta);
        y = cy + radius * Math.sin(theta);
        normal = { dx: 0, dy: 1 };
        break;
      }
    }
  } else {
    // Standard Rectangle, Bento Rounded, Chip IC
    switch (side) {
      case 'left':
        x = node.x;
        y = node.y + posOnSide;
        normal = { dx: -1, dy: 0 };
        break;
      case 'right':
        x = node.x + node.width;
        y = node.y + posOnSide;
        normal = { dx: 1, dy: 0 };
        break;
      case 'top':
        x = node.x + posOnSide;
        y = node.y;
        normal = { dx: 0, dy: -1 };
        break;
      case 'bottom':
        x = node.x + posOnSide;
        y = node.y + node.height;
        normal = { dx: 0, dy: 1 };
        break;
    }
  }

  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    normal,
    side,
    port: foundPort,
  };
}

/** Canonical Single Source of Truth export */
export const getPortCoordinates = getPortCoordinatesAccurate;

/**
 * Builds the full DerivedBlockGeometry for a block
 * (rule/2.md §79, §102)
 */
export function buildDerivedBlockGeometry(
  node: BlockNode,
  clearance = 15
): DerivedBlockGeometry {
  const { minWidth, minHeight } = calculateMinimumBlockSize(node);
  const width = Math.max(minWidth, node.width || minWidth);
  const height = Math.max(minHeight, node.height || minHeight);

  const allPorts: Port[] = [...(node.inputs || []), ...(node.outputs || [])];
  const portAnchors: PortCoordinates[] = allPorts.map((p) =>
    getPortCoordinatesAccurate({ ...node, width, height }, p.id, p.type === 'output')
  );

  const violations: string[] = [];

  // Check port spacing violations
  for (let i = 0; i < portAnchors.length; i++) {
    for (let j = i + 1; j < portAnchors.length; j++) {
      if (portAnchors[i].side === portAnchors[j].side) {
        const dist = Math.hypot(
          portAnchors[i].x - portAnchors[j].x,
          portAnchors[i].y - portAnchors[j].y
        );
        if (dist < 12) {
          violations.push(
            `Порты ${portAnchors[i].port.name} и ${portAnchors[j].port.name} слишком близко (${Math.round(dist)}px < 12px)`
          );
        }
      }
    }
  }

  const effectiveClearance = node.routingClearance ?? clearance;

  return {
    blockId: node.id,
    visualBounds: { x: node.x, y: node.y, width, height },
    routingBounds: {
      minX: node.x,
      maxX: node.x + width,
      minY: node.y,
      maxY: node.y + height,
    },
    obstacleBounds: {
      minX: node.x - effectiveClearance,
      maxX: node.x + width + effectiveClearance,
      minY: node.y - effectiveClearance,
      maxY: node.y + height + effectiveClearance,
    },
    headerBounds: { x: node.x, y: node.y, width, height: HEADER_HEIGHT },
    contentBounds: {
      x: node.x + BODY_PADDING,
      y: node.y + HEADER_HEIGHT + BODY_PADDING,
      width: width - BODY_PADDING * 2,
      height: height - HEADER_HEIGHT - BODY_PADDING * 2,
    },
    portAnchors,
    minWidth,
    minHeight,
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Deterministic search for a free slot to place a new block without Math.random()
 * (rule/2.md §2.5, §75, §81)
 */
export function findDeterministicFreeSlot(
  existingNodes: BlockNode[],
  width = 180,
  height = 110,
  grid = 20,
  margin = 40
): Point {
  if (!existingNodes || existingNodes.length === 0) {
    return { x: 80, y: 80 };
  }

  const snap = (v: number) => Math.round(v / grid) * grid;

  // Check if candidate (cx, cy) collides with any existing block
  const isFree = (cx: number, cy: number) => {
    const rLeft = cx - margin;
    const rRight = cx + width + margin;
    const rTop = cy - margin;
    const rBottom = cy + height + margin;

    for (let i = 0; i < existingNodes.length; i++) {
      const n = existingNodes[i];
      const nLeft = n.x;
      const nRight = n.x + n.width;
      const nTop = n.y;
      const nBottom = n.y + n.height;

      const collides = !(
        rRight < nLeft ||
        rLeft > nRight ||
        rBottom < nTop ||
        rTop > nBottom
      );
      if (collides) return false;
    }
    return true;
  };

  // 1. First search in layer column to the right of the rightmost node
  let maxX = 80;
  let avgY = 80;
  existingNodes.forEach((n) => {
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    avgY += n.y;
  });
  avgY = snap(avgY / existingNodes.length);

  const candidateX = snap(maxX + 80);
  if (isFree(candidateX, avgY)) {
    return { x: candidateX, y: avgY };
  }

  // 2. Deterministic 2D spiral search
  const startX = snap(candidateX);
  const startY = snap(avgY);
  const maxRadius = 3000;
  const step = 40;

  for (let r = step; r < maxRadius; r += step) {
    const candidates: Point[] = [
      { x: startX + r, y: startY },
      { x: startX, y: startY + r },
      { x: startX - r, y: startY },
      { x: startX, y: startY - r },
      { x: startX + r, y: startY + r },
      { x: startX - r, y: startY + r },
      { x: startX + r, y: startY - r },
      { x: startX - r, y: startY - r },
    ];

    for (let i = 0; i < candidates.length; i++) {
      const pt = candidates[i];
      if (pt.x >= 40 && pt.y >= 40 && isFree(pt.x, pt.y)) {
        return pt;
      }
    }
  }

  return { x: snap(maxX + 80), y: snap(avgY) };
}
