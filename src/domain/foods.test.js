import { describe, it, expect } from 'vitest';
import { recentFoods, yesterdayKey, copyMeals, quickEntry, appendMeals, mealFromPlan, cleanIngredients, mealSection, groupBySection } from './foods.js';

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

describe('mealFromPlan', () => {
  const now = new Date(2026, 8, 30, 18, 45);
  const meal = { name: 'Chicken rice bowl', calories: 702.4, protein: 51.26, carbs: 70, fat: 18, ingredients: [
    { name: 'Chicken breast', qty: '200', unit: 'g' }, { name: 'Rice', qty: 150, unit: 'g' }, { name: '', qty: 5, unit: 'g' }, { name: 'Salt', qty: 0, unit: 'g' },
  ] };
  it('keeps macros and only the usable ingredients', () => {
    const e = mealFromPlan(meal, now);
    expect(e).toMatchObject({ name: 'Chicken rice bowl', calories: 702, protein: 51.3, time: '18:45', fromPlan: true });
    expect(e.ingredients).toEqual([{ name: 'Chicken breast', qty: 200, unit: 'g' }, { name: 'Rice', qty: 150, unit: 'g' }]);
  });
  it('omits ingredients when there are none, and refuses a meal without calories', () => {
    expect(mealFromPlan({ name: 'Snack', calories: 200 }, now)).not.toHaveProperty('ingredients');
    expect(mealFromPlan({ name: 'Nothing' }, now)).toBeNull();
    expect(mealFromPlan({ name: 'Huge', calories: 99999 }, now)).toBeNull();
  });
});

describe('ingredients carried through', () => {
  it('cleans an ingredient list', () => {
    expect(cleanIngredients([{ name: ' Rice ', qty: '150', unit: 'g ' }, { name: '', qty: 3 }, { name: 'Salt', qty: 0 }, null])).toEqual([{ name: 'Rice', qty: 150, unit: 'g' }]);
    expect(cleanIngredients(undefined)).toEqual([]);
  });
  it('recent foods keep the ingredients of the last time you had them', () => {
    const logs = [{ date: '2026-09-28', meals: [{ name: 'Bowl', calories: 700, ingredients: [{ name: 'Rice', qty: 150, unit: 'g' }] }] }];
    expect(recentFoods(logs, { today: '2026-09-30' })[0].ingredients).toEqual([{ name: 'Rice', qty: 150, unit: 'g' }]);
    expect(recentFoods([{ date: '2026-09-28', meals: [{ name: 'Toast', calories: 200 }] }], { today: '2026-09-30' })[0].ingredients).toEqual([]);
  });
});

describe('meal sections', () => {
  it('places a time in a section', () => {
    expect(['07:30', '11:00', '14:59', '15:00', '17:00', '21:59', '22:00', '03:30', '', undefined, '25:00', 'noon'].map(mealSection))
      .toEqual(['breakfast', 'lunch', 'lunch', 'snacks', 'dinner', 'dinner', 'snacks', 'snacks', 'snacks', 'snacks', 'snacks', 'snacks']);
  });
  it('groups in day order with subtotals, skipping empty sections', () => {
    const g = groupBySection([
      { id: 'd', name: 'Steak', calories: 800, time: '19:00' },
      { id: 'a', name: 'Oats', calories: 350, time: '07:30' },
      { id: 'c', name: 'Bar', calories: 200, time: '16:00' },
      { id: 'b', name: 'Coffee', calories: 50, time: '07:00' },
    ]);
    expect(g.map(x => x.id)).toEqual(['breakfast', 'dinner', 'snacks']);
    expect(g[0].meals.map(m => m.id)).toEqual(['b', 'a']);
    expect(g.map(x => x.kcal)).toEqual([400, 800, 200]);
  });
  it('handles an empty day', () => {
    expect(groupBySection([])).toEqual([]);
  });
});
