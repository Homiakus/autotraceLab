import {
  BlockNode,
  EdgeConnection,
  RoutingOptions,
  SceneResult,
  ScenePatch,
  DEFAULT_ROUTING_OPTIONS,
} from '../types';
import { EngineClient } from '../engine/EngineClient';
import { LayoutResultValue } from '../engine/types';
import { RegistryStore } from '../registry/RegistryClient';
import { AutoTraceSDKConfig, AutoTraceSession, StorageAdapter, TelemetryAdapter, SceneOpenInput } from './types';
import { InMemoryStorageAdapter, LocalStorageAdapter } from './storage';
import { SceneSession, getSceneBounds, renderEdgeToSvgPath } from './SceneSession';
import { routeOrthogonalAStar } from '../algorithms/orthogonalAStarRouter';

export * from '../types';
export * from '../dsl';
export * from './types';
export * from './storage';
export * from './SceneSession';
export * from '../process/index';
// Domain packs are extensions over the universal core. LBC is exported by the SDK
// for convenient reuse, but it is intentionally not re-exported by src/process/index.ts.
export * from '../domainPacks/lbc';
export { EngineClient } from '../engine/EngineClient';
export { RegistryStore } from '../registry/RegistryClient';
export { generateOrthogonalPathWithBridges, renderG1ContinuousStraightPath } from '../algorithms/bridgeJumps';
export {
  routeOrthogonalAStar,
  simplifyOrthogonalPath,
  computeAdaptivePortStub,
} from '../algorithms/orthogonalAStarRouter';
export { getPortCoordinates, deriveBlockGeometry, calculateMinimumBlockSize, getAllNodePorts } from '../algorithms/blockGeometry';
export { calculateBenchmarkMetrics } from '../algorithms/metrics';
export { cleanOrthogonalArtifacts } from '../algorithms/wireArtifactCleaner';
export { classifyBlockChange, classifyEdgeChange } from '../registry/invalidation';

/**
 * Pure synchronous orthogonal routing function with zero async/OOP overhead.
 * Guaranteed: 90° port stubs, 0 px collinear overlaps, obstacle avoidance, G1-fillet support.
 */
export function routeOrthogonal(
  nodes: BlockNode[],
  edges: EdgeConnection[],
  options?: Partial<RoutingOptions>
): EdgeConnection[] {
  const mergedOptions: RoutingOptions = {
    ...DEFAULT_ROUTING_OPTIONS,
    ...(options || {}),
  };
  return routeOrthogonalAStar(nodes, edges, mergedOptions);
}

export class AutoTraceClient {
  readonly engine: EngineClient;
  readonly registry: RegistryStore;
  readonly storage: StorageAdapter;
  readonly telemetry?: TelemetryAdapter;
  readonly defaultOptions: RoutingOptions;

  constructor(config: AutoTraceSDKConfig = {}) {
    this.defaultOptions = {
      ...DEFAULT_ROUTING_OPTIONS,
      ...(config.defaultOptions || {}),
    };

    this.engine = new EngineClient({
      backend: config.backend,
      worker: config.worker,
      workerUrl: config.workerUrl,
      enableShadowExecution: false,
    });

    this.registry = new RegistryStore();
    if (config.packages) {
      for (const pkg of config.packages) {
        this.registry.importPackage(pkg);
      }
    }

    this.telemetry = config.telemetry;
    this.storage = config.storage || (typeof localStorage !== 'undefined' ? new LocalStorageAdapter() : new InMemoryStorageAdapter());
  }

  async openScene(
    inputOrId: SceneOpenInput | string,
    nodes?: BlockNode[],
    edges?: EdgeConnection[],
    options?: Partial<RoutingOptions>
  ): Promise<SceneSession> {
    let graphId: string;
    let targetNodes: BlockNode[];
    let targetEdges: EdgeConnection[];
    let targetOptions: RoutingOptions;
    let revision: number;

    if (typeof inputOrId === 'string') {
      graphId = inputOrId;
      targetNodes = nodes || [];
      targetEdges = edges || [];
      targetOptions = { ...this.defaultOptions, ...(options || {}) };
      revision = 1;
    } else {
      graphId = inputOrId.id || inputOrId.graphId || 'default-scene';
      targetNodes = inputOrId.nodes || [];
      targetEdges = inputOrId.edges || [];
      targetOptions = { ...this.defaultOptions, ...(inputOrId.options || {}) };
      revision = inputOrId.revision || 1;
    }

    this.telemetry?.logEvent('scene.open.start', { graphId, nodesCount: targetNodes.length, edgesCount: targetEdges.length });

    const res = await this.engine.open({
      graphId,
      revision,
      nodes: targetNodes,
      edges: targetEdges,
      options: targetOptions,
    });

    await this.storage.setItem(`autotrace:scene:${graphId}`, JSON.stringify(res));

    this.telemetry?.logEvent('scene.open.success', { graphId, durationMs: res.durationMs });

    return new SceneSession(graphId, res, this.engine, this.storage);
  }

  async route(
    nodes: BlockNode[],
    edges: EdgeConnection[],
    options?: Partial<RoutingOptions>,
    signal?: AbortSignal
  ): Promise<LayoutResultValue> {
    const opts = { ...this.defaultOptions, ...(options || {}) };
    return this.engine.layout({ nodes, edges, options: opts }, signal);
  }

  async patchScene(graphId: string, patch: ScenePatch, signal?: AbortSignal): Promise<SceneResult> {
    this.telemetry?.logEvent('scene.patch.start', { graphId, baseRevision: patch.baseRevision });
    const res = await this.engine.patch({ graphId, patch }, signal);
    await this.storage.setItem(`autotrace:scene:${graphId}`, JSON.stringify(res));
    this.telemetry?.logEvent('scene.patch.success', { graphId, revision: res.revision, durationMs: res.durationMs });
    return res;
  }

  async loadPersistedSession(graphId: string): Promise<AutoTraceSession | null> {
    const raw = await this.storage.getItem(`autotrace:scene:${graphId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AutoTraceSession;
    } catch {
      return null;
    }
  }

  async destroy(): Promise<void> {
    await this.engine.destroy();
  }
}

export function createAutoTraceClient(config?: AutoTraceSDKConfig): AutoTraceClient {
  return new AutoTraceClient(config);
}
