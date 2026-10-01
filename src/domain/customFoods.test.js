import { describe, it, expect } from 'vitest';
import { customFoodProblems, makeCustomFood, formFromCustomFood, servingText, customFoodEntry, itemFromCustom, favouriteFromEntry, isFavourite, toggleFavourite, favouriteEntry, MAX_FAVOURITES } from './customFoods.js';

const form = { name: ' Protein bar ', brand: 'Brand X', servingQty: '60', servingUnit: 'g', calories: '210', protein: '20', carbs: '', fat: '7.46' };
const NOW = new Date('2026-10-01T08:05:00');

describe('custom foods', () => {
  it('lists what is wrong with a form', () => {
    expect(customFoodProblems({})).toEqual(['Give the food a name.', 'Serving size must be above zero.', 'Enter calories for one serving (1 to 10,000).']);
    expect(customFoodProblems({ ...form, calories: '20000' })).toEqual(['Enter calories for one serving (1 to 10,000).']);
    expect(customFoodProblems({ ...form, protein: '-4', fat: '5000' })).toEqual(['Protein must be between 0 and 1000 g.', 'Fat must be between 0 and 1000 g.']);
    expect(customFoodProblems(form)).toEqual([]);
  });

  it('stores clean numbers for one serving and round-trips through the editor', () => {
    const row = makeCustomFood(form);
    expect(row).toEqual({ name: 'Protein bar', brand: 'Brand X', serving: { qty: 60, unit: 'g' }, calories: 210, protein: 20, carbs: 0, fat: 7.5 });
    expect(formFromCustomFood({ id: 'a', ...row })).toMatchObject({ id: 'a', name: 'Protein bar', servingQty: 60, servingUnit: 'g', calories: 210 });
    expect(servingText(row)).toBe('60 g');
    expect(makeCustomFood({ ...form, servingUnit: 'bogus' }).serving.unit).toBe('serving');
  });

  it('logs servings with the amount scaled, and brings the brand into the name', () => {
    const food = { id: 'f1', ...makeCustomFood(form) };
    const e = customFoodEntry(food, 1.5, NOW);
    expect(e).toMatchObject({ name: 'Protein bar (Brand X)', calories: 315, protein: 30, fat: 11.3, qty: 90, unit: 'g', time: '08:05', customFoodId: 'f1' });
    expect(customFoodEntry(food, 'x', NOW).calories).toBe(210);
  });

  it('becomes a recipe ingredient, using "each" for non-weights', () => {
    expect(itemFromCustom({ ...makeCustomFood(form) }, 2)).toMatchObject({ qty: 120, unit: 'g', calories: 420 });
    expect(itemFromCustom(makeCustomFood({ ...form, servingUnit: 'serving', servingQty: 1 }), 1).unit).toBe('each');
  });
});

describe('favourites', () => {
  const logged = { name: 'Chicken & rice', calories: 640.4, protein: 48, carbs: 70, fat: 12, qty: 450, unit: 'g', micros: { iron: 2 }, ingredients: [{ name: 'Rice', qty: 80, unit: 'g' }, { name: '', qty: 5, unit: 'g' }] };

  it('snapshots any logged entry', () => {
    expect(favouriteFromEntry(logged)).toEqual({ name: 'Chicken & rice', calories: 640, protein: 48, carbs: 70, fat: 12, micros: { iron: 2 }, qty: 450, unit: 'g', ingredients: [{ name: 'Rice', qty: 80, unit: 'g' }] });
  });

  it('stars and unstars by name, ignoring case and spacing, newest first', () => {
    const a = toggleFavourite([], logged);
    expect(a.added).toBe(true);
    const b = toggleFavourite(a.list, { name: 'Oats', calories: 300 });
    expect(b.list.map(f => f.name)).toEqual(['Oats', 'Chicken & rice']);
    expect(isFavourite(b.list, '  chicken   & RICE ')).toBe(true);
    const c = toggleFavourite(b.list, { ...logged, name: 'chicken & rice' });
    expect(c.added).toBe(false);
    expect(c.list.map(f => f.name)).toEqual(['Oats']);
  });

  it('refuses nameless or zero-calorie entries and caps the list', () => {
    expect(toggleFavourite([], { name: '', calories: 100 }).rejected).toBe(true);
    expect(toggleFavourite([], { name: 'Water', calories: 0 }).rejected).toBe(true);
    let list = [];
    for (let i = 0; i < MAX_FAVOURITES + 5; i++) list = toggleFavourite(list, { name: `Food ${i}`, calories: 100 }).list;
    expect(list).toHaveLength(MAX_FAVOURITES);
    expect(list[0].name).toBe(`Food ${MAX_FAVOURITES + 4}`);
  });

  it('logs a favourite exactly as starred', () => {
    const fav = favouriteFromEntry(logged);
    expect(favouriteEntry(fav, NOW)).toMatchObject({ name: 'Chicken & rice', calories: 640, qty: 450, unit: 'g', time: '08:05', micros: { iron: 2 }, ingredients: [{ name: 'Rice', qty: 80, unit: 'g' }] });
    expect(favouriteEntry({ name: 'Bar', calories: 200 }, NOW).ingredients).toBeUndefined();
  });
});
