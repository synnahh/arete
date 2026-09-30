import { describe, it, expect } from 'vitest';
import { dayIndex, keyOfDay } from './dayIndex.js';

describe('dayIndex / keyOfDay', () => {
  it('round-trips real dates, including leap days and year ends', () => {
    for (const k of ['1970-01-01', '2026-09-30', '2028-02-29', '2026-12-31']) expect(keyOfDay(dayIndex(k))).toBe(k);
    expect(dayIndex('1970-01-02') - dayIndex('1970-01-01')).toBe(1);
  });
  it('counts whole days across month, year and DST boundaries', () => {
    expect(dayIndex('2026-10-01') - dayIndex('2026-09-30')).toBe(1);
    expect(dayIndex('2027-01-01') - dayIndex('2026-12-31')).toBe(1);
    expect(dayIndex('2026-10-05') - dayIndex('2026-10-03')).toBe(2);
  });
  it('gives null for anything that is not a real date', () => {
    for (const bad of ['2026-02-31', '2026-13-05', '2026-00-10', '2027-02-29', 'soon', '', '2026-9-3', null, undefined, 20260930]) expect(dayIndex(bad)).toBeNull();
  });
  it('keyOfDay is null for non-numbers', () => {
    expect(keyOfDay(NaN)).toBeNull();
    expect(keyOfDay(undefined)).toBeNull();
  });
});
