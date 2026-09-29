import { describe, it, expect } from 'vitest';
import { waterRow, sleepRow, nutritionDay } from './dayLogs.js';

const at = new Date(2026, 8, 29, 7, 5); // 07:05 local

describe('waterRow', () => {
  it('matches the row Fuel writes and clamps silly amounts', () => {
    expect(waterRow({ date: '2026-09-29', amountMl: 330, now: at })).toEqual({ date: '2026-09-29', amount: 330, time: '07:05', source: 'assistant' });
    expect(waterRow({ date: 'd', amountMl: 99999, now: at }).amount).toBe(2000);
    expect(waterRow({ date: 'd', amountMl: 'x', now: at }).amount).toBe(250);
  });
});

describe('sleepRow', () => {
  it('stores minutes in the shape sleep_data readers use', () => {
    expect(sleepRow({ date: 'd', hours: 7.5 })).toMatchObject({ date: 'd', duration: 450 });
  });

  it('keeps Apple Health stages and efficiency already on that date', () => {
    const existing = { date: 'd', duration: 400, efficiency: 88, stages: { deep: 60 }, source: 'apple' };
    expect(sleepRow({ date: 'd', hours: 7, existing })).toEqual({ date: 'd', duration: 420, efficiency: 88, stages: { deep: 60 }, source: 'apple' });
  });

  it('rejects nonsense hours', () => {
    expect(sleepRow({ date: 'd', hours: 0 })).toBeNull();
    expect(sleepRow({ date: 'd', hours: 30 })).toBeNull();
    expect(sleepRow({ date: 'd', hours: 'lots' })).toBeNull();
  });
});

describe('nutritionDay', () => {
  it('creates the day with one meal and totals', () => {
    const row = nutritionDay({ date: 'd', entry: { calories: 520, protein: 38, meal: 'Lunch' }, now: at });
    expect(row).toMatchObject({ date: 'd', calories: 520, protein: 38, carbs: 0, fat: 0 });
    expect(row.meals).toHaveLength(1);
    expect(row.meals[0]).toMatchObject({ name: 'Lunch', time: '07:05' });
  });

  it('adds to an existing day and re-sums instead of replacing it', () => {
    const existing = { date: 'd', meals: [{ name: 'Breakfast', calories: 400, protein: 30, carbs: 40, fat: 10 }], calories: 400, protein: 30, carbs: 40, fat: 10, extra: 'kept' };
    const row = nutritionDay({ date: 'd', entry: { calories: 600, protein: 40 }, existing, now: at });
    expect(row.meals).toHaveLength(2);
    expect(row).toMatchObject({ calories: 1000, protein: 70, carbs: 40, fat: 10, extra: 'kept' });
  });

  it('ignores a missing or zero calorie amount', () => {
    expect(nutritionDay({ date: 'd', entry: { calories: 0 } })).toBeNull();
    expect(nutritionDay({ date: 'd', entry: {} })).toBeNull();
  });
});
