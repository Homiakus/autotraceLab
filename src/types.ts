export type PortType = 'input' | 'output' | 'inout' | 'passive';
export type PortSide = 'left' | 'right' | 'top' | 'bottom';
export type PortDataType =
  | 'signal'
  | 'bus'
  | 'clock'
  | 'power'
  | 'control'
  | 'trigger'
  | 'data'
  | 'analog'
  | 'ground'
  | 'network'
  | 'mechanical'
  | 'custom'
  | string;

export type PortPlacementMode = 'fixed' | 'adaptive';

export interface Port {
  id: string;
  name: string;
  type: PortType; // 'input' | 'output' | 'inout' | 'passive'
  dataType?: PortDataType;
  side?: PortSide;
  placementMode?: PortPlacementMode; // 'fixed' = locked position/side; 'adaptive' = dynamically auto-spaced or face-assigned
  relativePosition?: number; // 0.0 to 1.0 along the side edge
  customOffset?: number; // Optional absolute pixel offset from edge origin
  pinNumber?: number; // Pin index for IC packages / connectors (e.g. Pin 1..16)
  preferredSide?: PortSide; // Preferred face when adaptive_faces is active
  allowedSides?: PortSide[]; // Set of permitted faces (e.g. ['left', 'right'])
  order?: number; // Explicit deterministic ordering index
  groupId?: string; // Port group ID (e.g. 'SPI', 'I2C') to keep bus pins together
  color?: string; // Custom pin contact color override
  description?: string;
  minSpacing?: number; // Minimum clearance spacing in px
}

export interface PortCoordinates {
  x: number;
  y: number;
  normal: { dx: number; dy: number };
  side: PortSide;
  port: Port;
}

export type BlockShape = 'rectangle' | 'rounded' | 'chip_ic' | 'circle' | 'diamond' | 'hexagon';
export type ImageFitMode = 'contain' | 'cover' | 'fill';

export interface BlockNode {
  id: string;
  title: string;
  category: 'source' | 'processor' | 'sink' | 'logic' | 'storage' | 'custom';
  semanticType?: string; // Semantic module type (e.g., 'STM32', 'NPU', 'Sensor')
  description?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  inputs: Port[];
  outputs: Port[];
  color?: string;
  layer?: number;
  order?: number;
  subtitle?: string;
  isPinned?: boolean; // When true, coordinates are strictly frozen during optimization
  
  // Auto-sizing configuration
  autoSize?: boolean; // Default true: Automatically resize block to fit contents and ports
  minWidth?: number; // Calculated or user minimum width
  minHeight?: number; // Calculated or user minimum height
  
  // Visual Customization
  imageUrl?: string; // Direct image URL or base64 data URI
  imageFit?: ImageFitMode; // Scaling mode ('contain' | 'cover' | 'fill')
  imageOpacity?: number; // Image opacity (0.1 to 1.0)
  showTitleOverlay?: boolean; // Show title bar overlay on top of image
  shape?: BlockShape; // Visual geometry ('rounded' | 'rectangle' | 'chip_ic' | 'circle' | 'diamond' | 'hexagon')
  iconName?: string; // Optional vector icon identifier
  portsAdaptiveMode?: 'manual' | 'auto_distribute' | 'auto_faces'; // Block-level port policy
  
  // Routing constraints
  routingClearance?: number; // Clearance around block routing envelope
  preferredFlow?: 'left-to-right' | 'top-to-bottom' | 'bidirectional';

  // Hierarchical Subcircuits (Подсхемы и надсхемы)
  isSubcircuit?: boolean; // When true, block represents an encapsulated subcircuit
  subcircuitId?: string; // ID of the referenced SubcircuitDefinition
  subcircuitSummary?: string; // Short summary of internal components
}

export interface ExternalPortBinding {
  id: string; // Port ID on parent subcircuit block
  name: string; // Display label
  type: PortType; // 'input' | 'output' | 'inout'
  dataType?: PortDataType;
  side: PortSide; // Which side of the parent block this port appears on
  internalNodeId: string; // ID of the target block inside the subcircuit
  internalPortId: string; // ID of the port on the internal block
  description?: string;
}

export interface SubcircuitDefinition {
  id: string;
  name: string;
  description?: string;
  category?: 'logic' | 'processor' | 'storage' | 'custom' | 'io';
  nodes: BlockNode[];
  edges: EdgeConnection[];
  externalInputs: ExternalPortBinding[];
  externalOutputs: ExternalPortBinding[];
  createdTimestamp?: number;
  lastModifiedTimestamp?: number;
}

