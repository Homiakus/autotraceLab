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
  ProtocolResponse,
} from './types';
import { createProtocolRequest, EngineProtocolError } from './protocol';
import { routeOrthogonalAStar } from '../algorithms/orthogonalAStarRouter';
import { calculateBenchmarkMetrics } from '../algorithms/metrics';

export interface EngineClientOptions {
  workerUrl?: string;
  timeoutMs?: number;
  enableShadowExecution?: boolean;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: any;
  operation: EngineOperation;
}

export class EngineClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private timeoutMs: number;
  private enableShadow: boolean;
  private isInitialized = false;
  private cachedCapabilities: HelloResult | null = null;

  constructor(options: EngineClientOptions = {}) {
    this.timeoutMs = options.timeoutMs || 10000;
    this.enableShadow = Boolean(options.enableShadowExecution);

    if (typeof Worker !== 'undefined' && options.workerUrl) {
      try {
        this.worker = new Worker(options.workerUrl, { type: 'module' });
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this.worker.onerror = this.handleWorkerError.bind(this);
      } catch (err) {
        console.warn('[EngineClient] Worker initialization deferred/fallback:', err);
      }
    }
  }

  private handleWorkerMessage(event: MessageEvent<ProtocolResponse>) {
    const res = event.data;
    if (!res || !res.requestId) return;

    const pending = this.pendingRequests.get(res.requestId);
    if (!pending) {
      // Stale or cancelled response, safely ignored
      return;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(res.requestId);

    if (res.ok) {
      pending.resolve(res.value);
    } else {
      pending.reject(
        new EngineProtocolError(
          res.error || {
            code: 'AUTOTRACE_UNKNOWN',
            message: 'Engine call failed without explicit error details',
          }
        )
      );
    }
  }

  private handleWorkerError(event: ErrorEvent) {
    console.error('[EngineClient] Worker internal error:', event);
  }

  async send<TReq, TRes>(operation: EngineOperation, payload: TReq): Promise<TRes> {
    const req = createProtocolRequest(operation, payload);

    return new Promise<TRes>((resolve, reject) => {
      // If global Go WASM function available directly in current thread
      if (typeof globalThis !== 'undefined' && (globalThis as any).businessOSAutoTraceRequest) {
        try {
          const rawResponse = (globalThis as any).businessOSAutoTraceRequest(JSON.stringify(req));
          const res = JSON.parse(rawResponse) as ProtocolResponse<TRes>;
          if (res.ok) {
            resolve(res.value as TRes);
          } else {
            reject(
              new EngineProtocolError(
                res.error || {
                  code: 'AUTOTRACE_EXEC_ERROR',
                  message: 'Execution error in Go core WASM bridge',
                }
              )
            );
          }
          return;
        } catch (err) {
          reject(err);
          return;
        }
      }

      // If Web Worker is available
      if (this.worker) {
        const timer = setTimeout(() => {
          this.pendingRequests.delete(req.requestId);
          reject(
            new EngineProtocolError({
              code: 'AUTOTRACE_TIMEOUT',
              message: `Engine operation ${operation} timed out after ${this.timeoutMs}ms`,
              retryable: true,
            })
          );
        }, this.timeoutMs);

        this.pendingRequests.set(req.requestId, {
          resolve,
          reject,
          timer,
          operation,
        });

        this.worker.postMessage(req);
        return;
      }

      // Fallback: in Node / tests where WASM worker isn't running, emulate or reject
      reject(
        new EngineProtocolError({
          code: 'AUTOTRACE_NO_WORKER',
          message: 'Engine client worker or WASM bridge is not active',
          retryable: true,
        })
      );
    });
  }

  async hello(): Promise<HelloResult> {
    if (this.cachedCapabilities) return this.cachedCapabilities;
    const res = await this.send<{}, HelloResult>('hello', {});
    this.cachedCapabilities = res;
    this.isInitialized = true;
    return res;
  }

  async layout(payload: LayoutRequestPayload): Promise<LayoutResultValue> {
    return this.send<LayoutRequestPayload, LayoutResultValue>('layout', payload);
  }

  async open(payload: SceneOpenPayload): Promise<SceneResult> {
    return this.send<SceneOpenPayload, SceneResult>('scene.open', payload);
  }

  async patch(payload: ScenePatchPayload): Promise<SceneResult> {
    return this.send<ScenePatchPayload, SceneResult>('scene.patch', payload);
  }

  async updateOptions(payload: SceneUpdateOptionsPayload): Promise<SceneResult> {
    return this.send<SceneUpdateOptionsPayload, SceneResult>('scene.update_options', payload);
  }

  async snapshot(graphId: string): Promise<SceneResult> {
    return this.send<{ graphId: string }, SceneResult>('scene.snapshot', { graphId });
  }

  async close(graphId: string): Promise<SceneCloseResult> {
    return this.send<{ graphId: string }, SceneCloseResult>('scene.close', { graphId });
  }

  async optimizeNLP(payload: NLPOptimizePayload): Promise<NLPOptimizationResult> {
    return this.send<NLPOptimizePayload, NLPOptimizationResult>('nlp.optimize', payload);
  }

  async unifiedCoOptimize(payload: UnifiedCoOptimizePayload): Promise<any> {
    return this.send<UnifiedCoOptimizePayload, any>('unified.co_optimize', payload);
  }

  /**
   * Shadow execution method: executes request through TS baseline and Go/Worker concurrently
   * and produces telemetry on timing, parity, and discrepancies.
   */
  async shadowCompare(
    nodes: BlockNode[],
    edges: EdgeConnection[],
    options: RoutingOptions
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
      });
      goDuration = performance.now() - startGo;
      goMetrics = goResult.metrics;

      if (goResult.edges.length !== tsRouted.length) {
        discrepancies.push(`Edge count mismatch: TS=${tsRouted.length} Go=${goResult.edges.length}`);
      }
    } catch (err: any) {
      discrepancies.push(`Go execution error: ${err?.message || String(err)}`);
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

  destroy() {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(
        new EngineProtocolError({
          code: 'AUTOTRACE_CLIENT_DESTROYED',
          message: 'EngineClient was destroyed',
        })
      );
    }
    this.pendingRequests.clear();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
