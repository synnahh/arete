// ─── VALERIE — Finance Tab ────────────────────────────────────────────────────
import { useState } from 'react';
import { useCollection }           from '../firebase/useCollection.js';
import { STORAGE_KEYS }            from '../utils/storage.js';
import { BarChart, DonutChart, MilestoneLine, ProgressBar } from '../components/Charts.jsx';

// ─── Spending categories ──────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'food',          label: 'Food & Drink',   colour: '#f4a642', icon: '🍔' },
  { id: 'transport',     label: 'Transport',       colour: '#5b9cf6', icon: '🚗' },
  { id: 'shopping',      label: 'Shopping',        colour: '#e55a5a', icon: '🛍️' },
  { id: 'entertainment', label: 'Entertainment',   colour: '#a78bfa', icon: '🎬' },
  { id: 'health',        label: 'Health',          colour: '#4caf7d', icon: '💊' },
  { id: 'bills',         label: 'Bills',           colour: '#64748b', icon: '📋' },
  { id: 'housing',       label: 'Housing',         colour: '#94a3b8', icon: '🏠' },
  { id: 'other',         label: 'Other',           colour: '#6b7280', icon: '📦' },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

// ─── Subscription categories ──────────────────────────────────────────────────
const SUB_CATS = [
  { id: 'streaming', label: 'Streaming', icon: '📺' },
  { id: 'software',  label: 'Software',  icon: '💻' },
  { id: 'fitness',   label: 'Fitness',   icon: '💪' },
  { id: 'food',      label: 'Food',      icon: '🍕' },
  { id: 'finance',   label: 'Finance',   icon: '💳' },
  { id: 'music',     label: 'Music',     icon: '🎵' },
  { id: 'cloud',     label: 'Cloud',     icon: '☁️' },
  { id: 'other',     label: 'Other',     icon: '📦' },
];

// ─── Nav sections ─────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'overview',       label: 'Overview',       icon: '◈' },
  { id: 'spending',       label: 'Spending',        icon: '📊' },
  { id: 'savings',        label: 'Savings',         icon: '🎯' },
  { id: 'subscriptions',  label: 'Subscriptions',   icon: '🔄' },
];

// ─── Utilities ────────────────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().split('T')[0];

