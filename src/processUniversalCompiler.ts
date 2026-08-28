import { GraphProcessBlock } from './processGraphMath';
import {
  ProcessJobDescriptor,
  ProcessScenarioProfile,
  ProcessScenarioValidation,
  validateProcessScenario,
} from './processDomain';
import {
  UnifiedTwinOptions,
  UnifiedTwinResult,
  simulateUnifiedStochasticBatchTwin,
} from './processUnifiedTwin';

export interface CompiledUniversalScenario {
  profileId: string;
  blocks: GraphProcessBlock[];
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
  const warnings = [...validation.warnings];

  // Compatibility and sequence-dependent changeovers are first-class contracts.
  // The current core simulator consumes all neutral scheduling primitives directly;
  // compatibility/changeover policies are also exposed separately for planners and
  // host adapters until their lane-level reservations are enabled in the unified DES.
  if (profile.compatibility?.length) {
    warnings.push('Compatibility policies are preserved in the universal profile and available to planners; core DES enforcement is staged separately.');
  }
  if (profile.changeovers?.length) {
    warnings.push('Changeover policies are preserved in the universal profile and available to planners; core DES reservation integration is staged separately.');
  }

  return {
    profileId: profile.id,
    blocks: profile.blocks,
    jobsByIndex: profile.jobs,
    validation,
    warnings,
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

export function simulateUniversalScenario(profile: ProcessScenarioProfile): UniversalSimulationResult {
  const compiled = compileUniversalScenario(profile);
  if (!compiled.validation.ok) {
    const empty = simulateUnifiedStochasticBatchTwin([], {
      jobs: 1,
      resources: [],
    });
    return {
      ok: false,
      core: empty,
      stats: {
        makespanSeconds: 0,
        throughputPerHour: null,
        averageCycleSeconds: 0,
        p95CycleSeconds: 0,
        averageWaitSeconds: 0,
        p95WaitSeconds: 0,
        averageBatchFillPercent: 0,
        partialBatchRate: 0,
        highPriorityAverageCycleSeconds: null,
        basePriorityAverageCycleSeconds: null,
        priorityAdvantagePercent: null,
      },
      jobsByIndex: compiled.jobsByIndex,
      warnings: compiled.warnings,
      errors: compiled.validation.errors,
    };
  }

  const core = simulateUnifiedStochasticBatchTwin(compiled.blocks, compiled.twinOptions);
  const partialBatchRate = core.stats.batchCycles > 0
    ? core.stats.partialBatchCycles / core.stats.batchCycles
    : 0;

  return {
    ok: core.ok,
    core,
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
      // These neutral aliases intentionally hide the legacy medical naming used
      // inside the compatibility layer of the existing engine.
      highPriorityAverageCycleSeconds: core.stats.statAverageCycleSeconds,
      basePriorityAverageCycleSeconds: core.stats.routineAverageCycleSeconds,
      priorityAdvantagePercent: core.stats.statAdvantagePercent,
    },
  };
}
