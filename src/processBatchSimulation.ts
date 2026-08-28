import { GraphProcessBlock, analyzeGraphProcess } from './processGraphMath';
import {
  ProcessResource,
  ProcessResourceRequirement,
  ProcessSimulationOptions,
} from './processSimulation';

export interface ProcessBatchConfig {
  blockId: string;
  batchCapacity: number;
  minBatchSize: number;
  maxWaitSeconds: number;
}

export interface ProcessBatchSimulationOptions extends ProcessSimulationOptions {
  batchConfigs?: ProcessBatchConfig[];
}

export interface BatchTaskRun {
  taskId: string;
  jobIndex: number;
  blockId: string;
  blockTitle: string;
  readySeconds: number;
  startSeconds: number;
  finishSeconds: number;
  durationSeconds: number;
  waitSeconds: number;
  batchId?: string;
  batchSize?: number;
}

export interface BatchCycleRun {
  batchId: string;
  blockId: string;
  blockTitle: string;
  startSeconds: number;
  finishSeconds: number;
  durationSeconds: number;
  jobIndexes: number[];
  batchCapacity: number;
  fillPercent: number;
  averageReadyWaitSeconds: number;
}

export interface BatchResourceStats {
  id: string;
  name: string;
  capacity: number;
  busyUnitSeconds: number;
  utilizationPercent: number;
  peakUnits: number;
}

export interface BatchBlockStats {
  blockId: string;
  blockTitle: string;
  cycles: number;
  processedJobs: number;
  averageBatchSize: number;
  averageFillPercent: number;
  partialCycles: number;
  averageWaitSeconds: number;
  maxWaitSeconds: number;
}

export interface BatchJobStats {
  jobIndex: number;
  releaseSeconds: number;
  completionSeconds: number;
  cycleSeconds: number;
  waitSeconds: number;
}

export interface BatchSimulationStats {
  makespanSeconds: number;
  completedJobs: number;
  totalTaskRuns: number;
  batchCycles: number;
  averageBatchFillPercent: number;
  partialBatchCycles: number;
  averageCycleSeconds: number;
  p95CycleSeconds: number;
  totalWaitSeconds: number;
  averageWaitSeconds: number;
  throughputPerHour: number | null;
  outputRatePerHour: number | null;
  resourceBottleneckId?: string;
  resourceBottleneckName?: string;
  resourceBottleneckUtilizationPercent: number;
}

