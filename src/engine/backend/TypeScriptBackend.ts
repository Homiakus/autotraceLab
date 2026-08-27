import {
  BlockNode,
  EdgeConnection,
  RoutingOptions,
  ScenePatch,
  SceneResult,
  DEFAULT_ROUTING_OPTIONS,
} from '../../types';
import {
  EngineOperation,
  HelloResult,
  LayoutRequestPayload,
  LayoutResultValue,
  SceneOpenPayload,
  ScenePatchPayload,
  SceneUpdateOptionsPayload,
  SceneCloseResult,
  NLPOptimizePayload,
  UnifiedCoOptimizePayload,
  CONTRACT_PROTOCOL_VERSION,
} from '../types';
import { EngineBackend } from './EngineBackend';
import { EngineProtocolError } from '../protocol';
import { routeOrthogonalAStar } from '../../algorithms/orthogonalAStarRouter';
import { calculateBenchmarkMetrics } from '../../algorithms/metrics';
import { runNLPOptimization } from '../../algorithms/nlpOptimizer';
import { runUnifiedCoOptimization } from '../../algorithms/unifiedOptimizer';

interface SceneState {
  graphId: string;
  revision: number;
  nodes: Map<string, BlockNode>;
  nodeOrder: string[];
  edges: Map<string, EdgeConnection>;
  edgeOrder: string[];
  options: RoutingOptions;
}

export class TypeScriptBackend implements EngineBackend {
  readonly type = 'typescript' as const;
  private scenes = new Map<string, SceneState>();

  async hello(): Promise<HelloResult> {
    return {
      service: 'autotrace-lab',
      engine: 'autotrace-ts-stateful',
      capabilities: {
        runtime: 'typescript-stateful',
        protocolVersion: CONTRACT_PROTOCOL_VERSION,
        importableCore: true,
        orthogonalRouting: true,
        metrics: true,
        labels: true,
        incrementalScenes: true,
        scenePatch: true,
        strictRevisions: true,
        nlpOptimization: true,
        bridgeJumps: true,
        g1Splines: true,
        unifiedCoOpt: true,
      },
    };
  }

