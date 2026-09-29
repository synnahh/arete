import { describe, it, expect } from 'vitest';
import { backgroundClass } from './appearance.js';

describe('backgroundClass', () => {
  it('uses the time of day by default and for "time-of-day"', () => {
    expect(backgroundClass(undefined, 'dusk')).toBe('bg-dusk');
    expect(backgroundClass('time-of-day', 'night')).toBe('bg-night');
  });

  it('maps the other Background settings to their classes', () => {
    expect(backgroundClass('solid', 'day')).toBe('bg-solid');
    expect(backgroundClass('noise', 'day')).toBe('bg-noise');
    expect(backgroundClass('animated-gradient', 'day')).toBe('bg-animated');
  });
});
