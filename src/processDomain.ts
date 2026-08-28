import { GraphProcessBlock } from './processGraphMath';
import { ProcessBatchConfig } from './processBatchSimulation';
import { ProcessBlockUncertainty } from './processRisk';
import { ProcessResource, ProcessResourceRequirement } from './processSimulation';
import { DigitalTwinArrivalConfig, DigitalTwinReworkPolicy } from './processDigitalTwin';
import { ProcessResourceCalendarPolicy } from './processResourceCalendar';
import { ResourceFailurePolicy } from './processReliability';

export type ProcessAttributeValue = string | number | boolean | null;
export type ProcessAttributeMap = Record<string, ProcessAttributeValue>;

/**
 * Domain-neutral unit of work. A job may be a specimen, production order,
 * painted part, print task, CNC setup, support ticket, compute job, delivery,
 * document, or any other item moving through a process graph.
 */
export interface ProcessJobDescriptor {
  id: string;
  label?: string;
  priority?: number;
  priorityClass?: string;
  attributes?: ProcessAttributeMap;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export type BatchCompatibilityMode = 'same' | 'different' | 'allowed-set' | 'forbidden-pairs';

export interface ProcessBatchCompatibilityRule {
  /** Operation/block for which the rule applies. Omit for every batch block. */
  blockId?: string;
  /** Job attribute, for example recipe, color, material, tenant, lot or program. */
  attribute: string;
  mode: BatchCompatibilityMode;
  allowedValues?: ProcessAttributeValue[];
  forbiddenPairs?: Array<[ProcessAttributeValue, ProcessAttributeValue]>;
  missingValue?: 'allow' | 'reject' | 'separate';
}

export interface ProcessBatchCompatibilityPolicy {
  id: string;
  name?: string;
  blockIds?: string[];
  rules: ProcessBatchCompatibilityRule[];
}

export interface ProcessChangeoverMatrix {
  [fromState: string]: Record<string, number>;
}

export interface ProcessChangeoverPolicy {
  id: string;
  name?: string;
  /** Apply to a resource, an operation, or both. */
  resourceId?: string;
  blockId?: string;
  /** Attributes that define setup state. Values are concatenated deterministically. */
  stateAttributes: string[];
  defaultSeconds: number;
  sameStateSeconds?: number;
  matrixSeconds?: ProcessChangeoverMatrix;
  initialState?: string;
  metadata?: Record<string, unknown>;
}

export type ProcessObjectiveGoal = 'maximize' | 'minimize' | 'target';

export interface ProcessOptimizationObjective {
  id: string;
  metric:
    | 'throughputPerHour'
    | 'p95CycleSeconds'
    | 'averageCycleSeconds'
    | 'averageWaitSeconds'
    | 'p95WaitSeconds'
    | 'averageBatchFillPercent'
    | 'partialBatchRate'
    | 'availabilityPercent'
    | 'utilizationPercent'
    | string;
  goal: ProcessObjectiveGoal;
  weight: number;
  target?: number;
  tolerance?: number;
}

export interface ProcessScenarioProfile {
  schemaVersion: '1.0';
  id: string;
  name: string;
  description?: string;
  domain?: string;
  jobs: ProcessJobDescriptor[];
  blocks: GraphProcessBlock[];
  resources: ProcessResource[];
  requirementsByBlock?: Record<string, ProcessResourceRequirement[]>;
  arrivals?: DigitalTwinArrivalConfig;
  uncertaintyByBlock?: Record<string, ProcessBlockUncertainty>;
  retryByBlock?: Record<string, DigitalTwinReworkPolicy>;
  batchPolicies?: ProcessBatchConfig[];
  calendars?: Record<string, ProcessResourceCalendarPolicy>;
  failures?: ResourceFailurePolicy[];
  compatibility?: ProcessBatchCompatibilityPolicy[];
  changeovers?: ProcessChangeoverPolicy[];
  objectives?: ProcessOptimizationObjective[];
  metadata?: Record<string, unknown>;
}

export interface ProcessScenarioValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateProcessScenario(profile: ProcessScenarioProfile): ProcessScenarioValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const jobIds = new Set<string>();
  const blockIds = new Set(profile.blocks.map(block => block.id));
  const resourceIds = new Set(profile.resources.map(resource => resource.id));

  if (profile.schemaVersion !== '1.0') errors.push(`Unsupported schemaVersion: ${profile.schemaVersion}`);
  if (!profile.id.trim()) errors.push('Scenario id is required');
  if (!profile.name.trim()) errors.push('Scenario name is required');
  if (!profile.jobs.length) errors.push('Scenario must contain at least one job');
  if (!profile.blocks.length) errors.push('Scenario must contain at least one operation block');

  for (const job of profile.jobs) {
    if (!job.id.trim()) errors.push('Job id cannot be empty');
    if (jobIds.has(job.id)) errors.push(`Duplicate job id: ${job.id}`);
    jobIds.add(job.id);
  }

  for (const [blockId, requirements] of Object.entries(profile.requirementsByBlock || {})) {
    if (!blockIds.has(blockId)) warnings.push(`Resource requirements ignored for unknown block: ${blockId}`);
    for (const requirement of requirements) {
      if (!resourceIds.has(requirement.resourceId)) errors.push(`Unknown resource ${requirement.resourceId} in block ${blockId}`);
    }
  }

  for (const policy of profile.batchPolicies || []) {
    if (!blockIds.has(policy.blockId)) errors.push(`Batch policy references unknown block: ${policy.blockId}`);
  }
  for (const policy of profile.failures || []) {
    if (!resourceIds.has(policy.resourceId)) errors.push(`Failure policy references unknown resource: ${policy.resourceId}`);
  }
  for (const [resourceId] of Object.entries(profile.calendars || {})) {
    if (!resourceIds.has(resourceId)) warnings.push(`Calendar references unknown resource: ${resourceId}`);
  }
  for (const policy of profile.changeovers || []) {
    if (policy.resourceId && !resourceIds.has(policy.resourceId)) errors.push(`Changeover ${policy.id}: unknown resource ${policy.resourceId}`);
    if (policy.blockId && !blockIds.has(policy.blockId)) errors.push(`Changeover ${policy.id}: unknown block ${policy.blockId}`);
    if (!policy.stateAttributes.length) errors.push(`Changeover ${policy.id}: stateAttributes cannot be empty`);
    if (policy.defaultSeconds < 0) errors.push(`Changeover ${policy.id}: defaultSeconds must be >= 0`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function cloneProcessScenario(profile: ProcessScenarioProfile): ProcessScenarioProfile {
  return JSON.parse(JSON.stringify(profile)) as ProcessScenarioProfile;
}
