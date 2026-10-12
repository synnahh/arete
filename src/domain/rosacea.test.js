import { describe, it, expect } from 'vitest';
import { validRedness, rednessTrend, azelaicPlan } from './rosacea.js';
import { routineWarnings, newStep } from './skin.js';

describe('rosacea plan', () => {
  it('validates the 0-10 score', () => {
    expect(validRedness('6')).toBe(6);
    expect(validRedness(11)).toBeNull();
    expect(validRedness('')).toBeNull();
    expect(validRedness(3.3)).toBe(3.5);
  });
  it('trend needs two recent readings and compares to the fortnight before', () => {
    const rows = [{ date: '2026-09-20', redness: 6 }, { date: '2026-09-22', redness: 6 }, { date: '2026-10-05', redness: 4 }, { date: '2026-10-10', redness: 4 }];
    expect(rednessTrend(rows, '2026-10-12')).toEqual({ avg: 4, previous: 6, delta: -2, readings: 2 });
    expect(rednessTrend([{ date: '2026-10-10', redness: 4 }], '2026-10-12')).toBeNull();
  });
  it('gates azelaic acid for 14 days', () => {
    expect(azelaicPlan({ routineStart: '2026-10-05', today: '2026-10-12' }).phase).toBe('base');
    expect(azelaicPlan({ routineStart: '2026-09-25', today: '2026-10-12' }).phase).toBe('ready');
  });
  it('steps through intro, build, hold from the day it started', () => {
    const p = (today) => azelaicPlan({ routineStart: '2026-09-01', azelaicStart: '2026-10-01', today }).phase;
    expect(p('2026-10-07')).toBe('intro');
    expect(p('2026-10-20')).toBe('build');
    expect(p('2026-11-10')).toBe('hold');
  });
  it('warns when azelaic acid shares a night with a retinoid, acid or benzoyl peroxide', () => {
    const az = newStep('Azelaic acid 10%', 'pm');
    expect(routineWarnings([az, newStep('Retinal serum', 'pm')]).some(w => w.level === 'warn' && /azelaic/i.test(w.text))).toBe(true);
    const mon = { ...az, days: [1] }, thu = { ...newStep('Glycolic acid', 'pm'), days: [4] };
    expect(routineWarnings([mon, thu]).some(w => /azelaic/i.test(w.text))).toBe(false);
  });
});
