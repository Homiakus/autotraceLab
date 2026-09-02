import { BlockNode, EdgeConnection, Port } from '../types';
import { getAllNodePorts } from '../algorithms/blockGeometry';
import { DSLSerializeOptions } from './types';

/**
 * Formats a block and its ports into AutoTrace Compact DSL text
 */
function serializeBlock(node: BlockNode, options: DSLSerializeOptions = {}): string {
  const indent = options.indent || '  ';
  const attrParts: string[] = [];

  if (node.title && node.title !== node.id) {
    attrParts.push(`title="${node.title}"`);
  }
  if (node.shape && node.shape !== 'rectangle') {
    attrParts.push(`shape=${node.shape}`);
  }
  if (node.category && node.category !== 'processor') {
    attrParts.push(`category=${node.category}`);
  }
  if (node.semanticType) {
    attrParts.push(`type="${node.semanticType}"`);
  }
  if (options.includePositions !== false && (node.x !== 0 || node.y !== 0)) {
    attrParts.push(`x=${Math.round(node.x)}`);
    attrParts.push(`y=${Math.round(node.y)}`);
  }
  if (options.includeDimensions !== false && (node.width !== 160 || node.height !== 90)) {
    attrParts.push(`w=${Math.round(node.width)}`);
    attrParts.push(`h=${Math.round(node.height)}`);
  }
  if (node.routingClearance !== undefined) {
    attrParts.push(`clearance=${node.routingClearance}`);
  }
  if (node.isPinned) {
    attrParts.push('pinned=true');
  }
  if (node.color) {
    attrParts.push(`color="${node.color}"`);
  }

  const attrStr = attrParts.length > 0 ? ` [${attrParts.join(', ')}]` : '';
  const lines: string[] = [`block ${node.id}${attrStr} {`];

  const ports = getAllNodePorts(node);
  for (const port of ports) {
    const typeShort = port.type === 'input' ? 'in' : port.type === 'output' ? 'out' : port.type;
    const sidePart = port.side ? `[${port.side}]` : '';
    const typePart = port.dataType ? `: ${port.dataType}` : '';

    const portAttrs: string[] = [];
    if (port.name && port.name !== port.id) {
      portAttrs.push(`name="${port.name}"`);
    }
    if (port.relativePosition !== undefined) {
      portAttrs.push(`pos=${+port.relativePosition.toFixed(2)}`);
    }
    if (port.pinNumber !== undefined) {
      portAttrs.push(`pin=${port.pinNumber}`);
    }
    if (port.groupId) {
      portAttrs.push(`group="${port.groupId}"`);
    }
    if (port.color) {
      portAttrs.push(`color="${port.color}"`);
    }

    const portAttrStr = portAttrs.length > 0 ? ` [${portAttrs.join(', ')}]` : '';
    lines.push(`${indent}${typeShort}${sidePart} ${port.id}${typePart}${portAttrStr}`);
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Formats an EdgeConnection into DSL text
 */
function serializeEdge(edge: EdgeConnection): string {
  const attrParts: string[] = [];
  if (edge.label) {
    attrParts.push(`label="${edge.label}"`);
  }
  if (edge.color) {
    attrParts.push(`color="${edge.color}"`);
  }
  if (edge.dataType) {
    attrParts.push(`dataType="${edge.dataType}"`);
  }
  if (edge.id && !edge.id.startsWith('e_')) {
    attrParts.push(`id="${edge.id}"`);
  }

  const attrStr = attrParts.length > 0 ? ` [${attrParts.join(', ')}]` : '';
  return `${edge.sourceBlockId}.${edge.sourcePortId} -> ${edge.targetBlockId}.${edge.targetPortId}${attrStr}`;
}

/**
 * Serializes standard diagram nodes and edges into clean, human-readable AutoTrace Compact DSL
 */
export function formatDSL(
  nodes: BlockNode[],
  edges: EdgeConnection[],
  options: DSLSerializeOptions = {}
): string {
  const sections: string[] = [];

  // Blocks
  if (nodes.length > 0) {
    const blockTexts = nodes.map(n => serializeBlock(n, options));
    sections.push(blockTexts.join('\n\n'));
  }

  // Connections
  if (edges.length > 0) {
    const edgeTexts = edges.map(serializeEdge);
    sections.push(edgeTexts.join('\n'));
  }

  return sections.join('\n\n');
}
