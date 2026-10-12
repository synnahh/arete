import { describe, it, expect } from 'vitest';
import { e1rm, setsOf, topSetOf, previousSets, todaysLog, bests, detectPR, restSeconds, plannedRows, volume, recommendedSets } from './training.js';

const logs = [
  { id: 'a', date: '2026-09-20', exerciseName: 'Bench Press', topSet: { weight: 80, reps: 6 } },               // legacy row
  { id: 'b', date: '2026-09-24', exerciseName: 'Bench Press', topSet: { weight: 80, reps: 8 },
    sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 7 }, { weight: 80, reps: 6 }] },
  { id: 'c', date: '2026-09-24', exerciseName: 'Squat', topSet: { weight: 100, reps: 5 } },
];

describe('e1rm', () => {
  it('uses Epley and treats singles as the weight', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(80, 8)).toBe(101.3);
    expect(e1rm(80, 0)).toBe(0);
  });
});

describe('reading logs', () => {
  it('reads legacy top-set rows as one set', () => {
    expect(setsOf(logs[0])).toEqual([{ weight: 80, reps: 6 }]);
    expect(setsOf(logs[1])).toHaveLength(3);
  });

  it('picks the heaviest set, most reps on ties', () => {
    expect(topSetOf([{ weight: 80, reps: 6 }, { weight: 82.5, reps: 5 }, { weight: 82.5, reps: 6 }])).toEqual({ weight: 82.5, reps: 6 });
    expect(topSetOf([])).toBeNull();
  });

  it('compares numeric input values numerically, not lexicographically', () => {
    expect(topSetOf([{ weight: '90', reps: '10' }, { weight: '100', reps: '5' }])).toEqual({ weight: 100, reps: 5 });
    expect(topSetOf([{ weight: '80', reps: '9' }, { weight: '80', reps: '10' }])).toEqual({ weight: 80, reps: 10 });
  });

  it('finds the last session before a date and today’s row', () => {
    expect(previousSets(logs, 'Bench Press', '2026-09-29')).toHaveLength(3);
    expect(previousSets(logs, 'Bench Press', '2026-09-24')).toEqual([{ weight: 80, reps: 6 }]);
    expect(previousSets(logs, 'Deadlift', '2026-09-29')).toEqual([]);
    expect(todaysLog(logs, 'Squat', '2026-09-24').id).toBe('c');
  });
});

describe('PRs', () => {
  const history = bests(logs, 'Bench Press');

  it('computes bests across legacy and new rows', () => {
    expect(history).toMatchObject({ bestWeight: 80, count: 4 });
    expect(history.bestE1rm).toBe(101.3);
  });

  it('flags a heavier weight and a better e1RM', () => {
    expect(detectPR({ weight: 82.5, reps: 8 }, { history }).kinds).toEqual(['weight', 'e1rm']);
    expect(detectPR({ weight: 80, reps: 9 }, { history }).kinds).toEqual(['e1rm']);
    expect(detectPR({ weight: 80, reps: 7 }, { history })).toBeNull();
  });

  it('counts sets already done today', () => {
    expect(detectPR({ weight: 82.5, reps: 8 }, { history, todaySets: [{ weight: 85, reps: 8 }] })).toBeNull();
  });

  it('never celebrates the first set of a new exercise', () => {
    expect(detectPR({ weight: 60, reps: 5 }, { history: bests(logs, 'Deadlift') })).toBeNull();
  });

  it('can exclude today when re-opening a session', () => {
    expect(bests(logs, 'Bench Press', { excludeDate: '2026-09-24' }).count).toBe(1);
  });
});

describe('planning', () => {
  const ex = { name: 'Bench Press', bodyweight: false, repsMin: 6, repsMax: 8 };

  it('rests longer for heavy rep ranges', () => {
    expect(restSeconds({ repsMax: 5 })).toBe(180);
    expect(restSeconds({ repsMax: 8 })).toBe(120);
    expect(restSeconds({ repsMax: 15 })).toBe(90);
  });

  it('uses the rep target the progression engine names', () => {
    const rows = plannedRows(ex, { nextWeight: 80, action: 'HOLD', targetReps: 7 }, [{ weight: 80, reps: 5 }]);
    expect(rows[0]).toMatchObject({ weight: 80, reps: 7 });
  });

  it('adds weight at the bottom of the range', () => {
    const rows = plannedRows(ex, { nextWeight: 82.5, action: 'ADD WEIGHT' }, [{ weight: 80, reps: 8 }]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ weight: 82.5, reps: 6, prev: { weight: 80, reps: 8 } });
    expect(rows[2].prev).toBeNull();
  });

  it('chases one more rep while holding', () => {
    const rows = plannedRows(ex, { nextWeight: 80, action: 'HOLD' }, [{ weight: 80, reps: 7 }, { weight: 80, reps: 6 }]);
    expect(rows[0].reps).toBe(8);
  });

  it('keeps as many rows as last time had sets', () => {
    expect(plannedRows(ex, { nextWeight: 80, action: 'HOLD' }, [1, 2, 3, 4].map(() => ({ weight: 80, reps: 6 })))).toHaveLength(4);
  });

  it('logs bodyweight movements at 0 kg', () => {
    expect(plannedRows({ ...ex, bodyweight: true }, { nextWeight: 0, action: 'FIRST SET' })[0].weight).toBe(0);
  });

  it('sums volume', () => {
    expect(volume([{ weight: 80, reps: 8 }, { weight: 80, reps: 7 }])).toBe(1200);
  });
});

describe('recommendedSets and a chosen rest time', () => {
  it('gives compounds more sets than isolation, within 2 to 5', () => {
    expect(recommendedSets({ name: 'Bench Press', repsMin: 6, repsMax: 8 }).sets).toBe(3);
    expect(recommendedSets({ name: 'DB Curl', repsMin: 8, repsMax: 12 }).sets).toBe(2);
    expect(recommendedSets({ name: 'Squat', repsMax: 6 }, { goal: 'strength', experience: 'advanced' }).sets).toBe(5);
  });
  it('adapts to goal and experience', () => {
    expect(recommendedSets({ name: 'Lateral Raise', repsMax: 15 }, { goal: 'bulk' }).sets).toBe(3);
    expect(recommendedSets({ name: 'Row', repsMax: 10 }, { experience: 'advanced' }).sets).toBe(4);
    expect(recommendedSets({ name: 'Row', repsMax: 10 }, { experience: 'beginner' }).sets).toBe(3);
  });
  it('words the line the way a person would say it', () => {
    expect(recommendedSets({ name: 'Bench Press', repsMin: 8, repsMax: 10 }).text).toBe('Recommended number of sets: 3. Aim for 8-10 repetitions per set.');
    expect(recommendedSets({ name: 'Plank', repsMin: 10, repsMax: 10 }).text).toMatch(/Aim for 10 repetitions/);
  });
  it('a rest time you set wins, within sane limits', () => {
    expect(restSeconds({ repsMax: 5 }, 75)).toBe(75);
    expect(restSeconds({ repsMax: 5 }, 5)).toBe(180);
    expect(restSeconds({ repsMax: 5 }, null)).toBe(180);
  });
});
