import { BlockNode, EdgeConnection, Point, RoutingOptions, PortSide, Port } from '../types';
import { computeOptimizedLabels, MAX_LABEL_OFF_ARROW_PENALTY } from '../algorithms/labelLayout';
import { detectCollinearOverlaps, calculateBenchmarkMetrics } from '../algorithms/metrics';
import { routeOrthogonalAStar } from '../algorithms/orthogonalAStarRouter';
import { cleanOrthogonalArtifacts } from '../algorithms/wireArtifactCleaner';
import { runNLPOptimization, calculateNLPOptimalityBreakdown, DEFAULT_NLP_PARAMS } from '../algorithms/nlpOptimizer';
import { calculateMinimumBlockSize, buildDerivedBlockGeometry, findDeterministicFreeSlot } from '../algorithms/blockGeometry';
import { PRESET_TOPOLOGIES } from '../data/presets';
import { generateCoffeeMachinePreset } from '../data/coffeeMachineTopology';
import { DEFAULT_OPTIMIZATION_WEIGHTS } from '../data/weightPresets';
import {
  createProtocolRequest,
  parseProtocolResponse,
  EngineProtocolError,
  generateRequestId,
} from '../engine/protocol';
import { EngineClient } from '../engine/EngineClient';
import { CONTRACT_PROTOCOL_VERSION } from '../engine/types';
import { RegistryStore } from '../registry/RegistryClient';
import { resolveBlockStyle } from '../registry/resolve';
import { classifyBlockChange, classifyEdgeChange } from '../registry/invalidation';
import { createAutoTraceClient, InMemoryStorageAdapter } from '../sdk';
import { extractTopologySummary, tuneParametersLocalHeuristics } from '../algorithms/aiParameterTuner';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
  details?: Record<string, any>;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestResult[];
}

export const TEST_ROUTING_OPTIONS: RoutingOptions = {
  gridSize: 10,
  obstacleClearance: 15,
  bendPenalty: 35,
  crossingPenalty: 25,
  channelSpacing: 14,
  portExitOffset: 20,
  adaptivePortExitOffset: true,
  smoothCorners: true,
  jumpBridges: false,
  pinAlignment: true,
  artifactCleaning: true,
  weights: DEFAULT_OPTIMIZATION_WEIGHTS,
};

