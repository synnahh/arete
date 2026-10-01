// MoneyToday — the Finance group's front page: this month at a glance, a daily spending
// allowance, budgets, upcoming bills, subscriptions, savings goals, where the money went,
// and quick add. Rules: src/domain/money.js. The full screens (Spending, Budgets,
// Recurring, Savings, Subscriptions, Purchases) stay under Money.
import { useMemo, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useSettingsValue } from '../hooks/useSettingsValue.js';
import { STORAGE_KEYS, storage } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { currencyCode, makeFmt } from '../utils/currency.js';
import { projectedSpend } from '../domain/ahead.js';
import { suppliesWithUsage } from '../utils/supplies.js';
import { monthSummary, spendByCategory, budgetStatus, upcomingBills, subscriptionsMonthly, safeToSpend, goalProgress } from '../domain/money.js';
import { CATEGORIES } from './Finance.jsx';
import { label } from '../components/ui.js';

const CARD = { padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 };
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const STATE = { ok: 'var(--tab-accent)', near: '#e8a13a', over: '#e55a5a' };
const GOOD = '#4caf7d', BAD = '#e55a5a';
const toast = (detail) => window.dispatchEvent(new CustomEvent('valerie:toast', { detail }));
const parse = (key) => new Date(`${key}T00:00:00`);
const shortDay = (key) => parse(key).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const field = { height: 38, padding: '0 10px', borderRadius: 9, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', minWidth: 0 };
const btn = { height: 38, padding: '0 14px', borderRadius: 9, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const primary = { ...btn, background: 'var(--tab-accent)', color: 'var(--on-tab-accent)', border: 'none' };
const linkBtn = { background: 'none', border: 'none', color: 'var(--tab-accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 4, fontFamily: 'inherit' };

function Bar({ pct, colour, height = 6 }) {
  return (
    <span aria-hidden="true" style={{ display: 'block', height, borderRadius: 999, background: 'var(--hover-bg)', overflow: 'hidden' }}>
      <span style={{ display: 'block', height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: colour, borderRadius: 999, transition: 'width 400ms ease' }} />
    </span>
  );
}

function Stat({ title, value, sub, colour }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...label, marginBottom: 6 }}>{title}</div>
      <div className="val-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 600, color: colour || 'var(--text-primary)', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

// One slot per day of the month, so a bar sits where its day is; days still to come are faint stubs.
function DailyBars({ daily, daysInMonth, height = 54 }) {
  const max = Math.max(1, ...daily.map(d => d.amount));
  const byDay = new Map(daily.map(d => [d.day, d.amount]));
  return (
    <div role="img" aria-label="Spending per day this month" style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height }}>
      {Array.from({ length: daysInMonth }, (_, k) => {
        const day = k + 1, amt = byDay.get(day);
        const past = amt !== undefined;
        return <span key={day} title={past ? `${day}: ${amt}` : ''} style={{ flex: 1, minWidth: 2, height: past ? `${Math.max(amt ? 8 : 3, (amt / max) * 100)}%` : '3%', borderRadius: 2, background: amt ? 'var(--tab-accent)' : 'var(--card-border)', opacity: past ? (amt ? 0.9 : 0.7) : 0.4 }} />;
      })}
    </div>
  );
}

