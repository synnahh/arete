import { describe, it, expect } from 'vitest';
import { waistReadings, waistTrend, averageOfTwo } from './waist.js';
import { setSteps, weekAverage, rampedGoal, startingGoal, cleanLog } from './steps.js';
import { checkInRow } from './checkin.js';
import { nextMoves } from './nextMoves.js';

const rows = (pairs) => pairs.map(([date, waist]) => ({ date, waist, weight: 71 }));

describe('waist', () => {
  it('ignores implausible and missing readings', () => {
    expect(waistReadings([{ date: '2026-10-01' }, { date: '2026-10-02', waist: 5 }, { date: '2026-10-03', waist: '85' }]).map(r => r.cm)).toEqual([85]);
  });
  it('averages two readings, needs both plausible', () => {
    expect(averageOfTwo('84', '85')).toBe(84.5);
    expect(averageOfTwo('84', '')).toBeNull();
  });
  it('is flat after 3 weeks of near-identical readings', () => {
    const t = waistTrend(rows([['2026-09-21', 85], ['2026-09-28', 85.2], ['2026-10-05', 84.9], ['2026-10-12', 85.1]]), '2026-10-12');
    expect(t.flat).toBe(true);
    expect(t.latest).toBe(85.1);
  });
  it('is not flat when it drops, or with too few readings', () => {
    expect(waistTrend(rows([['2026-09-21', 86], ['2026-09-28', 85.2], ['2026-10-12', 84.4]]), '2026-10-12').flat).toBe(false);
    expect(waistTrend(rows([['2026-10-05', 85], ['2026-10-12', 85]]), '2026-10-12').flat).toBe(false);
    expect(waistTrend([], '2026-10-12')).toBeNull();
  });
  it('a check-in row carries an optional waist', () => {
    expect(checkInRow({ date: '2026-10-12', weight: 71, waist: '84.5' }).waist).toBe(84.5);
    expect(checkInRow({ date: '2026-10-12', weight: 71, waist: '' }).waist).toBeUndefined();
    expect(checkInRow({ date: '2026-10-12', weight: 71, waist: 5 }).waist).toBeUndefined();
  });
});

describe('steps', () => {
  it('needs 3 logged days for an average, and only counts the last 7', () => {
    let log = {};
    log = setSteps(log, '2026-10-10', 6000); log = setSteps(log, '2026-10-11', 7000);
    expect(weekAverage(log, '2026-10-12')).toBeNull();
    log = setSteps(log, '2026-10-12', 8000);
    expect(weekAverage(log, '2026-10-12')).toBe(7000);
    log = setSteps(log, '2026-09-01', 30000);
    expect(weekAverage(log, '2026-10-12')).toBe(7000);
  });
  it('rejects nonsense', () => {
    expect(setSteps({}, 'bad', 5000)).toEqual({});
    expect(setSteps({}, '2026-10-12', -5)).toEqual({});
    expect(cleanLog({ '2026-10-12': 'x' })).toEqual({});
  });
  it('steps the goal up by about 1,000 only once you reach it, capped at 10k', () => {
    expect(rampedGoal(7500, 8000)).toBe(9000);
    expect(rampedGoal(6000, 8000)).toBeNull();
    expect(rampedGoal(9900, 10000)).toBeNull();
    expect(rampedGoal(9500, 9500)).toBe(10000);
    expect(rampedGoal(8500, 8000, 3)).toBeNull();
    expect(rampedGoal(8500, 8000, 7)).toBe(9000);
  });
  it('starts from your real average', () => {
    expect(startingGoal(6120)).toBe(6000);
    expect(startingGoal(8300)).toBe(8500);
    expect(startingGoal(500)).toBe(2000);
    expect(startingGoal(null)).toBeNull();
  });
});

describe('next moves from waist and steps', () => {
  it('flags a flat waist only when the goal is fat loss', () => {
    expect(nextMoves({ hour: 10, waist: { flat: true, latest: 85, deficit: true } }).some(m => m.id === 'waist-flat')).toBe(true);
    expect(nextMoves({ hour: 10, waist: { flat: true, latest: 85, deficit: false } }).some(m => m.id === 'waist-flat')).toBe(false);
    expect(nextMoves({ hour: 10, waist: { flat: false, latest: 85, deficit: true } }).some(m => m.id === 'waist-flat')).toBe(false);
  });
  it('suggests raising the step goal', () => {
    const m = nextMoves({ hour: 10, stepsPlan: { average: 8200, goal: 8000, next: 9000 } }).find(x => x.id === 'steps-ramp');
    expect(m.title).toContain('9,000');
  });
});
