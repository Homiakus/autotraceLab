import assert from 'node:assert/strict';
import { GraphProcessBlock } from '../processGraphMath';
import { optimizeUnifiedBatchPolicy } from '../processUnifiedOptimizer';

const blocks: GraphProcessBlock[] = [{
  id: 'spin',
  key: 'spin',
  title: 'Spin',
  automation: 'automatic',
  time: { value: 1, unit: 's' },
  dependencies: [],
}];

const twin = {
  jobs: 4,
  seed: 123,
  arrivals: { kind: 'fixed' as const, intervalSeconds: 100 },
  resources: [{ id: 'centrifuge', name: 'Centrifuge', capacity: 1 }],
  requirementsByBlock: { spin: [{ resourceId: 'centrifuge', units: 1 }] },
  batchConfigs: [{ blockId: 'spin', batchCapacity: 4, minBatchSize: 1, maxWaitSeconds: 0 }],
};

{
  const result = optimizeUnifiedBatchPolicy(blocks, twin, {
    searches: [{ blockId: 'spin', minBatchValues: [1, 4], maxWaitValuesSeconds: [0, 400] }],
    weights: { throughput: 0, p95Cycle: 0, averageWait: 0, batchFill: 1, partialCycles: 0, sla: 0 },
  });
  assert.equal(result.ok, true);
  assert.equal(result.scenarios.length, 4);
  assert.ok(result.best);
  assert.equal(result.best!.configs[0].minBatchSize, 4, 'fill-only objective should prefer a full rotor policy');
  assert.ok(result.best!.simulation.stats.averageBatchFillPercent >= 99.9);
  assert.ok(result.pareto.length >= 1);
}

{
  const result = optimizeUnifiedBatchPolicy(blocks, twin, {
    searches: [{ blockId: 'spin', minBatchValues: [1, 4], maxWaitValuesSeconds: [0, 400] }],
    weights: { throughput: 0, p95Cycle: 1, averageWait: 0, batchFill: 0, partialCycles: 0, sla: 0 },
  });
  assert.equal(result.ok, true);
  assert.ok(result.best);
  assert.equal(result.best!.configs[0].minBatchSize, 1, 'cycle-time objective should avoid waiting for a remote future sample');
}

{
  const a = optimizeUnifiedBatchPolicy(blocks, twin, {
    searches: [{ blockId: 'spin', minBatchValues: [1, 2, 4], maxWaitValuesSeconds: [0, 100, 400] }],
    slaP95CycleSeconds: 150,
  });
  const b = optimizeUnifiedBatchPolicy(blocks, twin, {
    searches: [{ blockId: 'spin', minBatchValues: [1, 2, 4], maxWaitValuesSeconds: [0, 100, 400] }],
    slaP95CycleSeconds: 150,
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.best?.score, b.best?.score);
  assert.deepEqual(a.best?.configs, b.best?.configs, 'same seed/search must produce same optimizer ranking');
  assert.ok(a.scenarios.some(item => item.slaMet === true));
}

{
  const result = optimizeUnifiedBatchPolicy(blocks, { ...twin, batchConfigs: [] }, {
    searches: [{ blockId: 'spin' }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('Нет batch-блоков')));
}

console.log('processUnifiedOptimizerTest: OK');
