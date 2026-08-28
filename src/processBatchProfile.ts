import { ProcessScenarioProfile, cloneProcessScenario } from './processDomain';
import { ProcessBatchConfig } from './processBatchSimulation';

export const LEGACY_BATCH_SIMULATION_STORAGE_KEY = 'autotrace:batch-simulation:v1';

function normalizeBatchPolicy(policy: ProcessBatchConfig): ProcessBatchConfig {
  const capacity = Math.max(1, Math.floor(Number(policy.batchCapacity) || 1));
  return {
    blockId: policy.blockId,
    batchCapacity: capacity,
    minBatchSize: Math.min(capacity, Math.max(1, Math.floor(Number(policy.minBatchSize) || 1))),
    maxWaitSeconds: Math.max(0, Number(policy.maxWaitSeconds) || 0),
  };
}

export function getBatchPolicy(profile: ProcessScenarioProfile, blockId: string): ProcessBatchConfig | undefined {
  const policy = profile.batchPolicies?.find(item => item.blockId === blockId);
  return policy ? { ...policy } : undefined;
}

export function setProcessBatchPolicy(
  profile: ProcessScenarioProfile,
  policy: ProcessBatchConfig,
): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  const normalized = normalizeBatchPolicy(policy);
  if (!next.blocks.some(block => block.id === normalized.blockId)) {
    throw new Error(`Unknown block for batch policy: ${normalized.blockId}`);
  }
  const policies = [...(next.batchPolicies || [])];
  const index = policies.findIndex(item => item.blockId === normalized.blockId);
  if (index >= 0) policies[index] = normalized;
  else policies.push(normalized);
  next.batchPolicies = policies;
  return next;
}

export function removeProcessBatchPolicy(
  profile: ProcessScenarioProfile,
  blockId: string,
): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  next.batchPolicies = (next.batchPolicies || []).filter(policy => policy.blockId !== blockId);
  return next;
}

export function migrateLegacyBatchPolicies(
  profile: ProcessScenarioProfile,
  policies: ProcessBatchConfig[],
): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  const validBlockIds = new Set(next.blocks.map(block => block.id));
  const merged = new Map<string, ProcessBatchConfig>();
  for (const policy of next.batchPolicies || []) {
    if (validBlockIds.has(policy.blockId)) merged.set(policy.blockId, normalizeBatchPolicy(policy));
  }
  for (const policy of policies || []) {
    if (validBlockIds.has(policy.blockId) && !merged.has(policy.blockId)) {
      merged.set(policy.blockId, normalizeBatchPolicy(policy));
    }
  }
  next.batchPolicies = Array.from(merged.values());
  next.metadata = {
    ...(next.metadata || {}),
    processBatch: {
      migratedFrom: LEGACY_BATCH_SIMULATION_STORAGE_KEY,
      policyCount: next.batchPolicies.length,
    },
  };
  return next;
}

export function defaultBatchPolicyForBlock(
  profile: ProcessScenarioProfile,
  blockId: string,
): ProcessBatchConfig {
  const jobs = Math.max(1, profile.jobs.length);
  const capacity = Math.max(2, Math.min(12, jobs));
  return { blockId, batchCapacity: capacity, minBatchSize: 1, maxWaitSeconds: 0 };
}

export interface ProcessBatchReadiness {
  enabledBlocks: number;
  invalidBlockIds: string[];
  compatibilityPolicyCount: number;
  hasJobs: boolean;
  ready: boolean;
}

export function evaluateProcessBatchReadiness(profile: ProcessScenarioProfile): ProcessBatchReadiness {
  const blockIds = new Set(profile.blocks.map(block => block.id));
  const invalidBlockIds = (profile.batchPolicies || [])
    .filter(policy => !blockIds.has(policy.blockId) || policy.batchCapacity < 1 || policy.minBatchSize < 1 || policy.minBatchSize > policy.batchCapacity || policy.maxWaitSeconds < 0)
    .map(policy => policy.blockId);
  return {
    enabledBlocks: profile.batchPolicies?.length || 0,
    invalidBlockIds,
    compatibilityPolicyCount: profile.compatibility?.length || 0,
    hasJobs: profile.jobs.length > 0,
    ready: profile.jobs.length > 0 && invalidBlockIds.length === 0,
  };
}
