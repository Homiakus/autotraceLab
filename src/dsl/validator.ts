import { BlockNode, EdgeConnection, SubcircuitDefinition, Port } from '../types';
import { getAllNodePorts } from '../algorithms/blockGeometry';
import { DiagnosticIssue, ValidationReport } from './types';

const VALID_SHAPES = new Set(['rectangle', 'rounded', 'chip_ic', 'circle', 'diamond', 'hexagon']);
const VALID_CATEGORIES = new Set(['source', 'processor', 'sink', 'logic', 'storage', 'custom']);
const VALID_PORT_TYPES = new Set(['input', 'output', 'inout', 'passive']);
const VALID_PORT_SIDES = new Set(['left', 'right', 'top', 'bottom']);

/**
 * Validates a single BlockNode for schema integrity and physical feasibility.
 */
export function validateBlockNode(node: BlockNode): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];

  if (!node.id || typeof node.id !== 'string' || node.id.trim() === '') {
    issues.push({
      code: 'ERR_BLOCK_ID_REQUIRED',
      message: 'Block must have a non-empty string identifier (id).',
      severity: 'error',
      targetKind: 'block',
      field: 'id',
    });
  }

  if (node.width !== undefined && (typeof node.width !== 'number' || isNaN(node.width) || node.width <= 0)) {
    issues.push({
      code: 'ERR_BLOCK_INVALID_WIDTH',
      message: `Block "${node.id}" has invalid width (${node.width}). Must be a positive number.`,
      severity: 'error',
      targetId: node.id,
      targetKind: 'block',
      field: 'width',
    });
  }

  if (node.height !== undefined && (typeof node.height !== 'number' || isNaN(node.height) || node.height <= 0)) {
    issues.push({
      code: 'ERR_BLOCK_INVALID_HEIGHT',
      message: `Block "${node.id}" has invalid height (${node.height}). Must be a positive number.`,
      severity: 'error',
      targetId: node.id,
      targetKind: 'block',
      field: 'height',
    });
  }

  if (node.shape && !VALID_SHAPES.has(node.shape)) {
    issues.push({
      code: 'WARN_BLOCK_UNKNOWN_SHAPE',
      message: `Block "${node.id}" has unrecognized shape "${node.shape}". Defaulting to "rectangle".`,
      severity: 'warning',
      targetId: node.id,
      targetKind: 'block',
      field: 'shape',
    });
  }

  if (node.category && !VALID_CATEGORIES.has(node.category)) {
    issues.push({
      code: 'WARN_BLOCK_UNKNOWN_CATEGORY',
      message: `Block "${node.id}" has unrecognized category "${node.category}".`,
      severity: 'warning',
      targetId: node.id,
      targetKind: 'block',
      field: 'category',
    });
  }

  // Validate ports
  const allPorts = getAllNodePorts(node);
  const seenPortIds = new Set<string>();

  for (let i = 0; i < allPorts.length; i++) {
    const port = allPorts[i];
    if (!port.id || typeof port.id !== 'string' || port.id.trim() === '') {
      issues.push({
        code: 'ERR_PORT_ID_REQUIRED',
        message: `Port at index ${i} in block "${node.id}" is missing an ID.`,
        severity: 'error',
        targetId: node.id,
        targetKind: 'port',
        field: 'id',
      });
      continue;
    }

    if (seenPortIds.has(port.id)) {
      issues.push({
        code: 'ERR_DUPLICATE_PORT_ID',
        message: `Duplicate port ID "${port.id}" found in block "${node.id}". Port IDs must be unique per block.`,
        severity: 'error',
        targetId: node.id,
        targetKind: 'port',
        field: 'id',
      });
    }
    seenPortIds.add(port.id);

    if (port.type && !VALID_PORT_TYPES.has(port.type)) {
      issues.push({
        code: 'WARN_PORT_UNKNOWN_TYPE',
        message: `Port "${port.id}" in block "${node.id}" has unknown type "${port.type}".`,
        severity: 'warning',
        targetId: node.id,
        targetKind: 'port',
        field: 'type',
      });
    }

    if (port.side && !VALID_PORT_SIDES.has(port.side)) {
      issues.push({
        code: 'ERR_PORT_INVALID_SIDE',
        message: `Port "${port.id}" in block "${node.id}" has invalid side "${port.side}". Allowed sides: left, right, top, bottom.`,
        severity: 'error',
        targetId: node.id,
        targetKind: 'port',
        field: 'side',
      });
    }

    if (port.relativePosition !== undefined) {
      if (typeof port.relativePosition !== 'number' || isNaN(port.relativePosition) || port.relativePosition < 0 || port.relativePosition > 1) {
        issues.push({
          code: 'ERR_PORT_INVALID_RELATIVE_POSITION',
          message: `Port "${port.id}" in block "${node.id}" relativePosition must be between 0.0 and 1.0 (got ${port.relativePosition}).`,
          severity: 'error',
          targetId: node.id,
          targetKind: 'port',
          field: 'relativePosition',
        });
      }
    }
  }

  return issues;
}