export default function MoneyToday({ onTabChange, compact = false }) {
  const today = toLocalDateKey(new Date());
  const settings = useSettingsValue();
  const fmt = useMemo(() => makeFmt(currencyCode(settings), { decimals: 2 }), [settings]);
  const fmt0 = useMemo(() => makeFmt(currencyCode(settings), { decimals: 0 }), [settings]);
  const go = (screen) => onTabChange?.(screen);

  const txn = useCollection('transactions', STORAGE_KEYS.TRANSACTIONS);
  const goals = useCollection('savings_goals', STORAGE_KEYS.SAVINGS);
  const subs = useCollection('subscriptions', STORAGE_KEYS.SUBSCRIPTIONS);
  const recurring = useCollection('recurring_transactions', STORAGE_KEYS.RECURRING);
  const purchases = useCollection('planned_purchases', STORAGE_KEYS.PLANNED_PURCHASES);
  const supplies = useCollection('essentials', STORAGE_KEYS.ESSENTIALS);

  const [kind, setKind] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const summary = useMemo(() => monthSummary(txn.items, today), [txn.items, today]);
  const budgets = storage.get(STORAGE_KEYS.BUDGETS, {}) || {};
  const budget = useMemo(() => budgetStatus(budgets, spendByCategory(txn.items, today)), [txn.items, today, JSON.stringify(budgets)]); // eslint-disable-line react-hooks/exhaustive-deps
  const bills = useMemo(() => upcomingBills({ recurring: recurring.items, subscriptions: subs.items, today, days: 14 }), [recurring.items, subs.items, today]);
  const allowance = useMemo(() => safeToSpend({ summary, budget, bills: upcomingBills({ recurring: recurring.items, subscriptions: subs.items, today, days: summary ? summary.daysLeft - 1 : 0 }) }), [summary, budget, recurring.items, subs.items, today]);
  const subMonthly = useMemo(() => subscriptionsMonthly(subs.items), [subs.items]);
  const goalRows = useMemo(() => goalProgress(goals.items, today), [goals.items, today]);
  const restocks = projectedSpend(suppliesWithUsage(supplies.items || [], today), today, { days: 30 });
  const pending = (purchases.items || []).filter(p => !p.completed).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const recent = useMemo(() => [...(txn.items || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 7), [txn.items]);

  if (!summary) return null;
  const hasAny = (txn.items || []).length > 0;
  const month = parse(`${summary.month}-01`).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  const expenseCats = CATEGORIES.filter(c => c.id !== 'income');
  const paceColour = allowance && summary.pace != null && summary.income > 0 && summary.pace > summary.income ? BAD : undefined;

  async function add() {
    const n = Number(amount);
    if (!(n > 0 && n < 10000000)) { setError('Enter an amount above zero.'); return; }
    const row = { type: kind, amount: Math.round(n * 100) / 100, category: kind === 'income' ? 'income' : category, description: note.trim().slice(0, 80), date: today, createdAt: new Date().toISOString() };
    const id = await txn.add(row);
    if (!id) { setError('Could not save. Are you signed in?'); return; }
    setError(''); setAmount(''); setNote('');
    toast({ message: `${kind === 'income' ? 'Income' : 'Spent'} ${fmt(row.amount)}`, type: 'success', undo: () => txn.remove(id) });
  }

  return (
    <div style={{ padding: compact ? '12px 14px 28px' : '20px 28px 40px', display: 'flex', flexDirection: 'column', gap: 16, width: '100%', boxSizing: 'border-box', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={label}>{month} · day {summary.dayOfMonth} of {summary.daysInMonth}</div>
          <h1 style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)', fontSize: compact ? 22 : 28, fontWeight: 600, letterSpacing: '0.03em', color: 'var(--text-primary)' }}>Money</h1>
        </div>
        <button type="button" style={btn} onClick={() => go('finance')}>All spending, budgets and bills</button>
      </div>

      <section aria-label="This month" style={{ ...CARD, gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 18 }}>
          <Stat title="Net this month" value={`${summary.net < 0 ? '-' : ''}${fmt0(Math.abs(summary.net))}`} colour={summary.net >= 0 ? GOOD : BAD} sub={summary.savingsRate != null ? `${summary.savingsRate}% of income kept` : 'No income logged yet'} />
          <Stat title="Income" value={fmt0(summary.income)} />
          <Stat title="Spent" value={fmt0(summary.spend)} sub={summary.vsLastMonth == null ? null : `${summary.vsLastMonth > 0 ? '+' : ''}${summary.vsLastMonth}% vs the same days last month`} colour={summary.vsLastMonth != null && summary.vsLastMonth > 15 ? BAD : undefined} />
          <Stat title="Month-end pace" value={summary.pace == null ? '–' : fmt0(summary.pace)} colour={paceColour} sub={summary.pace == null ? 'Needs five days of data' : summary.income > 0 ? (summary.pace > summary.income ? 'More than your income so far' : 'Within your income so far') : 'If you keep spending like this'} />
        </div>
        <DailyBars daily={summary.daily} daysInMonth={summary.daysInMonth} />
      </section>

      <div className="plan-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section aria-label="Safe to spend" style={CARD}>
            <div style={label}>Safe to spend today</div>
            {allowance ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span className="val-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 600, color: allowance.over > 0 ? BAD : 'var(--text-primary)' }}>{fmt0(allowance.perDay)}</span>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>a day for {plural(allowance.days, 'day')}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {allowance.over > 0
                    ? `You are ${fmt0(allowance.over)} over ${allowance.basis === 'budget' ? 'your budgets' : 'what you have earned after bills'} this month.`
                    : allowance.basis === 'budget'
                      ? `${fmt0(allowance.left)} left across your budgets.`
                      : `${fmt0(allowance.left)} left of this month's income after spending so far and the bills still due. Set budgets for a sharper number.`}
                </div>
              </>
            ) : <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Log income, or set budgets under Money, and this turns into a daily allowance.</div>}
          </section>

          <section aria-label="Budgets" style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={label}>Budgets{budget.rows.length ? ` · ${fmt0(budget.totalSpent)} of ${fmt0(budget.totalBudget)}` : ''}</div>
              <button type="button" onClick={() => go('finance')} style={linkBtn}>Edit</button>
            </div>
            {budget.rows.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>No budgets yet. Set one per category under Money and track them here.</div>}
            {budget.rows.map(r => (
              <div key={r.cat} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--text-primary)' }}>{CAT[r.cat]?.label ?? r.cat}</span>
                  <span className="val-num" style={{ color: r.state === 'over' ? BAD : 'var(--text-secondary)' }}>{fmt0(r.spent)} / {fmt0(r.budget)}{r.state === 'over' ? `  ${fmt0(-r.left)} over` : `  ${fmt0(r.left)} left`}</span>
                </div>
                <Bar pct={r.pct} colour={STATE[r.state]} />
              </div>
            ))}
          </section>

          <section aria-label="Quick add" style={CARD}>
            <div style={label}>Add a transaction</div>
            <div role="group" aria-label="Type" style={{ display: 'inline-flex', padding: 3, borderRadius: 10, background: 'var(--hover-bg)', gap: 2, alignSelf: 'flex-start' }}>
              {['expense', 'income'].map(k => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', textTransform: 'capitalize', background: kind === k ? 'var(--tab-accent)' : 'transparent', color: kind === k ? 'var(--on-tab-accent)' : 'var(--text-secondary)' }}>{k}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input aria-label="Amount" inputMode="decimal" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} style={{ ...field, width: 110, fontFamily: 'var(--font-mono)' }} />
              {kind === 'expense' && (
                <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)} style={{ ...field, paddingRight: 30 }}>
                  {expenseCats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              )}
              <input aria-label="Note" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} style={{ ...field, flex: 1, minWidth: 140 }} />
              <button type="button" style={primary} onClick={add}>Add</button>
            </div>
            {error && <div role="alert" style={{ fontSize: 12.5, color: BAD }}>{error}</div>}
          </section>

          <section aria-label="Recent" style={{ ...CARD, gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={label}>Recent</div>
              <button type="button" onClick={() => go('finance')} style={linkBtn}>All transactions</button>
            </div>
            {!hasAny && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Nothing logged yet. Add your first transaction above.</div>}
            {recent.map(t => (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, padding: '9px 0', borderTop: '0.5px solid var(--card-border)', alignItems: 'center' }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || CAT[t.category]?.label || 'Transaction'}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{CAT[t.category]?.label ?? t.category} · {t.date === today ? 'Today' : shortDay(t.date)}</span>
                </span>
                <span className="val-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: t.type === 'income' ? GOOD : 'var(--text-primary)' }}>{t.type === 'income' ? '+' : '-'}{fmt(t.amount)}</span>
              </div>
            ))}
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section aria-label="Upcoming bills" style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={label}>Next 14 days{bills.items.length ? ` · ${fmt0(bills.total)}` : ''}</div>
              <button type="button" onClick={() => go('finance')} style={linkBtn}>Bills</button>
            </div>
            {bills.items.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>No bills or renewals due. Add recurring payments and subscriptions under Money.</div>}
            {bills.items.slice(0, 6).map((b, i) => (
              <div key={`${b.kind}:${b.name}:${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{b.name}<span style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{b.daysLeft === 0 ? '  today' : b.daysLeft === 1 ? '  tomorrow' : `  ${shortDay(b.date)}`}</span></span>
                <span className="val-num" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', flexShrink: 0 }}>{fmt(b.amount)}</span>
              </div>
            ))}
          </section>

          <section aria-label="Where it went" style={CARD}>
            <div style={label}>Where it went</div>
            {summary.categories.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>No spending yet this month.</div>}
            {summary.categories.slice(0, 5).map(c => (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--text-primary)' }}>{CAT[c.id]?.label ?? c.id}</span>
                  <span className="val-num" style={{ color: 'var(--text-secondary)' }}>{fmt0(c.total)} · {Math.round((c.total / Math.max(1, summary.spend)) * 100)}%</span>
                </div>
                <Bar pct={(c.total / Math.max(1, summary.spend)) * 100} colour={CAT[c.id]?.colour || 'var(--tab-accent)'} />
              </div>
            ))}
          </section>

          <section aria-label="Savings goals" style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={label}>Savings goals</div>
              <button type="button" onClick={() => go('finance')} style={linkBtn}>Manage</button>
            </div>
            {goalRows.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Add a goal under Money and watch it fill here.</div>}
            {goalRows.slice(0, 4).map(g => (
              <div key={g.id ?? g.name} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, gap: 8 }}>
                  <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                  <span className="val-num" style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{fmt0(g.current)} / {fmt0(g.target)}</span>
                </div>
                <Bar pct={g.pct} colour={g.done ? GOOD : 'var(--tab-accent)'} />
                {g.perMonth && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmt0(g.perMonth)} a month reaches it by {shortDay(g.deadline)}.</div>}
              </div>
            ))}
          </section>

          <section aria-label="Committed" style={CARD}>
            <div style={label}>Already committed</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--text-primary)' }}>Subscriptions<span style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{`  ${plural((subs.items || []).filter(s => s.status === 'active').length, 'active')}`}</span></span>
              <span className="val-num" style={{ fontFamily: 'var(--font-mono)' }}>{fmt0(subMonthly)}/mo</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <button type="button" onClick={() => go('essentials')} style={{ all: 'unset', cursor: 'pointer', color: 'var(--text-primary)' }}>Supplies, next 30 days</button>
              <span className="val-num" style={{ fontFamily: 'var(--font-mono)' }}>{restocks.total > 0 ? fmt0(restocks.total) : '–'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--text-primary)' }}>Planned purchases</span>
              <span className="val-num" style={{ fontFamily: 'var(--font-mono)' }}>{pending > 0 ? fmt0(pending) : '–'}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
