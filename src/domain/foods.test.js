import { describe, it, expect } from 'vitest';
import { recentFoods } from './foods.js';

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
