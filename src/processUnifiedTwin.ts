import { GraphProcessBlock, analyzeGraphProcess } from './processGraphMath';
import { ProcessBlockUncertainty } from './processRisk';
import { ProcessResource, ProcessResourceRequirement } from './processSimulation';
import { ProcessBatchConfig } from './processBatchSimulation';
import {
  DigitalTwinArrivalConfig,
  DigitalTwinPriorityConfig,
  DigitalTwinReworkPolicy,
} from './processDigitalTwin';
import {
  ProcessResourceCalendarPolicy,
  availableSecondsWithin,
  nextResourceAvailableStart,
} from './processResourceCalendar';
import { ResourceFailurePolicy, generateFailureWindows } from './processReliability';

export interface UnifiedTwinOptions {
  jobs: number;
  seed?: number;
  arrivals?: DigitalTwinArrivalConfig;
  resources: ProcessResource[];
  requirementsByBlock?: Record<string, ProcessResourceRequirement[]>;
  uncertaintyByBlock?: Record<string, ProcessBlockUncertainty>;
  reworkByBlock?: Record<string, DigitalTwinReworkPolicy>;
  priority?: DigitalTwinPriorityConfig;
  resourceCalendars?: Record<string, ProcessResourceCalendarPolicy>;
  batchConfigs?: ProcessBatchConfig[];
  failurePolicies?: ResourceFailurePolicy[];
}

export interface UnifiedTwinTaskRun {
  taskId: string;
  jobIndex: number;
  blockId: string;
  blockTitle: string;
  attempt: number;
  priority: number;
  readySeconds: number;
  startSeconds: number;
  finishSeconds: number;
  durationSeconds: number;
  waitSeconds: number;
  reworkTriggered: boolean;
  requirements: ProcessResourceRequirement[];
  batchId?: string;
  batchSize?: number;
}

export interface UnifiedTwinBatchCycle {
  batchId: string;
  blockId: string;
  blockTitle: string;
  startSeconds: number;
  finishSeconds: number;
  durationSeconds: number;
  jobIndexes: number[];
  attempts: number[];
  batchCapacity: number;
  fillPercent: number;
  averageReadyWaitSeconds: number;
  highestPriority: number;
}

export interface UnifiedTwinJobStats {
  jobIndex: number;
  priority: number;
  releaseSeconds: number;
  completionSeconds: number;
  cycleSeconds: number;
  waitSeconds: number;
  reworkRuns: number;
}

export interface UnifiedTwinResourceStats {
  id: string;
  name: string;
  capacity: number;
  busyUnitSeconds: number;
  availableUnitSeconds: number;
  availabilityPercent: number;
  utilizationPercent: number;
  peakUnits: number;
  generatedFailureWindows: number;
}

export interface UnifiedTwinBlockStats {
  blockId: string;
  blockTitle: string;
  runs: number;
  reworkRuns: number;
  reworkRatePercent: number;
  averageDurationSeconds: number;
  averageWaitSeconds: number;
  p95WaitSeconds: number;
  batchCycles: number;
  averageBatchFillPercent: number;
}

export interface UnifiedTwinStats {
  makespanSeconds: number;
  completedJobs: number;
  totalRuns: number;
  totalReworkRuns: number;
  reworkRatePercent: number;
  batchCycles: number;
  partialBatchCycles: number;
  averageBatchFillPercent: number;
  averageCycleSeconds: number;
  p95CycleSeconds: number;
  averageWaitSeconds: number;
  p95WaitSeconds: number;
  throughputPerHour: number | null;
  outputRatePerHour: number | null;
  statAverageCycleSeconds: number | null;
  routineAverageCycleSeconds: number | null;
  statAdvantagePercent: number | null;
  resourceBottleneckId?: string;
  resourceBottleneckName?: string;
  resourceBottleneckUtilizationPercent: number;
}

export interface UnifiedTwinResult {
  ok: boolean;
  runs: UnifiedTwinTaskRun[];
  batchCycles: UnifiedTwinBatchCycle[];
  jobs: UnifiedTwinJobStats[];
  resourceStats: UnifiedTwinResourceStats[];
  blockStats: UnifiedTwinBlockStats[];
  stats: UnifiedTwinStats;
  warnings: string[];
  errors: string[];
}

interface Reservation {
  start: number;
  finish: number;
  taskId: string;
}

interface ResourceCalendar {
  resource: ProcessResource;
  policy?: ProcessResourceCalendarPolicy;
  lanes: Reservation[][];
}

