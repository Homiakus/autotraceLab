import { ProcessScenarioProfile, cloneProcessScenario } from './processDomain';
import { ProcessBatchConfig } from './processBatchSimulation';
import { UniversalSimulationResult, simulateUniversalScenario } from './processUniversalCompiler';
import { scoreUniversalScenario } from './processUniversalObjectives';

export interface UniversalBatchPolicySearch {
  blockId: string;
  minBatchValues?: number[];
  maxWaitValuesSeconds?: number[];
}

export interface UniversalOptimizerWeights {
  throughput: number;
  p95Cycle: number;
  averageWait: number;
  batchFill: number;
  partialCycles: number;
  sla: number;
}

export interface UniversalOptimizerOptions {
  searches: UniversalBatchPolicySearch[];
  seed?: number;
  maxScenarios?: number;
  slaP95CycleSeconds?: number | null;
  weights?: Partial<UniversalOptimizerWeights>;
}

export interface UniversalOptimizerScenario {
  rank: number;
  score: number;
  configs: ProcessBatchConfig[];
  profile: ProcessScenarioProfile;
  simulation: UniversalSimulationResult;
  objectiveScore: number;
  slaMet: boolean | null;
  pareto: boolean;
}

export interface UniversalOptimizerResult {
  ok: boolean;
  baseline: UniversalSimulationResult;
  scenarios: UniversalOptimizerScenario[];
  best: UniversalOptimizerScenario | null;
  pareto: UniversalOptimizerScenario[];
  generatedScenarios: number;
  evaluatedScenarios: number;
  warnings: string[];
  errors: string[];
}

const DEFAULT_WEIGHTS: UniversalOptimizerWeights = {
  throughput: 0.20,
  p95Cycle: 0.20,
  averageWait: 0.15,
  batchFill: 0.20,
  partialCycles: 0.10,
  sla: 0.15,
};

function uniqueNumbers(values: number[], min: number): number[] {
  return Array.from(new Set(values.map(value => Math.max(min, Number(value) || 0)))).sort((a, b) => a - b);
}

function normalizeWeights(input?: Partial<UniversalOptimizerWeights>): UniversalOptimizerWeights {
  const result = { ...DEFAULT_WEIGHTS, ...(input || {}) };
  const keys = Object.keys(result) as Array<keyof UniversalOptimizerWeights>;
  const total = keys.reduce((sum, key) => sum + Math.max(0, Number(result[key]) || 0), 0);
  if (total <= 0) return { ...DEFAULT_WEIGHTS };
  for (const key of keys) result[key] = Math.max(0, Number(result[key]) || 0) / total;
  return result;
}

function variants(config: ProcessBatchConfig, search: UniversalBatchPolicySearch): ProcessBatchConfig[] {
  const capacity = Math.max(1, Math.floor(Number(config.batchCapacity) || 1));
  const minBatchValues = uniqueNumbers(
    search.minBatchValues?.length ? search.minBatchValues : [1, Math.ceil(capacity / 2), capacity],
    1,
  ).map(value => Math.min(capacity, Math.max(1, Math.floor(value))));
  const waits = uniqueNumbers(
    search.maxWaitValuesSeconds?.length ? search.maxWaitValuesSeconds : [0, 60, 300, 600, 1200],
    0,
  );
  const result: ProcessBatchConfig[] = [];
  for (const minBatchSize of Array.from(new Set(minBatchValues))) {
    for (const maxWaitSeconds of waits) result.push({ ...config, minBatchSize, maxWaitSeconds });
  }
  return result;
}

