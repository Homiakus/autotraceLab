import assert from 'node:assert/strict';
import {
  ProcessScenarioProfile,
  evaluateProcessBatchReadiness,
  getBatchPolicy,
  migrateLegacyBatchPolicies,
  removeProcessBatchPolicy,
  runUniversalProcessMonteCarlo,
  setProcessBatchPolicy,
  simulateUniversalScenario,
  validateProcessScenario,
} from '../process/index';
import { simulateBatchCycleProcess } from '../processBatchSimulation';

function baseBatchProfile(): ProcessScenarioProfile {
  return {
    schemaVersion: '1.0',
    id: 'batch-v2-parity',
    name: 'Batch v2 parity',
    jobs: Array.from({ length: 6 }, (_, index) => ({ id: `job-${index + 1}` })),
    blocks: [
      {
        id: 'batch',
        key: 'batch',
        title: 'Shared batch cycle',
        automation: 'automatic',
        time: { value: 10, unit: 's' },
        dependencies: [],
      },
    ],
    resources: [{ id: 'machine', name: 'Machine', capacity: 1 }],
    requirementsByBlock: { batch: [{ resourceId: 'machine', units: 1 }] },
    arrivals: { kind: 'fixed', intervalSeconds: 0 },
    batchPolicies: [{ blockId: 'batch', batchCapacity: 3, minBatchSize: 3, maxWaitSeconds: 0 }],
  };
}

{
  const profile = baseBatchProfile();
  const legacy = simulateBatchCycleProcess(profile.blocks, {
    batchSize: profile.jobs.length,
    releaseIntervalSeconds: 0,
    resources: profile.resources,
    requirementsByBlock: profile.requirementsByBlock,
    batchConfigs: profile.batchPolicies,
  });
  const universal = simulateUniversalScenario(profile, 20260828);

  assert.equal(legacy.ok, true, legacy.errors.join('; '));
  assert.equal(universal.ok, true, universal.errors.join('; '));
  assert.equal(universal.stats.makespanSeconds, legacy.stats.makespanSeconds);
  assert.equal(universal.core.stats.completedJobs, legacy.stats.completedJobs);
  assert.equal(universal.core.stats.batchCycles, legacy.stats.batchCycles);
  assert.equal(universal.core.stats.partialBatchCycles, legacy.stats.partialBatchCycles);
  assert.equal(universal.stats.averageBatchFillPercent, legacy.stats.averageBatchFillPercent);
  assert.equal(universal.stats.averageCycleSeconds, legacy.stats.averageCycleSeconds);
  assert.equal(universal.stats.averageWaitSeconds, legacy.stats.averageWaitSeconds);
  assert.equal(universal.stats.throughputPerHour, legacy.stats.throughputPerHour);

  const legacyMachine = legacy.resourceStats.find(resource => resource.id === 'machine');
  const universalMachine = universal.core.resourceStats.find(resource => resource.id === 'machine');
  assert.ok(legacyMachine && universalMachine);
  assert.equal(universalMachine.busyUnitSeconds, legacyMachine.busyUnitSeconds);
  assert.equal(universalMachine.peakUnits, legacyMachine.peakUnits);
}

{
  let profile = baseBatchProfile();
  profile.batchPolicies = [];
  profile = setProcessBatchPolicy(profile, {
    blockId: 'batch',
    batchCapacity: 4,
    minBatchSize: 8,
    maxWaitSeconds: -5,
  });
  const normalized = getBatchPolicy(profile, 'batch');
  assert.deepEqual(normalized, {
    blockId: 'batch',
    batchCapacity: 4,
    minBatchSize: 4,
    maxWaitSeconds: 0,
  });
  assert.equal(evaluateProcessBatchReadiness(profile).ready, true);

  profile = removeProcessBatchPolicy(profile, 'batch');
  assert.equal(getBatchPolicy(profile, 'batch'), undefined);
}

{
  const profile = baseBatchProfile();
  profile.batchPolicies = [{ blockId: 'batch', batchCapacity: 2, minBatchSize: 2, maxWaitSeconds: 1 }];
  profile.compatibility = [{
    id: 'same-family',
    rules: [{ blockId: 'batch', attribute: 'family', mode: 'same', missingValue: 'separate' }],
  }];

  const migrated = migrateLegacyBatchPolicies(profile, [
    { blockId: 'batch', batchCapacity: 6, minBatchSize: 1, maxWaitSeconds: 0 },
    { blockId: 'missing', batchCapacity: 99, minBatchSize: 1, maxWaitSeconds: 0 },
  ]);
  assert.equal(getBatchPolicy(migrated, 'batch')?.batchCapacity, 2, 'profile policy must win over duplicate legacy policy');
  assert.equal(migrated.batchPolicies?.some(policy => policy.blockId === 'missing'), false);
  assert.deepEqual(migrated.compatibility, profile.compatibility, 'migration must not rewrite rich compatibility policy');
  assert.equal(validateProcessScenario(migrated).ok, true);
}

{
  const profile = baseBatchProfile();
  profile.jobs = [
    { id: 'a1', attributes: { family: 'A' } },
    { id: 'a2', attributes: { family: 'A' } },
    { id: 'b1', attributes: { family: 'B' } },
    { id: 'b2', attributes: { family: 'B' } },
  ];
  profile.batchPolicies = [{ blockId: 'batch', batchCapacity: 4, minBatchSize: 1, maxWaitSeconds: 0 }];
  profile.compatibility = [{
    id: 'same-family',
    name: 'Do not mix families',
    blockIds: ['batch'],
    rules: [{ blockId: 'batch', attribute: 'family', mode: 'same', missingValue: 'reject' }],
  }];

  const universal = simulateUniversalScenario(profile, 7);
  assert.equal(universal.ok, true, universal.errors.join('; '));
  assert.equal(universal.core.stats.batchCycles, 2, 'same-family compatibility must split A and B into separate cycles');
  assert.equal(universal.core.stats.partialBatchCycles, 2);
  assert.equal(universal.stats.averageBatchFillPercent, 50);
  assert.ok(universal.core.batchCycles.every(cycle => cycle.jobIndexes.length === 2));

  const monteCarlo = runUniversalProcessMonteCarlo(profile, { iterations: 12, seed: 7 });
  assert.equal(monteCarlo.ok, true, monteCarlo.errors.join('; '));
  assert.equal(monteCarlo.averageBatchFillPercent.p50, 50);
  assert.equal(monteCarlo.partialBatchRatePercent.p50, 100);
  assert.equal(monteCarlo.makespanSeconds.min, monteCarlo.makespanSeconds.max, 'fixed profile should remain deterministic across seeds');
}

{
  const invalid = baseBatchProfile();
  invalid.batchPolicies = [{ blockId: 'missing', batchCapacity: 3, minBatchSize: 1, maxWaitSeconds: 0 }];
  const readiness = evaluateProcessBatchReadiness(invalid);
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.invalidBlockIds, ['missing']);
}

console.log('processUniversalBatchV2Test: OK');
