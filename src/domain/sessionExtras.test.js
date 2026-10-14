import { describe, it, expect } from 'vitest';
import { EXERCISE_DB } from './exerciseDb.js';
import { exerciseDetail, missingDetail } from './exerciseDetail.js';
import { warmupRamp } from './plates.js';
import { carryForward, loadWarmups, saveWarmups, clearWarmups } from './sessionDraft.js';

const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

describe('exercise detail', () => {
  it('has a grip and set-up for every exercise in the database', () => {
    expect(missingDetail(EXERCISE_DB.map(e => e.name))).toEqual([]);
  });
  it('joins the grip, set-up and the database form cue, by name in any case', () => {
    const d = exerciseDetail('lat pulldown');
    expect(d.grip).toMatch(/overhand/i);
    expect(d.setup).toBeTruthy();
    expect(d.cue).toBeTruthy();
    expect(exerciseDetail('Chin-ups').grip).toMatch(/underhand/i);
    expect(exerciseDetail('My made-up lift')).toBeNull();
  });
});

describe('warm-up ramp', () => {
  it('uses the barbell ramp for barbell lifts', () => {
    expect(warmupRamp(100, { barbell: true, bar: 20 })).toEqual([{ weight: 20, reps: 10 }, { weight: 40, reps: 5 }, { weight: 60, reps: 3 }, { weight: 80, reps: 2 }]);
  });
  it('gives dumbbells and machines two lighter sets rounded to their own jump', () => {
    expect(warmupRamp(30, { step: 2 })).toEqual([{ weight: 16, reps: 8 }, { weight: 22, reps: 4 }]);
    expect(warmupRamp(50, { step: 5 })).toEqual([{ weight: 25, reps: 8 }, { weight: 40, reps: 4 }]);
  });
  it('never reaches the working weight, and gives bodyweight lifts one easy set', () => {
    expect(warmupRamp(2, { step: 2.5 })).toEqual([]);
    expect(warmupRamp(0)).toEqual([]);
    expect(warmupRamp(0, { bodyweight: true, workReps: 10 })).toEqual([{ weight: 0, reps: 5 }]);
  });
});

describe('carry the last logged set forward', () => {
  const rows = [
    { weight: '60', reps: '8', done: true },
    { weight: '57.5', reps: '8', done: false },
    { weight: '57.5', reps: '8', done: false, touched: true },
    { weight: '57.5', reps: '8', done: false },
  ];
  it('copies weight and reps into later sets you have not typed into', () => {
    const out = carryForward(rows, 0);
    expect(out.map(r => `${r.weight}x${r.reps}`)).toEqual(['60x8', '60x8', '57.5x8', '60x8']);
  });
  it('leaves earlier and logged sets alone', () => {
    const out = carryForward([{ weight: '50', reps: '5', done: false }, { weight: '60', reps: '6', done: true }, { weight: '40', reps: '9', done: true }], 1);
    expect(out[0].weight).toBe('50');
    expect(out[2].weight).toBe('40');
  });
});

describe('warm-up rows on the device', () => {
  it('keeps today only, and clears', () => {
    const s = memory();
    saveWarmups('2026-10-14', { a: [{ weight: '20', reps: '10', done: true }], b: [] }, s);
    expect(loadWarmups('2026-10-14', s)).toEqual({ a: [{ weight: '20', reps: '10', done: true }] });
    expect(loadWarmups('2026-10-15', s)).toEqual({});
    clearWarmups(s);
    expect(loadWarmups('2026-10-14', s)).toEqual({});
  });
});

import { servingOptions, pickServing, remoteFood } from './foodLogger.js';
import { findByBarcode, buildIndex, barcodeKey } from './foodDb.js';

describe('serving size and number of servings', () => {
  const pack = remoteFood({ name: 'Protein Bar', brand: 'Acme', servingGrams: 60, serving: '1 bar (60 g)', per100: { calories: 380, protein: 33, carbs: 30, fat: 12 } });
  it('names the brand and starts on the pack serving', () => {
    expect(pack.name).toBe('Acme Protein Bar');
    expect(pack.defaultAmount).toBe(60);
    expect(servingOptions(pack).map(o => o.label)).toEqual(['1 bar (60 g)', '100 g', '1 g']);
    expect(servingOptions(remoteFood({ name: 'X', servingGrams: 30, per100: {} }))[0].label).toBe('1 serving (30 g)');
    expect(pickServing(pack, 60)).toEqual({ index: 0, servings: 1 });
    expect(pickServing(pack, 90)).toEqual({ index: 0, servings: 1.5 });
  });
  it('falls back to 100 g steps, then grams', () => {
    expect(pickServing(pack, 200)).toEqual({ index: 1, servings: 2 });   // 200 g is not whole bars, so 100 g x 2
    expect(pickServing(pack, 37)).toEqual({ index: 2, servings: 37 });
    const plain = remoteFood({ name: 'Rice', per100: { calories: 130 } });
    expect(servingOptions(plain).map(o => o.label)).toEqual(['100 g', '1 g']);
    expect(pickServing(plain, 250)).toEqual({ index: 0, servings: 2.5 });
  });
  it('counts servings for meals and own foods', () => {
    const meal = { amountKind: 'servings', unit: 'serving' };
    expect(servingOptions(meal)).toEqual([{ label: '1 serving', mult: 1 }]);
    expect(pickServing(meal, 2)).toEqual({ index: 0, servings: 2 });
  });
});

describe('barcode lookup in the bundled pack', () => {
  const index = buildIndex('branded', [['Greek Yoghurt', 'Chobani', 59, 10, 4, 0.2, 0, 4, 40, '1 tub (170 g)', 170, '0812345678901']]);
  it('finds a product by barcode, ignoring leading zeros', () => {
    expect(findByBarcode(index, '812345678901')?.name).toBe('Chobani Greek Yoghurt');
    expect(findByBarcode(index, '0812345678901')?.defaultAmount).toBe(170);
    expect(findByBarcode(index, '999')).toBeNull();
    expect(barcodeKey('00123')).toBe('123');
  });
});
