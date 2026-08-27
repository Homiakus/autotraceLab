import { BlockNode, EdgeConnection, RoutingOptions } from '../types';
import { routeOrthogonalAStar } from '../algorithms/orthogonalAStarRouter';
import { routeManhattanChannel } from '../algorithms/manhattanChannelRouter';
import { calculateBenchmarkMetrics, detectCollinearOverlaps } from '../algorithms/metrics';
import { computeOptimizedLabels } from '../algorithms/labelLayout';
import { DEFAULT_OPTIMIZATION_WEIGHTS } from '../data/weightPresets';
import { generateSyntheticCircuit } from './benchmark10k';

function computePercentiles(numbers: number[]) {
  if (numbers.length === 0) return { p50: 0, p95: 0, p99: 0, max: 0, min: 0, avg: 0 };
  const sorted = [...numbers].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const max = sorted[sorted.length - 1];
  const min = sorted[0];
  const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return {
    p50: +p50.toFixed(3),
    p95: +p95.toFixed(3),
    p99: +p99.toFixed(3),
    max: +max.toFixed(3),
    min: +min.toFixed(3),
    avg: +avg.toFixed(3),
  };
}

async function runDeepAudit() {
  console.log('====================================================================');
  console.log('  DEEP LATENCY & P95/P99 AUDIT ON 10,000 ELEMENT SCHEMATICS       ');
  console.log('====================================================================\n');

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

  console.log('Generating 10,000 Node / 12,000 Edge Circuit Graph...');
  const tGen = performance.now();
  const { nodes, edges } = generateSyntheticCircuit(10000, 1.2);
  console.log(`Generated in ${(performance.now() - tGen).toFixed(2)} ms. Total Nodes: ${nodes.length}, Total Edges: ${edges.length}`);

  // Test Individual Net Latencies for Manhattan Router
  console.log('\n--- 1. Manhattan Channel Router: Latency Distribution (500 sample nets) ---');
  const manhattanTimes: number[] = [];
  const testSample500 = edges.slice(0, 500);

  for (let i = 0; i < testSample500.length; i++) {
    const t0 = performance.now();
    routeManhattanChannel(nodes, [testSample500[i]], options);
    manhattanTimes.push(performance.now() - t0);
  }
  const manhattanStats = computePercentiles(manhattanTimes);
  console.log('Manhattan Channel Latencies (ms/net):', manhattanStats);
  console.log(`Throughput: ${(1000 / manhattanStats.avg).toFixed(0)} nets/sec`);

  // Test Individual Net Latencies for Orthogonal A* Router
  console.log('\n--- 2. Orthogonal A* Router: Latency Distribution (100 sample nets) ---');
  const aStarTimes: number[] = [];
  const testSample100 = edges.slice(0, 100);

  for (let i = 0; i < testSample100.length; i++) {
    const t0 = performance.now();
    routeOrthogonalAStar(nodes, [testSample100[i]], options);
    aStarTimes.push(performance.now() - t0);
  }
  const aStarStats = computePercentiles(aStarTimes);
  console.log('A* Orthogonal Latencies (ms/net):', aStarStats);
  console.log(`Throughput: ${(1000 / aStarStats.avg).toFixed(0)} nets/sec`);

  // Test Label Placement
  console.log('\n--- 3. Label Placement Algorithm (100 nets) ---');
  const routedSample = routeManhattanChannel(nodes, testSample100, options);
  const tLabel0 = performance.now();
  computeOptimizedLabels(nodes, routedSample);
  const labelTime = performance.now() - tLabel0;
  console.log(`Label Placement (100 labels): ${labelTime.toFixed(2)} ms (${(labelTime / 100).toFixed(3)} ms/label)`);

  // Memory Footprint
  const mem = process.memoryUsage();
  console.log('\n--- 4. Memory Footprint at 10,000 Elements ---');
  console.log(`RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
}

runDeepAudit().catch(console.error);