/**
 * Validates complete diagram scene (nodes + edges + subcircuits) for referential and topological correctness.
 */
export function validateDiagram(
  nodes: BlockNode[],
  edges: EdgeConnection[],
  subcircuits?: Record<string, SubcircuitDefinition>
): ValidationReport {
  const issues: DiagnosticIssue[] = [];
  const nodeMap = new Map<string, BlockNode>();
  const nodePortsMap = new Map<string, Set<string>>();

  // 1. Validate Nodes
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (nodeMap.has(node.id)) {
      issues.push({
        code: 'ERR_DUPLICATE_BLOCK_ID',
        message: `Duplicate block ID "${node.id}" detected in scene. Block IDs must be globally unique within a diagram level.`,
        severity: 'error',
        targetId: node.id,
        targetKind: 'block',
        field: 'id',
      });
    }
    nodeMap.set(node.id, node);

    const blockIssues = validateBlockNode(node);
    issues.push(...blockIssues);

    const portIds = new Set<string>();
    const ports = getAllNodePorts(node);
    for (const p of ports) {
      portIds.add(p.id);
    }
    nodePortsMap.set(node.id, portIds);
  }

  // 2. Validate Edges
  const edgeIds = new Set<string>();
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];

    if (!edge.id) {
      issues.push({
        code: 'ERR_EDGE_ID_REQUIRED',
        message: `Edge at index ${i} is missing an ID.`,
        severity: 'error',
        targetKind: 'edge',
        field: 'id',
      });
    } else {
      if (edgeIds.has(edge.id)) {
        issues.push({
          code: 'WARN_DUPLICATE_EDGE_ID',
          message: `Duplicate edge ID "${edge.id}" detected.`,
          severity: 'warning',
          targetId: edge.id,
          targetKind: 'edge',
          field: 'id',
        });
      }
      edgeIds.add(edge.id);
    }

    // Check source node & port
    const sourceNode = nodeMap.get(edge.sourceBlockId);
    if (!sourceNode) {
      issues.push({
        code: 'ERR_EDGE_SOURCE_NOT_FOUND',
        message: `Edge "${edge.id}" references non-existent source block "${edge.sourceBlockId}".`,
        severity: 'error',
        targetId: edge.id,
        targetKind: 'edge',
        field: 'sourceBlockId',
      });
    } else {
      const ports = nodePortsMap.get(edge.sourceBlockId);
      if (ports && !ports.has(edge.sourcePortId)) {
        issues.push({
          code: 'ERR_EDGE_SOURCE_PORT_NOT_FOUND',
          message: `Edge "${edge.id}" references non-existent port "${edge.sourcePortId}" on source block "${edge.sourceBlockId}".`,
          severity: 'error',
          targetId: edge.id,
          targetKind: 'edge',
          field: 'sourcePortId',
        });
      }
    }

    // Check target node & port
    const targetNode = nodeMap.get(edge.targetBlockId);
    if (!targetNode) {
      issues.push({
        code: 'ERR_EDGE_TARGET_NOT_FOUND',
        message: `Edge "${edge.id}" references non-existent target block "${edge.targetBlockId}".`,
        severity: 'error',
        targetId: edge.id,
        targetKind: 'edge',
        field: 'targetBlockId',
      });
    } else {
      const ports = nodePortsMap.get(edge.targetBlockId);
      if (ports && !ports.has(edge.targetPortId)) {
        issues.push({
          code: 'ERR_EDGE_TARGET_PORT_NOT_FOUND',
          message: `Edge "${edge.id}" references non-existent port "${edge.targetPortId}" on target block "${edge.targetBlockId}".`,
          severity: 'error',
          targetId: edge.id,
          targetKind: 'edge',
          field: 'targetPortId',
        });
      }
    }
  }

  // 3. Validate Subcircuits if provided
  if (subcircuits) {
    for (const [subId, subDef] of Object.entries(subcircuits)) {
      if (!subDef.id) {
        issues.push({
          code: 'ERR_SUBCIRCUIT_ID_REQUIRED',
          message: `Subcircuit at key "${subId}" is missing ID.`,
          severity: 'error',
          targetKind: 'subcircuit',
        });
      }
      const subReport = validateDiagram(subDef.nodes || [], subDef.edges || []);
      for (const issue of subReport.issues) {
        issues.push({
          ...issue,
          message: `[Subcircuit ${subId}] ${issue.message}`,
        });
      }
    }
  }

  const errorsCount = issues.filter(i => i.severity === 'error').length;
  const warningsCount = issues.filter(i => i.severity === 'warning').length;

  return {
    valid: errorsCount === 0,
    errorsCount,
    warningsCount,
    issues,
  };
}
