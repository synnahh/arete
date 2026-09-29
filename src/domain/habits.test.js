import { describe, it, expect } from 'vitest';
import { habitHistory, isDone, currentStreak, bestStreak, toggleDay, weekDots, completionRate, todayProgress, heatmap } from './habits.js';

const run = (from, n) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 8, from + i)).toISOString().slice(0, 10));

describe('habitHistory', () => {
  it('uses stored history, sorted and de-duplicated, dropping junk', () => {
    expect(habitHistory({ history: ['2026-09-03', '2026-09-01', '2026-09-01', 'nope', '2026-02-31'] })).toEqual(['2026-09-01', '2026-09-03']);
  });
  it('backfills legacy habits from lastCompleted + streak', () => {
    expect(habitHistory({ lastCompleted: '2026-09-10', streak: 3 })).toEqual(['2026-09-08', '2026-09-09', '2026-09-10']);
    expect(habitHistory({ lastCompleted: '', streak: 5 })).toEqual([]);
    expect(habitHistory({})).toEqual([]);
  });
});

describe('currentStreak', () => {
  const h = { history: run(1, 5) }; // 1st to 5th
  it('counts the run ending today', () => {
    expect(currentStreak(h, '2026-09-05')).toBe(5);
    expect(isDone(h, '2026-09-05')).toBe(true);
  });
  it('keeps the streak alive through today until the day is over', () => {
    expect(currentStreak(h, '2026-09-06')).toBe(5);
    expect(isDone(h, '2026-09-06')).toBe(false);
  });
  it('breaks after a missed day (the old code never did)', () => {
    expect(currentStreak(h, '2026-09-07')).toBe(0);
    expect(currentStreak({ lastCompleted: '2026-08-01', streak: 40 }, '2026-09-29')).toBe(0);
  });
  it('stops at a gap', () => {
    expect(currentStreak({ history: ['2026-09-01', '2026-09-02', '2026-09-04', '2026-09-05'] }, '2026-09-05')).toBe(2);
  });
});

