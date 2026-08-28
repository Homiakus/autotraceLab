import { GraphProcessBlock, analyzeGraphProcess } from './processGraphMath';
import { ProcessBlockUncertainty } from './processRisk';
import { ProcessResource, ProcessResourceRequirement } from './processSimulation';

export type DigitalTwinArrivalKind = 'fixed' | 'poisson';

export interface DigitalTwinArrivalConfig {
  kind: DigitalTwinArrivalKind;
  intervalSeconds?: number;
  meanIntervalSeconds?: number;
}

export interface DigitalTwinReworkPolicy {
  probability: number;
  maxRepeats: number;
}

export interface DigitalTwinPriorityConfig {
  priorityByJob?: Record<number, number>;
  statEveryN?: number;
  statPriority?: number;
  routinePriority?: number;
}

export interface DigitalTwinOptions {
  jobs: number;
  seed?: number;
  arrivals?: DigitalTwinArrivalConfig;
  resources: ProcessResource[];
  requirementsByBlock?: Record<string, ProcessResourceRequirement[]>;
  uncertaintyByBlock?: Record<string, ProcessBlockUncertainty>;
  reworkByBlock?: Record<string, DigitalTwinReworkPolicy>;
  priority?: DigitalTwinPriorityConfig;
}

export interface DigitalTwinTaskRun {
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
}

export interface DigitalTwinJobStats {
  jobIndex: number;
  priority: number;
  releaseSeconds: number;
  completionSeconds: number;
  cycleSeconds: number;
  waitSeconds: number;
  reworkRuns: number;
}

export interface DigitalTwinResourceStats {
  id: string;
  name: string;
  capacity: number;
  busyUnitSeconds: number;
  utilizationPercent: number;
  peakUnits: number;
}

export interface DigitalTwinBlockStats {
  blockId: string;
  blockTitle: string;
  runs: number;
  reworkRuns: number;
  reworkRatePercent: number;
  averageDurationSeconds: number;
  averageWaitSeconds: number;
  p95WaitSeconds: number;
}

