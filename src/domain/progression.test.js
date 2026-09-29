import { describe, it, expect } from 'vitest';
import { sessionsOf, detectPlateau, suggestNext, plateaus } from './progression.js';

const ex = { name: 'Bench', repsMin: 8, repsMax: 12, increment: 2.5, startingWeight: 40 };
const day = (n) => new Date(Date.UTC(2026, 7, 1 + n)).toISOString().slice(0, 10); // 1 Aug + n
const log = (n, sets) => ({ date: day(n), exerciseName: 'Bench', sets: sets.map(([weight, reps]) => ({ weight, reps })) });
const TODAY = day(40);

describe('sessionsOf', () => {
  it('groups by day, keeps working sets, and reads legacy topSet rows', () => {
    const s = sessionsOf([
      log(0, [[60, 8], [40, 12], [60, 7]]),
      { date: day(3), exerciseName: 'Bench', topSet: { weight: '62.5', reps: '8' } }, // legacy, strings
      { date: day(4), exerciseName: 'Squat', sets: [{ weight: 100, reps: 5 }] },
      { date: 'junk', exerciseName: 'Bench', sets: [{ weight: 1, reps: 1 }] },
    ], 'Bench');
    expect(s.map(x => x.date)).toEqual([day(0), day(3)]);
    expect(s[0].topWeight).toBe(60);
    expect(s[0].work).toHaveLength(2); // the 40 kg back-off set is not a working set
    expect(s[1].topWeight).toBe(62.5);
  });
});

describe('suggestNext: progression', () => {
  it('starts at the starting weight with no history', () => {
    expect(suggestNext(ex, [], TODAY)).toMatchObject({ action: 'FIRST SET', nextWeight: 40, targetReps: 8 });
  });

  it('adds weight only when EVERY working set reaches the top of the range', () => {
    const all = suggestNext(ex, [log(30, [[60, 12], [60, 12], [60, 12]])], TODAY);
    expect(all).toMatchObject({ action: 'ADD WEIGHT', nextWeight: 62.5, targetReps: 8 });
    const one = suggestNext(ex, [log(30, [[60, 12], [60, 10], [60, 9]])], TODAY);
    expect(one).toMatchObject({ action: 'HOLD', nextWeight: 60, targetReps: 10 }); // weakest set + 1
  });

  it('does not drop the weight after a single bad session', () => {
    const p = suggestNext(ex, [log(28, [[60, 10], [60, 9]]), log(30, [[60, 8], [60, 6]])], TODAY);
    expect(p).toMatchObject({ action: 'HOLD', nextWeight: 60, targetReps: 8 });
  });

  it('drops about 10% after two missed sessions in a row', () => {
    const p = suggestNext(ex, [log(27, [[60, 8], [60, 6]]), log(30, [[60, 7], [60, 6]])], TODAY);
    expect(p).toMatchObject({ action: 'DROP WEIGHT', nextWeight: 55 });
  });

  it('a missed session after a heavier successful one is not a stall', () => {
    const p = suggestNext(ex, [log(27, [[57.5, 10], [57.5, 9]]), log(30, [[60, 6], [60, 6]])], TODAY);
    expect(p.action).toBe('HOLD');
  });

  it('ignores back-off sets when judging the session', () => {
    const p = suggestNext(ex, [log(30, [[60, 12], [60, 12], [45, 15]])], TODAY);
    expect(p.action).toBe('ADD WEIGHT');
  });

  it('eases back in after weeks away', () => {
    const l = [log(2, [[60, 10]])];
    expect(suggestNext(ex, l, day(2 + 20)).action).toBe('HOLD');
    expect(suggestNext(ex, l, day(2 + 22))).toMatchObject({ action: 'DROP WEIGHT', nextWeight: 57.5 }); // 5%
    expect(suggestNext(ex, l, day(2 + 45))).toMatchObject({ nextWeight: 55 });   // 10%
    expect(suggestNext(ex, l, day(2 + 90))).toMatchObject({ nextWeight: 47.5 }); // 20%
  });

  it('holds bodyweight work at the top of the range instead of adding weight', () => {
    const bw = { name: 'Pull-up', repsMin: 6, repsMax: 10, bodyweight: true };
    const p = suggestNext(bw, [{ date: day(30), exerciseName: 'Pull-up', sets: [{ weight: 0, reps: 10 }, { weight: 0, reps: 10 }] }], TODAY);
    expect(p).toMatchObject({ action: 'HOLD', nextWeight: 0 });
  });

  it('survives missing exercise settings', () => {
    const p = suggestNext({ name: 'Bench' }, [log(30, [[60, 8]])], TODAY);
    expect(p.nextWeight).toBe(60);
    expect(p.targetReps).toBeGreaterThan(0);
  });
});

