import { ProcessScenarioProfile, cloneProcessScenario } from './processDomain';
import { DigitalTwinArrivalKind, DigitalTwinReworkPolicy } from './processDigitalTwin';

const HOUR = 3600;
const DAY = 24 * HOUR;

export interface DailyResourceScheduleInput {
  shiftEnabled: boolean;
  shiftStartHour: number;
  shiftEndHour: number;
  downtimeEnabled: boolean;
  downtimeStartHour: number;
  downtimeDurationHour: number;
}

export function setProcessArrival(
  profile: ProcessScenarioProfile,
  kind: DigitalTwinArrivalKind,
  seconds: number,
): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  const value = Math.max(kind === 'poisson' ? 0.001 : 0, Number(seconds) || 0);
  next.arrivals = kind === 'poisson'
    ? { kind: 'poisson', meanIntervalSeconds: value }
    : { kind: 'fixed', intervalSeconds: value };
  return next;
}

export function setProcessRetry(
  profile: ProcessScenarioProfile,
  blockId: string,
  probabilityPercent: number,
  maxRepeats: number,
): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  if (!next.blocks.some(block => block.id === blockId)) throw new Error(`Unknown block: ${blockId}`);
  const probability = Math.max(0, Math.min(100, Number(probabilityPercent) || 0)) / 100;
  const repeats = Math.max(0, Math.floor(Number(maxRepeats) || 0));
  const policies = { ...(next.retryByBlock || {}) };
  if (probability === 0 || repeats === 0) delete policies[blockId];
  else policies[blockId] = { probability, maxRepeats: repeats } as DigitalTwinReworkPolicy;
  next.retryByBlock = policies;
  return next;
}

export function retryPercent(profile: ProcessScenarioProfile, blockId: string): number {
  return Math.max(0, Math.min(100, (profile.retryByBlock?.[blockId]?.probability || 0) * 100));
}

export function setPeriodicJobPriority(
  profile: ProcessScenarioProfile,
  everyN: number,
  highPriority = 100,
  basePriority = 0,
): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  const cadence = Math.max(0, Math.floor(Number(everyN) || 0));
  next.jobs = next.jobs.map((job, index) => {
    const high = cadence > 0 && (index + 1) % cadence === 0;
    return {
      ...job,
      priority: high ? highPriority : basePriority,
      priorityClass: high ? 'expedite' : 'standard',
    };
  });
  return next;
}

export function setDailyResourceSchedule(
  profile: ProcessScenarioProfile,
  resourceId: string,
  input: DailyResourceScheduleInput,
): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  if (!next.resources.some(resource => resource.id === resourceId)) throw new Error(`Unknown resource: ${resourceId}`);
  const calendars = { ...(next.calendars || {}) };
  if (!input.shiftEnabled && !input.downtimeEnabled) {
    delete calendars[resourceId];
    next.calendars = calendars;
    return next;
  }
  const policy = { cycleSeconds: DAY } as NonNullable<ProcessScenarioProfile['calendars']>[string];
  if (input.shiftEnabled) {
    const start = Math.max(0, Math.min(24, Number(input.shiftStartHour) || 0));
    const end = Math.max(0, Math.min(24, Number(input.shiftEndHour) || 0));
    if (end > start) policy.workingWindows = [{ startOffsetSeconds: start * HOUR, endOffsetSeconds: end * HOUR }];
  }
  if (input.downtimeEnabled) {
    const start = Math.max(0, Number(input.downtimeStartHour) || 0) * HOUR;
    const duration = Math.max(0, Number(input.downtimeDurationHour) || 0) * HOUR;
    if (duration > 0) policy.plannedDowntime = [{ startSeconds: start, endSeconds: start + duration, reason: 'Planned downtime' }];
  }
  calendars[resourceId] = policy;
  next.calendars = calendars;
  return next;
}

export function evaluateDigitalTwinReadiness(profile: ProcessScenarioProfile): {
  ready: boolean;
  unresolvedBlockIds: string[];
  retryPolicies: number;
  calendarPolicies: number;
  priorityJobs: number;
} {
  const unresolvedBlockIds = profile.blocks
    .filter(block => block.time.value == null && !block.time.formula?.trim())
    .map(block => block.id);
  return {
    ready: profile.jobs.length > 0 && profile.blocks.length > 0 && unresolvedBlockIds.length === 0,
    unresolvedBlockIds,
    retryPolicies: Object.keys(profile.retryByBlock || {}).length,
    calendarPolicies: Object.keys(profile.calendars || {}).length,
    priorityJobs: profile.jobs.filter(job => (job.priority || 0) > 0).length,
  };
}