function combinations(base: ProcessBatchConfig[], searches: UniversalBatchPolicySearch[]): ProcessBatchConfig[][] {
  let result: ProcessBatchConfig[][] = [base.map(config => ({ ...config }))];
  for (const search of searches) {
    const target = base.find(config => config.blockId === search.blockId);
    if (!target) continue;
    const targetVariants = variants(target, search);
    const next: ProcessBatchConfig[][] = [];
    for (const current of result) {
      for (const variant of targetVariants) {
        next.push(current.map(config => config.blockId === search.blockId ? { ...variant } : { ...config }));
      }
    }
    result = next;
  }
  const seen = new Set<string>();
  return result.filter(configs => {
    const key = JSON.stringify(configs.map(config => [config.blockId, config.batchCapacity, config.minBatchSize, config.maxWaitSeconds]));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function range(values: number[]): { min: number; max: number } {
  return values.length ? { min: Math.min(...values), max: Math.max(...values) } : { min: 0, max: 0 };
}

function higher(value: number, limits: { min: number; max: number }): number {
  return limits.max <= limits.min ? 1 : (value - limits.min) / (limits.max - limits.min);
}

function lower(value: number, limits: { min: number; max: number }): number {
  return 1 - higher(value, limits);
}

function partialRate(result: UniversalSimulationResult): number {
  return result.stats.partialBatchRate;
}

function dominates(a: UniversalOptimizerScenario, b: UniversalOptimizerScenario): boolean {
  const x = a.simulation.stats;
  const y = b.simulation.stats;
  const noWorse =
    (x.throughputPerHour || 0) >= (y.throughputPerHour || 0) &&
    x.p95CycleSeconds <= y.p95CycleSeconds &&
    x.averageWaitSeconds <= y.averageWaitSeconds &&
    x.averageBatchFillPercent >= y.averageBatchFillPercent &&
    x.partialBatchRate <= y.partialBatchRate;
  const better =
    (x.throughputPerHour || 0) > (y.throughputPerHour || 0) ||
    x.p95CycleSeconds < y.p95CycleSeconds ||
    x.averageWaitSeconds < y.averageWaitSeconds ||
    x.averageBatchFillPercent > y.averageBatchFillPercent ||
    x.partialBatchRate < y.partialBatchRate;
  return noWorse && better;
}

export function optimizeUniversalBatchPolicy(
  profile: ProcessScenarioProfile,
  options: UniversalOptimizerOptions,
): UniversalOptimizerResult {
  const seed = Number.isFinite(options.seed) ? Number(options.seed) : 20260828;
  const baseline = simulateUniversalScenario(profile, seed);
  const warnings = [...baseline.warnings];
  const errors = [...baseline.errors.map(error => `Baseline: ${error}`)];
  const base = (profile.batchPolicies || []).map(config => ({ ...config }));
  const searches = options.searches.filter(search => base.some(config => config.blockId === search.blockId));
  for (const search of options.searches) {
    if (!base.some(config => config.blockId === search.blockId)) warnings.push(`Search ${search.blockId} skipped: batch policy absent`);
  }
  if (!searches.length) errors.push('No batch policies selected for optimization');
  if (!baseline.ok || errors.length) return { ok: false, baseline, scenarios: [], best: null, pareto: [], generatedScenarios: 0, evaluatedScenarios: 0, warnings, errors };

  const generated = combinations(base, searches);
  const maxScenarios = Math.max(1, Math.min(5000, Math.floor(Number(options.maxScenarios) || 500)));
  if (generated.length > maxScenarios) warnings.push(`Generated ${generated.length} scenarios; evaluating first ${maxScenarios}`);
  const raw: UniversalOptimizerScenario[] = [];

  for (const configs of generated.slice(0, maxScenarios)) {
    const candidate = cloneProcessScenario(profile);
    candidate.batchPolicies = configs.map(config => ({ ...config }));
    const simulation = simulateUniversalScenario(candidate, seed);
    if (!simulation.ok) {
      if (warnings.length < 30) warnings.push(`Scenario skipped: ${simulation.errors[0] || 'simulation error'}`);
      continue;
    }
    const objective = scoreUniversalScenario(simulation, candidate.objectives || []);
    const sla = options.slaP95CycleSeconds;
    raw.push({
      rank: 0,
      score: 0,
      configs,
      profile: candidate,
      simulation,
      objectiveScore: objective.score,
      slaMet: sla == null ? null : simulation.stats.p95CycleSeconds <= sla,
      pareto: false,
    });
  }

  if (!raw.length) {
    errors.push('No optimizer scenario completed successfully');
    return { ok: false, baseline, scenarios: [], best: null, pareto: [], generatedScenarios: generated.length, evaluatedScenarios: 0, warnings, errors };
  }

  const weights = normalizeWeights(options.weights);
  const throughputRange = range(raw.map(item => item.simulation.stats.throughputPerHour || 0));
  const cycleRange = range(raw.map(item => item.simulation.stats.p95CycleSeconds));
  const waitRange = range(raw.map(item => item.simulation.stats.averageWaitSeconds));
  const fillRange = range(raw.map(item => item.simulation.stats.averageBatchFillPercent));
  const partialRange = range(raw.map(item => partialRate(item.simulation)));

  for (const scenario of raw) {
    const stats = scenario.simulation.stats;
    const slaTarget = options.slaP95CycleSeconds;
    const slaScore = slaTarget == null ? 1 : stats.p95CycleSeconds <= slaTarget ? 1 : Math.max(0, Math.min(1, slaTarget / Math.max(stats.p95CycleSeconds, 0.001)));
    scenario.score =
      weights.throughput * higher(stats.throughputPerHour || 0, throughputRange) +
      weights.p95Cycle * lower(stats.p95CycleSeconds, cycleRange) +
      weights.averageWait * lower(stats.averageWaitSeconds, waitRange) +
      weights.batchFill * higher(stats.averageBatchFillPercent, fillRange) +
      weights.partialCycles * lower(stats.partialBatchRate, partialRange) +
      weights.sla * slaScore;
  }

  for (const scenario of raw) scenario.pareto = !raw.some(other => other !== scenario && dominates(other, scenario));
  raw.sort((a, b) => b.score - a.score || b.objectiveScore - a.objectiveScore || b.simulation.stats.averageBatchFillPercent - a.simulation.stats.averageBatchFillPercent);
  raw.forEach((scenario, index) => { scenario.rank = index + 1; });
  const pareto = raw.filter(item => item.pareto).sort((a, b) => a.simulation.stats.p95CycleSeconds - b.simulation.stats.p95CycleSeconds);

  return {
    ok: true,
    baseline,
    scenarios: raw,
    best: raw[0] || null,
    pareto,
    generatedScenarios: generated.length,
    evaluatedScenarios: raw.length,
    warnings: Array.from(new Set(warnings)),
    errors,
  };
}
