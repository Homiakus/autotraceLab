import assert from 'node:assert/strict';
import {
  ProcessScenarioProfile,
  applyAutomationResourceDefaults,
  createBlankProcessSimulationScenario,
  evaluateProcessSimulationReadiness,
  migrateLegacyResourceSimulationModel,
  removeProcessResourceFromScenario,
  resizeSimulationJobs,
  setBlockResourceRequirement,
  setFixedArrivalInterval,
  simulateUniversalScenario,
  upsertProcessResource,
  validateProcessScenario,
} from '../process/index';
import { simulateResourceConstrainedProcess } from '../processSimulation';

{
  const legacy = {
    name: 'Legacy parity',
    batchSize: 4,
    releaseIntervalSeconds: 3,
    blocks: [
      { id: 'a', key: 'a', title: 'A', automation: 'automatic' as const, time: { value: 10, unit: 's' as const }, dependencies: [] },
      { id: 'b', key: 'b', title: 'B', automation: 'qc' as const, time: { value: 5, unit: 's' as const }, dependencies: ['a'] },
    ],
    resources: [
      { id: 'machine', name: 'Machine', capacity: 2 },
      { id: 'qc', name: 'QC', capacity: 1 },
    ],
    requirementsByBlock: {
      a: [{ resourceId: 'machine', units: 1 }],
      b: [{ resourceId: 'qc', units: 1 }],
    },
  };

  const oldResult = simulateResourceConstrainedProcess(legacy.blocks, {
    batchSize: legacy.batchSize,
    releaseIntervalSeconds: legacy.releaseIntervalSeconds,
    resources: legacy.resources,
    requirementsByBlock: legacy.requirementsByBlock,
  });
  const profile = migrateLegacyResourceSimulationModel(legacy);
  const universal = simulateUniversalScenario(profile, 1);
  assert.equal(oldResult.ok, true, oldResult.errors.join('; '));
  assert.equal(universal.ok, true, universal.errors.join('; '));
  assert.equal(universal.stats.makespanSeconds, oldResult.stats.makespanSeconds, 'deterministic no-policy scenario must preserve legacy makespan');
  assert.equal(universal.core.stats.completedJobs, oldResult.stats.completedJobs);
  assert.equal(universal.core.stats.totalRuns, oldResult.stats.totalTaskRuns);
  assert.equal(universal.stats.averageCycleSeconds, oldResult.stats.averageCycleSeconds);
  assert.equal(universal.stats.p95CycleSeconds, oldResult.stats.p95CycleSeconds);
  assert.equal(universal.stats.averageWaitSeconds, oldResult.stats.averageWaitSeconds);
  assert.equal(universal.stats.throughputPerHour, oldResult.stats.throughputPerHour);
  for (const oldResource of oldResult.resourceStats) {
    const nextResource = universal.core.resourceStats.find(resource => resource.id === oldResource.id);
    assert.ok(nextResource, `resource ${oldResource.id} missing in universal result`);
    assert.equal(nextResource.busyUnitSeconds, oldResource.busyUnitSeconds);
    assert.equal(nextResource.peakUnits, oldResource.peakUnits);
  }
}

{
  const blank = createBlankProcessSimulationScenario();
  assert.equal(validateProcessScenario(blank).ok, true);
  assert.equal(blank.jobs.length, 12);
  assert.ok(blank.resources.length >= 1);
  assert.equal(evaluateProcessSimulationReadiness(blank).simulationReady, true);

  const resized = resizeSimulationJobs(blank, 5);
  assert.equal(resized.jobs.length, 5);
  const arrivals = setFixedArrivalInterval(resized, 7.5);
  assert.equal(arrivals.arrivals?.kind, 'fixed');
  assert.equal(arrivals.arrivals?.kind === 'fixed' ? arrivals.arrivals.intervalSeconds : null, 7.5);
}

{
  let profile = createBlankProcessSimulationScenario();
  profile = upsertProcessResource(profile, { id: 'extra', name: 'Extra', capacity: 2 });
  assert.ok(profile.resources.some(resource => resource.id === 'extra'));
  profile = setBlockResourceRequirement(profile, profile.blocks[0].id, 'extra', 2);
  assert.equal(profile.requirementsByBlock?.[profile.blocks[0].id]?.find(requirement => requirement.resourceId === 'extra')?.units, 2);

  profile.failures = [{ resourceId: 'extra', mtbfSeconds: 100, mttrSeconds: 10 }];
  profile.changeovers = [{ id: 'setup', resourceId: 'extra', stateAttributes: ['family'], defaultSeconds: 2 }];
  profile.calendars = { extra: { workingWindows: [{ startSeconds: 0, endSeconds: 1000 }] } };
  profile = removeProcessResourceFromScenario(profile, 'extra');
  assert.equal(profile.resources.some(resource => resource.id === 'extra'), false);
  assert.equal(Object.values(profile.requirementsByBlock || {}).flat().some(requirement => requirement.resourceId === 'extra'), false);
  assert.equal(profile.failures?.some(failure => failure.resourceId === 'extra'), false);
  assert.equal(profile.changeovers?.some(changeover => changeover.resourceId === 'extra'), false);
  assert.equal(Boolean(profile.calendars?.extra), false);
  assert.equal(validateProcessScenario(profile).ok, true);
}

{
  const profile: ProcessScenarioProfile = {
    schemaVersion: '1.0',
    id: 'needs-resource-defaults',
    name: 'Needs defaults',
    jobs: [{ id: 'job-1' }],
    blocks: [
      { id: 'manual', key: 'manual', title: 'Manual', automation: 'manual', time: { value: 1, unit: 's' }, dependencies: [] },
      { id: 'auto', key: 'auto', title: 'Auto', automation: 'automatic', time: { value: 1, unit: 's' }, dependencies: ['manual'] },
    ],
    resources: [],
  };
  const enriched = applyAutomationResourceDefaults(profile);
  assert.ok(enriched.resources.some(resource => resource.id === 'operator'));
  assert.ok(enriched.resources.some(resource => resource.id === 'automation'));
  assert.equal(enriched.requirementsByBlock?.manual?.[0]?.resourceId, 'operator');
  assert.equal(enriched.requirementsByBlock?.auto?.[0]?.resourceId, 'automation');
  assert.equal(simulateUniversalScenario(enriched, 2).ok, true);
}

{
  const unresolved = createBlankProcessSimulationScenario();
  unresolved.blocks[0].time.value = null;
  unresolved.blocks[0].time.formula = undefined;
  const readiness = evaluateProcessSimulationReadiness(unresolved);
  assert.equal(readiness.simulationReady, false);
  assert.ok(readiness.unresolvedTimeBlockIds.includes(unresolved.blocks[0].id));
  assert.equal(simulateUniversalScenario(unresolved, 3).ok, false);
}

console.log('processSimulationV2Test: OK');
