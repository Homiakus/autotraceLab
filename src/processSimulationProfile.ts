import { ProcessScenarioProfile, cloneProcessScenario } from './processDomain';
import { LegacyResourceSimulationModel, legacyResourceModelToProcessScenario } from './processLegacyAdapters';
import { createBlankProcessMathScenario, resizeProcessScenarioJobs } from './processMathProfile';
import { ProcessResource, ProcessResourceRequirement } from './processSimulation';

export const PROCESS_SIMULATION_PROFILE_STORAGE_KEY = 'autotrace:process-simulation-profile:v2';
export const LEGACY_RESOURCE_SIMULATION_STORAGE_KEY = 'autotrace:resource-simulation:v1';

export interface ProcessSimulationReadiness {
  totalBlocks: number;
  unresolvedTimeBlockIds: string[];
  invalidRequirementBlockIds: string[];
  missingResourceIds: string[];
  resourceCount: number;
  simulationReady: boolean;
}

function sanitizeResource(resource: ProcessResource): ProcessResource {
  return {
    id: resource.id.trim(),
    name: resource.name.trim() || resource.id.trim() || 'Resource',
    capacity: Math.max(1, Math.floor(Number(resource.capacity) || 1)),
  };
}

export function createBlankProcessSimulationScenario(): ProcessScenarioProfile {
  const base = resizeProcessScenarioJobs(createBlankProcessMathScenario(), 12);
  const resources: ProcessResource[] = [
    { id: 'worker', name: 'Worker / operator', capacity: 1 },
    { id: 'machine', name: 'Machine / automation', capacity: 1 },
    { id: 'external', name: 'External station', capacity: 1 },
    { id: 'qc', name: 'QC station', capacity: 1 },
  ];
  const requirementsByBlock: Record<string, ProcessResourceRequirement[]> = {};
  for (const block of base.blocks) {
    switch (block.automation) {
      case 'manual': requirementsByBlock[block.id] = [{ resourceId: 'worker', units: 1 }]; break;
      case 'automatic': requirementsByBlock[block.id] = [{ resourceId: 'machine', units: 1 }]; break;
      case 'mixed': requirementsByBlock[block.id] = [{ resourceId: 'worker', units: 1 }, { resourceId: 'machine', units: 1 }]; break;
      case 'external': requirementsByBlock[block.id] = [{ resourceId: 'external', units: 1 }]; break;
      case 'qc': requirementsByBlock[block.id] = [{ resourceId: 'qc', units: 1 }]; break;
      default: requirementsByBlock[block.id] = [];
    }
  }
  return {
    ...base,
    id: 'process-simulation-custom',
    name: 'Новый ресурсный процесс',
    resources,
    requirementsByBlock,
    arrivals: { kind: 'fixed', intervalSeconds: 0 },
    metadata: {
      ...(base.metadata || {}),
      processSimulation: { createdBy: 'process-simulation-v2' },
    },
  };
}

export function migrateLegacyResourceSimulationModel(model: LegacyResourceSimulationModel): ProcessScenarioProfile {
  const profile = legacyResourceModelToProcessScenario(model, {
    id: 'migrated-resource-simulation',
    metadata: { processSimulation: { migratedBy: 'process-simulation-v2' } },
  });
  return profile;
}

export function resizeSimulationJobs(profile: ProcessScenarioProfile, count: number): ProcessScenarioProfile {
  return resizeProcessScenarioJobs(profile, count);
}

export function setFixedArrivalInterval(profile: ProcessScenarioProfile, intervalSeconds: number): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  next.arrivals = { kind: 'fixed', intervalSeconds: Math.max(0, Number(intervalSeconds) || 0) };
  return next;
}

export function upsertProcessResource(
  profile: ProcessScenarioProfile,
  resource: ProcessResource,
  previousId?: string,
): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  const normalized = sanitizeResource(resource);
  if (!normalized.id) throw new Error('Resource id cannot be empty');
  const oldId = previousId || normalized.id;
  const duplicate = next.resources.some(item => item.id === normalized.id && item.id !== oldId);
  if (duplicate) throw new Error(`Resource id already exists: ${normalized.id}`);

  const index = next.resources.findIndex(item => item.id === oldId);
  if (index >= 0) next.resources[index] = normalized;
  else next.resources.push(normalized);

  if (oldId !== normalized.id) {
    for (const requirements of Object.values(next.requirementsByBlock || {})) {
      for (const requirement of requirements) {
        if (requirement.resourceId === oldId) requirement.resourceId = normalized.id;
      }
    }
    if (next.calendars?.[oldId]) {
      next.calendars[normalized.id] = next.calendars[oldId];
      delete next.calendars[oldId];
    }
    for (const failure of next.failures || []) if (failure.resourceId === oldId) failure.resourceId = normalized.id;
    for (const changeover of next.changeovers || []) if (changeover.resourceId === oldId) changeover.resourceId = normalized.id;
  }
  return next;
}

