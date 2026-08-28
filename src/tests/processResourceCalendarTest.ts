import assert from 'node:assert/strict';
import {
  availableSecondsWithin,
  isResourceAvailable,
  nextResourceAvailableStart,
  ProcessResourceCalendarPolicy,
} from '../processResourceCalendar';

const hour = 3600;
const shift: ProcessResourceCalendarPolicy = {
  cycleSeconds: 24 * hour,
  workingWindows: [{ startOffsetSeconds: 8 * hour, endOffsetSeconds: 17 * hour }],
};

{
  const result = nextResourceAvailableStart(shift, 7 * hour, hour);
  assert.equal(result.startSeconds, 8 * hour);
  assert.equal(result.reason, 'working-window');
}

{
  const result = nextResourceAvailableStart(shift, 8 * hour, hour);
  assert.equal(result.startSeconds, 8 * hour);
  assert.equal(result.reason, 'ready');
  assert.equal(isResourceAvailable(shift, 8 * hour, hour), true);
}

{
  const result = nextResourceAvailableStart(shift, 16.5 * hour, hour);
  assert.equal(result.startSeconds, 32 * hour, 'task must move to next day 08:00 when it cannot fit before 17:00');
}

{
  const withDowntime: ProcessResourceCalendarPolicy = {
    ...shift,
    plannedDowntime: [{ startSeconds: 10 * hour, endSeconds: 11 * hour, reason: 'ТО' }],
  };
  const result = nextResourceAvailableStart(withDowntime, 9.5 * hour, hour);
  assert.equal(result.startSeconds, 11 * hour);
  assert.equal(result.reason, 'planned-downtime');
  assert.equal(isResourceAvailable(withDowntime, 9.5 * hour, hour), false);
}

{
  assert.equal(availableSecondsWithin(shift, 24 * hour), 9 * hour);
  const withDowntime: ProcessResourceCalendarPolicy = {
    ...shift,
    plannedDowntime: [{ startSeconds: 10 * hour, endSeconds: 11 * hour }],
  };
  assert.equal(availableSecondsWithin(withDowntime, 24 * hour), 8 * hour);
}

{
  const impossible: ProcessResourceCalendarPolicy = {
    cycleSeconds: 24 * hour,
    workingWindows: [{ startOffsetSeconds: 8 * hour, endOffsetSeconds: 9 * hour }],
  };
  const result = nextResourceAvailableStart(impossible, 0, 2 * hour);
  assert.equal(Number.isFinite(result.startSeconds), false, 'task longer than every working window must be unschedulable');
}

console.log('processResourceCalendarTest: OK');
