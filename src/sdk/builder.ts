/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BlockCategory = 'source' | 'processor' | 'sink' | 'logic' | 'storage' | 'custom';

import {
  BlockNode,
  EdgeConnection,
  Port,
  PortSide,
  BlockShape,
  RoutingOptions,
  BenchmarkMetrics,
} from '../types';
import { routeOrthogonalAStar } from '../algorithms/orthogonalAStarRouter';
import { runSugiyamaLayout } from '../algorithms/sugiyamaLayout';
import { runOrthogonalGridLayout } from '../algorithms/orthogonalGridLayout';
import { runForceDirectedLayout } from '../algorithms/forceLayout';
import { calculateBenchmarkMetrics } from '../algorithms/metrics';
import { calculateMinimumBlockSize, applyBlockAutoSizing } from '../algorithms/blockGeometry';
import { DiagramTheme, resolveTheme } from './themes';
import { RoutingProfileType, resolveRoutingOptions } from './profiles';
import { renderDiagramSvg, SvgRenderOptions } from './renderer';

export interface SimplePortDefinition {
  id?: string;
  name?: string;
  side?: PortSide;
}

export interface SimpleNodeInput {
  id: string;
  title?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  shape?: BlockShape;
  category?: BlockCategory;
  color?: string;
  inputs?: Array<string | SimplePortDefinition>;
  outputs?: Array<string | SimplePortDefinition>;
}

export interface SimpleEdgeInput {
  id?: string;
  from: string; // "nodeId" or "nodeId:portId"
  to: string;   // "nodeId" or "nodeId:portId"
  fromPort?: string;
  toPort?: string;
  label?: string;
  color?: string;
}

export interface SimpleGraphConfig {
  nodes: SimpleNodeInput[];
  edges: SimpleEdgeInput[];
  options?: RoutingProfileType | Partial<RoutingOptions>;
  theme?: string | Partial<DiagramTheme>;
  autoLayout?: 'sugiyama' | 'grid' | 'force' | false;
  title?: string;
}

export interface RouteResult {
  nodes: BlockNode[];
  edges: EdgeConnection[];
  metrics?: BenchmarkMetrics;
  toSvg: (options?: SvgRenderOptions) => string;
}

function normalizePorts(
  ports: Array<string | SimplePortDefinition> | undefined,
  type: 'input' | 'output',
  defaultSide: PortSide
): Port[] {
  if (!ports || ports.length === 0) return [];
  return ports.map((p, idx) => {
    if (typeof p === 'string') {
      return {
        id: p,
        name: p,
        type,
        side: defaultSide,
        relativePosition: (idx + 1) / (ports.length + 1),
      };
    }
    const side = p.side || defaultSide;
    const id = p.id || `${type}_${idx + 1}`;
    return {
      id,
      name: p.name || id,
      type,
      side,
      relativePosition: (idx + 1) / (ports.length + 1),
    };
  });
}

/**
 * Fluent builder for creating, laying out, routing, and exporting diagrams with minimal boilerplate.
 */
export class DiagramBuilder {
  private rawNodes: Map<string, BlockNode> = new Map();
  private rawEdges: EdgeConnection[] = [];
  private routingOptions: RoutingOptions;
  private currentTheme: DiagramTheme;
  private edgeCounter = 1;
  private layoutAlgo?: 'sugiyama' | 'grid' | 'force';
  private diagramTitle?: string;

  constructor(profile: RoutingProfileType | Partial<RoutingOptions> = 'balanced', theme: string | Partial<DiagramTheme> = 'light') {
    this.routingOptions = resolveRoutingOptions(profile);
    this.currentTheme = resolveTheme(theme);
  }

  setTitle(title: string): this {
    this.diagramTitle = title;
    return this;
  }

  setTheme(theme: string | Partial<DiagramTheme>): this {
    this.currentTheme = resolveTheme(theme);
    return this;
  }

  setRouting(profileOrOptions: RoutingProfileType | Partial<RoutingOptions>): this {
    this.routingOptions = resolveRoutingOptions(profileOrOptions);
    return this;
  }

  addNode(input: SimpleNodeInput): this {
    const inputs = normalizePorts(input.inputs, 'input', 'left');
    const outputs = normalizePorts(input.outputs, 'output', 'right');

    const width = input.width ?? 140;
    const height = input.height ?? 70;

    let node: BlockNode = {
      id: input.id,
      title: input.title || input.id,
      x: input.x ?? 0,
      y: input.y ?? 0,
      width,
      height,
      shape: input.shape || 'rounded',
      category: input.category || 'processor',
      inputs,
      outputs,
      color: input.color,
    };

    // Ensure minimum block dimensions for ports
    const minDims = calculateMinimumBlockSize(node);
    if (node.width < minDims.minWidth || node.height < minDims.minHeight) {
      node = applyBlockAutoSizing(node);
    }

    this.rawNodes.set(node.id, node);
    return this;
  }

