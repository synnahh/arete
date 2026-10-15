import { describe, it, expect } from 'vitest';
import { parseMealPlan, buildPlanPrompt, planIngredients, emptyPlan, normaliseDay, normaliseType, makeDay } from './mealPlanImport.js';

const json = { plan: [{ day: 'Monday', meals: [
  { name: 'Oats', type: 'breakfast', calories: 450, protein: 30, carbs: 55, fat: 9, ingredients: [{ name: 'Oats', qty: 80, unit: 'g' }] },
  { name: 'Beef bowl', type: 'dinner', calories: 650, protein: 45, carbs: 70, fat: 18, estimatedCost: 6.5, ingredients: [{ name: 'oats', qty: 20, unit: 'g' }, { name: 'Eggs', qty: 2, unit: '' }] },
] }] };

describe('parseMealPlan', () => {
  it('reads the JSON the prompt asks for, recomputing totals', () => {
    const r = parseMealPlan(JSON.stringify({ plan: [{ ...json.plan[0], totals: { calories: 1 } }] }));
    expect(r.ok).toBe(true);
    expect(r.plan[0].totals).toEqual({ calories: 1100, protein: 75, carbs: 125, fat: 27, cost: 6.5 });
  });

  it('finds JSON inside chatty text and code fences', () => {
    const r = parseMealPlan('Sure! Here you go:\n```json\n' + JSON.stringify(json) + '\n```\nEnjoy.');
    expect(r.ok).toBe(true);
    expect(r.meals).toBe(2);
  });

  it('accepts a bare array of days, a days key, and day-keyed objects', () => {
    expect(parseMealPlan(JSON.stringify(json.plan)).ok).toBe(true);
    expect(parseMealPlan(JSON.stringify({ days: json.plan })).ok).toBe(true);
    const keyed = parseMealPlan(JSON.stringify({ Mon: json.plan[0].meals, tuesday: { meals: json.plan[0].meals } }));
    expect(keyed.plan.map(d => d.day)).toEqual(['Monday', 'Tuesday']);
  });

  it('treats a bare array of meals as one day', () => {
    const r = parseMealPlan(JSON.stringify(json.plan[0].meals));
    expect(r.plan).toHaveLength(1);
    expect(r.plan[0].meals).toHaveLength(2);
  });

  it('reads plain text with day headings and macros', () => {
    const r = parseMealPlan(`# Monday
- Breakfast: Oats and whey - 450 kcal, 35g protein, 55g carbs, 9g fat
  - stir the whey in after cooking
- Lunch: Chicken wrap (620 kcal, P45 C60 F18)
**Tuesday**
Dinner: Beef bowl 650 kcal 45P 70C 18F`);
    expect(r.ok).toBe(true);
    expect(r.plan.map(d => d.day)).toEqual(['Monday', 'Tuesday']);
    const [oats, wrap] = r.plan[0].meals;
    expect(oats).toMatchObject({ name: 'Oats and whey', type: 'breakfast', calories: 450, protein: 35, carbs: 55, fat: 9 });
    expect(oats.description).toMatch(/stir the whey/);
    expect(wrap).toMatchObject({ name: 'Chicken wrap', type: 'lunch', calories: 620, protein: 45, carbs: 60, fat: 18 });
    expect(r.plan[1].meals[0]).toMatchObject({ name: 'Beef bowl', type: 'dinner', calories: 650, protein: 45, carbs: 70, fat: 18 });
  });

  it('puts meals before any heading on Monday', () => {
    expect(parseMealPlan('Toast 200 kcal').plan[0].day).toBe('Monday');
  });

  it('refuses empty and meal-free text with a reason', () => {
    expect(parseMealPlan('').ok).toBe(false);
    expect(parseMealPlan('Eat well and sleep more.').reason).toMatch(/No meals/);
  });

  it('warns about meals with no calories instead of dropping them', () => {
    const r = parseMealPlan(JSON.stringify({ plan: [{ day: 'Monday', meals: [{ name: 'Mystery', protein: 5 }] }] }));
    expect(r.ok).toBe(true);
    expect(r.warnings[0]).toMatch(/Mystery/);
  });

  it('survives a brace inside a string and invalid JSON', () => {
    expect(parseMealPlan('{"plan":[{"day":"Mon","meals":[{"name":"Mac {and} cheese","calories":500}]}]}').plan[0].meals[0].name).toBe('Mac {and} cheese');
    expect(parseMealPlan('{ "plan": [ broken').ok).toBe(false);
  });
});

describe('helpers', () => {
  it('normalises days and types', () => {
    expect(normaliseDay('tues')).toBe('Tuesday');
    expect(normaliseDay('Day 3')).toBe('Day 3');
    expect(normaliseDay('Salad')).toBe('');
    expect(normaliseType('Brekkie')).toBe('breakfast');
    expect(normaliseType('post-workout')).toBe('snack');
  });

  it('adds ingredients across the plan by name and unit', () => {
    const list = planIngredients(parseMealPlan(JSON.stringify(json)).plan);
    expect(list.find(i => i.name.toLowerCase() === 'oats')).toMatchObject({ qty: 100, unit: 'g' });
    expect(list.find(i => i.name === 'Eggs').qty).toBe(2);
  });

  it('makes seven empty days and a day with totals', () => {
    expect(emptyPlan()).toHaveLength(7);
    expect(makeDay('Monday', [{ name: 'A', calories: 100, protein: 5 }]).totals.calories).toBe(100);
  });

  it('builds a prompt carrying the targets', () => {
    const p = buildPlanPrompt({ calories: 2200, protein: 160, notes: 'no dairy' });
    expect(p).toMatch(/2200 kcal/);
    expect(p).toMatch(/no dairy/);
    expect(p).toMatch(/"plan"/);
  });
});

import { parseIngredientLines, ingredientsToText, mergePlans } from './mealPlanImport.js';

describe('typed ingredients', () => {
  it('reads quantity-first, name-first and whole items', () => {
    expect(parseIngredientLines('200 g chicken breast\n2 eggs\nrice 150g\n- 1 tbsp olive oil\nnonsense')).toEqual([
      { name: 'chicken breast', qty: 200, unit: 'g' },
      { name: 'eggs', qty: 2, unit: '' },
      { name: 'rice', qty: 150, unit: 'g' },
      { name: 'olive oil', qty: 1, unit: 'tbsp' },
    ]);
  });
  it('round-trips through text', () => {
    const list = [{ name: 'oats', qty: 80, unit: 'g' }, { name: 'eggs', qty: 2, unit: '' }];
    expect(parseIngredientLines(ingredientsToText(list))).toEqual(list);
  });
});

describe('mergePlans', () => {
  it('appends to the same day and keeps week order', () => {
    const a = [makeDay('Tuesday', [{ name: 'A', calories: 100 }])];
    const b = [makeDay('Monday', [{ name: 'B', calories: 200 }]), makeDay('Tuesday', [{ name: 'C', calories: 300 }])];
    const r = mergePlans(a, b);
    expect(r.map(d => d.day)).toEqual(['Monday', 'Tuesday']);
    expect(r[1].meals.map(m => m.name)).toEqual(['A', 'C']);
    expect(r[1].totals.calories).toBe(400);
  });
});