export interface DigitalTwinStats {
  makespanSeconds: number;
  completedJobs: number;
  totalRuns: number;
  totalReworkRuns: number;
  reworkRatePercent: number;
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

export interface DigitalTwinResult {
  ok: boolean;
  runs: DigitalTwinTaskRun[];
  jobs: DigitalTwinJobStats[];
  resourceStats: DigitalTwinResourceStats[];
  blockStats: DigitalTwinBlockStats[];
  stats: DigitalTwinStats;
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
  lanes: Reservation[][];
}

interface Allocation {
  start: number;
  laneIndexesByResource: Record<string, number[]>;
}

interface Candidate {
  jobIndex: number;
  block: GraphProcessBlock;
  attempt: number;
  priority: number;
  ready: number;
  duration: number;
  requirements: ProcessResourceRequirement[];
  allocation: Allocation;
}

function emptyStats(): DigitalTwinStats {
  return {
    makespanSeconds: 0,
    completedJobs: 0,
    totalRuns: 0,
    totalReworkRuns: 0,
    reworkRatePercent: 0,
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

function clampFactor(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : fallback;
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

function exponential(random: () => number, mean: number): number {
  const u = Math.max(Number.EPSILON, 1 - random());
  return -Math.log(u) * mean;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index];
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
    merged.set(item.resourceId, Math.max(merged.get(item.resourceId) || 0, Math.max(1, Math.floor(Number(item.units) || 1))));
  }
  return Array.from(merged, ([resourceId, units]) => ({ resourceId, units }));
}

function overlaps(start: number, finish: number, reservation: Reservation): boolean {
  return start < reservation.finish && finish > reservation.start;
}

function freeLanes(calendar: ResourceCalendar, start: number, duration: number): number[] {
  const finish = start + duration;
  const free: number[] = [];
  calendar.lanes.forEach((lane, index) => {
    if (!lane.some(reservation => overlaps(start, finish, reservation))) free.push(index);
  });
  return free;
}

function findAllocation(
  calendars: Map<string, ResourceCalendar>,
  requirements: ProcessResourceRequirement[],
  ready: number,
  duration: number,
): Allocation | null {
  if (!requirements.length || duration === 0) return { start: ready, laneIndexesByResource: {} };
  const candidates = new Set<number>([ready]);
  for (const requirement of requirements) {
    const calendar = calendars.get(requirement.resourceId);
    if (!calendar) return null;
    for (const lane of calendar.lanes) {
      for (const reservation of lane) if (reservation.finish >= ready) candidates.add(reservation.finish);
    }
  }
  for (const start of Array.from(candidates).sort((a, b) => a - b)) {
    const laneIndexesByResource: Record<string, number[]> = {};
    let feasible = true;
    for (const requirement of requirements) {
      const free = freeLanes(calendars.get(requirement.resourceId)!, start, duration);
      if (free.length < requirement.units) {
        feasible = false;
        break;
      }
      laneIndexesByResource[requirement.resourceId] = free.slice(0, requirement.units);
    }
    if (feasible) return { start, laneIndexesByResource };
  }
  let start = ready;
  for (const requirement of requirements) {
    const calendar = calendars.get(requirement.resourceId)!;
    for (const lane of calendar.lanes) for (const reservation of lane) start = Math.max(start, reservation.finish);
  }
  const laneIndexesByResource: Record<string, number[]> = {};
  for (const requirement of requirements) {
    const free = freeLanes(calendars.get(requirement.resourceId)!, start, duration);
    if (free.length < requirement.units) return null;
    laneIndexesByResource[requirement.resourceId] = free.slice(0, requirement.units);
  }
  return { start, laneIndexesByResource };
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

function buildReleaseTimes(jobs: number, random: () => number, arrival: DigitalTwinArrivalConfig | undefined): number[] {
  const releases = [0];
  const config = arrival || { kind: 'fixed' as const, intervalSeconds: 0 };
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

function chooseBetter(candidate: Candidate, chosen: Candidate | null, rank: Map<string, number>): boolean {
  if (!chosen) return true;
  if (candidate.allocation.start !== chosen.allocation.start) return candidate.allocation.start < chosen.allocation.start;
  if (candidate.priority !== chosen.priority) return candidate.priority > chosen.priority;
  if (candidate.ready !== chosen.ready) return candidate.ready < chosen.ready;
  if (candidate.jobIndex !== chosen.jobIndex) return candidate.jobIndex < chosen.jobIndex;
  return (rank.get(candidate.block.id) ?? 0) < (rank.get(chosen.block.id) ?? 0);
}

export function simulateStochasticDigitalTwin(
  blocks: GraphProcessBlock[],
  options: DigitalTwinOptions,
): DigitalTwinResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const jobsCount = Math.max(1, Math.min(5000, Math.floor(Number(options.jobs) || 1)));
  const random = mulberry32(Number.isFinite(options.seed) ? Number(options.seed) : 246813579);
  const resources = options.resources.map(resource => ({ ...resource, capacity: Math.max(1, Math.floor(Number(resource.capacity) || 1)) }));
  const resourceById = new Map(resources.map(resource => [resource.id, resource]));
  const graph = analyzeGraphProcess(blocks, { batchSize: 1 });
  const baseSeconds: Record<string, number> = {};

  if (graph.stats.hasCycle) errors.push(`Digital Twin невозможен: цикл DAG (${graph.stats.cycleBlockIds.join(', ')})`);
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
  const topology = topologicalOrder(blocks);
  if (topology.cycleIds.length) errors.push(`Топологическая сортировка не завершена: ${topology.cycleIds.join(', ')}`);
  if (errors.length) return { ok: false, runs: [], jobs: [], resourceStats: [], blockStats: [], stats: emptyStats(), warnings, errors };

  const releases = buildReleaseTimes(jobsCount, random, options.arrivals);
  const priorities = Array.from({ length: jobsCount }, (_, index) => jobPriority(index, options.priority));
  const blockById = new Map(blocks.map(block => [block.id, block]));
  const rank = new Map(topology.order.map((id, index) => [id, index]));
  const calendars = new Map<string, ResourceCalendar>();
  for (const resource of resources) calendars.set(resource.id, { resource, lanes: Array.from({ length: resource.capacity }, () => []) });

  const completedFinish = new Map<string, number>();
  const attempts = new Map<string, number>();
  const retryReady = new Map<string, number>();
  const durationCache = new Map<string, number>();
  const runs: DigitalTwinTaskRun[] = [];
  const completedTarget = jobsCount * blocks.length;
  const baseKey = (jobIndex: number, blockId: string) => `${jobIndex}:${blockId}`;
  const durationKey = (jobIndex: number, blockId: string, attempt: number) => `${jobIndex}:${blockId}:${attempt}`;

  while (completedFinish.size < completedTarget) {
    let chosen: Candidate | null = null;

    for (let jobIndex = 0; jobIndex < jobsCount; jobIndex += 1) {
      for (const blockId of topology.order) {
        const key = baseKey(jobIndex, blockId);
        if (completedFinish.has(key)) continue;
        const block = blockById.get(blockId)!;
        const currentAttempt = (attempts.get(key) || 0) + 1;
        const retry = retryReady.get(key);
        let ready: number;

        if (retry != null) {
          ready = retry;
        } else {
          const depKeys = block.dependencies.filter(dep => blockById.has(dep) && dep !== block.id).map(dep => baseKey(jobIndex, dep));
          if (!depKeys.every(dep => completedFinish.has(dep))) continue;
          ready = Math.max(releases[jobIndex], depKeys.length ? Math.max(...depKeys.map(dep => completedFinish.get(dep)!)) : 0);
        }

        const dKey = durationKey(jobIndex, blockId, currentAttempt);
        let duration = durationCache.get(dKey);
        if (duration == null) {
          duration = baseSeconds[blockId] * sampleFactor(random, options.uncertaintyByBlock?.[blockId]);
          durationCache.set(dKey, duration);
        }
        const requirements = normalizeRequirements(options.requirementsByBlock?.[blockId]);
        const allocation = findAllocation(calendars, requirements, ready, duration);
        if (!allocation) continue;
        const candidate: Candidate = {
          jobIndex,
          block,
          attempt: currentAttempt,
          priority: priorities[jobIndex],
          ready,
          duration,
          requirements,
          allocation,
        };
        if (chooseBetter(candidate, chosen, rank)) chosen = candidate;
      }
    }

    if (!chosen) {
      errors.push('Digital Twin scheduler не нашёл доступную задачу; проверьте зависимости/ресурсы');
      break;
    }

    const key = baseKey(chosen.jobIndex, chosen.block.id);
    const taskId = `${key}:attempt:${chosen.attempt}`;
    reserve(calendars, chosen.allocation, chosen.requirements, chosen.duration, taskId);
    const finish = chosen.allocation.start + chosen.duration;
    attempts.set(key, chosen.attempt);

    const policy = options.reworkByBlock?.[chosen.block.id];
    const maxRepeats = Math.max(0, Math.floor(Number(policy?.maxRepeats) || 0));
    const reworkTriggered = Boolean(policy && chosen.attempt <= maxRepeats && random() < Math.max(0, Math.min(1, policy.probability)));
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
  }

  if (errors.length || completedFinish.size !== completedTarget) {
    return { ok: false, runs, jobs: [], resourceStats: [], blockStats: [], stats: emptyStats(), warnings, errors };
  }

  const jobs: DigitalTwinJobStats[] = [];
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
  const statJobs = jobs.filter(job => job.priority > (Number(options.priority?.routinePriority) || 0));
  const routineJobs = jobs.filter(job => job.priority <= (Number(options.priority?.routinePriority) || 0));
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const statAverageCycle = average(statJobs.map(job => job.cycleSeconds));
  const routineAverageCycle = average(routineJobs.map(job => job.cycleSeconds));

  const resourceStats: DigitalTwinResourceStats[] = resources.map(resource => {
    const calendar = calendars.get(resource.id)!;
    const busyUnitSeconds = calendar.lanes.reduce((sum, lane) => sum + lane.reduce((laneSum, reservation) => laneSum + reservation.finish - reservation.start, 0), 0);
    return {
      id: resource.id,
      name: resource.name,
      capacity: resource.capacity,
      busyUnitSeconds,
      utilizationPercent: makespanSeconds > 0 ? (busyUnitSeconds / (makespanSeconds * resource.capacity)) * 100 : 0,
      peakUnits: peakUnits(calendar),
    };
  });
  resourceStats.sort((a, b) => b.utilizationPercent - a.utilizationPercent);

  const blockStats: DigitalTwinBlockStats[] = blocks.map(block => {
    const blockRuns = runs.filter(run => run.blockId === block.id);
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
    };
  });

  const throughputWindow = Math.max(0, makespanSeconds - firstRelease);
  const outputWindow = Math.max(0, lastCompletion - firstCompletion);
  const averageCycleSeconds = jobs.reduce((sum, job) => sum + job.cycleSeconds, 0) / jobs.length;
  const stats: DigitalTwinStats = {
    makespanSeconds,
    completedJobs: jobs.length,
    totalRuns: runs.length,
    totalReworkRuns,
    reworkRatePercent: runs.length ? (totalReworkRuns / runs.length) * 100 : 0,
    averageCycleSeconds,
    p95CycleSeconds: percentile(jobs.map(job => job.cycleSeconds), 0.95),
    averageWaitSeconds: runs.length ? totalWait / runs.length : 0,
    p95WaitSeconds: percentile(runs.map(run => run.waitSeconds), 0.95),
    throughputPerHour: throughputWindow > 0 ? jobs.length / (throughputWindow / 3600) : null,
    outputRatePerHour: outputWindow > 0 && jobs.length > 1 ? (jobs.length - 1) / (outputWindow / 3600) : null,
    statAverageCycleSeconds: statAverageCycle,
    routineAverageCycleSeconds: routineAverageCycle,
    statAdvantagePercent: statAverageCycle != null && routineAverageCycle != null && routineAverageCycle > 0
      ? ((routineAverageCycle - statAverageCycle) / routineAverageCycle) * 100
      : null,
    resourceBottleneckId: resourceStats[0]?.id,
    resourceBottleneckName: resourceStats[0]?.name,
    resourceBottleneckUtilizationPercent: resourceStats[0]?.utilizationPercent || 0,
  };

  if (jobsCount > 1000) warnings.push('Большая партия может заметно нагружать браузер, особенно при rework и большом DAG');
  if ((options.arrivals?.kind || 'fixed') === 'poisson') warnings.push('Poisson-поток моделирует случайные интервалы поступления и воспроизводится через seed');

  return { ok: true, runs, jobs, resourceStats, blockStats, stats, warnings, errors };
}