export interface ProcessBatchSimulationResult {
  ok: boolean;
  runs: BatchTaskRun[];
  batchCycles: BatchCycleRun[];
  jobs: BatchJobStats[];
  resourceStats: BatchResourceStats[];
  batchBlockStats: BatchBlockStats[];
  stats: BatchSimulationStats;
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

interface ReadyTask {
  jobIndex: number;
  block: GraphProcessBlock;
  ready: number;
  duration: number;
  requirements: ProcessResourceRequirement[];
  allocation: Allocation;
}

interface ReadyBatch {
  block: GraphProcessBlock;
  jobs: Array<{ jobIndex: number; ready: number }>;
  duration: number;
  requirements: ProcessResourceRequirement[];
  config: ProcessBatchConfig;
  allocation: Allocation;
}

function emptyStats(): BatchSimulationStats {
  return {
    makespanSeconds: 0,
    completedJobs: 0,
    totalTaskRuns: 0,
    batchCycles: 0,
    averageBatchFillPercent: 0,
    partialBatchCycles: 0,
    averageCycleSeconds: 0,
    p95CycleSeconds: 0,
    totalWaitSeconds: 0,
    averageWaitSeconds: 0,
    throughputPerHour: null,
    outputRatePerHour: null,
    resourceBottleneckUtilizationPercent: 0,
  };
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

function overlaps(start: number, finish: number, reservation: Reservation): boolean {
  return start < reservation.finish && finish > reservation.start;
}

function freeLanes(calendar: ResourceCalendar, start: number, duration: number): number[] {
  const finish = start + duration;
  const indexes: number[] = [];
  calendar.lanes.forEach((lane, index) => {
    if (!lane.some(reservation => overlaps(start, finish, reservation))) indexes.push(index);
  });
  return indexes;
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
    const lanesByResource: Record<string, number[]> = {};
    let feasible = true;
    for (const requirement of requirements) {
      const available = freeLanes(calendars.get(requirement.resourceId)!, start, duration);
      if (available.length < requirement.units) {
        feasible = false;
        break;
      }
      lanesByResource[requirement.resourceId] = available.slice(0, requirement.units);
    }
    if (feasible) return { start, laneIndexesByResource: lanesByResource };
  }
  let start = ready;
  for (const requirement of requirements) {
    const calendar = calendars.get(requirement.resourceId)!;
    for (const lane of calendar.lanes) for (const reservation of lane) start = Math.max(start, reservation.finish);
  }
  const lanesByResource: Record<string, number[]> = {};
  for (const requirement of requirements) {
    const available = freeLanes(calendars.get(requirement.resourceId)!, start, duration);
    if (available.length < requirement.units) return null;
    lanesByResource[requirement.resourceId] = available.slice(0, requirement.units);
  }
  return { start, laneIndexesByResource: lanesByResource };
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

function normalizeRequirements(
  requirements: ProcessResourceRequirement[] | undefined,
): ProcessResourceRequirement[] {
  const merged = new Map<string, number>();
  for (const requirement of requirements || []) {
    merged.set(requirement.resourceId, Math.max(merged.get(requirement.resourceId) || 0, Math.max(1, Math.floor(Number(requirement.units) || 1))));
  }
  return Array.from(merged, ([resourceId, units]) => ({ resourceId, units }));
}

function chooseBatchGroup(
  candidates: Array<{ jobIndex: number; ready: number }>,
  config: ProcessBatchConfig,
): { jobs: Array<{ jobIndex: number; ready: number }>; policyReady: number } | null {
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => a.ready - b.ready || a.jobIndex - b.jobIndex);
  const capacity = Math.max(1, Math.floor(config.batchCapacity));
  const minBatch = Math.min(capacity, Math.max(1, Math.floor(config.minBatchSize)));
  const deadline = sorted[0].ready + Math.max(0, config.maxWaitSeconds);
  const minBatchReady = sorted.length >= minBatch ? sorted[minBatch - 1].ready : Number.POSITIVE_INFINITY;
  const policyReady = Math.min(minBatchReady, deadline);
  const eligible = sorted.filter(item => item.ready <= policyReady).slice(0, capacity);
  if (!eligible.length) return null;
  return { jobs: eligible, policyReady };
}

export function simulateBatchCycleProcess(
  blocks: GraphProcessBlock[],
  options: ProcessBatchSimulationOptions,
): ProcessBatchSimulationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const batchSize = Math.max(1, Math.floor(Number(options.batchSize) || 1));
  const releaseInterval = Math.max(0, Number(options.releaseIntervalSeconds) || 0);
  const resources = options.resources.map(resource => ({
    ...resource,
    capacity: Math.max(1, Math.floor(Number(resource.capacity) || 1)),
  }));
  const resourceById = new Map(resources.map(resource => [resource.id, resource]));
  const batchConfigByBlock = new Map<string, ProcessBatchConfig>();
  for (const raw of options.batchConfigs || []) {
    if (!blocks.some(block => block.id === raw.blockId)) {
      warnings.push(`Batch-конфигурация ссылается на отсутствующий блок ${raw.blockId}`);
      continue;
    }
    const capacity = Math.max(1, Math.floor(Number(raw.batchCapacity) || 1));
    batchConfigByBlock.set(raw.blockId, {
      blockId: raw.blockId,
      batchCapacity: capacity,
      minBatchSize: Math.min(capacity, Math.max(1, Math.floor(Number(raw.minBatchSize) || 1))),
      maxWaitSeconds: Math.max(0, Number(raw.maxWaitSeconds) || 0),
    });
  }

  const graph = analyzeGraphProcess(blocks, { batchSize: 1 });
  if (graph.stats.hasCycle) errors.push(`Batch simulation невозможна: цикл DAG (${graph.stats.cycleBlockIds.join(', ')})`);
  for (const block of blocks) {
    const result = graph.results[block.id];
    if (!result || result.seconds == null) errors.push(`Блок «${block.title}»: время не разрешено${result?.error ? ` — ${result.error}` : ''}`);
    for (const requirement of normalizeRequirements(options.requirementsByBlock?.[block.id])) {
      const resource = resourceById.get(requirement.resourceId);
      if (!resource) errors.push(`Блок «${block.title}»: ресурс ${requirement.resourceId} не найден`);
      else if (requirement.units > resource.capacity) errors.push(`Блок «${block.title}»: требуется ${requirement.units} × «${resource.name}», доступно ${resource.capacity}`);
    }
  }
  const topology = topologicalOrder(blocks);
  if (topology.cycleIds.length) errors.push(`Топологическая сортировка не завершена: ${topology.cycleIds.join(', ')}`);
  if (errors.length) return { ok: false, runs: [], batchCycles: [], jobs: [], resourceStats: [], batchBlockStats: [], stats: emptyStats(), warnings, errors };