export interface HierarchyBreadcrumb {
  subcircuitId: string | null; // null represents Root circuit
  name: string;
  parentNodeId?: string; // Node ID in parent circuit that links to this subcircuit
}


export interface DerivedBlockGeometry {
  blockId: string;
  visualBounds: { x: number; y: number; width: number; height: number };
  routingBounds: { minX: number; maxX: number; minY: number; maxY: number };
  obstacleBounds: { minX: number; maxX: number; minY: number; maxY: number };
  headerBounds: { x: number; y: number; width: number; height: number };
  contentBounds: { x: number; y: number; width: number; height: number };
  portAnchors: PortCoordinates[];
  minWidth: number;
  minHeight: number;
  valid: boolean;
  violations: string[];
}

export interface EdgeConnection {
  id: string;
  sourceBlockId: string;
  sourcePortId: string;
  targetBlockId: string;
  targetPortId: string;
  color?: string;
  label?: string;
  path?: Point[];
  dataType?: string;
  bends?: number;
  crossings?: number;
  length?: number;
}

export interface Point {
  x: number;
  y: number;
}

export type LayoutAlgorithmType = 'sugiyama' | 'force_directed' | 'orthogonal_grid' | 'manual';
export type RoutingAlgorithmType = 'orthogonal_astar' | 'lee_wave' | 'manhattan_channel' | 'smooth_spline';

export interface OptimizationWeights {
  crossingWeight: number; // 0..100 - Top Priority #1: Zero crossings & overlaps
  straightnessWeight: number; // 0..100 - Priority #2: Direct straight laser segments
  g1SplineWeight: number; // 0..100 - G1 Tangent-continuous spline rounding at ends/corners
  portAlignmentWeight: number; // 0..100 - Co-axial port alignment
  clearanceWeight: number; // 0..100 - Obstacle clearance & collision avoidance
  wirelengthWeight: number; // 0..100 - Secondary: Total wirelength (HPWL)
  bendWeight: number; // 0..100 - Secondary: Extra bend penalty
  labelOverlapWeight: number; // 0..100 - Label text overlap minimization
}

export type WeightPresetId = 'zero_crossings_straight' | 'compact_eda' | 'balanced' | 'organic_g1' | 'custom';

export interface WeightPreset {
  id: WeightPresetId;
  name: string;
  description: string;
  weights: OptimizationWeights;
}

export interface QualityVector {
  hardViolations: number; // Must be 0 for valid diagram
  crossings: number;
  collinearOverlapCount: number; // Must be 0
  collinearOverlapLength: number; // Must be 0
  congestionOverflow: number;
  bends: number;
  straightWiresCount: number;
  straightEdgeRatio: number; // 0 to 1
  portMisalignmentScore: number; // Lower is better
  portAlignmentScore: number; // 0 to 100%
  areaRatio: number; // Bounding box vs block area
  densityDeviation: number;
  voidRatio: number;
  aspectPenalty: number;
  normalizedWirelength: number;
  labelCollisions: number; // Must be 0
  labelsOnArrowPercentage: number; // Target: 100%
  compositeScore: number; // 0 to 100
}

export interface BenchmarkMetrics {
  algorithmName: string;
  routingName: string;
  executionTimeMs: number;
  totalWirelength: number;
  bendCount: number;
  crossingsCount: number;
  overlapCount: number;
  collinearOverlapLength?: number; // Total length of illegal collinear overlapping wire segments in px (Must be 0)
  collinearOverlapCount?: number; // Number of overlapping collinear wire segments (Must be 0)
  labelsOnArrowPercentage?: number; // % of labels strictly residing directly ON their own arrow (Target: 100%)
  portAlignmentScore: number; // 0 to 100%
  straightWiresCount?: number;
  eliminatedArtifactsCount?: number;
  compositeOptimalityScore?: number; // 0 to 100 based on weighted Pareto function
  qualityVector?: QualityVector;
}

export interface NLPOptimizationParams {
  optimalBlockDistance: number; // D_opt: Target spacing between connected blocks (e.g. 200px)
  optimalWireDistance: number; // S_opt: Target clearance between parallel wires/channels (e.g. 20px)
  wirelengthWeight: number; // Weight for total wirelength minimization
  wirelengthVarianceWeight: number; // Weight for individual wirelength variance minimization
  blockRepulsionWeight: number; // Barrier penalty for block-to-block overlap
  wireSpacingWeight: number; // Barrier penalty for parallel wire congestion
  strictLabelClearanceWeight: number; // Strict barrier penalty for label collisions
  portAlignmentWeight: number; // Weight for direct co-axial pin alignment
  learningRate: number; // Step size for projected gradient descent (e.g. 0.05)
  iterations: number; // Max optimization iterations (e.g. 80)
  momentum: number; // Gradient momentum factor (e.g. 0.85)
  freezePinnedNodes: boolean; // Keep pinned nodes strictly stationary during NLP solver
}

