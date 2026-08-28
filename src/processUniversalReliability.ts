import { ProcessScenarioProfile, cloneProcessScenario } from './processDomain';
import { RepairDistributionKind, ResourceFailurePolicy } from './processReliability';
import { ProcessMonteCarloDistribution } from './processRisk';
import { simulateUniversalScenario } from './processUniversalCompiler';

export interface UniversalReliabilityOptions {
  iterations: number;
  seed?: number;
  slaMakespanSeconds?: number | null;
}

export interface UniversalReliabilityResourceStats {
  resourceId: string;
  resourceName: string;
  meanFailureWindows: number;
  p95FailureWindows: number;
  meanAvailabilityPercent: number;
  p05AvailabilityPercent: number;
}

export interface UniversalReliabilityResult {
  ok: boolean;
  requestedIterations: number;
  completedIterations: number;
  makespanSeconds: ProcessMonteCarloDistribution;
  baselineMakespanSeconds: ProcessMonteCarloDistribution;
  addedDelaySeconds: ProcessMonteCarloDistribution;
  throughputPerHour: ProcessMonteCarloDistribution;
  availabilityPercent: ProcessMonteCarloDistribution;
  changeoverSeconds: ProcessMonteCarloDistribution;
  reworkRatePercent: ProcessMonteCarloDistribution;
  slaProbabilityPercent: number | null;
  resourceStats: UniversalReliabilityResourceStats[];
  warnings: string[];
  errors: string[];
}

export interface FailurePolicyInput {
  enabled: boolean;
  mtbfSeconds: number;
  mttrSeconds: number;
  repairDistribution?: RepairDistributionKind;
  repairSpreadPercent?: number;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * Math.max(0, Math.min(1, q));
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

function emptyResult(iterations: number, errors: string[], warnings: string[] = []): UniversalReliabilityResult {
  const empty = distribution([]);
  return {
    ok: false,
    requestedIterations: iterations,
    completedIterations: 0,
    makespanSeconds: empty,
    baselineMakespanSeconds: empty,
    addedDelaySeconds: empty,
    throughputPerHour: empty,
    availabilityPercent: empty,
    changeoverSeconds: empty,
    reworkRatePercent: empty,
    slaProbabilityPercent: null,
    resourceStats: [],
    warnings,
    errors,
  };
}

function validateFailures(profile: ProcessScenarioProfile): string[] {
  const resources = new Set(profile.resources.map(resource => resource.id));
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const policy of profile.failures || []) {
    if (!resources.has(policy.resourceId)) errors.push(`Failure policy references unknown resource: ${policy.resourceId}`);
    if (seen.has(policy.resourceId)) errors.push(`Failure policy duplicated for resource: ${policy.resourceId}`);
    seen.add(policy.resourceId);
    if (!(policy.mtbfSeconds > 0)) errors.push(`${policy.resourceId}: MTBF must be > 0`);
    if (!(policy.mttrSeconds > 0)) errors.push(`${policy.resourceId}: MTTR must be > 0`);
  }
  return errors;
}

/**
 * Paired Monte Carlo reliability analysis.
 *
 * For every seed, baseline and failure cases share the exact same jobs, arrivals,
 * duration samples, rework decisions, batching, compatibility and changeovers.
 * The only removed field in baseline is `failures`, so added delay isolates the
 * failure policy effect without falling back to the legacy stochastic scheduler.
 */
