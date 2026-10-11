import { describe, it, expect } from 'vitest';
import { monthGrid, loggedByDay, shiftMonth } from './logCalendar.js';

const data = {
  workouts: [{ date: '2026-10-02', exerciseName: 'Bench Press' }, { date: '2026-10-02', exerciseName: 'Dips' }, { date: '2026-10-09', exerciseName: 'Deadlift' }],
  nutrition: [{ date: '2026-10-02', calories: 2100 }, { date: '2026-10-03', calories: 0 }, { date: '2026-10-04', calories: 1800 }],
  sleep: [{ date: '2026-10-05', duration: 450 }],
  body: [{ date: '2026-10-06', weight: '82.4' }],
  habits: [{ id: 'h', name: 'Read', history: ['2026-10-07'] }],
};
const TODAY = '2026-10-10';
const flat = (g) => g.weeks.flat();
const cellOf = (g, key) => flat(g).find(c => c.key === key);

describe('monthGrid', () => {
  it('starts weeks on Monday and covers the whole month', () => {
    const g = monthGrid(2026, 9, data, TODAY);          // October 2026: 1st is a Thursday
    expect(g.weeks.every(w => w.length === 7)).toBe(true);
    expect(g.weeks[0][3].key).toBe('2026-10-01');       // Mon Tue Wed then Thu
    expect(g.weeks[0][0].inMonth).toBe(false);
    expect(flat(g).filter(c => c.inMonth)).toHaveLength(31);
    expect(g.title).toMatch(/October 2026/);
  });

  it('marks what was logged each day and ignores empty rows', () => {
    const g = monthGrid(2026, 9, data, TODAY);
    expect(cellOf(g, '2026-10-02').kinds).toEqual(['workout', 'food']);
    expect(cellOf(g, '2026-10-02').workouts).toEqual(['Bench Press', 'Dips']);
    expect(cellOf(g, '2026-10-03').logged).toBe(false);   // zero calories is not a log
    expect(cellOf(g, '2026-10-05').kinds).toEqual(['sleep']);
    expect(cellOf(g, '2026-10-06').kinds).toEqual(['weight']);
    expect(cellOf(g, '2026-10-07').kinds).toEqual(['habit']);
  });

  it('flags today and future days and counts the summary only up to today', () => {
    const g = monthGrid(2026, 9, data, TODAY);
    expect(cellOf(g, TODAY).isToday).toBe(true);
    expect(cellOf(g, '2026-10-11').isFuture).toBe(true);
    expect(g.summary).toEqual({ loggedDays: 6, workoutDays: 2, daysInMonthSoFar: 10 });
  });

  it('shows a past month without future flags', () => {
    const g = monthGrid(2026, 8, data, TODAY);
    expect(flat(g).filter(c => c.inMonth).every(c => !c.isFuture)).toBe(true);
    expect(g.summary.loggedDays).toBe(0);
  });

  it('ignores rows with bad dates', () => {
    const d = loggedByDay({ workouts: [{ date: 'nope' }, { exerciseName: 'x' }] });
    expect(d.size).toBe(0);
  });
});

describe('shiftMonth', () => {
  it('rolls over year ends both ways', () => {
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
  });
});
