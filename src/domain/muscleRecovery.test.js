import { describe, it, expect } from 'vitest';
import { muscleRecovery, volumeBand, summary, suggestSplitDay } from './muscleRecovery.js';
import { musclesForLog } from './muscles.js';

const sets = (n) => Array.from({ length: n }, () => ({ weight: 60, reps: 8 }));
const log = (date, exerciseName, n = 3) => ({ date, exerciseName, sets: sets(n) });
const TODAY = '2026-09-30';

describe('muscleRecovery', () => {
  it('marks today worked, yesterday recovering, and older fresh', () => {
    const m = muscleRecovery([log('2026-09-30', 'Bench Press'), log('2026-09-29', 'Barbell Row'), log('2026-09-27', 'Barbell Squat')], TODAY);
    expect(m.chest.status).toBe('worked');
    expect(m.back.status).toBe('recovering');
    expect(m.quads.status).toBe('fresh');
    expect(m.calves.status).toBe('fresh');
    expect(m.calves.daysSince).toBeNull();
  });

  it('keeps a heavy session recovering for a second day', () => {
    expect(muscleRecovery([log('2026-09-28', 'Barbell Squat', 9)], TODAY).quads.status).toBe('recovering');
    expect(muscleRecovery([log('2026-09-28', 'Barbell Squat', 4)], TODAY).quads.status).toBe('fresh');
  });

  it('adds sets across exercises on the same day for the heavy rule', () => {
    const m = muscleRecovery([log('2026-09-28', 'Barbell Squat', 5), log('2026-09-28', 'Leg Press', 4)], TODAY);
    expect(m.quads.sessionSets).toBe(9);
    expect(m.quads.status).toBe('recovering');
  });

  it('counts weekly sets in the last 7 days only and bands them', () => {
    const m = muscleRecovery([log('2026-09-30', 'Bench Press', 6), log('2026-09-26', 'Bench Press', 6), log('2026-09-23', 'Bench Press', 6)], TODAY);
    expect(m.chest.sets7d).toBe(12);
    expect(m.chest.volume).toBe('on-target');
    expect(volumeBand(0)).toBe('none');
    expect(volumeBand(9)).toBe('low');
    expect(volumeBand(21)).toBe('high');
  });

  it('credits every muscle an exercise trains', () => {
    const m = muscleRecovery([log('2026-09-30', 'Bench Press', 3)], TODAY);
    expect(['chest', 'triceps', 'shoulders'].every(id => m[id].status === 'worked')).toBe(true);
    expect(m.back.status).toBe('fresh');
  });

  it('falls back to the split day for unknown exercises and treats a log with no sets as one', () => {
    const m = muscleRecovery([{ date: '2026-09-30', exerciseName: 'Mystery Lift', splitType: 'legs' }], TODAY);
    expect(m.quads.status).toBe('worked');
    expect(m.quads.sets7d).toBe(1);
  });

  it('knows the exercises the picker adds', () => {
    expect(musclesForLog({ exerciseName: 'Goblet Squat' })).toEqual(['quads', 'glutes']);
    expect(musclesForLog({ exerciseName: 'Inverted Row' })).toContain('back');
  });

  it('ignores future, very old and malformed logs, and bad dates', () => {
    const m = muscleRecovery([log('2026-10-05', 'Bench Press'), log('2026-08-01', 'Bench Press'), log('nonsense', 'Bench Press'), null], TODAY);
    expect(m.chest.daysSince).toBeNull();
    expect(Object.values(muscleRecovery([], 'nonsense')).every(r => r.status === 'fresh')).toBe(true);
  });
});

describe('summary and suggestSplitDay', () => {
  it('splits ready from resting and finds lacking volume', () => {
    const m = muscleRecovery([log('2026-09-30', 'Bench Press', 12)], TODAY);
    const s = summary(m);
    expect(s.rest).toEqual(expect.arrayContaining(['chest', 'triceps', 'shoulders']));
    expect(s.ready).toContain('back');
    expect(s.lacking).toContain('back');
    expect(s.lacking).not.toContain('chest');
  });

  it('suggests the split day with the freshest muscles, and nothing with no history', () => {
    expect(suggestSplitDay(muscleRecovery([], TODAY))).toBeNull();
    const m = muscleRecovery([log('2026-09-30', 'Bench Press'), log('2026-09-29', 'Barbell Squat')], TODAY);
    expect(suggestSplitDay(m).day).toBe('pull');
  });
});

describe('helper muscles count half', () => {
  it('gives the prime mover full sets and helpers half', () => {
    const m = muscleRecovery([{ date: '2026-09-30', exerciseName: 'Bench Press', sets: Array.from({ length: 12 }, () => ({ weight: 60, reps: 8 })) }], '2026-09-30');
    expect(m.chest.sets7d).toBe(12);
    expect(m.triceps.sets7d).toBe(6);
    expect(m.shoulders.sets7d).toBe(6);
    expect(m.triceps.volume).toBe('low');
  });
});
