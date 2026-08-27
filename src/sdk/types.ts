import { BlockNode, EdgeConnection, RoutingOptions, SceneResult, BenchmarkMetrics } from '../types';
import { RegistryPackage } from '../registry/types';

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface TelemetryAdapter {
  logEvent(event: string, payload: Record<string, unknown>): void;
  logMetric(name: string, value: number, tags?: Record<string, string>): void;
}

export interface AutoTraceSDKConfig {
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
