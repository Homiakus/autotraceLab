import { GraphProcessBlock } from '../processGraphMath';
import { simulateBatchCycleProcess } from '../processBatchSimulation';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertClose(actual: number | null | undefined, expected: number, message: string): void {
  if (actual == null || Math.abs(actual - expected) > 1e-9) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

const oneBatchBlock: GraphProcessBlock[] = [
  { id: 'spin', key: 'spin', title: 'Центрифуга', automation: 'automatic', time: { value: 10, unit: 'min' }, dependencies: [] },
];

const fullBasket = simulateBatchCycleProcess(oneBatchBlock, {
  batchSize: 4,
  resources: [{ id: 'centrifuge', name: 'Центрифуга', capacity: 1 }],
  requirementsByBlock: { spin: [{ resourceId: 'centrifuge', units: 1 }] },
  batchConfigs: [{ blockId: 'spin', batchCapacity: 4, minBatchSize: 4, maxWaitSeconds: 0 }],
});
assert(fullBasket.ok, 'full basket simulation should succeed');
assert(fullBasket.batchCycles.length === 1, 'four jobs should share one cycle');
assertClose(fullBasket.stats.makespanSeconds, 600, 'full basket should finish in one ten-minute cycle');
assertClose(fullBasket.stats.averageBatchFillPercent, 100, 'full basket fill should be 100%');
assertClose(fullBasket.resourceStats[0].busyUnitSeconds, 600, 'resource must be reserved once, not once per sample');

const partialBasket = simulateBatchCycleProcess(oneBatchBlock, {
  batchSize: 5,
  resources: [{ id: 'centrifuge', name: 'Центрифуга', capacity: 1 }],
  requirementsByBlock: { spin: [{ resourceId: 'centrifuge', units: 1 }] },
  batchConfigs: [{ blockId: 'spin', batchCapacity: 4, minBatchSize: 1, maxWaitSeconds: 0 }],
});
assert(partialBasket.ok, 'partial basket simulation should succeed');
assert(partialBasket.batchCycles.length === 2, 'five jobs with capacity four require two cycles');
assertClose(partialBasket.stats.makespanSeconds, 1200, 'two serial cycles should take twenty minutes');
assertClose(partialBasket.stats.averageBatchFillPercent, 62.5, 'fills 100% and 25% average to 62.5%');
assert(partialBasket.stats.partialBatchCycles === 1, 'one cycle should be partial');

const releasePolicy = simulateBatchCycleProcess([
  { id: 'batch', key: 'batch', title: 'Batch station', automation: 'automatic', time: { value: 1, unit: 'min' }, dependencies: [] },
], {
  batchSize: 3,
  releaseIntervalSeconds: 60,
  resources: [{ id: 'station', name: 'Station', capacity: 1 }],
  requirementsByBlock: { batch: [{ resourceId: 'station', units: 1 }] },
  batchConfigs: [{ blockId: 'batch', batchCapacity: 3, minBatchSize: 2, maxWaitSeconds: 120 }],
});
assert(releasePolicy.ok, 'release policy simulation should succeed');
assert(releasePolicy.batchCycles.length === 2, 'first two jobs batch together, third leaves on timeout');
assertClose(releasePolicy.batchCycles[0].startSeconds, 60, 'first batch waits for the second sample');
assertClose(releasePolicy.batchCycles[0].finishSeconds, 120, 'first cycle duration');
assertClose(releasePolicy.batchCycles[1].startSeconds, 240, 'last sample waits max 120 seconds after release at 120');
assertClose(releasePolicy.stats.makespanSeconds, 300, 'second cycle finishes at five minutes');

const pipelineBlocks: GraphProcessBlock[] = [
  { id: 'prep', key: 'prep', title: 'Подготовка', automation: 'manual', time: { value: 1, unit: 'min' }, dependencies: [] },
  { id: 'spin', key: 'spin', title: 'Центрифуга', automation: 'automatic', time: { value: 2, unit: 'min' }, dependencies: ['prep'] },
  { id: 'qc', key: 'qc', title: 'QC', automation: 'qc', time: { value: 30, unit: 's' }, dependencies: ['spin'] },
];
const pipeline = simulateBatchCycleProcess(pipelineBlocks, {
  batchSize: 4,
  resources: [
    { id: 'operator', name: 'Оператор', capacity: 1 },
    { id: 'centrifuge', name: 'Центрифуга', capacity: 1 },
    { id: 'qc', name: 'QC', capacity: 1 },
  ],
  requirementsByBlock: {
    prep: [{ resourceId: 'operator', units: 1 }],
    spin: [{ resourceId: 'centrifuge', units: 1 }],
    qc: [{ resourceId: 'qc', units: 1 }],
  },
  batchConfigs: [{ blockId: 'spin', batchCapacity: 4, minBatchSize: 4, maxWaitSeconds: 600 }],
});
assert(pipeline.ok, 'upstream pipeline should feed a synchronized batch');
assert(pipeline.batchCycles.length === 1, 'all four prepared samples should share one centrifuge cycle');
assertClose(pipeline.batchCycles[0].startSeconds, 240, 'single operator prepares four samples in four minutes before batch starts');
assertClose(pipeline.batchCycles[0].finishSeconds, 360, 'centrifuge finishes two minutes later');

console.log('processBatchSimulationTest: OK');