describe('plateau detection', () => {
  // A best e1RM on day 0, then four sessions with nothing better across 3+ weeks.
  const stalled = [
    log(0, [[70, 8], [70, 8]]),
    log(7, [[67.5, 8], [67.5, 8]]), log(14, [[70, 7], [70, 7]]), log(21, [[67.5, 8], [67.5, 8]]), log(28, [[70, 7], [70, 7]]),
  ];

  it('flags no new best in 4+ sessions across 2+ weeks', () => {
    const p = detectPlateau(sessionsOf(stalled, 'Bench'));
    expect(p).toMatchObject({ status: 'plateau', sessions: 4, bestDate: day(0) });
  });

  it('does not flag a lift that is still progressing', () => {
    const rising = [0, 7, 14, 21, 28].map((n, i) => log(n, [[60 + i * 2.5, 8], [60 + i * 2.5, 8]]));
    expect(detectPlateau(sessionsOf(rising, 'Bench')).status).toBe('none');
  });

  it('needs enough sessions and time', () => {
    expect(detectPlateau(sessionsOf(stalled.slice(0, 4), 'Bench')).status).toBe('none');
    const quick = [0, 1, 2, 3, 4].map((n, i) => log(n, [[i ? 60 : 70, 8]]));
    expect(detectPlateau(sessionsOf(quick, 'Bench')).status).toBe('none'); // only 4 days
  });

  it('calls it regressing when recent sessions sit well under the best', () => {
    const sliding = [log(0, [[70, 8]]), log(7, [[60, 8]]), log(14, [[57.5, 8]]), log(21, [[55, 8]]), log(28, [[55, 7]])];
    expect(detectPlateau(sessionsOf(sliding, 'Bench')).status).toBe('regressing');
  });

  it('suggests a deload for a stalled lift, once', () => {
    const p = suggestNext(ex, stalled, TODAY);
    expect(p).toMatchObject({ action: 'DELOAD', nextWeight: 62.5 }); // 90% of 70, rounded to 2.5
    expect(p.hint).toMatch(/4 sessions/);
    // After a deload session the engine rebuilds instead of deloading again.
    const after = suggestNext(ex, [...stalled, log(35, [[62.5, 10], [62.5, 10]])], TODAY);
    expect(after.action).not.toBe('DELOAD');
  });

  it('adding weight wins over a deload when every set is at the top', () => {
    const p = suggestNext(ex, [...stalled.slice(0, 4), log(28, [[70, 12], [70, 12]])], TODAY);
    expect(p.action).toBe('ADD WEIGHT');
  });

  it('lists stalled lifts, worst first', () => {
    const squat = (n, w, r) => ({ date: day(n), exerciseName: 'Squat', sets: [{ weight: w, reps: r }] });
    const logs = [...stalled, squat(0, 100, 5), squat(7, 90, 5), squat(14, 85, 5), squat(21, 82.5, 5), squat(28, 80, 5)];
    const list = plateaus([ex, { ...ex, name: 'Squat' }, { ...ex, name: 'Row' }], logs, TODAY);
    expect(list.map(x => x.name)).toEqual(['Squat', 'Bench']);
    expect(list[0].status).toBe('regressing');
  });
});

describe('applyReadiness', () => {
  it('turns an ADD WEIGHT into a HOLD on a go-easy day, and touches nothing else', async () => {
    const { applyReadiness } = await import('./progression.js');
    const add = suggestNext(ex, [log(30, [[60, 12], [60, 12]])], TODAY);
    expect(add.action).toBe('ADD WEIGHT');
    const held = applyReadiness(add, { status: 'ok', band: 'go-easy', score: 41 });
    expect(held).toMatchObject({ action: 'HOLD', nextWeight: 60, heldByReadiness: true });
    expect(held.hint).toMatch(/41/);
    expect(applyReadiness(add, { status: 'ok', band: 'normal', score: 60 })).toBe(add);
    expect(applyReadiness(add, { status: 'no-data' })).toBe(add);
    const drop = suggestNext(ex, [log(27, [[60, 8], [60, 6]]), log(30, [[60, 7], [60, 6]])], TODAY);
    expect(applyReadiness(drop, { status: 'ok', band: 'go-easy', score: 30 })).toBe(drop);
  });
});

describe('liftHistory', () => {
  it('gives one point per day with e1RM and top weight, oldest first', async () => {
    const { liftHistory } = await import('./progression.js');
    const h = liftHistory([log(7, [[60, 8]]), log(0, [[65, 5], [60, 8]]), { date: day(3), exerciseName: 'Squat', sets: [{ weight: 100, reps: 5 }] }], 'Bench');
    expect(h.map(p => p.date)).toEqual([day(0), day(7)]);
    expect(h[0]).toMatchObject({ topWeight: 65, e1rm: 76 }); // the 60 x 8 set is the stronger estimate
    expect(h[1]).toMatchObject({ topWeight: 60, e1rm: 76 });
    expect(liftHistory([], 'Bench')).toEqual([]);
  });
});
