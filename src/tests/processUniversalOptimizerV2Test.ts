import assert from 'node:assert/strict';
import { ProcessScenarioProfile, optimizeUniversalBatchPolicy, simulateUniversalScenario } from '../process/index';
import { optimizeUnifiedBatchPolicy } from '../processUnifiedOptimizer';

function baseProfile(): ProcessScenarioProfile {
  return {
    schemaVersion: '1.0',
    id: 'optimizer-v2',
    name: 'Optimizer v2',
    jobs: Array.from({ length: 6 }, (_, index) => ({ id: `job-${index + 1}` })),
    blocks: [{ id: 'batch', key: 'batch', title: 'Batch', automation: 'automatic', time: { value: 10, unit: 's' }, dependencies: [] }],
    resources: [{ id: 'machine', name: 'Machine', capacity: 1 }],
    requirementsByBlock: { batch: [{ resourceId: 'machine', units: 1 }] },
    arrivals: { kind: 'fixed', intervalSeconds: 1 },
    batchPolicies: [{ blockId: 'batch', batchCapacity: 3, minBatchSize: 1, maxWaitSeconds: 0 }],
  };
}

{
  const profile = baseProfile();
  const search = [{ blockId: 'batch', minBatchValues: [1, 3], maxWaitValuesSeconds: [0, 5] }];
  const universal = optimizeUniversalBatchPolicy(profile, { searches: search, seed: 5, maxScenarios: 20, slaP95CycleSeconds: 60 });
  const legacy = optimizeUnifiedBatchPolicy(profile.blocks, {
    jobs: profile.jobs.length,
    seed: 5,
    arrivals: profile.arrivals,
    resources: profile.resources,
    requirementsByBlock: profile.requirementsByBlock,
    batchConfigs: profile.batchPolicies,
  }, { searches: search, maxScenarios: 20, slaP95CycleSeconds: 60 });

  assert.equal(universal.ok, true, universal.errors.join('; '));
  assert.equal(legacy.ok, true, legacy.errors.join('; '));
  assert.equal(universal.generatedScenarios, legacy.generatedScenarios);
  assert.equal(universal.evaluatedScenarios, legacy.evaluatedScenarios);
  assert.deepEqual(universal.best?.configs, legacy.best?.configs, 'legacy-compatible best policy must remain stable');
  assert.equal(universal.best?.simulation.stats.p95CycleSeconds, legacy.best?.simulation.stats.p95CycleSeconds);
  assert.equal(universal.best?.simulation.stats.averageBatchFillPercent, legacy.best?.simulation.stats.averageBatchFillPercent);

  const baseline = simulateUniversalScenario(profile, 5);
  assert.equal(universal.baseline.stats.makespanSeconds, baseline.stats.makespanSeconds);
}

{
  const profile = baseProfile();
  profile.jobs = [
    { id: 'a1', attributes: { family: 'A' } },
    { id: 'a2', attributes: { family: 'A' } },
    { id: 'b1', attributes: { family: 'B' } },
    { id: 'b2', attributes: { family: 'B' } },
  ];
  profile.compatibility = [{
    id: 'family',
    blockIds: ['batch'],
    rules: [{ blockId: 'batch', attribute: 'family', mode: 'same', missingValue: 'reject' }],
  }];
  profile.changeovers = [{ id: 'family-setup', resourceId: 'machine', blockId: 'batch', stateAttributes: ['family'], defaultSeconds: 3 }];
  profile.objectives = [{ id: 'cycle', metric: 'p95CycleSeconds', goal: 'minimize', weight: 1 }];

  const result = optimizeUniversalBatchPolicy(profile, {
    searches: [{ blockId: 'batch', minBatchValues: [1, 2], maxWaitValuesSeconds: [0, 5] }],
    seed: 7,
    maxScenarios: 20,
  });
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.ok(result.best);
  assert.ok(result.pareto.length > 0);
  assert.ok(result.scenarios.every(item => JSON.stringify(item.profile.compatibility) === JSON.stringify(profile.compatibility)));
  assert.ok(result.scenarios.every(item => JSON.stringify(item.profile.changeovers) === JSON.stringify(profile.changeovers)));
  assert.ok(result.scenarios.every(item => item.profile.resources[0].capacity === profile.resources[0].capacity));
  assert.ok(result.scenarios.every(item => Number.isFinite(item.objectiveScore)));
}

{
  const profile = baseProfile();
  profile.batchPolicies = [];
  const result = optimizeUniversalBatchPolicy(profile, { searches: [{ blockId: 'batch' }] });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => /No batch policies/.test(error)));
}

console.log('processUniversalOptimizerV2Test: OK');
