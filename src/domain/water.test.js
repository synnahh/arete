import { describe, it, expect } from 'vitest';
import { calcWaterGoal, expectedFraction, waterAdvice, profileKg, TRAINING_DAY_BONUS_ML } from './water.js';

const at = (h, m = 0) => new Date(2026, 8, 29, h, m);

describe('calcWaterGoal', () => {
  const p = { weight: 80, sex: 'male', activityHours: 7, caffeineMg: 200 };
  it('is 35 ml/kg plus the weekly training average, rounded to 50', () => {
    expect(calcWaterGoal(p)).toBe(3300);          // 2800 + 500
    expect(calcWaterGoal({ ...p, sex: 'female' })).toBe(3000); // 80*31 + 500 = 2980 → 3000
  });
  it('adds caffeine above 200 mg and a training-day bonus', () => {
    expect(calcWaterGoal({ ...p, caffeineMg: 400 })).toBe(3600);
    expect(calcWaterGoal(p, { trainedToday: true })).toBe(3300 + TRAINING_DAY_BONUS_ML);
  });
  it('honours pounds instead of treating them as kilograms', () => {
    const lb = { weight: 176, weightUnit: 'lb', sex: 'male', activityHours: 0, caffeineMg: 0 };
    expect(profileKg(lb)).toBeCloseTo(79.83, 1);
    expect(calcWaterGoal(lb)).toBe(2800);         // ≈ 79.8 kg × 35
  });
  it('falls back to the default profile', () => {
    expect(calcWaterGoal()).toBeGreaterThan(2000);
    expect(calcWaterGoal({})).toBeGreaterThan(2000);
  });
});

describe('expectedFraction', () => {
  it('runs from wake to bed', () => {
    expect(expectedFraction(at(6))).toBe(0);
    expect(expectedFraction(at(14, 30))).toBeCloseTo(0.5, 2);   // midpoint of 07:00–22:00
    expect(expectedFraction(at(23))).toBe(1);
  });
  it('uses your own wake and bed times and survives a bad bedtime', () => {
    expect(expectedFraction(at(12), { wake: '08:00', bed: '20:00' })).toBeCloseTo(4 / 12, 3);
    expect(expectedFraction(at(15), { wake: '07:00', bed: '01:00' })).toBeCloseTo(8 / 15, 3);  // bed before wake → 22:00
  });
});

describe('waterAdvice', () => {
  const goal = 3000;
  it('celebrates the goal, then stops nagging', () => {
    expect(waterAdvice({ totalMl: 3000, goalMl: goal, now: at(10) }).status).toBe('done');
  });
  it('is gentle before the day starts', () => {
    expect(waterAdvice({ totalMl: 0, goalMl: goal, now: at(6) }).status).toBe('early');
  });
  it('says how far behind and what to drink now', () => {
    const a = waterAdvice({ totalMl: 500, goalMl: goal, now: at(14, 30) });   // expected 1500
    expect(a).toMatchObject({ status: 'behind', expectedMl: 1500, sipMl: 750 });
    expect(a.message).toMatch(/1000 ml behind/);
    expect(waterAdvice({ totalMl: 1200, goalMl: goal, now: at(14, 30) }).sipMl).toBe(300);
  });
  it('recognises on pace and ahead', () => {
    expect(waterAdvice({ totalMl: 1400, goalMl: goal, now: at(14, 30) }).status).toBe('on-pace');
    expect(waterAdvice({ totalMl: 2000, goalMl: goal, now: at(14, 30) }).status).toBe('ahead');
  });
  it('is silent without a goal', () => {
    expect(waterAdvice({ totalMl: 100, goalMl: 0, now: at(10) })).toBeNull();
  });
});
