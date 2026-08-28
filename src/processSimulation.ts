import { GraphProcessBlock, analyzeGraphProcess } from './processGraphMath';

export interface ProcessResource {
  id: string;
  name: string;
  capacity: number;
}

export interface ProcessResourceRequirement {
  resourceId: string;
  units: number;
}

export interface ProcessSimulationOptions {
  batchSize: number;
  releaseIntervalSeconds?: number;
  resources: ProcessResource[];
  requirementsByBlock?: Record<string, ProcessResourceRequirement[]>;
}

export interface ProcessTaskRun {
  taskId: string;
  jobIndex: number;
  blockId: string;
  blockTitle: string;
  readySeconds: number;
  startSeconds: number;
  finishSeconds: number;
  durationSeconds: number;
  waitSeconds: number;
  requirements: ProcessResourceRequirement[];
}

export interface ProcessResourceStats {
  id: string;
  name: string;
  capacity: number;
  busyUnitSeconds: number;
  utilizationPercent: number;
  peakUnits: number;
}

export interface ProcessBlockSimulationStats {
  blockId: string;
  blockTitle: string;
  runs: number;
  averageWaitSeconds: number;
  maxWaitSeconds: number;
  totalWaitSeconds: number;
}

export interface ProcessJobStats {
  jobIndex: number;
  releaseSeconds: number;
  completionSeconds: number;
  cycleSeconds: number;
  waitSeconds: number;
}

export interface ProcessSimulationStats {
  makespanSeconds: number;
  completedJobs: number;
  totalTaskRuns: number;
  firstCompletionSeconds: number | null;
  lastCompletionSeconds: number | null;
  averageCycleSeconds: number;
  p95CycleSeconds: number;
  averageWaitSeconds: number;
  totalWaitSeconds: number;
  throughputPerHour: number | null;
  outputRatePerHour: number | null;
  resourceBottleneckId?: string;
  resourceBottleneckName?: string;
  resourceBottleneckUtilizationPercent: number;
}

export interface ProcessSimulationResult {
  ok: boolean;
  runs: ProcessTaskRun[];
  jobs: ProcessJobStats[];
  resourceStats: ProcessResourceStats[];
  blockStats: ProcessBlockSimulationStats[];
  stats: ProcessSimulationStats;
  warnings: string[];
  errors: string[];
}

interface ResourceInterval {
  start: number;
  finish: number;
  taskId: string;
}

interface ResourceCalendar {
  resource: ProcessResource;
  lanes: ResourceInterval[][];
}

interface CandidateAllocation {
  start: number;
  laneIndexesByResource: Record<string, number[]>;
}

function emptyStats(): ProcessSimulationStats {
  return {
    makespanSeconds: 0,
    completedJobs: 0,
    totalTaskRuns: 0,
    firstCompletionSeconds: null,
    lastCompletionSeconds: null,
    averageCycleSeconds: 0,
    p95CycleSeconds: 0,
    averageWaitSeconds: 0,
    totalWaitSeconds: 0,
    throughputPerHour: null,
    outputRatePerHour: null,
    resourceBottleneckUtilizationPercent: 0,
  };
}

function percentile(values: number[], percentileValue: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentileValue * sorted.length) - 1));
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
    const dependencies = Array.from(new Set(block.dependencies.filter(id => ids.has(id) && id !== block.id)));
    indegree[block.id] = dependencies.length;
    for (const dependency of dependencies) children[dependency].push(block.id);
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

  return {
    order,
    cycleIds: blocks.filter(block => !order.includes(block.id)).map(block => block.id),
  };
}

function overlaps(start: number, finish: number, interval: ResourceInterval): boolean {
  return start < interval.finish && finish > interval.start;
}

function freeLaneIndexes(calendar: ResourceCalendar, start: number, duration: number): number[] {
  const finish = start + duration;
  const free: number[] = [];
  calendar.lanes.forEach((lane, index) => {
    if (!lane.some(interval => overlaps(start, finish, interval))) free.push(index);
  });
  return free;
}

