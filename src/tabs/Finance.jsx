// ─── VALERIE — Finance Tab ────────────────────────────────────────────────────
import { Icon as LineIcon } from '../components/icons.jsx';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useCollection }     from '../supabase/useCollection.js';
import { STORAGE_KEYS, storage } from '../utils/storage.js';
import { AnimatedNumber, Stagger } from '../components/Motion.jsx';
import { fetchWatchlist }    from '../utils/finnhub.js';
import { isGmailConnected, fetchEmailsSince, applyRulesToEmails, DEFAULT_EMAIL_RULES } from '../utils/gmail.js';
import { currencySymbol, DEFAULT_CURRENCY } from '../utils/currency.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { projectedSpend } from '../domain/ahead.js';
import { suppliesWithUsage } from '../utils/supplies.js';

// ─── Categories ──────────────────────────────────────────────────────────────
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

const PURCHASE_CATS = [
  { id: 'restock',  label: 'Restock',  colour: '#4a9eff', icon: '🔄' },
  { id: 'fashion',  label: 'Fashion',  colour: '#e25d7a', icon: '👗' },
  { id: 'tech',     label: 'Tech',     colour: '#9b5de5', icon: '💻' },
  { id: 'home',     label: 'Home',     colour: '#f4a642', icon: '🏠' },
  { id: 'fitness',  label: 'Fitness',  colour: '#4caf7d', icon: '🏋️' },
  { id: 'other',    label: 'Other',    colour: '#6b7280', icon: '📦' },
];
const PCAT_MAP = Object.fromEntries(PURCHASE_CATS.map(c => [c.id, c]));

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

const TABS = [
  { id: 'overview',      label: 'OVERVIEW'      },
  { id: 'spending',      label: 'SPENDING'       },
  { id: 'budgets',       label: 'BUDGETS'        },
  { id: 'recurring',     label: 'RECURRING'      },
  { id: 'savings',       label: 'SAVINGS'        },
  { id: 'subscriptions', label: 'SUBSCRIPTIONS'  },
  { id: 'purchases',     label: 'PURCHASES'      },
];

// ─── Utilities ────────────────────────────────────────────────────────────────
const todayISO = () => toLocalDateKey(new Date());

