import assert from 'node:assert/strict';
import {
  ProcessScenarioProfile,
  evaluateDigitalTwinReadiness,
  retryPercent,
  setDailyResourceSchedule,
  setPeriodicJobPriority,
  setProcessArrival,
  setProcessRetry,
  simulateUniversalScenario,
} from '../process/index';
import { simulateStochasticDigitalTwin } from '../processDigitalTwin';

function baseProfile(jobCount = 2): ProcessScenarioProfile {
  return {
    schemaVersion: '1.0',
    id: 'digital-twin-v2-test',
    name: 'Digital Twin v2 test',
    jobs: Array.from({ length: jobCount }, (_, index) => ({ id: `job-${index + 1}`, priority: 0 })),
    blocks: [{
      id: 'work',
      key: 'work',
      title: 'Work',
      automation: 'automatic',
      time: { value: 10, unit: 's' },
      dependencies: [],
    }],
    resources: [{ id: 'machine', name: 'Machine', capacity: 1 }],
    requirementsByBlock: { work: [{ resourceId: 'machine', units: 1 }] },
    arrivals: { kind: 'fixed', intervalSeconds: 0 },
    uncertaintyByBlock: { work: { kind: 'fixed' } },
  };
}

{
  const profile = baseProfile(3);
  const legacy = simulateStochasticDigitalTwin(profile.blocks, {
    jobs: profile.jobs.length,
    seed: 17,
    arrivals: profile.arrivals,
    resources: profile.resources,
    requirementsByBlock: profile.requirementsByBlock,
    uncertaintyByBlock: profile.uncertaintyByBlock,
    priority: { routinePriority: 0 },
  });
  const universal = simulateUniversalScenario(profile, 17);
  assert.equal(legacy.ok, true, legacy.errors.join('; '));
  assert.equal(universal.ok, true, universal.errors.join('; '));
  assert.equal(universal.stats.makespanSeconds, legacy.stats.makespanSeconds);
  assert.equal(universal.core.stats.completedJobs, legacy.stats.completedJobs);
  assert.equal(universal.core.stats.totalRuns, legacy.stats.totalRuns);
  assert.equal(universal.stats.averageCycleSeconds, legacy.stats.averageCycleSeconds);
  assert.equal(universal.stats.averageWaitSeconds, legacy.stats.averageWaitSeconds);
  assert.equal(universal.stats.throughputPerHour, legacy.stats.throughputPerHour);
}

{
  let profile = baseProfile(4);
  profile = setProcessArrival(profile, 'poisson', 0);
  assert.equal(profile.arrivals?.kind, 'poisson');
  assert.equal(profile.arrivals?.kind === 'poisson' ? profile.arrivals.meanIntervalSeconds : 0, 0.001);
  profile = setProcessArrival(profile, 'fixed', -10);
  assert.equal(profile.arrivals?.kind === 'fixed' ? profile.arrivals.intervalSeconds : -1, 0);

  profile = setPeriodicJobPriority(profile, 2, 100, 5);
  assert.deepEqual(profile.jobs.map(job => job.priority), [5, 100, 5, 100]);
  assert.deepEqual(profile.jobs.map(job => job.priorityClass), ['standard', 'expedite', 'standard', 'expedite']);
}

{
  let profile = baseProfile(2);
  profile = setProcessRetry(profile, 'work', 100, 1);
  assert.equal(retryPercent(profile, 'work'), 100);
  const result = simulateUniversalScenario(profile, 1);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(result.core.stats.totalReworkRuns, 2, '100% retry with maxRepeats=1 must repeat every job exactly once');

  profile = setProcessRetry(profile, 'work', 0, 1);
  assert.equal(profile.retryByBlock?.work, undefined);
}

{
  let profile = baseProfile(1);
  profile = setDailyResourceSchedule(profile, 'machine', {
    shiftEnabled: true,
    shiftStartHour: 8,
    shiftEndHour: 17,
    downtimeEnabled: false,
    downtimeStartHour: 12,
    downtimeDurationHour: 1,
  });
  const result = simulateUniversalScenario(profile, 2);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(result.core.runs[0]?.startSeconds, 8 * 3600, 'midnight-ready work must wait for 08:00 shift');

  profile = setDailyResourceSchedule(profile, 'machine', {
    shiftEnabled: false,
    shiftStartHour: 8,
    shiftEndHour: 17,
    downtimeEnabled: false,
    downtimeStartHour: 12,
    downtimeDurationHour: 1,
  });
  assert.equal(profile.calendars?.machine, undefined);
}

{
  const profile = baseProfile(1);
  const ready = evaluateDigitalTwinReadiness(profile);
  assert.equal(ready.ready, true);
  const invalid = baseProfile(1);
  invalid.blocks[0].time.value = null;
  const notReady = evaluateDigitalTwinReadiness(invalid);
  assert.equal(notReady.ready, false);
  assert.deepEqual(notReady.unresolvedBlockIds, ['work']);
}

console.log('processDigitalTwinV2Test: OK');
