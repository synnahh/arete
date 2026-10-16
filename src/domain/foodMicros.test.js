import { describe, it, expect } from 'vitest';
import { buildIndex, dbFood, microsOf, attachMicros } from './foodDb.js';
import { makeCustomFood, customFoodEntry, formFromCustomFood, cleanExtra } from './customFoods.js';
import { buildMicros, csvLine, ORDER } from '../../scripts/build-food-micros.mjs';
import { macrosFor, entryFor } from './foodLogger.js';

const generic = [['Beef, ground, 90% lean, raw', 176, 20, 0, 10, 0, 0, 66, 'Beef', '']];

describe('micros on bundled foods', () => {
  it('always carries fibre, sugars and sodium from the pack, even without the micros pack', () => {
    const idx = buildIndex('generic', [['Oats, rolled', 379, 13, 68, 6.5, 10.1, 1, 6, 'Cereal', '']]);
    expect(microsOf(idx[0])).toEqual({ fiber: 10.1, sugars: 1, sodium: 6 });
  });
  it('adds vitamins and minerals from the micros pack by exact name, as per-100 g values', () => {
    const idx = buildIndex('generic', generic);
    const n = attachMicros(idx, { order: ['iron', 'zinc', 'b12'], rows: { 'Beef, ground, 90% lean, raw': [2.3, 4.8, null] } });
    expect(n).toBe(1);
    expect(dbFood(idx[0]).per100.micros).toMatchObject({ iron: 2.3, zinc: 4.8, sodium: 66 });
    expect(dbFood(idx[0]).per100.micros.b12).toBeUndefined();
  });
  it('scales micros into the logged entry for the amount eaten', () => {
    const idx = buildIndex('generic', generic);
    attachMicros(idx, { order: ['iron'], rows: { 'Beef, ground, 90% lean, raw': [2.3] } });
    const food = dbFood(idx[0]);
    expect(macrosFor(food, 250).micros.iron).toBe(5.75);
    expect(entryFor(food, 250).micros).toMatchObject({ iron: 5.75, sodium: 165 });
  });
});

describe('custom food micros', () => {
  it('stores only valid positive numbers and scales them by servings', () => {
    expect(cleanExtra({ iron: '3.5', zinc: '', calcium: 'abc', fiber: '0', bogus: '5' })).toEqual({ iron: 3.5 });
    const row = makeCustomFood({ name: 'Bar', servingQty: 40, servingUnit: 'g', calories: 200, protein: 20, carbs: 15, fat: 6, micros: { iron: '3', fiber: '5' } });
    expect(row.micros).toEqual({ iron: 3, fiber: 5 });
    expect(customFoodEntry(row, 2).micros).toEqual({ iron: 6, fiber: 10 });
    expect(formFromCustomFood(row).micros).toEqual({ iron: '3', fiber: '5' });
    expect(makeCustomFood({ name: 'Plain', servingQty: 1, calories: 50 }).micros).toBeUndefined();
  });
});

describe('build-food-micros script core', () => {
  it('parses quoted CSV lines', () => { expect(csvLine('2,"a ""q"" b",3')).toEqual(['2', 'a "q" b', '3']); });
  it('maps nutrient numbers to keys, skips unwanted foods, keeps unknown as null', () => {
    const out = buildMicros({
      foods: [{ id: 1, name: 'Beef, ground, 90% lean, raw' }, { id: 2, name: 'Other' }],
      nutrients: [{ id: 10, number: 303 }, { id: 11, number: 309 }, { id: 12, number: 999 }],
      amounts: [{ food: 1, nutrient: 10, amount: '2.3' }, { food: 1, nutrient: 12, amount: '9' }, { food: 2, nutrient: 11, amount: '1' }],
      wanted: new Set(['Beef, ground, 90% lean, raw']),
    });
    expect(Object.keys(out.rows)).toEqual(['Beef, ground, 90% lean, raw']);
    const row = out.rows['Beef, ground, 90% lean, raw'];
    expect(row[ORDER.indexOf('iron')]).toBe(2.3);
    expect(row[ORDER.indexOf('zinc')]).toBeNull();
  });
});
