import { BlockNode, EdgeConnection, RoutingOptions, PortSide, Port } from '../src/types';
import { routeOrthogonalAStar } from '../src/algorithms/orthogonalAStarRouter';
import { routeManhattanChannel } from '../src/algorithms/manhattanChannelRouter';
import { routeLeeWave } from '../src/algorithms/leeWaveRouter';
import { cleanOrthogonalArtifacts } from '../src/algorithms/wireArtifactCleaner';
import { computeOptimizedLabels } from '../src/algorithms/labelLayout';
import { detectCollinearOverlaps } from '../src/algorithms/metrics';
import { runSugiyamaLayout } from '../src/algorithms/sugiyamaLayout';
import { extractTopologySummary, tuneParametersLocalHeuristics } from '../src/algorithms/aiParameterTuner';
import { DEFAULT_OPTIMIZATION_WEIGHTS } from '../src/data/weightPresets';

export interface FuzzRunAnomaly {
  runIndex: number;
  seed: number;
  circuitTopology: string;
  errorType: string;
  message: string;
  details: any;
}

export interface FuzzReport {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  totalNetsRouted: number;
  totalCollinearOverlapsFound: number;
  totalObstaclePenetrationsFound: number;
  totalNanOrNullPointsFound: number;
  anomalies: FuzzRunAnomaly[];
  durationMs: number;
}

/**
 * Seeded Pseudo-Random Number Generator (Mulberry32) for reproducible fuzzing
 */
