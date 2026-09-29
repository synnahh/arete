import { describe, it, expect } from 'vitest';
import { recentFoods, yesterdayKey, copyMeals, quickEntry, appendMeals } from './foods.js';

const meal = (name, calories, extra = {}) => ({ name, calories, protein: 10, carbs: 20, fat: 5, ...extra });
const logs = [
  { date: '2026-09-25', meals: [meal('Protein shake', 200), meal('Chicken rice', 650)] },
  { date: '2026-09-26', meals: [meal('protein shake', 210, { protein: 30 }), meal('Oats', 350)] },
  { date: '2026-09-28', meals: [meal('Protein shake ', 220, { protein: 32, qty: 1, unit: 'scoop' }), meal('Chicken rice', 640)] },
];

describe('recentFoods', () => {
  it('ranks by how often, then recency, and merges name variants', () => {
    const r = recentFoods(logs, { today: '2026-09-29' });
    expect(r.map(f => [f.name, f.count])).toEqual([['Protein shake', 3], ['Chicken rice', 2], ['Oats', 1]]);
  });

  it('repeats the most recent portion and macros', () => {
    const shake = recentFoods(logs, { today: '2026-09-29' })[0];
    expect(shake).toMatchObject({ calories: 220, protein: 32, qty: 1, unit: 'scoop', lastDate: '2026-09-28' });
  });

  it('only looks inside the window and never at the future', () => {
    const old = [{ date: '2026-06-01', meals: [meal('Old thing', 500)] }, { date: '2026-10-05', meals: [meal('Future', 400)] }];
    expect(recentFoods(old, { today: '2026-09-29' })).toEqual([]);
  });

  it('skips nameless assistant entries and zero-calorie rows', () => {
    const l = [{ date: '2026-09-28', meals: [meal('Logged by assistant', 500), meal('Water', 0), meal('Toast', 120)] }];
    expect(recentFoods(l, { today: '2026-09-29' }).map(f => f.name)).toEqual(['Toast']);
  });

  it('respects the limit and handles empty input', () => {
    expect(recentFoods(logs, { today: '2026-09-29', limit: 1 })).toHaveLength(1);
    expect(recentFoods([], { today: '2026-09-29' })).toEqual([]);
    expect(recentFoods(undefined, { today: '2026-09-29' })).toEqual([]);
  });
});

describe('yesterdayKey', () => {
  it('steps back one local day across month and year ends', () => {
    expect(yesterdayKey('2026-09-30')).toBe('2026-09-29');
    expect(yesterdayKey('2026-10-01')).toBe('2026-09-30');
    expect(yesterdayKey('2026-01-01')).toBe('2025-12-31');
  });
});

describe('copyMeals', () => {
  const log = { date: '2026-09-29', meals: [
    { id: 'a', name: 'Oats', calories: 350, protein: 12, qty: 80, unit: 'g', time: '07:30', micros: { fibre: 8 } },
    { id: 'b', name: '', calories: 100 },
    { id: 'c', name: 'Whey shake', calories: 120, protein: 25, time: '10:00', savedMealId: 's1' },
  ] };
  it('copies named meals with fresh ids and the current time, keeping the food details', () => {
    const now = new Date(2026, 8, 30, 8, 5);
    const out = copyMeals(log, now);
    expect(out.map(m => m.name)).toEqual(['Oats', 'Whey shake']);
    expect(out[0]).toMatchObject({ calories: 350, qty: 80, unit: 'g', time: '08:05', micros: { fibre: 8 } });
    expect(new Set(out.map(m => m.id)).size).toBe(2);
    expect(out.every(m => m.id !== 'a' && m.id !== 'c')).toBe(true);
    expect(out[1].savedMealId).toBe('s1');
  });
  it('handles a missing day', () => {
    expect(copyMeals(null)).toEqual([]);
    expect(copyMeals({ meals: [] })).toEqual([]);
  });
});

describe('quickEntry', () => {
  const now = new Date(2026, 8, 30, 12, 30);
  it('builds an entry from calories alone', () => {
    expect(quickEntry({ calories: '450' }, now)).toMatchObject({ name: 'Quick add', calories: 450, protein: 0, carbs: 0, fat: 0, time: '12:30', quick: true });
  });
  it('keeps optional macros and a trimmed name', () => {
    expect(quickEntry({ name: '  Pub dinner ', calories: 900, protein: '42.44', fat: 30 }, now)).toMatchObject({ name: 'Pub dinner', protein: 42.4, fat: 30 });
  });
  it('refuses nonsense', () => {
    expect(quickEntry({ calories: 0 })).toBeNull();
    expect(quickEntry({ calories: -50 })).toBeNull();
    expect(quickEntry({ calories: 'abc' })).toBeNull();
    expect(quickEntry({ calories: 50000 })).toBeNull();
    expect(quickEntry()).toBeNull();
  });
  it('drops absurd macro values instead of saving them', () => {
    expect(quickEntry({ calories: 300, protein: 5000, carbs: -4 }, now)).toMatchObject({ protein: 0, carbs: 0 });
  });
});

describe('appendMeals', () => {
  it('adds to an existing day and recomputes the totals from the meals', () => {
    const existing = { id: 'row', date: '2026-09-30', meals: [{ calories: 300, protein: 20, carbs: 30, fat: 10 }], calories: 999 };
    const row = appendMeals(existing, [{ calories: 200, protein: 10.5, carbs: 5, fat: 2 }], '2026-09-30');
    expect(row).toMatchObject({ id: 'row', calories: 500, protein: 30.5, carbs: 35, fat: 12 });
    expect(row.meals).toHaveLength(2);
  });
  it('creates the day when there is none', () => {
    expect(appendMeals(null, [{ calories: 100 }], '2026-09-30')).toMatchObject({ date: '2026-09-30', calories: 100, protein: 0 });
  });
});
