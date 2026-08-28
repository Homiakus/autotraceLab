import { GraphProcessBlock } from './processGraphMath';
import {
  DigitalTwinOptions,
  DigitalTwinResult,
  simulateStochasticDigitalTwin,
} from './processDigitalTwin';
import {
  ProcessDowntimeWindow,
  ProcessResourceCalendarPolicy,
} from './processResourceCalendar';

export type RepairDistributionKind = 'fixed' | 'uniform' | 'triangular';

export interface ResourceFailurePolicy {
  resourceId: string;
  mtbfSeconds: number;
  mttrSeconds: number;
  repairDistribution?: RepairDistributionKind;
  repairSpreadPercent?: number;
}

export interface ReliabilityMonteCarloOptions {
  iterations: number;
  seed?: number;
  failurePolicies: ResourceFailurePolicy[];
  slaMakespanSeconds?: number;
}

export interface ReliabilityPercentiles {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface ReliabilityResourceStats {
  resourceId: string;
  meanFailures: number;
  p95Failures: number;
  meanDowntimeSeconds: number;
  p95DowntimeSeconds: number;
  meanAvailabilityPercent: number;
}

export interface ReliabilityMonteCarloResult {
  ok: boolean;
  iterations: number;
  completedIterations: number;
  makespan: ReliabilityPercentiles;
  baselineMakespan: ReliabilityPercentiles;
  addedDelay: ReliabilityPercentiles;
  throughputPerHour: ReliabilityPercentiles;
  availabilityPercent: ReliabilityPercentiles;
  slaProbabilityPercent: number | null;
  resourceStats: ReliabilityResourceStats[];
  warnings: string[];
  errors: string[];
}

interface FailureScenario {
  calendars: Record<string, ProcessResourceCalendarPolicy>;
  countsByResource: Record<string, number>;
  downtimeByResource: Record<string, number>;
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

function hashString(text: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mixSeed(...values: number[]): number {
  let hash = 0x9E3779B9;
  for (const value of values) {
    hash ^= value >>> 0;
    hash = Math.imul(hash ^ (hash >>> 16), 0x85EBCA6B);
    hash ^= hash >>> 13;
  }
  return hash >>> 0;
}

function exponential(random: () => number, mean: number): number {
  return -Math.log(Math.max(Number.EPSILON, 1 - random())) * mean;
}

function sampleRepairSeconds(random: () => number, policy: ResourceFailurePolicy): number {
  const mean = Math.max(0.001, Number(policy.mttrSeconds) || 0.001);
  const kind = policy.repairDistribution || 'fixed';
  const spread = Math.max(0, Math.min(0.95, (Number(policy.repairSpreadPercent) || 0) / 100));
  if (kind === 'fixed' || spread === 0) return mean;
  const min = mean * (1 - spread);
  const max = mean * (1 + spread);
  if (kind === 'uniform') return min + random() * (max - min);
  const u = random();
  const split = (mean - min) / (max - min);
  if (u <= split) return min + Math.sqrt(u * (max - min) * (mean - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mean));
}

export function generateFailureWindows(
  policy: ResourceFailurePolicy,
  horizonSeconds: number,
  seed: number,
): ProcessDowntimeWindow[] {
  const mtbf = Math.max(0.001, Number(policy.mtbfSeconds) || 0.001);
  const horizon = Math.max(0, horizonSeconds);
  const random = mulberry32(seed);
  const windows: ProcessDowntimeWindow[] = [];
  let cursor = exponential(random, mtbf);

  for (let guard = 0; guard < 100000 && cursor < horizon; guard += 1) {
    const repair = sampleRepairSeconds(random, policy);
    windows.push({
      startSeconds: cursor,
      endSeconds: cursor + repair,
      reason: `Отказ ${policy.resourceId} / repair`,
      mode: 'block-start',
    });
    cursor += repair + exponential(random, mtbf);
  }
  return windows;
}

function mergeCalendars(
  base: Record<string, ProcessResourceCalendarPolicy> | undefined,
  failures: Record<string, ProcessDowntimeWindow[]>,
): Record<string, ProcessResourceCalendarPolicy> {
  const ids = new Set([...Object.keys(base || {}), ...Object.keys(failures)]);
  const result: Record<string, ProcessResourceCalendarPolicy> = {};
  for (const id of ids) {
    const source = base?.[id] || {};
    result[id] = {
      ...source,
      workingWindows: source.workingWindows ? source.workingWindows.map(window => ({ ...window })) : undefined,
      plannedDowntime: [
        ...(source.plannedDowntime || []).map(window => ({ ...window })),
        ...(failures[id] || []).map(window => ({ ...window })),
      ],
    };
  }
  return result;
}

function buildFailureScenario(
  baseCalendars: Record<string, ProcessResourceCalendarPolicy> | undefined,
  policies: ResourceFailurePolicy[],
  horizonSeconds: number,
  seed: number,
): FailureScenario {
  const failures: Record<string, ProcessDowntimeWindow[]> = {};
  const countsByResource: Record<string, number> = {};
  const downtimeByResource: Record<string, number> = {};

  for (const policy of policies) {
    const windows = generateFailureWindows(
      policy,
      horizonSeconds,
      mixSeed(seed, hashString(policy.resourceId)),
    );
    failures[policy.resourceId] = windows;
    countsByResource[policy.resourceId] = windows.length;
    downtimeByResource[policy.resourceId] = windows.reduce((sum, window) => sum + window.endSeconds - window.startSeconds, 0);
  }

  return {
    calendars: mergeCalendars(baseCalendars, failures),
    countsByResource,
    downtimeByResource,
  };
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index];
}

function percentiles(values: number[]): ReliabilityPercentiles {
  return {
    p50: percentile(values, 0.50),
    p90: percentile(values, 0.90),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
  };
}

function emptyResult(errors: string[]): ReliabilityMonteCarloResult {
  const zero = { p50: 0, p90: 0, p95: 0, p99: 0 };
  return {
    ok: false,
    iterations: 0,
    completedIterations: 0,
    makespan: zero,
    baselineMakespan: zero,
    addedDelay: zero,
    throughputPerHour: zero,
    availabilityPercent: zero,
    slaProbabilityPercent: null,
    resourceStats: [],
    warnings: [],
    errors,
  };
}

function validatePolicies(options: DigitalTwinOptions, policies: ResourceFailurePolicy[]): string[] {
  const resourceIds = new Set(options.resources.map(resource => resource.id));
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const policy of policies) {
    if (!resourceIds.has(policy.resourceId)) errors.push(`Failure policy: ресурс ${policy.resourceId} не найден`);
    if (seen.has(policy.resourceId)) errors.push(`Failure policy для ${policy.resourceId} задан больше одного раза`);
    seen.add(policy.resourceId);
    if (!(policy.mtbfSeconds > 0)) errors.push(`${policy.resourceId}: MTBF должен быть > 0`);
    if (!(policy.mttrSeconds > 0)) errors.push(`${policy.resourceId}: MTTR должен быть > 0`);
  }
  return errors;
}

function simulateCoveredScenario(
  blocks: GraphProcessBlock[],
  digitalTwinOptions: DigitalTwinOptions,
  policies: ResourceFailurePolicy[],
  iterationSeed: number,
  baseline: DigitalTwinResult,
): { result: DigitalTwinResult; scenario: FailureScenario; warnings: string[] } {
  const warnings: string[] = [];
  const maxMttr = Math.max(1, ...policies.map(policy => policy.mttrSeconds));
  let horizon = Math.max(86400, baseline.stats.makespanSeconds * 2 + maxMttr * 4);
  let scenario = buildFailureScenario(digitalTwinOptions.resourceCalendars, policies, horizon, mixSeed(iterationSeed, 0xFA11));
  let result = simulateStochasticDigitalTwin(blocks, {
    ...digitalTwinOptions,
    seed: iterationSeed,
    resourceCalendars: scenario.calendars,
  });

  for (let attempt = 0; attempt < 4 && result.ok && result.stats.makespanSeconds > horizon * 0.9; attempt += 1) {
    horizon *= 2;
    scenario = buildFailureScenario(digitalTwinOptions.resourceCalendars, policies, horizon, mixSeed(iterationSeed, 0xFA11));
    result = simulateStochasticDigitalTwin(blocks, {
      ...digitalTwinOptions,
      seed: iterationSeed,
      resourceCalendars: scenario.calendars,
    });
  }

  if (result.ok && result.stats.makespanSeconds > horizon * 0.9) {
    warnings.push('Failure horizon почти исчерпан; экстремально низкий MTBF/высокий MTTR может требовать большего горизонта');
  }
  return { result, scenario, warnings };
}

export function runReliabilityMonteCarlo(
  blocks: GraphProcessBlock[],
  digitalTwinOptions: DigitalTwinOptions,
  options: ReliabilityMonteCarloOptions,
): ReliabilityMonteCarloResult {
  const iterations = Math.max(1, Math.min(5000, Math.floor(Number(options.iterations) || 1)));
  const baseSeed = Number.isFinite(options.seed) ? Number(options.seed) : 20260828;
  const policyErrors = validatePolicies(digitalTwinOptions, options.failurePolicies);
  if (policyErrors.length) return emptyResult(policyErrors);

  const makespans: number[] = [];
  const baselineMakespans: number[] = [];
  const delays: number[] = [];
  const throughputs: number[] = [];
  const availability: number[] = [];
  const slaHits: boolean[] = [];
  const countsByResource: Record<string, number[]> = {};
  const downtimeByResource: Record<string, number[]> = {};
  const availabilityByResource: Record<string, number[]> = {};
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const policy of options.failurePolicies) {
    countsByResource[policy.resourceId] = [];
    downtimeByResource[policy.resourceId] = [];
    availabilityByResource[policy.resourceId] = [];
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const iterationSeed = mixSeed(baseSeed, iteration + 1, 0x51A);
    const baseline = simulateStochasticDigitalTwin(blocks, { ...digitalTwinOptions, seed: iterationSeed });
    if (!baseline.ok) {
      errors.push(`Итерация ${iteration + 1}, baseline: ${baseline.errors.join('; ')}`);
      continue;
    }

    const failed = simulateCoveredScenario(blocks, digitalTwinOptions, options.failurePolicies, iterationSeed, baseline);
    if (!failed.result.ok) {
      errors.push(`Итерация ${iteration + 1}, failure scenario: ${failed.result.errors.join('; ')}`);
      continue;
    }
    warnings.push(...failed.warnings);

    baselineMakespans.push(baseline.stats.makespanSeconds);
    makespans.push(failed.result.stats.makespanSeconds);
    delays.push(Math.max(0, failed.result.stats.makespanSeconds - baseline.stats.makespanSeconds));
    throughputs.push(failed.result.stats.throughputPerHour || 0);
    const resourceAvailabilities = failed.result.resourceStats.map(resource => resource.availabilityPercent);
    availability.push(resourceAvailabilities.length
      ? resourceAvailabilities.reduce((sum, value) => sum + value, 0) / resourceAvailabilities.length
      : 100);

    if (Number.isFinite(options.slaMakespanSeconds)) {
      slaHits.push(failed.result.stats.makespanSeconds <= Number(options.slaMakespanSeconds));
    }

    for (const policy of options.failurePolicies) {
      countsByResource[policy.resourceId].push(failed.scenario.countsByResource[policy.resourceId] || 0);
      downtimeByResource[policy.resourceId].push(failed.scenario.downtimeByResource[policy.resourceId] || 0);
      const resourceStat = failed.result.resourceStats.find(resource => resource.id === policy.resourceId);
      availabilityByResource[policy.resourceId].push(resourceStat?.availabilityPercent ?? 100);
    }
  }

