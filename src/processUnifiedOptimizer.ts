import { GraphProcessBlock } from './processGraphMath';
import { ProcessBatchConfig } from './processBatchSimulation';
import {
  UnifiedTwinOptions,
  UnifiedTwinResult,
  simulateUnifiedStochasticBatchTwin,
} from './processUnifiedTwin';

export interface UnifiedBatchPolicySearch {
  blockId: string;
  minBatchValues?: number[];
  maxWaitValuesSeconds?: number[];
}

export interface UnifiedOptimizerWeights {
  throughput: number;
  p95Cycle: number;
  averageWait: number;
  batchFill: number;
  partialCycles: number;
  sla: number;
}

export interface UnifiedOptimizerOptions {
  searches: UnifiedBatchPolicySearch[];
  maxScenarios?: number;
  slaP95CycleSeconds?: number | null;
  weights?: Partial<UnifiedOptimizerWeights>;
}

export interface UnifiedOptimizerScenario {
  rank: number;
  score: number;
  configs: ProcessBatchConfig[];
  simulation: UnifiedTwinResult;
  slaMet: boolean | null;
  pareto: boolean;
}

export interface UnifiedOptimizerResult {
  ok: boolean;
  baseline: UnifiedTwinResult;
  scenarios: UnifiedOptimizerScenario[];
  best: UnifiedOptimizerScenario | null;
  pareto: UnifiedOptimizerScenario[];
  generatedScenarios: number;
  evaluatedScenarios: number;
  warnings: string[];
  errors: string[];
}

const DEFAULT_WEIGHTS: UnifiedOptimizerWeights = {
  throughput: 0.20,
  p95Cycle: 0.20,
  averageWait: 0.15,
  batchFill: 0.20,
  partialCycles: 0.10,
  sla: 0.15,
};

function uniqueNumbers(values: number[], min = 0): number[] {
  return Array.from(new Set(values.map(value => Math.max(min, Number(value) || 0)))).sort((a, b) => a - b);
}

function normalizeWeights(weights: Partial<UnifiedOptimizerWeights> | undefined): UnifiedOptimizerWeights {
  const merged: UnifiedOptimizerWeights = { ...DEFAULT_WEIGHTS, ...(weights || {}) };
  const entries = Object.entries(merged) as Array<[keyof UnifiedOptimizerWeights, number]>;
  let total = 0;
  for (const [key, value] of entries) {
    merged[key] = Math.max(0, Number(value) || 0);
    total += merged[key];
  }
  if (total <= 0) return { ...DEFAULT_WEIGHTS };
  for (const [key] of entries) merged[key] /= total;
  return merged;
}

function candidateConfigs(baseConfigs: ProcessBatchConfig[], search: UnifiedBatchPolicySearch): ProcessBatchConfig[][] {
  const target = baseConfigs.find(config => config.blockId === search.blockId);
  if (!target) return [];
  const capacity = Math.max(1, Math.floor(target.batchCapacity));
  const minValues = uniqueNumbers(
    search.minBatchValues?.length
      ? search.minBatchValues
      : [1, Math.ceil(capacity / 2), capacity],
    1,
  ).map(value => Math.min(capacity, Math.max(1, Math.floor(value))));
  const waits = uniqueNumbers(
    search.maxWaitValuesSeconds?.length
      ? search.maxWaitValuesSeconds
      : [0, 60, 300, 600, 1200],
    0,
  );
  const result: ProcessBatchConfig[][] = [];
  for (const minBatchSize of Array.from(new Set(minValues))) {
    for (const maxWaitSeconds of waits) {
      result.push(baseConfigs.map(config => config.blockId === search.blockId
        ? { ...config, minBatchSize, maxWaitSeconds }
        : { ...config }));
    }
  }
  return result;
}