  const blockById = new Map(blocks.map(block => [block.id, block]));
  const rank = new Map(topology.order.map((id, index) => [id, index]));
  const calendars = new Map<string, ResourceCalendar>();
  for (const resource of resources) calendars.set(resource.id, { resource, lanes: Array.from({ length: resource.capacity }, () => []) });

  const taskKey = (jobIndex: number, blockId: string) => `${jobIndex}:${blockId}`;
  const scheduled = new Set<string>();
  const finishByTask = new Map<string, number>();
  const runs: BatchTaskRun[] = [];
  const batchCycles: BatchCycleRun[] = [];
  const totalTasks = blocks.length * batchSize;
  let batchSequence = 0;

  while (scheduled.size < totalTasks) {
    const individualCandidates: ReadyTask[] = [];
    const readyByBatchBlock = new Map<string, Array<{ jobIndex: number; ready: number }>>();

    for (let jobIndex = 0; jobIndex < batchSize; jobIndex += 1) {
      const release = jobIndex * releaseInterval;
      for (const blockId of topology.order) {
        const key = taskKey(jobIndex, blockId);
        if (scheduled.has(key)) continue;
        const block = blockById.get(blockId)!;
        const depKeys = block.dependencies.filter(dep => blockById.has(dep) && dep !== block.id).map(dep => taskKey(jobIndex, dep));
        if (!depKeys.every(dep => finishByTask.has(dep))) continue;
        const ready = Math.max(release, depKeys.length ? Math.max(...depKeys.map(dep => finishByTask.get(dep)!)) : 0);
        const duration = graph.results[blockId].seconds!;
        const requirements = normalizeRequirements(options.requirementsByBlock?.[blockId]);
        if (batchConfigByBlock.has(blockId)) {
          const list = readyByBatchBlock.get(blockId) || [];
          list.push({ jobIndex, ready });
          readyByBatchBlock.set(blockId, list);
        } else {
          const allocation = findAllocation(calendars, requirements, ready, duration);
          if (allocation) individualCandidates.push({ jobIndex, block, ready, duration, requirements, allocation });
        }
      }
    }

    const batchCandidates: ReadyBatch[] = [];
    for (const [blockId, readyJobs] of readyByBatchBlock) {
      const block = blockById.get(blockId)!;
      const config = batchConfigByBlock.get(blockId)!;
      const duration = graph.results[blockId].seconds!;
      const requirements = normalizeRequirements(options.requirementsByBlock?.[blockId]);
      const group = chooseBatchGroup(readyJobs, config);
      if (!group) continue;
      const allocation = findAllocation(calendars, requirements, group.policyReady, duration);
      if (!allocation) continue;
      // If resource contention delays the cycle, include additional already-ready jobs up to capacity.
      const expandedJobs = [...readyJobs]
        .filter(item => item.ready <= allocation.start)
        .sort((a, b) => a.ready - b.ready || a.jobIndex - b.jobIndex)
        .slice(0, config.batchCapacity);
      batchCandidates.push({
        block,
        jobs: expandedJobs.length ? expandedJobs : group.jobs,
        duration,
        requirements,
        config,
        allocation,
      });
    }

    let chosenType: 'single' | 'batch' | null = null;
    let chosenSingle: ReadyTask | null = null;
    let chosenBatch: ReadyBatch | null = null;

    for (const candidate of individualCandidates) {
      if (
        !chosenSingle ||
        candidate.allocation.start < chosenSingle.allocation.start ||
        (candidate.allocation.start === chosenSingle.allocation.start && candidate.ready < chosenSingle.ready) ||
        (candidate.allocation.start === chosenSingle.allocation.start && candidate.ready === chosenSingle.ready && candidate.jobIndex < chosenSingle.jobIndex) ||
        (candidate.allocation.start === chosenSingle.allocation.start && candidate.ready === chosenSingle.ready && candidate.jobIndex === chosenSingle.jobIndex && (rank.get(candidate.block.id) || 0) < (rank.get(chosenSingle.block.id) || 0))
      ) chosenSingle = candidate;
    }
    for (const candidate of batchCandidates) {
      if (
        !chosenBatch ||
        candidate.allocation.start < chosenBatch.allocation.start ||
        (candidate.allocation.start === chosenBatch.allocation.start && candidate.jobs[0].ready < chosenBatch.jobs[0].ready) ||
        (candidate.allocation.start === chosenBatch.allocation.start && candidate.jobs[0].ready === chosenBatch.jobs[0].ready && (rank.get(candidate.block.id) || 0) < (rank.get(chosenBatch.block.id) || 0))
      ) chosenBatch = candidate;
    }

    if (chosenSingle && chosenBatch) chosenType = chosenSingle.allocation.start <= chosenBatch.allocation.start ? 'single' : 'batch';
    else if (chosenSingle) chosenType = 'single';
    else if (chosenBatch) chosenType = 'batch';

    if (!chosenType) {
      errors.push('Batch scheduler не нашёл доступную операцию; проверьте зависимости, времена и ресурсы');
      break;
    }

    if (chosenType === 'single' && chosenSingle) {
      const key = taskKey(chosenSingle.jobIndex, chosenSingle.block.id);
      reserve(calendars, chosenSingle.allocation, chosenSingle.requirements, chosenSingle.duration, key);
      const finish = chosenSingle.allocation.start + chosenSingle.duration;
      scheduled.add(key);
      finishByTask.set(key, finish);
      runs.push({
        taskId: key,
        jobIndex: chosenSingle.jobIndex,
        blockId: chosenSingle.block.id,
        blockTitle: chosenSingle.block.title,
        readySeconds: chosenSingle.ready,
        startSeconds: chosenSingle.allocation.start,
        finishSeconds: finish,
        durationSeconds: chosenSingle.duration,
        waitSeconds: chosenSingle.allocation.start - chosenSingle.ready,
      });
    } else if (chosenBatch) {
      const batchId = `batch_${++batchSequence}_${chosenBatch.block.id}`;
      reserve(calendars, chosenBatch.allocation, chosenBatch.requirements, chosenBatch.duration, batchId);
      const finish = chosenBatch.allocation.start + chosenBatch.duration;
      const uniqueJobs = chosenBatch.jobs.filter(item => !scheduled.has(taskKey(item.jobIndex, chosenBatch!.block.id)));
      for (const item of uniqueJobs) {
        const key = taskKey(item.jobIndex, chosenBatch.block.id);
        scheduled.add(key);
        finishByTask.set(key, finish);
        runs.push({
          taskId: key,
          jobIndex: item.jobIndex,
          blockId: chosenBatch.block.id,
          blockTitle: chosenBatch.block.title,
          readySeconds: item.ready,
          startSeconds: chosenBatch.allocation.start,
          finishSeconds: finish,
          durationSeconds: chosenBatch.duration,
          waitSeconds: chosenBatch.allocation.start - item.ready,
          batchId,
          batchSize: uniqueJobs.length,
        });
      }
      const averageWait = uniqueJobs.length
        ? uniqueJobs.reduce((sum, item) => sum + chosenBatch!.allocation.start - item.ready, 0) / uniqueJobs.length
        : 0;
      batchCycles.push({
        batchId,
        blockId: chosenBatch.block.id,
        blockTitle: chosenBatch.block.title,
        startSeconds: chosenBatch.allocation.start,
        finishSeconds: finish,
        durationSeconds: chosenBatch.duration,
        jobIndexes: uniqueJobs.map(item => item.jobIndex),
        batchCapacity: chosenBatch.config.batchCapacity,
        fillPercent: chosenBatch.config.batchCapacity > 0 ? (uniqueJobs.length / chosenBatch.config.batchCapacity) * 100 : 0,
        averageReadyWaitSeconds: averageWait,
      });
    }
  }

