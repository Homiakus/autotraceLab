import {
  EngineOperation,
  HelloResult,
  ProtocolRequest,
  ProtocolResponse,
} from '../types';
import { EngineBackend } from './EngineBackend';
import { createProtocolRequest, EngineProtocolError } from '../protocol';

export class DirectWasmBackend implements EngineBackend {
  readonly type = 'direct-wasm' as const;

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

    const bridge = (globalThis as any).businessOSAutoTraceRequest;
    if (typeof bridge !== 'function') {
      throw new EngineProtocolError({
        code: 'AUTOTRACE_WASM_NOT_READY',
        message: 'Direct Go WASM bridge is not initialized in global context',
      });
    }

    const req = createProtocolRequest(operation, payload);
    const rawRes = bridge(JSON.stringify(req));
    const parsed = JSON.parse(rawRes) as ProtocolResponse<TRes>;

    if (!parsed.ok) {
      throw new EngineProtocolError(
        parsed.error || {
          code: 'AUTOTRACE_UNKNOWN',
          message: 'Direct WASM request failed without structured error',
        }
      );
    }

    return parsed.value as TRes;
  }

  async dispose(): Promise<void> {}
}
