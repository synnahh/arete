// ─── VALERIE — Finance Tab ────────────────────────────────────────────────────
import { useState, useMemo, useEffect, useRef } from 'react';
import { useCollection }     from '../firebase/useCollection.js';
import { STORAGE_KEYS }      from '../utils/storage.js';
import { fetchWatchlist }    from '../utils/finnhub.js';

// ─── Categories ──────────────────────────────────────────────────────────────
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

const TABS = [
  { id: 'overview',      label: 'OVERVIEW'      },
  { id: 'spending',      label: 'SPENDING'       },
  { id: 'savings',       label: 'SAVINGS'        },
  { id: 'subscriptions', label: 'SUBSCRIPTIONS'  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().split('T')[0];

function getCurrencySymbol(code) {
  switch (code) {
    case 'GBP': return '£';
    case 'EUR': return '€';
    case 'USD': return '$';
    case 'AUD': return 'A$';
    default:    return '$';
  }
}
function makeFmt(code) {
  const sym = getCurrencySymbol(code);
  return (n) => `${sym}${Math.abs(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  const today = new Date();
  if (str === todayISO()) return 'Today';
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (str === yesterday.toISOString().split('T')[0]) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}
function toMonthly(amount, cycle) {
  if (cycle === 'weekly') return (amount || 0) * 4.33;
  if (cycle === 'yearly') return (amount || 0) / 12;
  return amount || 0;
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
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap' }}>
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

  // Catmull-Rom → cubic bezier smooth path
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
  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: 13,
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
    <div style={{ padding: '10px 24px', fontSize: 10.5, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace', letterSpacing: '0.06em', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
      Add a Finnhub API key in Settings → Integrations to enable live stock prices.
    </div>
  );

  if (!watchlist?.length) return (
    <div style={{ padding: '10px 24px', fontSize: 10.5, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace', letterSpacing: '0.06em', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
      No stocks in watchlist — add tickers in Settings → Integrations.
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
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>—</span>
          </div>
        );
        const up = q.d >= 0;
        return (
          <div key={sym} style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>{sym}</span>
            <span style={{ fontSize: 13, fontWeight: 300, color: 'var(--text-primary)' }}>
              {q.c?.toFixed(2)}
            </span>
            <span style={{ fontSize: 10, color: up ? '#4caf7d' : '#e55a5a' }}>
              {up ? '+' : ''}{q.dp?.toFixed(2)}%
            </span>
          </div>
        );
      })}
      {!loading && Object.keys(quotes).length > 0 && (
        <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>Live · updates every 60s</span>
      )}
    </div>
  );
}

// ─── Overview panel ───────────────────────────────────────────────────────────
function Overview({ transactions, goals, subscriptions, fmt, currencySymbol }) {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const yearStart  = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const thisMonth  = transactions.filter(t => t.date >= monthStart);

  const income   = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const expenses = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const net      = income - expenses;

  // All-time net (cumulative)
  const allIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const allExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const allNet     = allIncome - allExpense;

  const monthlySubCost = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + toMonthly(s.amount, s.cycle), 0);

  // 30-day cumulative net for area chart
  const chartData = useMemo(() => {
    let running = 0;
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().split('T')[0];
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '20px 24px 32px' }}>

      {/* ── Hero card ─────────────────────────────────────────────────────────── */}
      <GlassCard style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace,monospace', marginBottom: 8 }}>
          THIS MONTH · NET BALANCE
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 6 }}>
          <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1, color: netColour, fontVariantNumeric: 'tabular-nums' }}>
            {net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: `${netColour}18`, color: netColour, fontFamily: 'ui-monospace,monospace', fontWeight: 700, letterSpacing: '0.04em' }}>
              {income > 0 ? `${Math.round((net / income) * 100)}% saved` : '—'}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace,monospace' }}>
          {now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} &nbsp;·&nbsp; All-time net: {allNet >= 0 ? '+' : '−'}{fmt(Math.abs(allNet))}
        </div>

        {/* Chart + allocation row */}
        <div style={{ display: 'flex', gap: 24, marginTop: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <AreaChart data={chartData} width={320} height={88} colour={netColour} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace' }}>30 days ago</span>
              <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace' }}>Today</span>
            </div>
          </div>

          {donutSegs.length > 0 && (
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
              <MiniDonut segments={donutSegs} size={80} thickness={13} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {donutSegs.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: c.colour, flexShrink: 0 }} />
                    <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', flex: 1 }}>{c.label}</span>
                    <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', marginLeft: 6, fontFamily: 'ui-monospace,monospace' }}>
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
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace,monospace', marginBottom: 7 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: s.colour, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
          </GlassCard>
        ))}
      </div>

      {/* ── Renewal alerts ───────────────────────────────────────────────────── */}
      {renewalsSoon.length > 0 && (
        <GlassCard style={{ marginBottom: 10, background: 'rgba(242,192,99,0.06)' }}>
          <SectionLabel>Upcoming renewals</SectionLabel>
          {renewalsSoon.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{s.name}</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(242,192,99,0.15)', color: '#F2C063', fontFamily: 'ui-monospace,monospace', fontWeight: 700 }}>in {s.daysLeft}d</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'ui-monospace,monospace' }}>{fmt(s.amount)}</span>
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
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            No transactions yet — add some in Spending
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
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
                    <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', marginTop: 1, fontFamily: 'ui-monospace,monospace' }}>{cat.label}</div>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', flexShrink: 0, fontFamily: 'ui-monospace,monospace', marginRight: 6 }}>{fmtDate(t.date)}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, flexShrink: 0, color: isIncome ? '#6BE3A4' : 'rgba(255,255,255,0.75)', fontVariantNumeric: 'tabular-nums', minWidth: 72, textAlign: 'right' }}>
                    {isIncome ? '+' : '−'}{fmt(t.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// ─── Spending panel ───────────────────────────────────────────────────────────
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
    periodStart = d.toISOString().split('T')[0];
  } else if (period === 'month') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  } else {
    periodStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
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
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Header row */}
      <div style={{ padding: '24px 32px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 4 }}>TOTAL SPENT</div>
          <div style={{ fontSize: 32, fontWeight: 200, color: '#e55a5a' }}>{fmt(totalSpend)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 4 }}>INCOME</div>
          <div style={{ fontSize: 32, fontWeight: 200, color: '#4caf7d' }}>{fmt(totalIncome)}</div>
        </div>
      </div>

      {/* Period + add */}
      <div style={{ padding: '0 32px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
        {[['week','7D'], ['month','1M'], ['year','1Y']].map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)} style={{
            padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
            background: period === v ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
            color: period === v ? '#fff' : 'var(--text-secondary)',
          }}>{l}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowForm(v => !v)} style={{ ...BTN_ACCENT, padding: '6px 16px', fontSize: 12 }}>
          + Add
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ margin: '0 32px 20px', padding: '18px 20px', background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', borderRadius: 12 }}>
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
        </div>
      )}

      {/* Category breakdown */}
      {catBreakdown.length > 0 && (
        <div style={{ padding: '0 32px 8px' }}>
          {catBreakdown.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 13, width: 20 }}>{c.icon}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{c.label}</span>
              <div style={{ width: 100, height: 3, borderRadius: 2, background: 'var(--hover-bg)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((c.value / totalSpend) * 100, 100)}%`, background: c.colour, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 60, textAlign: 'right' }}>{fmt(c.value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Separator */}
      <div style={{ height: '0.5px', background: 'var(--card-border)', margin: '8px 0' }} />

      {/* Transaction list */}
      <div style={{ padding: '8px 0 0', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', paddingLeft: 32, marginBottom: 4 }}>TRANSACTIONS</div>
      {sorted.length === 0 ? (
        <div style={{ padding: '24px 32px', color: 'var(--text-muted)', fontSize: 13 }}>No transactions in this period.</div>
      ) : sorted.map((t, i) => {
        const cat = CAT_MAP[t.category] || { colour: '#6b7280', icon: '📦', label: t.category || 'Other' };
        return (
          <div key={t.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 32px', borderBottom: '0.5px solid var(--card-border)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: cat.colour + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{cat.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || cat.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cat.label}</div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>{fmtDate(t.date)}</span>
            <span style={{ fontSize: 14, fontWeight: 400, color: t.type === 'income' ? '#4caf7d' : 'var(--text-primary)', minWidth: 72, textAlign: 'right' }}>
              {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
            </span>
          </div>
        );
      })}
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
    onAdd({ name: name.trim(), target: t, current: parseFloat(current) || 0, deadline: deadline || null, milestones: [{ pct: 25, label: '25%' }, { pct: 50, label: '50%' }, { pct: 75, label: '75%' }, { pct: 100, label: '🎉' }] });
    setName(''); setTarget(''); setCurrent(''); setDeadline(''); setShowForm(false);
  }
  function handleAddFunds(goal) {
    const n = parseFloat(addAmt);
    if (!n || n <= 0) return;
    onUpdate(goal.id, { current: Math.min((goal.current || 0) + n, goal.target) });
    setAddingTo(null); setAddAmt('');
  }

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>SAVINGS GOALS</span>
        <button onClick={() => setShowForm(v => !v)} style={{ ...BTN_ACCENT, padding: '6px 14px', fontSize: 12 }}>+ New Goal</button>
      </div>
      {showForm && (
        <div style={{ padding: '18px 20px', background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', borderRadius: 12, marginBottom: 20 }}>
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
        </div>
      )}
      {goals.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
          No savings goals yet.
        </div>
      )}
      {goals.map((goal, i) => {
        const pct  = goal.target > 0 ? Math.min(((goal.current || 0) / goal.target) * 100, 100) : 0;
        const done = pct >= 100;
        const dLeft = goal.deadline ? daysUntil(goal.deadline) : null;
        return (
          <div key={goal.id} style={{ paddingBottom: 20, marginBottom: 20, borderBottom: i < goals.length - 1 ? '0.5px solid var(--card-border)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, color: 'var(--text-primary)' }}>{goal.name}{done ? ' 🎉' : ''}</div>
                {dLeft !== null && <div style={{ fontSize: 11, color: dLeft < 0 ? '#e55a5a' : dLeft <= 30 ? '#f4a642' : 'var(--text-muted)', marginTop: 3 }}>
                  {dLeft < 0 ? 'Overdue' : dLeft === 0 ? 'Due today' : `${dLeft} days left`}
                </div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 300, color: done ? '#4caf7d' : 'var(--text-primary)' }}>{fmt(goal.current || 0)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>of {fmt(goal.target)}</div>
              </div>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--hover-bg)', overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: done ? '#4caf7d' : 'var(--accent)', borderRadius: 2, transition: 'width 0.4s ease' }} />
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
                  <button onClick={() => onRemove(goal.id)} style={{ ...BTN_GHOST, color: '#e55a5a' }}>Remove</button>
                </div>
              )
            )}
          </div>
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
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Totals + add */}
      <div style={{ padding: '24px 32px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 4 }}>MONTHLY TOTAL</div>
          <div style={{ fontSize: 32, fontWeight: 200, color: 'var(--text-primary)' }}>{fmt(monthlyTotal)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{fmt(monthlyTotal * 12)} / year</div>
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{ ...BTN_ACCENT, padding: '6px 16px', fontSize: 12 }}>+ Add</button>
      </div>

      {showForm && (
        <div style={{ margin: '0 32px 16px', padding: '18px 20px', background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', borderRadius: 12 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <input placeholder="Name (e.g. Netflix)" value={name} onChange={e => setName(e.target.value)} style={INPUT} />
            <input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...INPUT, flex: '0 0 90px' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {['weekly','monthly','yearly'].map(c => (
              <button key={c} onClick={() => setCycle(c)} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, background: cycle === c ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: cycle === c ? '#fff' : 'var(--text-secondary)' }}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ marginBottom: 10 }}>
            <input type="date" value={nextBill} onChange={e => setNextBill(e.target.value)} style={INPUT} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            {SUB_CATS.map(c => (
              <button key={c.id} onClick={() => setSubCat(c.id)} style={{ padding: '3px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, background: subCat === c.id ? 'var(--accent)33' : 'rgba(255,255,255,0.05)', color: subCat === c.id ? 'var(--accent)' : 'var(--text-secondary)', outline: subCat === c.id ? '0.5px solid var(--accent)44' : '0.5px solid transparent' }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={BTN_GHOST}>Cancel</button>
            <button onClick={handleAdd} style={BTN_ACCENT}>Add</button>
          </div>
        </div>
      )}

      {sorted.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔄</div>No subscriptions tracked yet.
        </div>
      )}

      {sorted.map((s, i) => {
        const cat     = SUB_CATS.find(c => c.id === s.category) || { icon: '📦' };
        const days    = daysUntil(s.nextBilling);
        const dueSoon = days != null && days <= 7 && days >= 0;
        const overdue = days != null && days < 0;
        const paused  = s.status === 'paused';
        const cancelled = s.status === 'cancelled';
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 32px', borderBottom: '0.5px solid var(--card-border)', opacity: cancelled ? 0.45 : 1 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: cancelled ? '#555' : paused ? '#f4a642' : '#4caf7d', boxShadow: (!cancelled && !paused) ? '0 0 5px rgba(76,175,125,0.4)' : 'none' }} />
            <div style={{ fontSize: 18, flexShrink: 0 }}>{cat.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
              <div style={{ fontSize: 11, color: overdue ? '#e55a5a' : dueSoon ? '#f4a642' : 'var(--text-muted)' }}>
                {cancelled ? 'Cancelled' : paused ? 'Paused' : overdue ? 'Overdue' : dueSoon ? `Due in ${days}d` : `Renews ${fmtDate(s.nextBilling)}`} · {s.cycle}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{fmt(s.amount)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmt(toMonthly(s.amount, s.cycle))}/mo</div>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {!cancelled && <button onClick={() => onUpdate(s.id, { status: paused ? 'active' : 'paused' })} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: 12 }}>{paused ? '▶' : '⏸'}</button>}
              <button onClick={() => onRemove(s.id)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#e55a5a', fontSize: 16 }}>×</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Finance Tab ─────────────────────────────────────────────────────────
export default function Finance({ settings = {} }) {
  const [section, setSection] = useState('overview');

  const txn   = useCollection('transactions',  STORAGE_KEYS.TRANSACTIONS);
  const goals = useCollection('savings_goals', STORAGE_KEYS.SAVINGS);
  const subs  = useCollection('subscriptions', STORAGE_KEYS.SUBSCRIPTIONS);

  const currencyCode   = settings?.currency || 'GBP';
  const currencySymbol = getCurrencySymbol(currencyCode);
  const fmt            = makeFmt(currencyCode);
  const finnhubKey     = settings?.finnhubKey || '';
  const watchlist      = settings?.stocksWatchlist || [];

  function addTransaction(data) { txn.add({ ...data, createdAt: new Date().toISOString() }); }
  function addGoal(data)        { goals.add({ ...data, createdAt: new Date().toISOString() }); }
  function addSub(data)         { subs.add({ ...data, createdAt: new Date().toISOString() }); }

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
              fontSize: 10, fontWeight: 700,
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

      {/* ── Scrollable content ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {section === 'overview' && (
          <Overview transactions={txn.items} goals={goals.items} subscriptions={subs.items} fmt={fmt} currencySymbol={currencySymbol} />
        )}
        {section === 'spending' && (
          <Spending transactions={txn.items} onAdd={addTransaction} fmt={fmt} />
        )}
        {section === 'savings' && (
          <Savings goals={goals.items} onAdd={addGoal} onUpdate={goals.update} onRemove={goals.remove} fmt={fmt} />
        )}
        {section === 'subscriptions' && (
          <Subscriptions subs={subs.items} onAdd={addSub} onUpdate={subs.update} onRemove={subs.remove} fmt={fmt} />
        )}
      </div>
    </div>
  );
}
