import { describe, it, expect } from 'vitest';
import { suggestRoutine, newSteps, tierWarnings, TIERS } from './skinTiers.js';
import { stepsFor, routineWarnings } from './skin.js';

const names = (steps) => steps.map(s => s.name);

describe('suggestRoutine', () => {
  it('essential is cleanse, moisturise, sunscreen in the morning only', () => {
    const r = suggestRoutine('essential', {});
    expect(names(r)).toEqual(['Gentle cleanser', 'Moisturiser', 'Sunscreen SPF 30+']);
    expect(stepsFor(r, 'pm', 1).map(s => s.name)).toEqual(['Gentle cleanser', 'Moisturiser']);
    expect(stepsFor(r, 'am', 1).map(s => s.name)).toContain('Sunscreen SPF 30+');
  });

  it('each tier includes the one before it', () => {
    const a = names(suggestRoutine('essential', { concerns: ['acne'] }));
    const b = names(suggestRoutine('complete', { concerns: ['acne'] }));
    const c = names(suggestRoutine('power', { concerns: ['acne'] }));
    a.forEach(n => expect(b).toContain(n));
    b.forEach(n => expect(c).toContain(n));
    expect(b).toContain('Niacinamide serum');
    expect(c).toContain('Retinol serum');
  });

  it('picks the treatment from the concern, morning or night', () => {
    const pig = suggestRoutine('complete', { concerns: ['pigmentation'] }).find(s => /Vitamin C/.test(s.name));
    expect(pig.when).toBe('am');
    const red = suggestRoutine('complete', { concerns: ['redness'] }).find(s => /Azelaic/.test(s.name));
    expect(red.when).toBe('pm');
    expect(names(suggestRoutine('complete', {}))).toContain('Hyaluronic acid serum');
  });

  it('keeps sensitive skin gentler: no acid, fewer retinol nights', () => {
    const r = suggestRoutine('power', { type: 'sensitive' });
    expect(names(r).some(n => /BHA/.test(n))).toBe(false);
    expect(r.find(s => /Retinol/.test(s.name)).days).toEqual([2, 5]);
    expect(names(r)[0]).toBe('Gentle hydrating cleanser');
  });

  it('orders the steps cleanse, treat, moisturise, protect, and never puts sunscreen at night', () => {
    const r = suggestRoutine('power', { concerns: ['pigmentation'] });
    const am = stepsFor(r, 'am', 3).map(s => s.name);
    expect(am[0]).toMatch(/cleanser/);
    expect(am[am.length - 1]).toMatch(/Sunscreen/);
    expect(stepsFor(r, 'pm', 3).some(s => /Sunscreen/.test(s.name))).toBe(false);
  });

  it('never produces a clash warning at any tier for any profile', () => {
    for (const tier of TIERS) for (const type of ['oily', 'dry', 'sensitive', 'normal', null]) for (const concerns of [[], ['acne'], ['pigmentation'], ['redness'], ['aging'], ['acne', 'aging']]) {
      const warns = routineWarnings(suggestRoutine(tier, { type, concerns })).filter(w => w.level === 'warn');
      expect(warns, `${tier} ${type} ${concerns}`).toEqual([]);
    }
  });

  it('falls back to essential for an unknown tier', () => {
    expect(suggestRoutine('mega', {})).toHaveLength(3);
  });
});

describe('newSteps and tierWarnings', () => {
  it('skips steps already in the routine, ignoring case', () => {
    const existing = [{ name: 'gentle cleanser', when: 'both', days: [0, 1, 2, 3, 4, 5, 6] }];
    expect(names(newSteps(suggestRoutine('essential', {}), existing))).toEqual(['Moisturiser', 'Sunscreen SPF 30+']);
  });

  it('reports a clash with something the user already uses', () => {
    const existing = [{ id: 'x', name: 'Glycolic acid toner', when: 'pm', days: [0, 1, 2, 3, 4, 5, 6] }];
    const w = tierWarnings(suggestRoutine('power', { type: 'normal' }), existing);
    expect(w.some(x => /retinoid/i.test(x.text))).toBe(true);
    expect(tierWarnings(suggestRoutine('essential', {}), [])).toEqual([]);
  });
});
