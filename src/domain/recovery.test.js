import { describe, it, expect } from 'vitest';
import { recentNights, sleepDebt, lastNight, trainingLoad, readiness } from './recovery.js';

const TODAY = '2026-09-30';
const day = (back) => new Date(Date.UTC(2026, 8, 30 - back)).toISOString().slice(0, 10);
const night = (back, hours) => ({ date: day(back), duration: Math.round(hours * 60) });
const nights = (hoursList, startBack = 0) => hoursList.map((h, i) => night(startBack + i, h));

describe('recentNights', () => {
  it('keeps the last 14 days, ignores junk and future dates, adds two rows on one date', () => {
    const rows = [night(0, 7), night(13, 6), night(14, 9), { date: 'nope', duration: 400 }, { date: day(-1), duration: 400 }, { date: day(2), duration: 0 }, night(0, 1)];
    const n = recentNights(rows, TODAY);
    expect(n.map(x => x.date)).toEqual([day(13), day(0)]);
    expect(n[1].hours).toBe(8); // 7 + a 1 h nap on the same date
  });
});

describe('sleepDebt', () => {
  it('sums shortfalls against the need', () => {
    const d = sleepDebt(nights([7, 7, 7, 7, 7, 7]), TODAY, { need: 8 });
    expect(d).toMatchObject({ debtHours: 6, nights: 6, avgHours: 7, status: 'high' });
  });
  it('lets extra sleep repay debt, at most an hour a night', () => {
    // -2, then +3 (counts as +1 only): net -1 debt
    expect(sleepDebt(nights([6, 11, 8, 8]), TODAY, { need: 8 }).debtHours).toBe(1);
  });
  it('never goes negative', () => {
    expect(sleepDebt(nights([10, 10, 10, 10]), TODAY, { need: 8 })).toMatchObject({ debtHours: 0, status: 'low' });
  });
  it('will not guess from fewer than 4 logged nights, and skips unlogged nights', () => {
    expect(sleepDebt(nights([5, 5, 5]), TODAY).status).toBe('insufficient');
    const gappy = [night(0, 7), night(3, 7), night(6, 7), night(9, 7)]; // 4 logged nights out of 14
    expect(sleepDebt(gappy, TODAY, { need: 8 })).toMatchObject({ nights: 4, debtHours: 4 });
  });
});

describe('lastNight', () => {
  it('takes today or yesterday, and treats anything older as unknown', () => {
    expect(lastNight([night(1, 6.5)], TODAY)).toEqual({ date: day(1), hours: 6.5 });
    expect(lastNight([night(0, 7), night(1, 6)], TODAY).hours).toBe(7);
    expect(lastNight([night(2, 8)], TODAY)).toBeNull();
  });
});

describe('trainingLoad', () => {
  const log = (back, kg) => ({ date: day(back), exerciseName: 'Squat', sets: [{ weight: kg, reps: 10 }] });
  const usual = [3, 5, 8, 10, 12, 15, 17].map(b => log(b, 100)); // 1000 kg on 7 days => 250/day over 28
  it('compares the last 2 days with your usual', () => {
    const l = trainingLoad([...usual, log(1, 200), log(2, 200)], TODAY);
    expect(l.recentVolume).toBe(4000);
    expect(l.ratio).toBeGreaterThan(2);
  });
  it('is unknown with too little history, and ignores today', () => {
    expect(trainingLoad([log(1, 100), log(2, 100)], TODAY)).toBeNull();
    expect(trainingLoad([...usual, log(0, 999)], TODAY).recentVolume).toBe(0);
  });
});

describe('readiness', () => {
  const well = nights([8, 8, 8, 8, 8, 8]);
  it('says nothing without sleep data', () => {
    expect(readiness({ sleepRows: [], workoutLogs: [], today: TODAY }).status).toBe('no-data');
  });
  it('is high when rested with no debt', () => {
    const r = readiness({ sleepRows: well, workoutLogs: [], today: TODAY });
    expect(r).toMatchObject({ status: 'ok', score: 100, band: 'push', drag: null });
    expect(r.factors.map(f => f.key)).toEqual(['sleep', 'debt']); // no load history: that part is left out, not guessed
  });
  it('drops on a short night and names it as the drag', () => {
    const r = readiness({ sleepRows: [night(0, 4.5), ...nights([8, 8, 8, 8, 8], 1)], workoutLogs: [], today: TODAY });
    expect(r.band).toBe('go-easy');
    expect(r.drag).toBe('sleep');
    expect(r.advice).toMatch(/no increases/);
  });
  it('accumulated debt alone pulls a well-slept night down', () => {
    const r = readiness({ sleepRows: [night(0, 8), ...nights([5.5, 5.5, 5.5, 5.5, 5.5], 1)], workoutLogs: [], today: TODAY });
    expect(r.debt.status).toBe('high');
    expect(r.score).toBeLessThan(75);
  });
  it('counts a heavy last 48 hours', () => {
    const log = (back, kg) => ({ date: day(back), exerciseName: 'Squat', sets: [{ weight: kg, reps: 10 }] });
    const logs = [3, 5, 8, 10, 12, 15, 17].map(b => log(b, 100)).concat([log(1, 300), log(2, 300)]);
    const r = readiness({ sleepRows: well, workoutLogs: logs, today: TODAY });
    expect(r.factors.find(f => f.key === 'load').pct).toBe(40);
    expect(r.score).toBeLessThan(100);
    expect(r.drag).toBe('load');
  });
  it('uses the sleep need it is given', () => {
    const rows = nights([7, 7, 7, 7, 7, 7]);
    expect(readiness({ sleepRows: rows, today: TODAY, need: 7 }).score).toBe(100);
    expect(readiness({ sleepRows: rows, today: TODAY, need: 9 }).score).toBeLessThan(80);
  });
});
