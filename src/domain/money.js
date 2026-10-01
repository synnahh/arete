// money.js — the Finance front page's numbers. Pure; UI is tabs/MoneyToday.jsx.
//
// Transactions: { type: 'income' | 'expense', amount, category, date, description }.
// Budgets: { [categoryId]: monthlyAmount }. Recurring: { name, type, amount, cycle, nextDate, status }.
// Subscriptions: { name, amount, cycle, nextBilling, status }. Savings goals: { name, target, current, deadline }.
import { dayIndex } from '../utils/dayIndex.js';

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const round2 = (n) => Math.round(n * 100) / 100;
const monthKey = (date) => String(date).slice(0, 7);

/** Calendar facts for the month containing `today`. */
export function monthBounds(today) {
  const i = dayIndex(today);
  if (i == null) return null;
  const [y, m] = today.split('-').map(Number);
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Number(today.slice(8, 10));
  const prevY = m === 1 ? y - 1 : y, prevM = m === 1 ? 12 : m - 1;
  const prevDim = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    month: `${y}-${pad(m)}`, prevMonth: `${prevY}-${pad(prevM)}`,
    daysInMonth: dim, dayOfMonth: day, daysLeft: dim - day + 1, // today counts as a day you can still spend
    prevDaysInMonth: prevDim,
  };
}

/**
 * This month so far against last month at the same point.
 * Returns income, spend, net, savingsRate (% of income kept, null without income), the spend on
 * the same days last month and the % change, the month-end pace (null before day 5), top categories
 * and a daily spend list for a chart.
 */
export function monthSummary(transactions = [], today) {
  const b = monthBounds(today);
  if (!b) return null;
  let income = 0, spend = 0, prevSame = 0, prevFull = 0;
  const byCat = new Map();
  const daily = new Map();
  for (const t of transactions) {
    const amt = num(t?.amount);
    if (!(amt > 0) || !t?.date || dayIndex(t.date) == null) continue;
    const mk = monthKey(t.date), d = Number(String(t.date).slice(8, 10));
    if (mk === b.month && t.date <= today) {
      if (t.type === 'income') income += amt;
      else if (t.type === 'expense') {
        spend += amt;
        byCat.set(t.category || 'other', (byCat.get(t.category || 'other') || 0) + amt);
        daily.set(d, (daily.get(d) || 0) + amt);
      }
    } else if (mk === b.prevMonth && t.type === 'expense') {
      prevFull += amt;
      if (d <= b.dayOfMonth) prevSame += amt;
    }
  }
  income = round2(income); spend = round2(spend);
  const net = round2(income - spend);
  return {
    ...b,
    income, spend, net,
    savingsRate: income > 0 ? Math.round((net / income) * 100) : null,
    prevSame: round2(prevSame), prevFull: round2(prevFull),
    vsLastMonth: prevSame > 0 ? Math.round(((spend - prevSame) / prevSame) * 100) : null,
    pace: b.dayOfMonth >= 5 ? round2((spend / b.dayOfMonth) * b.daysInMonth) : null,
    categories: [...byCat.entries()].map(([id, total]) => ({ id, total: round2(total) })).sort((a, c) => c.total - a.total),
    daily: Array.from({ length: b.dayOfMonth }, (_, k) => ({ day: k + 1, amount: round2(daily.get(k + 1) || 0) })),
  };
}

/** Spend per category this month, for budgeting. */
export function spendByCategory(transactions = [], today) {
  const b = monthBounds(today);
  const out = {};
  if (!b) return out;
  for (const t of transactions) {
    if (t?.type !== 'expense' || !(num(t.amount) > 0) || monthKey(t.date || '') !== b.month || t.date > today) continue;
    out[t.category || 'other'] = round2((out[t.category || 'other'] || 0) + num(t.amount));
  }
  return out;
}

/**
 * Budget rows for the categories that have a budget: spent, left, pct (uncapped) and state
 * ('ok', 'near' from 80%, 'over' above 100%). Most-used first.
 */
