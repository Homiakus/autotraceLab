import assert from 'node:assert/strict';
import { GraphProcessBlock } from '../processGraphMath';
import { simulateStochasticDigitalTwin } from '../processDigitalTwin';

const hour = 3600;
const single: GraphProcessBlock[] = [{
  id: 'work', key: 'work', title: 'Работа', automation: 'manual',
  time: { value: 1, unit: 'h' }, dependencies: [],
}];

{
  const result = simulateStochasticDigitalTwin(single, {
    jobs: 1,
    seed: 1,
    arrivals: { kind: 'fixed', intervalSeconds: 0 },
    resources: [{ id: 'operator', name: 'Оператор', capacity: 1 }],
    requirementsByBlock: { work: [{ resourceId: 'operator', units: 1 }] },
    resourceCalendars: {
      operator: {
        cycleSeconds: 24 * hour,
        workingWindows: [{ startOffsetSeconds: 8 * hour, endOffsetSeconds: 17 * hour }],
      },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.runs[0].startSeconds, 8 * hour);
  assert.equal(result.runs[0].finishSeconds, 9 * hour);
  assert.equal(result.runs[0].waitSeconds, 8 * hour);
}

{
  const blocks: GraphProcessBlock[] = [
    { id: 'wait', key: 'wait', title: 'Ожидание', automation: 'wait', time: { value: 16.5, unit: 'h' }, dependencies: [] },
    { id: 'work', key: 'work', title: 'Работа', automation: 'manual', time: { value: 1, unit: 'h' }, dependencies: ['wait'] },
  ];
  const result = simulateStochasticDigitalTwin(blocks, {
    jobs: 1,
    seed: 2,
    resources: [{ id: 'operator', name: 'Оператор', capacity: 1 }],
    requirementsByBlock: { wait: [], work: [{ resourceId: 'operator', units: 1 }] },
    resourceCalendars: {
      operator: {
        cycleSeconds: 24 * hour,
        workingWindows: [{ startOffsetSeconds: 8 * hour, endOffsetSeconds: 17 * hour }],
      },
    },
  });
  assert.equal(result.ok, true);
  const work = result.runs.find(run => run.blockId === 'work')!;
  assert.equal(work.readySeconds, 16.5 * hour);
  assert.equal(work.startSeconds, 32 * hour);
}

{
  const result = simulateStochasticDigitalTwin(single, {
    jobs: 1,
    seed: 3,
    arrivals: { kind: 'fixed', intervalSeconds: 9.5 * hour },
    resources: [{ id: 'operator', name: 'Оператор', capacity: 1 }],
    requirementsByBlock: { work: [{ resourceId: 'operator', units: 1 }] },
    resourceCalendars: {
      operator: {
        cycleSeconds: 24 * hour,
        workingWindows: [{ startOffsetSeconds: 8 * hour, endOffsetSeconds: 17 * hour }],
        plannedDowntime: [{ startSeconds: 10 * hour, endSeconds: 11 * hour }],
      },
    },
  });
  assert.equal(result.ok, true);
  // First job is always released at t=0; use shift + downtime interaction directly:
  assert.equal(result.runs[0].startSeconds, 8 * hour);
}

{
  const twoJobs = simulateStochasticDigitalTwin(single, {
    jobs: 2,
    seed: 4,
    arrivals: { kind: 'fixed', intervalSeconds: 9.5 * hour },
    resources: [{ id: 'operator', name: 'Оператор', capacity: 1 }],
    requirementsByBlock: { work: [{ resourceId: 'operator', units: 1 }] },
    resourceCalendars: {
      operator: {
        cycleSeconds: 24 * hour,
        workingWindows: [{ startOffsetSeconds: 8 * hour, endOffsetSeconds: 17 * hour }],
        plannedDowntime: [{ startSeconds: 10 * hour, endSeconds: 11 * hour }],
      },
    },
  });
  assert.equal(twoJobs.ok, true);
  const second = twoJobs.runs.find(run => run.jobIndex === 1)!;
  assert.equal(second.readySeconds, 9.5 * hour);
  assert.equal(second.startSeconds, 11 * hour, 'planned downtime must push second job after maintenance');
  const operator = twoJobs.resourceStats.find(resource => resource.id === 'operator')!;
  assert.ok(operator.availabilityPercent < 100);
  assert.ok(operator.utilizationPercent > 0 && operator.utilizationPercent <= 100);
}

console.log('processDigitalTwinCalendarTest: OK');
