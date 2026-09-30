import { describe, it, expect } from 'vitest';
import { startFast, fastProgress, endFast, addToLog, fastStats, formatHours } from './fasting.js';

const T0 = Date.UTC(2026, 8, 30, 20, 0);
const h = (n) => n * 3600000;

describe('startFast', () => {
  it('records the start and clamps the target to 4-48 h', () => {
    expect(startFast(16, T0)).toEqual({ startedAt: '2026-09-30T20:00:00.000Z', targetHours: 16 });
    expect(startFast(1, T0).targetHours).toBe(4);
    expect(startFast(200, T0).targetHours).toBe(48);
    expect(startFast('abc', T0).targetHours).toBe(16);
  });
});

describe('fastProgress', () => {
  const fast = startFast(16, T0);
  it('reports elapsed, remaining and when it ends', () => {
    const p = fastProgress(fast, T0 + h(4));
    expect(p).toMatchObject({ elapsedH: 4, remainingH: 12, pct: 0.25, done: false, overH: 0, endsAt: '2026-10-01T12:00:00.000Z' });
  });
  it('flags done and how far past the target', () => {
    expect(fastProgress(fast, T0 + h(18))).toMatchObject({ done: true, pct: 1, remainingH: 0, overH: 2 });
  });
  it('never goes negative if the clock moved back', () => {
    expect(fastProgress(fast, T0 - h(1)).elapsedH).toBe(0);
  });
  it('returns null for missing or corrupt state', () => {
    expect(fastProgress(null)).toBeNull();
    expect(fastProgress({ startedAt: 'nope', targetHours: 16 })).toBeNull();
    expect(fastProgress({ startedAt: fast.startedAt, targetHours: 0 })).toBeNull();
  });
});

describe('endFast / log / stats', () => {
  it('closes a fast into a log entry and marks whether it reached the target', () => {
    const fast = startFast(16, T0);
    expect(endFast(fast, T0 + h(17))).toMatchObject({ hours: 17, targetHours: 16, completed: true });
    expect(endFast(fast, T0 + h(10))).toMatchObject({ hours: 10, completed: false });
  });
  it('does not log a mis-tap', () => {
    expect(endFast(startFast(16, T0), T0 + 5 * 60000)).toBeNull();
    expect(endFast(null)).toBeNull();
  });
  it('keeps the newest 60 entries', () => {
    const log = Array.from({ length: 70 }, (_, i) => ({ end: T0, hours: i, completed: true }));
    const out = addToLog(log, { end: T0, hours: 99, completed: true });
    expect(out).toHaveLength(60);
    expect(out[59].hours).toBe(99);
    expect(addToLog([], null)).toEqual([]);
  });
  it('summarises the last 30 days and the current run of completed fasts', () => {
    const day = 24 * h(1);
    const log = [
      { end: new Date(T0 - 40 * day).toISOString(), hours: 16, completed: true },   // outside the window
      { end: new Date(T0 - 5 * day).toISOString(), hours: 12, completed: false },
      { end: new Date(T0 - 3 * day).toISOString(), hours: 17, completed: true },
      { end: new Date(T0 - 1 * day).toISOString(), hours: 18, completed: true },
    ];
    expect(fastStats(log, T0)).toEqual({ count: 3, completed: 2, avgHours: 15.7, run: 2 });
    expect(fastStats([], T0)).toEqual({ count: 0, completed: 0, avgHours: null, run: 0 });
  });
});

describe('formatHours', () => {
  it('shows hours and padded minutes', () => {
    expect(formatHours(13.0833)).toBe('13h 05m');
    expect(formatHours(0)).toBe('0h 00m');
    expect(formatHours(-3)).toBe('0h 00m');
  });
});
