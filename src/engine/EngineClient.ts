import {
  BlockNode,
  EdgeConnection,
  RoutingOptions,
  SceneResult,
} from '../types';
import { NLPOptimizationResult } from '../algorithms/nlpOptimizer';
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
  ShadowComparisonReport,
} from './types';
import { EngineBackend, BackendType } from './backend/EngineBackend';
import { TypeScriptBackend } from './backend/TypeScriptBackend';
import { DirectWasmBackend } from './backend/DirectWasmBackend';
import { WasmWorkerBackend } from './backend/WasmWorkerBackend';
import { routeOrthogonalAStar } from '../algorithms/orthogonalAStarRouter';
import { calculateBenchmarkMetrics } from '../algorithms/metrics';

export interface EngineClientOptions {
  backend?: BackendType | EngineBackend;
  workerUrl?: string;
  worker?: Worker;
  timeoutMs?: number;
  enableShadowExecution?: boolean;
}

export class EngineClient {
  readonly backend: EngineBackend;
  private enableShadow: boolean;
  private cachedCapabilities: HelloResult | null = null;

  constructor(options: EngineClientOptions = {}) {
    this.enableShadow = Boolean(options.enableShadowExecution);

    if (options.backend && typeof options.backend === 'object') {
      this.backend = options.backend;
    } else {
      const bType: BackendType = (options.backend as BackendType) || 'auto';
      this.backend = this.resolveBackend(bType, options);
    }
  }

  private resolveBackend(type: BackendType, options: EngineClientOptions): EngineBackend {
    if (type === 'typescript') {
      return new TypeScriptBackend();
    }
    if (type === 'direct-wasm') {
      return new DirectWasmBackend();
    }
    if (type === 'wasm-worker') {
      return new WasmWorkerBackend({
        worker: options.worker,
        workerUrl: options.workerUrl,
        timeoutMs: options.timeoutMs,
      });
    }

    // Auto resolution:
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).businessOSAutoTraceRequest === 'function') {
      return new DirectWasmBackend();
    }
    if (typeof Worker !== 'undefined' && (options.worker || options.workerUrl)) {
      return new WasmWorkerBackend({
        worker: options.worker,
        workerUrl: options.workerUrl,
        timeoutMs: options.timeoutMs,
      });
    }

    return new TypeScriptBackend();
  }

  async send<TReq, TRes>(operation: EngineOperation, payload: TReq, signal?: AbortSignal): Promise<TRes> {
    return this.backend.request<TReq, TRes>(operation, payload, signal);
  }

  async hello(): Promise<HelloResult> {
    if (this.cachedCapabilities) return this.cachedCapabilities;
    const res = await this.backend.hello();
    this.cachedCapabilities = res;
    return res;
  }

  async layout(payload: LayoutRequestPayload, signal?: AbortSignal): Promise<LayoutResultValue> {
    return this.send<LayoutRequestPayload, LayoutResultValue>('layout', payload, signal);
  }

  async open(payload: SceneOpenPayload, signal?: AbortSignal): Promise<SceneResult> {
    return this.send<SceneOpenPayload, SceneResult>('scene.open', payload, signal);
  }

  async patch(payload: ScenePatchPayload, signal?: AbortSignal): Promise<SceneResult> {
    return this.send<ScenePatchPayload, SceneResult>('scene.patch', payload, signal);
  }

  async updateOptions(payload: SceneUpdateOptionsPayload, signal?: AbortSignal): Promise<SceneResult> {
    return this.send<SceneUpdateOptionsPayload, SceneResult>('scene.update_options', payload, signal);
  }

  async snapshot(graphId: string, signal?: AbortSignal): Promise<SceneResult> {
    return this.send<{ graphId: string }, SceneResult>('scene.snapshot', { graphId }, signal);
  }

  async close(graphId: string, signal?: AbortSignal): Promise<SceneCloseResult> {
    return this.send<{ graphId: string }, SceneCloseResult>('scene.close', { graphId }, signal);
  }

  async optimizeNLP(payload: NLPOptimizePayload, signal?: AbortSignal): Promise<NLPOptimizationResult> {
    return this.send<NLPOptimizePayload, NLPOptimizationResult>('nlp.optimize', payload, signal);
  }

  async unifiedCoOptimize(payload: UnifiedCoOptimizePayload, signal?: AbortSignal): Promise<any> {
    return this.send<UnifiedCoOptimizePayload, any>('unified.co_optimize', payload, signal);
  }

  /**
   * Shadow comparison: runs TS reference implementation alongside backend request to check parity
   */
  async shadowCompare(
    nodes: BlockNode[],
    edges: EdgeConnection[],
    options: RoutingOptions,
    signal?: AbortSignal
  ): Promise<ShadowComparisonReport> {
    const startTs = performance.now();
    const tsRouted = routeOrthogonalAStar(nodes, edges, options);
    const tsDuration = performance.now() - startTs;
    const tsMetrics = calculateBenchmarkMetrics(nodes, tsRouted, tsDuration, 'ts-baseline', 'orthogonal-a-star');

    let goDuration = 0;
    let goMetrics: any = undefined;
    const discrepancies: string[] = [];

    try {
      const startGo = performance.now();
      const goResult = await this.layout({
        graphId: 'shadow-test',
        nodes,
        edges,
        options,
      }, signal);
      goDuration = performance.now() - startGo;
      goMetrics = goResult.metrics;

      if (goResult.edges.length !== tsRouted.length) {
        discrepancies.push(`Edge count mismatch: TS=${tsRouted.length} Go/Backend=${goResult.edges.length}`);
      }
    } catch (err: any) {
      discrepancies.push(`Backend execution error: ${err?.message || String(err)}`);
    }

    const matched = discrepancies.length === 0;
    const speedupRatio = goDuration > 0 ? tsDuration / goDuration : 1.0;

    return {
      graphId: 'shadow-compare',
      matched,
      tsDurationMs: tsDuration,
      goDurationMs: goDuration,
      speedupRatio,
      tsMetrics,
      goMetrics,
      discrepancies,
    };
  }

  async destroy() {
    await this.backend.dispose();
  }
}
