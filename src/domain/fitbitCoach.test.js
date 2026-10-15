import { describe, it, expect } from 'vitest';
import { fitbitUpdates, fitbitRead, compare, healthSeries, picks } from './fitbitCoach.js';
import { makeGoal } from './goals.js';

const TODAY = '2026-10-15';
const day = (n) => { const d = new Date(Date.UTC(2026, 9, 15 - n, 12)); return d.toISOString().slice(0, 10); };
// n days of data, newest = day 0. f(i) i = days ago
const rows = (n, f) => Array.from({ length: n }, (_, i) => ({ date: day(i), data: f(i) }));
const nights = (n, hours) => Array.from({ length: n }, (_, i) => ({ date: day(i), duration: hours(i) * 60 }));
const never = () => false;

describe('compare', () => {
  it('needs a baseline before it says anything', () => {
    expect(compare(healthSeries(rows(4, () => ({ restingHeartRate: 60 })), picks.rhr), TODAY)).toBeNull();
  });
  it('compares the last 3 days with the 14 before', () => {
    const c = compare(healthSeries(rows(17, (i) => ({ restingHeartRate: i < 3 ? 68 : 60 })), picks.rhr), TODAY);
    expect(Math.round(c.recent)).toBe(68);
    expect(Math.round(c.base)).toBe(60);
    expect(c.nBase).toBe(14);
  });
});

describe('recovery advice', () => {
  const calm = (i) => ({ restingHeartRate: 60, hrv: 60 });
  it('fires when resting HR is up and sleep is short', () => {
    const health = rows(17, (i) => ({ restingHeartRate: i < 3 ? 67 : 60, hrv: 60 }));
    const u = fitbitUpdates({ health, sleep: nights(3, () => 5.2), today: TODAY, cooling: never });
    expect(u.map(x => x.key)).toContain('recovery');
    const r = u.find(x => x.key === 'recovery');
    expect(r.apply.type).toBe('advice');
    expect(r.why).toMatch(/resting heart rate 67/);
  });
  it('does not fire on a single weak signal', () => {
    const health = rows(17, (i) => ({ restingHeartRate: i < 3 ? 63 : 60, hrv: 60 }));
    expect(fitbitUpdates({ health, sleep: nights(3, () => 7.5), today: TODAY, cooling: never })).toEqual([]);
  });
  it('fires alone on a big resting HR jump, and respects the cooldown', () => {
    const health = rows(17, (i) => ({ restingHeartRate: i < 3 ? 69 : 60 }));
    expect(fitbitUpdates({ health, today: TODAY, cooling: never }).some(x => x.key === 'recovery')).toBe(true);
    expect(fitbitUpdates({ health, today: TODAY, cooling: (l, k) => k === 'recovery' }).some(x => x.key === 'recovery')).toBe(false);
  });
  it('stays quiet with calm numbers', () => {
    expect(fitbitUpdates({ health: rows(20, calm), sleep: nights(7, () => 7.6), today: TODAY, cooling: never })).toEqual([]);
  });
});

describe('sleep debt', () => {
  it('flags a week under 6.3 h', () => {
    const u = fitbitUpdates({ health: rows(1, () => ({ steps: 5000 })), sleep: nights(7, () => 5.8), today: TODAY, cooling: never });
    expect(u.find(x => x.key === 'sleep-debt').title).toMatch(/5\.8 h/);
  });
});

describe('fitbit maintenance', () => {
  const profile = { birthDate: '2005-03-01', sex: 'male', heightCm: 180 };
  const goal = makeGoal({ template: 'cut', weightKg: 71, maintenanceKcal: 2200, maintenanceSource: 'estimate', startedOn: '2026-09-01' });
  const weights = Array.from({ length: 10 }, (_, i) => ({ date: day(i * 2), weight: 71 }));
  it('proposes new calories when real activity disagrees by 150+ kcal', () => {
    const health = rows(14, () => ({ activeEnergy: 900 }));
    const u = fitbitUpdates({ goal, profile, weights, health, today: TODAY, cooling: never });
    const m = u.find(x => x.key === 'fitbit-maintenance');
    expect(m).toBeTruthy();
    expect(m.apply.type).toBe('goal');
    expect(m.apply.goal.maintenanceSource).toBe('fitbit');
    expect(m.apply.goal.maintenanceKcal).toBeGreaterThan(2200);
  });
  it('does nothing when activity matches, needs a profile, and defers to measured maintenance', () => {
    expect(fitbitUpdates({ goal, profile, weights, health: rows(14, () => ({ activeEnergy: 450 })), today: TODAY, cooling: never }).some(x => x.key === 'fitbit-maintenance')).toBe(false);
    expect(fitbitUpdates({ goal, profile: {}, weights, health: rows(14, () => ({ activeEnergy: 900 })), today: TODAY, cooling: never })).toEqual([]);
    const measured = { ...goal, maintenanceSource: 'adaptive' };
    expect(fitbitUpdates({ goal: measured, profile, weights, health: rows(14, () => ({ activeEnergy: 900 })), today: TODAY, cooling: never })).toEqual([]);
  });
});

describe('heart-rate trend on a heavy plan', () => {
  const program = { days: { mon: { splitType: 'custom' }, tue: { splitType: 'custom' }, wed: { splitType: 'custom' }, thu: { splitType: 'custom' }, fri: { splitType: 'custom' }, sat: { splitType: 'rest' }, sun: { splitType: 'rest' } } };
  it('proposes one fewer day when resting HR climbs for weeks', () => {
    const health = rows(28, (i) => ({ restingHeartRate: i < 14 ? 64 : 60 }));
    const u = fitbitUpdates({ health, program, today: TODAY, cooling: never });
    expect(u.find(x => x.key === 'hr-trend').apply).toEqual({ type: 'split', days: 4 });
  });
});

describe('fitbitRead', () => {
  it('summarises what it sees and says what is missing', () => {
    const r = fitbitRead({ health: rows(6, () => ({ steps: 8000, restingHeartRate: 58 })), sleep: nights(4, () => 7), today: TODAY });
    expect(r.days).toBe(6);
    expect(r.lines.find(l => l.id === 'steps').text).toMatch(/8,000/);
    expect(r.lines.find(l => l.id === 'sleep').text).toMatch(/7 h/);
    expect(r.missing.join()).toMatch(/resting heart rate/);
  });
  it('is empty with no data', () => {
    expect(fitbitRead({ health: [], sleep: [], today: TODAY }).days).toBe(0);
  });
});