export function budgetStatus(budgets = {}, spent = {}) {
  const rows = Object.entries(budgets)
    .filter(([, v]) => num(v) > 0)
    .map(([cat, v]) => {
      const budget = num(v), s = round2(num(spent[cat]));
      const pct = Math.round((s / budget) * 100);
      return { cat, budget, spent: s, left: round2(budget - s), pct, state: pct > 100 ? 'over' : pct >= 80 ? 'near' : 'ok' };
    })
    .sort((a, b) => b.pct - a.pct);
  return {
    rows,
    totalBudget: round2(rows.reduce((s, r) => s + r.budget, 0)),
    totalSpent: round2(rows.reduce((s, r) => s + r.spent, 0)),
  };
}

/** Bills in the next `days` days from recurring expenses and active subscriptions, soonest first. */
export function upcomingBills({ recurring = [], subscriptions = [], today, days = 14 }) {
  const t = dayIndex(today);
  if (t == null) return { items: [], total: 0 };
  const items = [];
  for (const r of recurring) {
    if (!r || r.status === 'paused' || r.type === 'income' || !(num(r.amount) > 0)) continue;
    const d = dayIndex(r.nextDate);
    if (d != null && d >= t && d <= t + days) items.push({ kind: 'recurring', name: r.name, amount: num(r.amount), date: r.nextDate, daysLeft: d - t });
  }
  for (const s of subscriptions) {
    if (!s || s.status !== 'active' || !(num(s.amount) > 0)) continue;
    const d = dayIndex(s.nextBilling);
    if (d != null && d >= t && d <= t + days) items.push({ kind: 'subscription', name: s.name, amount: num(s.amount), date: s.nextBilling, daysLeft: d - t });
  }
  items.sort((a, b) => a.daysLeft - b.daysLeft || String(a.name).localeCompare(String(b.name)));
  return { items, total: round2(items.reduce((s, i) => s + i.amount, 0)) };
}

/** What active subscriptions cost per month. */
export function subscriptionsMonthly(subscriptions = []) {
  const per = (s) => (s.cycle === 'weekly' ? num(s.amount) * 4.33 : s.cycle === 'yearly' ? num(s.amount) / 12 : num(s.amount));
  return round2(subscriptions.filter(s => s?.status === 'active').reduce((sum, s) => sum + per(s), 0));
}

/**
 * A daily spending allowance for the rest of the month, with what it is based on:
 *   'budget'  total budget minus spend on budgeted categories, over the days left
 *   'income'  income so far minus all spend and the bills still due, over the days left
 * Null when neither basis exists. Never negative: when you are over, perDay is 0 and `over` says by how much.
 */
export function safeToSpend({ summary, budget, bills }) {
  if (!summary) return null;
  const days = summary.daysLeft;
  if (budget && budget.totalBudget > 0) {
    const left = budget.totalBudget - budget.totalSpent;
    return { basis: 'budget', perDay: round2(Math.max(0, left) / days), left: round2(left), over: round2(Math.max(0, -left)), days };
  }
  if (summary.income > 0) {
    const left = summary.income - summary.spend - (bills?.total || 0);
    return { basis: 'income', perDay: round2(Math.max(0, left) / days), left: round2(left), over: round2(Math.max(0, -left)), days };
  }
  return null;
}

/** Savings goal rows: pct, left, and the per-month amount needed to hit a deadline. */
export function goalProgress(goals = [], today) {
  const t = dayIndex(today);
  return goals.filter(g => g && num(g.target) > 0).map(g => {
    const target = num(g.target), current = Math.min(num(g.current), target);
    const dl = dayIndex(g.deadline);
    const monthsLeft = dl != null && t != null && dl > t ? Math.max(1, Math.round((dl - t) / 30.4)) : null;
    return {
      id: g.id, name: g.name, target, current,
      pct: Math.round((current / target) * 100), left: round2(target - current),
      deadline: g.deadline || null, monthsLeft,
      perMonth: monthsLeft && target > current ? round2((target - current) / monthsLeft) : null,
      done: current >= target,
    };
  }).sort((a, b) => Number(a.done) - Number(b.done) || b.pct - a.pct);
}
