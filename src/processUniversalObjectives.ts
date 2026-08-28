import { ProcessOptimizationObjective } from './processDomain';
import { UniversalSimulationResult } from './processUniversalCompiler';

export interface ProcessMetricSnapshot {
  [metric: string]: number | null;
}

export interface ProcessObjectiveScore {
  objectiveId: string;
  metric: string;
  rawValue: number | null;
  score: number;
  weightedScore: number;
}

export interface ProcessScenarioScore {
  score: number;
  objectives: ProcessObjectiveScore[];
}

export function universalMetricSnapshot(result: UniversalSimulationResult): ProcessMetricSnapshot {
  const resourceAvailability = result.core.resourceStats.length
    ? result.core.resourceStats.reduce((sum, resource) => sum + resource.availabilityPercent, 0) / result.core.resourceStats.length
    : 100;
  const resourceUtilization = result.core.resourceStats.length
    ? result.core.resourceStats.reduce((sum, resource) => sum + resource.utilizationPercent, 0) / result.core.resourceStats.length
    : 0;
  return {
    throughputPerHour: result.stats.throughputPerHour,
    p95CycleSeconds: result.stats.p95CycleSeconds,
    averageCycleSeconds: result.stats.averageCycleSeconds,
    averageWaitSeconds: result.stats.averageWaitSeconds,
    p95WaitSeconds: result.stats.p95WaitSeconds,
    averageBatchFillPercent: result.stats.averageBatchFillPercent,
    partialBatchRate: result.stats.partialBatchRate,
    availabilityPercent: resourceAvailability,
    utilizationPercent: resourceUtilization,
  };
}

function objectiveScore(value: number | null, objective: ProcessOptimizationObjective): number {
  if (value == null || !Number.isFinite(value)) return 0;
  if (objective.goal === 'target') {
    const target = Number(objective.target);
    if (!Number.isFinite(target)) return 0;
    const tolerance = Math.max(1e-9, Math.abs(Number(objective.tolerance) || Math.abs(target) * 0.1 || 1));
    return Math.max(0, 1 - Math.abs(value - target) / tolerance);
  }
  // Absolute one-scenario scoring is intentionally monotonic and bounded. Cross-scenario
  // normalization can be layered on top without changing the domain contract.
  if (objective.goal === 'maximize') return value <= 0 ? 0 : value / (1 + Math.abs(value));
  return 1 / (1 + Math.max(0, value));
}

export function scoreUniversalScenario(
  result: UniversalSimulationResult,
  objectives: ProcessOptimizationObjective[],
  customMetrics: ProcessMetricSnapshot = {},
): ProcessScenarioScore {
  const metrics = { ...universalMetricSnapshot(result), ...customMetrics };
  const totalWeight = objectives.reduce((sum, objective) => sum + Math.max(0, Number(objective.weight) || 0), 0) || 1;
  const scored = objectives.map(objective => {
    const weight = Math.max(0, Number(objective.weight) || 0) / totalWeight;
    const rawValue = metrics[objective.metric] ?? null;
    const score = objectiveScore(rawValue, objective);
    return {
      objectiveId: objective.id,
      metric: objective.metric,
      rawValue,
      score,
      weightedScore: score * weight,
    };
  });
  return {
    score: scored.reduce((sum, item) => sum + item.weightedScore, 0),
    objectives: scored,
  };
}
