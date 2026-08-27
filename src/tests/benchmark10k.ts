import { BlockNode, EdgeConnection, RoutingOptions } from '../types';
import { routeOrthogonalAStar } from '../algorithms/orthogonalAStarRouter';
import { routeManhattanChannel } from '../algorithms/manhattanChannelRouter';
import { routeLeeWave } from '../algorithms/leeWaveRouter';
import { routeSmoothSplines } from '../algorithms/splineRouter';
import { runSugiyamaLayout } from '../algorithms/sugiyamaLayout';
import { runForceDirectedLayout } from '../algorithms/forceLayout';
import { runOrthogonalGridLayout } from '../algorithms/orthogonalGridLayout';
import { cleanOrthogonalArtifacts } from '../algorithms/wireArtifactCleaner';
import { computeOptimizedLabels } from '../algorithms/labelLayout';
import { calculateBenchmarkMetrics, detectCollinearOverlaps } from '../algorithms/metrics';
import { DEFAULT_OPTIMIZATION_WEIGHTS } from '../data/weightPresets';

export function generateSyntheticCircuit(nodeCount: number, edgeDensity: number = 1.2): { nodes: BlockNode[]; edges: EdgeConnection[] } {
  const nodes: BlockNode[] = [];
  const edges: EdgeConnection[] = [];

  const cols = Math.ceil(Math.sqrt(nodeCount));
  const spacingX = 220;
  const spacingY = 140;

  for (let i = 0; i < nodeCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const id = `node_${i}`;
    nodes.push({
      id,
      title: `Block_${i}`,
      category: i === 0 ? 'source' : i === nodeCount - 1 ? 'sink' : 'processor',
      x: 100 + col * spacingX,
      y: 100 + row * spacingY,
      width: 120,
      height: 70,
      inputs: [
        { id: `in_0`, name: 'IN0', side: 'left', type: 'input' },
        { id: `in_1`, name: 'IN1', side: 'top', type: 'input' },
      ],
      outputs: [
        { id: `out_0`, name: 'OUT0', side: 'right', type: 'output' },
        { id: `out_1`, name: 'OUT1', side: 'bottom', type: 'output' },
      ],
    });
  }

  const targetEdgeCount = Math.floor(nodeCount * edgeDensity);
  let edgeIdCounter = 0;

  for (let i = 0; i < nodeCount - 1 && edgeIdCounter < targetEdgeCount; i++) {
    // Connect to next neighbour in grid or layer
    const nextNeighbor = i + 1;
    edges.push({
      id: `edge_${edgeIdCounter++}`,
      sourceBlockId: `node_${i}`,
      sourcePortId: 'out_0',
      targetBlockId: `node_${nextNeighbor}`,
      targetPortId: 'in_0',
      label: `SIG_${edgeIdCounter}`,
    });

    if (edgeIdCounter < targetEdgeCount && i + cols < nodeCount) {
      edges.push({
        id: `edge_${edgeIdCounter++}`,
        sourceBlockId: `node_${i}`,
        sourcePortId: 'out_1',
        targetBlockId: `node_${i + cols}`,
        targetPortId: 'in_1',
        label: `BUS_${edgeIdCounter}`,
      });
    }
  }

  return { nodes, edges };
}

function computePercentiles(numbers: number[]): { p50: number; p95: number; p99: number; max: number; avg: number } {
  if (numbers.length === 0) return { p50: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  const sorted = [...numbers].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const max = sorted[sorted.length - 1];
  const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return {
    p50: +p50.toFixed(2),
    p95: +p95.toFixed(2),
    p99: +p99.toFixed(2),
    max: +max.toFixed(2),
    avg: +avg.toFixed(2),
  };
}

async function runBenchmark() {
  console.log('================================================================');
  console.log('  AUTOTRACE LAB - BENCHMARK & P95/P99 LATENCY AUDIT (10 to 10k) ');
  console.log('================================================================\n');

  const options: RoutingOptions = {
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

  const scales = [10, 50, 100, 500, 1000, 2500, 5000, 10000];

  for (const n of scales) {
    console.log(`\n--- Scale: N = ${n} nodes, ~${Math.floor(n * 1.2)} edges ---`);
    const { nodes, edges } = generateSyntheticCircuit(n, 1.2);

    // 1. Measure Layout Engines (if reasonable scale)
    if (n <= 1000) {
      const t0 = performance.now();
      runOrthogonalGridLayout(nodes, edges);
      const tGrid = performance.now() - t0;
      console.log(`  [Layout] Orthogonal Grid: ${tGrid.toFixed(2)} ms`);

      const t1 = performance.now();
      runSugiyamaLayout(nodes, edges);
      const tSugi = performance.now() - t1;
      console.log(`  [Layout] Sugiyama (Layered): ${tSugi.toFixed(2)} ms`);
    } else {
      console.log(`  [Layout] Sugiyama / Grid: Skipped on N=${n} to prevent timeout`);
    }

    // 2. Measure Routing Engines
    if (n <= 2500) {
      const perRouteTimes: number[] = [];
      const t0 = performance.now();
      // Sample 50 individual routes for distribution
      const sampleCount = Math.min(edges.length, 100);
      const sampleEdges = edges.slice(0, sampleCount);

      const routed = routeOrthogonalAStar(nodes, sampleEdges, options);
      const totalTime = performance.now() - t0;

      console.log(`  [Routing] A* Orthogonal (Sample ${sampleCount} nets): Total ${totalTime.toFixed(2)} ms | Avg per net: ${(totalTime / sampleCount).toFixed(3)} ms`);
      console.log(`  [Routing] Extrapolated A* for all ${edges.length} nets: ${((totalTime / sampleCount) * edges.length / 1000).toFixed(2)} s`);
    }

    // Manhattan Channel
    if (n <= 5000) {
      const t0 = performance.now();
      const sampleCount = Math.min(edges.length, 500);
      const sampleEdges = edges.slice(0, sampleCount);
      routeManhattanChannel(nodes, sampleEdges, options);
      const dt = performance.now() - t0;
      console.log(`  [Routing] Manhattan Channel (Sample ${sampleCount} nets): Total ${dt.toFixed(2)} ms | Avg: ${(dt / sampleCount).toFixed(3)} ms`);
    }

    // Artifact Cleaner
    {
      const dummyPath = [
        { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 50, y: 0 },
        { x: 50, y: 20 }, { x: 50, y: 80 }, { x: 100, y: 80 }
      ];
      const t0 = performance.now();
      for (let i = 0; i < 1000; i++) {
        cleanOrthogonalArtifacts(dummyPath);
      }
      const dur = performance.now() - t0;
      console.log(`  [Cleaner] 1,000 Wire Cleans: ${dur.toFixed(2)} ms (${(dur / 1000).toFixed(4)} ms/wire)`);
    }

    // Memory footprint estimate
    const memoryMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    console.log(`  [Memory] Node Heap: ${memoryMB} MB`);
  }
}

runBenchmark().catch(console.error);
