import { describe, it, expect } from 'vitest';
import { overallRating, tierOf, WEIGHTS } from './overall.js';

const TODAY = '2026-09-30';
const dayKey = (offset) => new Date(Date.parse(TODAY) - offset * 86400000).toISOString().slice(0, 10);
const range = (n, from = 0) => Array.from({ length: n }, (_, i) => from + i);

// A very consistent month.
const great = () => ({
  workouts: range(28).filter(i => i % 2 === 0).map(i => ({ date: dayKey(i) })),                       // 14 sessions
  nutrition: range(28).map(i => ({ date: dayKey(i), calories: 2400 })),
  sleep: range(28).map(i => ({ date: dayKey(i), hours: 8 })),
  habits: [{ history: range(28).map(dayKey) }],
  body: range(28).filter(i => i % 3 === 0).map(i => ({ date: dayKey(i), weight: 80 })),
  targets: { kcal: 2400 },
  need: 8,
});

describe('overallRating', () => {
  it('gives a very consistent month a high rating and an Elite tier', () => {
    const r = overallRating(great(), TODAY);
    expect(r.ovr).toBeGreaterThanOrEqual(90);
    expect(r.tier.id).toBe('elite');
  });

  it('is null when there is not enough to judge', () => {
    expect(overallRating({}, TODAY)).toBeNull();
    expect(overallRating({ workouts: [{ date: dayKey(1) }] }, TODAY)).toBeNull();
    expect(overallRating(great(), 'nonsense')).toBeNull();
  });

  it('leaves out a pillar with no data instead of counting it as zero', () => {
    const d = great();
    const withoutHabits = overallRating({ ...d, habits: [] }, TODAY);
    expect(withoutHabits.pillars.habits).toBeUndefined();
    expect(withoutHabits.ovr).toBeGreaterThanOrEqual(90);
  });

  it('a sparse month rates far lower than a consistent one', () => {
    const sparse = overallRating({
      workouts: [{ date: dayKey(3) }, { date: dayKey(20) }],
      nutrition: [{ date: dayKey(2), calories: 1800 }, { date: dayKey(9), calories: 3400 }],
      targets: { kcal: 2400 },
    }, TODAY);
    expect(sparse.ovr).toBeLessThan(20);
    expect(sparse.tier.id).toBe('bronze');
  });

  it('gives full fuel credit only for days near the calorie target', () => {
    const near = overallRating({ ...great(), nutrition: range(28).map(i => ({ date: dayKey(i), calories: 2400 })) }, TODAY).pillars.fuel;
    const far = overallRating({ ...great(), nutrition: range(28).map(i => ({ date: dayKey(i), calories: 1200 })) }, TODAY).pillars.fuel;
    expect(near).toBe(1);
    expect(far).toBeCloseTo(0.7, 5);
  });

  it('measures the change against the 28 days before', () => {
    const d = great();
    // Add an older month of nothing but a couple of workouts, so the last month is a big improvement.
    const older = { workouts: [{ date: dayKey(40) }, { date: dayKey(50) }], nutrition: [{ date: dayKey(45), calories: 2400 }] };
    const r = overallRating({ ...d, workouts: [...d.workouts, ...older.workouts], nutrition: [...d.nutrition, ...older.nutrition] }, TODAY);
    expect(r.previous).not.toBeNull();
    expect(r.delta).toBe(r.ovr - r.previous);
    expect(r.delta).toBeGreaterThan(30);
  });

  it('ignores future dates and junk rows', () => {
    const d = great();
    const r = overallRating({ ...d, workouts: [...d.workouts, { date: '2026-12-01' }, null, { date: 'x' }].filter(Boolean) }, TODAY);
    expect(r.ovr).toBe(overallRating(d, TODAY).ovr);
  });
});

describe('tiers and weights', () => {
  it('sum to one and band sensibly', () => {
    expect(Object.values(WEIGHTS).reduce((s, w) => s + w, 0)).toBeCloseTo(1, 5);
    expect([tierOf(90).id, tierOf(70).id, tierOf(55).id, tierOf(10).id]).toEqual(['elite', 'gold', 'silver', 'bronze']);
  });
});

describe('history before the window', () => {
  it('has no month-on-month change when nothing was tracked the month before', () => {
    const r = overallRating(great(), TODAY);
    expect(r.previous).toBeNull();
    expect(r.delta).toBeNull();
  });

  it('scores a lapse after tracking started as low, not as missing', () => {
    // Trained a lot 5-8 weeks ago, then stopped completely for the last 28 days.
    const workouts = range(10).map(i => ({ date: dayKey(30 + i * 2) }));
    const nutrition = range(10).map(i => ({ date: dayKey(30 + i), calories: 2400 }));
    const r = overallRating({ workouts, nutrition, targets: { kcal: 2400 } }, TODAY);
    expect(r.pillars.training).toBe(0);
    expect(r.ovr).toBe(0);
    expect(r.previous).toBeGreaterThan(20);
    expect(r.delta).toBeLessThan(0);
  });
});

describe('fuel without a calorie target', () => {
  it('counts every logged day fully', () => {
    const d = great();
    const r = overallRating({ ...d, targets: null }, TODAY);
    expect(r.pillars.fuel).toBe(1);
  });
});
