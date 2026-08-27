import {
  BlockNode,
  EdgeConnection,
  RoutingOptions,
  BenchmarkMetrics,
  ScenePatch,
  SceneResult,
  NLPOptimizationParams,
} from '../types';
import { NLPOptimizationResult } from '../algorithms/nlpOptimizer';

export const CONTRACT_PROTOCOL_VERSION = 2;

export type EngineOperation =
  | 'hello'
  | 'layout'
  | 'scene.open'
  | 'scene.patch'
  | 'scene.update_options'
  | 'scene.snapshot'
  | 'scene.close'
  | 'nlp.optimize'
  | 'unified.co_optimize';

export interface ProtocolError {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export interface ProtocolRequest<T = unknown> {
  protocol: number;
  requestId: string;
  operation: EngineOperation;
  payload: T;
}

export interface ProtocolResponse<T = unknown> {
  protocol: number;
  requestId?: string;
  ok: boolean;
  value?: T;
  error?: ProtocolError;
}

export interface EngineCapabilities {
  runtime: string;
  protocolVersion: number;
  importableCore: boolean;
  orthogonalRouting: boolean;
  metrics: boolean;
  labels: boolean;
  incrementalScenes: boolean;
  scenePatch: boolean;
  strictRevisions: boolean;
  nlpOptimization: boolean;
  bridgeJumps: boolean;
  g1Splines: boolean;
  unifiedCoOpt: boolean;
}

export interface HelloResult {
  service: string;
  engine: string;
  capabilities: EngineCapabilities;
}

export interface LayoutRequestPayload {
  graphId?: string;
  nodes: BlockNode[];
  edges: EdgeConnection[];
  options?: RoutingOptions;
}

export interface LayoutResultValue {
  graphId: string;
  edges: EdgeConnection[];
  metrics: BenchmarkMetrics;
  durationMs: float64;
  engine: string;
  protocol: number;
  contractVersion: number;
}

type float64 = number;

export interface SceneOpenPayload {
  graphId: string;
  revision: number;
  nodes: BlockNode[];
  edges: EdgeConnection[];
  options: RoutingOptions;
}

export interface ScenePatchPayload {
  graphId: string;
  patch: ScenePatch;
}

export interface SceneUpdateOptionsPayload {
  graphId: string;
  options: RoutingOptions;
}

export interface SceneRefPayload {
  graphId: string;
}

export interface SceneCloseResult {
  graphId: string;
  closed: boolean;
}

export interface NLPOptimizePayload {
  nodes: BlockNode[];
  edges: EdgeConnection[];
  options: RoutingOptions;
  params?: Partial<NLPOptimizationParams>;
}

export interface UnifiedCoOptimizePayload {
  nodes: BlockNode[];
  edges: EdgeConnection[];
  options: RoutingOptions;
}

export interface ShadowComparisonReport {
  graphId: string;
  matched: boolean;
  tsDurationMs: number;
  goDurationMs: number;
  speedupRatio: number;
  tsMetrics?: BenchmarkMetrics;
  goMetrics?: BenchmarkMetrics;
  discrepancies: string[];
}
