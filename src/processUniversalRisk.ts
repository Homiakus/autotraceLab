import { ProcessScenarioProfile, cloneProcessScenario } from './processDomain';
import { ProcessBlockUncertainty, ProcessMonteCarloDistribution } from './processRisk';
import { UniversalSimulationResult, simulateUniversalScenario } from './processUniversalCompiler';

export interface UniversalMonteCarloOptions {
  iterations: number;
  seed?: number;
  slaMakespanSeconds?: number | null;
}

export interface UniversalMonteCarloResult {
  ok: boolean;
  requestedIterations: number;
  completedIterations: number;
  makespanSeconds: ProcessMonteCarloDistribution;
  averageCycleSeconds: ProcessMonteCarloDistribution;
  p95CycleSeconds: ProcessMonteCarloDistribution;
  throughputPerHour: ProcessMonteCarloDistribution;
  averageWaitSeconds: ProcessMonteCarloDistribution;
  p95WaitSeconds: ProcessMonteCarloDistribution;
  changeoverSeconds: ProcessMonteCarloDistribution;
  reworkRatePercent: ProcessMonteCarloDistribution;
  slaProbabilityPercent: number | null;
  warnings: string[];
  errors: string[];
}

export interface UniversalCapacityScenario {
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
  baselineChangeoverSeconds: number;
  candidateChangeoverSeconds: number;
  score: number;
}

