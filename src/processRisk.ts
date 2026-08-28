import { GraphProcessBlock, analyzeGraphProcess } from './processGraphMath';
import {
  ProcessResource,
  ProcessSimulationOptions,
  ProcessSimulationResult,
  simulateResourceConstrainedProcess,
} from './processSimulation';

export type ProcessUncertaintyKind = 'fixed' | 'uniform' | 'triangular';

export interface ProcessBlockUncertainty {
  kind: ProcessUncertaintyKind;
  minFactor?: number;
  modeFactor?: number;
  maxFactor?: number;
}

export interface ProcessMonteCarloOptions {
  iterations: number;
  seed?: number;
  uncertaintyByBlock?: Record<string, ProcessBlockUncertainty>;
  slaMakespanSeconds?: number | null;
}

export interface ProcessMonteCarloDistribution {
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

export interface ProcessMonteCarloResult {
  ok: boolean;
  requestedIterations: number;
  completedIterations: number;
  makespanSeconds: ProcessMonteCarloDistribution;
  averageCycleSeconds: ProcessMonteCarloDistribution;
  throughputPerHour: ProcessMonteCarloDistribution;
  averageWaitSeconds: ProcessMonteCarloDistribution;
  slaProbabilityPercent: number | null;
  warnings: string[];
  errors: string[];
}

export interface ProcessCapacityScenario {
  resourceId: string;
  resourceName: string;
  baselineCapacity: number;
  candidateCapacity: number;
  baselineMakespanSeconds: number;
  candidateMakespanSeconds: number;
  makespanReductionPercent: number;
  baselineThroughputPerHour: number | null;
  candidateThroughputPerHour: number | null;
  throughputGainPercent: number;
  baselineAverageWaitSeconds: number;
  candidateAverageWaitSeconds: number;
  waitReductionPercent: number;
  baselineUtilizationPercent: number;
  candidateUtilizationPercent: number;
  score: number;
}

export interface ProcessCapacityPlannerResult {
  ok: boolean;
  baseline: ProcessSimulationResult;
  scenarios: ProcessCapacityScenario[];
  bestScenario: ProcessCapacityScenario | null;
  warnings: string[];
  errors: string[];
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampFactor(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Number(value));
}

function sampleFactor(random: () => number, uncertainty: ProcessBlockUncertainty | undefined): number {
  if (!uncertainty || uncertainty.kind === 'fixed') return 1;
  const min = clampFactor(uncertainty.minFactor, 0.9);
  const max = Math.max(min, clampFactor(uncertainty.maxFactor, 1.1));
  if (uncertainty.kind === 'uniform') return min + random() * (max - min);

  const mode = Math.min(max, Math.max(min, clampFactor(uncertainty.modeFactor, 1)));
  if (max === min) return min;
  const u = random();
  const split = (mode - min) / (max - min);
  if (u <= split) return min + Math.sqrt(u * (max - min) * (mode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function distribution(values: number[]): ProcessMonteCarloDistribution {
  if (!values.length) return { mean: 0, p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    p50: quantile(sorted, 0.5),
    p90: quantile(sorted, 0.9),
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

export function runProcessMonteCarlo(
  blocks: GraphProcessBlock[],
  simulationOptions: ProcessSimulationOptions,
  options: ProcessMonteCarloOptions,
): ProcessMonteCarloResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const iterations = Math.min(5000, Math.max(1, Math.floor(Number(options.iterations) || 1)));
  const random = mulberry32(Number.isFinite(options.seed) ? Number(options.seed) : 123456789);
  const baseAnalysis = analyzeGraphProcess(blocks, { batchSize: 1 });
  const baseSeconds: Record<string, number> = {};

  for (const block of blocks) {
    const result = baseAnalysis.results[block.id];
    if (!result || result.seconds == null) {
      errors.push(`Блок «${block.title}»: базовое время не разрешено${result?.error ? ` — ${result.error}` : ''}`);
    } else {
      baseSeconds[block.id] = result.seconds;
    }
  }

  if (baseAnalysis.stats.hasCycle) errors.push(`Monte Carlo невозможен: цикл DAG (${baseAnalysis.stats.cycleBlockIds.join(', ')})`);
  if (errors.length) {
    const empty = distribution([]);
    return {
      ok: false,
      requestedIterations: iterations,
      completedIterations: 0,
      makespanSeconds: empty,
      averageCycleSeconds: empty,
      throughputPerHour: empty,
      averageWaitSeconds: empty,
      slaProbabilityPercent: null,
      warnings,
      errors,
    };
  }

  const makespan: number[] = [];
  const averageCycle: number[] = [];
  const throughput: number[] = [];
  const averageWait: number[] = [];
  let slaHits = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const sampledBlocks: GraphProcessBlock[] = blocks.map(block => {
      const factor = sampleFactor(random, options.uncertaintyByBlock?.[block.id]);
      return {
        ...block,
        time: { value: baseSeconds[block.id] * factor, unit: 's' },
      };
    });

    const simulation = simulateResourceConstrainedProcess(sampledBlocks, simulationOptions);
    if (!simulation.ok) {
      warnings.push(`Итерация ${iteration + 1} пропущена: ${simulation.errors[0] || 'ошибка симуляции'}`);
      continue;
    }
    makespan.push(simulation.stats.makespanSeconds);
    averageCycle.push(simulation.stats.averageCycleSeconds);
    throughput.push(simulation.stats.throughputPerHour ?? 0);
    averageWait.push(simulation.stats.averageWaitSeconds);
    if (options.slaMakespanSeconds != null && simulation.stats.makespanSeconds <= options.slaMakespanSeconds) slaHits += 1;
  }

  const completedIterations = makespan.length;
  if (!completedIterations) errors.push('Ни одна Monte Carlo итерация не завершилась успешно');
  if (iterations > 2000) warnings.push('Большое число итераций может заметно нагружать браузер для крупных DAG/партий');

  return {
    ok: errors.length === 0,
    requestedIterations: iterations,
    completedIterations,
    makespanSeconds: distribution(makespan),
    averageCycleSeconds: distribution(averageCycle),
    throughputPerHour: distribution(throughput),
    averageWaitSeconds: distribution(averageWait),
    slaProbabilityPercent: options.slaMakespanSeconds != null && completedIterations
      ? (slaHits / completedIterations) * 100
      : null,
    warnings,
    errors,
  };
}

function percentChange(baseline: number, candidate: number, direction: 'increase' | 'decrease'): number {
  if (!Number.isFinite(baseline) || baseline === 0 || !Number.isFinite(candidate)) return 0;
  return direction === 'increase'
    ? ((candidate - baseline) / baseline) * 100
    : ((baseline - candidate) / baseline) * 100;
}

function utilizationFor(result: ProcessSimulationResult, resourceId: string): number {
  return result.resourceStats.find(resource => resource.id === resourceId)?.utilizationPercent ?? 0;
}

export function planNextResourceCapacity(
  blocks: GraphProcessBlock[],
  simulationOptions: ProcessSimulationOptions,
): ProcessCapacityPlannerResult {
  const baseline = simulateResourceConstrainedProcess(blocks, simulationOptions);
  const warnings = [...baseline.warnings];
  const errors = [...baseline.errors];
  if (!baseline.ok) return { ok: false, baseline, scenarios: [], bestScenario: null, warnings, errors };

  const scenarios: ProcessCapacityScenario[] = [];
  for (const resource of simulationOptions.resources) {
    const candidateResources: ProcessResource[] = simulationOptions.resources.map(item =>
      item.id === resource.id ? { ...item, capacity: Math.max(1, Math.floor(item.capacity)) + 1 } : { ...item },
    );
    const candidate = simulateResourceConstrainedProcess(blocks, {
      ...simulationOptions,
      resources: candidateResources,
    });
    if (!candidate.ok) {
      warnings.push(`Сценарий +1 «${resource.name}» пропущен: ${candidate.errors[0] || 'ошибка'}`);
      continue;
    }

    const makespanReductionPercent = percentChange(
      baseline.stats.makespanSeconds,
      candidate.stats.makespanSeconds,
      'decrease',
    );
    const throughputGainPercent = percentChange(
      baseline.stats.throughputPerHour ?? 0,
      candidate.stats.throughputPerHour ?? 0,
      'increase',
    );
    const waitReductionPercent = percentChange(
      baseline.stats.averageWaitSeconds,
      candidate.stats.averageWaitSeconds,
      'decrease',
    );

    scenarios.push({
      resourceId: resource.id,
      resourceName: resource.name,
      baselineCapacity: resource.capacity,
      candidateCapacity: resource.capacity + 1,
      baselineMakespanSeconds: baseline.stats.makespanSeconds,
      candidateMakespanSeconds: candidate.stats.makespanSeconds,
      makespanReductionPercent,
      baselineThroughputPerHour: baseline.stats.throughputPerHour,
      candidateThroughputPerHour: candidate.stats.throughputPerHour,
      throughputGainPercent,
      baselineAverageWaitSeconds: baseline.stats.averageWaitSeconds,
      candidateAverageWaitSeconds: candidate.stats.averageWaitSeconds,
      waitReductionPercent,
      baselineUtilizationPercent: utilizationFor(baseline, resource.id),
      candidateUtilizationPercent: utilizationFor(candidate, resource.id),
      score: makespanReductionPercent * 0.45 + throughputGainPercent * 0.4 + Math.max(0, waitReductionPercent) * 0.15,
    });
  }

  scenarios.sort((a, b) => b.score - a.score || b.throughputGainPercent - a.throughputGainPercent);
  return {
    ok: true,
    baseline,
    scenarios,
    bestScenario: scenarios[0] || null,
    warnings,
    errors,
  };
}