export interface NLPOptimalityBreakdown {
  totalWirelength: number;
  averageWirelength: number;
  maxIndividualWirelength: number;
  wirelengthVariance: number;
  blockDistanceDeviation: number; // Mean absolute deviation from D_opt
  wireDistanceViolationCount: number; // Number of wires closer than S_opt
  collinearWireOverlapLength: number; // Total overlapping collinear length (Must be 0)
  collinearWireOverlapCount: number; // Number of collinear coincidences (Must be 0)
  labelsOnArrowCount: number; // Number of labels residing directly on their arrow
  labelsOffArrowCount: number; // Number of labels off arrow (Critical violation)
  labelsOffArrowPenalty: number; // Max penalty for off-arrow labels
  labelCollisionsCount: number; // Strict 0 collision condition
  portAlignmentDeviation: number;
  overallCostValue: number; // Total multi-objective loss Φ(X)
}

export interface RoutingOptions {
  gridSize: number;
  obstacleClearance: number;
  bendPenalty: number;
  crossingPenalty: number;
  channelSpacing: number;
  portExitOffset: number;
  adaptivePortExitOffset?: boolean; // Dynamically scale and stagger port exit/entry stubs
  smoothCorners: boolean;
  cornerRadius?: number; // 0 to 24px corner fillet radius
  adaptiveCornerRadius?: boolean; // Dynamically scale fillet radius based on adjacent segment lengths
  labelClearance?: number; // Strict minimum distance between edge labels and blocks/wires
  strictLabels?: boolean; // Enforce strict 0-collision guarantee for arrow labels
  minWireDistance?: number; // Minimum clearance between parallel wire traces
  optimalBlockDistance?: number; // D_opt: optimal non-linear separation between blocks
  optimalWireDistance?: number; // S_opt: optimal channel separation between wires
  jumpBridges: boolean;
  pinAlignment?: boolean;
  artifactCleaning?: boolean;
  weights: OptimizationWeights;
  nlpParams?: NLPOptimizationParams;
}

export interface AlgorithmStep {
  stepIndex: number;
  title: string;
  description: string;
  phase: string;
  nodesSnapshot: BlockNode[];
  edgesSnapshot: EdgeConnection[];
  debugWaveGrid?: { x: number; y: number; val: number; type: 'wall' | 'wave' | 'path' | 'start' | 'end' }[];
  highlightedNodes?: string[];
  highlightedEdges?: string[];
}

export interface Scene {
  revision: number;
  nodes: BlockNode[];
  edges: EdgeConnection[];
  geometries: DerivedBlockGeometry[];
  metrics: BenchmarkMetrics;
}

export interface ScenePatch {
  baseRevision: number;
  revision: number;
  changedBlocks: BlockNode[];
  changedEdges: EdgeConnection[];
  removedBlockIds?: string[];
  removedEdgeIds?: string[];
}

export interface SceneResult {
  graphId: string;
  revision: number;
  nodes: BlockNode[];
  edges: EdgeConnection[];
  metrics: BenchmarkMetrics;
  durationMs: number;
  reusedEdges: number;
  reroutedEdges: number;
  reroutedEdgeIds?: string[];
  engine: string;
  contractVersion: number;
}

export const DEFAULT_OPTIMIZATION_WEIGHTS: OptimizationWeights = {
  crossingWeight: 95.0,
  straightnessWeight: 90.0,
  g1SplineWeight: 65.0,
  portAlignmentWeight: 80.0,
  clearanceWeight: 90.0,
  wirelengthWeight: 15.0,
  bendWeight: 25.0,
  labelOverlapWeight: 75.0,
};

export const DEFAULT_ROUTING_OPTIONS: RoutingOptions = {
  gridSize: 10.0,
  obstacleClearance: 10.0,
  bendPenalty: 35.0,
  crossingPenalty: 50.0,
  channelSpacing: 16.0,
  portExitOffset: 24.0,
  adaptivePortExitOffset: true,
  smoothCorners: false,
  cornerRadius: 8.0,
  adaptiveCornerRadius: true,
  labelClearance: 8.0,
  strictLabels: true,
  minWireDistance: 16.0,
  optimalBlockDistance: 200.0,
  optimalWireDistance: 20.0,
  jumpBridges: false,
  pinAlignment: true,
  artifactCleaning: true,
  weights: DEFAULT_OPTIMIZATION_WEIGHTS,
};


