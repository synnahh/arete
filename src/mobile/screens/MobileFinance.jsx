// ─── MobileFinance.jsx — Finance tab for VALERIE iOS PWA ─────────────────────
import { useState, useMemo } from 'react';
import { useCollection } from '../../supabase/useCollection.js';
import { STORAGE_KEYS }  from '../../utils/storage.js';
import { currencySymbol as currencySym, DEFAULT_CURRENCY } from '../../utils/currency.js';
import { toLocalDateKey } from '../../utils/localDate.js';
import { projectedSpend } from '../../domain/ahead.js';
import { suppliesWithUsage } from '../../utils/supplies.js';

const CATEGORIES = [
  { id: 'food',          label: 'Food & Drink',   colour: '#f4a642', icon: '🍔' },
  { id: 'transport',     label: 'Transport',       colour: '#5b9cf6', icon: '🚗' },
  { id: 'shopping',      label: 'Shopping',        colour: '#e55a5a', icon: '🛒' },
  { id: 'entertainment', label: 'Entertainment',   colour: '#a78bfa', icon: '🎬' },
  { id: 'health',        label: 'Health',          colour: '#4caf7d', icon: '💊' },
  { id: 'bills',         label: 'Bills',           colour: '#64748b', icon: '📋' },
  { id: 'housing',       label: 'Housing',         colour: '#94a3b8', icon: '🏠' },
  { id: 'income',        label: 'Income',          colour: '#4caf7d', icon: '💰' },
  { id: 'other',         label: 'Other',           colour: '#6b7280', icon: '📦' },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const PCAT_MAP = {
  restock: { label: 'Restock', colour: '#4a9eff', icon: '🔄' },
  fashion: { label: 'Fashion', colour: '#e25d7a', icon: '👗' },
  tech:    { label: 'Tech',    colour: '#9b5de5', icon: '💻' },
  home:    { label: 'Home',    colour: '#f4a642', icon: '🏠' },
  fitness: { label: 'Fitness', colour: '#4caf7d', icon: '🏋️' },
  other:   { label: 'Other',   colour: '#6b7280', icon: '📦' },
};

// Subscriptions store a `category` (streaming/software/...), not an icon
// directly — same categories as desktop's SUB_CATS.
const SUB_CATS = [
  { id: 'streaming', label: 'Streaming', icon: '📺' },
  { id: 'software',  label: 'Software',  icon: '💻' },
  { id: 'fitness',   label: 'Fitness',   icon: '🏋️' },
  { id: 'food',      label: 'Food',      icon: '🍕' },
  { id: 'finance',   label: 'Finance',   icon: '💳' },
  { id: 'music',     label: 'Music',     icon: '🎵' },
  { id: 'cloud',     label: 'Cloud',     icon: '☁️' },
  { id: 'other',     label: 'Other',     icon: '📦' },
];

const SUB_TABS = ['Overview', 'Spending', 'Subscriptions', 'Purchases'];

function todayISO() { return toLocalDateKey(new Date()); }

// Income is marked by `type` (desktop, assistant, Gmail import) or, on older phone
// rows, by category. Reading only the category counted assistant and Gmail income
// (category "Income") as spending.
const isIncomeTx = (t) => (t.type ? t.type === 'income' : String(t.category).toLowerCase() === 'income');

function fmtDate(str) {
  if (!str) return '—';
  const today = toLocalDateKey(new Date());
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yStr = toLocalDateKey(yesterday);
  if (str === today) return 'Today';
  if (str === yStr)  return 'Yesterday';
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function toMonthly(amount, cycle) {
  if (cycle === 'weekly') return (amount || 0) * 4.33;
  if (cycle === 'yearly') return (amount || 0) / 12;
  return amount || 0;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

// ── Cards ──────────────────────────────────────────────────────────────────────
function MCard({ children, style = {} }) {
  return (
    <div style={{ background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 16, overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

function MLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
      {children}
    </div>
  );
}

// ── Donut ──────────────────────────────────────────────────────────────────────
function Donut({ segments, size = 96, thickness = 13, centerLabel, centerSub }) {
  const r = (size - thickness) / 2, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
  const total = segments.reduce((s, g) => s + g.value, 0);
  if (total === 0) return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--hover-bg)" strokeWidth={thickness} />
    </svg>
  );
  let off = 0;
  const arcs = segments.map(s => {
    const pct = s.value / total;
    const arc = { ...s, dashArray: `${pct * circ} ${circ}`, dashOffset: -(off * circ) };
    off += pct; return arc;
  });
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--hover-bg)" strokeWidth={thickness} />
        {arcs.map((a, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.colour}
            strokeWidth={thickness} strokeDasharray={a.dashArray} strokeDashoffset={a.dashOffset}
            strokeLinecap="butt" />
        ))}
      </svg>
      {centerLabel && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 14, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>{centerLabel}</div>
          {centerSub && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{centerSub}</div>}
        </div>
      )}
    </div>
  );
}

