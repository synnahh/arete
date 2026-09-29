import { describe, it, expect } from 'vitest';
import { newStep, usesPerDay, supplyUsage, stepsFor, completion, tagsFor, routineWarnings, ALL_DAYS } from './skin.js';

const step = (name, when = 'both', days = ALL_DAYS, supplyId = null) => ({ ...newStep(name, when, supplyId), days });

describe('usage per day', () => {
  it('counts sessions and weekdays', () => {
    expect(usesPerDay(step('Cleanser', 'both'))).toBe(2);
    expect(usesPerDay(step('SPF', 'am'))).toBe(1);
    expect(usesPerDay(step('Retinol', 'pm', [1, 3, 5]))).toBeCloseTo(3 / 7, 3);
    expect(usesPerDay(step('Mask', 'pm', [0]))).toBeCloseTo(1 / 7, 3);
  });

  it('adds up every step linked to the same supply', () => {
    const steps = [step('Cleanser AM', 'am', ALL_DAYS, 'c1'), step('Cleanser PM', 'pm', ALL_DAYS, 'c1'), step('SPF', 'am', ALL_DAYS, 's1')];
    expect(supplyUsage(steps, 'c1')).toBe(2);
    expect(supplyUsage(steps, 's1')).toBe(1);
    expect(supplyUsage(steps, 'none')).toBe(0);
  });
});

describe("today's steps", () => {
  const steps = [step('Cleanser'), step('SPF 50', 'am'), step('Retinol', 'pm', [1, 3, 5])];
  it('filters by period and weekday, keeping routine order', () => {
    expect(stepsFor(steps, 'am', 1).map(s => s.name)).toEqual(['Cleanser', 'SPF 50']);
    expect(stepsFor(steps, 'pm', 1).map(s => s.name)).toEqual(['Cleanser', 'Retinol']);
    expect(stepsFor(steps, 'pm', 2).map(s => s.name)).toEqual(['Cleanser']);
  });

  it('counts ticks', () => {
    expect(completion(steps, { [steps[0].id]: true }, 'am', 1)).toEqual({ done: 1, total: 2 });
    expect(completion(steps, {}, 'pm', 2)).toEqual({ done: 0, total: 1 });
  });
});

describe('ingredient recognition', () => {
  it('finds ingredients in product names', () => {
    expect([...tagsFor('The Ordinary Retinol 0.5%')]).toEqual(['retinoid']);
    expect([...tagsFor('Glycolic acid toner')]).toEqual(['aha']);
    expect([...tagsFor('Vitamin C serum with niacinamide')].sort()).toEqual(['niacinamide', 'vitc']);
    expect([...tagsFor('Moisturiser')]).toEqual([]);
  });
});

describe('routine warnings', () => {
  it('flags a retinoid in the morning', () => {
    const w = routineWarnings([step('Retinol', 'both'), step('SPF', 'am')]);
    expect(w.some(x => x.level === 'warn' && /best at night/.test(x.text))).toBe(true);
  });

  it('flags retinoid + acid the same night but not on different nights', () => {
    const clash = routineWarnings([step('Retinol', 'pm', [1, 3]), step('Glycolic acid', 'pm', [1, 4]), step('SPF', 'am')]);
    expect(clash.some(x => /exfoliating acid/.test(x.text))).toBe(true);
    const alternate = routineWarnings([step('Retinol', 'pm', [1, 3]), step('Glycolic acid', 'pm', [2, 4]), step('SPF', 'am')]);
    expect(alternate.some(x => /exfoliating acid/.test(x.text))).toBe(false);
  });

  it('flags benzoyl peroxide with retinoids and vitamin C, only when they share a period', () => {
    expect(routineWarnings([step('Benzoyl peroxide 5%', 'pm'), step('Tretinoin', 'pm'), step('SPF', 'am')]).some(x => /break down/.test(x.text))).toBe(true);
    expect(routineWarnings([step('Vitamin C', 'am'), step('Benzoyl peroxide', 'am'), step('SPF', 'am')]).some(x => /oxidise/.test(x.text))).toBe(true);
    expect(routineWarnings([step('Vitamin C', 'am'), step('Benzoyl peroxide', 'pm'), step('SPF', 'am')]).some(x => /oxidise/.test(x.text))).toBe(false);
  });

  it('nudges for missing SPF, and stays quiet for an empty routine', () => {
    expect(routineWarnings([step('Cleanser')]).some(x => x.level === 'tip' && /No SPF/.test(x.text))).toBe(true);
    expect(routineWarnings([])).toEqual([]);
    expect(routineWarnings([step('Cleanser'), step('Sunscreen', 'am')])).toEqual([]);
  });
});
