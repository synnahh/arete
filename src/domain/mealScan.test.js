import { describe, it, expect } from 'vitest';
import { parseMealEstimate, entryFromEstimate } from './mealScan.js';

const reply = (o) => JSON.stringify(o);

describe('parseMealEstimate', () => {
  it('reads a clean reply', () => {
    const r = parseMealEstimate(reply({ food: true, name: 'Chicken rice bowl', items: ['200 g chicken', '1 cup rice'], calories: 702.4, protein: 51, carbs: 70, fat: 18, confidence: 'medium', note: 'Sauce unclear' }));
    expect(r).toEqual({ ok: true, estimate: { name: 'Chicken rice bowl', items: ['200 g chicken', '1 cup rice'], ingredients: [], calories: 702, protein: 51, carbs: 70, fat: 18, confidence: 'medium', note: 'Sauce unclear' } });
  });
  it('finds the JSON inside chatter and code fences', () => {
    const r = parseMealEstimate('Sure! Here you go:\n```json\n{"food":true,"name":"Toast","items":[],"calories":180,"protein":6,"carbs":30,"fat":3,"confidence":"high"}\n```\nHope that helps {really}.');
    expect(r.ok).toBe(true);
    expect(r.estimate.calories).toBe(180);
  });
  it('copes with braces and quotes inside strings', () => {
    const r = parseMealEstimate('{"food":true,"name":"Mum\'s \\"famous\\" {stew}","calories":400,"protein":20,"carbs":30,"fat":15,"confidence":"low"}');
    expect(r.ok).toBe(true);
    expect(r.estimate.name).toBe('Mum\'s "famous" {stew}');
  });
  it('says so when there is no food', () => {
    expect(parseMealEstimate('{"food":false}')).toEqual({ ok: false, reason: 'No food spotted in that photo.' });
  });
  it('rejects unreadable replies and impossible numbers', () => {
    for (const bad of ['', 'I cannot see a photo', '{not json}', reply({ food: true, calories: 0 }), reply({ food: true, calories: 90000 }), reply({ food: true, calories: 'lots' }), null, undefined]) {
      expect(parseMealEstimate(bad).ok).toBe(false);
    }
  });
  it('clamps macros, defaults confidence, and caps the item list', () => {
    const r = parseMealEstimate(reply({ food: true, calories: 500, protein: 9999, carbs: -5, fat: 'x', confidence: 'certain', items: Array.from({ length: 20 }, (_, i) => `item ${i}`) }));
    expect(r.estimate).toMatchObject({ protein: 0, carbs: 0, fat: 0, confidence: 'low', name: 'Meal from photo' });
    expect(r.estimate.items).toHaveLength(8);
  });
});

describe('entryFromEstimate', () => {
  it('makes a log entry that is marked as an estimate', () => {
    const e = entryFromEstimate({ name: 'Bowl', calories: 700, protein: 50, carbs: 60, fat: 20 }, new Date(2026, 8, 30, 13, 5));
    expect(e).toMatchObject({ name: 'Bowl', calories: 700, protein: 50, time: '13:05', estimated: true, source: 'photo' });
    expect(e.quick).toBeUndefined();
  });
  it('refuses an edited estimate with no calories', () => {
    expect(entryFromEstimate({ name: 'x', calories: 0 })).toBeNull();
  });
});

describe('ingredients in an estimate', () => {
  const withIng = reply({ food: true, name: 'Bowl', calories: 700, protein: 50, carbs: 60, fat: 20, ingredients: [
    { name: 'Chicken breast', qty: 200, unit: 'g' }, { name: 'Rice', qty: '150', unit: 'g' }, { name: '', qty: 5 }, { name: 'Eggs', qty: 2, unit: '' }, 'junk',
  ] });
  it('keeps clean ingredient rows and drops the rest', () => {
    expect(parseMealEstimate(withIng).estimate.ingredients).toEqual([
      { name: 'Chicken breast', qty: 200, unit: 'g' }, { name: 'Rice', qty: 150, unit: 'g' }, { name: 'Eggs', qty: 2, unit: '' },
    ]);
  });
  it('carries them onto the log entry so the pantry can use them, and records the source', () => {
    const est = { ...parseMealEstimate(withIng).estimate, source: 'text' };
    const e = entryFromEstimate(est, new Date(2026, 8, 30, 12, 0));
    expect(e.ingredients).toHaveLength(3);
    expect(e).toMatchObject({ estimated: true, source: 'text' });
  });
  it('caps the list at 12', () => {
    const many = reply({ food: true, calories: 500, ingredients: Array.from({ length: 30 }, (_, i) => ({ name: 'Food ' + i, qty: 10, unit: 'g' })) });
    expect(parseMealEstimate(many).estimate.ingredients).toHaveLength(12);
  });
});
