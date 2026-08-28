import assert from 'node:assert/strict';
import {
  ProcessScenarioProfile,
  failurePolicyForResource,
  runUniversalReliabilityMonteCarlo,
  setResourceFailurePolicy,
} from '../process/index';

function profile(): ProcessScenarioProfile {
  return {
    schemaVersion: '1.0',
    id: 'reliability-v2',
    name: 'Reliability v2',
    jobs: Array.from({ length: 12 }, (_, index) => ({ id: `job-${index + 1}` })),
    blocks: [{ id: 'work', key: 'work', title: 'Work', automation: 'automatic', time: { value: 10, unit: 's' }, dependencies: [] }],
    resources: [{ id: 'machine', name: 'Machine', capacity: 1 }],
    requirementsByBlock: { work: [{ resourceId: 'machine', units: 1 }] },
    arrivals: { kind: 'fixed', intervalSeconds: 1 },
    uncertaintyByBlock: { work: { kind: 'triangular', minFactor: 0.9, modeFactor: 1, maxFactor: 1.1 } },
  };
}

{
  const base = profile();
  const result = runUniversalReliabilityMonteCarlo(base, { iterations: 20, seed: 42 });
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(result.addedDelaySeconds.min, 0);
  assert.equal(result.addedDelaySeconds.max, 0);
  assert.equal(result.makespanSeconds.p50, result.baselineMakespanSeconds.p50);
  assert.equal(result.resourceStats[0]?.meanFailureWindows, 0);
}

{
  let value = profile();
  value = setResourceFailurePolicy(value, 'machine', {
    enabled: true,
    mtbfSeconds: 2,
    mttrSeconds: 5,
    repairDistribution: 'fixed',
    repairSpreadPercent: 0,
  });
  const stored = failurePolicyForResource(value, 'machine');
  assert.ok(stored);
  assert.equal(stored?.mtbfSeconds, 2);
  assert.equal(stored?.mttrSeconds, 5);

  const first = runUniversalReliabilityMonteCarlo(value, { iterations: 30, seed: 99 });
  const second = runUniversalReliabilityMonteCarlo(value, { iterations: 30, seed: 99 });
  assert.equal(first.ok, true, first.errors.join('; '));
  assert.deepEqual(first.makespanSeconds, second.makespanSeconds, 'same profile and seed must be reproducible');
  assert.ok((first.resourceStats[0]?.meanFailureWindows || 0) > 0, 'aggressive MTBF must generate failure windows');
  assert.ok((first.resourceStats[0]?.meanAvailabilityPercent || 100) < 100, 'failure windows must reduce availability');
  assert.ok(first.addedDelaySeconds.max >= 0);
  assert.equal(first.completedIterations, 30);

  value = setResourceFailurePolicy(value, 'machine', {
    enabled: false,
    mtbfSeconds: 2,
    mttrSeconds: 5,
  });
  assert.equal(failurePolicyForResource(value, 'machine'), undefined);
}

{
  assert.throws(() => setResourceFailurePolicy(profile(), 'missing', { enabled: true, mtbfSeconds: 1, mttrSeconds: 1 }), /Unknown resource/);
}

console.log('processUniversalReliabilityV2Test: OK');
