// ─── MobileFinance.jsx — Finance tab for VALERIE iOS PWA ─────────────────────
import { useState, useMemo } from 'react';
import { useCollection } from '../../firebase/useCollection.js';
import { STORAGE_KEYS }  from '../../utils/storage.js';

const CATEGORIES = [
  { id: 'food',          label: 'Food & Drink',   colour: '#f4a642', icon: '🍔' },
  { id: 'transport',     label: 'Transport',       colour: '#5b9cf6', icon: '🚗' },
  { id: 'shopping',      label: 'Shopping',        colour: '#e55a5a', icon: '🛍️' },
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
  fashion: { label: 'Fashion', colour: '#e25d7a', icon: '👚' },
  tech:    { label: 'Tech',    colour: '#9b5de5', icon: '💻' },
  home:    { label: 'Home',    colour: '#f4a642', icon: '🏠' },
  fitness: { label: 'Fitness', colour: '#4caf7d', icon: '💪' },
  other:   { label: 'Other',   colour: '#6b7280', icon: '📦' },
};

const SUB_TABS = ['Overview', 'Spending', 'Subscriptions', 'Purchases'];

function todayISO() { return new Date().toISOString().split('T')[0]; }

function fmtDate(str) {
  if (!str) return '—';
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];
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
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
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
          {centerSub && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{centerSub}</div>}
        </div>
      )}
    </div>
  );
}

// ── Overview ───────────────────────────────────────────────────────────────────
function OverviewTab({ transactions, subscriptions, purchases, settings }) {
  const currency = settings?.currency || 'AUD';
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : 'A$';
  const fmt = n => `${sym}${Math.abs(n || 0).toFixed(2)}`;

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTx   = transactions.filter(t => (t.date || '').startsWith(thisMonth));
  const income    = monthTx.filter(t => t.category === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const expenses  = monthTx.filter(t => t.category !== 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const balance   = income - expenses;

  const subTotal  = subscriptions.reduce((s, sub) => s + toMonthly(sub.amount, sub.billingCycle), 0);
  const pendingP  = purchases.filter(p => p.status !== 'bought').length;

  // Spending by category (this month)
  const catMap = {};
  monthTx.filter(t => t.category !== 'income').forEach(t => {
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
            <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em',
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

      {/* Recent transactions */}
      <MCard style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--card-border)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Recent</span>
        </div>
        {[...transactions].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5).map((t, i, arr) => {
          const cat = CAT_MAP[t.category] || CAT_MAP.other;
          const isIncome = t.category === 'income';
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

// ── Spending ───────────────────────────────────────────────────────────────────
function SpendingTab({ transactions, settings }) {
  const currency = settings?.currency || 'AUD';
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : 'A$';
  const fmt = n => `${sym}${Math.abs(n || 0).toFixed(2)}`;
  const [period, setPeriod] = useState('month');

  const now   = new Date();
  const filt  = transactions.filter(t => {
    if (!t.date) return false;
    if (period === 'month') return t.date.startsWith(now.toISOString().slice(0, 7));
    if (period === 'week') {
      const d = new Date(t.date);
      const diff = Math.floor((now - d) / 86400000);
      return diff >= 0 && diff < 7;
    }
    return t.date.startsWith(String(now.getFullYear()));
  });

  const byDay = {};
  filt.filter(t => t.category !== 'income').forEach(t => {
    byDay[t.date] = (byDay[t.date] || 0) + (t.amount || 0);
  });
  const days = Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);

  const catMap = {};
  filt.filter(t => t.category !== 'income').forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + (t.amount || 0);
  });
  const segments = Object.entries(catMap).map(([id, value]) => ({
    label: CAT_MAP[id]?.label || id, value, colour: CAT_MAP[id]?.colour || '#888'
  })).sort((a, b) => b.value - a.value);
  const total = segments.reduce((s, g) => s + g.value, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Period selector */}
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
      </div>

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
function SubscriptionsTab({ subscriptions, settings }) {
  const currency = settings?.currency || 'AUD';
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : 'A$';
  const fmt = n => `${sym}${Math.abs(n || 0).toFixed(2)}`;

  const monthly = subscriptions.reduce((s, sub) => s + toMonthly(sub.amount, sub.billingCycle), 0);
  const yearly  = monthly * 12;

  const sorted = [...subscriptions].sort((a, b) =>
    toMonthly(b.amount, b.billingCycle) - toMonthly(a.amount, a.billingCycle));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

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
          const days = sub.nextBillingDate ? daysUntil(sub.nextBillingDate) : null;
          const mo   = toMonthly(sub.amount, sub.billingCycle);
          return (
            <div key={sub.id || i} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
              borderBottom: i < sorted.length - 1 ? '0.5px solid var(--card-border)' : 'none',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: 'var(--hover-bg)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 17 }}>{sub.icon || '📦'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {days !== null ? (days <= 7 ? <span style={{ color: '#f59e0b' }}>Due in {days}d</span> : `Due in ${days}d`) : sub.billingCycle}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{fmt(sub.amount)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmt(mo)}/mo</div>
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
  const currency = settings?.currency || 'AUD';
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : 'A$';
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
                <span style={{ fontSize: 12, color: '#4caf7d' }}>✓</span>
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

  const { items: transactions   = [] } = useCollection('transactions',       STORAGE_KEYS.TRANSACTIONS);
  const { items: subscriptions  = [] } = useCollection('subscriptions',      STORAGE_KEYS.SUBSCRIPTIONS);
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
      {sub === 'Spending'       && <SpendingTab        transactions={transactions} settings={settings} />}
      {sub === 'Subscriptions'  && <SubscriptionsTab   subscriptions={subscriptions} settings={settings} />}
      {sub === 'Purchases'      && <PurchasesTab       purchases={purchases} settings={settings} />}
    </div>
  );
}
