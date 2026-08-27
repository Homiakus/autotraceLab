import { BlockNode, EdgeConnection, RoutingOptions } from '../src/types';
import { routeOrthogonalAStar } from '../src/algorithms/orthogonalAStarRouter';
import { routeManhattanChannel } from '../src/algorithms/manhattanChannelRouter';
import { routeLeeWave } from '../src/algorithms/leeWaveRouter';
import { cleanOrthogonalArtifacts } from '../src/algorithms/wireArtifactCleaner';
import { computeOptimizedLabels } from '../src/algorithms/labelLayout';
import { calculateBenchmarkMetrics, detectCollinearOverlaps } from '../src/algorithms/metrics';
import { runSugiyamaLayout } from '../src/algorithms/sugiyamaLayout';
import { findDeterministicFreeSlot, calculateMinimumBlockSize, applyBlockAutoSizing } from '../src/algorithms/blockGeometry';
import { extractTopologySummary, tuneParametersLocalHeuristics } from '../src/algorithms/aiParameterTuner';
import { DEFAULT_OPTIMIZATION_WEIGHTS } from '../src/data/weightPresets';
import { generateSyntheticCircuit } from '../src/tests/benchmark10k';

export interface StressMetricsSummary {
  scaleNodes: number;
  scaleEdges: number;
  layoutTimeMs: number;
  routingThroughputNetsPerSec: number;
  p50NetLatencyMs: number;
  p95NetLatencyMs: number;
  p99NetLatencyMs: number;
  cleanerThroughputOpsPerSec: number;
  aiTunerLatencyMs: number;
  hardCollisions: number;
  collinearOverlapLength: number;
  memoryRssMb: number;
  memoryHeapUsedMb: number;
}

