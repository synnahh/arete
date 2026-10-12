import { describe, it, expect } from 'vitest';
import {
  localFoods, remoteFood, searchLocal, quickPicks, mergeResults, macrosFor, amountChips, startAmount,
  entryFor, quickFoodEntry, remember, defaultSection, portionKey,
} from './foodLogger.js';
import { groupBySection } from './foods.js';

const favourites = [{ name: 'Greek yoghurt', calories: 120, protein: 17, carbs: 6, fat: 2, qty: 170, unit: 'g', micros: {} }];
const recents = [
  { name: 'Chicken breast, grilled', calories: 330, protein: 62, carbs: 0, fat: 7, qty: 200, unit: 'g', count: 9, micros: {} },
  { name: 'Protein bar', calories: 210, protein: 20, carbs: 22, fat: 7, qty: null, unit: null, count: 3, micros: {} },
];
const customFoods = [{ id: 'c1', name: 'Oats', brand: 'Uncle Tobys', calories: 190, protein: 7, carbs: 32, fat: 4, serving: { qty: 50, unit: 'g' } }];
const savedMeals = [{ id: 's1', name: 'Chicken rice bowl', calories: 640, protein: 52, carbs: 70, fat: 14, ingredients: [{ name: 'Rice', qty: 150, unit: 'g' }] }];
const foods = localFoods({ favourites, recents, customFoods, savedMeals });

describe('localFoods', () => {
  it('turns what you own into foods, favourites first, no duplicates by name', () => {
    expect(foods.map(f => f.kind)).toEqual(['favourite', 'recent', 'recent', 'custom', 'meal']);
    const dup = localFoods({ favourites, recents: [{ ...recents[0], name: 'greek YOGHURT' }] });
    expect(dup).toHaveLength(1);
  });
  it('scales a gram-based entry from its own numbers', () => {
    const chicken = foods.find(f => f.name.startsWith('Chicken breast'));
    expect(chicken.amountKind).toBe('grams');
    expect(chicken.per100.calories).toBeCloseTo(165, 5);
    expect(macrosFor(chicken, 100).protein).toBe(31);
  });
  it('keeps entries without grams as servings', () => {
    const bar = foods.find(f => f.name === 'Protein bar');
    expect(bar.amountKind).toBe('servings');
    expect(macrosFor(bar, 2).calories).toBe(420);
  });
  it('ignores empty or calorie-less rows', () => {
    expect(localFoods({ recents: [{ name: '', calories: 100 }, { name: 'x', calories: 0 }] })).toEqual([]);
  });
});

describe('search', () => {
  it('ranks an exact or prefix match above a loose one, and your picks above the rest', () => {
    const r = searchLocal('chick', foods);
    expect(r[0].name).toMatch(/^Chicken breast/);
    expect(r.map(f => f.name)).toContain('Chicken rice bowl');
  });
  it('needs every word to match', () => {
    expect(searchLocal('chicken rice', foods).map(f => f.name)).toEqual(['Chicken rice bowl']);
    expect(searchLocal('zzz', foods)).toEqual([]);
  });
  it('an empty query shows favourites then most-eaten', () => {
    expect(searchLocal('', foods).map(f => f.kind)).toEqual(['favourite', 'recent', 'recent']);
    expect(quickPicks(foods, 1)).toHaveLength(1);
  });
  it('puts database results after yours and drops same-name repeats', () => {
    const merged = mergeResults(searchLocal('chicken', foods), [remoteFood({ name: 'Chicken breast, grilled', per100: { calories: 1 } }), remoteFood({ name: 'Chicken stock', per100: { calories: 5 } })]);
    expect(merged.filter(f => f.name === 'Chicken breast, grilled')).toHaveLength(1);
    expect(merged[merged.length - 1].name).toBe('Chicken stock');
  });
});

describe('amounts', () => {
  const chicken = foods.find(f => f.name.startsWith('Chicken breast'));
  it('starts from what you used last time', () => {
    expect(startAmount(chicken, {})).toBe(200);
    expect(startAmount(chicken, { [portionKey(chicken.name)]: 180 })).toBe(180);
  });
  it('offers your usual amount first and no repeats', () => {
    expect(amountChips(chicken, 180)[0]).toBe(180);
    expect(amountChips(chicken, 100)).toEqual([100, 50, 150, 200, 250]);
  });
  it('remembers newest first and caps the list', () => {
    let m = {};
    for (let i = 0; i < 5; i++) m = remember(m, { name: `Food ${i}` }, 100 + i, 3);
    expect(Object.keys(m)).toEqual(['food 4', 'food 3', 'food 2']);
    expect(remember({}, { name: 'x' }, 0)).toEqual({});
  });
});

describe('entryFor', () => {
  const now = new Date(2026, 9, 11, 15, 5);
  it('builds a gram entry with the macros for that amount', () => {
    const chicken = foods.find(f => f.name.startsWith('Chicken breast'));
    const e = entryFor(chicken, 150, { now, section: 'lunch' });
    expect(e).toMatchObject({ name: 'Chicken breast, grilled', calories: 248, qty: 150, unit: 'g', time: '15:05', section: 'lunch' });
  });
  it('delegates saved meals and custom foods to their own builders', () => {
    const meal = entryFor(foods.find(f => f.kind === 'meal'), 2, { now });
    expect(meal).toMatchObject({ calories: 1280, portions: 2, savedMealId: 's1' });
    expect(meal.ingredients[0].qty).toBe(300);
    const oats = entryFor(foods.find(f => f.kind === 'custom'), 1.5, { now });
    expect(oats).toMatchObject({ calories: 285, customFoodId: 'c1' });
  });
  it('ignores a bad section and falls back to the default amount', () => {
    const e = entryFor(foods[0], 0, { now, section: 'brunch' });
    expect(e.section).toBeUndefined();
    expect(e.qty).toBe(170);
  });
  it('a lunch logged late still groups under Lunch', () => {
    const e = entryFor(foods[0], 170, { now, section: 'lunch' });
    expect(groupBySection([e])[0].id).toBe('lunch');
  });
  it('quick food needs calories', () => {
    expect(quickFoodEntry({ name: 'Mystery', calories: 0 })).toBeNull();
    expect(quickFoodEntry({ name: '', calories: '320', protein: '20' }, { now })).toMatchObject({ name: 'Quick add', calories: 320, protein: 20 });
  });
  it('picks the meal section from the clock', () => {
    expect(defaultSection(new Date(2026, 9, 11, 7, 0))).toBe('breakfast');
    expect(defaultSection(new Date(2026, 9, 11, 19, 0))).toBe('dinner');
  });
});

describe('merged results never repeat a list key', () => {
  it('drops a product the online search lists twice, and one already shown', async () => {
    const { mergeResults } = await import('./foodLogger.js');
    const f = (name, key) => ({ name, key });
    const out = mergeResults([f('Tim Tam', 'brand:a')], [f('Tim Tam', 'db:tim tam'), f('Kit Kat', 'db:kit kat'), f('Kit Kat', 'db:kit kat')], 10);
    expect(out.map(x => x.name)).toEqual(['Tim Tam', 'Kit Kat']);
    expect(new Set(out.map(x => x.key)).size).toBe(out.length);
  });
});
