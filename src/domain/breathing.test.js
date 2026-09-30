import { describe, it, expect } from 'vitest';
import { PATTERNS, cycleSeconds, phaseAt } from './breathing.js';

const box = PATTERNS.box;

describe('phaseAt', () => {
  it('walks through box breathing phase by phase', () => {
    expect(phaseAt(box, 0)).toMatchObject({ phase: 'Breathe in', kind: 'in', remaining: 4, cycle: 1 });
    expect(phaseAt(box, 4000)).toMatchObject({ phase: 'Hold', kind: 'hold', remaining: 4 });
    expect(phaseAt(box, 8000)).toMatchObject({ phase: 'Breathe out', kind: 'out' });
    expect(phaseAt(box, 12000)).toMatchObject({ phase: 'Hold', kind: 'hold' });
    expect(phaseAt(box, 16000)).toMatchObject({ phase: 'Breathe in', cycle: 2 });
  });

  it('counts seconds down and rounds up', () => {
    expect(phaseAt(box, 1000).remaining).toBe(3);
    expect(phaseAt(box, 3999).remaining).toBe(1);
  });

  it('grows the circle on the way in, shrinks it on the way out, and holds each size', () => {
    expect(phaseAt(box, 0).scale).toBeCloseTo(0.55);
    expect(phaseAt(box, 2000).scale).toBeCloseTo(0.775);
    expect(phaseAt(box, 4500).scale).toBe(1);        // hold after breathing in: full
    expect(phaseAt(box, 8000).scale).toBeCloseTo(1); // start of breathing out
    expect(phaseAt(box, 13000).scale).toBe(0.55);    // hold after breathing out: small
  });

  it('finishes at the requested time and never shows a negative time', () => {
    expect(phaseAt(box, 60000, 60000)).toMatchObject({ done: true, cycle: 4 });
    expect(phaseAt(box, 59999, 60000).done).toBe(false);
    expect(phaseAt(box, -500)).toMatchObject({ phase: 'Breathe in', remaining: 4 });
  });

  it('works for patterns of different lengths', () => {
    expect(cycleSeconds(PATTERNS.calm)).toBe(19);
    expect(phaseAt(PATTERNS.calm, 4000)).toMatchObject({ phase: 'Hold', remaining: 7 });
    expect(phaseAt(PATTERNS.calm, 19000)).toMatchObject({ phase: 'Breathe in', cycle: 2 });
    expect(phaseAt(PATTERNS.sigh, 2500)).toMatchObject({ phase: 'Sip in more', kind: 'in' });
    expect(phaseAt(PATTERNS.sigh, 5000).phase).toBe('Long breath out');
  });
});