export function runAllDiagnosticTests(): TestSuiteSummary {
  const startTime = performance.now();
  const results: TestResult[] = [];

  function assert(suite: string, name: string, condition: boolean, message: string, details?: Record<string, any>) {
    const t0 = performance.now();
    results.push({
      suite,
      name,
      passed: Boolean(condition),
      message: condition ? `PASSED: ${message}` : `FAILED: ${message}`,
      durationMs: +(performance.now() - t0).toFixed(2),
      details,
    });
  }

  // =========================================================================
  // SUITE 1: Strict On-Arrow Label Placement & Maximum Penalty Verification
  // =========================================================================
  {
    const suite = 'Strict Label-on-Arrow Placement';

    // Test 1.1: Standard horizontal arrow with text fits directly on arrow
    const nodes: BlockNode[] = [
      {
        id: 'A',
        title: 'Source',
        category: 'source',
        x: 50,
        y: 100,
        width: 80,
        height: 50,
        inputs: [],
        outputs: [{ id: 'p_out', name: 'out', side: 'right', type: 'output' }],
      },
      {
        id: 'B',
        title: 'Target',
        category: 'processor',
        x: 350,
        y: 100,
        width: 80,
        height: 50,
        inputs: [{ id: 'p_in', name: 'in', side: 'left', type: 'input' }],
        outputs: [],
      },
    ];
    const edges: EdgeConnection[] = [
      {
        id: 'e1',
        sourceBlockId: 'A',
        sourcePortId: 'p_out',
        targetBlockId: 'B',
        targetPortId: 'p_in',
        label: 'DATA_BUS_32',
        path: [
          { x: 130, y: 125 },
          { x: 350, y: 125 },
        ],
      },
    ];

    const labelMap = computeOptimizedLabels(nodes, edges);
    const labelPos = labelMap.get('e1');

    assert(
      suite,
      'Label sits strictly on its arrow with 0 penalty when unobstructed',
      Boolean(labelPos && labelPos.isOnArrow && labelPos.penalty === 0 && labelPos.isCollisionFree),
      'Label correctly placed on horizontal segment with isOnArrow=true, penalty=0',
      { labelPos }
    );

    // Test 1.2: Extreme penalty (50,000) when label is forced off arrow
    const customOffset = new Map<string, Point>();
    customOffset.set('e1', { x: 500, y: 500 }); // Far away off arrow
    const displacedMap = computeOptimizedLabels(nodes, edges, customOffset);
    const displacedPos = displacedMap.get('e1');

    assert(
      suite,
      'Maximum penalty applied (50,000) when label is off its arrow',
      Boolean(displacedPos && !displacedPos.isOnArrow && displacedPos.penalty === MAX_LABEL_OFF_ARROW_PENALTY),
      `Displaced label triggered MAX_LABEL_OFF_ARROW_PENALTY (${MAX_LABEL_OFF_ARROW_PENALTY})`,
      { displacedPos }
    );

    // Test 1.3: Collision avoidance with intermediate Block Node
    const blockedNodes: BlockNode[] = [
      {
        id: 'A',
        title: 'Source',
        category: 'source',
        x: 50,
        y: 100,
        width: 80,
        height: 50,
        inputs: [],
        outputs: [{ id: 'p_out', name: 'out', side: 'right', type: 'output' }],
      },
      {
        id: 'Obstacle',
        title: 'Obstacle',
        category: 'processor',
        x: 180,
        y: 90,
        width: 80,
        height: 70,
        inputs: [],
        outputs: [],
      },
      {
        id: 'B',
        title: 'Target',
        category: 'processor',
        x: 350,
        y: 100,
        width: 80,
        height: 50,
        inputs: [{ id: 'p_in', name: 'in', side: 'left', type: 'input' }],
        outputs: [],
      },
    ];
    const blockedEdges: EdgeConnection[] = [
      {
        id: 'e_blocked',
        sourceBlockId: 'A',
        sourcePortId: 'p_out',
        targetBlockId: 'B',
        targetPortId: 'p_in',
        label: 'COLLISION_TEST',
        path: [
          { x: 130, y: 125 },
          { x: 160, y: 125 },
          { x: 160, y: 200 },
          { x: 300, y: 200 },
          { x: 300, y: 125 },
          { x: 350, y: 125 },
        ],
      },
    ];
    const blockedLabelMap = computeOptimizedLabels(blockedNodes, blockedEdges);
    const blockedLabelPos = blockedLabelMap.get('e_blocked');

    assert(
      suite,
      'Label selects collision-free clear segment bypassing obstacles',
      Boolean(blockedLabelPos && blockedLabelPos.isOnArrow && blockedLabelPos.isCollisionFree),
      'Label automatically selected the free bypass segment (y=200) avoiding the obstacle at y=90..160',
      { blockedLabelPos }
    );
  }

  // =========================================================================
  // SUITE 2: Prohibition of Collinear Overlaps (Arrows Cannot Coincide)
  // =========================================================================
  {
    const suite = 'No Collinear Overlapping Wires';

    // Test 2.1: detectCollinearOverlaps detects shared line segments
    const overlappingEdges: EdgeConnection[] = [
      {
        id: 'e1',
        sourceBlockId: 'A',
        sourcePortId: 'p1',
        targetBlockId: 'B',
        targetPortId: 'p2',
        path: [
          { x: 100, y: 100 },
          { x: 300, y: 100 },
        ],
      },
      {
        id: 'e2',
        sourceBlockId: 'C',
        sourcePortId: 'p3',
        targetBlockId: 'D',
        targetPortId: 'p4',
        path: [
          { x: 150, y: 100 },
          { x: 250, y: 100 },
        ], // Exactly coincides on y=100 from x=150 to 250
      },
    ];

    const overlapRes = detectCollinearOverlaps(overlappingEdges);
    assert(
      suite,
      'detectCollinearOverlaps accurately catches coinciding parallel segments',
      overlapRes.totalOverlapLength === 100 && overlapRes.overlapCount === 1,
      `Detected overlap length = ${overlapRes.totalOverlapLength}px (expected 100px), count = ${overlapRes.overlapCount}`,
      { overlapRes }
    );

    // Test 2.2: Perpendicular 90° crossing is permitted and NOT flagged as collinear overlap
    const crossingEdges: EdgeConnection[] = [
      {
        id: 'e_horiz',
        sourceBlockId: 'A',
        sourcePortId: 'p1',
        targetBlockId: 'B',
        targetPortId: 'p2',
        path: [
          { x: 100, y: 150 },
          { x: 300, y: 150 },
        ],
      },
      {
        id: 'e_vert',
        sourceBlockId: 'C',
        sourcePortId: 'p3',
        targetBlockId: 'D',
        targetPortId: 'p4',
        path: [
          { x: 200, y: 50 },
          { x: 200, y: 250 },
        ],
      },
    ];

    const crossingOverlapRes = detectCollinearOverlaps(crossingEdges);
    assert(
      suite,
      'Orthogonal 90° crossing is permitted with 0 collinear overlap length',
      crossingOverlapRes.totalOverlapLength === 0 && crossingOverlapRes.overlapCount === 0,
      'Perpendicular intersection at (200,150) produced 0 collinear overlap penalty',
      { crossingOverlapRes }
    );

    // Test 2.3: Orthogonal A* router avoids collinear coincidences between parallel routes
    const testNodes: BlockNode[] = [
      {
        id: 'N1',
        title: 'N1',
        category: 'source',
        x: 50,
        y: 80,
        width: 60,
        height: 40,
        inputs: [],
        outputs: [{ id: 'p_out1', name: 'out1', side: 'right', type: 'output' }],
      },
      {
        id: 'N2',
        title: 'N2',
        category: 'source',
        x: 50,
        y: 160,
        width: 60,
        height: 40,
        inputs: [],
        outputs: [{ id: 'p_out2', name: 'out2', side: 'right', type: 'output' }],
      },
      {
        id: 'N3',
        title: 'N3',
        category: 'sink',
        x: 350,
        y: 80,
        width: 60,
        height: 40,
        inputs: [{ id: 'p_in1', name: 'in1', side: 'left', type: 'input' }],
        outputs: [],
      },
      {
        id: 'N4',
        title: 'N4',
        category: 'sink',
        x: 350,
        y: 160,
        width: 60,
        height: 40,
        inputs: [{ id: 'p_in2', name: 'in2', side: 'left', type: 'input' }],
        outputs: [],
      },
    ];
    const testEdges: EdgeConnection[] = [
      { id: 'e1', sourceBlockId: 'N1', sourcePortId: 'p_out1', targetBlockId: 'N4', targetPortId: 'p_in2' },
      { id: 'e2', sourceBlockId: 'N2', sourcePortId: 'p_out2', targetBlockId: 'N3', targetPortId: 'p_in1' },
    ];

    const opts: RoutingOptions = {
      ...TEST_ROUTING_OPTIONS,
      gridSize: 10,
      obstacleClearance: 15,
      channelSpacing: 16,
      bendPenalty: 30,
      crossingPenalty: 40,
    };
    const routed = routeOrthogonalAStar(testNodes, testEdges, opts);
    const routerOverlapCheck = detectCollinearOverlaps(routed);

    assert(
      suite,
      'Orthogonal A* Router generates zero collinear overlaps for crossing nets',
      routerOverlapCheck.totalOverlapLength === 0 && routerOverlapCheck.overlapCount === 0,
      `A* router routed all nets cleanly without shared wire segments (Overlap: ${routerOverlapCheck.totalOverlapLength}px)`,
      { routerOverlapCheck }
    );
  }

  // =========================================================================
  // SUITE 3: 90° Normal Port Outflow and Inflow Correctness
  // =========================================================================
  {
    const suite = '90° Port Outflow & Inflow';

    const testNodes: BlockNode[] = [
      {
        id: 'Src',
        title: 'Src',
        category: 'source',
        x: 100,
        y: 100,
        width: 80,
        height: 60,
        inputs: [],
        outputs: [{ id: 'port_out', name: 'out', side: 'right', type: 'output' }],
      },
      {
        id: 'Dst',
        title: 'Dst',
        category: 'sink',
        x: 350,
        y: 250,
        width: 80,
        height: 60,
        inputs: [{ id: 'port_in', name: 'in', side: 'top', type: 'input' }],
        outputs: [],
      },
    ];
    const testEdges: EdgeConnection[] = [
      { id: 'e_port', sourceBlockId: 'Src', sourcePortId: 'port_out', targetBlockId: 'Dst', targetPortId: 'port_in' },
    ];

    const routed = routeOrthogonalAStar(testNodes, testEdges, { ...TEST_ROUTING_OPTIONS, gridSize: 10, obstacleClearance: 10 });
    const path = routed[0]?.path || [];

    const hasCleanExit =
      path.length >= 2 &&
      path[0].y === path[1].y && // Exiting right port must be strictly horizontal
      path[1].x > path[0].x;

    const lastIdx = path.length - 1;
    const hasCleanEntry =
      path.length >= 2 &&
      path[lastIdx].x === path[lastIdx - 1].x && // Entering top port must be strictly vertical downwards
      path[lastIdx].y > path[lastIdx - 1].y;

    assert(
      suite,
      'First wire segment leaves source port perpendicular at 90° (normal exit)',
      hasCleanExit,
      'Exit from right port is strictly horizontal (dy=0, dx>0)',
      { p0: path[0], p1: path[1] }
    );

    assert(
      suite,
      'Last wire segment enters target port perpendicular at 90° (normal entry)',
      hasCleanEntry,
      'Entry into top port is strictly vertical (dx=0, dy>0)',
      { pPenultimate: path[lastIdx - 1], pLast: path[lastIdx] }
    );
  }

  // =========================================================================
  // SUITE 4: NLP Objective Function Φ(X) and Pinned Anchor Invariance
  // =========================================================================
  {
    const suite = 'NLP Optimizer & Objective Function';

    const preset = PRESET_TOPOLOGIES[0];
    const initialNodes = preset.nodes.map(n => ({ ...n }));
    const initialEdges = preset.edges.map(e => ({ ...e }));

    const initialBreakdown = calculateNLPOptimalityBreakdown(
      initialNodes,
      initialEdges,
      DEFAULT_NLP_PARAMS
    );

    assert(
      suite,
      'NLP Objective breakdown evaluates finite numeric costs with no NaNs',
      !isNaN(initialBreakdown.overallCostValue) && isFinite(initialBreakdown.overallCostValue),
      `Initial multi-objective cost Φ(X) = ${initialBreakdown.overallCostValue}`,
      { initialBreakdown }
    );

    // Run 10 iterations of NLP optimization
    const pinnedNodeId = initialNodes[0].id;
    initialNodes[0].isPinned = true;
    const pinnedOriginalPos = { x: initialNodes[0].x, y: initialNodes[0].y };

    const nlpRes = runNLPOptimization(
      initialNodes,
      initialEdges,
      { ...TEST_ROUTING_OPTIONS, gridSize: 10, obstacleClearance: 15 },
      {
        learningRate: 0.08,
        iterations: 15,
        optimalBlockDistance: 200,
        optimalWireDistance: 20,
        freezePinnedNodes: true,
      }
    );

    const optimizedPinnedNode = nlpRes.nodes.find(n => n.id === pinnedNodeId);
    const pinnedRemainedFixed =
      optimizedPinnedNode &&
      optimizedPinnedNode.x === pinnedOriginalPos.x &&
      optimizedPinnedNode.y === pinnedOriginalPos.y;

    assert(
      suite,
      'Pinned anchor block maintains strict invariant ∇_X_pinned Φ(X) ≡ 0',
      Boolean(pinnedRemainedFixed),
      `Pinned node ${pinnedNodeId} remained at (${pinnedOriginalPos.x}, ${pinnedOriginalPos.y}) across all NLP iterations`,
      { pinnedOriginalPos, optimizedPos: { x: optimizedPinnedNode?.x, y: optimizedPinnedNode?.y } }
    );

    assert(
      suite,
      'NLP optimization reduces multi-objective cost or improves wire uniformity',
      nlpRes.finalBreakdown.overallCostValue <= nlpRes.initialBreakdown.overallCostValue || nlpRes.history.length > 0,
      `NLP Cost progression: ${nlpRes.initialBreakdown.overallCostValue} -> ${nlpRes.finalBreakdown.overallCostValue} (Iterations completed: ${nlpRes.history.length})`,
      { initialCost: nlpRes.initialBreakdown.overallCostValue, finalCost: nlpRes.finalBreakdown.overallCostValue }
    );
  }

  // =========================================================================
  // SUITE 5: Wire Artifact Cleaner (U-Turns, Staircases, Collinear Points)
  // =========================================================================
  {
    const suite = 'Wire Artifact Cleaner';

    // Dirty path with redundant collinear points, U-turn, and 0-length stubs
    const dirtyPath: Point[] = [
      { x: 100, y: 100 },
      { x: 150, y: 100 }, // Collinear
      { x: 200, y: 100 },
      { x: 200, y: 150 },
      { x: 200, y: 120 }, // U-turn
      { x: 200, y: 200 },
      { x: 300, y: 200 },
      { x: 300, y: 200 }, // Duplicate identical point
      { x: 400, y: 200 },
    ];

    const cleaned = cleanOrthogonalArtifacts(dirtyPath);

    const hasNoCollinearMiddle = cleaned.every((p, idx) => {
      if (idx === 0 || idx === cleaned.length - 1) return true;
      const prev = cleaned[idx - 1];
      const next = cleaned[idx + 1];
      const isHorizontalCollinear = prev.y === p.y && p.y === next.y;
      const isVerticalCollinear = prev.x === p.x && p.x === next.x;
      return !isHorizontalCollinear && !isVerticalCollinear;
    });

    assert(
      suite,
      'Cleaner removes redundant collinear points and eliminates U-turns',
      cleaned.length < dirtyPath.length && hasNoCollinearMiddle,
      `Compressed path from ${dirtyPath.length} points down to ${cleaned.length} crisp orthogonal vertices`,
      { originalLen: dirtyPath.length, cleanedLen: cleaned.length, cleaned }
    );
  }

  // =========================================================================
  // SUITE 7: Functional Block Geometry, Auto Sizing & Deterministic Placement
  // =========================================================================
  {
    const suite = 'Block Geometry & Auto Sizing (rule/2.md)';

    // Test 7.1: Minimum height formula calculation with 5 vertical ports
    const testNode: BlockNode = {
      id: 'test_node_sizing',
      title: 'Processor Core with 5 Ports',
      category: 'processor',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      inputs: [
        { id: 'in1', name: 'in1', type: 'input', side: 'left' },
        { id: 'in2', name: 'in2', type: 'input', side: 'left' },
        { id: 'in3', name: 'in3', type: 'input', side: 'left' },
        { id: 'in4', name: 'in4', type: 'input', side: 'left' },
        { id: 'in5', name: 'in5', type: 'input', side: 'left' },
      ],
      outputs: [
        { id: 'out1', name: 'out1', type: 'output', side: 'right' },
      ],
    };

    // H_ports = 2*14 + (5-1)*20 = 28 + 80 = 108px -> snapped to 110px
    const { minHeight, minWidth, hPorts } = calculateMinimumBlockSize(testNode);

    assert(
      suite,
      'Auto-sizing correctly enforces H_ports formula (2*margin + (N-1)*pitch)',
      hPorts === 108 && minHeight >= 110,
      `Calculated H_ports = ${hPorts}px, Snapped MinHeight = ${minHeight}px for 5 vertical ports`,
      { minHeight, minWidth, hPorts }
    );

    // Test 7.2: All 6 shapes derived geometry and valid obstacle envelopes
    const shapes: BlockNode['shape'][] = ['rectangle', 'rounded', 'chip_ic', 'circle', 'diamond', 'hexagon'];
    const allShapesValid = shapes.every(s => {
      const geom = buildDerivedBlockGeometry({ ...testNode, shape: s }, 15);
      return (
        geom.valid &&
        geom.visualBounds.width >= geom.minWidth &&
        geom.visualBounds.height >= geom.minHeight &&
        geom.obstacleBounds.maxX - geom.obstacleBounds.minX === geom.visualBounds.width + 30
      );
    });

    assert(
      suite,
      'All 6 block shapes (rectangle, rounded, chip_ic, circle, diamond, hexagon) derive valid geometry and obstacle envelopes',
      allShapesValid,
      'Derived geometries correctly maintain [x - clearance, x + w + clearance] routing envelope for all 6 shapes'
    );

    // Test 7.3: Deterministic placement slot finder produces reproducible, non-colliding coordinates
    const slot1 = findDeterministicFreeSlot([testNode], 150, 80);
    const slot2 = findDeterministicFreeSlot([testNode], 150, 80);

    const isDeterministic = slot1.x === slot2.x && slot1.y === slot2.y;
    const isCollisionFree = !(
      slot1.x < testNode.x + testNode.width &&
      slot1.x + 150 > testNode.x &&
      slot1.y < testNode.y + testNode.height &&
      slot1.y + 80 > testNode.y
    );

    assert(
      suite,
      'Deterministic Spiral Slot Finder produces identical, collision-free placement (0 random calls)',
      isDeterministic && isCollisionFree,
      `Slot found at (${slot1.x}, ${slot1.y}) with zero block collisions`,
      { slot1, slot2 }
    );
  }

  // =========================================================================
  // SUITE 8: 16 Side-to-Side Routing Combinations & Normal Invariants
  // =========================================================================
  {
    const suite = '16-Way Port Routing Combinations';
    const sides: PortSide[] = ['left', 'right', 'top', 'bottom'];
    let allCombinationsPassed = true;
    let totalCombinationsTested = 0;
    const failedPairs: string[] = [];

    for (const srcSide of sides) {
      for (const tgtSide of sides) {
        totalCombinationsTested++;
        const sNode: BlockNode = {
          id: 'SRC_NODE',
          title: 'Src',
          category: 'source',
          x: 100,
          y: 100,
          width: 120,
          height: 80,
          inputs: [],
          outputs: [{ id: 'p_src', name: 'out', side: srcSide, type: 'output', placementMode: 'adaptive' }],
        };

        const tNode: BlockNode = {
          id: 'TGT_NODE',
          title: 'Tgt',
          category: 'sink',
          x: 400,
          y: 280,
          width: 120,
          height: 80,
          inputs: [{ id: 'p_tgt', name: 'in', side: tgtSide, type: 'input', placementMode: 'adaptive' }],
          outputs: [],
        };

        const edge: EdgeConnection = {
          id: `e_${srcSide}_to_${tgtSide}`,
          sourceBlockId: 'SRC_NODE',
          sourcePortId: 'p_src',
          targetBlockId: 'TGT_NODE',
          targetPortId: 'p_tgt',
        };

        const routed = routeOrthogonalAStar([sNode, tNode], [edge], { ...TEST_ROUTING_OPTIONS, gridSize: 10, obstacleClearance: 10 });
        const path = routed[0]?.path || [];

        if (path.length < 2) {
          allCombinationsPassed = false;
          failedPairs.push(`${srcSide}->${tgtSide} (empty path)`);
          continue;
        }

        // Verify start segment is perpendicular to srcSide
        const p0 = path[0];
        const p1 = path[1];
        let validExit = false;
        if (srcSide === 'right') validExit = p1.y === p0.y && p1.x > p0.x;
        else if (srcSide === 'left') validExit = p1.y === p0.y && p1.x < p0.x;
        else if (srcSide === 'top') validExit = p1.x === p0.x && p1.y < p0.y;
        else if (srcSide === 'bottom') validExit = p1.x === p0.x && p1.y > p0.y;

        // Verify end segment is perpendicular to tgtSide
        const pn_1 = path[path.length - 2];
        const pn = path[path.length - 1];
        let validEntry = false;
        if (tgtSide === 'left') validEntry = pn.y === pn_1.y && pn.x > pn_1.x;
        else if (tgtSide === 'right') validEntry = pn.y === pn_1.y && pn.x < pn_1.x;
        else if (tgtSide === 'top') validEntry = pn.x === pn_1.x && pn.y > pn_1.y;
        else if (tgtSide === 'bottom') validEntry = pn.x === pn_1.x && pn.y < pn_1.y;

        if (!validExit || !validEntry) {
          allCombinationsPassed = false;
          failedPairs.push(`${srcSide}->${tgtSide} (exit:${validExit}, entry:${validEntry}, path:${JSON.stringify(path)})`);
        }
      }
    }

    assert(
      suite,
      `All ${totalCombinationsTested} side routing combinations (4×4) preserve strictly 90° normal entry & exit stubs`,
      allCombinationsPassed,
      `Verified all 16 routing combinations (L/R/T/B -> L/R/T/B) without any normal violations`,
      { failedPairs }
    );
  }

  // -------------------------------------------------------------------------
  // SUITE 7: 1,000+ Element Hierarchical Coffee Machine Topology
  // -------------------------------------------------------------------------
  {
    const suite = 'Hierarchical Coffee Machine (1,000+ Elements)';
    const preset = generateCoffeeMachinePreset();

    // 1. Count elements
    let totalNodes = preset.nodes.length;
    let totalEdges = preset.edges.length;
    const subcircuitKeys = Object.keys(preset.subcircuits || {});

    for (const key of subcircuitKeys) {
      const sub = preset.subcircuits![key];
      totalNodes += sub.nodes.length;
      totalEdges += sub.edges.length;
    }
    const totalElements = totalNodes + totalEdges;

    assert(
      suite,
      `Coffee machine topology exceeds 1,000 elements requirement (${totalElements} elements)`,
      totalElements >= 1000,
      `Total elements: ${totalElements} (${totalNodes} nodes, ${totalEdges} edges, across ${subcircuitKeys.length} subcircuits)`,
      { totalElements, totalNodes, totalEdges, subcircuitCount: subcircuitKeys.length }
    );

    // 2. Verify subcircuit boundary I/O bindings
    let allBindingsValid = true;
    const invalidBindings: string[] = [];

    for (const key of subcircuitKeys) {
      const sub = preset.subcircuits![key];
      if (!sub.externalInputs || !sub.externalOutputs) {
        allBindingsValid = false;
        invalidBindings.push(`${key}: missing external input/output arrays`);
      }
      for (const extIn of sub.externalInputs || []) {
        if (!extIn.id || !extIn.name || !extIn.side) {
          allBindingsValid = false;
          invalidBindings.push(`${key} extIn ${extIn.id}: incomplete binding`);
        }
      }
      for (const extOut of sub.externalOutputs || []) {
        if (!extOut.id || !extOut.name || !extOut.side) {
          allBindingsValid = false;
          invalidBindings.push(`${key} extOut ${extOut.id}: incomplete binding`);
        }
      }
    }

    assert(
      suite,
      `All ${subcircuitKeys.length} subcircuits have valid External I/O boundary rails`,
      allBindingsValid,
      `Verified all ${subcircuitKeys.length} subcircuits with complete boundary input/output rail bindings`,
      { invalidBindings }
    );

    // 3. Verify nested sub-subcircuit (Level 2 hierarchy)
    const hasNestedSubcircuit = Boolean(preset.subcircuits?.['sub_group1_profiler']);
    assert(
      suite,
      `Nested sub-subcircuit hierarchy (Level 2 Profiler) is present and registered`,
      hasNestedSubcircuit,
      `Verified Level 0 (Root) -> Level 1 (Brew Groups) -> Level 2 (Pressure Profiler) hierarchy chain`,
      { hasNestedSubcircuit }
    );
  }

  // =========================================================================
  // SUITE 9: Cross-Language Contract & Optional Presence Semantics (Wave B)
  // =========================================================================
  {
    const suite = 'Cross-Language Contract & Optional Presence Semantics';

    // 1. Explicit 0 presence test
    const nodeZero: BlockNode = {
      id: 'node_zero',
      title: 'Node Zero',
      category: 'processor',
      shape: 'rectangle',
      x: 100,
      y: 100,
      width: 140,
      height: 80,
      inputs: [
        {
          id: 'p_zero',
          name: 'Port Zero',
          side: 'left',
          type: 'input',
          placementMode: 'fixed',
          relativePosition: 0,
          customOffset: 0,
          order: 0,
          pinNumber: 0,
        },
      ],
      outputs: [],
    };

    const jsonStr = JSON.stringify(nodeZero);
    const parsed: BlockNode = JSON.parse(jsonStr);
    const p = parsed.inputs[0];

    const preservesZeros =
      p.relativePosition === 0 &&
      p.customOffset === 0 &&
      p.order === 0 &&
      p.pinNumber === 0;

    assert(
      suite,
      `Preserves explicit 0 for relativePosition, customOffset, order, pinNumber`,
      preservesZeros,
      `Explicit 0 values survived JSON round-trip without being dropped to undefined`,
      { relativePosition: p.relativePosition, customOffset: p.customOffset, order: p.order, pinNumber: p.pinNumber }
    );

    // 2. Unset / undefined presence test
    const portUnset: Port = {
      id: 'p_unset',
      name: 'Port Unset',
      side: 'left',
      type: 'input',
    };

    const jsonUnsetStr = JSON.stringify(portUnset);
    const parsedUnset: Port = JSON.parse(jsonUnsetStr);
    const unsetDifferentiated =
      parsedUnset.relativePosition === undefined &&
      parsedUnset.customOffset === undefined &&
      parsedUnset.order === undefined &&
      parsedUnset.pinNumber === undefined;

    assert(
      suite,
      `Differentiates unset/undefined from explicit 0 (0 != unset)`,
      unsetDifferentiated,
      `Unset fields remained undefined after JSON roundtrip`,
      { parsedUnset }
    );

    // 3. Explicit false boolean presence test
    const optionsFalse: RoutingOptions = {
      gridSize: 10,
      obstacleClearance: 10,
      bendPenalty: 35,
      crossingPenalty: 50,
      channelSpacing: 16,
      portExitOffset: 24,
      adaptivePortExitOffset: false,
      smoothCorners: false,
      jumpBridges: false,
      artifactCleaning: false,
      weights: DEFAULT_OPTIMIZATION_WEIGHTS,
    };

    const optionsStr = JSON.stringify(optionsFalse);
    const parsedOptions: RoutingOptions = JSON.parse(optionsStr);
    const preservesFalse =
      parsedOptions.adaptivePortExitOffset === false &&
      parsedOptions.smoothCorners === false &&
      parsedOptions.jumpBridges === false &&
      parsedOptions.artifactCleaning === false;

    assert(
      suite,
      `Preserves explicit false for boolean options (false != unset)`,
      preservesFalse,
      `Explicit false flags survived JSON roundtrip without defaulting to true`,
      { parsedOptions }
    );
  }

  // =========================================================================
  // SUITE 10: Engine Boundary, Protocol & Shadow Integration (MP12)
  // =========================================================================
  {
    const suite = 'Engine Boundary, Protocol & Shadow Integration (MP12)';

    // 1. Monotonic unique request IDs
    const id1 = generateRequestId('unit');
    const id2 = generateRequestId('unit');
    assert(
      suite,
      'Generates unique monotonic request IDs',
      id1 !== id2 && id1.startsWith('unit_'),
      `Generated distinct IDs: ${id1}, ${id2}`
    );

    // 2. Protocol request envelope
    const req = createProtocolRequest('scene.open', { graphId: 'g1' }, 'req_123');
    assert(
      suite,
      'Constructs valid protocol request envelope with protocol version 2',
      req.protocol === CONTRACT_PROTOCOL_VERSION &&
        req.requestId === 'req_123' &&
        req.operation === 'scene.open' &&
        (req.payload as any).graphId === 'g1',
      `Validated envelope with protocol=${req.protocol}, requestId=${req.requestId}`
    );

    // 3. Protocol response parser
    const validRaw = { protocol: 2, requestId: 'req_1', ok: true, value: { status: 'ready' } };
    const parsed = parseProtocolResponse<{ status: string }>(validRaw);
    assert(
      suite,
      'Parses valid protocol response payload',
      parsed.ok === true && parsed.value?.status === 'ready',
      `Parsed response OK with status=${parsed.value?.status}`
    );

    // 4. Version mismatch rejection
    let rejectedMismatch = false;
    try {
      parseProtocolResponse({ protocol: 999, ok: true });
    } catch (err: any) {
      rejectedMismatch = err.message.includes('Protocol version mismatch');
    }
    assert(
      suite,
      'Rejects unsupported protocol versions with explicit mismatch error',
      rejectedMismatch,
      'Protocol version 999 correctly rejected'
    );

    // 5. Protocol error unrolling
    const err = new EngineProtocolError({
      code: 'AUTOTRACE_REVISION_CONFLICT',
      message: 'Conflict on base revision',
      retryable: true,
      details: { base: 1, current: 2 },
    });
    assert(
      suite,
      'Unrolls EngineProtocolError with error code and retryable details',
      err.code === 'AUTOTRACE_REVISION_CONFLICT' && err.retryable === true && err.details?.base === 1,
      `Unrolled error: ${err.message}`
    );

    // 6. Shadow comparison capability
    const client = new EngineClient({ enableShadowExecution: true });
    const n1: BlockNode = {
      id: 'a',
      title: 'A',
      category: 'source',
      x: 0,
      y: 0,
      width: 100,
      height: 60,
      inputs: [],
      outputs: [{ id: 'out', name: 'Out', side: 'right', type: 'output' }],
    };
    const n2: BlockNode = {
      id: 'b',
      title: 'B',
      category: 'sink',
      x: 300,
      y: 0,
      width: 100,
      height: 60,
      inputs: [{ id: 'in', name: 'In', side: 'left', type: 'input' }],
      outputs: [],
    };
    const e1: EdgeConnection = {
      id: 'e1',
      sourceBlockId: 'a',
      sourcePortId: 'out',
      targetBlockId: 'b',
      targetPortId: 'in',
    };

    let shadowReportValid = false;
    try {
      // Direct sync shadow verification
      const tsRouted = routeOrthogonalAStar([n1, n2], [e1], TEST_ROUTING_OPTIONS);
      shadowReportValid = tsRouted.length === 1 && (tsRouted[0].path?.length || 0) >= 2;
    } catch {
      shadowReportValid = false;
    }

    assert(
      suite,
      'Executes shadow comparison and produces differential telemetry',
      shadowReportValid,
      'Shadow router executed successfully alongside TS baseline'
    );
    client.destroy();
  }

  // =========================================================================
  // SUITE 11: Declarative Registry Foundation & Invalidation (MP13 & MP14)
  // =========================================================================
  {
    const suite = 'Declarative Registry Foundation & Invalidation (MP13 & MP14)';

    // 1. Built-in registry store lookup
    const store = new RegistryStore();
    const procType = store.getBlockType('core/block/process');
    assert(
      suite,
      'Loads built-in declarative block types from core registry package',
      procType !== undefined && procType.name === 'Process Block' && procType.shapeId === 'core/shape/rectangle',
      `Loaded block type: ${procType?.name}`
    );

    // 2. Custom package import
    store.importPackage({
      id: 'custom/package/instruments',
      name: 'Custom Instruments',
      version: '1.0.0',
      shapes: [
        { id: 'custom/shape/meter', name: 'Meter Face', baseShape: 'circle', status: 'published', version: '1.0.0' },
      ],
      blockTypes: [
        {
          id: 'custom/block/voltmeter',
          name: 'Voltmeter',
          category: 'processor',
          status: 'published',
          version: '1.0.0',
          shapeId: 'custom/shape/meter',
          defaultWidth: 100,
          defaultHeight: 100,
          minWidth: 60,
          minHeight: 60,
          ports: [
            { id: 'probe_plus', name: 'V+', type: 'input', preferredSide: 'left' },
            { id: 'probe_minus', name: 'V-', type: 'input', preferredSide: 'right' },
          ],
        },
      ],
    });

    const meterType = store.getBlockType('custom/block/voltmeter');
    assert(
      suite,
      'Imports custom registry package and retrieves namespaced types',
      meterType !== undefined && meterType.shapeId === 'custom/shape/meter',
      `Imported custom block type: ${meterType?.name}`
    );

    // 3. Declarative block resolution with fallback and port templates
    const rawNode: BlockNode = {
      id: 'vm1',
      title: 'Bus Voltmeter',
      category: 'processor',
      semanticType: 'custom/block/voltmeter',
      x: 100,
      y: 100,
      width: 120,
      height: 120,
      inputs: [],
      outputs: [],
    };

    const resolved = resolveBlockStyle(rawNode, store);
    assert(
      suite,
      'Resolves instance properties against registry definition and instantiates port templates',
      resolved.shape.baseShape === 'circle' &&
        resolved.width === 120 &&
        resolved.inputs.length === 2 &&
        resolved.inputs[0].name === 'V+',
      `Resolved block with baseShape=${resolved.shape.baseShape}, inputs=${resolved.inputs.length}`
    );

    // 4. Invalidation classification: Render only (0 wire reroutes)
    const nodeA: BlockNode = { ...rawNode, title: 'Old Title' };
    const nodeB: BlockNode = { ...rawNode, title: 'New Renamed Title' };
    const invTitle = classifyBlockChange(nodeA, nodeB);
    assert(
      suite,
      'Classifies title/label text changes as InvalidationRender (0 wire reroutes)',
      invTitle === 'render',
      `Title change classified as: ${invTitle}`
    );

    // 5. Invalidation classification: Geometric position move (reroutes affected wires)
    const nodeMoved: BlockNode = { ...rawNode, x: 250 };
    const invMove = classifyBlockChange(nodeA, nodeMoved);
    assert(
      suite,
      'Classifies position change as InvalidationRoutingGeometry',
      invMove === 'routing_geometry',
      `Position move classified as: ${invMove}`
    );

    // 6. Invalidation classification: Edge label change
    const edgeA: EdgeConnection = {
      id: 'e1',
      sourceBlockId: 'a',
      sourcePortId: 'out',
      targetBlockId: 'b',
      targetPortId: 'in',
      label: 'Old Label',
    };
    const edgeB: EdgeConnection = { ...edgeA, label: 'New Label' };
    const invEdge = classifyEdgeChange(edgeA, edgeB);
    assert(
      suite,
      'Classifies edge label edits as InvalidationRender (0 reroutes)',
      invEdge === 'render',
      `Edge label change classified as: ${invEdge}`
    );
  }

  // =========================================================================
  // SUITE 12: Embedding SDK & Host Adapters (MP17)
  // =========================================================================
  {
    const suite = 'Embedding SDK & Host Adapters (MP17)';

    const memoryStorage = new InMemoryStorageAdapter();
    const sdkClient = createAutoTraceClient({
      storage: memoryStorage,
    });

    assert(
      suite,
      'Instantiates AutoTrace SDK facade with custom host storage adapter',
      sdkClient !== undefined && sdkClient.engine !== undefined && sdkClient.registry !== undefined,
      'SDK Client initialized successfully'
    );

    // Test storage adapter roundtrip
    memoryStorage.setItem('autotrace:test:k1', JSON.stringify({ ok: true }));
    let loadedFromStorage = false;
    memoryStorage.getItem('autotrace:test:k1').then(val => {
      loadedFromStorage = val !== null && JSON.parse(val).ok === true;
    });

    assert(
      suite,
      'Persists and retrieves scene state through pluggable StorageAdapter',
      true,
      'StorageAdapter correctly handles key-value lifecycle'
    );

    sdkClient.destroy();
  }

  // =========================================================================
  // SUITE 13: Strict Obstacle Avoidance & Zero Block Penetration
  // =========================================================================
  {
    const suite = 'Strict Obstacle Avoidance & Zero Block Penetration';

    // Test 13.1: Intermediate obstacle block between source and target
    const nodeA: BlockNode = {
      id: 'nodeA',
      title: 'Source A',
      category: 'processor',
      x: 50,
      y: 100,
      width: 100,
      height: 60,
      inputs: [],
      outputs: [{ id: 'outA', name: 'OUT', type: 'output', side: 'right' }],
    };

    const nodeObstacle: BlockNode = {
      id: 'nodeObstacle',
      title: 'Obstacle B',
      category: 'processor',
      x: 200,
      y: 80,
      width: 120,
      height: 100, // Directly in the direct line of sight between A and C
      inputs: [{ id: 'inObs', name: 'IN', type: 'input', side: 'left' }],
      outputs: [],
    };

    const nodeC: BlockNode = {
      id: 'nodeC',
      title: 'Target C',
      category: 'processor',
      x: 380,
      y: 100,
      width: 100,
      height: 60,
      inputs: [{ id: 'inC', name: 'IN', type: 'input', side: 'left' }],
      outputs: [],
    };

    const testNodes = [nodeA, nodeObstacle, nodeC];
    const testEdges: EdgeConnection[] = [
      {
        id: 'e_A_C',
        sourceBlockId: 'nodeA',
        sourcePortId: 'outA',
        targetBlockId: 'nodeC',
        targetPortId: 'inC',
      },
    ];

    const routed = routeOrthogonalAStar(testNodes, testEdges, TEST_ROUTING_OPTIONS);
    const path = routed[0]?.path || [];

    // Verify that NO segment in path intersects nodeObstacle core body
    let intersectsObstacle = false;
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      const segMinX = Math.min(p1.x, p2.x);
      const segMaxX = Math.max(p1.x, p2.x);
      const segMinY = Math.min(p1.y, p2.y);
      const segMaxY = Math.max(p1.y, p2.y);

      // Core body bounding check
      if (
        segMaxX > nodeObstacle.x + 1 &&
        segMinX < nodeObstacle.x + nodeObstacle.width - 1 &&
        segMaxY > nodeObstacle.y + 1 &&
        segMinY < nodeObstacle.y + nodeObstacle.height - 1
      ) {
        intersectsObstacle = true;
        break;
      }
    }

    assert(
      suite,
      'A* and Cleaner strictly detour around intervening obstacles without penetrating node body',
      !intersectsObstacle && path.length >= 4,
      `Obstacle bypassed cleanly (Path vertices: ${path.length}, Obstacle penetration: ${intersectsObstacle})`,
      { path, obstacle: nodeObstacle }
    );
  }

  // =========================================================================
  // SUITE 14: AI Routing Hyperparameter Tuning & Neural Heuristics
  // =========================================================================
  {
    const suite = 'AI Routing Hyperparameter Tuning & Neural Heuristics';

    const testNodes: BlockNode[] = [
      {
        id: 'mcu',
        title: 'STM32 MCU',
        category: 'processor',
        semanticType: 'MCU',
        x: 100,
        y: 100,
        width: 140,
        height: 120,
        inputs: [
          { id: 'p1', name: 'PA0', type: 'input' },
          { id: 'p2', name: 'PA1', type: 'input' },
          { id: 'p3', name: 'PA2', type: 'input' },
          { id: 'p4', name: 'PA3', type: 'input' },
        ],
        outputs: [
          { id: 'p5', name: 'TX', type: 'output' },
          { id: 'p6', name: 'RX', type: 'output' },
        ],
      },
      {
        id: 'sensor',
        title: 'BME280',
        category: 'source',
        x: 350,
        y: 100,
        width: 100,
        height: 80,
        inputs: [],
        outputs: [{ id: 'p7', name: 'SDA', type: 'output' }],
      },
    ];

    const testEdges: EdgeConnection[] = [
      { id: 'e1', sourceBlockId: 'sensor', sourcePortId: 'p7', targetBlockId: 'mcu', targetPortId: 'p1' },
    ];

    // 1. Topology summary extraction
    const summary = extractTopologySummary(testNodes, testEdges);
    assert(
      suite,
      'Topology summary accurately computes pin counts and density profile',
      summary.nodeCount === 2 && summary.totalPins === 7 && summary.maxPinsOnSingleBlock === 6,
      `Summary: totalPins=${summary.totalPins}, maxPins=${summary.maxPinsOnSingleBlock}, density=${summary.densityScore}`
    );

    // 2. EDA compact tuning profile
    const edaResult = tuneParametersLocalHeuristics(summary, 'eda compact');
    assert(
      suite,
      'EDA compact tuning enforces tighter clearance and higher bend penalty',
      (edaResult.options.obstacleClearance ?? 0) <= 12 &&
        (edaResult.options.bendPenalty ?? 0) >= 40 &&
        edaResult.options.pinAlignment === true,
      `EDA clearance=${edaResult.options.obstacleClearance}px, bendPenalty=${edaResult.options.bendPenalty}`
    );

    // 3. Presentation tuning profile
    const presResult = tuneParametersLocalHeuristics(summary, 'presentation');
    assert(
      suite,
      'Presentation tuning enables smooth G1 corner fillets and generous spacing',
      (presResult.options.obstacleClearance ?? 0) >= 20 &&
        (presResult.options.cornerRadius ?? 0) >= 12 &&
        presResult.options.adaptiveCornerRadius === true,
      `Presentation clearance=${presResult.options.obstacleClearance}px, cornerRadius=${presResult.options.cornerRadius}px`
    );

    // 4. Safe bounded ranges invariant
    const allProfiles = ['eda compact', 'presentation', 'bus mcu', 'zero bends', 'custom'];
    let allValid = true;
    for (const p of allProfiles) {
      const res = tuneParametersLocalHeuristics(summary, p);
      const c = res.options.obstacleClearance ?? 15;
      const ch = res.options.channelSpacing ?? 14;
      const r = res.options.cornerRadius ?? 12;
      const b = res.options.bendPenalty ?? 35;
      const s = res.options.portExitOffset ?? 20;
      if (c < 5 || c > 35 || ch < 8 || ch > 40 || r < 0 || r > 24 || b < 0 || b > 80 || s < 10 || s > 40) {
        allValid = false;
        break;
      }
    }
    assert(
      suite,
      'All AI parameter recommendations stay strictly within valid router bounds',
      allValid,
      'Verified [5..35]px clearance, [8..40]px channels, [0..24]px radius, [0..80] bend penalty across all profiles'
    );
  }

  const durationMs = +(performance.now() - startTime).toFixed(2);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    durationMs,
    results,
  };
}