// ── Overview ───────────────────────────────────────────────────────────────────
function OverviewTab({ transactions, subscriptions, purchases, settings }) {
  const currency = settings?.currency || DEFAULT_CURRENCY;
  const sym = currencySym(currency);
  const fmt = n => `${sym}${Math.abs(n || 0).toFixed(2)}`;

  const thisMonth = toLocalDateKey(new Date()).slice(0, 7);
  const monthTx   = transactions.filter(t => (t.date || '').startsWith(thisMonth));
  const income    = monthTx.filter(isIncomeTx).reduce((s, t) => s + (t.amount || 0), 0);
  const expenses  = monthTx.filter(t => !isIncomeTx(t)).reduce((s, t) => s + (t.amount || 0), 0);
  const balance   = income - expenses;

  const subTotal  = subscriptions.reduce((s, sub) => s + toMonthly(sub.amount, sub.cycle), 0);
  const pendingP  = purchases.filter(p => p.status !== 'bought').length;

  // Ahead: what restocking supplies will cost over the next 30 days
  const { items: supplies = [] } = useCollection('essentials', STORAGE_KEYS.ESSENTIALS);
  // Not memoised on `supplies` alone: it also reads the food log (via the mirror), and the sum is cheap.
  const restocks = projectedSpend(suppliesWithUsage(supplies, toLocalDateKey(new Date())), toLocalDateKey(new Date()), { days: 30 });

  // Spending by category (this month)
  const catMap = {};
  monthTx.filter(t => !isIncomeTx(t)).forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + (t.amount || 0);
  });
  const segments = Object.entries(catMap).map(([id, value]) => ({
    label: CAT_MAP[id]?.label || id, value, colour: CAT_MAP[id]?.colour || '#888'
  })).sort((a, b) => b.value - a.value).slice(0, 6);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'Income', value: fmt(income), color: '#4caf7d' },
          { label: 'Spent',  value: fmt(expenses), color: '#e05555' },
          { label: 'Left',   value: fmt(balance),  color: balance >= 0 ? '#4caf7d' : '#e05555' },
        ].map(({ label, value, color }) => (
          <MCard key={label} style={{ padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color }}>{value}</div>
          </MCard>
        ))}
      </div>

      {/* Spending donut */}
      <MCard style={{ padding: '16px 18px' }}>
        <MLabel>This Month's Spending</MLabel>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Donut segments={segments} centerLabel={fmt(expenses)} centerSub="spent" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {segments.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No spending logged</div>
              : segments.map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.colour, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{fmt(s.value)}</span>
                </div>
              ))
            }
          </div>
        </div>
      </MCard>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <MCard style={{ padding: '14px 16px' }}>
          <MLabel>Subscriptions</MLabel>
          <div style={{ fontSize: 22, fontWeight: 200, color: 'var(--text-primary)' }}>{fmt(subTotal)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>per month</div>
        </MCard>
        <MCard style={{ padding: '14px 16px' }}>
          <MLabel>Planned Buys</MLabel>
          <div style={{ fontSize: 22, fontWeight: 200, color: 'var(--text-primary)' }}>{pendingP}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>pending items</div>
        </MCard>
      </div>

      {/* Ahead: supply restocks over the next 30 days */}
      {restocks.lines.length > 0 && (
        <MCard style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <MLabel>Supplies · next 30 days</MLabel>
            <span className="val-num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(restocks.total)}</span>
          </div>
          {restocks.lines.map(l => (
            <div key={l.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6, fontSize: 12.5 }}>
              <span style={{ color: 'var(--text-primary)' }}>{l.name}{l.dates.length > 1 ? ` ×${l.dates.length}` : ''}</span>
              <span className="val-num" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{l.dates[0] <= todayISO() ? 'now' : fmtDate(l.dates[0])} · {fmt(l.subtotal)}</span>
            </div>
          ))}
        </MCard>
      )}

      {/* Recent transactions */}
      <MCard style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--card-border)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Recent</span>
        </div>
        {[...transactions].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5).map((t, i, arr) => {
          const cat = CAT_MAP[t.category] || CAT_MAP.other;
          const isIncome = isIncomeTx(t);
          return (
            <div key={t.id || i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderBottom: i < arr.length - 1 ? '0.5px solid var(--card-border)' : 'none',
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: `${cat.colour}20`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 15 }}>{cat.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.description || cat.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{fmtDate(t.date)}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: isIncome ? '#4caf7d' : 'var(--text-primary)', flexShrink: 0 }}>
                {isIncome ? '+' : '-'}{fmt(t.amount)}
              </div>
            </div>
          );
        })}
        {transactions.length === 0 && (
          <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-muted)' }}>No transactions yet</div>
        )}
      </MCard>
    </div>
  );
}

