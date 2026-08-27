import { BlockNode, EdgeConnection, RoutingOptions, SceneResult, BenchmarkMetrics } from '../types';
import { RegistryPackage } from '../registry/types';

import { BackendType, EngineBackend } from '../engine/backend/EngineBackend';

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface TelemetryAdapter {
  logEvent(event: string, payload: Record<string, unknown>): void;
  logMetric(name: string, value: number, tags?: Record<string, string>): void;
}

export interface SceneOpenInput {
  id?: string;
  graphId?: string;
  nodes: BlockNode[];
  edges: EdgeConnection[];
  options?: Partial<RoutingOptions>;
  revision?: number;
}

export interface AutoTraceSDKConfig {
  backend?: BackendType | EngineBackend;
  worker?: Worker;
  workerUrl?: string;
  storage?: StorageAdapter;
  telemetry?: TelemetryAdapter;
  packages?: RegistryPackage[];
  defaultOptions?: Partial<RoutingOptions>;
}

export interface AutoTraceSession {
  graphId: string;
  revision: number;
  nodes: BlockNode[];
  edges: EdgeConnection[];
  metrics?: BenchmarkMetrics;
}
