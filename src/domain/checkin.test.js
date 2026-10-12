import { describe, it, expect } from 'vitest';
import { dailyWeights, progressTiles, checkInStatus, previousCheckIn, checkInRow } from './checkin.js';
import { weekStrip, profileStats, goalDay } from './profileStats.js';

const body = [
  { date: '2026-09-14', weight: '84', source: 'check-in' },
  { date: '2026-09-21', weight: 83.2 },
  { date: '2026-09-28', weight: '82.6', source: 'check-in' },
  { date: '2026-10-05', weight: 82.0 },
  { date: '2026-10-05', weight: 82.4 },
  { date: '2026-10-05', weight: 8 },       // typo ignored
  { date: 'bad', weight: 70 },
];

describe('progress tiles', () => {
  it('averages a day, ignores typos, oldest first', () => {
    expect(dailyWeights(body).map(d => d.date)).toEqual(['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05']);
    expect(dailyWeights(body).pop().weight).toBe(82.2);
  });
  it('lost and gained from the goal start weight', () => {
    const t = progressTiles(body, { startWeightKg: 85, startedOn: '2026-09-14', targetWeightKg: 78 }, '2026-10-12');
    expect(t).toMatchObject({ startKg: 85, currentKg: 82.2, lostKg: 2.8, gainedKg: 0, week: 5, toGoalKg: -4.2 });
    const gain = progressTiles([{ date: '2026-10-01', weight: 70 }, { date: '2026-10-08', weight: 71.5 }], null, '2026-10-12');
    expect(gain).toMatchObject({ startKg: 70, lostKg: 0, gainedKg: 1.5 });
  });
  it('is null with no weigh-ins', () => {
    expect(progressTiles([], null, '2026-10-12')).toBeNull();
  });
});

describe('weekly check-in', () => {
  it('is due when none yet, or 7 days after the last', () => {
    expect(checkInStatus([], '2026-10-12')).toMatchObject({ due: true, last: null });
    expect(checkInStatus(body, '2026-10-12')).toMatchObject({ last: '2026-09-28', daysSince: 14, due: true, count: 2 });
    expect(checkInStatus(body, '2026-10-02').due).toBe(false);
  });
  it('compares with the last check-in, else the last weigh-in', () => {
    expect(previousCheckIn(body, '2026-10-12').date).toBe('2026-09-28');
    expect(previousCheckIn([{ date: '2026-10-01', weight: 80 }], '2026-10-12').weight).toBe(80);
    expect(previousCheckIn([], '2026-10-12')).toBeNull();
  });
  it('only makes a row from a believable weight and a real date', () => {
    expect(checkInRow({ date: '2026-10-12', weight: '81.46' })).toEqual({ date: '2026-10-12', weight: 81.5, source: 'check-in' });
    expect(checkInRow({ date: '2026-10-12', weight: 'x' })).toBeNull();
    expect(checkInRow({ date: 'soon', weight: 80 })).toBeNull();
  });
});

describe('profile numbers', () => {
  it('lays out Monday to Sunday and flags logged days and today', () => {
    const strip = weekStrip({ workouts: [{ date: '2026-10-12', exerciseName: 'Bench' }], nutrition: [{ date: '2026-10-13', calories: 2000 }] }, '2026-10-13');
    expect(strip.map(d => d.label)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
    expect(strip[0]).toMatchObject({ key: '2026-10-12', logged: true, isToday: false });
    expect(strip[1]).toMatchObject({ logged: true, isToday: true });
    expect(strip[4].isFuture).toBe(true);
  });
  it('counts training days and goals the coach marked reached', () => {
    expect(profileStats({ workouts: [{ date: 'a' }, { date: 'a' }, { date: 'b' }], coachLog: [{ key: 'goal-reached', status: 'applied' }, { key: 'goal-reached', status: 'undone' }, { key: 'water', status: 'applied' }] })).toEqual({ workoutDays: 2, goalsAchieved: 1 });
    expect(profileStats()).toEqual({ workoutDays: 0, goalsAchieved: 0 });
  });
  it('numbers the goal days from 1', () => {
    expect(goalDay({ startedOn: '2026-10-12' }, '2026-10-12')).toBe(1);
    expect(goalDay({ startedOn: '2026-10-01' }, '2026-10-12')).toBe(12);
    expect(goalDay({}, '2026-10-12')).toBeNull();
  });
});