function findEarliestAllocation(
  calendars: Map<string, ResourceCalendar>,
  requirements: ProcessResourceRequirement[],
  ready: number,
  duration: number,
): CandidateAllocation | null {
  if (!requirements.length || duration === 0) return { start: ready, laneIndexesByResource: {} };

  const candidateTimes = new Set<number>([ready]);
  for (const requirement of requirements) {
    const calendar = calendars.get(requirement.resourceId);
    if (!calendar) return null;
    for (const lane of calendar.lanes) {
      for (const interval of lane) {
        if (interval.finish >= ready) candidateTimes.add(interval.finish);
      }
    }
  }

  const orderedCandidates = Array.from(candidateTimes).sort((a, b) => a - b);
  for (const start of orderedCandidates) {
    const laneIndexesByResource: Record<string, number[]> = {};
    let feasible = true;
    for (const requirement of requirements) {
      const calendar = calendars.get(requirement.resourceId)!;
      const free = freeLaneIndexes(calendar, start, duration);
      if (free.length < requirement.units) {
        feasible = false;
        break;
      }
      laneIndexesByResource[requirement.resourceId] = free.slice(0, requirement.units);
    }
    if (feasible) return { start, laneIndexesByResource };
  }

  // The end of the latest reservation is always a feasible candidate when capacities are valid.
  let start = ready;
  for (const requirement of requirements) {
    const calendar = calendars.get(requirement.resourceId)!;
    for (const lane of calendar.lanes) {
      for (const interval of lane) start = Math.max(start, interval.finish);
    }
  }
  const laneIndexesByResource: Record<string, number[]> = {};
  for (const requirement of requirements) {
    const calendar = calendars.get(requirement.resourceId)!;
    const free = freeLaneIndexes(calendar, start, duration);
    if (free.length < requirement.units) return null;
    laneIndexesByResource[requirement.resourceId] = free.slice(0, requirement.units);
  }
  return { start, laneIndexesByResource };
}

function reserve(
  calendars: Map<string, ResourceCalendar>,
  allocation: CandidateAllocation,
  requirements: ProcessResourceRequirement[],
  duration: number,
  taskId: string,
): void {
  for (const requirement of requirements) {
    const calendar = calendars.get(requirement.resourceId)!;
    for (const laneIndex of allocation.laneIndexesByResource[requirement.resourceId] || []) {
      calendar.lanes[laneIndex].push({
        start: allocation.start,
        finish: allocation.start + duration,
        taskId,
      });
      calendar.lanes[laneIndex].sort((a, b) => a.start - b.start || a.finish - b.finish);
    }
  }
}