interface Allocation {
  start: number;
  laneIndexesByResource: Record<string, number[]>;
}

interface ReadyMember {
  jobIndex: number;
  attempt: number;
  priority: number;
  ready: number;
}

interface IndividualCandidate {
  kind: 'individual';
  jobIndex: number;
  block: GraphProcessBlock;
  attempt: number;
  priority: number;
  ready: number;
  duration: number;
  requirements: ProcessResourceRequirement[];
  allocation: Allocation;
}

interface BatchCandidate {
  kind: 'batch';
  block: GraphProcessBlock;
  members: ReadyMember[];
  config: ProcessBatchConfig;
  duration: number;
  requirements: ProcessResourceRequirement[];
  allocation: Allocation;
  policyReady: number;
  priority: number;
  sequence: number;
}

type Candidate = IndividualCandidate | BatchCandidate;

function emptyStats(): UnifiedTwinStats {
  return {
    makespanSeconds: 0,
    completedJobs: 0,
    totalRuns: 0,
    totalReworkRuns: 0,
    reworkRatePercent: 0,
    batchCycles: 0,
    partialBatchCycles: 0,
    averageBatchFillPercent: 0,
    averageCycleSeconds: 0,
    p95CycleSeconds: 0,
    averageWaitSeconds: 0,
    p95WaitSeconds: 0,
    throughputPerHour: null,
    outputRatePerHour: null,
    statAverageCycleSeconds: null,
    routineAverageCycleSeconds: null,
    statAdvantagePercent: null,
    resourceBottleneckUtilizationPercent: 0,
  };
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

function keyedUnit(seed: number, key: string): number {
  return mulberry32(mixSeed(seed, hashString(key)))();
}

function clampFactor(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : fallback;
}

function sampleFactor(seed: number, key: string, uncertainty: ProcessBlockUncertainty | undefined): number {
  if (!uncertainty || uncertainty.kind === 'fixed') return 1;
  const min = clampFactor(uncertainty.minFactor, 0.9);
  const max = Math.max(min, clampFactor(uncertainty.maxFactor, 1.1));
  const u = keyedUnit(seed, key);
  if (uncertainty.kind === 'uniform') return min + u * (max - min);
  const mode = Math.min(max, Math.max(min, clampFactor(uncertainty.modeFactor, 1)));
  if (max === min) return min;
  const split = (mode - min) / (max - min);
  if (u <= split) return min + Math.sqrt(u * (max - min) * (mode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function exponential(random: () => number, mean: number): number {
  return -Math.log(Math.max(Number.EPSILON, 1 - random())) * mean;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index];
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function topologicalOrder(blocks: GraphProcessBlock[]): { order: string[]; cycleIds: string[] } {
  const ids = new Set(blocks.map(block => block.id));
  const indegree: Record<string, number> = {};
  const children: Record<string, string[]> = {};
  for (const block of blocks) {
    indegree[block.id] = 0;
    children[block.id] = [];
  }
  for (const block of blocks) {
    const deps = Array.from(new Set(block.dependencies.filter(dep => ids.has(dep) && dep !== block.id)));
    indegree[block.id] = deps.length;
    for (const dep of deps) children[dep].push(block.id);
  }
  const queue = blocks.filter(block => indegree[block.id] === 0).map(block => block.id);
  const order: string[] = [];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    order.push(id);
    for (const child of children[id]) {
      indegree[child] -= 1;
      if (indegree[child] === 0) queue.push(child);
    }
  }
  return { order, cycleIds: blocks.filter(block => !order.includes(block.id)).map(block => block.id) };
}

function normalizeRequirements(requirements: ProcessResourceRequirement[] | undefined): ProcessResourceRequirement[] {
  const merged = new Map<string, number>();
  for (const item of requirements || []) {
    const units = Math.max(1, Math.floor(Number(item.units) || 1));
    merged.set(item.resourceId, Math.max(merged.get(item.resourceId) || 0, units));
  }
  return Array.from(merged, ([resourceId, units]) => ({ resourceId, units }));
}

function overlaps(start: number, finish: number, reservation: Reservation): boolean {
  return start < reservation.finish && finish > reservation.start;
}

function freeLanes(calendar: ResourceCalendar, start: number, duration: number): number[] {
  if (nextResourceAvailableStart(calendar.policy, start, duration).startSeconds !== start) return [];
  const finish = start + duration;
  const result: number[] = [];
  calendar.lanes.forEach((lane, index) => {
    if (!lane.some(reservation => overlaps(start, finish, reservation))) result.push(index);
  });
  return result;
}

function findAllocation(
  calendars: Map<string, ResourceCalendar>,
  requirements: ProcessResourceRequirement[],
  ready: number,
  duration: number,
): Allocation | null {
  if (!requirements.length || duration === 0) return { start: ready, laneIndexesByResource: {} };
  let candidate = ready;

  for (let guard = 0; guard < 100000; guard += 1) {
    let calendarAdjusted = candidate;
    for (const requirement of requirements) {
      const calendar = calendars.get(requirement.resourceId);
      if (!calendar) return null;
      const available = nextResourceAvailableStart(calendar.policy, candidate, duration).startSeconds;
      if (!Number.isFinite(available)) return null;
      calendarAdjusted = Math.max(calendarAdjusted, available);
    }
    if (calendarAdjusted > candidate) {
      candidate = calendarAdjusted;
      continue;
    }

    const laneIndexesByResource: Record<string, number[]> = {};
    let feasible = true;
    for (const requirement of requirements) {
      const calendar = calendars.get(requirement.resourceId)!;
      const free = freeLanes(calendar, candidate, duration);
      if (free.length < requirement.units) {
        feasible = false;
        break;
      }
      laneIndexesByResource[requirement.resourceId] = free.slice(0, requirement.units);
    }
    if (feasible) return { start: candidate, laneIndexesByResource };

    let nextCandidate = Number.POSITIVE_INFINITY;
    for (const requirement of requirements) {
      const calendar = calendars.get(requirement.resourceId)!;
      for (const lane of calendar.lanes) {
        for (const reservation of lane) {
          if (reservation.finish > candidate) nextCandidate = Math.min(nextCandidate, reservation.finish);
        }
      }
    }
    if (!Number.isFinite(nextCandidate)) return null;
    candidate = nextCandidate;
  }
  return null;
}

function reserve(
  calendars: Map<string, ResourceCalendar>,
  allocation: Allocation,
  requirements: ProcessResourceRequirement[],
  duration: number,
  taskId: string,
): void {
  for (const requirement of requirements) {
    const calendar = calendars.get(requirement.resourceId)!;
    for (const laneIndex of allocation.laneIndexesByResource[requirement.resourceId] || []) {
      calendar.lanes[laneIndex].push({ start: allocation.start, finish: allocation.start + duration, taskId });
      calendar.lanes[laneIndex].sort((a, b) => a.start - b.start || a.finish - b.finish);
    }
  }
}

function peakUnits(calendar: ResourceCalendar): number {
  const events: Array<{ time: number; delta: number }> = [];
  for (const lane of calendar.lanes) {
    for (const reservation of lane) {
      events.push({ time: reservation.start, delta: 1 });
      events.push({ time: reservation.finish, delta: -1 });
    }
  }
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);
  let active = 0;
  let peak = 0;
  for (const event of events) {
    active += event.delta;
    peak = Math.max(peak, active);
  }
  return peak;
}

function buildReleaseTimes(jobs: number, seed: number, arrival: DigitalTwinArrivalConfig | undefined): number[] {
  const releases = [0];
  const config = arrival || { kind: 'fixed' as const, intervalSeconds: 0 };
  const random = mulberry32(mixSeed(seed, 0xA771A1));
  for (let index = 1; index < jobs; index += 1) {
    if (config.kind === 'poisson') {
      const mean = Math.max(0.001, Number(config.meanIntervalSeconds) || 1);
      releases.push(releases[index - 1] + exponential(random, mean));
    } else {
      releases.push(releases[index - 1] + Math.max(0, Number(config.intervalSeconds) || 0));
    }
  }
  return releases;
}

function jobPriority(jobIndex: number, config: DigitalTwinPriorityConfig | undefined): number {
  const explicit = config?.priorityByJob?.[jobIndex];
  if (Number.isFinite(explicit)) return Number(explicit);
  const statEveryN = Math.max(0, Math.floor(Number(config?.statEveryN) || 0));
  if (statEveryN > 0 && (jobIndex + 1) % statEveryN === 0) return Number(config?.statPriority) || 100;
  return Number(config?.routinePriority) || 0;
}

function normalizeBatchConfig(config: ProcessBatchConfig): ProcessBatchConfig {
  const capacity = Math.max(1, Math.floor(Number(config.batchCapacity) || 1));
  return {
    blockId: config.blockId,
    batchCapacity: capacity,
    minBatchSize: Math.min(capacity, Math.max(1, Math.floor(Number(config.minBatchSize) || 1))),
    maxWaitSeconds: Math.max(0, Number(config.maxWaitSeconds) || 0),
  };
}

function memberOrder(a: ReadyMember, b: ReadyMember, maxWaitSeconds: number): number {
  const deadlineA = a.ready + maxWaitSeconds;
  const deadlineB = b.ready + maxWaitSeconds;
  return deadlineA - deadlineB || b.priority - a.priority || a.ready - b.ready || a.jobIndex - b.jobIndex;
}

function chooseBatchMembers(
  members: ReadyMember[],
  config: ProcessBatchConfig,
): { members: ReadyMember[]; policyReady: number } | null {
  if (!members.length) return null;
  const byReady = [...members].sort((a, b) => a.ready - b.ready || b.priority - a.priority || a.jobIndex - b.jobIndex);
  const minBatchReady = byReady.length >= config.minBatchSize
    ? byReady[config.minBatchSize - 1].ready
    : Number.POSITIVE_INFINITY;
  const deadline = byReady[0].ready + config.maxWaitSeconds;
  const policyReady = Math.min(minBatchReady, deadline);
  const eligible = byReady.filter(member => member.ready <= policyReady);
  if (!eligible.length) return null;
  return {
    members: eligible.sort((a, b) => memberOrder(a, b, config.maxWaitSeconds)).slice(0, config.batchCapacity),
    policyReady,
  };
}

function expandBatchAtStart(
  initial: ReadyMember[],
  allReady: ReadyMember[],
  start: number,
  config: ProcessBatchConfig,
): ReadyMember[] {
  const byKey = new Map(initial.map(member => [`${member.jobIndex}:${member.attempt}`, member]));
  const candidates = allReady
    .filter(member => member.ready <= start)
    .sort((a, b) => memberOrder(a, b, config.maxWaitSeconds));
  for (const member of candidates) {
    if (byKey.size >= config.batchCapacity) break;
    byKey.set(`${member.jobIndex}:${member.attempt}`, member);
  }
  return Array.from(byKey.values()).sort((a, b) => memberOrder(a, b, config.maxWaitSeconds));
}

function shouldRework(seed: number, jobIndex: number, blockId: string, attempt: number, policy: DigitalTwinReworkPolicy | undefined): boolean {
  if (!policy) return false;
  const maxRepeats = Math.max(0, Math.floor(Number(policy.maxRepeats) || 0));
  if (attempt > maxRepeats) return false;
  const probability = Math.max(0, Math.min(1, Number(policy.probability) || 0));
  return keyedUnit(seed, `rework:${jobIndex}:${blockId}:${attempt}`) < probability;
}

function chooseBetter(candidate: Candidate, chosen: Candidate | null, rank: Map<string, number>): boolean {
  if (!chosen) return true;
  if (candidate.allocation.start !== chosen.allocation.start) return candidate.allocation.start < chosen.allocation.start;
  const candidatePriority = candidate.kind === 'batch' ? candidate.priority : candidate.priority;
  const chosenPriority = chosen.kind === 'batch' ? chosen.priority : chosen.priority;
  if (candidatePriority !== chosenPriority) return candidatePriority > chosenPriority;
  const candidateReady = candidate.kind === 'batch' ? candidate.policyReady : candidate.ready;
  const chosenReady = chosen.kind === 'batch' ? chosen.policyReady : chosen.ready;
  if (candidateReady !== chosenReady) return candidateReady < chosenReady;
  return (rank.get(candidate.block.id) ?? 0) < (rank.get(chosen.block.id) ?? 0);
}

function mergeCalendarsWithFailures(
  resources: ProcessResource[],
  base: Record<string, ProcessResourceCalendarPolicy> | undefined,
  policies: ResourceFailurePolicy[] | undefined,
  horizon: number,
  seed: number,
): { calendars: Record<string, ProcessResourceCalendarPolicy>; counts: Record<string, number>; warnings: string[] } {
  const resourceIds = new Set(resources.map(resource => resource.id));
  const result: Record<string, ProcessResourceCalendarPolicy> = {};
  const counts: Record<string, number> = {};
  const warnings: string[] = [];

  for (const resource of resources) {
    const source = base?.[resource.id];
    if (source) {
      result[resource.id] = {
        ...source,
        workingWindows: source.workingWindows?.map(window => ({ ...window })),
        plannedDowntime: source.plannedDowntime?.map(window => ({ ...window })),
      };
    }
  }

  for (const policy of policies || []) {
    if (!resourceIds.has(policy.resourceId)) {
      warnings.push(`Failure policy ${policy.resourceId} проигнорирована: ресурс не найден`);
      continue;
    }
    const windows = generateFailureWindows(policy, horizon, mixSeed(seed, hashString(policy.resourceId), 0xFA11));
    counts[policy.resourceId] = windows.length;
    const current = result[policy.resourceId] || {};
    result[policy.resourceId] = {
      ...current,
      workingWindows: current.workingWindows?.map(window => ({ ...window })),
      plannedDowntime: [...(current.plannedDowntime || []).map(window => ({ ...window })), ...windows],
    };
  }

  return { calendars: result, counts, warnings };
}

export function simulateUnifiedStochasticBatchTwin(
  blocks: GraphProcessBlock[],
  options: UnifiedTwinOptions,
): UnifiedTwinResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const seed = Number.isFinite(options.seed) ? Number(options.seed) : 20260828;
  const jobsCount = Math.max(1, Math.min(5000, Math.floor(Number(options.jobs) || 1)));
  const resources = options.resources.map(resource => ({ ...resource, capacity: Math.max(1, Math.floor(Number(resource.capacity) || 1)) }));
  const resourceById = new Map(resources.map(resource => [resource.id, resource]));
  const graph = analyzeGraphProcess(blocks, { batchSize: 1 });
  const baseSeconds: Record<string, number> = {};

  if (graph.stats.hasCycle) errors.push(`Unified Twin невозможен: цикл DAG (${graph.stats.cycleBlockIds.join(', ')})`);
  for (const block of blocks) {
    const result = graph.results[block.id];
    if (!result || result.seconds == null) errors.push(`Блок «${block.title}»: время не разрешено${result?.error ? ` — ${result.error}` : ''}`);
    else baseSeconds[block.id] = result.seconds;
    for (const requirement of normalizeRequirements(options.requirementsByBlock?.[block.id])) {
      const resource = resourceById.get(requirement.resourceId);
      if (!resource) errors.push(`Блок «${block.title}»: ресурс ${requirement.resourceId} не найден`);
      else if (requirement.units > resource.capacity) errors.push(`Блок «${block.title}»: требуется ${requirement.units} × «${resource.name}», доступно ${resource.capacity}`);
    }
    const rework = options.reworkByBlock?.[block.id];
    if (rework && (rework.probability < 0 || rework.probability > 1)) errors.push(`Блок «${block.title}»: вероятность rework должна быть 0…1`);
  }

  const batchConfigByBlock = new Map<string, ProcessBatchConfig>();
  for (const rawConfig of options.batchConfigs || []) {
    if (!blocks.some(block => block.id === rawConfig.blockId)) {
      warnings.push(`Batch config ${rawConfig.blockId} проигнорирован: блок отсутствует`);
      continue;
    }
    batchConfigByBlock.set(rawConfig.blockId, normalizeBatchConfig(rawConfig));
  }

  const topology = topologicalOrder(blocks);
  if (topology.cycleIds.length) errors.push(`Топологическая сортировка не завершена: ${topology.cycleIds.join(', ')}`);
  if (errors.length) return { ok: false, runs: [], batchCycles: [], jobs: [], resourceStats: [], blockStats: [], stats: emptyStats(), warnings, errors };

  const releases = buildReleaseTimes(jobsCount, seed, options.arrivals);
  const priorities = Array.from({ length: jobsCount }, (_, index) => jobPriority(index, options.priority));
  const serialBase = Object.values(baseSeconds).reduce((sum, seconds) => sum + seconds, 0);
  const failureHorizon = Math.max(86400, (releases.at(-1) || 0) + serialBase * jobsCount * 2 + 86400);
  const merged = mergeCalendarsWithFailures(resources, options.resourceCalendars, options.failurePolicies, failureHorizon, seed);
  warnings.push(...merged.warnings);

  for (const resourceId of Object.keys(options.resourceCalendars || {})) {
    if (!resourceById.has(resourceId)) warnings.push(`Календарь ${resourceId} проигнорирован: ресурс не найден`);
  }

  const blockById = new Map(blocks.map(block => [block.id, block]));
  const rank = new Map(topology.order.map((id, index) => [id, index]));
  const calendars = new Map<string, ResourceCalendar>();
  for (const resource of resources) {
    calendars.set(resource.id, {
      resource,
      policy: merged.calendars[resource.id],
      lanes: Array.from({ length: resource.capacity }, () => []),
    });
  }

  const completedFinish = new Map<string, number>();
  const attempts = new Map<string, number>();
  const retryReady = new Map<string, number>();
  const runs: UnifiedTwinTaskRun[] = [];
  const batchCycles: UnifiedTwinBatchCycle[] = [];
  const batchSequenceByBlock = new Map<string, number>();
  const completedTarget = jobsCount * blocks.length;
  const baseKey = (jobIndex: number, blockId: string) => `${jobIndex}:${blockId}`;

  while (completedFinish.size < completedTarget) {
    const readyByBatchBlock = new Map<string, ReadyMember[]>();
    let chosen: Candidate | null = null;

    for (let jobIndex = 0; jobIndex < jobsCount; jobIndex += 1) {
      for (const blockId of topology.order) {
        const key = baseKey(jobIndex, blockId);
        if (completedFinish.has(key)) continue;
        const block = blockById.get(blockId)!;
        const attempt = (attempts.get(key) || 0) + 1;
        const retry = retryReady.get(key);
        let ready: number;

        if (retry != null) {
          ready = retry;
        } else {
          const depKeys = block.dependencies.filter(dep => blockById.has(dep) && dep !== block.id).map(dep => baseKey(jobIndex, dep));
          if (!depKeys.every(dep => completedFinish.has(dep))) continue;
          ready = Math.max(releases[jobIndex], depKeys.length ? Math.max(...depKeys.map(dep => completedFinish.get(dep)!)) : 0);
        }

        const batchConfig = batchConfigByBlock.get(blockId);
        if (batchConfig) {
          const list = readyByBatchBlock.get(blockId) || [];
          list.push({ jobIndex, attempt, priority: priorities[jobIndex], ready });
          readyByBatchBlock.set(blockId, list);
          continue;
        }

        const duration = baseSeconds[blockId] * sampleFactor(seed, `duration:${jobIndex}:${blockId}:${attempt}`, options.uncertaintyByBlock?.[blockId]);
        const requirements = normalizeRequirements(options.requirementsByBlock?.[blockId]);
        const allocation = findAllocation(calendars, requirements, ready, duration);
        if (!allocation) continue;
        const candidate: IndividualCandidate = {
          kind: 'individual', jobIndex, block, attempt, priority: priorities[jobIndex], ready, duration, requirements, allocation,
        };
        if (chooseBetter(candidate, chosen, rank)) chosen = candidate;
      }
    }

    for (const [blockId, members] of readyByBatchBlock) {
      const block = blockById.get(blockId)!;
      const config = batchConfigByBlock.get(blockId)!;
      const group = chooseBatchMembers(members, config);
      if (!group) continue;
      const sequence = (batchSequenceByBlock.get(blockId) || 0) + 1;
      const duration = baseSeconds[blockId] * sampleFactor(seed, `batch-duration:${blockId}:${sequence}`, options.uncertaintyByBlock?.[blockId]);
      const requirements = normalizeRequirements(options.requirementsByBlock?.[blockId]);
      const allocation = findAllocation(calendars, requirements, group.policyReady, duration);
      if (!allocation) continue;
      const expanded = expandBatchAtStart(group.members, members, allocation.start, config);
      const candidate: BatchCandidate = {
        kind: 'batch',
        block,
        members: expanded,
        config,
        duration,
        requirements,
        allocation,
        policyReady: group.policyReady,
        priority: Math.max(...expanded.map(member => member.priority)),
        sequence,
      };
      if (chooseBetter(candidate, chosen, rank)) chosen = candidate;
    }

    if (!chosen) {
      errors.push('Unified Twin scheduler не нашёл доступную задачу; проверьте зависимости, batch policy, ресурсы и календари');
      break;
    }

    if (chosen.kind === 'individual') {
      const key = baseKey(chosen.jobIndex, chosen.block.id);
      const taskId = `${key}:attempt:${chosen.attempt}`;
      reserve(calendars, chosen.allocation, chosen.requirements, chosen.duration, taskId);
      const finish = chosen.allocation.start + chosen.duration;
      attempts.set(key, chosen.attempt);
      const reworkTriggered = shouldRework(seed, chosen.jobIndex, chosen.block.id, chosen.attempt, options.reworkByBlock?.[chosen.block.id]);
      if (reworkTriggered) retryReady.set(key, finish);
      else {
        retryReady.delete(key);
        completedFinish.set(key, finish);
      }
      runs.push({
        taskId,
        jobIndex: chosen.jobIndex,
        blockId: chosen.block.id,
        blockTitle: chosen.block.title,
        attempt: chosen.attempt,
        priority: chosen.priority,
        readySeconds: chosen.ready,
        startSeconds: chosen.allocation.start,
        finishSeconds: finish,
        durationSeconds: chosen.duration,
        waitSeconds: chosen.allocation.start - chosen.ready,
        reworkTriggered,
        requirements: chosen.requirements,
      });
      continue;
    }

    const batchId = `${chosen.block.id}:batch:${chosen.sequence}`;
    reserve(calendars, chosen.allocation, chosen.requirements, chosen.duration, batchId);
    const finish = chosen.allocation.start + chosen.duration;
    batchSequenceByBlock.set(chosen.block.id, chosen.sequence);

    for (const member of chosen.members) {
      const key = baseKey(member.jobIndex, chosen.block.id);
      attempts.set(key, member.attempt);
      const reworkTriggered = shouldRework(seed, member.jobIndex, chosen.block.id, member.attempt, options.reworkByBlock?.[chosen.block.id]);
      if (reworkTriggered) retryReady.set(key, finish);
      else {
        retryReady.delete(key);
        completedFinish.set(key, finish);
      }
      runs.push({
        taskId: `${batchId}:job:${member.jobIndex}:attempt:${member.attempt}`,
        jobIndex: member.jobIndex,
        blockId: chosen.block.id,
        blockTitle: chosen.block.title,
        attempt: member.attempt,
        priority: member.priority,
        readySeconds: member.ready,
        startSeconds: chosen.allocation.start,
        finishSeconds: finish,
        durationSeconds: chosen.duration,
        waitSeconds: chosen.allocation.start - member.ready,
        reworkTriggered,
        requirements: chosen.requirements,
        batchId,
        batchSize: chosen.members.length,
      });
    }

    batchCycles.push({
      batchId,
      blockId: chosen.block.id,
      blockTitle: chosen.block.title,
      startSeconds: chosen.allocation.start,
      finishSeconds: finish,
      durationSeconds: chosen.duration,
      jobIndexes: chosen.members.map(member => member.jobIndex),
      attempts: chosen.members.map(member => member.attempt),
      batchCapacity: chosen.config.batchCapacity,
      fillPercent: (chosen.members.length / chosen.config.batchCapacity) * 100,
      averageReadyWaitSeconds: chosen.members.reduce((sum, member) => sum + chosen.allocation.start - member.ready, 0) / chosen.members.length,
      highestPriority: chosen.priority,
    });
  }

  if (errors.length || completedFinish.size !== completedTarget) {
    return { ok: false, runs, batchCycles, jobs: [], resourceStats: [], blockStats: [], stats: emptyStats(), warnings, errors };
  }

  const jobs: UnifiedTwinJobStats[] = [];
  for (let jobIndex = 0; jobIndex < jobsCount; jobIndex += 1) {
    const jobRuns = runs.filter(run => run.jobIndex === jobIndex);
    const completion = Math.max(releases[jobIndex], ...jobRuns.map(run => run.finishSeconds));
    jobs.push({
      jobIndex,
      priority: priorities[jobIndex],
      releaseSeconds: releases[jobIndex],
      completionSeconds: completion,
      cycleSeconds: completion - releases[jobIndex],
      waitSeconds: jobRuns.reduce((sum, run) => sum + run.waitSeconds, 0),
      reworkRuns: jobRuns.filter(run => run.reworkTriggered).length,
    });
  }

  const makespanSeconds = Math.max(...jobs.map(job => job.completionSeconds));
  const firstRelease = Math.min(...jobs.map(job => job.releaseSeconds));
  const firstCompletion = Math.min(...jobs.map(job => job.completionSeconds));
  const lastCompletion = Math.max(...jobs.map(job => job.completionSeconds));
  const totalWait = runs.reduce((sum, run) => sum + run.waitSeconds, 0);
  const totalReworkRuns = runs.filter(run => run.reworkTriggered).length;
  const routinePriority = Number(options.priority?.routinePriority) || 0;
  const statJobs = jobs.filter(job => job.priority > routinePriority);
  const routineJobs = jobs.filter(job => job.priority <= routinePriority);
  const statAverageCycle = average(statJobs.map(job => job.cycleSeconds));
  const routineAverageCycle = average(routineJobs.map(job => job.cycleSeconds));

  const resourceStats: UnifiedTwinResourceStats[] = resources.map(resource => {
    const calendar = calendars.get(resource.id)!;
    const busyUnitSeconds = calendar.lanes.reduce((sum, lane) => sum + lane.reduce((laneSum, reservation) => laneSum + reservation.finish - reservation.start, 0), 0);
    const availablePerLane = availableSecondsWithin(calendar.policy, makespanSeconds);
    const availableUnitSeconds = availablePerLane * resource.capacity;
    return {
      id: resource.id,
      name: resource.name,
      capacity: resource.capacity,
      busyUnitSeconds,
      availableUnitSeconds,
      availabilityPercent: makespanSeconds > 0 ? (availablePerLane / makespanSeconds) * 100 : 100,
      utilizationPercent: availableUnitSeconds > 0 ? (busyUnitSeconds / availableUnitSeconds) * 100 : 0,
      peakUnits: peakUnits(calendar),
      generatedFailureWindows: merged.counts[resource.id] || 0,
    };
  });
  resourceStats.sort((a, b) => b.utilizationPercent - a.utilizationPercent);

  const blockStats: UnifiedTwinBlockStats[] = blocks.map(block => {
    const blockRuns = runs.filter(run => run.blockId === block.id);
    const blockCycles = batchCycles.filter(cycle => cycle.blockId === block.id);
    const reworkRuns = blockRuns.filter(run => run.reworkTriggered).length;
    return {
      blockId: block.id,
      blockTitle: block.title,
      runs: blockRuns.length,
      reworkRuns,
      reworkRatePercent: blockRuns.length ? (reworkRuns / blockRuns.length) * 100 : 0,
      averageDurationSeconds: blockRuns.length ? blockRuns.reduce((sum, run) => sum + run.durationSeconds, 0) / blockRuns.length : 0,
      averageWaitSeconds: blockRuns.length ? blockRuns.reduce((sum, run) => sum + run.waitSeconds, 0) / blockRuns.length : 0,
      p95WaitSeconds: percentile(blockRuns.map(run => run.waitSeconds), 0.95),
      batchCycles: blockCycles.length,
      averageBatchFillPercent: blockCycles.length ? blockCycles.reduce((sum, cycle) => sum + cycle.fillPercent, 0) / blockCycles.length : 0,
    };
  });

  const throughputWindow = Math.max(0, makespanSeconds - firstRelease);
  const outputWindow = Math.max(0, lastCompletion - firstCompletion);
  const averageBatchFillPercent = batchCycles.length ? batchCycles.reduce((sum, cycle) => sum + cycle.fillPercent, 0) / batchCycles.length : 0;
  const partialBatchCycles = batchCycles.filter(cycle => cycle.jobIndexes.length < cycle.batchCapacity).length;
  const stats: UnifiedTwinStats = {
    makespanSeconds,
    completedJobs: jobs.length,
    totalRuns: runs.length,
    totalReworkRuns,
    reworkRatePercent: runs.length ? (totalReworkRuns / runs.length) * 100 : 0,
    batchCycles: batchCycles.length,
    partialBatchCycles,
    averageBatchFillPercent,
    averageCycleSeconds: jobs.reduce((sum, job) => sum + job.cycleSeconds, 0) / jobs.length,
    p95CycleSeconds: percentile(jobs.map(job => job.cycleSeconds), 0.95),
    averageWaitSeconds: runs.length ? totalWait / runs.length : 0,
    p95WaitSeconds: percentile(runs.map(run => run.waitSeconds), 0.95),
    throughputPerHour: throughputWindow > 0 ? (jobs.length * 3600) / throughputWindow : null,
    outputRatePerHour: jobs.length > 1 && outputWindow > 0 ? ((jobs.length - 1) * 3600) / outputWindow : null,
    statAverageCycleSeconds: statAverageCycle,
    routineAverageCycleSeconds: routineAverageCycle,
    statAdvantagePercent: statAverageCycle != null && routineAverageCycle != null && routineAverageCycle > 0
      ? ((routineAverageCycle - statAverageCycle) / routineAverageCycle) * 100
      : null,
    resourceBottleneckId: resourceStats[0]?.id,
    resourceBottleneckName: resourceStats[0]?.name,
    resourceBottleneckUtilizationPercent: resourceStats[0]?.utilizationPercent || 0,
  };

  if (options.failurePolicies?.length && !batchCycles.length) {
    warnings.push('MTBF/MTTR активен, но batch stages не заданы: unified scheduler работает как stochastic resource twin');
  }

  return { ok: true, runs, batchCycles, jobs, resourceStats, blockStats, stats, warnings, errors };
}
