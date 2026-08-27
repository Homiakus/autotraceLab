import {
  EngineOperation,
  HelloResult,
  ProtocolResponse,
} from '../types';
import { EngineBackend } from './EngineBackend';
import { createProtocolRequest, EngineProtocolError } from '../protocol';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: any;
  cleanupSignal?: () => void;
}

export interface WasmWorkerBackendOptions {
  worker?: Worker;
  workerUrl?: string;
  timeoutMs?: number;
}

export class WasmWorkerBackend implements EngineBackend {
  readonly type = 'wasm-worker' as const;
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private timeoutMs: number;

  constructor(options: WasmWorkerBackendOptions = {}) {
    this.timeoutMs = options.timeoutMs || 10000;

    if (options.worker) {
      this.worker = options.worker;
      this.setupWorker();
    } else if (typeof Worker !== 'undefined') {
      try {
        if (options.workerUrl) {
          this.worker = new Worker(options.workerUrl, { type: 'module' });
        } else {
          // Default module worker path relative to module location
          this.worker = new Worker(new URL('../autotrace.worker.js', import.meta.url), { type: 'module' });
        }
        this.setupWorker();
      } catch (err) {
        console.warn('[WasmWorkerBackend] Failed to construct Worker:', err);
      }
    }
  }

  private setupWorker() {
    if (!this.worker) return;
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = this.handleError.bind(this);
  }

  private handleMessage(event: MessageEvent<ProtocolResponse>) {
    const res = event.data;
    if (!res || !res.requestId) return;

    const pending = this.pendingRequests.get(res.requestId);
    if (!pending) return;

    clearTimeout(pending.timer);
    if (pending.cleanupSignal) pending.cleanupSignal();
    this.pendingRequests.delete(res.requestId);

    if (res.ok) {
      pending.resolve(res.value);
    } else {
      pending.reject(
        new EngineProtocolError(
          res.error || {
            code: 'AUTOTRACE_UNKNOWN',
            message: 'Worker request failed without structured error details',
          }
        )
      );
    }
  }

  private handleError(event: ErrorEvent) {
    console.error('[WasmWorkerBackend] Worker runtime error:', event);
  }

  async hello(): Promise<HelloResult> {
    return this.request<{}, HelloResult>('hello', {});
  }

  async request<TReq, TRes>(operation: EngineOperation, payload: TReq, signal?: AbortSignal): Promise<TRes> {
    if (signal?.aborted) {
      throw new EngineProtocolError({
        code: 'AUTOTRACE_CANCELLED',
        message: 'Operation cancelled by host AbortSignal',
      });
    }

    if (!this.worker) {
      throw new EngineProtocolError({
        code: 'AUTOTRACE_NO_WORKER',
        message: 'Worker is not active or supported in this runtime environment',
        retryable: true,
      });
    }

    const req = createProtocolRequest(operation, payload);

    return new Promise<TRes>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(req.requestId);
        reject(
          new EngineProtocolError({
            code: 'AUTOTRACE_TIMEOUT',
            message: `Engine operation "${operation}" timed out after ${this.timeoutMs}ms`,
            retryable: true,
          })
        );
      }, this.timeoutMs);

      let cleanupSignal: (() => void) | undefined;
      if (signal) {
        const onAbort = () => {
          clearTimeout(timer);
          this.pendingRequests.delete(req.requestId);
          reject(
            new EngineProtocolError({
              code: 'AUTOTRACE_CANCELLED',
              message: `Operation "${operation}" was cancelled by host AbortSignal`,
            })
          );
        };
        signal.addEventListener('abort', onAbort, { once: true });
        cleanupSignal = () => signal.removeEventListener('abort', onAbort);
      }

      this.pendingRequests.set(req.requestId, {
        resolve,
        reject,
        timer,
        cleanupSignal,
      });

      this.worker!.postMessage(req);
    });
  }

  async dispose(): Promise<void> {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer);
      if (pending.cleanupSignal) pending.cleanupSignal();
      pending.reject(
        new EngineProtocolError({
          code: 'AUTOTRACE_CLIENT_DESTROYED',
          message: 'WasmWorkerBackend was disposed',
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