export function removeProcessResourceFromScenario(
  profile: ProcessScenarioProfile,
  resourceId: string,
): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  next.resources = next.resources.filter(resource => resource.id !== resourceId);
  if (next.requirementsByBlock) {
    for (const [blockId, requirements] of Object.entries(next.requirementsByBlock)) {
      next.requirementsByBlock[blockId] = requirements.filter(requirement => requirement.resourceId !== resourceId);
    }
  }
  if (next.calendars) delete next.calendars[resourceId];
  next.failures = (next.failures || []).filter(failure => failure.resourceId !== resourceId);
  next.changeovers = (next.changeovers || []).filter(changeover => changeover.resourceId !== resourceId);
  return next;
}

export function setBlockResourceRequirement(
  profile: ProcessScenarioProfile,
  blockId: string,
  resourceId: string,
  units: number,
): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  next.requirementsByBlock = { ...(next.requirementsByBlock || {}) };
  const current = [...(next.requirementsByBlock[blockId] || [])];
  const index = current.findIndex(requirement => requirement.resourceId === resourceId);
  const normalizedUnits = Math.floor(Number(units) || 0);
  if (normalizedUnits <= 0) {
    if (index >= 0) current.splice(index, 1);
  } else {
    const value = { resourceId, units: Math.max(1, normalizedUnits) };
    if (index >= 0) current[index] = value;
    else current.push(value);
  }
  next.requirementsByBlock[blockId] = current;
  return next;
}

export function applyAutomationResourceDefaults(profile: ProcessScenarioProfile): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  const defaults: ProcessResource[] = [
    { id: 'operator', name: 'Operator', capacity: 1 },
    { id: 'automation', name: 'Automation / processor', capacity: 1 },
    { id: 'external', name: 'External module', capacity: 1 },
    { id: 'qc', name: 'QC station', capacity: 1 },
  ];
  const existing = new Set(next.resources.map(resource => resource.id));
  for (const resource of defaults) if (!existing.has(resource.id)) next.resources.push(resource);
  next.requirementsByBlock = { ...(next.requirementsByBlock || {}) };
  for (const block of next.blocks) {
    if (next.requirementsByBlock[block.id]?.length) continue;
    const ids: string[] = [];
    switch (block.automation) {
      case 'manual': ids.push('operator'); break;
      case 'automatic': ids.push('automation'); break;
      case 'mixed': ids.push('operator', 'automation'); break;
      case 'external': ids.push('external'); break;
      case 'qc': ids.push('qc'); break;
      default: break;
    }
    next.requirementsByBlock[block.id] = ids.map(resourceId => ({ resourceId, units: 1 }));
  }
  return next;
}

export function evaluateProcessSimulationReadiness(profile: ProcessScenarioProfile): ProcessSimulationReadiness {
  const resourceIds = new Set(profile.resources.map(resource => resource.id));
  const unresolvedTimeBlockIds = profile.blocks
    .filter(block => block.time.value == null && !block.time.formula?.trim())
    .map(block => block.id);
  const missingResourceIds = new Set<string>();
  const invalidRequirementBlockIds = new Set<string>();
  for (const [blockId, requirements] of Object.entries(profile.requirementsByBlock || {})) {
    for (const requirement of requirements) {
      if (!resourceIds.has(requirement.resourceId)) {
        missingResourceIds.add(requirement.resourceId);
        invalidRequirementBlockIds.add(blockId);
      }
      if (!Number.isFinite(requirement.units) || requirement.units < 1) invalidRequirementBlockIds.add(blockId);
    }
  }
  return {
    totalBlocks: profile.blocks.length,
    unresolvedTimeBlockIds,
    invalidRequirementBlockIds: Array.from(invalidRequirementBlockIds),
    missingResourceIds: Array.from(missingResourceIds),
    resourceCount: profile.resources.length,
    simulationReady: profile.blocks.length > 0 && unresolvedTimeBlockIds.length === 0 && invalidRequirementBlockIds.size === 0,
  };
}
