import { describe, it, expect } from 'vitest';
import { suggestWeek, describeWeek, isSupportedDays, WEEKDAYS } from './split.js';

const trainingDays = (w) => WEEKDAYS.filter(k => w[k].splitType !== 'rest');

describe('suggestWeek', () => {
  it('gives every weekday an entry and the right number of training days', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const w = suggestWeek(n);
      expect(Object.keys(w)).toEqual(WEEKDAYS);
      expect(trainingDays(w)).toHaveLength(n);
    }
  });
  it('3 days is push, pull, legs spread across the week', () => {
    expect(describeWeek(suggestWeek(3))).toBe('Mon Push · Wed Pull · Fri Legs');
  });
  it('never puts training on Sunday and keeps two rest days for 5 or fewer', () => {
    for (const n of [2, 3, 4, 5]) expect(suggestWeek(n).sun.splitType).toBe('rest');
    expect(WEEKDAYS.filter(k => suggestWeek(5)[k].splitType === 'rest')).toEqual(['thu', 'sun']);
  });
  it('4 days avoids three in a row and 6 days is two full rotations', () => {
    expect(describeWeek(suggestWeek(4))).toBe('Mon Push · Tue Pull · Thu Legs · Fri Push');
    expect(trainingDays(suggestWeek(6)).map(k => suggestWeek(6)[k].splitType)).toEqual(['push', 'pull', 'legs', 'push', 'pull', 'legs']);
  });
  it('uses your own split names', () => {
    expect(describeWeek(suggestWeek(3, { push: 'Chest', pull: 'Back', legs: 'Quads' }))).toBe('Mon Chest · Wed Back · Fri Quads');
  });
  it('is null for unsupported counts', () => {
    for (const n of [0, 1, 7, 2.5, NaN, undefined, '4']) expect(suggestWeek(n)).toBeNull();
    expect(isSupportedDays(4)).toBe(true);
    expect(describeWeek(null)).toBe('');
  });
});
