import { GraphProcessBlock } from './processGraphMath';
import {
  ProcessJobDescriptor,
  ProcessScenarioProfile,
  ProcessScenarioValidation,
  validateProcessScenario,
} from './processDomain';
import { UnifiedTwinOptions, UnifiedTwinResult } from './processUnifiedTwin';
import {
  UniversalPolicyStats,
  simulateUniversalPolicyTwin,
} from './processUniversalScheduler';

export interface CompiledUniversalScenario {
  profileId: string;
  blocks: GraphProcessBlock[];
  /** Backward-compatible adapter payload for hosts that still consume UnifiedTwinOptions. */
  twinOptions: UnifiedTwinOptions;
  jobsByIndex: ProcessJobDescriptor[];
  validation: ProcessScenarioValidation;
  warnings: string[];
}

export interface UniversalSimulationStats {
  makespanSeconds: number;
  throughputPerHour: number | null;
  averageCycleSeconds: number;
  p95CycleSeconds: number;
  averageWaitSeconds: number;
  p95WaitSeconds: number;
  averageBatchFillPercent: number;
  partialBatchRate: number;
  highPriorityAverageCycleSeconds: number | null;
  basePriorityAverageCycleSeconds: number | null;
  priorityAdvantagePercent: number | null;
}

export interface UniversalSimulationResult {
  ok: boolean;
  core: UnifiedTwinResult;
  policyStats: UniversalPolicyStats;
  stats: UniversalSimulationStats;
  jobsByIndex: ProcessJobDescriptor[];
  warnings: string[];
  errors: string[];
}

function priorityMap(jobs: ProcessJobDescriptor[]): Record<number, number> {
  return Object.fromEntries(jobs.map((job, index) => [index, Number.isFinite(job.priority) ? Number(job.priority) : 0]));
}

export function compileUniversalScenario(profile: ProcessScenarioProfile): CompiledUniversalScenario {
  const validation = validateProcessScenario(profile);
  return {
    profileId: profile.id,
    blocks: profile.blocks,
    jobsByIndex: profile.jobs,
    validation,
    warnings: [...validation.warnings],
    twinOptions: {
      jobs: Math.max(1, profile.jobs.length),
      resources: profile.resources,
      requirementsByBlock: profile.requirementsByBlock,
      arrivals: profile.arrivals,
      uncertaintyByBlock: profile.uncertaintyByBlock,
      reworkByBlock: profile.retryByBlock,
      batchConfigs: profile.batchPolicies,
      resourceCalendars: profile.calendars,
      failurePolicies: profile.failures,
      priority: {
        priorityByJob: priorityMap(profile.jobs),
        routinePriority: 0,
      },
    },
  };
}

export function simulateUniversalScenario(profile: ProcessScenarioProfile, seed?: number): UniversalSimulationResult {
  const compiled = compileUniversalScenario(profile);
  const core = simulateUniversalPolicyTwin(profile, seed);
  const partialBatchRate = core.stats.batchCycles > 0
    ? core.stats.partialBatchCycles / core.stats.batchCycles
    : 0;

  return {
    ok: core.ok,
    core,
    policyStats: core.policyStats,
    jobsByIndex: compiled.jobsByIndex,
    warnings: [...compiled.warnings, ...core.warnings],
    errors: [...core.errors],
    stats: {
      makespanSeconds: core.stats.makespanSeconds,
      throughputPerHour: core.stats.throughputPerHour,
      averageCycleSeconds: core.stats.averageCycleSeconds,
      p95CycleSeconds: core.stats.p95CycleSeconds,
      averageWaitSeconds: core.stats.averageWaitSeconds,
      p95WaitSeconds: core.stats.p95WaitSeconds,
      averageBatchFillPercent: core.stats.averageBatchFillPercent,
      partialBatchRate,
      // Neutral aliases hide the legacy field names kept on UnifiedTwinResult only
      // for binary/source compatibility with existing screens.
      highPriorityAverageCycleSeconds: core.stats.statAverageCycleSeconds,
      basePriorityAverageCycleSeconds: core.stats.routineAverageCycleSeconds,
      priorityAdvantagePercent: core.stats.statAdvantagePercent,
    },
  };
}
