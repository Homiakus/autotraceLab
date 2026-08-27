import {
  EngineOperation,
  HelloResult,
  ProtocolRequest,
} from '../types';

export type BackendType = 'wasm-worker' | 'direct-wasm' | 'typescript' | 'auto';

export interface EngineBackend {
  readonly type: BackendType;
  hello(): Promise<HelloResult>;
  request<TReq, TRes>(operation: EngineOperation, payload: TReq, signal?: AbortSignal): Promise<TRes>;
  dispose(): Promise<void>;
}