function getCurrencySymbol(code) {
  return currencySymbol(code);
}
function makeFmt(code) {
  const sym = currencySymbol(code);
  return (n) => `${sym}${Math.abs(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  const today = new Date();
  if (str === todayISO()) return 'Today';
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (str === toLocalDateKey(yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d - new Date()) / 86400000);
}
function toMonthly(amount, cycle) {
  if (cycle === 'weekly') return (amount || 0) * 4.33;
  if (cycle === 'yearly') return (amount || 0) / 12;
  return amount || 0;
}
// Advance a YYYY-MM-DD date by one cycle (used by recurring transactions).
// Uses UTC math so it matches todayISO() and never drifts across timezones.
function advanceDate(iso, cycle) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (cycle === 'weekly')      dt.setUTCDate(dt.getUTCDate() + 7);
  else if (cycle === 'yearly') dt.setUTCFullYear(dt.getUTCFullYear() + 1);
  else                         dt.setUTCMonth(dt.getUTCMonth() + 1); // monthly default
  return dt.toISOString().split('T')[0];
}


// ─── Shared glass card style ──────────────────────────────────────────────────
const GLASS = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 16,
  padding: '18px 20px',
  marginBottom: 10,
  backdropFilter: 'blur(24px)',
  boxShadow: '0 1px 0 0 rgba(255,255,255,0.07) inset, 0 12px 40px rgba(0,0,0,0.4)',
  position: 'relative',
  overflow: 'hidden',
};

// Subtle inner top-edge glow (matches reference card treatment)
function GlassCard({ children, style }) {
  return (
    <div style={{ ...GLASS, ...style }}>
      <div style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)', pointerEvents: 'none' }} />
      {children}
    </div>
  );
}

// Section label — monospace uppercase with left rule
function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 18, height: 1, background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap' }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(255,255,255,0.1),transparent)' }} />
    </div>
  );
}

// ─── Smooth area chart SVG ────────────────────────────────────────────────────
function AreaChart({ data, width = 320, height = 88, colour }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const max  = Math.max(...data);
  const min  = Math.min(...data);
  const span = max - min || 1;
  const pad  = 4;
  const pts  = data.map((v, i) => ({
    x: (i / (data.length - 1)) * (width - pad * 2) + pad,
    y: height - pad - ((v - min) / span) * (height - pad * 2),
  }));

  // Catmull-Rom   cubic bezier smooth path
  function smooth(ps) {
    if (ps.length < 2) return '';
    let d = `M ${ps[0].x} ${ps[0].y}`;
    for (let i = 0; i < ps.length - 1; i++) {
      const p0 = ps[Math.max(i - 1, 0)];
      const p1 = ps[i];
      const p2 = ps[i + 1];
      const p3 = ps[Math.min(i + 2, ps.length - 1)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  const linePath = smooth(pts);
  const areaPath = `${linePath} L ${pts[pts.length-1].x} ${height} L ${pts[0].x} ${height} Z`;
  const gradId   = `ag-${colour?.replace(/[^a-z]/gi,'') || 'acc'}`;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={colour} stopOpacity="0.28" />
          <stop offset="100%" stopColor={colour} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={colour} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Donut ────────────────────────────────────────────────────────────────────
function MiniDonut({ segments, size = 80, thickness = 14 }) {
  const total = segments.reduce((s, c) => s + c.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  let angle = -Math.PI / 2;
  const paths = segments.map(seg => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return { d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, colour: seg.colour, pct: Math.round((seg.value / total) * 100) };
  });
  return (
    <svg width={size} height={size}>
      {paths.length === 0
        ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--card-border)" strokeWidth={thickness} />
        : paths.map((p, i) => (
          <path key={i} d={p.d} fill="none" stroke={p.colour} strokeWidth={thickness} strokeLinecap="butt" />
        ))}
    </svg>
  );
}

// ─── Shared input / button styles (glass) ─────────────────────────────────────
const INPUT = {
  padding: '9px 12px', borderRadius: 9, border: 'none',
  background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.85)',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
};
const BTN_ACCENT = {
  padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
  background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
};
const BTN_GHOST = {
  padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
  background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontSize: 13,
};

// ─── Stock ticker strip ───────────────────────────────────────────────────────
function StockTicker({ watchlist, finnhubKey }) {
  const [quotes, setQuotes]   = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const intervalRef           = useRef(null);

  async function refresh() {
    if (!finnhubKey || !watchlist?.length) return;
    setLoading(true); setError(null);
    try {
      const data = await fetchWatchlist(watchlist, finnhubKey);
      setQuotes(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 60_000); // refresh every minute
    return () => clearInterval(intervalRef.current);
  }, [watchlist?.join(','), finnhubKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!finnhubKey) return (
    <div style={{ padding: '10px 24px', fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', letterSpacing: '0.06em', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
      Add a Finnhub API key in Settings → Integrations to enable live stock prices.
    </div>
  );

  if (!watchlist?.length) return (
    <div style={{ padding: '10px 24px', fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', letterSpacing: '0.06em', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
      No stocks in watchlist  add tickers in Settings → Integrations.
    </div>
  );

  return (
    <div style={{
      padding: '10px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.06)',
      display: 'flex', gap: 24, alignItems: 'center', overflowX: 'auto',
      flexShrink: 0, background: 'rgba(255,255,255,0.015)',
    }}>
      {loading && !Object.keys(quotes).length && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Loading quotes…</span>
      )}
      {error && (
        <span style={{ fontSize: 11, color: '#e55a5a' }}>Error: {error}</span>
      )}
      {watchlist.map(sym => {
        const q = quotes[sym];
        if (!q) return (
          <div key={sym} style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>{sym}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
          </div>
        );
        const up = q.d >= 0;
        return (
          <div key={sym} style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>{sym}</span>
            <span style={{ fontSize: 13, fontWeight: 300, color: 'var(--text-primary)' }}>
              {q.c?.toFixed(2)}
            </span>
            <span style={{ fontSize: 11, color: up ? '#4caf7d' : '#e55a5a' }}>
              {up ? '+' : ''}{q.dp?.toFixed(2)}%
            </span>
          </div>
        );
      })}
      {!loading && Object.keys(quotes).length > 0 && (
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>Live · updates every 60s</span>
      )}
    </div>
  );
}

// ─── Overview panel ───────────────────────────────────────────────────────────
function Overview({ transactions, goals, subscriptions, purchases = [], fmt, currencySymbol }) {
  const now        = new Date();
  const monthStart = toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const yearStart  = toLocalDateKey(new Date(now.getFullYear(), 0, 1));
  const thisMonth  = transactions.filter(t => t.date >= monthStart);

  const income   = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const expenses = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const net      = income - expenses;

  // All-time net (cumulative)
  const allIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const allExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const allNet     = allIncome - allExpense;
  const pendingSpend = purchases.filter(p => !p.completed).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const monthlySubCost = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + toMonthly(s.amount, s.cycle), 0);

  // 30-day cumulative net for area chart
  const chartData = useMemo(() => {
    let running = 0;
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (29 - i));
      const key = toLocalDateKey(d);
      const dayNet = transactions
        .filter(t => t.date === key)
        .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
      running += dayNet;
      return running;
    });
  }, [transactions]);

  // Category breakdown for donut
  const catTotals = {};
  thisMonth.filter(t => t.type === 'expense').forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + (t.amount || 0);
  });
  const donutSegs = CATEGORIES.filter(c => catTotals[c.id] > 0)
    .map(c => ({ ...c, value: catTotals[c.id] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const recent = [...transactions]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 10);

  const renewalsSoon = subscriptions
    .filter(s => s.status === 'active')
    .map(s => ({ ...s, daysLeft: daysUntil(s.nextBilling) }))
    .filter(s => s.daysLeft != null && s.daysLeft <= 7 && s.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const netColour = net >= 0 ? '#6BE3A4' : '#FF6B6B';

  // Ahead: what restocking supplies will cost over the next 30 days
  const { items: supplies = [] } = useCollection('essentials', STORAGE_KEYS.ESSENTIALS);
  // Not memoised on `supplies` alone: it also reads the food log (via the mirror), and the sum is cheap.
  const restocks = projectedSpend(suppliesWithUsage(supplies, toLocalDateKey(new Date())), toLocalDateKey(new Date()), { days: 30 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '20px 24px 32px' }}>

      {/* ── Hero card ─────────────────────────────────────────────────────────── */}
      <GlassCard style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', marginBottom: 8 }}>
          THIS MONTH · NET BALANCE
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 6 }}>
          <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1, color: netColour, fontVariantNumeric: 'tabular-nums' }}>
            {net >= 0 ? '+' : ''}<AnimatedNumber value={Math.abs(net)} format={fmt} />
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: `${netColour}18`, color: netColour, fontFamily: 'ui-monospace,monospace', fontWeight: 700, letterSpacing: '0.04em' }}>
              {income > 0 ? `${Math.round((net / income) * 100)}% saved` : '—'}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>
          {now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} &nbsp;·&nbsp; All-time net: {allNet >= 0 ? '+' : '−'}{fmt(Math.abs(allNet))}
        </div>

        {/* Chart + allocation row */}
        <div style={{ display: 'flex', gap: 24, marginTop: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <AreaChart data={chartData} width={320} height={88} colour={netColour} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>30 days ago</span>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>Today</span>
            </div>
          </div>

          {donutSegs.length > 0 && (
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
              <MiniDonut segments={donutSegs} size={80} thickness={13} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {donutSegs.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: c.colour, flexShrink: 0 }} />
                    <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', flex: 1 }}>{c.label}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 6, fontFamily: 'ui-monospace,monospace' }}>
                      {Math.round((c.value / (expenses || 1)) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ── Stats strip ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
        {[
          { label: 'INCOME',        value: fmt(income),         colour: '#6BE3A4' },
          { label: 'EXPENSES',      value: fmt(expenses),       colour: '#FF6B6B' },
          { label: 'SUBSCRIPTIONS', value: fmt(monthlySubCost), colour: 'rgba(255,255,255,0.55)' },
        ].map(s => (
          <GlassCard key={s.label} style={{ padding: '14px 16px', marginBottom: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', marginBottom: 7 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: s.colour, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
          </GlassCard>
        ))}
      </div>

      {/*  Ahead: supply restocks over the next 30 days  */}
      {restocks.lines.length > 0 && (
        <GlassCard style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <SectionLabel>Supplies · next 30 days</SectionLabel>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums' }}>{fmt(restocks.total)}</span>
          </div>
          {restocks.lines.map(l => (
            <div key={l.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>{l.name}{l.dates.length > 1 ? ` ×${l.dates.length}` : ''}</span>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap' }}>
                {l.dates[0] <= toLocalDateKey(new Date()) ? 'now' : fmtDate(l.dates[0])} · {fmt(l.subtotal)}
              </span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Predicted from your usage and prices in Supplies.</div>
        </GlassCard>
      )}

      {/* ── Renewal alerts ───────────────────────────────────────────────────── */}
      {renewalsSoon.length > 0 && (
        <GlassCard style={{ marginBottom: 10, background: 'rgba(242,192,99,0.06)' }}>
          <SectionLabel>Upcoming renewals</SectionLabel>
          {renewalsSoon.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{s.name}</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(242,192,99,0.15)', color: '#F2C063', fontFamily: 'ui-monospace,monospace', fontWeight: 700 }}>in {s.daysLeft}d</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'ui-monospace,monospace' }}>{fmt(s.amount)}</span>
              </div>
            </div>
          ))}
        </GlassCard>
      )}

      {/* ── Savings goals ────────────────────────────────────────────────────── */}
      {goals.length > 0 && (
        <GlassCard style={{ marginBottom: 10 }}>
          <SectionLabel>Savings goals</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {goals.slice(0, 3).map(g => {
              const pct = g.target > 0 ? Math.min(((g.current || 0) / g.target) * 100, 100) : 0;
              return (
                <div key={g.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{g.name}</span>
                    <span style={{ fontSize: 11.5, color: pct >= 100 ? '#6BE3A4' : 'rgba(255,255,255,0.4)', fontFamily: 'ui-monospace,monospace' }}>
                      {fmt(g.current || 0)} / {fmt(g.target)}
                    </span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#6BE3A4' : 'var(--accent)', borderRadius: 2, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* ── Recent activity ──────────────────────────────────────────────────── */}
      <GlassCard>
        <SectionLabel>Recent activity</SectionLabel>
        {recent.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            No transactions yet — add some in Spending
          </div>
        ) : (
          <Stagger step={32} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {recent.map((t, i) => {
              const cat = CAT_MAP[t.category] || { colour: '#6b7280', icon: '📦', label: t.category || 'Other' };
              const isIncome = t.type === 'income';
              return (
                <div key={t.id ?? i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: i < recent.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: cat.colour + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                    {cat.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.description || cat.label}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1, fontFamily: 'ui-monospace,monospace' }}>{cat.label}</div>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'ui-monospace,monospace', marginRight: 6 }}>{fmtDate(t.date)}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, flexShrink: 0, color: isIncome ? '#6BE3A4' : 'rgba(255,255,255,0.75)', fontVariantNumeric: 'tabular-nums', minWidth: 72, textAlign: 'right' }}>
                    {isIncome ? '+' : '−'}{fmt(t.amount)}
                  </div>
                </div>
              );
            })}
          </Stagger>
        )}
      </GlassCard>
    </div>
  );
}

//  Spending panel
function Spending({ transactions, onAdd, fmt }) {
  const [type,     setType]   = useState('expense');
  const [amount,   setAmount] = useState('');
  const [category, setCat]    = useState('food');
  const [desc,     setDesc]   = useState('');
  const [date,     setDate]   = useState(todayISO());
  const [period,   setPeriod] = useState('month');
  const [showForm, setShowForm] = useState(false);

  const now = new Date();
  let periodStart;
  if (period === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    periodStart = toLocalDateKey(d);
  } else if (period === 'month') {
    periodStart = toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  } else {
    periodStart = toLocalDateKey(new Date(now.getFullYear(), 0, 1));
  }

  const filtered    = transactions.filter(t => (t.date || '') >= periodStart);
  const expenses    = filtered.filter(t => t.type === 'expense');
  const totalSpend  = expenses.reduce((s, t) => s + (t.amount || 0), 0);
  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);

  const catTotals = {};
  expenses.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + (t.amount || 0); });
  const catBreakdown = CATEGORIES.filter(c => catTotals[c.id] > 0)
    .map(c => ({ ...c, value: catTotals[c.id] }))
    .sort((a, b) => b.value - a.value);

  function handleAdd() {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    onAdd({ amount: n, type, category, description: desc.trim() || null, date });
    setAmount(''); setDesc(''); setShowForm(false);
  }

  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 20px', gap: 10 }}>

      {/* Hero row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <GlassCard style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', marginBottom: 7 }}>TOTAL SPENT</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#FF6B6B', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalSpend)}</div>
        </GlassCard>
        <GlassCard style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', marginBottom: 7 }}>INCOME</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#6BE3A4', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalIncome)}</div>
        </GlassCard>
      </div>

      {/* Period + add */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {[['week','7D'], ['month','1M'], ['year','1Y']].map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)} style={{
            padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
            fontFamily: 'ui-monospace,monospace', fontWeight: 700, letterSpacing: '0.06em',
            background: period === v ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
            color: period === v ? '#fff' : 'rgba(255,255,255,0.4)',
          }}>{l}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowForm(v => !v)} style={{ ...BTN_ACCENT, padding: '6px 16px', fontSize: 12 }}>
          + Add
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <GlassCard style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['expense','income'].map(t => (
              <button key={t} onClick={() => setType(t)} style={{
                padding: '5px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
                background: type === t ? (t === 'income' ? '#4caf7d' : '#e55a5a') : 'rgba(255,255,255,0.06)',
                color: type === t ? '#fff' : 'var(--text-secondary)',
              }}>
                {t === 'expense' ? '− Expense' : '+ Income'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} style={{ ...INPUT, flex: 2, fontSize: 18, fontWeight: 300 }} />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...INPUT, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)} style={{
                padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11,
                background: category === c.id ? c.colour + '33' : 'rgba(255,255,255,0.05)',
                color: category === c.id ? c.colour : 'var(--text-secondary)',
                outline: category === c.id ? `0.5px solid ${c.colour}55` : '0.5px solid transparent',
              }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} style={INPUT} />
            <button onClick={handleAdd} style={BTN_ACCENT}>Add</button>
            <button onClick={() => setShowForm(false)} style={BTN_GHOST}>Cancel</button>
          </div>
        </GlassCard>
      )}

      {/* Category breakdown */}
      {catBreakdown.length > 0 && (
        <GlassCard>
          <SectionLabel>Spending breakdown</SectionLabel>
          {catBreakdown.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 13, width: 20 }}>{c.icon}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{c.label}</span>
              <div style={{ width: 90, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((c.value / totalSpend) * 100, 100)}%`, background: c.colour, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 60, textAlign: 'right', fontFamily: 'ui-monospace,monospace' }}>{fmt(c.value)}</span>
            </div>
          ))}
        </GlassCard>
      )}

      {/* Transaction list */}
      <GlassCard>
        <SectionLabel>Transactions</SectionLabel>
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No transactions in this period</div>
        ) : sorted.map((t, i) => {
          const cat = CAT_MAP[t.category] || { colour: '#6b7280', icon: '📦', label: t.category || 'Other' };
          return (
            <div key={t.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < sorted.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: cat.colour + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{cat.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || cat.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>{cat.label}</div>
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', marginRight: 6 }}>{fmtDate(t.date)}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: t.type === 'income' ? '#6BE3A4' : 'rgba(255,255,255,0.75)', minWidth: 68, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
              </span>
            </div>
          );
        })}
      </GlassCard>
    </div>
  );
}

