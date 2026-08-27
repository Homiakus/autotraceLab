import { RegistryPackage, ShapeDefinition, BlockTypeDefinition, EdgeTypeDefinition } from './types';

export const BUILTIN_SHAPES: ShapeDefinition[] = [
  { id: 'core/shape/rectangle', name: 'Rectangle', baseShape: 'rectangle', status: 'published', version: '1.0.0' },
  { id: 'core/shape/rounded', name: 'Rounded Rectangle', baseShape: 'rounded', cornerRadius: 8, status: 'published', version: '1.0.0' },
  { id: 'core/shape/chip_ic', name: 'Chip IC Package', baseShape: 'chip_ic', status: 'published', version: '1.0.0' },
  { id: 'core/shape/circle', name: 'Circle', baseShape: 'circle', status: 'published', version: '1.0.0' },
  { id: 'core/shape/diamond', name: 'Diamond Decision', baseShape: 'diamond', status: 'published', version: '1.0.0' },
  { id: 'core/shape/hexagon', name: 'Hexagon', baseShape: 'hexagon', status: 'published', version: '1.0.0' },
];

export const BUILTIN_BLOCK_TYPES: BlockTypeDefinition[] = [
  {
    id: 'core/block/process',
    name: 'Process Block',
    category: 'processor',
    status: 'published',
    version: '1.0.0',
    shapeId: 'core/shape/rectangle',
    defaultWidth: 140,
    defaultHeight: 60,
    minWidth: 80,
    minHeight: 40,
    headerColor: '#3b82f6',
    bodyColor: '#1e293b',
    borderColor: '#64748b',
    ports: [
      { id: 'in', name: 'In', type: 'input', preferredSide: 'left', relativePosition: 0.5 },
      { id: 'out', name: 'Out', type: 'output', preferredSide: 'right', relativePosition: 0.5 },
    ],
  },
  {
    id: 'core/block/sensor',
    name: 'Sensor Source',
    category: 'source',
    status: 'published',
    version: '1.0.0',
    shapeId: 'core/shape/rounded',
    defaultWidth: 120,
    defaultHeight: 60,
    minWidth: 80,
    minHeight: 40,
    headerColor: '#10b981',
    bodyColor: '#064e3b',
    ports: [
      { id: 'data', name: 'Data', type: 'output', preferredSide: 'right', relativePosition: 0.5 },
    ],
  },
  {
    id: 'core/block/chip_ic',
    name: 'Dual Inline IC',
    category: 'processor',
    status: 'published',
    version: '1.0.0',
    shapeId: 'core/shape/chip_ic',
    defaultWidth: 180,
    defaultHeight: 120,
    minWidth: 100,
    minHeight: 60,
    bodyColor: '#0f172a',
    borderColor: '#94a3b8',
    ports: [
      { id: 'p1', name: 'VCC', type: 'input', preferredSide: 'left', relativePosition: 0.2 },
      { id: 'p2', name: 'GND', type: 'input', preferredSide: 'left', relativePosition: 0.8 },
      { id: 'p3', name: 'CLK', type: 'input', preferredSide: 'right', relativePosition: 0.2 },
      { id: 'p4', name: 'OUT', type: 'output', preferredSide: 'right', relativePosition: 0.8 },
    ],
  },
];

export const BUILTIN_EDGE_TYPES: EdgeTypeDefinition[] = [
  {
    id: 'core/edge/signal',
    name: 'Signal Wire',
    status: 'published',
    version: '1.0.0',
    color: '#38bdf8',
    strokeWidth: 2,
    arrowHead: 'arrow',
  },
  {
    id: 'core/edge/bus',
    name: 'Data Bus',
    status: 'published',
    version: '1.0.0',
    color: '#a855f7',
    strokeWidth: 3.5,
    arrowHead: 'arrow',
  },
];

export const DEFAULT_BUILTIN_PACKAGE: RegistryPackage = {
  id: 'core/package/builtin',
  name: 'AutoTrace Core Builtins',
  version: '1.0.0',
  author: 'AutoTrace Team',
  description: 'Standard declarative blocks, shapes, and connections',
  shapes: BUILTIN_SHAPES,
  blockTypes: BUILTIN_BLOCK_TYPES,
  edgeTypes: BUILTIN_EDGE_TYPES,
};
