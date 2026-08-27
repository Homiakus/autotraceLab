import fs from 'fs';
import path from 'path';
import {
  calculateMinimumBlockSize,
  buildDerivedBlockGeometry,
  getPortCoordinatesAccurate,
  sortPortsDeterministically,
  findDeterministicFreeSlot,
} from '../src/algorithms/blockGeometry';
import { cleanOrthogonalArtifacts, ObstacleBox } from '../src/algorithms/wireArtifactCleaner';
import { routeOrthogonalAStar } from '../src/algorithms/orthogonalAStarRouter';
import { computeOptimizedLabels } from '../src/algorithms/labelLayout';
import { calculateBenchmarkMetrics, detectCollinearOverlaps } from '../src/algorithms/metrics';
import {
  calculateNLPOptimalityBreakdown,
  runNLPOptimization,
  DEFAULT_NLP_PARAMS,
} from '../src/algorithms/nlpOptimizer';
import { BlockNode, EdgeConnection, Point, Port, RoutingOptions } from '../src/types';

const TESTDATA_DIR = path.resolve(process.cwd(), 'testdata', 'parity');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeFixture(subpath: string, data: any) {
  const fullPath = path.join(TESTDATA_DIR, subpath);
  ensureDir(path.dirname(fullPath));
  const fixture = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    generator: 'scripts/exportParityFixtures.ts (TS Oracle)',
    oracleCommit: '371cbc0935c3168babb58c755cae17bb76860dff',
    ...data,
  };
  fs.writeFileSync(fullPath, JSON.stringify(fixture, null, 2), 'utf-8');
  console.log(`✅ Exported: ${path.relative(process.cwd(), fullPath)}`);
}

// 1. Geometry Fixtures
function exportGeometryFixtures() {
  const shapes: Array<BlockNode['shape']> = [
    'rectangle',
    'rounded',
    'chip_ic',
    'circle',
    'diamond',
    'hexagon',
  ];

  const sizingCases = shapes.map((shape) => {
    const ports: Port[] = [
      { id: 'p1', name: 'In1', side: 'left', type: 'input', order: 0 },
      { id: 'p2', name: 'In2', side: 'left', type: 'input', order: 1 },
      { id: 'p3', name: 'In3', side: 'left', type: 'input', order: 2 },
      { id: 'p4', name: 'Out1', side: 'right', type: 'output', order: 0 },
      { id: 'p5', name: 'Out2', side: 'right', type: 'output', order: 1 },
    ];
    const node: BlockNode = {
      id: `node_${shape}`,
      title: `Node ${shape}`,
      subtitle: 'Processor Unit',
      category: 'processor',
      shape,
      x: 100,
      y: 100,
      width: 140,
      height: 80,
      inputs: ports.filter((p) => p.side === 'left'),
      outputs: ports.filter((p) => p.side === 'right'),
    };

    const minSize = calculateMinimumBlockSize(node);
    const derived = buildDerivedBlockGeometry({ ...node, width: minSize.minWidth, height: minSize.minHeight });

    const portCoords = ports.map((p) => {
      const coord = getPortCoordinatesAccurate({ ...node, width: minSize.minWidth, height: minSize.minHeight }, p.id);
      return {
        portId: p.id,
        side: p.side,
        point: { x: coord.x, y: coord.y },
      };
    });

    return {
      shape,
      inputNode: node,
      expectedMinSize: minSize,
      derivedGeometry: {
        visualBounds: derived.visualBounds,
        obstacleBounds: derived.obstacleBounds,
        contentBounds: derived.contentBounds,
        headerBounds: derived.headerBounds,
        portAnchors: derived.portAnchors,
      },
      portCoordinates: portCoords,
    };
  });

  writeFixture('geometry/sizing_and_derived.json', { testCases: sizingCases });

  // Free slot test
  const existingNodes: BlockNode[] = [
    { id: 'n1', title: 'N1', category: 'processor', shape: 'rectangle', x: 100, y: 100, width: 120, height: 72, inputs: [], outputs: [] },
    { id: 'n2', title: 'N2', category: 'processor', shape: 'rectangle', x: 250, y: 100, width: 120, height: 72, inputs: [], outputs: [] },
  ];
  const slot = findDeterministicFreeSlot(existingNodes, 120, 72, 20, 40);
  writeFixture('geometry/free_slot.json', {
    existingNodes,
    requestedSize: { width: 120, height: 72 },
    expectedSlot: slot,
  });
}

