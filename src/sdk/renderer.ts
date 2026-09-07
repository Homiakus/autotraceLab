/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BlockNode, EdgeConnection, Point, RoutingOptions } from '../types';
import { getPortCoordinates } from '../algorithms/blockGeometry';
import { DiagramTheme, resolveTheme } from './themes';

export interface SvgRenderOptions {
  theme?: string | Partial<DiagramTheme>;
  title?: string;
  padding?: number;
  showGrid?: boolean;
  showTitle?: boolean;
  showArrowHeads?: boolean;
  cornerRadius?: number;
}

/**
 * Pure headless function to render routed diagram nodes and edges into a standalone SVG string.
 * Works seamlessly in Node.js, CLI, Web Workers, or Browser without React/DOM dependencies.
 */
export function renderDiagramSvg(
  nodes: BlockNode[],
  edges: EdgeConnection[],
  options: SvgRenderOptions = {}
): string {
  const theme = resolveTheme(options.theme);
  const padding = options.padding ?? 40;
  const showGrid = options.showGrid ?? (theme.gridPattern !== 'none');
  const showArrowHeads = options.showArrowHeads ?? true;
  const radius = options.cornerRadius ?? theme.nodeRadius;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  if (nodes.length === 0) {
    minX = 0;
    maxX = 400;
    minY = 0;
    maxY = 300;
  } else {
    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y < minY) minY = n.y;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }

    for (const e of edges) {
      if (e.path) {
        for (const p of e.path) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
      }
    }
  }

  const startX = Math.floor(minX - padding);
  const startY = Math.floor(minY - padding);
  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2);

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${startX} ${startY} ${width} ${height}" width="${width}" height="${height}" style="background-color: ${theme.background}; font-family: ${theme.fontFamily};">\n`;

  // Defs (patterns, markers)
  svg += `  <defs>\n`;
  if (theme.gridPattern === 'lines') {
    svg += `    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">\n`;
    svg += `      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${theme.gridColor}" stroke-width="0.75" />\n`;
    svg += `    </pattern>\n`;
  } else {
    svg += `    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">\n`;
    svg += `      <circle cx="2" cy="2" r="1" fill="${theme.gridColor}" />\n`;
    svg += `    </pattern>\n`;
  }

  if (showArrowHeads) {
    svg += `    <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n`;
    svg += `      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${theme.edgeColor}" />\n`;
    svg += `    </marker>\n`;
  }
  svg += `  </defs>\n\n`;

  // Background
  svg += `  <rect x="${startX}" y="${startY}" width="${width}" height="${height}" fill="${theme.background}" />\n`;
  if (showGrid) {
    svg += `  <rect x="${startX}" y="${startY}" width="${width}" height="${height}" fill="url(#grid)" />\n`;
  }

  // Title
  if (options.title && options.showTitle !== false) {
    svg += `  <text x="${startX + 20}" y="${startY + 28}" fill="${theme.labelText}" font-size="13" font-weight="700" letter-spacing="0.05em">${options.title}</text>\n`;
  }

  // Edges layer
  svg += `  <!-- Edges Layer -->\n  <g id="edges-layer">\n`;
  for (const e of edges) {
    if (!e.path || e.path.length < 2) continue;
    const color = e.color || theme.edgeColor;
    let pathD = `M ${e.path[0].x} ${e.path[0].y}`;

    if (radius > 0 && e.path.length > 2) {
      for (let i = 1; i < e.path.length - 1; i++) {
        const pPrev = e.path[i - 1];
        const pCurr = e.path[i];
        const pNext = e.path[i + 1];

        const d1 = { x: pCurr.x - pPrev.x, y: pCurr.y - pPrev.y };
        const d2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };

        const len1 = Math.hypot(d1.x, d1.y);
        const len2 = Math.hypot(d2.x, d2.y);
        const r = Math.min(radius, Math.min(len1, len2) / 2);

        if (r > 1) {
          const cut1 = { x: pCurr.x - (d1.x / len1) * r, y: pCurr.y - (d1.y / len1) * r };
          const cut2 = { x: pCurr.x + (d2.x / len2) * r, y: pCurr.y + (d2.y / len2) * r };
          pathD += ` L ${cut1.x} ${cut1.y} Q ${pCurr.x} ${pCurr.y} ${cut2.x} ${cut2.y}`;
        } else {
          pathD += ` L ${pCurr.x} ${pCurr.y}`;
        }
      }
      pathD += ` L ${e.path[e.path.length - 1].x} ${e.path[e.path.length - 1].y}`;
    } else {
      for (let i = 1; i < e.path.length; i++) {
        pathD += ` L ${e.path[i].x} ${e.path[i].y}`;
      }
    }

    const markerAttr = showArrowHeads ? ` marker-end="url(#arrowhead)"` : '';
    svg += `    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="${theme.edgeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"${markerAttr} />\n`;

    // Label on arrow
    if (e.label && e.path.length >= 2) {
      const midIdx = Math.floor(e.path.length / 2);
      const midPt = {
        x: (e.path[midIdx - 1].x + e.path[midIdx].x) / 2,
        y: (e.path[midIdx - 1].y + e.path[midIdx].y) / 2 - 8,
      };
      svg += `    <g transform="translate(${midPt.x}, ${midPt.y})">\n`;
      svg += `      <rect x="-${e.label.length * 3.5 + 6}" y="-10" width="${e.label.length * 7 + 12}" height="16" rx="4" fill="${theme.labelBg}" opacity="0.85" />\n`;
      svg += `      <text x="0" y="2" fill="${theme.labelText}" font-size="10" font-weight="600" text-anchor="middle">${e.label}</text>\n`;
      svg += `    </g>\n`;
    }
  }
  svg += `  </g>\n\n`;

  // Nodes layer
  svg += `  <!-- Nodes Layer -->\n  <g id="nodes-layer">\n`;
  for (const n of nodes) {
    const rx = theme.nodeRadius;
    const nodeFill = n.color || theme.nodeFill;
    const nodeStroke = theme.nodeStroke;
    const strokeWidth = theme.nodeStrokeWidth;

    svg += `    <g transform="translate(${n.x}, ${n.y})">\n`;

    // Render shape
    if (n.shape === 'circle') {
      const cx = n.width / 2;
      const cy = n.height / 2;
      const r = Math.min(cx, cy);
      svg += `      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="${strokeWidth}" />\n`;
    } else if (n.shape === 'diamond') {
      const p1 = `${n.width / 2},0`;
      const p2 = `${n.width},${n.height / 2}`;
      const p3 = `${n.width / 2},${n.height}`;
      const p4 = `0,${n.height / 2}`;
      svg += `      <polygon points="${p1} ${p2} ${p3} ${p4}" fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="${strokeWidth}" />\n`;
    } else if (n.shape === 'hexagon') {
      const w = n.width;
      const h = n.height;
      const points = `${w * 0.25},0 ${w * 0.75},0 ${w},${h * 0.5} ${w * 0.75},${h} ${w * 0.25},${h} 0,${h * 0.5}`;
      svg += `      <polygon points="${points}" fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="${strokeWidth}" />\n`;
    } else {
      // Rectangle / Rounded / Chip IC
      svg += `      <rect width="${n.width}" height="${n.height}" rx="${rx}" fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="${strokeWidth}" />\n`;
      // Header band
      svg += `      <rect width="${n.width}" height="24" rx="${rx}" fill="${nodeStroke}" opacity="0.25" />\n`;
    }

    // Title
    const titleY = n.height > 40 ? 16 : n.height / 2 + 4;
    svg += `      <text x="12" y="${titleY}" fill="${theme.nodeText}" font-size="11" font-weight="600">${n.title || n.id}</text>\n`;

    // Ports
    const allPorts = [...(n.inputs || []), ...(n.outputs || [])];
    for (const p of allPorts) {
      const coord = getPortCoordinates(n, p.id, p.type === 'output');
      const relX = coord.x - n.x;
      const relY = coord.y - n.y;
      const portColor = p.type === 'input' ? theme.portStroke : theme.portFill;

      svg += `      <circle cx="${relX}" cy="${relY}" r="${theme.portRadius}" fill="${portColor}" stroke="${theme.background}" stroke-width="1.5" />\n`;
    }

    svg += `    </g>\n`;
  }
  svg += `  </g>\n</svg>\n`;

  return svg;
}