// ─── Savings panel ────────────────────────────────────────────────────────────
function Savings({ goals, onAdd, onUpdate, onRemove, fmt }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName]         = useState('');
  const [target, setTarget]     = useState('');
  const [current, setCurrent]   = useState('');
  const [deadline, setDeadline] = useState('');
  const [addingTo, setAddingTo] = useState(null);
  const [addAmt, setAddAmt]     = useState('');

  function handleCreate() {
    const t = parseFloat(target);
    if (!name.trim() || !t || t <= 0) return;
    onAdd({ name: name.trim(), target: t, current: parseFloat(current) || 0, deadline: deadline || null, milestones: [{ pct: 25, label: '25%' }, { pct: 50, label: '50%' }, { pct: 75, label: '75%' }, { pct: 100, label: '🏆' }] });
    setName(''); setTarget(''); setCurrent(''); setDeadline(''); setShowForm(false);
  }
  function handleAddFunds(goal) {
    const n = parseFloat(addAmt);
    if (!n || n <= 0) return;
    onUpdate(goal.id, { current: Math.min((goal.current || 0) + n, goal.target) });
    setAddingTo(null); setAddAmt('');
  }

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionLabel>Savings goals</SectionLabel>
        <button onClick={() => setShowForm(v => !v)} style={{ ...BTN_ACCENT, padding: '6px 14px', fontSize: 12 }}>+ New Goal</button>
      </div>
      {showForm && (
        <GlassCard style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <input placeholder="Goal name" value={name} onChange={e => setName(e.target.value)} style={INPUT} />
            <input type="number" placeholder="Target" value={target} onChange={e => setTarget(e.target.value)} style={{ ...INPUT, flex: '0 0 110px' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <input type="number" placeholder="Already saved" value={current} onChange={e => setCurrent(e.target.value)} style={INPUT} />
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ ...INPUT, flex: '0 0 150px' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={BTN_GHOST}>Cancel</button>
            <button onClick={handleCreate} style={BTN_ACCENT}>Create</button>
          </div>
        </GlassCard>
      )}
      {goals.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><LineIcon name="finance" size={30} strokeWidth={1.5} /></div>
          No savings goals yet.
        </div>
      )}
      {goals.map((goal, i) => {
        const pct  = goal.target > 0 ? Math.min(((goal.current || 0) / goal.target) * 100, 100) : 0;
        const done = pct >= 100;
        const dLeft = goal.deadline ? daysUntil(goal.deadline) : null;
        return (
          <GlassCard key={goal.id} style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)' }}>{goal.name}{done ? ' 🏆' : ''}</div>
                {dLeft !== null && <div style={{ fontSize: 10.5, color: dLeft < 0 ? '#FF6B6B' : dLeft <= 30 ? '#F2C063' : 'rgba(255,255,255,0.3)', marginTop: 3, fontFamily: 'ui-monospace,monospace' }}>
                  {dLeft < 0 ? 'Overdue' : dLeft === 0 ? 'Due today' : `${dLeft} days left`}
                </div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: done ? '#6BE3A4' : 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums' }}>{fmt(goal.current || 0)}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>of {fmt(goal.target)}</div>
              </div>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: done ? '#6BE3A4' : 'var(--accent)', borderRadius: 2, transition: 'width 0.4s ease' }} />
            </div>
            {!done && (
              addingTo === goal.id ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" placeholder="Amount" value={addAmt} onChange={e => setAddAmt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddFunds(goal)} style={INPUT} autoFocus />
                  <button onClick={() => handleAddFunds(goal)} style={BTN_ACCENT}>Save</button>
                  <button onClick={() => { setAddingTo(null); setAddAmt(''); }} style={BTN_GHOST}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setAddingTo(goal.id)} style={BTN_GHOST}>+ Add funds</button>
                  <button onClick={() => onRemove(goal.id)} style={{ ...BTN_GHOST, color: '#FF6B6B' }}>Remove</button>
                </div>
              )
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}

// ─── Subscriptions panel ──────────────────────────────────────────────────────
function Subscriptions({ subs, onAdd, onUpdate, onRemove, fmt }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName]         = useState('');
  const [amount, setAmount]     = useState('');
  const [cycle, setCycle]       = useState('monthly');
  const [nextBill, setNextBill] = useState(todayISO());
  const [subCat, setSubCat]     = useState('streaming');

  function handleAdd() {
    const n = parseFloat(amount);
    if (!name.trim() || !n || n <= 0) return;
    onAdd({ name: name.trim(), amount: n, cycle, nextBilling: nextBill, category: subCat, status: 'active' });
    setName(''); setAmount(''); setNextBill(todayISO()); setShowForm(false);
  }

  const active       = subs.filter(s => s.status !== 'cancelled');
  const monthlyTotal = active.reduce((sum, s) => sum + toMonthly(s.amount, s.cycle), 0);
  const sorted       = [...subs].sort((a, b) => (a.nextBilling || '').localeCompare(b.nextBilling || ''));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 20px', gap: 10 }}>

      {/* Hero + add */}
      <GlassCard style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', marginBottom: 7 }}>MONTHLY TOTAL</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums' }}>{fmt(monthlyTotal)}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'ui-monospace,monospace' }}>{fmt(monthlyTotal * 12)} / year</div>
          </div>
          <button onClick={() => setShowForm(v => !v)} style={{ ...BTN_ACCENT, padding: '6px 16px', fontSize: 12 }}>+ Add</button>
        </div>
      </GlassCard>

      {showForm && (
        <GlassCard style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <input placeholder="Name (e.g. Netflix)" value={name} onChange={e => setName(e.target.value)} style={INPUT} />
            <input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...INPUT, flex: '0 0 90px' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {['weekly','monthly','yearly'].map(c => (
              <button key={c} onClick={() => setCycle(c)} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'ui-monospace,monospace', fontWeight: 700, background: cycle === c ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: cycle === c ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ marginBottom: 10 }}>
            <input type="date" value={nextBill} onChange={e => setNextBill(e.target.value)} style={INPUT} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            {SUB_CATS.map(c => (
              <button key={c.id} onClick={() => setSubCat(c.id)} style={{ padding: '3px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, background: subCat === c.id ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'rgba(255,255,255,0.05)', color: subCat === c.id ? 'var(--accent)' : 'rgba(255,255,255,0.4)', outline: subCat === c.id ? '0.5px solid color-mix(in srgb, var(--accent) 27%, transparent)' : '0.5px solid transparent' }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={BTN_GHOST}>Cancel</button>
            <button onClick={handleAdd} style={BTN_ACCENT}>Add</button>
          </div>
        </GlassCard>
      )}

      {sorted.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><LineIcon name="card" size={30} strokeWidth={1.5} /></div>No subscriptions tracked yet.
        </div>
      )}

      <GlassCard style={{ marginBottom: 0, padding: 0, overflow: 'hidden' }}>
        {sorted.map((s, i) => {
          const cat     = SUB_CATS.find(c => c.id === s.category) || { icon: '📦' };
          const days    = daysUntil(s.nextBilling);
          const dueSoon = days != null && days <= 7 && days >= 0;
          const overdue = days != null && days < 0;
          const paused  = s.status === 'paused';
          const cancelled = s.status === 'cancelled';
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: i < sorted.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : 'none', opacity: cancelled ? 0.4 : 1 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: cancelled ? '#444' : paused ? '#F2C063' : '#6BE3A4', boxShadow: (!cancelled && !paused) ? '0 0 5px rgba(107,227,164,0.4)' : 'none' }} />
              <div style={{ fontSize: 17, flexShrink: 0 }}>{cat.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 10.5, color: overdue ? '#FF6B6B' : dueSoon ? '#F2C063' : 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace,monospace' }}>
                  {cancelled ? 'Cancelled' : paused ? 'Paused' : overdue ? 'Overdue' : dueSoon ? `Due in ${days}d` : `Renews ${fmtDate(s.nextBilling)}`} · {s.cycle}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,0.82)', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.amount)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>{fmt(toMonthly(s.amount, s.cycle))}/mo</div>
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {!cancelled && <button onClick={() => onUpdate(s.id, { status: paused ? 'active' : 'paused' })} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: 12 }}>{paused ? '▶' : '⏸'}</button>}
                <button onClick={() => onRemove(s.id)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#FF6B6B', fontSize: 16 }}>×</button>
              </div>
            </div>
          );
        })}
      </GlassCard>
    </div>
  );
}