describe('bestStreak', () => {
  it('finds the longest run, and never forgets a recorded best', () => {
    expect(bestStreak({ history: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-10', '2026-09-11'] })).toBe(3);
    expect(bestStreak({ history: ['2026-09-10'], best: 12 })).toBe(12);
  });
});

describe('toggleDay', () => {
  it('ticks today, extending the streak and keeping legacy fields in step', () => {
    const p = toggleDay({ history: ['2026-09-08', '2026-09-09'], best: 2 }, '2026-09-10');
    expect(p).toEqual({ history: ['2026-09-08', '2026-09-09', '2026-09-10'], lastCompleted: '2026-09-10', streak: 3, best: 3 });
  });
  it('unticks a done day and restores the earlier state', () => {
    const p = toggleDay({ history: ['2026-09-08', '2026-09-09', '2026-09-10'] }, '2026-09-10');
    expect(p).toMatchObject({ lastCompleted: '2026-09-09', streak: 2 });
    expect(toggleDay({ history: ['2026-09-10'] }, '2026-09-10')).toMatchObject({ history: [], lastCompleted: '', streak: 0 });
  });
  it('undoing a tick also undoes the record it set, but keeps an older longer one', () => {
    const ticked = toggleDay({ history: ['2026-09-08', '2026-09-09'], best: 2 }, '2026-09-10');
    expect(ticked.best).toBe(3);
    expect(toggleDay({ history: ticked.history, best: ticked.best }, '2026-09-10').best).toBe(2);
    expect(toggleDay({ history: ['2026-09-09', '2026-09-10'], best: 12 }, '2026-09-10').best).toBe(12);
  });

  it('starts a fresh streak after a gap', () => {
    expect(toggleDay({ history: ['2026-08-01', '2026-08-02'], best: 2 }, '2026-09-10')).toMatchObject({ streak: 1, best: 2 });
  });
  it('carries a legacy habit forward without losing its streak', () => {
    const p = toggleDay({ lastCompleted: '2026-09-09', streak: 4 }, '2026-09-10');
    expect(p.streak).toBe(5);
    expect(p.history).toHaveLength(5);
  });
  it('caps stored history', () => {
    const long = Array.from({ length: 200 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));
    expect(toggleDay({ history: long }, '2026-09-10').history.length).toBeLessThanOrEqual(180);
  });
});

describe('weekDots / completionRate / todayProgress', () => {
  const h = { history: ['2026-09-08', '2026-09-10'] };
  it('marks the last 7 days oldest first', () => {
    const d = weekDots(h, '2026-09-10');
    expect(d).toHaveLength(7);
    expect(d[0].date).toBe('2026-09-04');
    expect(d.filter(x => x.done).map(x => x.date)).toEqual(['2026-09-08', '2026-09-10']);
    expect(d[6].isToday).toBe(true);
  });
  it('rates from the first day, not from before the habit existed', () => {
    expect(completionRate(h, '2026-09-10')).toBe(67); // 2 of 3 days since the 8th
    expect(completionRate({}, '2026-09-10')).toBeNull();
  });
  it('counts today across habits', () => {
    expect(todayProgress([h, { history: [] }], '2026-09-10')).toEqual({ done: 1, total: 2 });
  });
});

describe('withLiveStreaks', () => {
  it('replaces a stale stored streak with the live one', async () => {
    const { withLiveStreaks } = await import('./habits.js');
    const out = withLiveStreaks([{ name: 'a', lastCompleted: '2026-08-01', streak: 40 }, { name: 'b', history: ['2026-09-09', '2026-09-10'], streak: 0 }], '2026-09-10');
    expect(out.map(h => h.streak)).toEqual([0, 2]);
  });
});

describe('heatmap', () => {
  // 2026-09-30 is a Wednesday.
  const flat = (g) => g.weeks.flat();
  const at = (g, date) => flat(g).find(c => c.date === date);

  it('lays out Monday-first weeks ending with this week, future days blank', () => {
    const g = heatmap([{ history: ['2026-09-29'] }], '2026-09-30', { weeks: 4 });
    expect(g.weeks).toHaveLength(4);
    expect(g.weeks.every(w => w.length === 7)).toBe(true);
    expect(g.weeks[3][0].date).toBe('2026-09-28'); // Monday of this week
    expect(g.weeks[3][2].date).toBe('2026-09-30');
    expect(g.weeks[3][3].future).toBe(true);
    expect(g.weeks[3][6].level).toBeNull();
  });

  it('leaves days before your first habit blank rather than counting them as misses', () => {
    const g = heatmap([{ history: ['2026-09-20'] }], '2026-09-30', { weeks: 4 });
    expect(at(g, '2026-09-10').level).toBeNull();
    expect(at(g, '2026-09-20').level).toBe(4);
    expect(at(g, '2026-09-21').level).toBe(0);
  });

  it('grades a day by the share of started habits done', () => {
    const habits = [
      { history: ['2026-09-01', '2026-09-10', '2026-09-11'] },
      { history: ['2026-09-01', '2026-09-10'] },
      { history: ['2026-09-01', '2026-09-10'] },
    ];
    const g = heatmap(habits, '2026-09-30', { weeks: 6 });
    expect(at(g, '2026-09-10')).toMatchObject({ done: 3, total: 3, level: 4 });
    expect(at(g, '2026-09-11')).toMatchObject({ done: 1, total: 3, level: 2 });
    expect(at(g, '2026-09-12')).toMatchObject({ done: 0, level: 0 });
  });

  it('a habit added later does not turn earlier days into misses', () => {
    const g = heatmap([{ history: ['2026-09-01', '2026-09-02'] }, { history: ['2026-09-15'] }], '2026-09-30', { weeks: 6 });
    expect(at(g, '2026-09-02')).toMatchObject({ done: 1, total: 1, level: 4 });
    expect(at(g, '2026-09-15')).toMatchObject({ done: 1, total: 2, level: 2 });
  });

  it('counts perfect and active days, and copes with no data or a bad date', () => {
    const g = heatmap([{ history: ['2026-09-28', '2026-09-29'] }], '2026-09-30', { weeks: 2 });
    expect(g).toMatchObject({ perfectDays: 2, activeDays: 2 });
    expect(heatmap([], '2026-09-30').weeks.flat().every(c => c.level === null)).toBe(true);
    expect(heatmap([{ history: ['2026-09-28'] }], 'nope').weeks).toEqual([]);
  });
});