function combineSearches(baseConfigs: ProcessBatchConfig[], searches: UnifiedBatchPolicySearch[]): ProcessBatchConfig[][] {
  let combinations: ProcessBatchConfig[][] = [baseConfigs.map(config => ({ ...config }))];
  for (const search of searches) {
    const variants = candidateConfigs(baseConfigs, search);
    if (!variants.length) continue;
    const next: ProcessBatchConfig[][] = [];
    for (const current of combinations) {
      for (const variant of variants) {
        const patch = variant.find(config => config.blockId === search.blockId)!;
        next.push(current.map(config => config.blockId === search.blockId ? { ...patch } : { ...config }));
      }
    }
    combinations = next;
  }
  const seen = new Set<string>();
  return combinations.filter(configs => {
    const key = JSON.stringify(configs.map(config => [config.blockId, config.batchCapacity, config.minBatchSize, config.maxWaitSeconds]));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function minMax(values: number[]): { min: number; max: number } {
  if (!values.length) return { min: 0, max: 0 };
  return { min: Math.min(...values), max: Math.max(...values) };
}

function higherBetter(value: number, range: { min: number; max: number }): number {
  if (range.max <= range.min) return 1;
  return (value - range.min) / (range.max - range.min);
}

function lowerBetter(value: number, range: { min: number; max: number }): number {
  return 1 - higherBetter(value, range);
}

function partialRate(result: UnifiedTwinResult): number {
  return result.stats.batchCycles > 0 ? result.stats.partialBatchCycles / result.stats.batchCycles : 0;
}

function dominates(a: UnifiedOptimizerScenario, b: UnifiedOptimizerScenario): boolean {
  const aStats = a.simulation.stats;
  const bStats = b.simulation.stats;
  const noWorse =
    (aStats.throughputPerHour || 0) >= (bStats.throughputPerHour || 0) &&
    aStats.p95CycleSeconds <= bStats.p95CycleSeconds &&
    aStats.averageWaitSeconds <= bStats.averageWaitSeconds &&
    aStats.averageBatchFillPercent >= bStats.averageBatchFillPercent &&
    partialRate(a.simulation) <= partialRate(b.simulation);
  const strictlyBetter =
    (aStats.throughputPerHour || 0) > (bStats.throughputPerHour || 0) ||
    aStats.p95CycleSeconds < bStats.p95CycleSeconds ||
    aStats.averageWaitSeconds < bStats.averageWaitSeconds ||
    aStats.averageBatchFillPercent > bStats.averageBatchFillPercent ||
    partialRate(a.simulation) < partialRate(b.simulation);
  return noWorse && strictlyBetter;
}

export function optimizeUnifiedBatchPolicy(
  blocks: GraphProcessBlock[],
  twinOptions: UnifiedTwinOptions,
  options: UnifiedOptimizerOptions,
): UnifiedOptimizerResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const baseConfigs = (twinOptions.batchConfigs || []).map(config => ({ ...config }));
  const baseline = simulateUnifiedStochasticBatchTwin(blocks, { ...twinOptions, batchConfigs: baseConfigs });
  if (!baseline.ok) errors.push(...baseline.errors.map(error => `Baseline: ${error}`));

  const searches = options.searches.filter(search => baseConfigs.some(config => config.blockId === search.blockId));
  for (const search of options.searches) {
    if (!baseConfigs.some(config => config.blockId === search.blockId)) warnings.push(`Search ${search.blockId} пропущен: batch config отсутствует`);
  }
  if (!searches.length) errors.push('Нет batch-блоков для оптимизации');
  if (errors.length) return { ok: false, baseline, scenarios: [], best: null, pareto: [], generatedScenarios: 0, evaluatedScenarios: 0, warnings, errors };

  const generated = combineSearches(baseConfigs, searches);
  const maxScenarios = Math.max(1, Math.min(5000, Math.floor(Number(options.maxScenarios) || 500)));
  if (generated.length > maxScenarios) warnings.push(`Сгенерировано ${generated.length} сценариев; оценены первые ${maxScenarios}. Сузьте search space для полного перебора.`);
  const selected = generated.slice(0, maxScenarios);
  const raw: UnifiedOptimizerScenario[] = [];

  for (const configs of selected) {
    const simulation = simulateUnifiedStochasticBatchTwin(blocks, { ...twinOptions, batchConfigs: configs });
    if (!simulation.ok) {
      warnings.push(`Сценарий пропущен: ${simulation.errors[0] || 'ошибка симуляции'}`);
      continue;
    }
    const sla = options.slaP95CycleSeconds;
    raw.push({
      rank: 0,
      score: 0,
      configs,
      simulation,
      slaMet: sla == null ? null : simulation.stats.p95CycleSeconds <= sla,
      pareto: false,
    });
  }

  if (!raw.length) {
    errors.push('Ни один optimizer scenario не завершился успешно');
    return { ok: false, baseline, scenarios: [], best: null, pareto: [], generatedScenarios: generated.length, evaluatedScenarios: 0, warnings, errors };
  }

  const weights = normalizeWeights(options.weights);
  const throughputRange = minMax(raw.map(item => item.simulation.stats.throughputPerHour || 0));
  const cycleRange = minMax(raw.map(item => item.simulation.stats.p95CycleSeconds));
  const waitRange = minMax(raw.map(item => item.simulation.stats.averageWaitSeconds));
  const fillRange = minMax(raw.map(item => item.simulation.stats.averageBatchFillPercent));
  const partialRange = minMax(raw.map(item => partialRate(item.simulation)));

  for (const scenario of raw) {
    const stats = scenario.simulation.stats;
    const slaTarget = options.slaP95CycleSeconds;
    const slaScore = slaTarget == null
      ? 1
      : stats.p95CycleSeconds <= slaTarget
        ? 1
        : Math.max(0, Math.min(1, slaTarget / Math.max(stats.p95CycleSeconds, 0.001)));
    scenario.score =
      weights.throughput * higherBetter(stats.throughputPerHour || 0, throughputRange) +
      weights.p95Cycle * lowerBetter(stats.p95CycleSeconds, cycleRange) +
      weights.averageWait * lowerBetter(stats.averageWaitSeconds, waitRange) +
      weights.batchFill * higherBetter(stats.averageBatchFillPercent, fillRange) +
      weights.partialCycles * lowerBetter(partialRate(scenario.simulation), partialRange) +
      weights.sla * slaScore;
  }

  for (const scenario of raw) {
    scenario.pareto = !raw.some(other => other !== scenario && dominates(other, scenario));
  }

  raw.sort((a, b) => b.score - a.score || b.simulation.stats.averageBatchFillPercent - a.simulation.stats.averageBatchFillPercent);
  raw.forEach((scenario, index) => { scenario.rank = index + 1; });
  const pareto = raw.filter(scenario => scenario.pareto).sort((a, b) => a.simulation.stats.p95CycleSeconds - b.simulation.stats.p95CycleSeconds);

  return {
    ok: true,
    baseline,
    scenarios: raw,
    best: raw[0] || null,
    pareto,
    generatedScenarios: generated.length,
    evaluatedScenarios: raw.length,
    warnings,
    errors,
  };
}