// 2. Wire Cleaner Fixtures
function exportCleanerFixtures() {
  const sPos = {
    x: 50,
    y: 100,
    normal: { dx: -1, dy: 0 },
    side: 'left' as const,
    port: { id: 'p_src', name: 'src', side: 'left' as const, type: 'output' as const },
  };
  const tPos = {
    x: 200,
    y: 200,
    normal: { dx: 1, dy: 0 },
    side: 'right' as const,
    port: { id: 'p_tgt', name: 'tgt', side: 'right' as const, type: 'input' as const },
  };

  const testCases = [
    {
      name: 'collinear_merge_and_redundant',
      rawPoints: [
        { x: 50, y: 100 },
        { x: 80, y: 100 },
        { x: 120, y: 100 },
        { x: 120, y: 150 },
        { x: 120, y: 200 },
        { x: 200, y: 200 },
      ],
      expectedCleaned: cleanOrthogonalArtifacts(
        [
          { x: 50, y: 100 },
          { x: 80, y: 100 },
          { x: 120, y: 100 },
          { x: 120, y: 150 },
          { x: 120, y: 200 },
          { x: 200, y: 200 },
        ],
        sPos,
        tPos,
        []
      ),
    },
    {
      name: 'u_turn_simplification',
      rawPoints: [
        { x: 50, y: 100 },
        { x: 100, y: 100 },
        { x: 100, y: 150 },
        { x: 80, y: 150 },
        { x: 80, y: 250 },
        { x: 200, y: 250 },
      ],
      expectedCleaned: cleanOrthogonalArtifacts(
        [
          { x: 50, y: 100 },
          { x: 100, y: 100 },
          { x: 100, y: 150 },
          { x: 80, y: 150 },
          { x: 80, y: 250 },
          { x: 200, y: 250 },
        ],
        sPos,
        { ...tPos, y: 250 },
        []
      ),
    },
  ];

  writeFixture('cleaner/cleaner_cases.json', { testCases });
}

// 3. Router A* Fixtures
function exportRouterFixtures() {
  const nodes: BlockNode[] = [
    {
      id: 'srcNode',
      title: 'Source',
      category: 'source',
      shape: 'rectangle',
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      inputs: [],
      outputs: [{ id: 'p_out', name: 'Out', side: 'right', type: 'output', order: 0 }],
    },
    {
      id: 'obstacleNode',
      title: 'Obstacle',
      category: 'processor',
      shape: 'rectangle',
      x: 260,
      y: 80,
      width: 80,
      height: 120,
      inputs: [],
      outputs: [],
    },
    {
      id: 'tgtNode',
      title: 'Target',
      category: 'sink',
      shape: 'rectangle',
      x: 400,
      y: 100,
      width: 120,
      height: 80,
      inputs: [{ id: 'p_in', name: 'In', side: 'left', type: 'input', order: 0 }],
      outputs: [],
    },
  ];

  const edge: EdgeConnection = {
    id: 'e1',
    sourceBlockId: 'srcNode',
    sourcePortId: 'p_out',
    targetBlockId: 'tgtNode',
    targetPortId: 'p_in',
  };

  const options: RoutingOptions = {
    gridSize: 10,
    obstacleClearance: 10,
    bendPenalty: 35,
    crossingPenalty: 50,
    channelSpacing: 16,
    portExitOffset: 24,
    adaptivePortExitOffset: true,
    smoothCorners: false,
    jumpBridges: false,
    artifactCleaning: true,
    weights: {
      crossingWeight: 95,
      straightnessWeight: 90,
      g1SplineWeight: 65,
      portAlignmentWeight: 80,
      clearanceWeight: 90,
      wirelengthWeight: 15,
      bendWeight: 25,
      labelOverlapWeight: 75,
    },
  };

  const routedEdges = routeOrthogonalAStar(nodes, [edge], options);

  writeFixture('router_astar/obstacle_detour.json', {
    nodes,
    edges: [edge],
    options,
    expectedPath: routedEdges[0]?.path || [],
  });
}

// 4. Label Layout Fixtures
function exportLabelFixtures() {
  const edges: EdgeConnection[] = [
    {
      id: 'e1',
      sourceBlockId: 'n1',
      sourcePortId: 'p1',
      targetBlockId: 'n2',
      targetPortId: 'p2',
      label: 'Signal Alpha',
      path: [
        { x: 100, y: 100 },
        { x: 250, y: 100 },
        { x: 250, y: 200 },
        { x: 400, y: 200 },
      ],
    },
  ];
  const nodes: BlockNode[] = [
    {
      id: 'obs',
      title: 'Blocker',
      category: 'processor',
      shape: 'rectangle',
      x: 150,
      y: 80,
      width: 60,
      height: 40,
      inputs: [],
      outputs: [],
    },
  ];

  const labelPositions = Array.from(computeOptimizedLabels(nodes, edges, new Map(), 10).entries()).map(([k, v]) => ({
    edgeId: k,
    position: v,
  }));
  writeFixture('labels/label_positions.json', {
    edges,
    nodes,
    expectedLabels: labelPositions,
  });
}