  connect(
    from: string,
    to: string,
    edgeOpts: { label?: string; color?: string; fromPort?: string; toPort?: string; id?: string } = {}
  ): this {
    const parseEndpoint = (endpoint: string, explicitPort?: string) => {
      if (endpoint.includes(':')) {
        const [nodeId, portId] = endpoint.split(':');
        return { nodeId, portId };
      }
      return { nodeId: endpoint, portId: explicitPort };
    };

    const src = parseEndpoint(from, edgeOpts.fromPort);
    const tgt = parseEndpoint(to, edgeOpts.toPort);

    // Ensure source node exists
    let srcNode = this.rawNodes.get(src.nodeId);
    if (!srcNode) {
      srcNode = {
        id: src.nodeId,
        title: src.nodeId,
        x: 0,
        y: 0,
        width: 140,
        height: 70,
        category: 'processor',
        shape: 'rounded',
        inputs: [],
        outputs: [],
      };
      this.rawNodes.set(src.nodeId, srcNode);
    }

    // Ensure target node exists
    let tgtNode = this.rawNodes.get(tgt.nodeId);
    if (!tgtNode) {
      tgtNode = {
        id: tgt.nodeId,
        title: tgt.nodeId,
        x: 0,
        y: 0,
        width: 140,
        height: 70,
        category: 'processor',
        shape: 'rounded',
        inputs: [],
        outputs: [],
      };
      this.rawNodes.set(tgt.nodeId, tgtNode);
    }

    // Ensure source port exists
    let srcPortId = src.portId;
    if (!srcPortId) {
      if (srcNode.outputs.length === 0) {
        const newPort: Port = { id: 'out_1', name: 'out', type: 'output', side: 'right' };
        srcNode.outputs.push(newPort);
        srcPortId = newPort.id;
      } else {
        srcPortId = srcNode.outputs[0].id;
      }
    } else if (!srcNode.outputs.some(p => p.id === srcPortId)) {
      srcNode.outputs.push({ id: srcPortId, name: srcPortId, type: 'output', side: 'right' });
    }

    // Ensure target port exists
    let tgtPortId = tgt.portId;
    if (!tgtPortId) {
      if (tgtNode.inputs.length === 0) {
        const newPort: Port = { id: 'in_1', name: 'in', type: 'input', side: 'left' };
        tgtNode.inputs.push(newPort);
        tgtPortId = newPort.id;
      } else {
        tgtPortId = tgtNode.inputs[0].id;
      }
    } else if (!tgtNode.inputs.some(p => p.id === tgtPortId)) {
      tgtNode.inputs.push({ id: tgtPortId, name: tgtPortId, type: 'input', side: 'left' });
    }

    // Re-verify sizing after adding ports
    this.rawNodes.set(srcNode.id, applyBlockAutoSizing(srcNode));
    this.rawNodes.set(tgtNode.id, applyBlockAutoSizing(tgtNode));

    const edge: EdgeConnection = {
      id: edgeOpts.id || `e_${this.edgeCounter++}`,
      sourceBlockId: src.nodeId,
      sourcePortId: srcPortId,
      targetBlockId: tgt.nodeId,
      targetPortId: tgtPortId,
      label: edgeOpts.label,
      color: edgeOpts.color,
    };

    this.rawEdges.push(edge);
    return this;
  }

  autoLayout(algorithm: 'sugiyama' | 'grid' | 'force' = 'sugiyama'): this {
    this.layoutAlgo = algorithm;
    return this;
  }

  route(): RouteResult {
    let nodes = Array.from(this.rawNodes.values());
    const edges = [...this.rawEdges];

    // Apply auto layout if requested or if all nodes are at (0,0)
    const allAtZero = nodes.length > 1 && nodes.every(n => n.x === 0 && n.y === 0);
    const layoutAlgo = this.layoutAlgo || (allAtZero ? 'sugiyama' : undefined);

    if (layoutAlgo === 'sugiyama') {
      const laidOut = runSugiyamaLayout(nodes, edges);
      nodes = laidOut.nodes;
    } else if (layoutAlgo === 'grid') {
      nodes = runOrthogonalGridLayout(nodes, edges).nodes;
    } else if (layoutAlgo === 'force') {
      nodes = runForceDirectedLayout(nodes, edges).nodes;
    }

    const tStart = performance.now();
    const routedEdges = routeOrthogonalAStar(nodes, edges, this.routingOptions);
    const durationMs = performance.now() - tStart;

    const metrics = calculateBenchmarkMetrics(
      nodes,
      routedEdges,
      durationMs,
      layoutAlgo || 'manual',
      'orthogonal-a-star',
      this.routingOptions
    );

    const theme = this.currentTheme;
    const title = this.diagramTitle;

    return {
      nodes,
      edges: routedEdges,
      metrics,
      toSvg: (svgOpts: SvgRenderOptions = {}) => {
        return renderDiagramSvg(nodes, routedEdges, {
          theme: svgOpts.theme || theme,
          title: svgOpts.title || title,
          cornerRadius: svgOpts.cornerRadius ?? this.routingOptions.cornerRadius,
          ...svgOpts,
        });
      },
    };
  }

  toSvg(options?: SvgRenderOptions): string {
    return this.route().toSvg(options);
  }
}

/**
 * High-level shortcut function to route a simple graph in one call.
 */
export function routeSimpleGraph(config: SimpleGraphConfig): RouteResult {
  const builder = new DiagramBuilder(config.options, config.theme);
  if (config.title) builder.setTitle(config.title);

  for (const n of config.nodes) {
    builder.addNode(n);
  }

  for (const e of config.edges) {
    builder.connect(e.from, e.to, {
      id: e.id,
      label: e.label,
      color: e.color,
      fromPort: e.fromPort,
      toPort: e.toPort,
    });
  }

  if (config.autoLayout) {
    builder.autoLayout(config.autoLayout);
  }

  return builder.route();
}
