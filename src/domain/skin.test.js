import { describe, it, expect } from 'vitest';
import { newStep, usesPerDay, supplyUsage, stepsFor, completion, tagsFor, routineWarnings, ALL_DAYS, ratingTrend, dayAdherence, routineInsight } from './skin.js';

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

describe('skin rating', () => {
  const day = (back) => new Date(Date.UTC(2026, 8, 30 - back)).toISOString().slice(0, 10);
  const row = (back, skinRating, skin) => ({ date: day(back), skinRating, ...(skin ? { skin } : {}) });

  it('averages the last 7 days and compares with the week before', () => {
    const rows = [row(0, 4), row(1, 5), row(3, 4), row(8, 2), row(9, 3), row(11, 3)];
    expect(ratingTrend(rows, day(0))).toEqual({ status: 'ok', avg: 4.3, count: 3, prevAvg: 2.7, delta: 1.6 });
  });
  it('needs 3 ratings this week, and 3 last week for a change', () => {
    expect(ratingTrend([row(0, 4), row(1, 4)], day(0)).status).toBe('insufficient');
    const t = ratingTrend([row(0, 4), row(1, 4), row(2, 5), row(9, 3)], day(0));
    expect(t.status).toBe('ok');
    expect(t.delta).toBeNull();
  });
  it('ignores junk ratings and bad dates', () => {
    const rows = [row(0, 9), row(1, 0), row(2, 'x'), { date: 'nope', skinRating: 4 }, row(3, 3.5), row(4, 4), row(5, 4), row(6, 4)];
    expect(ratingTrend(rows, day(0))).toMatchObject({ status: 'ok', count: 3, avg: 4 });
  });

  const steps = [{ ...newStep('Cleanser', 'both'), days: ALL_DAYS }, { ...newStep('SPF', 'am'), days: ALL_DAYS }];
  const all = { am: { [steps[0].id]: true, [steps[1].id]: true }, pm: { [steps[0].id]: true } };
  it('measures how much of the day\'s routine was done', () => {
    expect(dayAdherence(steps, { date: day(0), skin: all })).toBe(1);
    expect(dayAdherence(steps, { date: day(0), skin: { am: { [steps[0].id]: true } } })).toBeCloseTo(1 / 3, 3);
    expect(dayAdherence(steps, { date: day(0) })).toBe(0);
    expect(dayAdherence([], { date: day(0) })).toBeNull();
  });

  it('compares rated days with a full routine against days with little of it', () => {
    const good = Array.from({ length: 5 }, (_, i) => row(i, 5, all));
    const bad = Array.from({ length: 5 }, (_, i) => row(i + 5, 2, {}));
    expect(routineInsight([...good, ...bad], steps, day(0))).toEqual({ high: { avg: 5, days: 5 }, low: { avg: 2, days: 5 }, diff: 3 });
  });
  it('stays quiet without enough data in both groups', () => {
    const good = Array.from({ length: 8 }, (_, i) => row(i, 5, all));
    expect(routineInsight(good, steps, day(0))).toBeNull();
    expect(routineInsight([], steps, day(0))).toBeNull();
    expect(routineInsight(good, [], day(0))).toBeNull();
  });
});