  if (errors.length || scheduled.size !== totalTasks) {
    return { ok: false, runs, batchCycles, jobs: [], resourceStats: [], batchBlockStats: [], stats: emptyStats(), warnings, errors };
  }

  const jobs: BatchJobStats[] = [];
  for (let jobIndex = 0; jobIndex < batchSize; jobIndex += 1) {
    const jobRuns = runs.filter(run => run.jobIndex === jobIndex);
    const release = jobIndex * releaseInterval;
    const completion = jobRuns.length ? Math.max(...jobRuns.map(run => run.finishSeconds)) : release;
    jobs.push({
      jobIndex,
      releaseSeconds: release,
      completionSeconds: completion,
      cycleSeconds: completion - release,
      waitSeconds: jobRuns.reduce((sum, run) => sum + run.waitSeconds, 0),
    });
  }

  const makespan = jobs.length ? Math.max(...jobs.map(job => job.completionSeconds)) : 0;
  const completionTimes = jobs.map(job => job.completionSeconds).sort((a, b) => a - b);
  const firstCompletion = completionTimes[0] ?? null;
  const lastCompletion = completionTimes.at(-1) ?? null;
  const totalWait = runs.reduce((sum, run) => sum + run.waitSeconds, 0);
  const averageWait = runs.length ? totalWait / runs.length : 0;
  const averageCycle = jobs.length ? jobs.reduce((sum, job) => sum + job.cycleSeconds, 0) / jobs.length : 0;
  const throughput = makespan > 0 ? batchSize / (makespan / 3600) : null;
  const outputRate = batchSize > 1 && firstCompletion != null && lastCompletion != null && lastCompletion > firstCompletion
    ? (batchSize - 1) / ((lastCompletion - firstCompletion) / 3600)
    : null;