export function runUniversalReliabilityMonteCarlo(
  profile: ProcessScenarioProfile,
  options: UniversalReliabilityOptions,
): UniversalReliabilityResult {
  const iterations = Math.max(1, Math.min(5000, Math.floor(Number(options.iterations) || 1)));
  const baseSeed = Number.isFinite(options.seed) ? Number(options.seed) : 20260828;
  const sla = options.slaMakespanSeconds == null ? null : Math.max(0, Number(options.slaMakespanSeconds) || 0);
  const policyErrors = validateFailures(profile);
  if (policyErrors.length) return emptyResult(iterations, policyErrors);

  const baselineProfile = cloneProcessScenario(profile);
  baselineProfile.failures = [];

  const preflightBaseline = simulateUniversalScenario(baselineProfile, baseSeed);
  const preflightFailed = simulateUniversalScenario(profile, baseSeed);
  if (!preflightBaseline.ok) return emptyResult(iterations, preflightBaseline.errors, preflightBaseline.warnings);
  if (!preflightFailed.ok) return emptyResult(iterations, preflightFailed.errors, preflightFailed.warnings);

  const makespan: number[] = [];
  const baselineMakespan: number[] = [];
  const delay: number[] = [];
  const throughput: number[] = [];
  const availability: number[] = [];
  const changeovers: number[] = [];
  const rework: number[] = [];
  const warnings: string[] = [];
  const failureCounts: Record<string, number[]> = {};
  const resourceAvailability: Record<string, number[]> = {};
  let slaHits = 0;

  for (const resource of profile.resources) {
    failureCounts[resource.id] = [];
    resourceAvailability[resource.id] = [];
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const seed = mixSeed(baseSeed, iteration);
    const baseline = simulateUniversalScenario(baselineProfile, seed);
    const failed = simulateUniversalScenario(profile, seed);
    if (!baseline.ok || !failed.ok) {
      if (warnings.length < 20) warnings.push(`Iteration ${iteration + 1} skipped: ${(failed.errors[0] || baseline.errors[0] || 'simulation error')}`);
      continue;
    }

    baselineMakespan.push(baseline.stats.makespanSeconds);
    makespan.push(failed.stats.makespanSeconds);
    delay.push(Math.max(0, failed.stats.makespanSeconds - baseline.stats.makespanSeconds));
    throughput.push(failed.stats.throughputPerHour ?? 0);
    changeovers.push(failed.policyStats.totalChangeoverSeconds);
    rework.push(failed.core.stats.reworkRatePercent);

    const resourceValues = failed.core.resourceStats.map(resource => resource.availabilityPercent);
    availability.push(resourceValues.length
      ? resourceValues.reduce((sum, value) => sum + value, 0) / resourceValues.length
      : 100);

    for (const resource of failed.core.resourceStats) {
      failureCounts[resource.id]?.push(resource.generatedFailureWindows || 0);
      resourceAvailability[resource.id]?.push(resource.availabilityPercent);
    }

    if (sla != null && failed.stats.makespanSeconds <= sla) slaHits += 1;
  }

  if (!makespan.length) return emptyResult(iterations, ['No reliability iteration completed successfully'], warnings);

  const resourceStats: UniversalReliabilityResourceStats[] = profile.resources.map(resource => {
    const counts = failureCounts[resource.id] || [];
    const values = resourceAvailability[resource.id] || [];
    const sortedAvailability = [...values].sort((a, b) => a - b);
    return {
      resourceId: resource.id,
      resourceName: resource.name,
      meanFailureWindows: counts.length ? counts.reduce((sum, value) => sum + value, 0) / counts.length : 0,
      p95FailureWindows: quantile([...counts].sort((a, b) => a - b), 0.95),
      meanAvailabilityPercent: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 100,
      p05AvailabilityPercent: quantile(sortedAvailability, 0.05),
    };
  });

  if (iterations > 2000) warnings.push('Large iteration counts may be expensive for large universal profiles');
  return {
    ok: true,
    requestedIterations: iterations,
    completedIterations: makespan.length,
    makespanSeconds: distribution(makespan),
    baselineMakespanSeconds: distribution(baselineMakespan),
    addedDelaySeconds: distribution(delay),
    throughputPerHour: distribution(throughput),
    availabilityPercent: distribution(availability),
    changeoverSeconds: distribution(changeovers),
    reworkRatePercent: distribution(rework),
    slaProbabilityPercent: sla != null ? (slaHits / makespan.length) * 100 : null,
    resourceStats,
    warnings: Array.from(new Set(warnings)),
    errors: [],
  };
}

export function setResourceFailurePolicy(
  profile: ProcessScenarioProfile,
  resourceId: string,
  input: FailurePolicyInput,
): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  if (!next.resources.some(resource => resource.id === resourceId)) throw new Error(`Unknown resource: ${resourceId}`);
  const policies = (next.failures || []).filter(policy => policy.resourceId !== resourceId);
  if (input.enabled) {
    policies.push({
      resourceId,
      mtbfSeconds: Math.max(0.001, Number(input.mtbfSeconds) || 0.001),
      mttrSeconds: Math.max(0.001, Number(input.mttrSeconds) || 0.001),
      repairDistribution: input.repairDistribution || 'fixed',
      repairSpreadPercent: Math.max(0, Math.min(95, Number(input.repairSpreadPercent) || 0)),
    } as ResourceFailurePolicy);
  }
  next.failures = policies;
  return next;
}

export function failurePolicyForResource(
  profile: ProcessScenarioProfile,
  resourceId: string,
): ResourceFailurePolicy | undefined {
  const policy = profile.failures?.find(item => item.resourceId === resourceId);
  return policy ? { ...policy } : undefined;
}
