import assert from 'node:assert/strict';
import { GraphProcessBlock } from '../processGraphMath';
import { simulateUnifiedStochasticBatchTwin } from '../processUnifiedTwin';

const block = (
  id: string,
  seconds: number,
  dependencies: string[] = [],
): GraphProcessBlock => ({
  id,
  key: id,
  title: id,
  automation: 'automatic',
  time: { value: seconds, unit: 's' },
  dependencies,
});

{
  const blocks = [block('prep', 1), block('spin', 10, ['prep']), block('qc', 1, ['spin'])];
  const result = simulateUnifiedStochasticBatchTwin(blocks, {
    jobs: 4,
    seed: 1,
    resources: [
      { id: 'operator', name: 'Operator', capacity: 1 },
      { id: 'centrifuge', name: 'Centrifuge', capacity: 1 },
      { id: 'qc', name: 'QC', capacity: 1 },
    ],
    requirementsByBlock: {
      prep: [{ resourceId: 'operator', units: 1 }],
      spin: [{ resourceId: 'centrifuge', units: 1 }],
      qc: [{ resourceId: 'qc', units: 1 }],
    },
    batchConfigs: [{ blockId: 'spin', batchCapacity: 4, minBatchSize: 4, maxWaitSeconds: 100 }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.batchCycles.length, 1, 'four ready samples must share one centrifuge cycle');
  assert.equal(result.batchCycles[0].jobIndexes.length, 4);
  assert.equal(result.batchCycles[0].fillPercent, 100);
  assert.equal(result.resourceStats.find(item => item.id === 'centrifuge')?.busyUnitSeconds, 10, 'batch reserves centrifuge once, not once per sample');
}

{
  const result = simulateUnifiedStochasticBatchTwin([block('process', 100)], {
    jobs: 4,
    seed: 42,
    resources: [{ id: 'machine', name: 'Machine', capacity: 4 }],
    requirementsByBlock: { process: [{ resourceId: 'machine', units: 1 }] },
    uncertaintyByBlock: { process: { kind: 'uniform', minFactor: 0.5, maxFactor: 1.5 } },
  });
  assert.equal(result.ok, true);
  const durations = result.runs.map(run => run.durationSeconds);
  assert.ok(new Set(durations.map(value => value.toFixed(6))).size > 1, 'per-sample stochastic durations must differ');
}

{
  const result = simulateUnifiedStochasticBatchTwin([block('spin', 10)], {
    jobs: 2,
    seed: 7,
    resources: [{ id: 'centrifuge', name: 'Centrifuge', capacity: 1 }],
    requirementsByBlock: { spin: [{ resourceId: 'centrifuge', units: 1 }] },
    batchConfigs: [{ blockId: 'spin', batchCapacity: 2, minBatchSize: 2, maxWaitSeconds: 0 }],
    reworkByBlock: { spin: { probability: 1, maxRepeats: 1 } },
  });
  assert.equal(result.ok, true);
  assert.equal(result.batchCycles.length, 2, 'both samples must re-enter a second shared batch cycle');
  assert.equal(result.runs.length, 4);
  assert.equal(result.runs.filter(run => run.attempt === 2).length, 2);
  assert.equal(result.stats.totalReworkRuns, 2);
}

{
  const result = simulateUnifiedStochasticBatchTwin([block('spin', 10)], {
    jobs: 3,
    seed: 11,
    resources: [{ id: 'centrifuge', name: 'Centrifuge', capacity: 1 }],
    requirementsByBlock: { spin: [{ resourceId: 'centrifuge', units: 1 }] },
    batchConfigs: [{ blockId: 'spin', batchCapacity: 2, minBatchSize: 2, maxWaitSeconds: 0 }],
    priority: { statEveryN: 3, statPriority: 100, routinePriority: 0 },
  });
  assert.equal(result.ok, true);
  assert.ok(result.batchCycles[0].jobIndexes.includes(2), 'STAT sample must be selected into the first eligible batch');
}

{
  const hour = 3600;
  const result = simulateUnifiedStochasticBatchTwin([block('spin', hour)], {
    jobs: 2,
    seed: 5,
    resources: [{ id: 'centrifuge', name: 'Centrifuge', capacity: 1 }],
    requirementsByBlock: { spin: [{ resourceId: 'centrifuge', units: 1 }] },
    batchConfigs: [{ blockId: 'spin', batchCapacity: 2, minBatchSize: 2, maxWaitSeconds: 0 }],
    resourceCalendars: {
      centrifuge: {
        cycleSeconds: 24 * hour,
        workingWindows: [{ startOffsetSeconds: 8 * hour, endOffsetSeconds: 17 * hour }],
      },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.batchCycles[0].startSeconds, 8 * hour, 'batch cycle must wait for the equipment working window');
}

{
  const baseline = simulateUnifiedStochasticBatchTwin([block('process', 10)], {
    jobs: 3,
    seed: 91,
    arrivals: { kind: 'fixed', intervalSeconds: 1 },
    resources: [{ id: 'machine', name: 'Machine', capacity: 1 }],
    requirementsByBlock: { process: [{ resourceId: 'machine', units: 1 }] },
  });
  const failed = simulateUnifiedStochasticBatchTwin([block('process', 10)], {
    jobs: 3,
    seed: 91,
    arrivals: { kind: 'fixed', intervalSeconds: 1 },
    resources: [{ id: 'machine', name: 'Machine', capacity: 1 }],
    requirementsByBlock: { process: [{ resourceId: 'machine', units: 1 }] },
    failurePolicies: [{ resourceId: 'machine', mtbfSeconds: 0.1, mttrSeconds: 100, repairDistribution: 'fixed' }],
  });
  assert.equal(baseline.ok, true);
  assert.equal(failed.ok, true);
  assert.ok((failed.resourceStats[0]?.generatedFailureWindows || 0) > 0);
  assert.ok(failed.stats.makespanSeconds > baseline.stats.makespanSeconds, 'frequent failures must delay the same workload');
}

console.log('processUnifiedTwinTest: OK');