// ─── Main Finance Tab ─────────────────────────────────────────────────────────

// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
// PLANNED PURCHASES
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
function PlannedPurchases({ purchases, onAdd, onRemove, onComplete, fmt }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', category: 'restock', notes: '' });
  const [completing, setCompleting] = useState(null);

  const pending  = purchases.filter(p => !p.completed);
  const total    = pending.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.amount) return;
    await onAdd({ name: form.name.trim(), amount: parseFloat(form.amount), category: form.category, notes: form.notes.trim(), completed: false });
    setForm({ name: '', amount: '', category: 'restock', notes: '' });
    setShowAdd(false);
  };

  const handleComplete = async (item) => {
    setCompleting(item.id);
    await onComplete(item);
    setCompleting(null);
  };

  const inputSx = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '8px 11px', fontSize: 13, color: 'rgba(255,255,255,0.9)',
    outline: 'none', boxSizing: 'border-box',
  };
  const lblSx = { display: 'block', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 4 };

  return (
    <div style={{ padding: '20px 24px 32px' }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Planned Purchases</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {pending.length} item{pending.length !== 1 ? 's' : ''} · pending spend {fmt(total)}
          </div>
        </div>
        <button onClick={() => setShowAdd(v => !v)} style={{
          padding: '7px 16px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.12)',
          background: showAdd ? 'rgba(255,255,255,0.08)' : 'transparent',
          color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12,
        }}>
          {showAdd ? 'S" Cancel' : '+ Add item'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <GlassCard style={{ marginBottom: 16 }}>
          <SectionLabel>New purchase</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
              <div>
                <span style={lblSx}>ITEM NAME</span>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. New trainers" style={inputSx}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()} />
              </div>
              <div>
                <span style={lblSx}>COST</span>
                <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00" style={{ ...inputSx, width: 110 }} min="0" step="0.01" />
              </div>
            </div>

            <div>
              <span style={lblSx}>CATEGORY</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PURCHASE_CATS.map(c => (
                  <button key={c.id} onClick={() => setForm(p => ({ ...p, category: c.id }))} style={{
                    padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 11.5,
                    border: `0.5px solid ${form.category === c.id ? c.colour : 'rgba(255,255,255,0.1)'}`,
                    background: form.category === c.id ? `${c.colour}20` : 'transparent',
                    color: form.category === c.id ? c.colour : 'rgba(255,255,255,0.45)',
                    transition: 'all 0.12s',
                  }}>{c.icon} {c.label}</button>
                ))}
              </div>
            </div>

            <div>
              <span style={lblSx}>NOTES (optional)</span>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Size, colour, link…" style={inputSx} />
            </div>

            <button onClick={handleAdd} style={{
              padding: '10px 0', borderRadius: 9, border: '0.5px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.9)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}>Add to list</button>
          </div>
        </GlassCard>
      )}

      {/* Purchase list */}
      {pending.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
          No planned purchases yet.<br />
          <span style={{ fontSize: 11, opacity: 0.7 }}>Add items to track upcoming spend.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pending.map(item => {
            const cat = PCAT_MAP[item.category] ?? PCAT_MAP.other;
            const isCompleting = completing === item.id;
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                borderRadius: 12, background: 'rgba(255,255,255,0.03)',
                border: '0.5px solid rgba(255,255,255,0.07)',
                transition: 'opacity 0.2s', opacity: isCompleting ? 0.5 : 1,
              }}>
                {/* Category dot */}
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.colour, flexShrink: 0 }} />

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: 2 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {cat.label}{item.notes ? ` · ${item.notes}` : ''}
                  </div>
                </div>

                {/* Amount */}
                <div style={{ fontSize: 15, fontWeight: 600, color: cat.colour, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {fmt(item.amount)}
                </div>

                {/* Complete button */}
                <button onClick={() => handleComplete(item)} disabled={isCompleting} style={{
                  padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                  border: '0.5px solid rgba(76,175,125,0.4)', background: 'rgba(76,175,125,0.1)',
                  color: '#4caf7d', transition: 'all 0.15s', flexShrink: 0,
                }}>
                  {isCompleting ? '…' : '✓ Purchased'}
                </button>

                {/* Remove */}
                <button onClick={() => onRemove(item.id)} style={{
                  padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 11,
                  border: '0.5px solid rgba(229,90,90,0.25)', background: 'transparent',
                  color: 'rgba(229,90,90,0.6)', transition: 'all 0.15s', flexShrink: 0,
                }}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Email Import Panel ───────────────────────────────────────────────────────

function EmailImportPanel({ onAddTransaction, fmt }) {
  const [scanning,  setScanning]  = useState(false);
  const [detected,  setDetected]  = useState([]);
  const [error,     setError]     = useState('');
  const [dismissed, setDismissed] = useState(new Set());
  const connected = isGmailConnected();

  async function scan() {
    setScanning(true); setError('');
    try {
      const rules    = (() => { try { return JSON.parse(localStorage.getItem('valerie_email_rules') || 'null') || DEFAULT_EMAIL_RULES; } catch { return DEFAULT_EMAIL_RULES; } })();
      const messages = await fetchEmailsSince(90, 50);
      const found    = applyRulesToEmails(messages, rules);
      setDetected(found);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }

  const pending = detected.filter(d => !dismissed.has(d.id) && !d.added);

  function confirmAdd(item) {
    if (!item.amount) return; // can't add without an amount
    onAddTransaction({
      amount: item.amount,
      type: item.type,
      category: item.category,
      description: item.description,
      date: item.date,
    });
    setDetected(prev => prev.map(d => d.id === item.id ? { ...d, added: true } : d));
  }

  function dismiss(id) { setDismissed(prev => new Set([...prev, id])); }

  if (!connected) return null;

  return (
    <GlassCard style={{ marginBottom: 10, background: 'rgba(74,158,255,0.04)', border: '0.5px solid rgba(74,158,255,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: pending.length > 0 ? 14 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4a9eff', boxShadow: '0 0 6px rgba(74,158,255,0.5)' }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Gmail Auto-Import</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
              {pending.length > 0 ? `${pending.length} transaction${pending.length !== 1 ? 's' : ''} detected — review below` : 'Scan emails for payslips & transactions'}
            </div>
          </div>
        </div>
        <button onClick={scan} disabled={scanning} style={{
          padding: '6px 14px', borderRadius: 8, border: '0.5px solid rgba(74,158,255,0.3)',
          background: 'rgba(74,158,255,0.1)', color: '#4a9eff', fontSize: 11, cursor: 'pointer',
          opacity: scanning ? 0.6 : 1,
        }}>
          {scanning ? 'Scanning...' : 'Scan now'}
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: '#e55a5a', marginBottom: 8 }}>{error}</div>}
      {pending.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pending.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 10, background: 'rgba(255,255,255,0.03)',
              border: '0.5px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: item.type === 'income' ? '#6BE3A4' : '#FF6B6B' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.ruleLabel}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.subject} &bull; {item.date}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: item.type === 'income' ? '#6BE3A4' : '#FF6B6B',
                fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {item.amount ? fmt(item.amount) : 'No amount found'}
              </div>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <button
                  onClick={() => confirmAdd(item)}
                  disabled={!item.amount}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: '0.5px solid rgba(107,227,164,0.3)',
                    background: 'rgba(107,227,164,0.1)', color: '#6BE3A4', fontSize: 11, cursor: item.amount ? 'pointer' : 'not-allowed',
                    opacity: item.amount ? 1 : 0.4,
                  }}>
                  Add
                </button>
                <button onClick={() => dismiss(item.id)} style={{
                  padding: '4px 8px', borderRadius: 6, border: 'none',
                  background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)',
                  fontSize: 13, cursor: 'pointer',
                }}>
                  &#215;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

//  Budgets panel  per-category monthly budgets + month-over-month trends
function Budgets({ transactions, fmt }) {
  const [budgets, setBudgets] = useState(() => storage.get(STORAGE_KEYS.BUDGETS, {}));
  const [editing, setEditing] = useState(false);

  function saveBudget(catId, value) {
    const n = parseFloat(value);
    const next = { ...budgets };
    if (!n || n <= 0) delete next[catId]; else next[catId] = n;
    setBudgets(next);
    storage.set(STORAGE_KEYS.BUDGETS, next);
  }

  const now = new Date();
  const monthStart     = toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastMonthStart = toLocalDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastMonthEnd   = toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 0));

  // Per-category spend, this month + last month
  const spend = useMemo(() => {
    const thisM = {}, lastM = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const d = t.date || '';
      if (d >= monthStart)                       thisM[t.category] = (thisM[t.category] || 0) + (t.amount || 0);
      else if (d >= lastMonthStart && d <= lastMonthEnd) lastM[t.category] = (lastM[t.category] || 0) + (t.amount || 0);
    });
    return { thisM, lastM };
  }, [transactions, monthStart, lastMonthStart, lastMonthEnd]);

  const totalThis = Object.values(spend.thisM).reduce((s, v) => s + v, 0);
  const totalLast = Object.values(spend.lastM).reduce((s, v) => s + v, 0);
  const totalBudget = Object.values(budgets).reduce((s, v) => s + v, 0);
  const momDelta = totalLast > 0 ? Math.round(((totalThis - totalLast) / totalLast) * 100) : null;

  // Expense categories only (income excluded from budgeting)
  const budgetCats = CATEGORIES.filter(c => c.id !== 'income');

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Hero: month-over-month */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <GlassCard style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', marginBottom: 7 }}>SPENT THIS MONTH</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#FF6B6B', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalThis)}</div>
        </GlassCard>
        <GlassCard style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', marginBottom: 7 }}>VS LAST MONTH</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: momDelta == null ? 'rgba(255,255,255,0.4)' : momDelta > 0 ? '#FF6B6B' : '#6BE3A4', fontVariantNumeric: 'tabular-nums' }}>
            {momDelta == null ? '—' : `${momDelta > 0 ? '↑' : '↓'} ${Math.abs(momDelta)}%`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'ui-monospace,monospace' }}>was {fmt(totalLast)}</div>
        </GlassCard>
        <GlassCard style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', marginBottom: 7 }}>TOTAL BUDGET</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: totalBudget > 0 && totalThis > totalBudget ? '#FF6B6B' : 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums' }}>{totalBudget > 0 ? fmt(totalBudget) : '—'}</div>
          {totalBudget > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'ui-monospace,monospace' }}>{fmt(Math.max(totalBudget - totalThis, 0))} left</div>}
        </GlassCard>
      </div>

      {/* Per-category budgets */}
      <GlassCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <SectionLabel>Category budgets</SectionLabel>
          <button onClick={() => setEditing(v => !v)} style={{ ...BTN_GHOST, padding: '4px 12px', fontSize: 11 }}>{editing ? 'Done' : 'Edit limits'}</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {budgetCats.map(c => {
            const used  = spend.thisM[c.id] || 0;
            const limit = budgets[c.id] || 0;
            const pct   = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
            const over  = limit > 0 && used > limit;
            const last  = spend.lastM[c.id] || 0;
            const dlt   = last > 0 ? Math.round(((used - last) / last) * 100) : null;
            return (
              <div key={c.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, width: 20 }}>{c.icon}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{c.label}</span>
                  {dlt != null && (
                    <span style={{ fontSize: 11, color: dlt > 0 ? '#FF6B6B' : '#6BE3A4', fontFamily: 'ui-monospace,monospace', marginRight: 8 }}>
                      {dlt > 0 ? '↑' : '↓'}{Math.abs(dlt)}% MoM
                    </span>
                  )}
                  {editing ? (
                    <input type="number" defaultValue={limit || ''} placeholder="—" onBlur={e => saveBudget(c.id, e.target.value)}
                      style={{ ...INPUT, width: 90, padding: '5px 9px', textAlign: 'right' }} />
                  ) : (
                    <span style={{ fontSize: 11.5, color: over ? '#FF6B6B' : 'rgba(255,255,255,0.5)', fontFamily: 'ui-monospace,monospace' }}>
                      {fmt(used)}{limit > 0 ? ` / ${fmt(limit)}` : ''}
                    </span>
                  )}
                </div>
                {limit > 0 && !editing && (
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: over ? '#FF6B6B' : pct > 80 ? '#F2C063' : c.colour, borderRadius: 2, transition: 'width 0.4s ease' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!editing && totalBudget === 0 && (
          <div style={{ textAlign: 'center', padding: '12px 0 2px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>
            Tap "Edit limits" to set a monthly budget per category.
          </div>
        )}
      </GlassCard>
    </div>
  );
}

//  Recurring panel  recurring income/expenses, auto-posted on their date
function Recurring({ recurring, onAdd, onUpdate, onRemove, fmt }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName]   = useState('');
  const [amount, setAmt]  = useState('');
  const [type, setType]   = useState('expense');
  const [category, setCat] = useState('bills');
  const [cycle, setCycle] = useState('monthly');
  const [startDate, setStart] = useState(todayISO());

  function handleAdd() {
    const n = parseFloat(amount);
    if (!name.trim() || !n || n <= 0) return;
    onAdd({ name: name.trim(), amount: n, type, category, cycle, nextDate: startDate, status: 'active', createdAt: new Date().toISOString() });
    setName(''); setAmt(''); setStart(todayISO()); setShowForm(false);
  }

  const sorted = [...recurring].sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || ''));
  const monthlyImpact = recurring.filter(r => r.status !== 'paused')
    .reduce((s, r) => s + toMonthly(r.amount, r.cycle) * (r.type === 'income' ? 1 : -1), 0);

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      <GlassCard style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', marginBottom: 7 }}>NET MONTHLY IMPACT</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: monthlyImpact >= 0 ? '#6BE3A4' : '#FF6B6B', fontVariantNumeric: 'tabular-nums' }}>
              {monthlyImpact >= 0 ? '+' : '−'}{fmt(Math.abs(monthlyImpact))}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'ui-monospace,monospace' }}>auto-posted on each due date</div>
          </div>
          <button onClick={() => setShowForm(v => !v)} style={{ ...BTN_ACCENT, padding: '6px 16px', fontSize: 12 }}>+ Add</button>
        </div>
      </GlassCard>

      {showForm && (
        <GlassCard style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {['expense','income'].map(t => (
              <button key={t} onClick={() => setType(t)} style={{
                padding: '5px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
                background: type === t ? (t === 'income' ? '#4caf7d' : '#e55a5a') : 'rgba(255,255,255,0.06)',
                color: type === t ? '#fff' : 'var(--text-secondary)',
              }}>{t === 'expense' ? 'Expense' : 'Income'}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <input placeholder="Name (e.g. Rent, Salary)" value={name} onChange={e => setName(e.target.value)} style={INPUT} />
            <input type="number" placeholder="Amount" value={amount} onChange={e => setAmt(e.target.value)} style={{ ...INPUT, flex: '0 0 100px' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {['weekly','monthly','yearly'].map(c => (
              <button key={c} onClick={() => setCycle(c)} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'ui-monospace,monospace', fontWeight: 700, background: cycle === c ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: cycle === c ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
            <input type="date" value={startDate} onChange={e => setStart(e.target.value)} style={{ ...INPUT, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)} style={{
                padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11,
                background: category === c.id ? c.colour + '33' : 'rgba(255,255,255,0.05)',
                color: category === c.id ? c.colour : 'var(--text-secondary)',
                outline: category === c.id ? `0.5px solid ${c.colour}55` : '0.5px solid transparent',
              }}>{c.icon} {c.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={BTN_GHOST}>Cancel</button>
            <button onClick={handleAdd} style={BTN_ACCENT}>Add</button>
          </div>
        </GlassCard>
      )}

      {sorted.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><LineIcon name="repeat" size={30} strokeWidth={1.5} /></div>No recurring transactions yet.
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Add rent, salary, or any regular bill — Arete posts it automatically.</div>
        </div>
      )}

      {sorted.length > 0 && (
        <GlassCard style={{ marginBottom: 0, padding: 0, overflow: 'hidden' }}>
          {sorted.map((r, i) => {
            const cat    = CAT_MAP[r.category] || { colour: '#6b7280', icon: '📦', label: r.category || 'Other' };
            const paused = r.status === 'paused';
            const days   = daysUntil(r.nextDate);
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: i < sorted.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : 'none', opacity: paused ? 0.5 : 1 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: cat.colour + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{cat.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>
                    {paused ? 'Paused' : days != null && days >= 0 ? `Next in ${days}d · ${fmtDate(r.nextDate)}` : `Next ${fmtDate(r.nextDate)}`} · {r.cycle}
                  </div>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: r.type === 'income' ? '#6BE3A4' : 'rgba(255,255,255,0.75)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginRight: 8 }}>
                  {r.type === 'income' ? '+' : '−'}{fmt(r.amount)}
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => onUpdate(r.id, { status: paused ? 'active' : 'paused' })} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: 12 }}>{paused ? '▶' : '⏸'}</button>
                  <button onClick={() => onRemove(r.id)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#FF6B6B', fontSize: 16 }}>×</button>
                </div>
              </div>
            );
          })}
        </GlassCard>
      )}
    </div>
  );
}

export default function Finance({ settings = {} }) {
  const [section, setSection] = useState('overview');

  const txn   = useCollection('transactions',  STORAGE_KEYS.TRANSACTIONS);
  const goals = useCollection('savings_goals', STORAGE_KEYS.SAVINGS);
  const subs      = useCollection('subscriptions',      STORAGE_KEYS.SUBSCRIPTIONS);
  const purchases = useCollection('planned_purchases',   STORAGE_KEYS.PLANNED_PURCHASES);
  const recurring = useCollection('recurring_transactions', STORAGE_KEYS.RECURRING);

  const currencyCode   = settings?.currency || DEFAULT_CURRENCY;
  const currencySymbol = getCurrencySymbol(currencyCode);
  const fmt            = makeFmt(currencyCode);
  const finnhubKey     = settings?.finnhubKey || '';
  const watchlist      = settings?.stocksWatchlist || [];

  function addTransaction(data) { txn.add({ ...data, createdAt: new Date().toISOString() }); }
  function addGoal(data)        { goals.add({ ...data, createdAt: new Date().toISOString() }); }
  function addPurchase(data)    { purchases.add({ ...data, createdAt: new Date().toISOString() }); }
  async function completePurchase(item) {
    // Fire the actual expense transaction
    await txn.add({ type: 'expense', amount: item.amount, description: item.name, category: 'shopping', date: todayISO(), createdAt: new Date().toISOString() });
    // Remove from planned list
    purchases.remove(item.id);
  }
  function addSub(data)         { subs.add({ ...data, createdAt: new Date().toISOString() }); }

  // ─── Materialize due recurring transactions (runs once after rules load) ───
  // Idempotent: each occurrence is keyed by recurringId+date, so even if the
  // nextDate advance fails to persist (e.g. table not yet created), a reload
  // can never post the same occurrence twice.
  const materializedRef = useRef(false);
  useEffect(() => {
    if (materializedRef.current) return;
    if (!recurring.items.length) return;
    materializedRef.current = true;
    const today = todayISO();
    const existing = new Set(
      txn.items.filter(t => t.recurringId).map(t => `${t.recurringId}|${t.date}`)
    );
    recurring.items.forEach(r => {
      if (r.status === 'paused' || !r.nextDate) return;
      let next = r.nextDate, guard = 0;
      while (next <= today && guard < 60) {
        if (!existing.has(`${r.id}|${next}`)) {
          txn.add({
            type: r.type, amount: r.amount, category: r.category,
            description: `${r.name} (recurring)`, date: next,
            createdAt: new Date().toISOString(), recurringId: r.id,
          });
        }
        next = advanceDate(next, r.cycle);
        guard++;
      }
      if (next !== r.nextDate) recurring.update(r.id, { nextDate: next });
    });
  }, [recurring.items]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {/* ── Top header ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '18px 24px 0', flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 300, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.01em', marginBottom: 14 }}>
          Finance
        </div>

        {/* Horizontal nav */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setSection(t.id)} style={{
              padding: '7px 18px 9px',
              border: 'none', cursor: 'pointer',
              background: 'transparent',
              color: section === t.id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.1em',
              fontFamily: 'ui-monospace,monospace',
              borderBottom: section === t.id ? '1.5px solid var(--accent)' : '1.5px solid transparent',
              marginBottom: -0.5,
              transition: 'all 0.15s ease',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stock ticker ──────────────────────────────────────────────────── */}
      {section === 'overview' && (
        <StockTicker watchlist={watchlist} finnhubKey={finnhubKey} />
      )}

      {/* Email import panel — only shown on overview when Gmail connected */}
      {section === 'overview' && isGmailConnected() && (
        <div style={{ padding: '10px 24px 0' }}>
          <EmailImportPanel onAddTransaction={addTransaction} fmt={fmt} />
        </div>
      )}

      {/* ── Scrollable content ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {section === 'overview' && (
          <Overview transactions={txn.items} goals={goals.items} subscriptions={subs.items} purchases={purchases.items} fmt={fmt} currencySymbol={currencySymbol} />
        )}
        {section === 'spending' && (
          <Spending transactions={txn.items} onAdd={addTransaction} fmt={fmt} />
        )}
        {section === 'budgets' && (
          <Budgets transactions={txn.items} fmt={fmt} />
        )}
        {section === 'recurring' && (
          <Recurring recurring={recurring.items} onAdd={recurring.add} onUpdate={recurring.update} onRemove={recurring.remove} fmt={fmt} />
        )}
        {section === 'savings' && (
          <Savings goals={goals.items} onAdd={addGoal} onUpdate={goals.update} onRemove={goals.remove} fmt={fmt} />
        )}
        {section === 'subscriptions' && (
          <Subscriptions subs={subs.items} onAdd={addSub} onUpdate={subs.update} onRemove={subs.remove} fmt={fmt} />
        )}
        {section === 'purchases' && (
          <PlannedPurchases purchases={purchases.items} onAdd={addPurchase} onRemove={purchases.remove} onComplete={completePurchase} fmt={fmt} />
        )}

      </div>
    </div>
  );
}