function fmt(n) {
  return `£${Math.abs(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function toMonthly(amount, cycle) {
  if (cycle === 'weekly')  return (amount || 0) * 4.33;
  if (cycle === 'yearly')  return (amount || 0) / 12;
  return amount || 0;
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const INPUT = {
  flex: 1, padding: '8px 12px', borderRadius: 8,
  background: 'rgba(255,255,255,0.06)',
  border: '0.5px solid var(--card-border)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
};
const BTN_ACCENT = {
  padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 500,
};
const BTN_GHOST = {
  padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontSize: 13,
};

// ─── Panel wrapper ────────────────────────────────────────────────────────────
function Panel({ children, style }) {
  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '0.5px solid var(--card-border)',
      borderRadius: 12,
      padding: '16px 20px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 12 }}>
      {children}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function Overview({ transactions, goals, subscriptions }) {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const thisMonth  = transactions.filter(t => t.date >= monthStart);

  const income   = thisMonth.filter(t => t.type === 'income').reduce((s, t)  => s + (t.amount || 0), 0);
  const expenses = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const net      = income - expenses;

  const monthlySubCost = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + toMonthly(s.amount, s.cycle), 0);

  const recent = [...transactions]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 10);

  const StatCard = ({ label, value, colour, sub }) => (
    <Panel style={{ flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 300, color: colour || 'var(--text-primary)', marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </Panel>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard label="INCOME"        value={fmt(income)}    colour="#4caf7d" sub="This month" />
        <StatCard label="EXPENSES"      value={fmt(expenses)}  colour="#e55a5a" sub="This month" />
        <StatCard label="NET"
          value={(net >= 0 ? '+' : '−') + fmt(net)}
          colour={net >= 0 ? '#4caf7d' : '#e55a5a'}
          sub="Balance" />
        <StatCard label="SUBSCRIPTIONS" value={fmt(monthlySubCost)} sub="Monthly cost" />
      </div>

      <Panel>
        <Label>RECENT TRANSACTIONS</Label>
        {recent.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            No transactions yet — head to Spending to add some.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recent.map((t, i) => {
              const cat = CAT_MAP[t.category] || { colour: '#6b7280', icon: '📦', label: t.category || 'Other' };
              return (
                <div key={t.id ?? i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 0',
                  borderBottom: i < recent.length - 1 ? '0.5px solid var(--card-border)' : 'none',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: cat.colour + '22',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                  }}>
                    {cat.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.description || cat.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {fmtDate(t.date)} · {cat.label}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 400, flexShrink: 0,
                    color: t.type === 'income' ? '#4caf7d' : '#e55a5a',
                  }}>
                    {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ─── Spending ─────────────────────────────────────────────────────────────────
function Spending({ transactions, onAdd }) {
  const [type,     setType]     = useState('expense');
  const [amount,   setAmount]   = useState('');
  const [category, setCat]      = useState('food');
  const [desc,     setDesc]     = useState('');
  const [date,     setDate]     = useState(todayISO());
  const [period,   setPeriod]   = useState('month');

  const now = new Date();

  let periodStart;
  if (period === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    periodStart = d.toISOString().split('T')[0];
  } else if (period === 'month') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  } else {
    periodStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  }

  const filtered = transactions.filter(t => t.type === 'expense' && (t.date || '') >= periodStart);

  // Bar chart data
  const barData = (() => {
    if (period === 'year') {
      return Array.from({ length: 12 }, (_, i) => {
        const key = `${now.getFullYear()}-${String(i + 1).padStart(2, '0')}`;
        const val = transactions
          .filter(t => t.type === 'expense' && (t.date || '').startsWith(key))
          .reduce((s, t) => s + (t.amount || 0), 0);
        return {
          value: Math.round(val * 100) / 100,
          label: new Date(now.getFullYear(), i, 1).toLocaleDateString('en-GB', { month: 'short' }),
          muted: i > now.getMonth(),
        };
      });
    }
    const days = period === 'week' ? 7 : 30;
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (days - 1 - i));
      const key = d.toISOString().split('T')[0];
      const val = transactions
        .filter(t => t.type === 'expense' && t.date === key)
        .reduce((s, t) => s + (t.amount || 0), 0);
      return {
        value: Math.round(val * 100) / 100,
        label: i === days - 1 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short' }),
        muted: false,
      };
    });
  })();

  // Donut chart data
  const catTotals = {};
  filtered.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + (t.amount || 0); });
  const donutData = CATEGORIES
    .filter(c => catTotals[c.id] > 0)
    .map(c => ({ ...c, value: catTotals[c.id] }))
    .sort((a, b) => b.value - a.value);

  const totalSpend = filtered.reduce((s, t) => s + (t.amount || 0), 0);

  function handleAdd() {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    onAdd({ amount: n, type, category, description: desc.trim() || null, date });
    setAmount(''); setDesc('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Add transaction */}
      <Panel>
        <Label>ADD TRANSACTION</Label>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {['expense', 'income'].map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              padding: '6px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
              background: type === t ? (t === 'income' ? '#4caf7d' : '#e55a5a') : 'rgba(255,255,255,0.06)',
              color: type === t ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.18s ease',
            }}>
              {t === 'expense' ? '− Expense' : '+ Income'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <input
            type="number" placeholder="0.00" value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{ ...INPUT, flex: 2, fontSize: 20, fontWeight: 300 }}
          />
          <input
            type="date" value={date}
            onChange={e => setDate(e.target.value)}
            style={{ ...INPUT, flex: 1 }}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)} style={{
              padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
              background: category === c.id ? c.colour + '33' : 'rgba(255,255,255,0.05)',
              color: category === c.id ? c.colour : 'var(--text-secondary)',
              outline: category === c.id ? `0.5px solid ${c.colour}55` : '0.5px solid transparent',
              transition: 'all 0.16s ease',
            }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <input
            placeholder="Description (optional)"
            value={desc} onChange={e => setDesc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={INPUT}
          />
          <button onClick={handleAdd} style={BTN_ACCENT}>Add</button>
        </div>
      </Panel>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['week', '7 days'], ['month', 'This month'], ['year', 'This year']].map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)} style={{
            padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
            background: period === v ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
            color: period === v ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.16s ease',
          }}>
            {l}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Panel style={{ flex: 2, minWidth: 260 }}>
          <Label>DAILY SPENDING</Label>
          <BarChart
            data={barData}
            maxHeight={100}
            colour="var(--accent)"
            minBarWidth={period === 'month' ? 8 : 18}
          />
        </Panel>

        <Panel style={{ flex: 1, minWidth: 200 }}>
          <Label>BY CATEGORY</Label>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <DonutChart
              segments={donutData}
              size={110} thickness={18}
              label={fmt(totalSpend)}
              sublabel="total"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              {donutData.length === 0 ? (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data</span>
              ) : donutData.slice(0, 5).map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.colour, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.label}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{fmt(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Savings ──────────────────────────────────────────────────────────────────
function Savings({ goals, onAdd, onUpdate, onRemove }) {
  const [showForm,  setShowForm]  = useState(false);
  const [name,      setName]      = useState('');
  const [target,    setTarget]    = useState('');
  const [current,   setCurrent]   = useState('');
  const [deadline,  setDeadline]  = useState('');
  const [addingTo,  setAddingTo]  = useState(null);
  const [addAmt,    setAddAmt]    = useState('');

  function handleCreate() {
    const t = parseFloat(target);
    if (!name.trim() || !t || t <= 0) return;
    onAdd({
      name: name.trim(),
      target: t,
      current: parseFloat(current) || 0,
      deadline: deadline || null,
      milestones: [
        { pct: 25,  label: '25%' },
        { pct: 50,  label: '50%' },
        { pct: 75,  label: '75%' },
        { pct: 100, label: '🎉' },
      ],
    });
    setName(''); setTarget(''); setCurrent(''); setDeadline('');
    setShowForm(false);
  }

  function handleAddFunds(goal) {
    const n = parseFloat(addAmt);
    if (!n || n <= 0) return;
    onUpdate(goal.id, { current: Math.min((goal.current || 0) + n, goal.target) });
    setAddingTo(null); setAddAmt('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>SAVINGS GOALS</span>
        <button onClick={() => setShowForm(v => !v)} style={BTN_ACCENT}>+ New Goal</button>
      </div>

      {showForm && (
        <Panel>
          <Label>NEW SAVINGS GOAL</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input placeholder="Goal name (e.g. Holiday fund)"
                value={name} onChange={e => setName(e.target.value)} style={INPUT} />
              <input type="number" placeholder="Target £"
                value={target} onChange={e => setTarget(e.target.value)}
                style={{ ...INPUT, flex: '0 0 120px' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="number" placeholder="Already saved £"
                value={current} onChange={e => setCurrent(e.target.value)} style={INPUT} />
              <input type="date"
                value={deadline} onChange={e => setDeadline(e.target.value)}
                style={{ ...INPUT, flex: '0 0 160px' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={BTN_GHOST}>Cancel</button>
              <button onClick={handleCreate} style={BTN_ACCENT}>Create Goal</button>
            </div>
          </div>
        </Panel>
      )}

      {goals.length === 0 && !showForm && (
        <Panel style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🎯</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No savings goals yet. Create one to get started.</div>
        </Panel>
      )}

      {goals.map(goal => {
        const pct   = goal.target > 0 ? Math.min(((goal.current || 0) / goal.target) * 100, 100) : 0;
        const done  = pct >= 100;
        const dLeft = goal.deadline ? daysUntil(goal.deadline) : null;
        const warn  = dLeft != null && dLeft >= 0 && dLeft <= 30;

        return (
          <Panel key={goal.id} style={{ borderColor: done ? '#4caf7d44' : 'var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 400 }}>
                  {goal.name}{done ? ' 🎉' : ''}
                </div>
                {goal.deadline && (
                  <div style={{ fontSize: 11, color: dLeft < 0 ? '#e55a5a' : warn ? '#f4a642' : 'var(--text-muted)', marginTop: 3 }}>
                    {dLeft < 0 ? 'Deadline passed' : warn ? `${dLeft} day${dLeft !== 1 ? 's' : ''} left` : `Due ${fmtDate(goal.deadline)}`}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 300, color: done ? '#4caf7d' : 'var(--text-primary)' }}>
                  {fmt(goal.current || 0)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>of {fmt(goal.target)}</div>
              </div>
            </div>

            <ProgressBar value={pct} max={100} colour={done ? '#4caf7d' : 'var(--accent)'} height={6} />

            {goal.milestones?.length > 0 && (
              <div style={{ margin: '10px 0 4px' }}>
                <MilestoneLine milestones={goal.milestones} progress={pct} colour={done ? '#4caf7d' : 'var(--accent)'} />
              </div>
            )}

            {!done && (
              addingTo === goal.id ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <input
                    type="number" placeholder="Amount to add £"
                    value={addAmt} onChange={e => setAddAmt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddFunds(goal)}
                    style={INPUT} autoFocus
                  />
                  <button onClick={() => handleAddFunds(goal)} style={BTN_ACCENT}>Save</button>
                  <button onClick={() => { setAddingTo(null); setAddAmt(''); }} style={BTN_GHOST}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setAddingTo(goal.id)} style={BTN_GHOST}>+ Add funds</button>
                  <button onClick={() => onRemove(goal.id)} style={{ ...BTN_GHOST, color: '#e55a5a' }}>Remove</button>
                </div>
              )
            )}
          </Panel>
        );
      })}
    </div>
  );
}

// ─── Subscriptions ────────────────────────────────────────────────────────────
function Subscriptions({ subs, onAdd, onUpdate, onRemove }) {
  const [showForm,  setShowForm]  = useState(false);
  const [name,      setName]      = useState('');
  const [amount,    setAmount]    = useState('');
  const [cycle,     setCycle]     = useState('monthly');
  const [nextBill,  setNextBill]  = useState(todayISO());
  const [subCat,    setSubCat]    = useState('streaming');

  function handleAdd() {
    const n = parseFloat(amount);
    if (!name.trim() || !n || n <= 0) return;
    onAdd({ name: name.trim(), amount: n, cycle, nextBilling: nextBill, category: subCat, status: 'active' });
    setName(''); setAmount(''); setNextBill(todayISO());
    setShowForm(false);
  }

  const active       = subs.filter(s => s.status !== 'cancelled');
  const monthlyTotal = active.reduce((sum, s) => sum + toMonthly(s.amount, s.cycle), 0);
  const yearlyTotal  = monthlyTotal * 12;
  const sorted       = [...subs].sort((a, b) => (a.nextBilling || '').localeCompare(b.nextBilling || ''));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary totals */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Panel style={{ flex: 1, minWidth: 140, padding: '14px 18px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>MONTHLY</div>
          <div style={{ fontSize: 24, fontWeight: 300, color: 'var(--text-primary)', marginTop: 4 }}>{fmt(monthlyTotal)}</div>
        </Panel>
        <Panel style={{ flex: 1, minWidth: 140, padding: '14px 18px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>YEARLY</div>
          <div style={{ fontSize: 24, fontWeight: 300, color: 'var(--text-primary)', marginTop: 4 }}>{fmt(yearlyTotal)}</div>
        </Panel>
        <button onClick={() => setShowForm(v => !v)} style={{ ...BTN_ACCENT, whiteSpace: 'nowrap' }}>
          + Add
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <Panel>
          <Label>NEW SUBSCRIPTION</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input placeholder="Name (e.g. Netflix)"
                value={name} onChange={e => setName(e.target.value)} style={INPUT} />
              <input type="number" placeholder="£" value={amount}
                onChange={e => setAmount(e.target.value)}
                style={{ ...INPUT, flex: '0 0 90px' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {['weekly', 'monthly', 'yearly'].map(c => (
                <button key={c} onClick={() => setCycle(c)} style={{
                  padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
                  background: cycle === c ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                  color: cycle === c ? '#fff' : 'var(--text-secondary)',
                }}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Next billing date</div>
              <input type="date" value={nextBill} onChange={e => setNextBill(e.target.value)} style={INPUT} />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SUB_CATS.map(c => (
                <button key={c.id} onClick={() => setSubCat(c.id)} style={{
                  padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
                  background: subCat === c.id ? 'var(--accent)33' : 'rgba(255,255,255,0.05)',
                  color: subCat === c.id ? 'var(--accent)' : 'var(--text-secondary)',
                  outline: subCat === c.id ? '0.5px solid var(--accent)44' : '0.5px solid transparent',
                }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={BTN_GHOST}>Cancel</button>
              <button onClick={handleAdd} style={BTN_ACCENT}>Add Subscription</button>
            </div>
          </div>
        </Panel>
      )}

      {/* Empty state */}
      {sorted.length === 0 && !showForm && (
        <Panel style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🔄</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No subscriptions tracked yet.</div>
        </Panel>
      )}

      {/* List */}
      {sorted.length > 0 && (
        <Panel style={{ padding: 0, overflow: 'hidden' }}>
          {sorted.map((s, i) => {
            const cat       = SUB_CATS.find(c => c.id === s.category) || { icon: '📦', label: 'Other' };
            const days      = daysUntil(s.nextBilling);
            const dueSoon   = days != null && days <= 7 && days >= 0;
            const overdue   = days != null && days < 0;
            const paused    = s.status === 'paused';
            const cancelled = s.status === 'cancelled';
            const monthly   = toMonthly(s.amount, s.cycle);

            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 18px',
                borderBottom: i < sorted.length - 1 ? '0.5px solid var(--card-border)' : 'none',
                opacity: cancelled ? 0.45 : 1,
              }}>
                {/* Status dot */}
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: cancelled ? '#555' : paused ? '#f4a642' : '#4caf7d',
                  boxShadow: (!cancelled && !paused) ? '0 0 5px rgba(76,175,125,0.5)' : 'none',
                }} />

                <div style={{ fontSize: 18, flexShrink: 0 }}>{cat.icon}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11, color: overdue ? '#e55a5a' : dueSoon ? '#f4a642' : 'var(--text-muted)' }}>
                    {cancelled
                      ? 'Cancelled'
                      : paused
                      ? 'Paused'
                      : overdue
                      ? 'Overdue'
                      : dueSoon
                      ? `Due in ${days} day${days !== 1 ? 's' : ''}`
                      : `Renews ${fmtDate(s.nextBilling)}`}
                    {' · '}{s.cycle}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{fmt(s.amount)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmt(monthly)}/mo</div>
                </div>

                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  {!cancelled && (
                    <button
                      onClick={() => onUpdate(s.id, { status: paused ? 'active' : 'paused' })}
                      title={paused ? 'Resume' : 'Pause'}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: 12,
                      }}
                    >
                      {paused ? '▶' : '⏸'}
                    </button>
                  )}
                  <button onClick={() => onRemove(s.id)} title="Remove" style={{
                    width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.06)', color: '#e55a5a', fontSize: 16, lineHeight: 1,
                  }}>
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </Panel>
      )}
    </div>
  );
}

// ─── Main Finance Tab ─────────────────────────────────────────────────────────
export default function Finance({ settings }) {
  const [section, setSection] = useState('overview');

  const txn   = useCollection('transactions',  STORAGE_KEYS.TRANSACTIONS);
  const goals = useCollection('savings_goals', STORAGE_KEYS.SAVINGS);
  const subs  = useCollection('subscriptions', STORAGE_KEYS.SUBSCRIPTIONS);

  function addTransaction(data) {
    txn.add({ ...data, createdAt: new Date().toISOString() });
  }
  function addGoal(data) {
    goals.add({ ...data, createdAt: new Date().toISOString() });
  }
  function addSub(data) {
    subs.add({ ...data, createdAt: new Date().toISOString() });
  }

  const panels = {
    overview: (
      <Overview
        transactions={txn.items}
        goals={goals.items}
        subscriptions={subs.items}
      />
    ),
    spending: (
      <Spending
        transactions={txn.items}
        onAdd={addTransaction}
      />
    ),
    savings: (
      <Savings
        goals={goals.items}
        onAdd={addGoal}
        onUpdate={goals.update}
        onRemove={goals.remove}
      />
    ),
    subscriptions: (
      <Subscriptions
        subs={subs.items}
        onAdd={addSub}
        onUpdate={subs.update}
        onRemove={subs.remove}
      />
    ),
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Left nav */}
      <nav style={{
        width: 150, flexShrink: 0,
        borderRight: '0.5px solid var(--card-border)',
        padding: '16px 8px',
        display: 'flex', flexDirection: 'column', gap: 4,
        overflowY: 'auto',
      }}>
        {SECTIONS.map(s => {
          const active = section === s.id;
          return (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 8,
              border: 'none', cursor: 'pointer',
              background: active ? 'var(--active-bg)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-secondary)',
              borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
              textAlign: 'left', fontSize: 13, width: '100%',
              transition: 'all 0.18s ease',
            }}>
              <span style={{ fontSize: 15 }}>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {panels[section]}
      </div>
    </div>
  );
}
