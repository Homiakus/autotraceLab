/// <reference lib="webworker" />

import { ProtocolRequest, ProtocolResponse } from './types';
import { defaultWasmLoader } from './wasmLoader';

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<ProtocolRequest>) => {
  const req = event.data;
  if (!req || typeof req !== 'object') return;

  try {
    const wasm = await defaultWasmLoader.load();
    if (wasm.isReady) {
      const responseJson = wasm.request(JSON.stringify(req));
      const res = JSON.parse(responseJson) as ProtocolResponse;
      ctx.postMessage(res);
    } else {
      ctx.postMessage({
        protocol: req.protocol || 2,
        requestId: req.requestId,
        ok: false,
        error: {
          code: 'AUTOTRACE_WASM_NOT_READY',
          message: 'Go WASM binary runtime is not initialized in worker',
          retryable: true,
        },
      } as ProtocolResponse);
    }
  } catch (err: any) {
    ctx.postMessage({
      protocol: req.protocol || 2,
      requestId: req.requestId,
      ok: false,
      error: {
        code: 'AUTOTRACE_WORKER_ERROR',
        message: err?.message || String(err),
      },
    } as ProtocolResponse);
  }
};
