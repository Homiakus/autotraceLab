export interface ProcessWorkingWindow {
  startOffsetSeconds: number;
  endOffsetSeconds: number;
}

export interface ProcessDowntimeWindow {
  startSeconds: number;
  endSeconds: number;
  reason?: string;
}

export interface ProcessResourceCalendarPolicy {
  cycleSeconds?: number;
  workingWindows?: ProcessWorkingWindow[];
  plannedDowntime?: ProcessDowntimeWindow[];
}

export interface ProcessAvailabilityResult {
  startSeconds: number;
  shiftedBySeconds: number;
  reason: 'ready' | 'working-window' | 'planned-downtime';
}

function normalizeWindows(policy: ProcessResourceCalendarPolicy): ProcessWorkingWindow[] {
  const cycle = Math.max(1, Number(policy.cycleSeconds) || 86400);
  const windows = (policy.workingWindows || [])
    .map(window => ({
      startOffsetSeconds: Math.max(0, Math.min(cycle, Number(window.startOffsetSeconds) || 0)),
      endOffsetSeconds: Math.max(0, Math.min(cycle, Number(window.endOffsetSeconds) || 0)),
    }))
    .filter(window => window.endOffsetSeconds > window.startOffsetSeconds)
    .sort((a, b) => a.startOffsetSeconds - b.startOffsetSeconds);
  return windows.length ? windows : [{ startOffsetSeconds: 0, endOffsetSeconds: cycle }];
}

function normalizeDowntime(policy: ProcessResourceCalendarPolicy): ProcessDowntimeWindow[] {
  const sorted = (policy.plannedDowntime || [])
    .map(window => ({
      ...window,
      startSeconds: Math.max(0, Number(window.startSeconds) || 0),
      endSeconds: Math.max(0, Number(window.endSeconds) || 0),
    }))
    .filter(window => window.endSeconds > window.startSeconds)
    .sort((a, b) => a.startSeconds - b.startSeconds || a.endSeconds - b.endSeconds);

  const merged: ProcessDowntimeWindow[] = [];
  for (const window of sorted) {
    const previous = merged.at(-1);
    if (!previous || window.startSeconds > previous.endSeconds) {
      merged.push({ ...window });
      continue;
    }
    previous.endSeconds = Math.max(previous.endSeconds, window.endSeconds);
    if (window.reason && previous.reason !== window.reason) {
      previous.reason = [previous.reason, window.reason].filter(Boolean).join(' + ');
    }
  }
  return merged;
}

function overlaps(start: number, finish: number, blockedStart: number, blockedFinish: number): boolean {
  return start < blockedFinish && finish > blockedStart;
}

function nextWorkingStart(
  policy: ProcessResourceCalendarPolicy,
  start: number,
  duration: number,
): { start: number; shifted: boolean } {
  if (duration <= 0) return { start, shifted: false };
  const cycle = Math.max(1, Number(policy.cycleSeconds) || 86400);
  const windows = normalizeWindows(policy);
  let candidate = Math.max(0, start);

  for (let guard = 0; guard < 10000; guard += 1) {
    const cycleIndex = Math.floor(candidate / cycle);
    const cycleBase = cycleIndex * cycle;

    for (const window of windows) {
      const windowStart = cycleBase + window.startOffsetSeconds;
      const windowEnd = cycleBase + window.endOffsetSeconds;
      const proposed = Math.max(candidate, windowStart);
      if (proposed + duration <= windowEnd) return { start: proposed, shifted: proposed !== start };
    }
    candidate = (cycleIndex + 1) * cycle + windows[0].startOffsetSeconds;
  }
  return { start: Number.POSITIVE_INFINITY, shifted: true };
}

export function nextResourceAvailableStart(
  policy: ProcessResourceCalendarPolicy | undefined,
  readySeconds: number,
  durationSeconds: number,
): ProcessAvailabilityResult {
  if (!policy) return { startSeconds: readySeconds, shiftedBySeconds: 0, reason: 'ready' };
  const downtime = normalizeDowntime(policy);
  let candidate = Math.max(0, readySeconds);
  let reason: ProcessAvailabilityResult['reason'] = 'ready';

  for (let guard = 0; guard < 20000; guard += 1) {
    const working = nextWorkingStart(policy, candidate, durationSeconds);
    if (!Number.isFinite(working.start)) {
      return { startSeconds: working.start, shiftedBySeconds: working.start - readySeconds, reason: 'working-window' };
    }
    if (working.start > candidate) reason = 'working-window';
    candidate = working.start;
    const finish = candidate + durationSeconds;
    const conflict = downtime.find(window => overlaps(candidate, finish, window.startSeconds, window.endSeconds));
    if (!conflict) {
      return {
        startSeconds: candidate,
        shiftedBySeconds: candidate - readySeconds,
        reason,
      };
    }
    candidate = conflict.endSeconds;
    reason = 'planned-downtime';
  }

  return { startSeconds: Number.POSITIVE_INFINITY, shiftedBySeconds: Number.POSITIVE_INFINITY, reason };
}

export function isResourceAvailable(
  policy: ProcessResourceCalendarPolicy | undefined,
  startSeconds: number,
  durationSeconds: number,
): boolean {
  return nextResourceAvailableStart(policy, startSeconds, durationSeconds).startSeconds === startSeconds;
}

export function availableSecondsWithin(
  policy: ProcessResourceCalendarPolicy | undefined,
  horizonSeconds: number,
): number {
  const horizon = Math.max(0, horizonSeconds);
  if (!policy || horizon === 0) return horizon;
  const cycle = Math.max(1, Number(policy.cycleSeconds) || 86400);
  const windows = normalizeWindows(policy);
  let total = 0;
  const cycles = Math.ceil(horizon / cycle);
  for (let index = 0; index < cycles; index += 1) {
    const base = index * cycle;
    for (const window of windows) {
      const start = Math.min(horizon, base + window.startOffsetSeconds);
      const end = Math.min(horizon, base + window.endOffsetSeconds);
      if (end > start) total += end - start;
    }
  }

  for (const downtime of normalizeDowntime(policy)) {
    const start = Math.max(0, Math.min(horizon, downtime.startSeconds));
    const end = Math.max(0, Math.min(horizon, downtime.endSeconds));
    if (end <= start) continue;
    for (let index = 0; index < cycles; index += 1) {
      const base = index * cycle;
      for (const window of windows) {
        const overlapStart = Math.max(start, base + window.startOffsetSeconds);
        const overlapEnd = Math.min(end, base + window.endOffsetSeconds);
        if (overlapEnd > overlapStart) total -= overlapEnd - overlapStart;
      }
    }
  }
  return Math.max(0, total);
}
