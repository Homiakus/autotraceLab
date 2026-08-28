import assert from 'node:assert/strict';
import {
  createBlankProcessSimulationScenario,
  migrateLegacyResourceSimulationModel,
  planUniversalResourceCapacity,
  resizeSimulationJobs,
  runUniversalProcessMonteCarlo,
  setSymmetricBlockUncertainty,
  symmetricUncertainty,
  uncertaintyPercent,
} from '../process/index';
import { runProcessMonteCarlo } from '../processRisk';

{
  const legacy = {
    name: 'Risk parity',
    batchSize: 3,
    releaseIntervalSeconds: 2,
    blocks: [
      { id: 'a', key: 'a', title: 'A', automation: 'automatic' as const, time: { value: 10, unit: 's' as const }, dependencies: [] },
      { id: 'b', key: 'b', title: 'B', automation: 'qc' as const, time: { value: 5, unit: 's' as const }, dependencies: ['a'] },
    ],
    resources: [
      { id: 'machine', name: 'Machine', capacity: 1 },
      { id: 'qc', name: 'QC', capacity: 1 },
    ],
    requirementsByBlock: {
      a: [{ resourceId: 'machine', units: 1 }],
      b: [{ resourceId: 'qc', units: 1 }],
    },
  };
  const oldResult = runProcessMonteCarlo(legacy.blocks, {
    batchSize: legacy.batchSize,
    releaseIntervalSeconds: legacy.releaseIntervalSeconds,
    resources: legacy.resources,
    requirementsByBlock: legacy.requirementsByBlock,
  }, {
    iterations: 5,
    seed: 123,
    uncertaintyByBlock: { a: { kind: 'fixed' }, b: { kind: 'fixed' } },
    slaMakespanSeconds: 100,
  });
  const profile = migrateLegacyResourceSimulationModel(legacy);
  profile.uncertaintyByBlock = { a: { kind: 'fixed' }, b: { kind: 'fixed' } };
  const universal = runUniversalProcessMonteCarlo(profile, { iterations: 5, seed: 123, slaMakespanSeconds: 100 });
  assert.equal(oldResult.ok, true, oldResult.errors.join('; '));
  assert.equal(universal.ok, true, universal.errors.join('; '));
  assert.deepEqual(universal.makespanSeconds, oldResult.makespanSeconds);
  assert.deepEqual(universal.averageCycleSeconds, oldResult.averageCycleSeconds);
  assert.deepEqual(universal.throughputPerHour, oldResult.throughputPerHour);
  assert.deepEqual(universal.averageWaitSeconds, oldResult.averageWaitSeconds);
  assert.equal(universal.slaProbabilityPercent, oldResult.slaProbabilityPercent);
}

{
  let profile = resizeSimulationJobs(createBlankProcessSimulationScenario(), 3);
  profile.jobs[0].attributes = { family: 'A' };
  profile.jobs[1].attributes = { family: 'B' };
  profile.jobs[2].attributes = { family: 'A' };
  profile.changeovers = [{
    id: 'family-setup',
    resourceId: 'machine',
    blockId: 'processing',
    stateAttributes: ['family'],
    defaultSeconds: 7,
    sameStateSeconds: 0,
  }];
  profile.retryByBlock = { processing: { probability: 1, maxRepeats: 1 } };
  profile = setSymmetricBlockUncertainty(profile, 'processing', 20);

  const first = runUniversalProcessMonteCarlo(profile, { iterations: 20, seed: 999 });
  const second = runUniversalProcessMonteCarlo(profile, { iterations: 20, seed: 999 });
  assert.equal(first.ok, true, first.errors.join('; '));
  assert.deepEqual(first, second, 'same profile + seed must reproduce the same Monte Carlo distribution');
  assert.ok(first.changeoverSeconds.p95 > 0, 'universal risk must include sequence-dependent setup time');
  assert.ok(first.reworkRatePercent.p50 > 0, 'universal risk must include retry/rework policy');
  assert.ok(first.makespanSeconds.max > first.makespanSeconds.min, 'stochastic duration must produce a non-degenerate distribution');
}

{
  const fixed = symmetricUncertainty(0);
  const spread = symmetricUncertainty(15);
  assert.equal(fixed.kind, 'fixed');
  assert.equal(spread.kind, 'triangular');
  assert.equal(Math.round(uncertaintyPercent(spread)), 15);
}

{
  let profile = resizeSimulationJobs(createBlankProcessSimulationScenario(), 10);
  profile.uncertaintyByBlock = Object.fromEntries(profile.blocks.map(block => [block.id, { kind: 'fixed' as const }]));
  const plan = planUniversalResourceCapacity(profile, 77);
  assert.equal(plan.ok, true, plan.errors.join('; '));
  assert.equal(plan.scenarios.length, profile.resources.length);
  assert.ok(plan.bestScenario);
  assert.ok(plan.scenarios.every(item => item.candidateCapacity === item.baselineCapacity + 1));
}

console.log('processUniversalRiskV2Test: OK');
