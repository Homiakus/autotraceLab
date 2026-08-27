import {
  CONTRACT_PROTOCOL_VERSION,
  EngineOperation,
  ProtocolRequest,
  ProtocolResponse,
  ProtocolError,
} from './types';

let nextRequestId = 1;

export function generateRequestId(prefix = 'req'): string {
  return `${prefix}_${Date.now()}_${nextRequestId++}`;
}

export function createProtocolRequest<T>(
  operation: EngineOperation,
  payload: T,
  requestId?: string
): ProtocolRequest<T> {
  return {
    protocol: CONTRACT_PROTOCOL_VERSION,
    requestId: requestId || generateRequestId(operation.replace('.', '_')),
    operation,
    payload,
  };
}

export function parseProtocolResponse<T>(raw: string | object): ProtocolResponse<T> {
  const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as ProtocolResponse<T>;

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid protocol response: expected non-null JSON object');
  }

  if (typeof parsed.protocol !== 'number') {
    throw new Error('Invalid protocol response: missing protocol version number');
  }

  if (parsed.protocol !== CONTRACT_PROTOCOL_VERSION) {
    throw new Error(
      `Protocol version mismatch: expected ${CONTRACT_PROTOCOL_VERSION}, got ${parsed.protocol}`
    );
  }

  return parsed;
}

export class EngineProtocolError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(error: ProtocolError) {
    super(`[${error.code}] ${error.message}`);
    this.name = 'EngineProtocolError';
    this.code = error.code;
    this.retryable = Boolean(error.retryable);
    this.details = error.details;
  }
}
