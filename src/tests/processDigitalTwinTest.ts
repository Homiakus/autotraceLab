import assert from 'node:assert/strict';
import { GraphProcessBlock } from '../processGraphMath';
import { simulateStochasticDigitalTwin } from '../processDigitalTwin';

const blocks: GraphProcessBlock[] = [
  {
    id: 'prep', key: 'prep', title: 'Подготовка', automation: 'manual',
    time: { value: 60, unit: 's' }, dependencies: [],
  },
  {
    id: 'run', key: 'run', title: 'Анализ', automation: 'automatic',
    time: { value: 120, unit: 's' }, dependencies: ['prep'],
  },
];

const resources = [
  { id: 'operator', name: 'Оператор', capacity: 1 },
  { id: 'instrument', name: 'Прибор', capacity: 1 },
];

const requirementsByBlock = {
  prep: [{ resourceId: 'operator', units: 1 }],
  run: [{ resourceId: 'instrument', units: 1 }],
};

{
  const result = simulateStochasticDigitalTwin(blocks, {
    jobs: 3,
    seed: 1,
    arrivals: { kind: 'fixed', intervalSeconds: 0 },
    resources,
    requirementsByBlock,
  });
  assert.equal(result.ok, true);
  assert.equal(result.jobs.length, 3);
  assert.equal(result.runs.length, 6);
  assert.equal(result.stats.totalReworkRuns, 0);
  assert.ok(result.stats.makespanSeconds >= 420);
}

{
  const result = simulateStochasticDigitalTwin(blocks, {
    jobs: 1,
    seed: 2,
    resources,
    requirementsByBlock,
    reworkByBlock: { run: { probability: 1, maxRepeats: 1 } },
  });
  assert.equal(result.ok, true);
  const analysisRuns = result.runs.filter(run => run.blockId === 'run');
  assert.equal(analysisRuns.length, 2);
  assert.equal(analysisRuns[0].reworkTriggered, true);
  assert.equal(analysisRuns[1].reworkTriggered, false);
  assert.equal(result.stats.totalReworkRuns, 1);
}

{
  const result = simulateStochasticDigitalTwin(blocks, {
    jobs: 12,
    seed: 42,
    arrivals: { kind: 'fixed', intervalSeconds: 0 },
    resources,
    requirementsByBlock,
    uncertaintyByBlock: {
      prep: { kind: 'triangular', minFactor: 0.5, modeFactor: 1, maxFactor: 1.5 },
    },
  });
  assert.equal(result.ok, true);
  const durations = new Set(result.runs.filter(run => run.blockId === 'prep').map(run => Math.round(run.durationSeconds * 1000)));
  assert.ok(durations.size > 1, 'per-sample uncertainty must create different task durations');
}

{
  const a = simulateStochasticDigitalTwin(blocks, {
    jobs: 8,
    seed: 12345,
    arrivals: { kind: 'poisson', meanIntervalSeconds: 30 },
    resources,
    requirementsByBlock,
    uncertaintyByBlock: { prep: { kind: 'uniform', minFactor: 0.8, maxFactor: 1.2 } },
  });
  const b = simulateStochasticDigitalTwin(blocks, {
    jobs: 8,
    seed: 12345,
    arrivals: { kind: 'poisson', meanIntervalSeconds: 30 },
    resources,
    requirementsByBlock,
    uncertaintyByBlock: { prep: { kind: 'uniform', minFactor: 0.8, maxFactor: 1.2 } },
  });
  assert.deepEqual(
    a.jobs.map(job => [job.releaseSeconds, job.completionSeconds]),
    b.jobs.map(job => [job.releaseSeconds, job.completionSeconds]),
  );
}

{
  const priorityBlocks: GraphProcessBlock[] = [{
    id: 'single', key: 'single', title: 'Один ресурс', automation: 'manual',
    time: { value: 100, unit: 's' }, dependencies: [],
  }];
  const result = simulateStochasticDigitalTwin(priorityBlocks, {
    jobs: 3,
    seed: 7,
    arrivals: { kind: 'fixed', intervalSeconds: 10 },
    resources: [{ id: 'operator', name: 'Оператор', capacity: 1 }],
    requirementsByBlock: { single: [{ resourceId: 'operator', units: 1 }] },
    priority: { priorityByJob: { 2: 100 }, routinePriority: 0 },
  });
  assert.equal(result.ok, true);
  const ordered = [...result.runs].sort((a, b) => a.startSeconds - b.startSeconds);
  assert.equal(ordered[0].jobIndex, 0);
  assert.equal(ordered[1].jobIndex, 2, 'STAT job should win the next non-preemptive slot');
  assert.equal(ordered[2].jobIndex, 1);
}

console.log('processDigitalTwinTest: OK');