//  Log transaction sheet  matches desktop schema { amount, type, category, description, date }
function LogTransactionSheet({ onAdd, onClose }) {
  const [type, setType]   = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [desc, setDesc]   = useState('');

  function save() {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    onAdd({ amount: n, type, category: type === 'income' ? 'income' : category, description: desc.trim() || null, date: todayISO() });
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxHeight: '80vh', overflowY: 'auto',
        background: 'var(--bg-panel)', borderRadius: '20px 20px 0 0', padding: 18,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Log transaction</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {['expense', 'income'].map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: type === t ? '1px solid var(--accent)' : '0.5px solid var(--card-border)',
              background: type === t ? 'var(--active-bg)' : 'none',
              color: type === t ? 'var(--accent)' : 'var(--text-secondary)',
            }}>{t === 'expense' ? 'Expense' : 'Income'}</button>
          ))}
        </div>

        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="Amount" style={{
          padding: '10px 12px', borderRadius: 10, border: '0.5px solid var(--card-border)',
          background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 14, outline: 'none',
        }} />

        {type === 'expense' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.filter(c => c.id !== 'income').map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)} style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                border: category === c.id ? `1px solid ${c.colour}` : '0.5px solid var(--card-border)',
                background: category === c.id ? `${c.colour}22` : 'none',
                color: category === c.id ? c.colour : 'var(--text-secondary)',
              }}>{c.icon} {c.label}</button>
            ))}
          </div>
        )}

        <input value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Description (optional)" style={{
          padding: '10px 12px', borderRadius: 10, border: '0.5px solid var(--card-border)',
          background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 14, outline: 'none',
        }} />

        <button onClick={save} disabled={!amount} style={{
          padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--accent)',
          color: 'var(--bg-base)', fontWeight: 600, cursor: 'pointer', opacity: amount ? 1 : 0.4,
        }}>Log it</button>
      </div>
    </div>
  );
}

