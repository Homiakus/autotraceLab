import { GraphProcessBlock, analyzeGraphProcess } from './processGraphMath';
import { ProcessBlockUncertainty } from './processRisk';
import {
  ProcessBatchSimulationOptions,
  simulateBatchCycleProcess,
} from './processBatchSimulation';

export interface BatchMonteCarloOptions {
  iterations: number;
  seed?: number;
  uncertaintyByBlock?: Record<string, ProcessBlockUncertainty>;
  slaMakespanSeconds?: number | null;
}

export interface BatchMonteCarloDistribution {
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

export interface BatchMonteCarloResult {
  ok: boolean;
  requestedIterations: number;
  completedIterations: number;
  makespanSeconds: BatchMonteCarloDistribution;
  averageCycleSeconds: BatchMonteCarloDistribution;
  throughputPerHour: BatchMonteCarloDistribution;
  averageWaitSeconds: BatchMonteCarloDistribution;
  averageBatchFillPercent: BatchMonteCarloDistribution;
  partialBatchCycles: BatchMonteCarloDistribution;
  batchCycles: BatchMonteCarloDistribution;
  slaProbabilityPercent: number | null;
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
  return u <= split
    ? min + Math.sqrt(u * (max - min) * (mode - min))
    : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
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

function distribution(values: number[]): BatchMonteCarloDistribution {
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

export function runBatchProcessMonteCarlo(
  blocks: GraphProcessBlock[],
  simulationOptions: ProcessBatchSimulationOptions,
  options: BatchMonteCarloOptions,
): BatchMonteCarloResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const iterations = Math.min(5000, Math.max(1, Math.floor(Number(options.iterations) || 1)));
  const random = mulberry32(Number.isFinite(options.seed) ? Number(options.seed) : 20260828);
  const baseAnalysis = analyzeGraphProcess(blocks, { batchSize: 1 });
  const baseSeconds: Record<string, number> = {};

  if (baseAnalysis.stats.hasCycle) errors.push(`Batch Monte Carlo невозможен: цикл DAG (${baseAnalysis.stats.cycleBlockIds.join(', ')})`);
  for (const block of blocks) {
    const result = baseAnalysis.results[block.id];
    if (!result || result.seconds == null) errors.push(`Блок «${block.title}»: базовое время не разрешено${result?.error ? ` — ${result.error}` : ''}`);
    else baseSeconds[block.id] = result.seconds;
  }

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
      averageBatchFillPercent: empty,
      partialBatchCycles: empty,
      batchCycles: empty,
      slaProbabilityPercent: null,
      warnings,
      errors,
    };
  }

  const makespan: number[] = [];
  const cycle: number[] = [];
  const throughput: number[] = [];
  const wait: number[] = [];
  const fill: number[] = [];
  const partial: number[] = [];
  const cycles: number[] = [];
  let slaHits = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const sampledBlocks: GraphProcessBlock[] = blocks.map(block => ({
      ...block,
      time: {
        value: baseSeconds[block.id] * sampleFactor(random, options.uncertaintyByBlock?.[block.id]),
        unit: 's',
      },
    }));
    const simulation = simulateBatchCycleProcess(sampledBlocks, simulationOptions);
    if (!simulation.ok) {
      if (warnings.length < 20) warnings.push(`Итерация ${iteration + 1} пропущена: ${simulation.errors[0] || 'ошибка batch simulation'}`);
      continue;
    }
    makespan.push(simulation.stats.makespanSeconds);
    cycle.push(simulation.stats.averageCycleSeconds);
    throughput.push(simulation.stats.throughputPerHour ?? 0);
    wait.push(simulation.stats.averageWaitSeconds);
    fill.push(simulation.stats.averageBatchFillPercent);
    partial.push(simulation.stats.partialBatchCycles);
    cycles.push(simulation.stats.batchCycles);
    if (options.slaMakespanSeconds != null && simulation.stats.makespanSeconds <= options.slaMakespanSeconds) slaHits += 1;
  }

  const completedIterations = makespan.length;
  if (!completedIterations) errors.push('Ни одна batch Monte Carlo итерация не завершилась успешно');
  if (!(simulationOptions.batchConfigs?.length)) warnings.push('Batch-конфигурации отсутствуют: batch-specific метрики будут нулевыми');
  if (iterations > 2000) warnings.push('Большое число итераций может заметно нагружать браузер для крупных партий');

  return {
    ok: errors.length === 0,
    requestedIterations: iterations,
    completedIterations,
    makespanSeconds: distribution(makespan),
    averageCycleSeconds: distribution(cycle),
    throughputPerHour: distribution(throughput),
    averageWaitSeconds: distribution(wait),
    averageBatchFillPercent: distribution(fill),
    partialBatchCycles: distribution(partial),
    batchCycles: distribution(cycles),
    slaProbabilityPercent: options.slaMakespanSeconds != null && completedIterations
      ? (slaHits / completedIterations) * 100
      : null,
    warnings,
    errors,
  };
}
