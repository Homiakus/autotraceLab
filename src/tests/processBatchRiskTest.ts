import { GraphProcessBlock } from '../processGraphMath';
import { runBatchProcessMonteCarlo } from '../processBatchRisk';
import { ProcessBatchSimulationOptions } from '../processBatchSimulation';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertClose(actual: number, expected: number, message: string): void {
  if (Math.abs(actual - expected) > 1e-9) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

const blocks: GraphProcessBlock[] = [
  { id: 'prep', key: 'prep', title: 'Подготовка', automation: 'manual', time: { value: 1, unit: 'min' }, dependencies: [] },
  { id: 'spin', key: 'spin', title: 'Batch spin', automation: 'automatic', time: { value: 4, unit: 'min' }, dependencies: ['prep'] },
];

const sim: ProcessBatchSimulationOptions = {
  batchSize: 4,
  resources: [
    { id: 'operator', name: 'Оператор', capacity: 1 },
    { id: 'centrifuge', name: 'Центрифуга', capacity: 1 },
  ],
  requirementsByBlock: {
    prep: [{ resourceId: 'operator', units: 1 }],
    spin: [{ resourceId: 'centrifuge', units: 1 }],
  },
  batchConfigs: [{ blockId: 'spin', batchCapacity: 4, minBatchSize: 4, maxWaitSeconds: 600 }],
};

const fixed = runBatchProcessMonteCarlo(blocks, sim, {
  iterations: 20,
  seed: 5,
  uncertaintyByBlock: { prep: { kind: 'fixed' }, spin: { kind: 'fixed' } },
});
assert(fixed.ok, 'fixed batch Monte Carlo should succeed');
assert(fixed.completedIterations === 20, 'all fixed iterations should complete');
assertClose(fixed.makespanSeconds.min, fixed.makespanSeconds.max, 'fixed makespan spread should be zero');
assertClose(fixed.averageBatchFillPercent.p50, 100, 'full batch policy should keep 100% fill');
assertClose(fixed.batchCycles.p50, 1, 'four samples should use one batch cycle');

const variableA = runBatchProcessMonteCarlo(blocks, sim, {
  iterations: 80,
  seed: 1234,
  uncertaintyByBlock: {
    prep: { kind: 'triangular', minFactor: 0.7, modeFactor: 1, maxFactor: 1.4 },
    spin: { kind: 'uniform', minFactor: 0.9, maxFactor: 1.1 },
  },
});
const variableB = runBatchProcessMonteCarlo(blocks, sim, {
  iterations: 80,
  seed: 1234,
  uncertaintyByBlock: {
    prep: { kind: 'triangular', minFactor: 0.7, modeFactor: 1, maxFactor: 1.4 },
    spin: { kind: 'uniform', minFactor: 0.9, maxFactor: 1.1 },
  },
});
assert(variableA.ok && variableB.ok, 'variable batch Monte Carlo should succeed');
assert(variableA.makespanSeconds.max > variableA.makespanSeconds.min, 'uncertainty should create makespan spread');
assertClose(variableA.makespanSeconds.p95, variableB.makespanSeconds.p95, 'same seed should reproduce batch p95');

const sla = runBatchProcessMonteCarlo(blocks, sim, {
  iterations: 30,
  seed: 10,
  slaMakespanSeconds: 3600,
  uncertaintyByBlock: { spin: { kind: 'uniform', minFactor: 0.9, maxFactor: 1.1 } },
});
assert(sla.slaProbabilityPercent === 100, 'generous batch SLA should be met');

console.log('processBatchRiskTest: OK');