//  Spending
function SpendingTab({ transactions, settings, onAdd }) {
  const currency = settings?.currency || DEFAULT_CURRENCY;
  const sym = currencySym(currency);
  const fmt = n => `${sym}${Math.abs(n || 0).toFixed(2)}`;
  const [period, setPeriod] = useState('month');
  const [showAdd, setShowAdd] = useState(false);

  const now   = new Date();
  const filt  = transactions.filter(t => {
    if (!t.date) return false;
    if (period === 'month') return t.date.startsWith(toLocalDateKey(now).slice(0, 7));
    if (period === 'week') {
      const d = new Date(t.date);
      const diff = Math.floor((now - d) / 86400000);
      return diff >= 0 && diff < 7;
    }
    return t.date.startsWith(String(now.getFullYear()));
  });

  const byDay = {};
  filt.filter(t => !isIncomeTx(t)).forEach(t => {
    byDay[t.date] = (byDay[t.date] || 0) + (t.amount || 0);
  });
  const days = Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);

  const catMap = {};
  filt.filter(t => !isIncomeTx(t)).forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + (t.amount || 0);
  });
  const segments = Object.entries(catMap).map(([id, value]) => ({
    label: CAT_MAP[id]?.label || id, value, colour: CAT_MAP[id]?.colour || '#888'
  })).sort((a, b) => b.value - a.value);
  const total = segments.reduce((s, g) => s + g.value, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Period selector + log button */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['month','Month'],['week','Week'],['year','Year']].map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)} style={{
            padding: '5px 16px', borderRadius: 20, fontSize: 12,
            fontWeight: period === v ? 600 : 400, cursor: 'pointer',
            border: period === v ? '1px solid var(--accent)' : '0.5px solid var(--card-border)',
            background: period === v ? 'var(--active-bg)' : 'none',
            color: period === v ? 'var(--accent)' : 'var(--text-secondary)',
            WebkitTapHighlightColor: 'transparent',
          }}>{l}</button>
        ))}
        <button onClick={() => setShowAdd(true)} style={{
          marginLeft: 'auto', padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
          border: 'none', background: 'var(--accent)', color: 'var(--bg-base)', cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}>+ Log</button>
      </div>

      {showAdd && <LogTransactionSheet onAdd={onAdd} onClose={() => setShowAdd(false)} />}

      {/* Donut + breakdown */}
      <MCard style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Donut segments={segments} centerLabel={fmt(total)} centerSub="total" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {segments.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No spending</div>
              : segments.map(s => (
                <div key={s.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(s.value)}</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--hover-bg)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${(s.value / total * 100).toFixed(0)}%`,
                      background: s.colour, borderRadius: 2 }} />
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </MCard>

      {/* Day-by-day */}
      {days.length > 0 && (
        <MCard style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--card-border)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Day by Day</span>
          </div>
          {days.map(([date, amount], i) => (
            <div key={date} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '11px 16px',
              borderBottom: i < days.length - 1 ? '0.5px solid var(--card-border)' : 'none',
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{fmtDate(date)}</span>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{fmt(amount)}</span>
            </div>
          ))}
        </MCard>
      )}
    </div>
  );
}

// ── Subscriptions ──────────────────────────────────────────────────────────────
function AddSubscriptionSheet({ onAdd, onClose }) {
  const [name, setName]   = useState('');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState('monthly');
  const [category, setCategory] = useState('streaming');
  const [nextBill, setNextBill] = useState(todayISO());

  function save() {
    const n = parseFloat(amount);
    if (!name.trim() || !n || n <= 0) return;
    onAdd({ name: name.trim(), amount: n, cycle, nextBilling: nextBill, category, status: 'active' });
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxHeight: '80vh', overflowY: 'auto',
        background: 'var(--bg-panel)', borderRadius: '20px 20px 0 0', padding: 18,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Add subscription</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. Netflix)" style={{
          padding: '10px 12px', borderRadius: 10, border: '0.5px solid var(--card-border)',
          background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 14, outline: 'none',
        }} />
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" style={{
          padding: '10px 12px', borderRadius: 10, border: '0.5px solid var(--card-border)',
          background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 14, outline: 'none',
        }} />

        <div style={{ display: 'flex', gap: 8 }}>
          {['weekly', 'monthly', 'yearly'].map(c => (
            <button key={c} onClick={() => setCycle(c)} style={{
              flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: cycle === c ? '1px solid var(--accent)' : '0.5px solid var(--card-border)',
              background: cycle === c ? 'var(--active-bg)' : 'none',
              color: cycle === c ? 'var(--accent)' : 'var(--text-secondary)',
            }}>{c.charAt(0).toUpperCase() + c.slice(1)}</button>
          ))}
        </div>

        <input type="date" value={nextBill} onChange={e => setNextBill(e.target.value)} style={{
          padding: '10px 12px', borderRadius: 10, border: '0.5px solid var(--card-border)',
          background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 14, outline: 'none',
        }} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SUB_CATS.map(c => (
            <button key={c.id} onClick={() => setCategory(c.id)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
              border: category === c.id ? '1px solid var(--accent)' : '0.5px solid var(--card-border)',
              background: category === c.id ? 'var(--active-bg)' : 'none',
              color: category === c.id ? 'var(--accent)' : 'var(--text-secondary)',
            }}>{c.icon} {c.label}</button>
          ))}
        </div>

        <button onClick={save} disabled={!name.trim() || !amount} style={{
          padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--accent)',
          color: 'var(--bg-base)', fontWeight: 600, cursor: 'pointer', opacity: (name.trim() && amount) ? 1 : 0.4,
        }}>Add</button>
      </div>
    </div>
  );
}

//  Subscriptions
function SubscriptionsTab({ subscriptions, settings, onAdd }) {
  const currency = settings?.currency || DEFAULT_CURRENCY;
  const sym = currencySym(currency);
  const fmt = n => `${sym}${Math.abs(n || 0).toFixed(2)}`;
  const [showAdd, setShowAdd] = useState(false);

  const monthly = subscriptions.reduce((s, sub) => s + toMonthly(sub.amount, sub.cycle), 0);
  const yearly  = monthly * 12;

  const sorted = [...subscriptions].sort((a, b) =>
    toMonthly(b.amount, b.cycle) - toMonthly(a.amount, a.cycle));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <button onClick={() => setShowAdd(true)} style={{
        padding: '11px 0', borderRadius: 12, border: 'none', background: 'var(--accent)',
        color: 'var(--bg-base)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}>+ Add subscription</button>
      {showAdd && <AddSubscriptionSheet onAdd={onAdd} onClose={() => setShowAdd(false)} />}

      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <MCard style={{ padding: '14px 16px' }}>
          <MLabel>Monthly</MLabel>
          <div style={{ fontSize: 22, fontWeight: 200, color: 'var(--accent)' }}>{fmt(monthly)}</div>
        </MCard>
        <MCard style={{ padding: '14px 16px' }}>
          <MLabel>Yearly</MLabel>
          <div style={{ fontSize: 22, fontWeight: 200, color: 'var(--text-primary)' }}>{fmt(yearly)}</div>
        </MCard>
      </div>

      {/* List */}
      <MCard style={{ padding: 0 }}>
        {sorted.length === 0 ? (
          <div style={{ padding: '20px 18px', fontSize: 13, color: 'var(--text-muted)' }}>
            No subscriptions tracked yet — add them on desktop
          </div>
        ) : sorted.map((sub, i) => {
          const days = sub.nextBilling ? daysUntil(sub.nextBilling) : null;
          const mo   = toMonthly(sub.amount, sub.cycle);
          return (
            <div key={sub.id || i} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
              borderBottom: i < sorted.length - 1 ? '0.5px solid var(--card-border)' : 'none',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: 'var(--hover-bg)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 17 }}>{SUB_CATS.find(c => c.id === sub.category)?.icon || '📦'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {days !== null ? (days <= 7 ? <span style={{ color: '#f59e0b' }}>Due in {days}d</span> : `Due in ${days}d`) : sub.cycle}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{fmt(sub.amount)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(mo)}/mo</div>
              </div>
            </div>
          );
        })}
      </MCard>
    </div>
  );
}

// ── Purchases ──────────────────────────────────────────────────────────────────
function PurchasesTab({ purchases, settings }) {
  const currency = settings?.currency || DEFAULT_CURRENCY;
  const sym = currencySym(currency);
  const fmt = n => `${sym}${Math.abs(n || 0).toFixed(2)}`;

  const pending = purchases.filter(p => p.status !== 'bought');
  const bought  = purchases.filter(p => p.status === 'bought');
  const totalPending = pending.reduce((s, p) => s + (p.price || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <MCard style={{ padding: '14px 16px' }}>
          <MLabel>Want List</MLabel>
          <div style={{ fontSize: 22, fontWeight: 200, color: 'var(--text-primary)' }}>{pending.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>items · {fmt(totalPending)}</div>
        </MCard>
        <MCard style={{ padding: '14px 16px' }}>
          <MLabel>Purchased</MLabel>
          <div style={{ fontSize: 22, fontWeight: 200, color: '#4caf7d' }}>{bought.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>items bought</div>
        </MCard>
      </div>

      {pending.length > 0 && (
        <MCard style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--card-border)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Want List</span>
          </div>
          {pending.map((p, i) => {
            const cat = PCAT_MAP[p.category] || PCAT_MAP.other;
            const days = p.targetDate ? daysUntil(p.targetDate) : null;
            return (
              <div key={p.id || i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderBottom: i < pending.length - 1 ? '0.5px solid var(--card-border)' : 'none',
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: `${cat.colour}20`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 15 }}>{cat.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {cat.label}{days !== null ? ` · ${days <= 0 ? 'Due now' : `${days}d away`}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', flexShrink: 0 }}>
                  {p.price ? fmt(p.price) : '—'}
                </div>
              </div>
            );
          })}
        </MCard>
      )}

      {bought.length > 0 && (
        <MCard style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--card-border)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Purchased</span>
          </div>
          {bought.slice(0, 6).map((p, i) => {
            const cat = PCAT_MAP[p.category] || PCAT_MAP.other;
            return (
              <div key={p.id || i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', opacity: 0.55,
                borderBottom: i < Math.min(bought.length, 6) - 1 ? '0.5px solid var(--card-border)' : 'none',
              }}>
                <div style={{ fontSize: 15 }}>{cat.icon}</div>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)',
                  textDecoration: 'line-through' }}>{p.name}</span>
<span style={{ fontSize: 12, color: "#4caf7d" }}>✓</span>
              </div>
            );
          })}
        </MCard>
      )}

      {purchases.length === 0 && (
        <MCard style={{ padding: '20px 18px' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No purchases tracked yet — add from desktop
          </div>
        </MCard>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MobileFinance({ settings }) {
  const [sub, setSub] = useState('Overview');

  const { items: transactions   = [], add: addTransaction  } = useCollection('transactions',       STORAGE_KEYS.TRANSACTIONS);
  const { items: subscriptions  = [], add: addSubscription } = useCollection('subscriptions',      STORAGE_KEYS.SUBSCRIPTIONS);
  const { items: purchases      = [] } = useCollection('planned_purchases',  STORAGE_KEYS.PLANNED_PURCHASES);

  return (
    <div style={{ padding: '16px', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>

      <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', marginBottom: 14 }}>Finance</div>

      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 14,
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {SUB_TABS.map(t => (
          <button key={t} onClick={() => setSub(t)} style={{
            flexShrink: 0, padding: '6px 16px', borderRadius: 20,
            fontSize: 13, fontWeight: sub === t ? 600 : 400, cursor: 'pointer',
            border: sub === t ? '1px solid var(--accent)' : '0.5px solid var(--card-border)',
            background: sub === t ? 'var(--active-bg)' : 'none',
            color: sub === t ? 'var(--accent)' : 'var(--text-secondary)',
            WebkitTapHighlightColor: 'transparent',
          }}>{t}</button>
        ))}
      </div>

      {sub === 'Overview'       && <OverviewTab       transactions={transactions} subscriptions={subscriptions} purchases={purchases} settings={settings} />}
      {sub === 'Spending'       && <SpendingTab        transactions={transactions} settings={settings} onAdd={addTransaction} />}
      {sub === 'Subscriptions'  && <SubscriptionsTab   subscriptions={subscriptions} settings={settings} onAdd={addSubscription} />}
      {sub === 'Purchases'      && <PurchasesTab       purchases={purchases} settings={settings} />}
    </div>
  );
}


