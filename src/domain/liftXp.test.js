import { describe, it, expect } from 'vitest';
import { liftPRs } from './liftXp.js';

const log = (id, date, weight, reps, name = 'Bench Press') => ({ id, date, exerciseName: name, sets: [{ weight, reps }] });

describe('lift PRs for XP', () => {
  it('the first session is a baseline, later bests are PRs', () => {
    const prs = liftPRs([log('a', '2026-10-01', 60, 8), log('b', '2026-10-08', 62.5, 8), log('c', '2026-10-15', 60, 8)]);
    expect(prs.map(p => p.key)).toEqual(['LIFTPR:b']);
  });
  it('counts each lift separately and ignores zero-weight sets', () => {
    const prs = liftPRs([log('a', '2026-10-01', 60, 8), log('b', '2026-10-02', 100, 5, 'Squat'), log('c', '2026-10-09', 0, 10), log('d', '2026-10-09', 105, 5, 'Squat')]);
    expect(prs.map(p => p.key)).toEqual(['LIFTPR:d']);
  });
  it('is stable regardless of input order', () => {
    const rows = [log('b', '2026-10-08', 65, 8), log('a', '2026-10-01', 60, 8)];
    expect(liftPRs(rows)).toEqual(liftPRs([...rows].reverse()));
  });
});
