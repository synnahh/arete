import { describe, it, expect } from 'vitest';
import { itemFromFood, itemFromEntry, rescaleItem, recipeTotals, perServing, recipeProblems, toSavedMeal, draftFromSaved, mealEntry, blankItem } from './recipes.js';

const rice = { name: 'Rice, dry', per100: { calories: 360, protein: 7, carbs: 79, fat: 0.6, micros: { iron: 1 } } };
const chicken = { name: 'Chicken breast', per100: { calories: 165, protein: 31, carbs: 0, fat: 3.6, micros: {} } };

describe('ingredients', () => {
  it('scales a database food by grams', () => {
    expect(itemFromFood(rice, 200)).toMatchObject({ name: 'Rice, dry', qty: 200, unit: 'g', calories: 720, protein: 14, carbs: 158, fat: 1.2, micros: { iron: 2 } });
    expect(itemFromFood(chicken, 150, 'ml').unit).toBe('ml');
  });
  it('takes a recent food as logged, using "each" when it had no weight', () => {
    expect(itemFromEntry({ name: 'Protein bar', calories: 210.4, protein: 20 })).toMatchObject({ qty: 1, unit: 'each', calories: 210, protein: 20 });
    expect(itemFromEntry({ name: 'Oats', qty: 40, unit: 'g', calories: 150 })).toMatchObject({ qty: 40, unit: 'g' });
  });
  it('rescales the numbers when the quantity changes', () => {
    const i = rescaleItem(itemFromFood(rice, 100), 250);
    expect(i).toMatchObject({ qty: 250, calories: 900, protein: 17.5, carbs: 197.5, micros: { iron: 2.5 } });
    expect(rescaleItem({ qty: 0, calories: 0 }, 50)).toMatchObject({ qty: 50, calories: 0 });
    // Clearing the field keeps the numbers; typing again scales from the remembered per-unit values.
    const cleared = rescaleItem(itemFromFood(rice, 100), '');
    expect(cleared).toMatchObject({ qty: '', calories: 360 });
    expect(rescaleItem(cleared, '50')).toMatchObject({ qty: '50', calories: 180, protein: 3.5 });
  });
});

describe('totals and servings', () => {
  const items = [itemFromFood(rice, 200), itemFromFood(chicken, 300)];
  it('adds the ingredients and divides by servings', () => {
    const t = recipeTotals(items);
    expect(t).toMatchObject({ calories: 1215, protein: 107, carbs: 158, fat: 12 });
    expect(perServing(t, 3)).toMatchObject({ calories: 405, protein: 35.7, carbs: 52.7, fat: 4 });
    expect(perServing(t, 0).calories).toBe(1215);
  });
  it('ignores junk values', () => {
    expect(recipeTotals([{ calories: 'x', protein: -5 }, { calories: 100 }]).calories).toBe(100);
  });
});

describe('validation', () => {
  it('lists what is missing', () => {
    expect(recipeProblems({ name: '', servings: 1, items: [] })).toEqual(['Give the recipe a name.', 'Add at least one ingredient.']);
    expect(recipeProblems({ name: 'A', servings: 0, items: [{ ...blankItem(), name: 'x', calories: 10 }] })).toEqual(['Servings must be between 1 and 100.']);
    expect(recipeProblems({ name: 'A', servings: 1, items: [{ ...blankItem(), name: 'x', qty: 0, calories: 10 }] })).toContain('Every ingredient needs a quantity above zero.');
    expect(recipeProblems({ name: 'A', servings: 1, items: [{ ...blankItem(), name: 'x' }] })).toContain('The ingredients add up to zero calories. Enter their calories.');
    expect(recipeProblems({ name: 'A', servings: 2, items: [itemFromFood(rice, 100)] })).toEqual([]);
  });
});

describe('saving and logging', () => {
  const draft = { name: ' Chicken rice ', servings: 3, items: [itemFromFood(rice, 200), itemFromFood(chicken, 300), { ...blankItem(), name: '' }, { ...itemFromEntry({ name: 'Sauce', calories: 60 }) }] };
  it('stores one serving at the top and the whole recipe inside', () => {
    const row = toSavedMeal(draft);
    expect(row).toMatchObject({ name: 'Chicken rice', servings: 3, calories: 425, recipe: { servings: 3 } });
    expect(row.recipe.items).toHaveLength(3);
    expect(row.ingredients).toEqual([{ name: 'Rice, dry', qty: 66.7, unit: 'g' }, { name: 'Chicken breast', qty: 100, unit: 'g' }]); // per serving; "each" items are not pantry weights
  });
  it('round-trips through the editor, and a plain meal opens as one ingredient', () => {
    const row = toSavedMeal(draft);
    const back = draftFromSaved(row);
    expect(back).toMatchObject({ name: 'Chicken rice', servings: 3 });
    expect(back.items).toHaveLength(3);
    const plain = draftFromSaved({ name: 'Shake', calories: 300, protein: 30 });
    expect(plain.items[0]).toMatchObject({ name: 'Shake', calories: 300, protein: 30, qty: 1, unit: 'each' });
  });
  it('logs portions of a serving with the ingredients scaled to match', () => {
    const row = { id: 'm1', ...toSavedMeal(draft) };
    const half = mealEntry(row, 0.5, new Date('2026-10-01T12:30:00'));
    expect(half).toMatchObject({ name: 'Chicken rice', portions: 0.5, calories: 213, savedMealId: 'm1', time: '12:30' });
    expect(half.ingredients[1]).toEqual({ name: 'Chicken breast', qty: 50, unit: 'g' });
    expect(mealEntry(row, 1).portions).toBeUndefined();
    expect(mealEntry(row, 'x').calories).toBe(425);
  });
  it('caps servings and drops blank ingredients', () => {
    expect(toSavedMeal({ name: 'x', servings: 500, items: [itemFromFood(rice, 100)] }).servings).toBe(100);
  });
});
