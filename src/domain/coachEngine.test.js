import { describe, it, expect } from 'vitest';
import { coachUpdates, logEntry, pushLog, canUndo, plannedDays, COOLDOWN_DAYS } from './coachEngine.js';
import { makeGoal } from './goals.js';

const TODAY = '2026-09-30';
const day = (n) => new Date(Date.parse(TODAY) - n * 86400000).toISOString().slice(0, 10);
const range = (n) => Array.from({ length: n }, (_, i) => i);

// A cut started 28 days ago at 85 kg on an estimated 2800 kcal maintenance.
const goal = { ...makeGoal({ template: 'cut', weightKg: 85, maintenanceKcal: 2800, startedOn: day(28), targetWeightKg: 78 }) };
// Weight falling 0.5 kg/week while eating 2400 a day: real maintenance is about 2400 + 0.5*7700/7 = 2950.
const weights = range(28).map(i => ({ date: day(i), weight: +(85 - (28 - i) * 0.5 / 7).toFixed(2) })).reverse();
const nutrition = range(28).map(i => ({ date: day(i), calories: 2400 }));
const keys = (u) => u.map(x => x.key);

describe('maintenance', () => {
  it('rebuilds targets from real maintenance and says why', () => {
    const u = coachUpdates({ goal, weights, nutrition, today: TODAY });
    const m = u.find(x => x.key === 'maintenance');
    expect(m.mode).toBe('auto');
    expect(m.apply.goal.maintenanceSource).toBe('adaptive');
    expect(Math.abs(m.apply.goal.maintenanceKcal - 2950)).toBeLessThanOrEqual(60);
    expect(m.apply.goal.targets.kcal).toBeGreaterThan(goal.targets.kcal);
    expect(m.why).toMatch(/averaged 2400 kcal/);
    // What the user set by hand is kept.
    expect(m.apply.goal).toMatchObject({ startedOn: goal.startedOn, startWeightKg: 85, targetWeightKg: 78, template: 'cut' });
  });

  it('waits for two weeks on the goal and for enough logging', () => {
    const fresh = { ...goal, startedOn: day(7) };
    expect(keys(coachUpdates({ goal: fresh, weights, nutrition, today: TODAY }))).not.toContain('maintenance');
    const patchy = nutrition.filter((_, i) => i % 3 === 0);
    expect(keys(coachUpdates({ goal, weights, nutrition: patchy, today: TODAY }))).not.toContain('maintenance');
  });

  it('leaves a plan alone when maintenance is within 100 kcal', () => {
    const close = { ...goal, maintenanceKcal: 2930 };
    expect(keys(coachUpdates({ goal: close, weights, nutrition, today: TODAY }))).not.toContain('maintenance');
  });

  it('respects the cooldown after any decision on the same rule', () => {
    const log = [logEntry({ key: 'maintenance', title: 'x', why: 'y' }, 'undone', { at: `${day(5)}T09:00:00Z` })];
    expect(keys(coachUpdates({ goal, weights, nutrition, log, today: TODAY }))).not.toContain('maintenance');
    const old = [logEntry({ key: 'maintenance', title: 'x', why: 'y' }, 'applied', { at: `${day(COOLDOWN_DAYS.maintenance + 1)}T09:00:00Z` })];
    expect(keys(coachUpdates({ goal, weights, nutrition, log: old, today: TODAY }))).toContain('maintenance');
  });
});

describe('macros', () => {
  it('re-sets protein and fat when the trend has moved 3+ kg, keeping maintenance', () => {
    const heavyStart = { ...makeGoal({ template: 'cut', weightKg: 90, maintenanceKcal: 2950, startedOn: day(28) }), targetsWeightKg: 90 };
    const u = coachUpdates({ goal: heavyStart, weights, nutrition: [], today: TODAY });
    const m = u.find(x => x.key === 'macros');
    expect(m.mode).toBe('auto');
    expect(m.apply.goal.maintenanceKcal).toBe(2950);
    expect(m.apply.goal.targets.protein).toBeLessThan(heavyStart.targets.protein);
    expect(m.why).toMatch(/down from when targets were set/);
  });

  it('does not fire for small changes', () => {
    expect(keys(coachUpdates({ goal: { ...goal, targetsWeightKg: 83 }, weights, nutrition: [], today: TODAY }))).not.toContain('macros');
  });
});

describe('goal reached', () => {
  it('asks before switching to holding the weight', () => {
    const near = { ...goal, targetWeightKg: 83.5 }; // trend is about 83.3 kg
    const u = coachUpdates({ goal: near, weights, nutrition: [], today: TODAY });
    const g = u.find(x => x.key === 'goal-reached');
    expect(g.mode).toBe('ask');
    expect(g.apply.goal.template).toBe('recomp');
    expect(g.apply.goal.startedOn).toBe(TODAY);
  });
});

describe('split', () => {
  const program = { days: { mon: { splitType: 'push' }, tue: { splitType: 'pull' }, wed: { splitType: 'legs' }, thu: { splitType: 'push' }, fri: { splitType: 'pull' }, sat: { splitType: 'legs' }, sun: { splitType: 'rest' } } };
  it('counts planned days', () => { expect(plannedDays(program)).toBe(6); expect(plannedDays(null)).toBe(0); });

  it('asks for a split that fits three weeks of fewer sessions', () => {
    const workouts = [0, 3, 7, 10, 14, 17, 18].map(n => ({ date: day(n) }));
    const s = coachUpdates({ program, workouts, today: TODAY }).find(x => x.key === 'split');
    expect(s.mode).toBe('ask');
    expect(s.apply.days).toBe(2);
  });

  it('stays quiet when one of the weeks was on plan, or with no training logged', () => {
    const onPlanOnce = [0, 1, 2, 3, 4, 5, 8, 15].map(n => ({ date: day(n) }));
    expect(keys(coachUpdates({ program, workouts: onPlanOnce, today: TODAY }))).not.toContain('split');
    expect(keys(coachUpdates({ program, workouts: [], today: TODAY }))).not.toContain('split');
  });
});

describe('log and undo', () => {
  it('keeps the newest entries first and caps the log', () => {
    let log = [];
    for (let i = 0; i < 40; i++) log = pushLog(log, { id: String(i) });
    expect(log).toHaveLength(30);
    expect(log[0].id).toBe('39');
  });

  it('only undoes the newest goal change, and only while the goal is unchanged since', () => {
    const a = logEntry({ key: 'maintenance', title: '', why: '' }, 'applied', { before: { goal: 1 }, after: { goal: { v: 1 } }, id: 'a' });
    const b = logEntry({ key: 'macros', title: '', why: '' }, 'applied', { before: { goal: { v: 1 } }, after: { goal: { v: 2 } }, id: 'b' });
    const log = [b, a];
    expect(canUndo(b, log, { v: 2 })).toBe(true);
    expect(canUndo(a, log, { v: 1 })).toBe(false);
    expect(canUndo(b, log, { v: 3 })).toBe(false);
  });

  it('returns nothing for a bad date', () => {
    expect(coachUpdates({ goal, weights, nutrition, today: 'x' })).toEqual([]);
  });
});

describe('applied questions read as statements', () => {
  it('logs doneTitle when applied and the question otherwise', () => {
    const u = { key: 'goal-reached', title: 'Switch?', doneTitle: 'Switched', why: '' };
    expect(logEntry(u, 'applied').title).toBe('Switched');
    expect(logEntry(u, 'dismissed').title).toBe('Switch?');
  });
});
