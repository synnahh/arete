import { describe, it, expect } from 'vitest';
import { isBarbell, platesFor, warmupSets } from './plates.js';

describe('isBarbell', () => {
  it('recognises barbell lifts and rejects dumbbells, machines and bodyweight', () => {
    for (const n of ['Bench Press', 'Barbell Row', 'Deadlift', 'Overhead Press', 'Back Squat', 'Push Press', 'Romanian Deadlift']) expect(isBarbell(n)).toBe(true);
    for (const n of ['DB Shoulder Press', 'Dumbbell Bench Press', 'Lat Pulldown', 'Machine Chest Press', 'Cable Row', 'Pull-ups', 'Dips', 'Face Pulls', '', undefined]) expect(isBarbell(n)).toBe(false);
  });
});

describe('platesFor', () => {
  it('builds each side from the biggest plate down', () => {
    expect(platesFor(100)).toEqual({ perSide: [25, 15], total: 100, short: 0 });
    expect(platesFor(62.5)).toEqual({ perSide: [20, 1.25], total: 62.5, short: 0 });
    expect(platesFor(20)).toEqual({ perSide: [], total: 20, short: 0 });
  });
  it('says what the plates cannot make up', () => {
    expect(platesFor(61)).toEqual({ perSide: [20], total: 60, short: 1 });
  });
  it('uses the bar and plates you give it', () => {
    expect(platesFor(60, { bar: 15, plates: [10, 5] })).toEqual({ perSide: [10, 10], total: 55, short: 5 });
  });
  it('is null below the bar or for nonsense', () => {
    expect(platesFor(15)).toBeNull();
    expect(platesFor('x')).toBeNull();
    expect(platesFor(60, { bar: 0 })).toBeNull();
  });
});

describe('warmupSets', () => {
  it('ramps from the bar toward the working weight', () => {
    expect(warmupSets(100)).toEqual([{ weight: 20, reps: 10 }, { weight: 40, reps: 5 }, { weight: 60, reps: 3 }, { weight: 80, reps: 2 }]);
  });
  it('drops steps that collapse or reach the working weight', () => {
    expect(warmupSets(35)).toEqual([{ weight: 20, reps: 10 }, { weight: 27.5, reps: 2 }]);
  });
  it('is empty when there is nothing to warm up to', () => {
    expect(warmupSets(30)).toEqual([]);
    expect(warmupSets(0)).toEqual([]);
    expect(warmupSets('x')).toEqual([]);
  });
});