function createRng(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates an adversarial, randomized diagram topology for fuzzing
 */
function generateRandomCircuit(runIndex: number, rng: () => number): { nodes: BlockNode[]; edges: EdgeConnection[]; options: RoutingOptions } {
  const nodeCount = Math.floor(rng() * 20) + 3; // 3 to 22 nodes
  const nodes: BlockNode[] = [];
  const sides: PortSide[] = ['left', 'right', 'top', 'bottom'];

  for (let i = 0; i < nodeCount; i++) {
    const w = Math.floor(rng() * 120) + 60; // 60 to 180px
    const h = Math.floor(rng() * 100) + 50; // 50 to 150px
    const x = Math.floor(rng() * 800) + 50;
    const y = Math.floor(rng() * 600) + 50;

    const inputCount = Math.floor(rng() * 5) + 1; // 1 to 5
    const outputCount = Math.floor(rng() * 5) + 1; // 1 to 5

    const inputs: Port[] = [];
    for (let p = 0; p < inputCount; p++) {
      inputs.push({
        id: `in_${i}_${p}`,
        name: `IN_${p}`,
        type: 'input',
        side: sides[Math.floor(rng() * sides.length)],
        relativePosition: Number(rng().toFixed(2)),
      });
    }

    const outputs: Port[] = [];
    for (let p = 0; p < outputCount; p++) {
      outputs.push({
        id: `out_${i}_${p}`,
        name: `OUT_${p}`,
        type: 'output',
        side: sides[Math.floor(rng() * sides.length)],
        relativePosition: Number(rng().toFixed(2)),
      });
    }

    nodes.push({
      id: `node_${i}`,
      title: `Block_${i}`,
      category: i === 0 ? 'source' : i === nodeCount - 1 ? 'sink' : 'processor',
      x,
      y,
      width: w,
      height: h,
      inputs,
      outputs,
    });
  }

  // Generate dense, multi-hop, cross-layer edges
  const edgeCount = Math.floor(rng() * nodeCount * 2) + 2;
  const edges: EdgeConnection[] = [];

  for (let e = 0; e < edgeCount; e++) {
    const srcIdx = Math.floor(rng() * nodeCount);
    let tgtIdx = Math.floor(rng() * nodeCount);
    if (tgtIdx === srcIdx) tgtIdx = (srcIdx + 1) % nodeCount;

    const srcNode = nodes[srcIdx];
    const tgtNode = nodes[tgtIdx];

    const srcPort = srcNode.outputs[Math.floor(rng() * srcNode.outputs.length)];
    const tgtPort = tgtNode.inputs[Math.floor(rng() * tgtNode.inputs.length)];

    if (srcPort && tgtPort) {
      edges.push({
        id: `edge_${runIndex}_${e}`,
        sourceBlockId: srcNode.id,
        sourcePortId: srcPort.id,
        targetBlockId: tgtNode.id,
        targetPortId: tgtPort.id,
        label: rng() > 0.5 ? `SIG_${e}` : undefined,
      });
    }
  }

  // Generate randomized Routing Options (with extreme/adversarial boundaries)
  const options: RoutingOptions = {
    gridSize: Math.floor(rng() * 15) + 5, // 5 to 20
    obstacleClearance: Math.floor(rng() * 30) + 5, // 5 to 35
    bendPenalty: Math.floor(rng() * 70) + 10, // 10 to 80
    crossingPenalty: Math.floor(rng() * 40) + 10,
    channelSpacing: Math.floor(rng() * 25) + 8, // 8 to 33
    portExitOffset: Math.floor(rng() * 30) + 10, // 10 to 40
    adaptivePortExitOffset: rng() > 0.3,
    smoothCorners: rng() > 0.2,
    cornerRadius: Math.floor(rng() * 20),
    adaptiveCornerRadius: rng() > 0.3,
    labelClearance: Math.floor(rng() * 20) + 8,
    jumpBridges: rng() > 0.5,
    pinAlignment: rng() > 0.3,
    artifactCleaning: true,
    weights: DEFAULT_OPTIMIZATION_WEIGHTS,
  };

  return { nodes, edges, options };
}

export async function runFuzz1000(customRuns?: number): Promise<FuzzReport> {
  const totalRuns = customRuns || parseInt(process.argv[2] || '1000', 10);
  console.log('================================================================================');
  console.log(`  AUTOTRACE LAB - ${totalRuns.toLocaleString()} RUN DEEP ADVERSARIAL FUZZING & ANOMALY DETECTOR`);
  console.log('================================================================================\n');

  const anomalies: FuzzRunAnomaly[] = [];
  let totalNetsRouted = 0;
  let totalCollinearOverlapsFound = 0;
  let totalObstaclePenetrationsFound = 0;
  let totalNanOrNullPointsFound = 0;

  const tStart = performance.now();

  for (let run = 1; run <= totalRuns; run++) {
    const seed = 1337 + run * 7919;
    const rng = createRng(seed);

    const { nodes, edges, options } = generateRandomCircuit(run, rng);

    try {
      // 1. Layout Phase: Sugiyama Framework
      const laidOut = runSugiyamaLayout(nodes, edges);

      // 2. AI Parameter Tuner Phase
      const summary = extractTopologySummary(laidOut.nodes, edges);
      const tuned = tuneParametersLocalHeuristics(summary, 'balanced');

      // Verify AI tuning outputs are within safe boundaries
      if (
        (tuned.options.obstacleClearance ?? 0) < 5 ||
        (tuned.options.obstacleClearance ?? 0) > 35 ||
        (tuned.options.channelSpacing ?? 0) < 8 ||
        (tuned.options.channelSpacing ?? 0) > 40
      ) {
        anomalies.push({
          runIndex: run,
          seed,
          circuitTopology: `Nodes: ${nodes.length}, Edges: ${edges.length}`,
          errorType: 'AI_TUNER_OUT_OF_BOUNDS',
          message: 'AI parameter recommendation generated out-of-bounds parameters',
          details: tuned.options,
        });
      }

      // Merge options
      const activeOptions: RoutingOptions = {
        ...options,
        ...tuned.options,
      };

      // 3. Routing Phase: Orthogonal A* Router
      const routedEdges = routeOrthogonalAStar(laidOut.nodes, edges, activeOptions);
      totalNetsRouted += routedEdges.length;

      // 4. Label Placement Phase
      const labelMap = computeOptimizedLabels(laidOut.nodes, routedEdges);

      // 5. Invariant Checks on every net
      for (const edge of routedEdges) {
        if (!edge.path || edge.path.length === 0) {
          anomalies.push({
            runIndex: run,
            seed,
            circuitTopology: `Nodes: ${nodes.length}, Edges: ${edges.length}`,
            errorType: 'EMPTY_PATH',
            message: `Edge ${edge.id} has empty or missing path`,
            details: edge,
          });
          continue;
        }

        // Invariant A: No NaN or Infinite coordinates
        for (let ptIdx = 0; ptIdx < edge.path.length; ptIdx++) {
          const pt = edge.path[ptIdx];
          if (
            pt === null ||
            pt === undefined ||
            typeof pt.x !== 'number' ||
            typeof pt.y !== 'number' ||
            isNaN(pt.x) ||
            isNaN(pt.y) ||
            !isFinite(pt.x) ||
            !isFinite(pt.y)
          ) {
            totalNanOrNullPointsFound++;
            anomalies.push({
              runIndex: run,
              seed,
              circuitTopology: `Nodes: ${nodes.length}, Edges: ${edges.length}`,
              errorType: 'NAN_OR_NULL_COORDINATE',
              message: `Edge ${edge.id} point[${ptIdx}] has NaN/Invalid coordinate`,
              details: { point: pt, edgeId: edge.id },
            });
          }
        }

        // Invariant B: No Obstacle Penetration through unassociated blocks
        for (let i = 0; i < edge.path.length - 1; i++) {
          const p1 = edge.path[i];
          const p2 = edge.path[i + 1];
          const segMinX = Math.min(p1.x, p2.x);
          const segMaxX = Math.max(p1.x, p2.x);
          const segMinY = Math.min(p1.y, p2.y);
          const segMaxY = Math.max(p1.y, p2.y);

          for (const node of laidOut.nodes) {
            // If node is neither the source nor target block of this edge
            if (node.id !== edge.sourceBlockId && node.id !== edge.targetBlockId) {
              if (
                segMaxX > node.x + 1 &&
                segMinX < node.x + node.width - 1 &&
                segMaxY > node.y + 1 &&
                segMinY < node.y + node.height - 1
              ) {
                totalObstaclePenetrationsFound++;
                anomalies.push({
                  runIndex: run,
                  seed,
                  circuitTopology: `Nodes: ${nodes.length}, Edges: ${edges.length}`,
                  errorType: 'OBSTACLE_PENETRATION',
                  message: `Edge ${edge.id} segment (${p1.x},${p1.y})->(${p2.x},${p2.y}) penetrated body of node ${node.id}`,
                  details: { segment: [p1, p2], obstacle: node },
                });
              }
            }
          }
        }
      }

      // Invariant C: Collinear Overlaps Check
      const overlapAnalysis = detectCollinearOverlaps(routedEdges);
      if (overlapAnalysis.totalOverlapLength > 0) {
        totalCollinearOverlapsFound++;
        anomalies.push({
          runIndex: run,
          seed,
          circuitTopology: `Nodes: ${nodes.length}, Edges: ${edges.length}`,
          errorType: 'COLLINEAR_OVERLAP',
          message: `Detected ${overlapAnalysis.overlapCount} collinear wire overlaps (Total length: ${overlapAnalysis.totalOverlapLength}px)`,
          details: overlapAnalysis,
        });
      }

      // Invariant D: Wire Cleaner Stability
      for (const edge of routedEdges) {
        if (edge.path && edge.path.length >= 2) {
          const cleaned = cleanOrthogonalArtifacts(edge.path);
          if (cleaned.length < 2) {
            anomalies.push({
              runIndex: run,
              seed,
              circuitTopology: `Nodes: ${nodes.length}, Edges: ${edges.length}`,
              errorType: 'CLEANER_COLLAPSED_PATH',
              message: `Wire cleaner reduced path below 2 endpoints on edge ${edge.id}`,
              details: { before: edge.path, after: cleaned },
            });
          }
        }
      }

      // Invariant E: Label Placement Finite Coordinates
      for (const [edgeId, labelPos] of labelMap.entries()) {
        if (
          isNaN(labelPos.x) ||
          isNaN(labelPos.y) ||
          !isFinite(labelPos.x) ||
          !isFinite(labelPos.y)
        ) {
          anomalies.push({
            runIndex: run,
            seed,
            circuitTopology: `Nodes: ${nodes.length}, Edges: ${edges.length}`,
            errorType: 'LABEL_INVALID_COORDINATE',
            message: `Label for edge ${edgeId} has NaN/Invalid coordinates (${labelPos.x}, ${labelPos.y})`,
            details: labelPos,
          });
        }
      }

    } catch (err: any) {
      anomalies.push({
        runIndex: run,
        seed,
        circuitTopology: `Nodes: ${nodes.length}, Edges: ${edges.length}`,
        errorType: 'UNHANDLED_EXCEPTION',
        message: err?.message || 'Unhandled crash during run',
        details: { stack: err?.stack },
      });
    }

    // Progress report every 5%
    const reportInterval = Math.max(10, Math.floor(totalRuns / 20));
    if (run % reportInterval === 0 || run === totalRuns) {
      const elapsedMs = performance.now() - tStart;
      const progressPercent = ((run / totalRuns) * 100).toFixed(0);
      const runsPerSec = ((run * 1000) / elapsedMs).toFixed(0);
      console.log(`⏱️ [${progressPercent}%] Completed ${run.toLocaleString()}/${totalRuns.toLocaleString()} runs (${runsPerSec} runs/sec) | Anomalies so far: ${anomalies.length}`);
    }
  }

  const durationMs = +(performance.now() - tStart).toFixed(2);
  const failedRuns = new Set(anomalies.map(a => a.runIndex)).size;
  const passedRuns = totalRuns - failedRuns;

  const report: FuzzReport = {
    totalRuns,
    passedRuns,
    failedRuns,
    totalNetsRouted,
    totalCollinearOverlapsFound,
    totalObstaclePenetrationsFound,
    totalNanOrNullPointsFound,
    anomalies,
    durationMs,
  };

  console.log('\n================================================================================');
  console.log(`  ${totalRuns.toLocaleString()} RUN FUZZING AUDIT REPORT`);
  console.log('================================================================================');
  console.log(`  Total Fuzz Runs Executed:       ${totalRuns.toLocaleString()}`);
  console.log(`  Passed Runs (100% Invariants):  ${passedRuns.toLocaleString()} / ${totalRuns.toLocaleString()} (${((passedRuns / totalRuns) * 100).toFixed(2)}%)`);
  console.log(`  Failed Runs with Anomalies:     ${failedRuns.toLocaleString()}`);
  console.log(`  Total Nets Routed & Audited:    ${totalNetsRouted.toLocaleString()}`);
  console.log(`  Obstacle Body Penetrations:     ${totalObstaclePenetrationsFound}`);
  console.log(`  Collinear Overlaps:             ${totalCollinearOverlapsFound}`);
  console.log(`  NaN / Null Coordinates:         ${totalNanOrNullPointsFound}`);
  console.log(`  Execution Duration:             ${durationMs} ms (${(totalRuns / (durationMs / 1000)).toFixed(0)} runs/sec)`);

  if (anomalies.length > 0) {
    console.log('\n⚠️ Anomalies Discovered:');
    console.table(anomalies.slice(0, 10));
  } else {
    console.log(`\n🎉 ZERO ANOMALIES FOUND! ${totalRuns.toLocaleString()}/${totalRuns.toLocaleString()} runs strictly satisfied all invariants.`);
  }

  return report;
}

if (process.argv[1] && process.argv[1].endsWith('fuzz1000Runs.ts')) {
  runFuzz1000().catch(console.error);
}
