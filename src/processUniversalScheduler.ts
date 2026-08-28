import { analyzeGraphProcess, GraphProcessBlock } from './processGraphMath';
import {
  ProcessChangeoverPolicy,
  ProcessJobDescriptor,
  ProcessScenarioProfile,
  validateProcessScenario,
} from './processDomain';
import {
  changeoverSeconds,
  isJobCompatibleWithBatch,
  setupStateForJob,
} from './processCompatibility';
import { ProcessResource, ProcessResourceRequirement } from './processSimulation';
import {
  ProcessResourceCalendarPolicy,
  availableSecondsWithin,
  nextResourceAvailableStart,
} from './processResourceCalendar';
import { generateFailureWindows } from './processReliability';
import {
  UnifiedTwinBatchCycle,
  UnifiedTwinBlockStats,
  UnifiedTwinJobStats,
  UnifiedTwinResourceStats,
  UnifiedTwinResult,
  UnifiedTwinStats,
  UnifiedTwinTaskRun,
} from './processUnifiedTwin';
import { ProcessBatchConfig } from './processBatchSimulation';
import { ProcessBlockUncertainty } from './processRisk';
import { DigitalTwinReworkPolicy } from './processDigitalTwin';

export interface UniversalChangeoverResourceStats {
  resourceId: string;
  resourceName: string;
  count: number;
  seconds: number;
}

export interface UniversalPolicyStats {
  totalChangeoverSeconds: number;
  changeoverCount: number;
  byResource: UniversalChangeoverResourceStats[];
  compatibilityPoliciesApplied: number;
  changeoverPoliciesApplied: number;
}

export interface UniversalPolicyTwinResult extends UnifiedTwinResult {
  policyStats: UniversalPolicyStats;
}

interface LaneReservation {
  start: number;
  finish: number;
  taskId: string;
  kind: 'setup+run' | 'run';
}

interface ResourceLane {
  availableSeconds: number;
  states: Record<string, string>;
  reservations: LaneReservation[];
  busySeconds: number;
}

interface ResourceState {
  resource: ProcessResource;
  calendar?: ProcessResourceCalendarPolicy;
  lanes: ResourceLane[];
}

interface LanePlan {
  laneIndex: number;
  setupSeconds: number;
  setupStates: Record<string, string>;
  segmentStart: number;
}

interface ResourcePlan {
  resourceId: string;
  lanes: LanePlan[];
}

interface AllocationPlan {
  operationStart: number;
  resourcePlans: ResourcePlan[];
  setupUnitSeconds: number;
  setupCount: number;
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
  allocation: AllocationPlan;
}

interface BatchCandidate {
  kind: 'batch';
  block: GraphProcessBlock;
  members: ReadyMember[];
  config: ProcessBatchConfig;
  duration: number;
  requirements: ProcessResourceRequirement[];
  allocation: AllocationPlan;
  policyReady: number;
  priority: number;
  sequence: number;
}

type Candidate = IndividualCandidate | BatchCandidate;

interface ChangeoverAccumulator {
  totalSeconds: number;
  count: number;
  byResource: Map<string, { seconds: number; count: number }>;
}

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

function emptyPolicyStats(): UniversalPolicyStats {
  return {
    totalChangeoverSeconds: 0,
    changeoverCount: 0,
    byResource: [],
    compatibilityPoliciesApplied: 0,
    changeoverPoliciesApplied: 0,
  };
}