  if (!makespans.length) return emptyResult(errors.length ? errors : ['Ни одна reliability-итерация не завершилась']);

  const resourceStats: ReliabilityResourceStats[] = options.failurePolicies.map(policy => {
    const counts = countsByResource[policy.resourceId];
    const downtimes = downtimeByResource[policy.resourceId];
    const availabilities = availabilityByResource[policy.resourceId];
    return {
      resourceId: policy.resourceId,
      meanFailures: counts.reduce((sum, value) => sum + value, 0) / counts.length,
      p95Failures: percentile(counts, 0.95),
      meanDowntimeSeconds: downtimes.reduce((sum, value) => sum + value, 0) / downtimes.length,
      p95DowntimeSeconds: percentile(downtimes, 0.95),
      meanAvailabilityPercent: availabilities.reduce((sum, value) => sum + value, 0) / availabilities.length,
    };
  });

  return {
    ok: true,
    iterations,
    completedIterations: makespans.length,
    makespan: percentiles(makespans),
    baselineMakespan: percentiles(baselineMakespans),
    addedDelay: percentiles(delays),
    throughputPerHour: percentiles(throughputs),
    availabilityPercent: percentiles(availability),
    slaProbabilityPercent: slaHits.length ? (slaHits.filter(Boolean).length / slaHits.length) * 100 : null,
    resourceStats,
    warnings: Array.from(new Set(warnings)),
    errors,
  };
}
