import assert from 'node:assert/strict';
import { ProcessScenarioProfile } from '../processDomain';
import { setupStateForJob } from '../processCompatibility';
import { simulateUniversalPolicyTwin } from '../processUniversalScheduler';

function batchProfile(withCompatibility: boolean): ProcessScenarioProfile {
  return {
    schemaVersion: '1.0',
    id: withCompatibility ? 'batch-compatible' : 'batch-free',
    name: 'Batch compatibility test',
    jobs: [
      { id: 'a1', attributes: { recipe: 'A' } },
      { id: 'b1', attributes: { recipe: 'B' } },
      { id: 'a2', attributes: { recipe: 'A' } },
      { id: 'b2', attributes: { recipe: 'B' } },
    ],
    blocks: [
      { id: 'process', key: 'process', title: 'Batch process', automation: 'automatic', time: { value: 10, unit: 's' }, dependencies: [] },
    ],
    resources: [{ id: 'machine', name: 'Machine', capacity: 1 }],
    requirementsByBlock: { process: [{ resourceId: 'machine', units: 1 }] },
    batchPolicies: [{ blockId: 'process', batchCapacity: 4, minBatchSize: 1, maxWaitSeconds: 0 }],
    compatibility: withCompatibility ? [{
      id: 'same-recipe',
      blockIds: ['process'],
      rules: [{ attribute: 'recipe', mode: 'same', missingValue: 'separate' }],
    }] : undefined,
  };
}

{
  const free = simulateUniversalPolicyTwin(batchProfile(false), 1);
  assert.equal(free.ok, true, free.errors.join('; '));
  assert.equal(free.batchCycles.length, 1, 'without compatibility all four jobs should share one batch');
  assert.equal(free.batchCycles[0].jobIndexes.length, 4);

  const compatibleProfile = batchProfile(true);
  const compatible = simulateUniversalPolicyTwin(compatibleProfile, 1);
  assert.equal(compatible.ok, true, compatible.errors.join('; '));
  assert.equal(compatible.batchCycles.length, 2, 'recipe compatibility should split the physical batches');
  for (const cycle of compatible.batchCycles) {
    const recipes = new Set(cycle.jobIndexes.map(index => compatibleProfile.jobs[index].attributes?.recipe));
    assert.equal(recipes.size, 1, 'a physical batch must contain compatible recipes only');
  }
  assert.equal(compatible.stats.makespanSeconds, 20);
  assert.equal(compatible.policyStats.compatibilityPoliciesApplied, 1);
}

{
  const profile: ProcessScenarioProfile = {
    schemaVersion: '1.0',
    id: 'changeover-order',
    name: 'Changeover ordering test',
    jobs: [
      { id: 'a1', attributes: { color: 'A' } },
      { id: 'b1', attributes: { color: 'B' } },
      { id: 'a2', attributes: { color: 'A' } },
    ],
    blocks: [
      { id: 'paint', key: 'paint', title: 'Paint', automation: 'automatic', time: { value: 10, unit: 's' }, dependencies: [] },
    ],
    resources: [{ id: 'line', name: 'Line', capacity: 1 }],
    requirementsByBlock: { paint: [{ resourceId: 'line', units: 1 }] },
    changeovers: [{
      id: 'color-setup',
      resourceId: 'line',
      blockId: 'paint',
      stateAttributes: ['color'],
      defaultSeconds: 5,
      sameStateSeconds: 0,
      initialState: '',
    }],
  };
  profile.changeovers![0].initialState = setupStateForJob(profile.jobs[0], profile.changeovers![0]);

  const result = simulateUniversalPolicyTwin(profile, 2);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.deepEqual(result.runs.map(run => run.jobIndex), [0, 2, 1], 'scheduler should keep the same setup state before paying a changeover');
  assert.equal(result.policyStats.totalChangeoverSeconds, 5);
  assert.equal(result.policyStats.changeoverCount, 1);
  assert.equal(result.stats.makespanSeconds, 35);
  assert.equal(result.resourceStats[0].busyUnitSeconds, 35, 'resource utilization must include setup time');
}

{
  const profile: ProcessScenarioProfile = {
    schemaVersion: '1.0',
    id: 'directional-matrix',
    name: 'Directional matrix',
    jobs: [
      { id: 'a', attributes: { state: 'A' } },
      { id: 'b', attributes: { state: 'B' } },
    ],
    blocks: [
      { id: 'op', key: 'op', title: 'Operation', automation: 'automatic', time: { value: 2, unit: 's' }, dependencies: [] },
    ],
    resources: [{ id: 'r', name: 'R', capacity: 1 }],
    requirementsByBlock: { op: [{ resourceId: 'r', units: 1 }] },
    changeovers: [{
      id: 'state', resourceId: 'r', blockId: 'op', stateAttributes: ['state'], defaultSeconds: 10, sameStateSeconds: 0,
    }],
  };
  const policy = profile.changeovers![0];
  const stateA = setupStateForJob(profile.jobs[0], policy);
  const stateB = setupStateForJob(profile.jobs[1], policy);
  policy.initialState = stateA;
  policy.matrixSeconds = { [stateA]: { [stateB]: 7 } };
  const result = simulateUniversalPolicyTwin(profile, 3);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(result.policyStats.totalChangeoverSeconds, 7);
  assert.equal(result.stats.makespanSeconds, 11);
}

{
  const profile: ProcessScenarioProfile = {
    schemaVersion: '1.0', id: 'multi-capacity', name: 'Independent lane setup state',
    jobs: [
      { id: 'a1', attributes: { family: 'A' } },
      { id: 'b1', attributes: { family: 'B' } },
      { id: 'a2', attributes: { family: 'A' } },
      { id: 'b2', attributes: { family: 'B' } },
    ],
    blocks: [{ id: 'op', key: 'op', title: 'Op', automation: 'automatic', time: { value: 10, unit: 's' }, dependencies: [] }],
    resources: [{ id: 'workers', name: 'Workers', capacity: 2 }],
    requirementsByBlock: { op: [{ resourceId: 'workers', units: 1 }] },
    changeovers: [{ id: 'family', resourceId: 'workers', blockId: 'op', stateAttributes: ['family'], defaultSeconds: 3, sameStateSeconds: 0 }],
  };
  const result = simulateUniversalPolicyTwin(profile, 4);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(result.resourceStats[0].peakUnits, 2);
  assert.ok(result.stats.makespanSeconds <= 26, 'two lanes should preserve independent setup states instead of serializing all jobs');
}

console.log('processUniversalSchedulerTest: OK');