  async request<TReq, TRes>(operation: EngineOperation, payload: TReq, signal?: AbortSignal): Promise<TRes> {
    if (signal?.aborted) {
      throw new EngineProtocolError({
        code: 'AUTOTRACE_CANCELLED',
        message: 'Operation cancelled by host AbortSignal',
      });
    }

    switch (operation) {
      case 'hello':
        return (await this.hello()) as unknown as TRes;

      case 'layout': {
        const p = payload as LayoutRequestPayload;
        const opts = p.options || DEFAULT_ROUTING_OPTIONS;
        const start = performance.now();
        const routed = routeOrthogonalAStar(p.nodes, p.edges, opts);
        const duration = performance.now() - start;
        const metrics = calculateBenchmarkMetrics(p.nodes, routed, duration, 'preserve-input-layout', 'orthogonal-a-star');
        const res: LayoutResultValue = {
          graphId: p.graphId || 'default',
          edges: routed,
          metrics,
          durationMs: duration,
          engine: 'autotrace-ts-stateful',
          protocol: CONTRACT_PROTOCOL_VERSION,
          contractVersion: 1,
        };
        return res as unknown as TRes;
      }

      case 'scene.open': {
        const p = payload as SceneOpenPayload;
        if (!p.graphId) {
          throw new EngineProtocolError({ code: 'AUTOTRACE_INVALID_PAYLOAD', message: 'graphId is required' });
        }
        const revision = p.revision > 0 ? p.revision : 1;
        const start = performance.now();
        const routed = routeOrthogonalAStar(p.nodes, p.edges, p.options);
        const duration = performance.now() - start;
        const metrics = calculateBenchmarkMetrics(p.nodes, routed, duration, 'preserve-input-layout', 'orthogonal-a-star');

        const state: SceneState = {
          graphId: p.graphId,
          revision,
          nodes: new Map(p.nodes.map(n => [n.id, { ...n }])),
          nodeOrder: p.nodes.map(n => n.id),
          edges: new Map(routed.map(e => [e.id, { ...e }])),
          edgeOrder: routed.map(e => e.id),
          options: p.options,
        };
        this.scenes.set(p.graphId, state);

        const res: SceneResult = {
          graphId: p.graphId,
          revision: state.revision,
          nodes: p.nodes,
          edges: routed,
          metrics,
          durationMs: duration,
          reusedEdges: 0,
          reroutedEdges: routed.length,
          reroutedEdgeIds: routed.map(e => e.id),
          engine: 'autotrace-ts-stateful',
          contractVersion: 1,
        };
        return res as unknown as TRes;
      }

      case 'scene.patch': {
        const p = payload as ScenePatchPayload;
        const state = this.scenes.get(p.graphId);
        if (!state) {
          throw new EngineProtocolError({
            code: 'AUTOTRACE_SCENE_NOT_FOUND',
            message: `scene "${p.graphId}" not found`,
          });
        }
        const patch = p.patch;
        if (patch.baseRevision !== state.revision) {
          throw new EngineProtocolError({
            code: 'AUTOTRACE_REVISION_CONFLICT',
            message: `scene "${p.graphId}" revision conflict: expected base ${patch.baseRevision}, current ${state.revision}`,
            retryable: true,
            details: {
              graphId: p.graphId,
              expected: patch.baseRevision,
              actual: state.revision,
            },
          });
        }
        if (patch.revision !== patch.baseRevision + 1) {
          throw new EngineProtocolError({
            code: 'AUTOTRACE_INVALID_PAYLOAD',
            message: `scene "${p.graphId}" revision must advance by 1: base=${patch.baseRevision}, next=${patch.revision}`,
          });
        }

        const started = performance.now();
        const nodes = new Map(state.nodes);
        let nodeOrder = [...state.nodeOrder];
        const edges = new Map(state.edges);
        let edgeOrder = [...state.edgeOrder];
        const dirtyNodes = new Set<string>();
        const dirtyEdges = new Set<string>();

        if (patch.removedEdgeIds) {
          for (const id of patch.removedEdgeIds) {
            edges.delete(id);
            edgeOrder = edgeOrder.filter(x => x !== id);
            dirtyEdges.add(id);
          }
        }
        if (patch.removedBlockIds) {
          for (const id of patch.removedBlockIds) {
            nodes.delete(id);
            nodeOrder = nodeOrder.filter(x => x !== id);
            dirtyNodes.add(id);
          }
        }
        for (const block of patch.changedBlocks) {
          if (!nodes.has(block.id)) nodeOrder.push(block.id);
          nodes.set(block.id, { ...block });
          dirtyNodes.add(block.id);
        }
        for (const edge of patch.changedEdges) {
          if (!edges.has(edge.id)) edgeOrder.push(edge.id);
          edges.set(edge.id, { ...edge });
          dirtyEdges.add(edge.id);
        }

        const nodeList = nodeOrder.map(id => nodes.get(id)!).filter(Boolean);
        const edgeList = edgeOrder.map(id => edges.get(id)!).filter(Boolean);

        const routed: EdgeConnection[] = [];
        const reroutedIds: string[] = [];
        let reusedCount = 0;

        for (const edge of edgeList) {
          const prev = state.edges.get(edge.id);
          const explicitlyDirty = dirtyEdges.has(edge.id);
          const connectedDirty = dirtyNodes.has(edge.sourceBlockId) || dirtyNodes.has(edge.targetBlockId);
          const needsRoute = explicitlyDirty || connectedDirty || !prev || !prev.path || prev.path.length < 2;

          if (needsRoute) {
            const one = routeOrthogonalAStar(nodeList, [edge], state.options);
            const routedEdge = one.length > 0 ? one[0] : edge;
            routed.push(routedEdge);
            reroutedIds.push(edge.id);
          } else {
            routed.push({ ...prev });
            reusedCount++;
          }
        }

        const duration = performance.now() - started;
        const metrics = calculateBenchmarkMetrics(nodeList, routed, duration, 'incremental-preserve-layout', 'orthogonal-a-star');

        state.revision = patch.revision;
        state.nodes = nodes;
        state.nodeOrder = nodeOrder;
        state.edges = new Map(routed.map(e => [e.id, { ...e }]));
        state.edgeOrder = edgeOrder;

        const res: SceneResult = {
          graphId: p.graphId,
          revision: state.revision,
          nodes: nodeList,
          edges: routed,
          metrics,
          durationMs: duration,
          reusedEdges: reusedCount,
          reroutedEdges: reroutedIds.length,
          reroutedEdgeIds: reroutedIds,
          engine: 'autotrace-ts-stateful',
          contractVersion: 1,
        };
        return res as unknown as TRes;
      }

      case 'scene.update_options': {
        const p = payload as SceneUpdateOptionsPayload;
        const state = this.scenes.get(p.graphId);
        if (!state) {
          throw new EngineProtocolError({
            code: 'AUTOTRACE_SCENE_NOT_FOUND',
            message: `scene "${p.graphId}" not found`,
          });
        }
        const started = performance.now();
        state.options = p.options;
        const nodeList = state.nodeOrder.map(id => state.nodes.get(id)!).filter(Boolean);
        const edgeList = state.edgeOrder.map(id => state.edges.get(id)!).filter(Boolean);
        const routed = routeOrthogonalAStar(nodeList, edgeList, p.options);
        const duration = performance.now() - started;
        const metrics = calculateBenchmarkMetrics(nodeList, routed, duration, 'preserve-input-layout', 'orthogonal-a-star');

        state.revision++;
        state.edges = new Map(routed.map(e => [e.id, { ...e }]));

        const res: SceneResult = {
          graphId: p.graphId,
          revision: state.revision,
          nodes: nodeList,
          edges: routed,
          metrics,
          durationMs: duration,
          reusedEdges: 0,
          reroutedEdges: routed.length,
          reroutedEdgeIds: routed.map(e => e.id),
          engine: 'autotrace-ts-stateful',
          contractVersion: 1,
        };
        return res as unknown as TRes;
      }

      case 'scene.snapshot': {
        const p = payload as { graphId: string };
        const state = this.scenes.get(p.graphId);
        if (!state) {
          throw new EngineProtocolError({
            code: 'AUTOTRACE_SCENE_NOT_FOUND',
            message: `scene "${p.graphId}" not found`,
          });
        }
        const nodeList = state.nodeOrder.map(id => state.nodes.get(id)!).filter(Boolean);
        const edgeList = state.edgeOrder.map(id => state.edges.get(id)!).filter(Boolean);
        const metrics = calculateBenchmarkMetrics(nodeList, edgeList, 0, 'snapshot', 'orthogonal-a-star');

        const res: SceneResult = {
          graphId: p.graphId,
          revision: state.revision,
          nodes: nodeList,
          edges: edgeList,
          metrics,
          durationMs: 0,
          reusedEdges: edgeList.length,
          reroutedEdges: 0,
          engine: 'autotrace-ts-stateful',
          contractVersion: 1,
        };
        return res as unknown as TRes;
      }

      case 'scene.close': {
        const p = payload as { graphId: string };
        const existed = this.scenes.delete(p.graphId);
        if (!existed) {
          throw new EngineProtocolError({
            code: 'AUTOTRACE_SCENE_NOT_FOUND',
            message: `scene "${p.graphId}" not found`,
          });
        }
        const res: SceneCloseResult = { graphId: p.graphId, closed: true };
        return res as unknown as TRes;
      }

      case 'nlp.optimize': {
        const p = payload as NLPOptimizePayload;
        const res = runNLPOptimization(p.nodes, p.edges, p.options, p.params);
        return res as unknown as TRes;
      }

      case 'unified.co_optimize': {
        const p = payload as UnifiedCoOptimizePayload;
        const res = runUnifiedCoOptimization(p.nodes, p.edges, p.options);
        return res as unknown as TRes;
      }

      default:
        throw new EngineProtocolError({
          code: 'AUTOTRACE_UNSUPPORTED_OPERATION',
          message: `Operation "${operation}" is unsupported in TypeScriptBackend`,
        });
    }
  }

  async dispose(): Promise<void> {
    this.scenes.clear();
  }
}
