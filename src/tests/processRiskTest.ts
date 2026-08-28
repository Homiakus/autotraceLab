import { GraphProcessBlock } from '../processGraphMath';
import { runProcessMonteCarlo, planNextResourceCapacity } from '../processRisk';
import { ProcessSimulationOptions } from '../processSimulation';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertClose(actual: number, expected: number, message: string): void {
  if (Math.abs(actual - expected) > 1e-9) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

const blocks: GraphProcessBlock[] = [
  { id: 'prep', key: 'prep', title: 'Подготовка', automation: 'manual', time: { value: 1, unit: 'min' }, dependencies: [] },
  { id: 'machine', key: 'machine', title: 'Автомат', automation: 'automatic', time: { value: 4, unit: 'min' }, dependencies: ['prep'] },
];

const simulationOptions: ProcessSimulationOptions = {
  batchSize: 4,
  resources: [
    { id: 'operator', name: 'Оператор', capacity: 2 },
    { id: 'machine', name: 'Автомат', capacity: 1 },
  ],
  requirementsByBlock: {
    prep: [{ resourceId: 'operator', units: 1 }],
    machine: [{ resourceId: 'machine', units: 1 }],
  },
};

const fixed = runProcessMonteCarlo(blocks, simulationOptions, {
  iterations: 20,
  seed: 42,
  uncertaintyByBlock: {
    prep: { kind: 'fixed' },
    machine: { kind: 'fixed' },
  },
});
assert(fixed.ok, 'fixed Monte Carlo should succeed');
assert(fixed.completedIterations === 20, 'all fixed iterations should complete');
assertClose(fixed.makespanSeconds.min, fixed.makespanSeconds.max, 'fixed model should have zero makespan spread');

const variableA = runProcessMonteCarlo(blocks, simulationOptions, {
  iterations: 80,
  seed: 123,
  uncertaintyByBlock: {
    machine: { kind: 'triangular', minFactor: 0.8, modeFactor: 1, maxFactor: 1.25 },
  },
});
const variableB = runProcessMonteCarlo(blocks, simulationOptions, {
  iterations: 80,
  seed: 123,
  uncertaintyByBlock: {
    machine: { kind: 'triangular', minFactor: 0.8, modeFactor: 1, maxFactor: 1.25 },
  },
});
assert(variableA.ok && variableB.ok, 'variable Monte Carlo should succeed');
assert(variableA.makespanSeconds.max > variableA.makespanSeconds.min, 'triangular uncertainty should create spread');
assertClose(variableA.makespanSeconds.p95, variableB.makespanSeconds.p95, 'same seed should reproduce p95');

const withSla = runProcessMonteCarlo(blocks, simulationOptions, {
  iterations: 30,
  seed: 7,
  slaMakespanSeconds: 60 * 60,
  uncertaintyByBlock: { machine: { kind: 'uniform', minFactor: 0.9, maxFactor: 1.1 } },
});
assert(withSla.slaProbabilityPercent === 100, 'generous SLA should be met in all runs');

const planner = planNextResourceCapacity(blocks, simulationOptions);
assert(planner.ok, 'capacity planner should succeed');
assert(planner.bestScenario?.resourceId === 'machine', 'single machine should be the best +1 capacity upgrade');
assert((planner.bestScenario?.throughputGainPercent ?? 0) > 0, 'best scenario should improve throughput');
assert(planner.scenarios.length === 2, 'planner should evaluate each resource');

console.log('processRiskTest: OK');
