import assert from 'node:assert/strict';
import { GraphProcessBlock } from '../processGraphMath';
import { DigitalTwinOptions } from '../processDigitalTwin';
import { nextResourceAvailableStart } from '../processResourceCalendar';
import {
  generateFailureWindows,
  runReliabilityMonteCarlo,
} from '../processReliability';

const block: GraphProcessBlock[] = [{
  id: 'instrument', key: 'instrument', title: 'Приборный этап', automation: 'automatic',
  time: { value: 60, unit: 's' }, dependencies: [],
}];

const base: DigitalTwinOptions = {
  jobs: 10,
  seed: 1,
  arrivals: { kind: 'fixed', intervalSeconds: 0 },
  resources: [{ id: 'machine', name: 'Анализатор', capacity: 1 }],
  requirementsByBlock: { instrument: [{ resourceId: 'machine', units: 1 }] },
};

{
  const a = generateFailureWindows({
    resourceId: 'machine', mtbfSeconds: 120, mttrSeconds: 30,
    repairDistribution: 'triangular', repairSpreadPercent: 20,
  }, 3600, 42);
  const b = generateFailureWindows({
    resourceId: 'machine', mtbfSeconds: 120, mttrSeconds: 30,
    repairDistribution: 'triangular', repairSpreadPercent: 20,
  }, 3600, 42);
  assert.deepEqual(a, b, 'failure windows must be reproducible by seed');
  assert.ok(a.length > 0);
  assert.ok(a.every(window => window.mode === 'block-start'));
}

{
  const calendar = {
    plannedDowntime: [{ startSeconds: 10, endSeconds: 20, mode: 'block-start' as const }],
  };
  assert.equal(nextResourceAvailableStart(calendar, 0, 15).startSeconds, 0, 'non-preemptive task may continue through a later failure');
  assert.equal(nextResourceAvailableStart(calendar, 12, 1).startSeconds, 20, 'new task cannot start while resource is under repair');
}

{
  const result = runReliabilityMonteCarlo(block, base, {
    iterations: 20,
    seed: 100,
    failurePolicies: [],
  });
  assert.equal(result.ok, true);
  assert.equal(result.addedDelay.p95, 0, 'without failure policies reliability scenario must equal baseline');
  assert.equal(result.makespan.p95, result.baselineMakespan.p95);
}

{
  const options = {
    iterations: 40,
    seed: 2026,
    failurePolicies: [{
      resourceId: 'machine', mtbfSeconds: 90, mttrSeconds: 60,
      repairDistribution: 'fixed' as const,
    }],
    slaMakespanSeconds: 900,
  };
  const a = runReliabilityMonteCarlo(block, base, options);
  const b = runReliabilityMonteCarlo(block, base, options);
  assert.equal(a.ok, true);
  assert.deepEqual(a.makespan, b.makespan, 'same seed must reproduce reliability percentiles');
  assert.deepEqual(a.resourceStats, b.resourceStats);
  assert.ok(a.addedDelay.p95 > 0, 'frequent failures must add delay');
  assert.ok(a.resourceStats[0].meanFailures > 0);
  assert.ok(a.resourceStats[0].meanDowntimeSeconds > 0);
  assert.ok(a.resourceStats[0].meanAvailabilityPercent < 100);
  assert.ok(a.slaProbabilityPercent != null && a.slaProbabilityPercent >= 0 && a.slaProbabilityPercent <= 100);
}

{
  const bad = runReliabilityMonteCarlo(block, base, {
    iterations: 1,
    failurePolicies: [{ resourceId: 'missing', mtbfSeconds: 1, mttrSeconds: 1 }],
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some(error => error.includes('не найден')));
}

console.log('processReliabilityTest: OK');