// 5. Metrics Fixtures
function exportMetricsFixtures() {
  const nodes: BlockNode[] = [
    { id: 'n1', title: 'N1', category: 'source', shape: 'rectangle', x: 50, y: 50, width: 100, height: 60, inputs: [], outputs: [] },
    { id: 'n2', title: 'N2', category: 'sink', shape: 'rectangle', x: 300, y: 50, width: 100, height: 60, inputs: [], outputs: [] },
  ];
  const edges: EdgeConnection[] = [
    {
      id: 'e1',
      sourceBlockId: 'n1',
      sourcePortId: 'out',
      targetBlockId: 'n2',
      targetPortId: 'in',
      path: [
        { x: 150, y: 80 },
        { x: 300, y: 80 },
      ],
    },
    {
      id: 'e2',
      sourceBlockId: 'n1',
      sourcePortId: 'out',
      targetBlockId: 'n2',
      targetPortId: 'in',
      path: [
        { x: 200, y: 30 },
        { x: 200, y: 150 },
      ],
    },
  ];

  const metrics = calculateBenchmarkMetrics(nodes, edges, 0.05, 'manual', 'orthogonal-astar');
  const collinear = detectCollinearOverlaps(edges);

  writeFixture('metrics/canonical_metrics.json', {
    nodes,
    edges,
    expectedMetrics: metrics,
    expectedCollinear: collinear,
  });
}

// 6. NLP Optimization Fixtures
function exportNLPFixtures() {
  const nodes: BlockNode[] = [
    {
      id: 'n1',
      title: 'Controller',
      category: 'processor',
      shape: 'rectangle',
      x: 100,
      y: 100,
      width: 140,
      height: 70,
      isPinned: true,
      inputs: [],
      outputs: [
        { id: 'out1', name: 'Out1', side: 'right', type: 'output' },
        { id: 'out2', name: 'Out2', side: 'right', type: 'output' },
      ],
    },
    {
      id: 'n2',
      title: 'Actuator',
      category: 'sink',
      shape: 'rectangle',
      x: 500,
      y: 120,
      width: 140,
      height: 70,
      inputs: [
        { id: 'in1', name: 'In1', side: 'left', type: 'input' },
      ],
      outputs: [],
    },
    {
      id: 'n3',
      title: 'Telemetry',
      category: 'sink',
      shape: 'rectangle',
      x: 480,
      y: 350,
      width: 140,
      height: 70,
      inputs: [
        { id: 'in2', name: 'In2', side: 'left', type: 'input' },
      ],
      outputs: [],
    },
  ];

  const edges: EdgeConnection[] = [
    {
      id: 'e1',
      sourceBlockId: 'n1',
      sourcePortId: 'out1',
      targetBlockId: 'n2',
      targetPortId: 'in1',
      label: 'Control Cmd',
      path: [
        { x: 240, y: 135 },
        { x: 500, y: 135 },
      ],
    },
    {
      id: 'e2',
      sourceBlockId: 'n1',
      sourcePortId: 'out2',
      targetBlockId: 'n3',
      targetPortId: 'in2',
      label: 'Telemetry Pulse',
      path: [
        { x: 240, y: 155 },
        { x: 360, y: 155 },
        { x: 360, y: 385 },
        { x: 480, y: 385 },
      ],
    },
  ];

  const params = { ...DEFAULT_NLP_PARAMS };
  const initialBreakdown = calculateNLPOptimalityBreakdown(nodes, edges, params);

  const options: RoutingOptions = {
    gridSize: 10,
    obstacleClearance: 10,
    bendPenalty: 35,
    crossingPenalty: 50,
    channelSpacing: 16,
    portExitOffset: 24,
    adaptivePortExitOffset: true,
    smoothCorners: false,
    labelClearance: 8,
    strictLabels: true,
    minWireDistance: 16,
    optimalBlockDistance: 220,
    optimalWireDistance: 24,
    jumpBridges: false,
    weights: {
      crossingWeight: 95,
      straightnessWeight: 90,
      g1SplineWeight: 65,
      portAlignmentWeight: 80,
      clearanceWeight: 90,
      wirelengthWeight: 15,
      bendWeight: 25,
      labelOverlapWeight: 75,
    },
  };

  const nlpResult = runNLPOptimization(nodes, edges, options, { iterations: 30 });

  writeFixture('nlp/nlp_cases.json', {
    inputNodes: nodes,
    inputEdges: edges,
    params,
    expectedInitialBreakdown: initialBreakdown,
    expectedFinalBreakdown: nlpResult.finalBreakdown,
    expectedImprovement: nlpResult.improvementPercentage,
    pinnedNodeIds: nlpResult.pinnedNodeIds,
    iterationsRun: 30,
    historySnapshotsCount: nlpResult.history.length,
  });
}

console.log('🚀 Exporting all parity test fixtures from TS oracle...');
exportGeometryFixtures();
exportCleanerFixtures();
exportRouterFixtures();
exportLabelFixtures();
exportMetricsFixtures();
exportNLPFixtures();
console.log('✨ All TS parity fixtures successfully exported to testdata/parity/');
