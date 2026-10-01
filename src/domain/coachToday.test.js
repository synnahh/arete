import { describe, it, expect } from 'vitest';
import { eatenToday, macroBars, waterBar, goalWeek, sessionToday } from './coachToday.js';

describe('eatenToday', () => {
  it('sums only today and tolerates bad values', () => {
    const rows = [{ date: '2026-10-01', calories: 500, protein: 40 }, { date: '2026-10-01', calories: '300', protein: null }, { date: '2026-09-30', calories: 999 }, null];
    expect(eatenToday(rows, '2026-10-01')).toEqual({ calories: 800, protein: 40, carbs: 0, fat: 0 });
    expect(eatenToday([], '2026-10-01').calories).toBe(0);
  });
});

describe('macroBars', () => {
  const targets = { kcal: 2000, protein: 150, carbs: 200, fat: 0 };
  it('computes left and state, caps the bar at 100 and drops macros without a target', () => {
    const bars = macroBars(targets, { calories: 1000, protein: 150, carbs: 260, fat: 10 });
    expect(bars.map(b => b.id)).toEqual(['calories', 'protein', 'carbs']);
    expect(bars[0]).toMatchObject({ have: 1000, want: 2000, left: 1000, pct: 50, state: 'under' });
    expect(bars[1]).toMatchObject({ left: 0, pct: 100, state: 'on' });
    expect(bars[2]).toMatchObject({ pct: 100, over: 60, left: 0, state: 'over' });
  });
  it('is empty with no targets', () => {
    expect(macroBars(null, {})).toEqual([]);
  });
});

describe('waterBar / goalWeek / sessionToday', () => {
  it('water never goes negative and is null without a goal', () => {
    expect(waterBar(3200, 3000)).toMatchObject({ left: 0, pct: 100 });
    expect(waterBar(750, 3000)).toMatchObject({ left: 2250, pct: 25 });
    expect(waterBar(100, 0)).toBeNull();
  });
  it('counts goal weeks from 1 and rejects bad dates', () => {
    expect(goalWeek('2026-10-01', '2026-10-01')).toBe(1);
    expect(goalWeek('2026-10-01', '2026-10-08')).toBe(2);
    expect(goalWeek('2026-09-01', '2026-10-01')).toBe(5);
    expect(goalWeek('', '2026-10-01')).toBeNull();
    expect(goalWeek('2026-10-05', '2026-10-01')).toBeNull();
  });
  it('reads the planned day and what is logged', () => {
    const program = { days: { thu: { splitType: 'legs', label: 'Legs' }, fri: { splitType: 'rest' } } };
    expect(sessionToday({ program, weekdayKey: 'thu', workouts: [], today: 'd' })).toMatchObject({ planned: true, label: 'Legs', done: false });
    expect(sessionToday({ program, weekdayKey: 'thu', workouts: [{ date: 'd' }, { date: 'd' }], today: 'd' })).toMatchObject({ done: true, exercises: 2 });
    expect(sessionToday({ program, weekdayKey: 'fri', today: 'd' }).planned).toBe(false);
    expect(sessionToday({ program: null, weekdayKey: 'thu', today: 'd' }).hasProgram).toBe(false);
  });
});
