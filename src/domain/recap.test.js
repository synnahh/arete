import { describe, it, expect } from 'vitest';
import { weeklyRecap, loggingStreak, MILESTONES } from './recap.js';

const TODAY = '2026-09-30';
const key = (off) => new Date(Date.parse(TODAY) - off * 86400000).toISOString().slice(0, 10);
const range = (n, from = 0) => Array.from({ length: n }, (_, i) => from + i);
const lift = (off) => ({ date: key(off), exerciseName: 'Bench', sets: [{ weight: 60, reps: 8 }] });
const meal = (off, calories = 2400) => ({ date: key(off), calories });
const night = (off, hours) => ({ date: key(off), duration: hours * 60 });

describe('weeklyRecap', () => {
  it('covers the 7 days ending yesterday and ignores today', () => {
    const r = weeklyRecap({ workouts: [lift(0), lift(1), lift(3), lift(9)], nutrition: [meal(1)], sessionsPerWeek: 3 }, TODAY);
    expect(r.to).toBe(key(1));
    expect(r.from).toBe(key(7));
    expect(r.week.sessions).toBe(2);   // yesterday and 3 days ago; today and day 9 are out
    expect(r.prev.sessions).toBe(1);   // day 9 is in the week before
  });

  it('is null with fewer than two parts tracked', () => {
    expect(weeklyRecap({ workouts: [lift(2)] }, TODAY)).toBeNull();
    expect(weeklyRecap({}, TODAY)).toBeNull();
  });

  it('names the strongest part as the win and the weakest as the fix', () => {
    const r = weeklyRecap({
      workouts: [lift(1), lift(3), lift(5)],      // 3 of 3 planned
      nutrition: [meal(1)],                       // food on 1 of 7 days
      targetKcal: 2400, sessionsPerWeek: 3,
    }, TODAY);
    expect(r.win.part).toBe('training');
    expect(r.fix.part).toBe('fuel');
    expect(r.fix.text).toMatch(/1 of 7 days/);
  });

  it('gives no fix when every part is on track, and no win when none is', () => {
    const good = weeklyRecap({ workouts: [1, 3, 5].map(lift), nutrition: range(7, 1).map(o => meal(o)), targetKcal: 2400, sessionsPerWeek: 3 }, TODAY);
    expect(good.fix).toBeNull();
    const bad = weeklyRecap({ workouts: [lift(20)], nutrition: [meal(20)], targetKcal: 2400, sessionsPerWeek: 3 }, TODAY);
    expect(bad.win).toBeNull();
    expect(bad.fix).not.toBeNull();
  });

  it('scores a lapse after tracking began as low, not as missing', () => {
    const r = weeklyRecap({ workouts: [lift(30)], nutrition: [meal(30)], sessionsPerWeek: 3 }, TODAY);
    expect(r.week.sessions).toBe(0);
    expect(r.ratios.training).toBe(0);
  });

  it('weight change compares weekly averages and needs both weeks', () => {
    const body = [{ date: key(2), weight: 80 }, { date: key(4), weight: 80.4 }, { date: key(9), weight: 81 }, { date: key(11), weight: 81.2 }];
    const r = weeklyRecap({ workouts: [lift(1)], nutrition: [meal(1)], body, sessionsPerWeek: 3 }, TODAY);
    expect(r.weightChange).toBe(-0.9);
    const only = weeklyRecap({ workouts: [lift(1)], nutrition: [meal(1)], body: [body[0]], sessionsPerWeek: 3 }, TODAY);
    expect(only.weightChange).toBeNull();
  });

  it('sleep counts only with 3+ logged nights', () => {
    const base = { workouts: [lift(1)], nutrition: [meal(1)], sessionsPerWeek: 3 };
    expect(weeklyRecap({ ...base, sleep: [night(1, 6), night(2, 6)] }, TODAY).ratios.sleep).toBeUndefined();
    expect(weeklyRecap({ ...base, sleep: [night(1, 6), night(2, 6), night(3, 6)] }, TODAY).week.avgSleep).toBe(6);
  });
});

describe('loggingStreak', () => {
  it('counts consecutive logged days, and today does not break it until the day is over', () => {
    const s = loggingStreak({ nutrition: range(5, 1).map(o => meal(o)) }, TODAY); // yesterday back 5 days, nothing today
    expect(s.current).toBe(5);
    expect(s.active).toBe(false);
    const withToday = loggingStreak({ nutrition: range(6).map(o => meal(o)) }, TODAY);
    expect(withToday.current).toBe(6);
    expect(withToday.active).toBe(true);
  });

  it('a missed day resets it, but keeps the best', () => {
    const s = loggingStreak({ workouts: [...range(3, 5), ...range(2, 0)].map(lift) }, TODAY);
    expect(s.current).toBe(2);
    expect(s.best).toBe(3);
  });

  it('counts any kind of record and ignores empty ones', () => {
    const s = loggingStreak({
      workouts: [lift(0)], nutrition: [meal(1), { date: key(2), calories: 0 }], sleep: [night(2, 7)],
      body: [{ date: key(3), weight: 80 }], habits: [{ history: [key(4)] }],
    }, TODAY);
    expect(s.current).toBe(5); // days 0-4: the zero-calorie row did not count, the sleep row covers day 2
  });

  it('flags a milestone only on the day you reach it', () => {
    const seven = loggingStreak({ nutrition: range(7).map(o => meal(o)) }, TODAY);
    expect(seven.justReached).toBe(true);
    expect(seven.milestone).toBe(7);
    expect(seven.next).toBe(14);
    const eight = loggingStreak({ nutrition: range(8).map(o => meal(o)) }, TODAY);
    expect(eight.justReached).toBe(false);
    expect(eight.milestone).toBe(7);
  });

  it('is zero with nothing logged, and ignores future-dated rows', () => {
    expect(loggingStreak({}, TODAY).current).toBe(0);
    expect(loggingStreak({ nutrition: [meal(-3)] }, TODAY).current).toBe(0);
    expect(MILESTONES[0]).toBe(7);
  });
});