function errorResult(errors: string[], warnings: string[] = []): UniversalPolicyTwinResult {
  return {
    ok: false,
    runs: [],
    batchCycles: [],
    jobs: [],
    resourceStats: [],
    blockStats: [],
    stats: emptyStats(),
    warnings,
    errors,
    policyStats: emptyPolicyStats(),
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

function sampleFactor(seed: number, key: string, uncertainty: ProcessBlockUncertainty | undefined): number {
  if (!uncertainty || uncertainty.kind === 'fixed') return 1;
  const min = Math.max(0, Number.isFinite(uncertainty.minFactor) ? Number(uncertainty.minFactor) : 0.9);
  const max = Math.max(min, Number.isFinite(uncertainty.maxFactor) ? Number(uncertainty.maxFactor) : 1.1);
  const u = keyedUnit(seed, key);
  if (uncertainty.kind === 'uniform') return min + u * (max - min);
  const mode = Math.min(max, Math.max(min, Number.isFinite(uncertainty.modeFactor) ? Number(uncertainty.modeFactor) : 1));
  if (max === min) return min;
  const split = (mode - min) / (max - min);
  if (u <= split) return min + Math.sqrt(u * (max - min) * (mode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function normalizeRequirements(requirements: ProcessResourceRequirement[] | undefined): ProcessResourceRequirement[] {
  const merged = new Map<string, number>();
  for (const requirement of requirements || []) {
    const units = Math.max(1, Math.floor(Number(requirement.units) || 1));
    merged.set(requirement.resourceId, Math.max(merged.get(requirement.resourceId) || 0, units));
  }
  return Array.from(merged, ([resourceId, units]) => ({ resourceId, units }));
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

function topologicalOrder(blocks: GraphProcessBlock[]): { order: string[]; cycleIds: string[] } {
  const ids = new Set(blocks.map(block => block.id));
  const indegree: Record<string, number> = Object.fromEntries(blocks.map(block => [block.id, 0]));
  const children: Record<string, string[]> = Object.fromEntries(blocks.map(block => [block.id, []]));
  for (const block of blocks) {
    const dependencies = Array.from(new Set(block.dependencies.filter(dep => ids.has(dep) && dep !== block.id)));
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
  return { order, cycleIds: blocks.filter(block => !order.includes(block.id)).map(block => block.id) };
}

function buildReleaseTimes(jobs: number, seed: number, profile: ProcessScenarioProfile): number[] {
  const releases = [0];
  const arrival = profile.arrivals || { kind: 'fixed' as const, intervalSeconds: 0 };
  const random = mulberry32(mixSeed(seed, 0xA771A1));
  for (let index = 1; index < jobs; index += 1) {
    if (arrival.kind === 'poisson') {
      const mean = Math.max(0.001, Number(arrival.meanIntervalSeconds) || 1);
      releases.push(releases[index - 1] + exponential(random, mean));
    } else {
      releases.push(releases[index - 1] + Math.max(0, Number(arrival.intervalSeconds) || 0));
    }
  }
  return releases;
}

function mergeCalendarsWithFailures(
  profile: ProcessScenarioProfile,
  horizon: number,
  seed: number,
): { calendars: Record<string, ProcessResourceCalendarPolicy>; failureCounts: Record<string, number>; warnings: string[] } {
  const resourceIds = new Set(profile.resources.map(resource => resource.id));
  const calendars: Record<string, ProcessResourceCalendarPolicy> = {};
  const failureCounts: Record<string, number> = {};
  const warnings: string[] = [];

  for (const resource of profile.resources) {
    const source = profile.calendars?.[resource.id];
    if (source) {
      calendars[resource.id] = {
        ...source,
        workingWindows: source.workingWindows?.map(window => ({ ...window })),
        plannedDowntime: source.plannedDowntime?.map(window => ({ ...window })),
      };
    }
  }

  for (const failure of profile.failures || []) {
    if (!resourceIds.has(failure.resourceId)) {
      warnings.push(`Failure policy ${failure.resourceId} ignored: resource does not exist`);
      continue;
    }
    const windows = generateFailureWindows(failure, horizon, mixSeed(seed, hashString(failure.resourceId), 0xFA11));
    failureCounts[failure.resourceId] = windows.length;
    const current = calendars[failure.resourceId] || {};
    calendars[failure.resourceId] = {
      ...current,
      workingWindows: current.workingWindows?.map(window => ({ ...window })),
      plannedDowntime: [...(current.plannedDowntime || []).map(window => ({ ...window })), ...windows],
    };
  }

  return { calendars, failureCounts, warnings };
}

function applicableChangeovers(
  policies: ProcessChangeoverPolicy[] | undefined,
  resourceId: string,
  blockId: string,
): ProcessChangeoverPolicy[] {
  return (policies || []).filter(policy =>
    (!policy.resourceId || policy.resourceId === resourceId) &&
    (!policy.blockId || policy.blockId === blockId));
}

function setupStateForJobs(jobs: ProcessJobDescriptor[], policy: ProcessChangeoverPolicy): string {
  const states = Array.from(new Set(jobs.map(job => setupStateForJob(job, policy)))).sort();
  return states.length === 1 ? states[0] : `batch{${states.join('||')}}`;
}

function laneSetup(
  lane: ResourceLane,
  policies: ProcessChangeoverPolicy[],
  jobs: ProcessJobDescriptor[],
): { seconds: number; states: Record<string, string>; count: number } {
  let seconds = 0;
  let count = 0;
  const states: Record<string, string> = {};
  for (const policy of policies) {
    const nextState = setupStateForJobs(jobs, policy);
    const previousState = lane.states[policy.id] ?? policy.initialState ?? null;
    const cost = changeoverSeconds(previousState, nextState, policy);
    states[policy.id] = nextState;
    seconds += cost;
    if (cost > 0) count += 1;
  }
  return { seconds, states, count };
}

function earliestLanePlan(
  lane: ResourceLane,
  laneIndex: number,
  calendar: ProcessResourceCalendarPolicy | undefined,
  ready: number,
  minimumOperationStart: number,
  operationDuration: number,
  setup: { seconds: number; states: Record<string, string>; count: number },
): { lanePlan: LanePlan; operationStart: number } | null {
  const segmentDuration = setup.seconds + operationDuration;
  const earliestSegment = Math.max(lane.availableSeconds, ready, minimumOperationStart - setup.seconds);
  const segmentStart = nextResourceAvailableStart(calendar, earliestSegment, segmentDuration).startSeconds;
  if (!Number.isFinite(segmentStart)) return null;
  return {
    lanePlan: {
      laneIndex,
      setupSeconds: setup.seconds,
      setupStates: setup.states,
      segmentStart,
    },
    operationStart: segmentStart + setup.seconds,
  };
}

function findAllocation(
  states: Map<string, ResourceState>,
  changeovers: ProcessChangeoverPolicy[] | undefined,
  requirements: ProcessResourceRequirement[],
  blockId: string,
  jobs: ProcessJobDescriptor[],
  ready: number,
  duration: number,
): AllocationPlan | null {
  if (!requirements.length || duration === 0) {
    return { operationStart: ready, resourcePlans: [], setupUnitSeconds: 0, setupCount: 0 };
  }

  let commonStart = ready;
  for (let guard = 0; guard < 1000; guard += 1) {
    const provisional: ResourcePlan[] = [];
    let nextCommon = commonStart;

    for (const requirement of requirements) {
      const resourceState = states.get(requirement.resourceId);
      if (!resourceState) return null;
      const policies = applicableChangeovers(changeovers, requirement.resourceId, blockId);
      const laneOptions = resourceState.lanes.map((lane, laneIndex) => {
        const setup = laneSetup(lane, policies, jobs);
        return earliestLanePlan(lane, laneIndex, resourceState.calendar, ready, commonStart, duration, setup);
      }).filter((item): item is NonNullable<typeof item> => Boolean(item));
      laneOptions.sort((a, b) => a.operationStart - b.operationStart || a.lanePlan.setupSeconds - b.lanePlan.setupSeconds || a.lanePlan.laneIndex - b.lanePlan.laneIndex);
      if (laneOptions.length < requirement.units) return null;
      const selected = laneOptions.slice(0, requirement.units);
      provisional.push({ resourceId: requirement.resourceId, lanes: selected.map(item => item.lanePlan) });
      nextCommon = Math.max(nextCommon, ...selected.map(item => item.operationStart));
    }

    // Verify every selected lane can align exactly to the common operation start.
    let aligned = true;
    const alignedPlans: ResourcePlan[] = [];
    let adjustedCommon = nextCommon;
    for (const resourcePlan of provisional) {
      const resourceState = states.get(resourcePlan.resourceId)!;
      const policies = applicableChangeovers(changeovers, resourcePlan.resourceId, blockId);
      const lanes: LanePlan[] = [];
      for (const plan of resourcePlan.lanes) {
        const lane = resourceState.lanes[plan.laneIndex];
        const setup = laneSetup(lane, policies, jobs);
        const desiredSegment = nextCommon - setup.seconds;
        const segmentDuration = setup.seconds + duration;
        if (desiredSegment < Math.max(lane.availableSeconds, ready)) {
          const next = earliestLanePlan(lane, plan.laneIndex, resourceState.calendar, ready, nextCommon, duration, setup);
          if (!next) return null;
          adjustedCommon = Math.max(adjustedCommon, next.operationStart);
          aligned = false;
          break;
        }
        const actual = nextResourceAvailableStart(resourceState.calendar, desiredSegment, segmentDuration).startSeconds;
        if (actual !== desiredSegment) {
          adjustedCommon = Math.max(adjustedCommon, actual + setup.seconds);
          aligned = false;
          break;
        }
        lanes.push({ laneIndex: plan.laneIndex, setupSeconds: setup.seconds, setupStates: setup.states, segmentStart: desiredSegment });
      }
      if (!aligned) break;
      alignedPlans.push({ resourceId: resourcePlan.resourceId, lanes });
    }

    if (!aligned || adjustedCommon !== nextCommon) {
      commonStart = Math.max(commonStart, adjustedCommon);
      continue;
    }

    const setupUnitSeconds = alignedPlans.reduce((sum, resourcePlan) => sum + resourcePlan.lanes.reduce((laneSum, lane) => laneSum + lane.setupSeconds, 0), 0);
    const setupCount = alignedPlans.reduce((sum, resourcePlan) => sum + resourcePlan.lanes.filter(lane => lane.setupSeconds > 0).length, 0);
    return { operationStart: nextCommon, resourcePlans: alignedPlans, setupUnitSeconds, setupCount };
  }
  return null;
}

function reserveAllocation(
  states: Map<string, ResourceState>,
  allocation: AllocationPlan,
  duration: number,
  taskId: string,
  accumulator: ChangeoverAccumulator,
): void {
  for (const resourcePlan of allocation.resourcePlans) {
    const resourceState = states.get(resourcePlan.resourceId)!;
    for (const plan of resourcePlan.lanes) {
      const lane = resourceState.lanes[plan.laneIndex];
      const finish = allocation.operationStart + duration;
      const segmentStart = allocation.operationStart - plan.setupSeconds;
      lane.reservations.push({ start: segmentStart, finish, taskId, kind: plan.setupSeconds > 0 ? 'setup+run' : 'run' });
      lane.availableSeconds = finish;
      lane.busySeconds += plan.setupSeconds + duration;
      for (const [policyId, state] of Object.entries(plan.setupStates)) lane.states[policyId] = state;
      if (plan.setupSeconds > 0) {
        accumulator.totalSeconds += plan.setupSeconds;
        accumulator.count += 1;
        const current = accumulator.byResource.get(resourcePlan.resourceId) || { seconds: 0, count: 0 };
        current.seconds += plan.setupSeconds;
        current.count += 1;
        accumulator.byResource.set(resourcePlan.resourceId, current);
      }
    }
  }
}

function peakUnits(resource: ResourceState): number {
  const events: Array<{ time: number; delta: number }> = [];
  for (const lane of resource.lanes) {
    for (const reservation of lane.reservations) {
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

function memberOrder(a: ReadyMember, b: ReadyMember, maxWaitSeconds: number): number {
  return (a.ready + maxWaitSeconds) - (b.ready + maxWaitSeconds) || b.priority - a.priority || a.ready - b.ready || a.jobIndex - b.jobIndex;
}

function compatibleOrderedMembers(
  anchor: ReadyMember,
  members: ReadyMember[],
  blockId: string,
  profile: ProcessScenarioProfile,
  maxWaitSeconds: number,
): ReadyMember[] {
  const ordered = [...members].sort((a, b) => memberOrder(a, b, maxWaitSeconds));
  const selected: ReadyMember[] = [];
  const selectedJobs: ProcessJobDescriptor[] = [];
  const anchorKey = `${anchor.jobIndex}:${anchor.attempt}`;
  const withAnchorFirst = [anchor, ...ordered.filter(member => `${member.jobIndex}:${member.attempt}` !== anchorKey)];
  for (const member of withAnchorFirst) {
    const job = profile.jobs[member.jobIndex];
    if (isJobCompatibleWithBatch(job, selectedJobs, blockId, profile.compatibility)) {
      selected.push(member);
      selectedJobs.push(job);
    }
  }
  return selected;
}

function candidateBatchGroup(
  anchor: ReadyMember,
  members: ReadyMember[],
  config: ProcessBatchConfig,
  blockId: string,
  profile: ProcessScenarioProfile,
): { members: ReadyMember[]; policyReady: number } | null {
  const compatible = compatibleOrderedMembers(anchor, members, blockId, profile, config.maxWaitSeconds);
  if (!compatible.length) return null;
  const byReady = [...compatible].sort((a, b) => a.ready - b.ready || b.priority - a.priority || a.jobIndex - b.jobIndex);
  const minBatchReady = byReady.length >= config.minBatchSize ? byReady[config.minBatchSize - 1].ready : Number.POSITIVE_INFINITY;
  const deadline = anchor.ready + config.maxWaitSeconds;
  const policyReady = Math.min(minBatchReady, deadline);
  const eligible = compatible.filter(member => member.ready <= policyReady).sort((a, b) => memberOrder(a, b, config.maxWaitSeconds));
  if (!eligible.length) return null;
  return { members: eligible.slice(0, config.batchCapacity), policyReady };
}

function expandCompatibleBatch(
  initial: ReadyMember[],
  allMembers: ReadyMember[],
  start: number,
  config: ProcessBatchConfig,
  blockId: string,
  profile: ProcessScenarioProfile,
): ReadyMember[] {
  const selected = [...initial];
  const selectedKeys = new Set(selected.map(member => `${member.jobIndex}:${member.attempt}`));
  const selectedJobs = selected.map(member => profile.jobs[member.jobIndex]);
  const candidates = allMembers
    .filter(member => member.ready <= start && !selectedKeys.has(`${member.jobIndex}:${member.attempt}`))
    .sort((a, b) => memberOrder(a, b, config.maxWaitSeconds));
  for (const member of candidates) {
    if (selected.length >= config.batchCapacity) break;
    const job = profile.jobs[member.jobIndex];
    if (!isJobCompatibleWithBatch(job, selectedJobs, blockId, profile.compatibility)) continue;
    selected.push(member);
    selectedJobs.push(job);
  }
  return selected.sort((a, b) => memberOrder(a, b, config.maxWaitSeconds));
}

function batchKey(members: ReadyMember[]): string {
  return members.map(member => `${member.jobIndex}:${member.attempt}`).sort().join('|');
}

function allocateBatch(
  states: Map<string, ResourceState>,
  block: GraphProcessBlock,
  members: ReadyMember[],
  allMembers: ReadyMember[],
  config: ProcessBatchConfig,
  profile: ProcessScenarioProfile,
  requirements: ProcessResourceRequirement[],
  policyReady: number,
  duration: number,
): { members: ReadyMember[]; allocation: AllocationPlan } | null {
  let current = [...members];
  for (let guard = 0; guard < 10; guard += 1) {
    const jobs = current.map(member => profile.jobs[member.jobIndex]);
    const allocation = findAllocation(states, profile.changeovers, requirements, block.id, jobs, policyReady, duration);
    if (!allocation) return null;
    const expanded = expandCompatibleBatch(current, allMembers, allocation.operationStart, config, block.id, profile);
    if (batchKey(expanded) === batchKey(current)) return { members: current, allocation };
    current = expanded;
  }
  const jobs = current.map(member => profile.jobs[member.jobIndex]);
  const allocation = findAllocation(states, profile.changeovers, requirements, block.id, jobs, policyReady, duration);
  return allocation ? { members: current, allocation } : null;
}

function shouldRework(
  seed: number,
  jobIndex: number,
  blockId: string,
  attempt: number,
  policy: DigitalTwinReworkPolicy | undefined,
): boolean {
  if (!policy) return false;
  const maxRepeats = Math.max(0, Math.floor(Number(policy.maxRepeats) || 0));
  if (attempt > maxRepeats) return false;
  const probability = Math.max(0, Math.min(1, Number(policy.probability) || 0));
  return keyedUnit(seed, `rework:${jobIndex}:${blockId}:${attempt}`) < probability;
}

function chooseBetter(candidate: Candidate, chosen: Candidate | null, rank: Map<string, number>): boolean {
  if (!chosen) return true;
  if (candidate.allocation.operationStart !== chosen.allocation.operationStart) return candidate.allocation.operationStart < chosen.allocation.operationStart;
  if (candidate.priority !== chosen.priority) return candidate.priority > chosen.priority;
  const candidateReady = candidate.kind === 'batch' ? candidate.policyReady : candidate.ready;
  const chosenReady = chosen.kind === 'batch' ? chosen.policyReady : chosen.ready;
  if (candidateReady !== chosenReady) return candidateReady < chosenReady;
  return (rank.get(candidate.block.id) ?? 0) < (rank.get(chosen.block.id) ?? 0);
}

export function simulateUniversalPolicyTwin(profile: ProcessScenarioProfile, seedInput?: number): UniversalPolicyTwinResult {
  const validation = validateProcessScenario(profile);
  if (!validation.ok) return errorResult(validation.errors, validation.warnings);

  const warnings = [...validation.warnings];
  const errors: string[] = [];
  const seed = Number.isFinite(seedInput) ? Number(seedInput) : 20260828;
  const jobsCount = profile.jobs.length;
  const resources = profile.resources.map(resource => ({ ...resource, capacity: Math.max(1, Math.floor(Number(resource.capacity) || 1)) }));
  const resourceById = new Map(resources.map(resource => [resource.id, resource]));
  const graph = analyzeGraphProcess(profile.blocks, { batchSize: 1 });
  const baseSeconds: Record<string, number> = {};

  if (graph.stats.hasCycle) errors.push(`Universal scheduler: DAG cycle (${graph.stats.cycleBlockIds.join(', ')})`);
  for (const block of profile.blocks) {
    const result = graph.results[block.id];
    if (!result || result.seconds == null) errors.push(`Operation «${block.title}»: unresolved time${result?.error ? ` — ${result.error}` : ''}`);
    else baseSeconds[block.id] = result.seconds;
    for (const requirement of normalizeRequirements(profile.requirementsByBlock?.[block.id])) {
      const resource = resourceById.get(requirement.resourceId);
      if (!resource) errors.push(`Operation «${block.title}»: resource ${requirement.resourceId} not found`);
      else if (requirement.units > resource.capacity) errors.push(`Operation «${block.title}»: requires ${requirement.units} × ${resource.name}, available ${resource.capacity}`);
    }
  }
  if (errors.length) return errorResult(errors, warnings);

  const topology = topologicalOrder(profile.blocks);
  if (topology.cycleIds.length) return errorResult([`Topological sort failed: ${topology.cycleIds.join(', ')}`], warnings);

  const batchConfigByBlock = new Map<string, ProcessBatchConfig>();
  for (const config of profile.batchPolicies || []) batchConfigByBlock.set(config.blockId, normalizeBatchConfig(config));

  const releases = buildReleaseTimes(jobsCount, seed, profile);
  const priorities = profile.jobs.map(job => Number.isFinite(job.priority) ? Number(job.priority) : 0);
  const serialBase = Object.values(baseSeconds).reduce((sum, seconds) => sum + seconds, 0);
  const horizon = Math.max(86400, (releases.at(-1) || 0) + serialBase * Math.max(2, jobsCount * 2) + 86400);
  const merged = mergeCalendarsWithFailures(profile, horizon, seed);
  warnings.push(...merged.warnings);

  const resourceStates = new Map<string, ResourceState>();
  for (const resource of resources) {
    resourceStates.set(resource.id, {
      resource,
      calendar: merged.calendars[resource.id],
      lanes: Array.from({ length: resource.capacity }, () => ({ availableSeconds: 0, states: {}, reservations: [], busySeconds: 0 })),
    });
  }

  const blockById = new Map(profile.blocks.map(block => [block.id, block]));
  const rank = new Map(topology.order.map((id, index) => [id, index]));
  const completedFinish = new Map<string, number>();
  const attempts = new Map<string, number>();
  const retryReady = new Map<string, number>();
  const runs: UnifiedTwinTaskRun[] = [];
  const batchCycles: UnifiedTwinBatchCycle[] = [];
  const batchSequence = new Map<string, number>();
  const completedTarget = jobsCount * profile.blocks.length;
  const keyOf = (jobIndex: number, blockId: string) => `${jobIndex}:${blockId}`;
  const changeoverAccumulator: ChangeoverAccumulator = { totalSeconds: 0, count: 0, byResource: new Map() };

  while (completedFinish.size < completedTarget) {
    const readyByBatch = new Map<string, ReadyMember[]>();
    let chosen: Candidate | null = null;

    for (let jobIndex = 0; jobIndex < jobsCount; jobIndex += 1) {
      for (const blockId of topology.order) {
        const key = keyOf(jobIndex, blockId);
        if (completedFinish.has(key)) continue;
        const block = blockById.get(blockId)!;
        const attempt = (attempts.get(key) || 0) + 1;
        const retry = retryReady.get(key);
        let ready: number;
        if (retry != null) {
          ready = retry;
        } else {
          const dependencyKeys = block.dependencies.filter(dep => blockById.has(dep) && dep !== block.id).map(dep => keyOf(jobIndex, dep));
          if (!dependencyKeys.every(dep => completedFinish.has(dep))) continue;
          ready = Math.max(releases[jobIndex], dependencyKeys.length ? Math.max(...dependencyKeys.map(dep => completedFinish.get(dep)!)) : 0);
        }

        const batchConfig = batchConfigByBlock.get(blockId);
        if (batchConfig) {
          const list = readyByBatch.get(blockId) || [];
          list.push({ jobIndex, attempt, priority: priorities[jobIndex], ready });
          readyByBatch.set(blockId, list);
          continue;
        }

        const duration = baseSeconds[blockId] * sampleFactor(seed, `duration:${jobIndex}:${blockId}:${attempt}`, profile.uncertaintyByBlock?.[blockId]);
        const requirements = normalizeRequirements(profile.requirementsByBlock?.[blockId]);
        const allocation = findAllocation(resourceStates, profile.changeovers, requirements, blockId, [profile.jobs[jobIndex]], ready, duration);
        if (!allocation) continue;
        const candidate: IndividualCandidate = {
          kind: 'individual', jobIndex, block, attempt, priority: priorities[jobIndex], ready, duration, requirements, allocation,
        };
        if (chooseBetter(candidate, chosen, rank)) chosen = candidate;
      }
    }

    for (const [blockId, members] of readyByBatch) {
      const block = blockById.get(blockId)!;
      const config = batchConfigByBlock.get(blockId)!;
      const sequence = (batchSequence.get(blockId) || 0) + 1;
      const duration = baseSeconds[blockId] * sampleFactor(seed, `batch-duration:${blockId}:${sequence}`, profile.uncertaintyByBlock?.[blockId]);
      const requirements = normalizeRequirements(profile.requirementsByBlock?.[blockId]);
      const seen = new Set<string>();

      for (const anchor of [...members].sort((a, b) => memberOrder(a, b, config.maxWaitSeconds))) {
        const group = candidateBatchGroup(anchor, members, config, blockId, profile);
        if (!group) continue;
        const initialKey = batchKey(group.members);
        if (seen.has(initialKey)) continue;
        seen.add(initialKey);
        const allocated = allocateBatch(resourceStates, block, group.members, members, config, profile, requirements, group.policyReady, duration);
        if (!allocated) continue;
        const candidate: BatchCandidate = {
          kind: 'batch',
          block,
          members: allocated.members,
          config,
          duration,
          requirements,
          allocation: allocated.allocation,
          policyReady: group.policyReady,
          priority: Math.max(...allocated.members.map(member => member.priority)),
          sequence,
        };
        if (chooseBetter(candidate, chosen, rank)) chosen = candidate;
      }
    }

    if (!chosen) {
      errors.push('Universal scheduler found no schedulable task; check dependencies, compatibility, batch policy, resources and calendars');
      break;
    }

    if (chosen.kind === 'individual') {
      const key = keyOf(chosen.jobIndex, chosen.block.id);
      const taskId = `${key}:attempt:${chosen.attempt}`;
      reserveAllocation(resourceStates, chosen.allocation, chosen.duration, taskId, changeoverAccumulator);
      const finish = chosen.allocation.operationStart + chosen.duration;
      attempts.set(key, chosen.attempt);
      const reworkTriggered = shouldRework(seed, chosen.jobIndex, chosen.block.id, chosen.attempt, profile.retryByBlock?.[chosen.block.id]);
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
        startSeconds: chosen.allocation.operationStart,
        finishSeconds: finish,
        durationSeconds: chosen.duration,
        waitSeconds: chosen.allocation.operationStart - chosen.ready,
        reworkTriggered,
        requirements: chosen.requirements,
      });
      continue;
    }

    const batchId = `${chosen.block.id}:batch:${chosen.sequence}`;
    reserveAllocation(resourceStates, chosen.allocation, chosen.duration, batchId, changeoverAccumulator);
    const finish = chosen.allocation.operationStart + chosen.duration;
    batchSequence.set(chosen.block.id, chosen.sequence);

    for (const member of chosen.members) {
      const key = keyOf(member.jobIndex, chosen.block.id);
      attempts.set(key, member.attempt);
      const reworkTriggered = shouldRework(seed, member.jobIndex, chosen.block.id, member.attempt, profile.retryByBlock?.[chosen.block.id]);
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
        startSeconds: chosen.allocation.operationStart,
        finishSeconds: finish,
        durationSeconds: chosen.duration,
        waitSeconds: chosen.allocation.operationStart - member.ready,
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
      startSeconds: chosen.allocation.operationStart,
      finishSeconds: finish,
      durationSeconds: chosen.duration,
      jobIndexes: chosen.members.map(member => member.jobIndex),
      attempts: chosen.members.map(member => member.attempt),
      batchCapacity: chosen.config.batchCapacity,
      fillPercent: (chosen.members.length / chosen.config.batchCapacity) * 100,
      averageReadyWaitSeconds: chosen.members.reduce((sum, member) => sum + chosen.allocation.operationStart - member.ready, 0) / chosen.members.length,
      highestPriority: chosen.priority,
    });
  }

  if (errors.length || completedFinish.size !== completedTarget) {
    return { ...errorResult(errors, warnings), runs, batchCycles };
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
  const totalReworkRuns = runs.filter(run => run.reworkTriggered).length;
  const basePriority = Math.min(...priorities);
  const highPriorityJobs = jobs.filter(job => job.priority > basePriority);
  const basePriorityJobs = jobs.filter(job => job.priority <= basePriority);
  const highPriorityAverage = average(highPriorityJobs.map(job => job.cycleSeconds));
  const basePriorityAverage = average(basePriorityJobs.map(job => job.cycleSeconds));

  const resourceStats: UnifiedTwinResourceStats[] = resources.map(resource => {
    const state = resourceStates.get(resource.id)!;
    const busyUnitSeconds = state.lanes.reduce((sum, lane) => sum + lane.busySeconds, 0);
    const availablePerLane = availableSecondsWithin(state.calendar, makespanSeconds);
    const availableUnitSeconds = availablePerLane * resource.capacity;
    return {
      id: resource.id,
      name: resource.name,
      capacity: resource.capacity,
      busyUnitSeconds,
      availableUnitSeconds,
      availabilityPercent: makespanSeconds > 0 ? (availablePerLane / makespanSeconds) * 100 : 100,
      utilizationPercent: availableUnitSeconds > 0 ? (busyUnitSeconds / availableUnitSeconds) * 100 : 0,
      peakUnits: peakUnits(state),
      generatedFailureWindows: merged.failureCounts[resource.id] || 0,
    };
  }).sort((a, b) => b.utilizationPercent - a.utilizationPercent);

  const blockStats: UnifiedTwinBlockStats[] = profile.blocks.map(block => {
    const blockRuns = runs.filter(run => run.blockId === block.id);
    const cycles = batchCycles.filter(cycle => cycle.blockId === block.id);
    const reworks = blockRuns.filter(run => run.reworkTriggered).length;
    return {
      blockId: block.id,
      blockTitle: block.title,
      runs: blockRuns.length,
      reworkRuns: reworks,
      reworkRatePercent: blockRuns.length ? (reworks / blockRuns.length) * 100 : 0,
      averageDurationSeconds: blockRuns.length ? blockRuns.reduce((sum, run) => sum + run.durationSeconds, 0) / blockRuns.length : 0,
      averageWaitSeconds: blockRuns.length ? blockRuns.reduce((sum, run) => sum + run.waitSeconds, 0) / blockRuns.length : 0,
      p95WaitSeconds: percentile(blockRuns.map(run => run.waitSeconds), 0.95),
      batchCycles: cycles.length,
      averageBatchFillPercent: cycles.length ? cycles.reduce((sum, cycle) => sum + cycle.fillPercent, 0) / cycles.length : 0,
    };
  });

  const throughputWindow = Math.max(0, makespanSeconds - firstRelease);
  const outputWindow = Math.max(0, lastCompletion - firstCompletion);
  const stats: UnifiedTwinStats = {
    makespanSeconds,
    completedJobs: jobs.length,
    totalRuns: runs.length,
    totalReworkRuns,
    reworkRatePercent: runs.length ? (totalReworkRuns / runs.length) * 100 : 0,
    batchCycles: batchCycles.length,
    partialBatchCycles: batchCycles.filter(cycle => cycle.jobIndexes.length < cycle.batchCapacity).length,
    averageBatchFillPercent: batchCycles.length ? batchCycles.reduce((sum, cycle) => sum + cycle.fillPercent, 0) / batchCycles.length : 0,
    averageCycleSeconds: jobs.reduce((sum, job) => sum + job.cycleSeconds, 0) / jobs.length,
    p95CycleSeconds: percentile(jobs.map(job => job.cycleSeconds), 0.95),
    averageWaitSeconds: runs.length ? runs.reduce((sum, run) => sum + run.waitSeconds, 0) / runs.length : 0,
    p95WaitSeconds: percentile(runs.map(run => run.waitSeconds), 0.95),
    throughputPerHour: throughputWindow > 0 ? (jobs.length * 3600) / throughputWindow : null,
    outputRatePerHour: jobs.length > 1 && outputWindow > 0 ? ((jobs.length - 1) * 3600) / outputWindow : null,
    statAverageCycleSeconds: highPriorityAverage,
    routineAverageCycleSeconds: basePriorityAverage,
    statAdvantagePercent: highPriorityAverage != null && basePriorityAverage != null && basePriorityAverage > 0
      ? ((basePriorityAverage - highPriorityAverage) / basePriorityAverage) * 100
      : null,
    resourceBottleneckId: resourceStats[0]?.id,
    resourceBottleneckName: resourceStats[0]?.name,
    resourceBottleneckUtilizationPercent: resourceStats[0]?.utilizationPercent || 0,
  };

  const byResource = Array.from(changeoverAccumulator.byResource.entries()).map(([resourceId, value]) => ({
    resourceId,
    resourceName: resourceById.get(resourceId)?.name || resourceId,
    count: value.count,
    seconds: value.seconds,
  })).sort((a, b) => b.seconds - a.seconds);

  return {
    ok: true,
    runs,
    batchCycles,
    jobs,
    resourceStats,
    blockStats,
    stats,
    warnings,
    errors,
    policyStats: {
      totalChangeoverSeconds: changeoverAccumulator.totalSeconds,
      changeoverCount: changeoverAccumulator.count,
      byResource,
      compatibilityPoliciesApplied: profile.compatibility?.length || 0,
      changeoverPoliciesApplied: profile.changeovers?.length || 0,
    },
  };
}
