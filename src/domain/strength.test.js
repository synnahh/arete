import { describe, it, expect } from 'vitest';
import { liftKey, scoreFor, strengthScore } from './strength.js';

describe('liftKey', () => {
  it('maps main barbell lifts and rejects variations', () => {
    expect(['Bench Press', 'Barbell Bench Press', 'Back Squat', 'Front Squat', 'Deadlift', 'Conventional Deadlift', 'Overhead Press', 'OHP', 'Barbell Row', 'Bent Over Row'].map(liftKey))
      .toEqual(['bench', 'bench', 'squat', 'squat', 'deadlift', 'deadlift', 'ohp', 'ohp', 'row', 'row']);
    for (const n of ['DB Bench Press', 'Incline Bench Press', 'Bulgarian Split Squat', 'Goblet Squat', 'Romanian Deadlift', 'DB Shoulder Press', 'Push Press', 'Cable Row', 'Lat Pulldown', '', undefined]) {
      expect(liftKey(n)).toBeNull();
    }
  });
});

describe('scoreFor', () => {
  it('interpolates between level thresholds', () => {
    // bench levels: 0.5, 0.75, 1.25, 1.75, 2.0
    expect(scoreFor('bench', 0)).toMatchObject({ score: 0, level: 'Untrained' });
    expect(scoreFor('bench', 0.25)).toMatchObject({ score: 10, level: 'Untrained' });
    expect(scoreFor('bench', 0.5)).toMatchObject({ score: 20, level: 'Beginner' });
    expect(scoreFor('bench', 1.0)).toMatchObject({ score: 50, level: 'Novice' });
    expect(scoreFor('bench', 1.25)).toMatchObject({ score: 60, level: 'Intermediate' });
    expect(scoreFor('bench', 2.0)).toMatchObject({ score: 100, level: 'Elite' });
    expect(scoreFor('bench', 3)).toMatchObject({ score: 100, level: 'Elite' });
  });
  it('handles junk', () => {
    expect(scoreFor('nope', 1).score).toBe(0);
    expect(scoreFor('bench', -1).score).toBe(0);
  });
});

describe('strengthScore', () => {
  const day = (back) => new Date(Date.UTC(2026, 8, 30 - back)).toISOString().slice(0, 10);
  const log = (name, back, w, r) => ({ exerciseName: name, date: day(back), sets: [{ weight: w, reps: r }] });
  const T = '2026-09-30';

  it('averages the lifts you have and names the level', () => {
    // 80 kg bodyweight. Bench 100x5 -> e1RM 116.7 -> 1.46 ratio; Squat 140x5 -> 163.3 -> 2.04.
    const s = strengthScore([log('Bench Press', 3, 100, 5), log('Back Squat', 3, 140, 5)], 80, T);
    expect(s.lifts.map(l => l.key)).toEqual(['squat', 'bench']);
    expect(s.lifts[0]).toMatchObject({ ratio: 2.04, level: 'Intermediate' });
    expect(s.score).toBe(Math.round((s.lifts[0].score + s.lifts[1].score) / 2));
    expect(s.weakest).toBeNull(); // fewer than 3 lifts
  });

  it('uses the best recent estimate and ignores old sessions', () => {
    const s = strengthScore([log('Bench Press', 400, 140, 5), log('Bench Press', 10, 80, 5), log('Bench Press', 5, 90, 5)], 80, T);
    expect(s.lifts[0].e1rm).toBe(105); // 90 x 5, not the 400-day-old 140 x 5
  });

  it('names the weakest lift when 3+ lifts and it trails by 10+ points', () => {
    const logs = [log('Bench Press', 2, 100, 5), log('Back Squat', 2, 150, 5), log('Deadlift', 2, 60, 5)];
    const s = strengthScore(logs, 80, T);
    expect(s.lifts).toHaveLength(3);
    expect(s.weakest.key).toBe('deadlift');
  });

  it('needs a bodyweight and some main-lift data', () => {
    expect(strengthScore([log('Bench Press', 2, 100, 5)], null, T)).toBeNull();
    expect(strengthScore([log('Bench Press', 2, 100, 5)], 10, T)).toBeNull();
    expect(strengthScore([log('Lateral Raise', 2, 10, 12)], 80, T)).toBeNull();
    expect(strengthScore([], 80, T)).toBeNull();
    expect(strengthScore([log('Bench Press', 2, 100, 5)], 80, 'nope')).toBeNull();
  });
});
