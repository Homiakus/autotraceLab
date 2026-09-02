import { BlockNode, EdgeConnection, SubcircuitDefinition, Port, PortSide, PortType } from '../types';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface DiagnosticIssue {
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  targetId?: string;
  targetKind?: 'block' | 'port' | 'edge' | 'subcircuit' | 'syntax';
  field?: string;
  line?: number;
  column?: number;
}

export interface ValidationReport {
  valid: boolean;
  errorsCount: number;
  warningsCount: number;
  issues: DiagnosticIssue[];
}

export interface DSLParseResult {
  nodes: BlockNode[];
  edges: EdgeConnection[];
  subcircuits?: Record<string, SubcircuitDefinition>;
  issues: DiagnosticIssue[];
}

export interface DSLSerializeOptions {
  includePositions?: boolean;
  includeDimensions?: boolean;
  indent?: string;
}
