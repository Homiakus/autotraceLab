import { GraphProcessBlock } from '../processGraphMath';
import { simulateResourceConstrainedProcess } from '../processSimulation';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertClose(actual: number | null | undefined, expected: number, message: string): void {
  if (actual == null || Math.abs(actual - expected) > 1e-9) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

const serialBlocks: GraphProcessBlock[] = [
  { id: 'prep', key: 'prep', title: 'Подготовка', automation: 'manual', time: { value: 1, unit: 'min' }, dependencies: [] },
  { id: 'machine', key: 'machine', title: 'Автомат', automation: 'automatic', time: { value: 2, unit: 'min' }, dependencies: ['prep'] },
];

const singleOperator = simulateResourceConstrainedProcess(serialBlocks, {
  batchSize: 2,
  resources: [
    { id: 'operator', name: 'Оператор', capacity: 1 },
    { id: 'machine', name: 'Автомат', capacity: 1 },
  ],
  requirementsByBlock: {
    prep: [{ resourceId: 'operator', units: 1 }],
    machine: [{ resourceId: 'machine', units: 1 }],
  },
});

assert(singleOperator.ok, 'single-resource simulation should succeed');
assertClose(singleOperator.stats.makespanSeconds, 300, 'two jobs should pipeline to five minutes');
assertClose(singleOperator.jobs[0].completionSeconds, 180, 'first completion');
assertClose(singleOperator.jobs[1].completionSeconds, 300, 'second completion');
assertClose(singleOperator.stats.outputRatePerHour, 30, 'steady output rate');
assert(singleOperator.resourceStats.find(item => item.id === 'machine')?.utilizationPercent === 80, 'machine utilization should be 80%');

const machineCapacityTwo = simulateResourceConstrainedProcess(serialBlocks, {
  batchSize: 2,
  resources: [
    { id: 'operator', name: 'Оператор', capacity: 2 },
    { id: 'machine', name: 'Автомат', capacity: 2 },
  ],
  requirementsByBlock: {
    prep: [{ resourceId: 'operator', units: 1 }],
    machine: [{ resourceId: 'machine', units: 1 }],
  },
});
assert(machineCapacityTwo.ok, 'capacity-two simulation should succeed');
assertClose(machineCapacityTwo.stats.makespanSeconds, 180, 'two parallel jobs should finish in three minutes');

const branchBlocks: GraphProcessBlock[] = [
  { id: 'start', key: 'start', title: 'Старт', automation: 'manual', time: { value: 1, unit: 'min' }, dependencies: [] },
  { id: 'a', key: 'a', title: 'Ветка A', automation: 'automatic', time: { value: 4, unit: 'min' }, dependencies: ['start'] },
  { id: 'b', key: 'b', title: 'Ветка B', automation: 'automatic', time: { value: 3, unit: 'min' }, dependencies: ['start'] },
  { id: 'join', key: 'join', title: 'Слияние', automation: 'qc', time: { value: 1, unit: 'min' }, dependencies: ['a', 'b'] },
];

const branch = simulateResourceConstrainedProcess(branchBlocks, {
  batchSize: 1,
  resources: [
    { id: 'operator', name: 'Оператор', capacity: 1 },
    { id: 'a_machine', name: 'A', capacity: 1 },
    { id: 'b_machine', name: 'B', capacity: 1 },
  ],
  requirementsByBlock: {
    start: [{ resourceId: 'operator', units: 1 }],
    a: [{ resourceId: 'a_machine', units: 1 }],
    b: [{ resourceId: 'b_machine', units: 1 }],
    join: [{ resourceId: 'operator', units: 1 }],
  },
});
assert(branch.ok, 'branched simulation should succeed');
assertClose(branch.stats.makespanSeconds, 360, 'parallel branches should use longest branch');

const releaseGap = simulateResourceConstrainedProcess([
  { id: 'only', key: 'only', title: 'Операция', automation: 'automatic', time: { value: 1, unit: 'min' }, dependencies: [] },
], {
  batchSize: 3,
  releaseIntervalSeconds: 120,
  resources: [{ id: 'machine', name: 'Автомат', capacity: 1 }],
  requirementsByBlock: { only: [{ resourceId: 'machine', units: 1 }] },
});
assert(releaseGap.ok, 'release-gap simulation should succeed');
assertClose(releaseGap.stats.makespanSeconds, 300, 'third job released at four minutes and finishes at five');
assertClose(releaseGap.jobs[2].cycleSeconds, 60, 'release gap should not inflate per-job cycle time');

const impossible = simulateResourceConstrainedProcess(serialBlocks, {
  batchSize: 1,
  resources: [{ id: 'machine', name: 'Автомат', capacity: 1 }],
  requirementsByBlock: { machine: [{ resourceId: 'machine', units: 2 }] },
});
assert(!impossible.ok, 'requirements above capacity should fail');
assert(impossible.errors.some(error => error.includes('доступно 1')), 'capacity error should be explicit');

console.log('processSimulationTest: OK');