  const resourceStats: BatchResourceStats[] = resources.map(resource => {
    const calendar = calendars.get(resource.id)!;
    const busy = calendar.lanes.flat().reduce((sum, reservation) => sum + reservation.finish - reservation.start, 0);
    return {
      id: resource.id,
      name: resource.name,
      capacity: resource.capacity,
      busyUnitSeconds: busy,
      utilizationPercent: makespan > 0 ? (busy / (resource.capacity * makespan)) * 100 : 0,
      peakUnits: peakUnits(calendar),
    };
  }).sort((a, b) => b.utilizationPercent - a.utilizationPercent);

  const batchBlockStats: BatchBlockStats[] = Array.from(batchConfigByBlock.keys()).map(blockId => {
    const block = blockById.get(blockId)!;
    const config = batchConfigByBlock.get(blockId)!;
    const cycles = batchCycles.filter(cycle => cycle.blockId === blockId);
    const blockRuns = runs.filter(run => run.blockId === blockId);
    return {
      blockId,
      blockTitle: block.title,
      cycles: cycles.length,
      processedJobs: blockRuns.length,
      averageBatchSize: cycles.length ? cycles.reduce((sum, cycle) => sum + cycle.jobIndexes.length, 0) / cycles.length : 0,
      averageFillPercent: cycles.length ? cycles.reduce((sum, cycle) => sum + cycle.fillPercent, 0) / cycles.length : 0,
      partialCycles: cycles.filter(cycle => cycle.jobIndexes.length < config.batchCapacity).length,
      averageWaitSeconds: blockRuns.length ? blockRuns.reduce((sum, run) => sum + run.waitSeconds, 0) / blockRuns.length : 0,
      maxWaitSeconds: blockRuns.length ? Math.max(...blockRuns.map(run => run.waitSeconds)) : 0,
    };
  });

  const averageFill = batchCycles.length ? batchCycles.reduce((sum, cycle) => sum + cycle.fillPercent, 0) / batchCycles.length : 0;
  const bottleneck = resourceStats[0];
  if (!batchCycles.length && batchConfigByBlock.size) warnings.push('Batch-конфигурации заданы, но batch cycles не сформированы');
  if (!batchConfigByBlock.size) warnings.push('Batch-операции не заданы: модель эквивалентна обычной ресурсной симуляции');

  return {
    ok: true,
    runs,
    batchCycles,
    jobs,
    resourceStats,
    batchBlockStats,
    stats: {
      makespanSeconds: makespan,
      completedJobs: jobs.length,
      totalTaskRuns: runs.length,
      batchCycles: batchCycles.length,
      averageBatchFillPercent: averageFill,
      partialBatchCycles: batchCycles.filter(cycle => cycle.fillPercent < 99.999).length,
      averageCycleSeconds: averageCycle,
      p95CycleSeconds: percentile(jobs.map(job => job.cycleSeconds), 0.95),
      totalWaitSeconds: totalWait,
      averageWaitSeconds: averageWait,
      throughputPerHour: throughput,
      outputRatePerHour: outputRate,
      resourceBottleneckId: bottleneck?.id,
      resourceBottleneckName: bottleneck?.name,
      resourceBottleneckUtilizationPercent: bottleneck?.utilizationPercent ?? 0,
    },
    warnings,
    errors,
  };
}
