import { describe, it, expect } from 'vitest';
import { monthBounds, monthSummary, spendByCategory, budgetStatus, upcomingBills, subscriptionsMonthly, safeToSpend, goalProgress } from './money.js';

const TODAY = '2026-10-10';
const exp = (date, amount, category = 'food') => ({ type: 'expense', amount, category, date });
const inc = (date, amount) => ({ type: 'income', amount, category: 'income', date });

describe('monthBounds', () => {
  it('knows the month length, day of month and days left (today counts)', () => {
    expect(monthBounds('2026-10-10')).toMatchObject({ month: '2026-10', prevMonth: '2026-09', daysInMonth: 31, dayOfMonth: 10, daysLeft: 22, prevDaysInMonth: 30 });
    expect(monthBounds('2026-01-31')).toMatchObject({ prevMonth: '2025-12', daysLeft: 1 });
    expect(monthBounds('2024-02-29')).toMatchObject({ daysInMonth: 29 });
    expect(monthBounds('nope')).toBeNull();
  });
});

describe('monthSummary', () => {
  const txns = [inc('2026-10-01', 3000), exp('2026-10-02', 100), exp('2026-10-09', 50, 'transport'), exp('2026-10-20', 999), // future-dated: ignored
    exp('2026-09-03', 80), exp('2026-09-25', 400), inc('2026-09-01', 2800), { type: 'expense', amount: 'x', date: '2026-10-03' }, { type: 'expense', amount: 10, date: 'soon' }];

  it('totals this month so far, ignoring future and malformed rows', () => {
    const s = monthSummary(txns, TODAY);
    expect(s).toMatchObject({ income: 3000, spend: 150, net: 2850, savingsRate: 95 });
    expect(s.categories).toEqual([{ id: 'food', total: 100 }, { id: 'transport', total: 50 }]);
    expect(s.daily).toHaveLength(10);
    expect(s.daily[1]).toEqual({ day: 2, amount: 100 });
  });

  it('compares with the same days last month, and paces the month from day 5', () => {
    const s = monthSummary(txns, TODAY);
    expect(s.prevSame).toBe(80);          // the 25th is after day 10
    expect(s.prevFull).toBe(480);
    expect(s.vsLastMonth).toBe(88);       // 150 vs 80
    expect(s.pace).toBe(465);             // 150 / 10 * 31
    expect(monthSummary(txns, '2026-10-04').pace).toBeNull();
  });

  it('has no savings rate without income and no change without last month', () => {
    const s = monthSummary([exp('2026-10-02', 20)], TODAY);
    expect(s.savingsRate).toBeNull();
    expect(s.vsLastMonth).toBeNull();
  });
});

describe('budgets', () => {
  it('sums spend per category this month only', () => {
    expect(spendByCategory([exp('2026-10-02', 10.1), exp('2026-10-03', 20.2), exp('2026-09-30', 99), inc('2026-10-01', 500)], TODAY)).toEqual({ food: 30.3 });
  });

  it('marks near (80%+) and over (100%+), orders by use, and skips empty budgets', () => {
    const b = budgetStatus({ food: 200, transport: 100, fun: 0, shopping: 50 }, { food: 170, transport: 40, shopping: 60, fun: 5 });
    expect(b.rows.map(r => [r.cat, r.state, r.pct])).toEqual([['shopping', 'over', 120], ['food', 'near', 85], ['transport', 'ok', 40]]);
    expect(b).toMatchObject({ totalBudget: 350, totalSpent: 270 });
    expect(b.rows[0].left).toBe(-10);
  });
});

describe('bills and subscriptions', () => {
  it('lists recurring expenses and active subscriptions due in the window, soonest first', () => {
    const r = upcomingBills({
      today: TODAY, days: 14,
      recurring: [{ name: 'Rent', type: 'expense', amount: 400, nextDate: '2026-10-12' }, { name: 'Salary', type: 'income', amount: 3000, nextDate: '2026-10-11' }, { name: 'Gym', type: 'expense', amount: 20, nextDate: '2026-10-11', status: 'paused' }, { name: 'Late', type: 'expense', amount: 5, nextDate: '2026-11-30' }],
      subscriptions: [{ name: 'Netflix', amount: 18, status: 'active', nextBilling: '2026-10-10' }, { name: 'Old', amount: 9, status: 'cancelled', nextBilling: '2026-10-11' }],
    });
    expect(r.items.map(i => [i.name, i.daysLeft])).toEqual([['Netflix', 0], ['Rent', 2]]);
    expect(r.total).toBe(418);
  });

  it('converts subscription cycles to a monthly cost', () => {
    expect(subscriptionsMonthly([{ amount: 10, cycle: 'monthly', status: 'active' }, { amount: 120, cycle: 'yearly', status: 'active' }, { amount: 5, cycle: 'weekly', status: 'active' }, { amount: 99, cycle: 'monthly', status: 'paused' }])).toBe(41.65);
  });
});

describe('safeToSpend', () => {
  const summary = { daysLeft: 22, income: 3000, spend: 150 };
  it('uses the budget when there is one', () => {
    expect(safeToSpend({ summary, budget: { totalBudget: 1000, totalSpent: 340 }, bills: { total: 0 } })).toMatchObject({ basis: 'budget', perDay: 30, left: 660 });
  });
  it('falls back to income minus spend and upcoming bills', () => {
    expect(safeToSpend({ summary, budget: { totalBudget: 0, totalSpent: 0 }, bills: { total: 418 } })).toMatchObject({ basis: 'income', left: 2432, perDay: 110.55 });
  });
  it('never goes negative and says by how much you are over', () => {
    expect(safeToSpend({ summary, budget: { totalBudget: 100, totalSpent: 130 } })).toMatchObject({ perDay: 0, over: 30 });
  });
  it('is null with neither a budget nor income', () => {
    expect(safeToSpend({ summary: { daysLeft: 5, income: 0, spend: 10 }, budget: { totalBudget: 0 } })).toBeNull();
    expect(safeToSpend({ summary: null })).toBeNull();
  });
});

describe('goalProgress', () => {
  it('computes percent, what is left and the monthly amount needed for a deadline', () => {
    const [g] = goalProgress([{ id: 'a', name: 'Trip', target: 1200, current: 300, deadline: '2027-01-10' }], TODAY);
    expect(g).toMatchObject({ pct: 25, left: 900, monthsLeft: 3, perMonth: 300, done: false });
  });
  it('puts finished goals last, caps current at the target and skips goals without a target', () => {
    const list = goalProgress([{ name: 'Done', target: 100, current: 150 }, { name: 'Open', target: 100, current: 10 }, { name: 'Bad', target: 0 }], TODAY);
    expect(list.map(g => [g.name, g.pct, g.done])).toEqual([['Open', 10, false], ['Done', 100, true]]);
  });
});