function calculatePeakUnits(calendar: ResourceCalendar): number {
  const events: Array<{ time: number; delta: number }> = [];
  for (const lane of calendar.lanes) {
    for (const interval of lane) {
      events.push({ time: interval.start, delta: 1 });
      events.push({ time: interval.finish, delta: -1 });
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

export function simulateResourceConstrainedProcess(
  blocks: GraphProcessBlock[],
  options: ProcessSimulationOptions,
): ProcessSimulationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const batchSize = Math.max(1, Math.floor(Number(options.batchSize) || 1));
  const releaseIntervalSeconds = Math.max(0, Number(options.releaseIntervalSeconds) || 0);
  const resources = options.resources.map(resource => ({
    ...resource,
    capacity: Math.max(1, Math.floor(Number(resource.capacity) || 1)),
  }));
  const resourceById = new Map(resources.map(resource => [resource.id, resource]));
  const requirementsByBlock = options.requirementsByBlock || {};

  const graphAnalysis = analyzeGraphProcess(blocks, { batchSize: 1 });
  if (graphAnalysis.stats.hasCycle) {
    errors.push(`Симуляция невозможна: цикл зависимостей (${graphAnalysis.stats.cycleBlockIds.join(', ')})`);
  }

  for (const block of blocks) {
    const result = graphAnalysis.results[block.id];
    if (!result || result.seconds == null) errors.push(`Блок «${block.title}»: время не разрешено${result?.error ? ` — ${result.error}` : ''}`);
    for (const requirement of requirementsByBlock[block.id] || []) {
      const resource = resourceById.get(requirement.resourceId);
      if (!resource) {
        errors.push(`Блок «${block.title}»: ресурс ${requirement.resourceId} не найден`);
        continue;
      }
      const units = Math.floor(Number(requirement.units) || 0);
      if (units < 1) errors.push(`Блок «${block.title}»: для ресурса «${resource.name}» требуется минимум 1 единица`);
      if (units > resource.capacity) errors.push(`Блок «${block.title}»: требуется ${units} × «${resource.name}», доступно ${resource.capacity}`);
    }
  }

  const topology = topologicalOrder(blocks);
  if (topology.cycleIds.length) errors.push(`Топологическая сортировка не завершена: ${topology.cycleIds.join(', ')}`);
  if (errors.length) {
    return { ok: false, runs: [], jobs: [], resourceStats: [], blockStats: [], stats: emptyStats(), warnings, errors };
  }

  const blockById = new Map(blocks.map(block => [block.id, block]));
  const topoRank = new Map(topology.order.map((id, index) => [id, index]));
  const calendars = new Map<string, ResourceCalendar>();
  for (const resource of resources) {
    calendars.set(resource.id, {
      resource,
      lanes: Array.from({ length: resource.capacity }, () => []),
    });
  }

  const scheduledFinish = new Map<string, number>();
  const runs: ProcessTaskRun[] = [];
  const totalTasks = blocks.length * batchSize;
  const scheduled = new Set<string>();

  const taskKey = (jobIndex: number, blockId: string) => `${jobIndex}:${blockId}`;

  while (scheduled.size < totalTasks) {
    let chosen: {
      jobIndex: number;
      block: GraphProcessBlock;
      ready: number;
      duration: number;
      requirements: ProcessResourceRequirement[];
      allocation: CandidateAllocation;
    } | null = null;

    for (let jobIndex = 0; jobIndex < batchSize; jobIndex += 1) {
      const release = jobIndex * releaseIntervalSeconds;
      for (const blockId of topology.order) {
        const key = taskKey(jobIndex, blockId);
        if (scheduled.has(key)) continue;
        const block = blockById.get(blockId)!;
        const dependencyKeys = block.dependencies
          .filter(dep => blockById.has(dep) && dep !== block.id)
          .map(dep => taskKey(jobIndex, dep));
        if (!dependencyKeys.every(depKey => scheduledFinish.has(depKey))) continue;

        const dependencyFinish = dependencyKeys.length
          ? Math.max(...dependencyKeys.map(depKey => scheduledFinish.get(depKey)!))
          : 0;
        const ready = Math.max(release, dependencyFinish);
        const duration = graphAnalysis.results[blockId].seconds!;
        const requirements = (requirementsByBlock[blockId] || []).map(requirement => ({
          resourceId: requirement.resourceId,
          units: Math.max(1, Math.floor(requirement.units)),
        }));
        const allocation = findEarliestAllocation(calendars, requirements, ready, duration);
        if (!allocation) {
          errors.push(`Не удалось выделить ресурсы для «${block.title}»`);
          continue;
        }

        if (
          !chosen ||
          allocation.start < chosen.allocation.start ||
          (allocation.start === chosen.allocation.start && ready < chosen.ready) ||
          (allocation.start === chosen.allocation.start && ready === chosen.ready && jobIndex < chosen.jobIndex) ||
          (allocation.start === chosen.allocation.start && ready === chosen.ready && jobIndex === chosen.jobIndex && (topoRank.get(block.id) ?? 0) < (topoRank.get(chosen.block.id) ?? 0))
        ) {
          chosen = { jobIndex, block, ready, duration, requirements, allocation };
        }
      }
    }

    if (!chosen) {
      errors.push('Планировщик не нашёл доступную задачу; проверьте зависимости и ресурсы');
      break;
    }

    const key = taskKey(chosen.jobIndex, chosen.block.id);
    reserve(calendars, chosen.allocation, chosen.requirements, chosen.duration, key);
    const finish = chosen.allocation.start + chosen.duration;
    scheduled.add(key);
    scheduledFinish.set(key, finish);
    runs.push({
      taskId: key,
      jobIndex: chosen.jobIndex,
      blockId: chosen.block.id,
      blockTitle: chosen.block.title,
      readySeconds: chosen.ready,
      startSeconds: chosen.allocation.start,
      finishSeconds: finish,
      durationSeconds: chosen.duration,
      waitSeconds: chosen.allocation.start - chosen.ready,
      requirements: chosen.requirements,
    });
  }

  if (errors.length || scheduled.size !== totalTasks) {
    return { ok: false, runs, jobs: [], resourceStats: [], blockStats: [], stats: emptyStats(), warnings, errors };
  }

  const jobs: ProcessJobStats[] = [];
  for (let jobIndex = 0; jobIndex < batchSize; jobIndex += 1) {
    const jobRuns = runs.filter(run => run.jobIndex === jobIndex);
    const release = jobIndex * releaseIntervalSeconds;
    const completion = jobRuns.length ? Math.max(...jobRuns.map(run => run.finishSeconds)) : release;
    jobs.push({
      jobIndex,
      releaseSeconds: release,
      completionSeconds: completion,
      cycleSeconds: completion - release,
      waitSeconds: jobRuns.reduce((sum, run) => sum + run.waitSeconds, 0),
    });
  }

  const makespanSeconds = jobs.length ? Math.max(...jobs.map(job => job.completionSeconds)) : 0;
  const completionTimes = jobs.map(job => job.completionSeconds).sort((a, b) => a - b);
  const firstCompletionSeconds = completionTimes[0] ?? null;
  const lastCompletionSeconds = completionTimes.at(-1) ?? null;
  const totalWaitSeconds = runs.reduce((sum, run) => sum + run.waitSeconds, 0);
  const averageWaitSeconds = runs.length ? totalWaitSeconds / runs.length : 0;
  const averageCycleSeconds = jobs.length ? jobs.reduce((sum, job) => sum + job.cycleSeconds, 0) / jobs.length : 0;
  const p95CycleSeconds = percentile(jobs.map(job => job.cycleSeconds), 0.95);
  const throughputPerHour = makespanSeconds > 0 ? batchSize / (makespanSeconds / 3600) : null;
  const outputRatePerHour = batchSize > 1 && firstCompletionSeconds != null && lastCompletionSeconds != null && lastCompletionSeconds > firstCompletionSeconds
    ? (batchSize - 1) / ((lastCompletionSeconds - firstCompletionSeconds) / 3600)
    : null;

  const resourceStats: ProcessResourceStats[] = resources.map(resource => {
    const calendar = calendars.get(resource.id)!;
    const busyUnitSeconds = calendar.lanes.flat().reduce((sum, interval) => sum + interval.finish - interval.start, 0);
    return {
      id: resource.id,
      name: resource.name,
      capacity: resource.capacity,
      busyUnitSeconds,
      utilizationPercent: makespanSeconds > 0 ? (busyUnitSeconds / (resource.capacity * makespanSeconds)) * 100 : 0,
      peakUnits: calculatePeakUnits(calendar),
    };
  }).sort((a, b) => b.utilizationPercent - a.utilizationPercent);

  const blockStats: ProcessBlockSimulationStats[] = blocks.map(block => {
    const blockRuns = runs.filter(run => run.blockId === block.id);
    const totalWait = blockRuns.reduce((sum, run) => sum + run.waitSeconds, 0);
    return {
      blockId: block.id,
      blockTitle: block.title,
      runs: blockRuns.length,
      averageWaitSeconds: blockRuns.length ? totalWait / blockRuns.length : 0,
      maxWaitSeconds: blockRuns.length ? Math.max(...blockRuns.map(run => run.waitSeconds)) : 0,
      totalWaitSeconds: totalWait,
    };
  }).sort((a, b) => b.totalWaitSeconds - a.totalWaitSeconds);

  const bottleneck = resourceStats[0];
  if (!resources.length) warnings.push('Ресурсы не заданы: результат эквивалентен неограниченному параллелизму по оборудованию');
  if (!Object.values(requirementsByBlock).some(requirements => requirements?.length)) {
    warnings.push('Ни один блок не требует ресурс: очереди оборудования не моделируются');
  }

  return {
    ok: true,
    runs,
    jobs,
    resourceStats,
    blockStats,
    stats: {
      makespanSeconds,
      completedJobs: jobs.length,
      totalTaskRuns: runs.length,
      firstCompletionSeconds,
      lastCompletionSeconds,
      averageCycleSeconds,
      p95CycleSeconds,
      averageWaitSeconds,
      totalWaitSeconds,
      throughputPerHour,
      outputRatePerHour,
      resourceBottleneckId: bottleneck?.id,
      resourceBottleneckName: bottleneck?.name,
      resourceBottleneckUtilizationPercent: bottleneck?.utilizationPercent ?? 0,
    },
    warnings,
    errors,
  };
}