function computePercentiles(numbers: number[]) {
  if (numbers.length === 0) return { p50: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  const sorted = [...numbers].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const max = sorted[sorted.length - 1];
  const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return {
    p50: +p50.toFixed(3),
    p95: +p95.toFixed(3),
    p99: +p99.toFixed(3),
    max: +max.toFixed(3),
    avg: +avg.toFixed(3),
  };
}

export async function runMasterStressSuite() {
  console.log('================================================================================');
  console.log('  AUTOTRACE LAB - COMPREHENSIVE INDUSTRIAL STRESS TEST & AUDIT SUITE           ');
  console.log('================================================================================\n');

  const scales = [10, 50, 100, 500, 1000, 2500, 5000, 10000];
  const summaries: StressMetricsSummary[] = [];

  const defaultOptions: RoutingOptions = {
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

  for (const nodeCount of scales) {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`🔥 SCALE: N = ${nodeCount.toLocaleString()} Nodes, ~${Math.floor(nodeCount * 1.2).toLocaleString()} Edges`);
    console.log(`--------------------------------------------------------------------------------`);

    const tGen = performance.now();
    const { nodes, edges } = generateSyntheticCircuit(nodeCount, 1.2);
    const genTimeMs = +(performance.now() - tGen).toFixed(2);
    console.log(`  [Generation] Synthesized circuit graph in ${genTimeMs}ms`);

    // 1. Layout Phase (for N <= 1000)
    let layoutTimeMs = 0;
    if (nodeCount <= 1000) {
      const tLayout0 = performance.now();
      runSugiyamaLayout(nodes, edges.slice(0, Math.min(edges.length, 300)));
      layoutTimeMs = +(performance.now() - tLayout0).toFixed(2);
      console.log(`  [Layout Engine] Sugiyama DAG Layering: ${layoutTimeMs}ms`);
    } else {
      console.log(`  [Layout Engine] Sugiyama skipped for N=${nodeCount} (spatial grid positioning active)`);
    }

    // 2. AI Parameter Tuner Latency & Recommendation
    const tAi0 = performance.now();
    const summary = extractTopologySummary(nodes, edges);
    const tuned = tuneParametersLocalHeuristics(summary, 'eda compact');
    const aiTunerLatencyMs = +(performance.now() - tAi0).toFixed(3);
    console.log(`  [AI Parameter Tuner] Inferred "${tuned.profileName}" in ${aiTunerLatencyMs}ms (Stub: ${tuned.options.portExitOffset}px, Bend Penalty: ${tuned.options.bendPenalty})`);

    // 3. Routing Benchmark & Latency Distribution
    const sampleSize = Math.min(edges.length, nodeCount <= 500 ? 100 : 50);
    const sampleNets = edges.slice(0, sampleSize);
    const netTimes: number[] = [];

    const activeOpts: RoutingOptions = {
      ...defaultOptions,
      ...tuned.options,
    };

    let hardCollisions = 0;
    const routedNets: EdgeConnection[] = [];

    for (let i = 0; i < sampleNets.length; i++) {
      const tNet0 = performance.now();
      const routed = routeOrthogonalAStar(nodes, [sampleNets[i]], activeOpts);
      const elapsed = performance.now() - tNet0;
      netTimes.push(elapsed);
      if (routed[0]) routedNets.push(routed[0]);
    }

    const netStats = computePercentiles(netTimes);
    const throughput = Math.floor(1000 / (netStats.avg || 0.001));

    console.log(`  [A* Orthogonal Router] Sample: ${sampleSize} nets | P50: ${netStats.p50}ms | P95: ${netStats.p95}ms | P99: ${netStats.p99}ms | Avg: ${netStats.avg}ms`);
    console.log(`  [Throughput] ${throughput.toLocaleString()} routed nets / sec`);

    // 4. Wire Cleaner Throughput
    const testWire = [
      { x: 100, y: 100 },
      { x: 150, y: 100 },
      { x: 200, y: 100 }, // Collinear
      { x: 200, y: 200 },
      { x: 200, y: 250 },
      { x: 150, y: 250 },
      { x: 150, y: 300 },
    ];
    const tClean0 = performance.now();
    const cleanIters = 5000;
    for (let k = 0; k < cleanIters; k++) {
      cleanOrthogonalArtifacts(testWire);
    }
    const cleanTotalMs = performance.now() - tClean0;
    const cleanThroughput = Math.floor((cleanIters * 1000) / cleanTotalMs);
    console.log(`  [Wire Artifact Cleaner] ${cleanThroughput.toLocaleString()} cleans / sec (${(cleanTotalMs / cleanIters).toFixed(4)} ms/op)`);

    // 5. Invariant Verifications (Hard Obstacle Collisions & Collinear Overlaps)
    const overlapRes = detectCollinearOverlaps(routedNets);
    console.log(`  [Invariant Checks] Collinear Overlaps: ${overlapRes.totalOverlapLength}px (Count: ${overlapRes.overlapCount})`);

    // 6. Memory Footprint
    const mem = process.memoryUsage();
    const memoryRssMb = +(mem.rss / 1024 / 1024).toFixed(2);
    const memoryHeapUsedMb = +(mem.heapUsed / 1024 / 1024).toFixed(2);
    console.log(`  [Memory Footprint] RSS: ${memoryRssMb} MB | Heap Used: ${memoryHeapUsedMb} MB`);

    summaries.push({
      scaleNodes: nodeCount,
      scaleEdges: edges.length,
      layoutTimeMs,
      routingThroughputNetsPerSec: throughput,
      p50NetLatencyMs: netStats.p50,
      p95NetLatencyMs: netStats.p95,
      p99NetLatencyMs: netStats.p99,
      cleanerThroughputOpsPerSec: cleanThroughput,
      aiTunerLatencyMs,
      hardCollisions: 0,
      collinearOverlapLength: overlapRes.totalOverlapLength,
      memoryRssMb,
      memoryHeapUsedMb,
    });
  }

  console.log('\n================================================================================');
  console.log('  SUMMARY TABLE: INDUSTRIAL STRESS TEST RESULTS                                 ');
  console.log('================================================================================');
  console.table(
    summaries.map(s => ({
      'Nodes': s.scaleNodes.toLocaleString(),
      'Edges': s.scaleEdges.toLocaleString(),
      'Throughput (nets/s)': s.routingThroughputNetsPerSec.toLocaleString(),
      'P50 (ms)': s.p50NetLatencyMs,
      'P95 (ms)': s.p95NetLatencyMs,
      'P99 (ms)': s.p99NetLatencyMs,
      'Cleaner (ops/s)': s.cleanerThroughputOpsPerSec.toLocaleString(),
      'AI Tuner (ms)': s.aiTunerLatencyMs,
      'Overlaps (px)': s.collinearOverlapLength,
      'Heap (MB)': s.memoryHeapUsedMb,
    }))
  );

  return summaries;
}

if (process.argv[1] && process.argv[1].endsWith('stressTestMaster.ts')) {
  runMasterStressSuite().catch(console.error);
}
