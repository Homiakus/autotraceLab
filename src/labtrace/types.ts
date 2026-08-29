import type { BlockNode, EdgeConnection } from '../types';

export type LabTraceSceneLevel = 'overview' | 'system' | 'process' | 'operation';

/**
 * Declarative contract for a progressively disclosed diagram.
 * A host starts at the overview and opens a child scene through its owner node.
 */
export interface LabTraceProgressiveScene<TMetadata = Record<string, unknown>> {
  id: string;
  title: string;
  level: LabTraceSceneLevel;
  nodes: BlockNode[];
  edges: EdgeConnection[];
  children?: Record<string, LabTraceProgressiveScene<TMetadata>>;
  metadata?: TMetadata;
}

export interface LabTraceWorkbenchControls {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
}
