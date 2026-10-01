import { describe, it, expect } from 'vitest';
import { insightSeries, sleepTrainingLink } from './insights.js';

const TODAY = '2026-09-30';
const key = (off) => new Date(Date.parse(TODAY) - off * 86400000).toISOString().slice(0, 10);
const range = (n, from = 0) => Array.from({ length: n }, (_, i) => from + i);
const lift = (off, weight = 60) => ({ date: key(off), exerciseName: 'Bench', sets: [{ weight, reps: 10 }] });
const night = (off, hours) => ({ date: key(off), duration: hours * 60 });

describe('insightSeries', () => {
  it('week and month give one point per logged day, oldest first, with no zero-fill', () => {
    const body = [{ date: key(0), weight: 80 }, { date: key(3), weight: 80.6 }, { date: key(10), weight: 81 }];
    const wk = insightSeries({ body }, 'week', TODAY);
    expect(wk.weight.points.map(p => p.date)).toEqual([key(3), key(0)]);
    expect(wk.weight.summary.change).toBe(-0.6);
    const mo = insightSeries({ body }, 'month', TODAY);
    expect(mo.weight.points).toHaveLength(3);
    expect(wk.calories).toBeNull();
  });

  it('year buckets by week: averages for weight and calories, totals for volume', () => {
    const body = [{ date: key(1), weight: 80 }, { date: key(2), weight: 82 }];
    const nutrition = [{ date: key(1), calories: 2000 }, { date: key(2), calories: 3000 }];
    const workouts = [lift(1), lift(2)]; // 600 each
    const y = insightSeries({ body, nutrition, workouts }, 'year', TODAY);
    expect(y.weight.points).toHaveLength(1);
    expect(y.weight.points[0].value).toBe(81);
    expect(y.calories.points[0].value).toBe(2500);
    expect(y.volume.points[0].value).toBe(1200);
  });

  it('sums several rows on one day and drops bad rows', () => {
    const r = insightSeries({
      nutrition: [{ date: key(1), calories: 500 }, { date: key(1), calories: 700 }, { date: 'soon', calories: 9 }, { date: key(2), calories: 0 }],
      body: [{ date: key(1), weight: 8 }],
    }, 'week', TODAY);
    expect(r.calories.points).toHaveLength(1);
    expect(r.calories.points[0].value).toBe(1200);
    expect(r.weight).toBeNull();
  });

  it('excludes data outside the range and rejects a bad range', () => {
    const r = insightSeries({ body: [{ date: key(8), weight: 80 }] }, 'week', TODAY);
    expect(r.weight).toBeNull();
    expect(insightSeries({}, 'decade', TODAY)).toBeNull();
  });
});

describe('sleepTrainingLink', () => {
  const nights = (shortHours, okHours) => range(40).map(i => night(i, i % 2 === 0 ? shortHours : okHours));

  it('reports lower volume after short nights', () => {
    const sleep = nights(5.5, 8); // even offsets are short
    const workouts = range(40).map(i => lift(i, i % 2 === 0 ? 50 : 70));
    const r = sleepTrainingLink({ sleep, workouts, need: 8 }, TODAY);
    expect(r.pct).toBeLessThan(-20);
    expect(r.text).toMatch(/lower/);
  });

  it('is null without 3 weeks of logs, or with a gap under 8%', () => {
    expect(sleepTrainingLink({ sleep: range(12).map(i => night(i, i % 2 ? 8 : 5)), workouts: range(12).map(i => lift(i)), need: 8 }, TODAY)).toBeNull();
    expect(sleepTrainingLink({ sleep: nights(5.5, 8), workouts: range(40).map(i => lift(i, 60)), need: 8 }, TODAY)).toBeNull();
  });

  it('is null when either side has under 4 trained days', () => {
    const sleep = nights(5.5, 8);
    const workouts = range(40).filter(i => i % 2 === 1).map(i => lift(i)).concat([lift(0, 20), lift(2, 20)]);
    expect(sleepTrainingLink({ sleep, workouts, need: 8 }, TODAY)).toBeNull();
  });
});
