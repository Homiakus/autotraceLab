import {
  BlockNode,
  EdgeConnection,
  RoutingOptions,
  ScenePatch,
  SceneResult,
  DEFAULT_ROUTING_OPTIONS,
} from '../types';
import { EngineClient } from '../engine/EngineClient';
import { StorageAdapter } from './types';
import { generateOrthogonalPathWithBridges } from '../algorithms/bridgeJumps';

export interface ScenePatchInput {
  nodes?: {
    upsert?: BlockNode[];
    remove?: string[];
  };
  edges?: {
    upsert?: EdgeConnection[];
    remove?: string[];
  };
  changedBlocks?: BlockNode[];
  changedEdges?: EdgeConnection[];
  removedBlockIds?: string[];
  removedEdgeIds?: string[];
}

export interface SceneBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export type SceneListener = (snapshot: SceneResult) => void;

export class SceneSession {
  readonly graphId: string;
  private _revision: number;
  private engine: EngineClient;
  private storage?: StorageAdapter;
  private _currentResult: SceneResult;
  private listeners = new Set<SceneListener>();

  constructor(
    graphId: string,
    initialResult: SceneResult,
    engine: EngineClient,
    storage?: StorageAdapter
  ) {
    this.graphId = graphId;
    this._currentResult = initialResult;
    this._revision = initialResult.revision;
    this.engine = engine;
    this.storage = storage;
  }

  get revision(): number {
    return this._revision;
  }

  get currentResult(): SceneResult {
    return this._currentResult;
  }

  get nodes(): BlockNode[] {
    return this._currentResult.nodes;
  }

  get edges(): EdgeConnection[] {
    return this._currentResult.edges;
  }

  get metrics() {
    return this._currentResult.metrics;
  }

  async patch(input: ScenePatchInput, options: { signal?: AbortSignal } = {}): Promise<SceneResult> {
    const changedBlocks: BlockNode[] = [
      ...(input.changedBlocks || []),
      ...(input.nodes?.upsert || []),
    ];
    const changedEdges: EdgeConnection[] = [
      ...(input.changedEdges || []),
      ...(input.edges?.upsert || []),
    ];
    const removedBlockIds: string[] = [
      ...(input.removedBlockIds || []),
      ...(input.nodes?.remove || []),
    ];
    const removedEdgeIds: string[] = [
      ...(input.removedEdgeIds || []),
      ...(input.edges?.remove || []),
    ];

    const patch: ScenePatch = {
      baseRevision: this._revision,
      revision: this._revision + 1,
      changedBlocks,
      changedEdges,
      removedBlockIds,
      removedEdgeIds,
    };

    const res = await this.engine.patch({
      graphId: this.graphId,
      patch,
    }, options.signal);

    this._currentResult = res;
    this._revision = res.revision;

    if (this.storage) {
      await this.storage.setItem(`autotrace:scene:${this.graphId}`, JSON.stringify(res));
    }

    this.notifyListeners();
    return res;
  }

  async updateOptions(options: Partial<RoutingOptions>, signal?: AbortSignal): Promise<SceneResult> {
    const mergedOptions: RoutingOptions = {
      ...DEFAULT_ROUTING_OPTIONS,
      ...options,
    };

    const res = await this.engine.updateOptions({
      graphId: this.graphId,
      options: mergedOptions,
    }, signal);

    this._currentResult = res;
    this._revision = res.revision;

    if (this.storage) {
      await this.storage.setItem(`autotrace:scene:${this.graphId}`, JSON.stringify(res));
    }

    this.notifyListeners();
    return res;
  }

  async snapshot(signal?: AbortSignal): Promise<SceneResult> {
    const res = await this.engine.snapshot(this.graphId, signal);
    this._currentResult = res;
    this._revision = res.revision;
    return res;
  }

  subscribe(listener: SceneListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this._currentResult);
      } catch (err) {
        console.error('[SceneSession] Listener error:', err);
      }
    }
  }

  getBounds(): SceneBounds {
    return getSceneBounds(this._currentResult.nodes);
  }

  toSvgPaths(options: { enableBridges?: boolean; smoothCorners?: boolean; cornerRadius?: number } = {}): Array<{ edgeId: string; d: string }> {
    return this._currentResult.edges.map(e => ({
      edgeId: e.id,
      d: renderEdgeToSvgPath(e, this._currentResult.edges, options),
    }));
  }

  async close(signal?: AbortSignal): Promise<boolean> {
    const res = await this.engine.close(this.graphId, signal);
    this.listeners.clear();
    return res.closed;
  }
}

export function getSceneBounds(nodes: BlockNode[]): SceneBounds {
  if (!nodes || nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

export function renderEdgeToSvgPath(
  edge: EdgeConnection,
  allEdges: EdgeConnection[] = [edge],
  options: {
    enableBridges?: boolean;
    smoothCorners?: boolean;
    cornerRadius?: number;
  } = {}
): string {
  if (!edge.path || edge.path.length === 0) return '';
  const enableBridges = options.enableBridges ?? false;
  const smoothCorners = options.smoothCorners ?? true;
  return generateOrthogonalPathWithBridges(
    edge.path,
    edge.id,
    allEdges,
    enableBridges,
    smoothCorners,
    undefined,
    { cornerRadius: options.cornerRadius ?? 8.0 } as any
  );
}