export interface UniversalCapacityPlannerResult {
  ok: boolean;
  baseline: UniversalSimulationResult;
  scenarios: UniversalCapacityScenario[];
  bestScenario: UniversalCapacityScenario | null;
  warnings: string[];
  errors: string[];
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

function mixSeed(seed: number, iteration: number): number {
  let value = (seed ^ Math.imul(iteration + 1, 0x9E3779B1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85EBCA6B) >>> 0;
  value ^= value >>> 13;
  return value >>> 0;
}

function emptyResult(iterations: number, errors: string[], warnings: string[] = []): UniversalMonteCarloResult {
  const empty = distribution([]);
  return {
    ok: false,
    requestedIterations: iterations,
    completedIterations: 0,
    makespanSeconds: empty,
    averageCycleSeconds: empty,
    p95CycleSeconds: empty,
    throughputPerHour: empty,
    averageWaitSeconds: empty,
    p95WaitSeconds: empty,
    changeoverSeconds: empty,
    reworkRatePercent: empty,
    slaProbabilityPercent: null,
    warnings,
    errors,
  };
}

export function runUniversalProcessMonteCarlo(
  profile: ProcessScenarioProfile,
  options: UniversalMonteCarloOptions,
): UniversalMonteCarloResult {
  const iterations = Math.min(5000, Math.max(1, Math.floor(Number(options.iterations) || 1)));
  const baseSeed = Number.isFinite(options.seed) ? Number(options.seed) : 123456789;
  const sla = options.slaMakespanSeconds == null ? null : Math.max(0, Number(options.slaMakespanSeconds) || 0);
  const warnings: string[] = [];
  const makespan: number[] = [];
  const averageCycle: number[] = [];
  const p95Cycle: number[] = [];
  const throughput: number[] = [];
  const averageWait: number[] = [];
  const p95Wait: number[] = [];
  const changeovers: number[] = [];
  const reworkRate: number[] = [];
  let slaHits = 0;

  // Fail fast before an expensive loop. Seed choice does not repair an invalid profile.
  const baseline = simulateUniversalScenario(profile, baseSeed);
  if (!baseline.ok) return emptyResult(iterations, baseline.errors, baseline.warnings);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const result = simulateUniversalScenario(profile, mixSeed(baseSeed, iteration));
    if (!result.ok) {
      warnings.push(`Iteration ${iteration + 1} skipped: ${result.errors[0] || 'simulation error'}`);
      continue;
    }
    makespan.push(result.stats.makespanSeconds);
    averageCycle.push(result.stats.averageCycleSeconds);
    p95Cycle.push(result.stats.p95CycleSeconds);
    throughput.push(result.stats.throughputPerHour ?? 0);
    averageWait.push(result.stats.averageWaitSeconds);
    p95Wait.push(result.stats.p95WaitSeconds);
    changeovers.push(result.policyStats.totalChangeoverSeconds);
    reworkRate.push(result.core.stats.reworkRatePercent);
    if (sla != null && result.stats.makespanSeconds <= sla) slaHits += 1;
  }

  const completedIterations = makespan.length;
  const errors = completedIterations ? [] : ['No Monte Carlo iteration completed successfully'];
  if (iterations > 2000) warnings.push('Large iteration counts may be expensive for large jobs/DAG/policy models');

  return {
    ok: errors.length === 0,
    requestedIterations: iterations,
    completedIterations,
    makespanSeconds: distribution(makespan),
    averageCycleSeconds: distribution(averageCycle),
    p95CycleSeconds: distribution(p95Cycle),
    throughputPerHour: distribution(throughput),
    averageWaitSeconds: distribution(averageWait),
    p95WaitSeconds: distribution(p95Wait),
    changeoverSeconds: distribution(changeovers),
    reworkRatePercent: distribution(reworkRate),
    slaProbabilityPercent: sla != null && completedIterations ? (slaHits / completedIterations) * 100 : null,
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

function utilizationFor(result: UniversalSimulationResult, resourceId: string): number {
  return result.core.resourceStats.find(resource => resource.id === resourceId)?.utilizationPercent ?? 0;
}

export function planUniversalResourceCapacity(
  profile: ProcessScenarioProfile,
  seed = 20260828,
): UniversalCapacityPlannerResult {
  const baseline = simulateUniversalScenario(profile, seed);
  const warnings = [...baseline.warnings];
  const errors = [...baseline.errors];
  if (!baseline.ok) return { ok: false, baseline, scenarios: [], bestScenario: null, warnings, errors };

  const scenarios: UniversalCapacityScenario[] = [];
  for (const resource of profile.resources) {
    const candidateProfile = cloneProcessScenario(profile);
    candidateProfile.resources = candidateProfile.resources.map(item =>
      item.id === resource.id ? { ...item, capacity: Math.max(1, Math.floor(item.capacity)) + 1 } : item,
    );
    const candidate = simulateUniversalScenario(candidateProfile, seed);
    if (!candidate.ok) {
      warnings.push(`Scenario +1 ${resource.name} skipped: ${candidate.errors[0] || 'simulation error'}`);
      continue;
    }
    const makespanReductionPercent = percentChange(baseline.stats.makespanSeconds, candidate.stats.makespanSeconds, 'decrease');
    const throughputGainPercent = percentChange(baseline.stats.throughputPerHour ?? 0, candidate.stats.throughputPerHour ?? 0, 'increase');
    const waitReductionPercent = percentChange(baseline.stats.averageWaitSeconds, candidate.stats.averageWaitSeconds, 'decrease');
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
      baselineChangeoverSeconds: baseline.policyStats.totalChangeoverSeconds,
      candidateChangeoverSeconds: candidate.policyStats.totalChangeoverSeconds,
      score: makespanReductionPercent * 0.45 + throughputGainPercent * 0.4 + Math.max(0, waitReductionPercent) * 0.15,
    });
  }
  scenarios.sort((a, b) => b.score - a.score || b.throughputGainPercent - a.throughputGainPercent);
  return { ok: true, baseline, scenarios, bestScenario: scenarios[0] || null, warnings, errors };
}

export function symmetricUncertainty(percent: number): ProcessBlockUncertainty {
  const spread = Math.max(0, Number(percent) || 0) / 100;
  return spread === 0
    ? { kind: 'fixed' }
    : { kind: 'triangular', minFactor: Math.max(0, 1 - spread), modeFactor: 1, maxFactor: 1 + spread };
}

export function uncertaintyPercent(policy: ProcessBlockUncertainty | undefined): number {
  if (!policy || policy.kind === 'fixed') return 0;
  const min = Number.isFinite(policy.minFactor) ? Number(policy.minFactor) : 1;
  const max = Number.isFinite(policy.maxFactor) ? Number(policy.maxFactor) : 1;
  return Math.max(Math.abs(1 - min), Math.abs(max - 1)) * 100;
}

export function setSymmetricBlockUncertainty(
  profile: ProcessScenarioProfile,
  blockId: string,
  percent: number,
): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  next.uncertaintyByBlock = { ...(next.uncertaintyByBlock || {}), [blockId]: symmetricUncertainty(percent) };
  return next;
}
