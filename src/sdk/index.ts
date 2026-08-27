import { BlockNode, EdgeConnection, RoutingOptions, SceneResult, ScenePatch } from '../types';
import { EngineClient } from '../engine/EngineClient';
import { RegistryStore } from '../registry/RegistryClient';
import { AutoTraceSDKConfig, AutoTraceSession, StorageAdapter } from './types';
import { InMemoryStorageAdapter, LocalStorageAdapter } from './storage';

export * from './types';
export * from './storage';
export { EngineClient } from '../engine/EngineClient';
export { RegistryStore } from '../registry/RegistryClient';

export class AutoTraceClient {
  readonly engine: EngineClient;
  readonly registry: RegistryStore;
  readonly storage: StorageAdapter;

  constructor(config: AutoTraceSDKConfig = {}) {
    this.engine = new EngineClient({
      workerUrl: config.workerUrl,
      enableShadowExecution: true,
    });
    this.registry = new RegistryStore();
    if (config.packages) {
      for (const pkg of config.packages) {
        this.registry.importPackage(pkg);
      }
    }
    this.storage = config.storage || (typeof localStorage !== 'undefined' ? new LocalStorageAdapter() : new InMemoryStorageAdapter());
  }

  async openScene(graphId: string, nodes: BlockNode[], edges: EdgeConnection[], options: RoutingOptions): Promise<SceneResult> {
    const res = await this.engine.open({
      graphId,
      revision: 1,
      nodes,
      edges,
      options,
    });
    await this.storage.setItem(`autotrace:scene:${graphId}`, JSON.stringify(res));
    return res;
  }

  async patchScene(graphId: string, patch: ScenePatch): Promise<SceneResult> {
    const res = await this.engine.patch({
      graphId,
      patch,
    });
    await this.storage.setItem(`autotrace:scene:${graphId}`, JSON.stringify(res));
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

  destroy() {
    this.engine.destroy();
  }
}

export function createAutoTraceClient(config?: AutoTraceSDKConfig): AutoTraceClient {
  return new AutoTraceClient(config);
}
