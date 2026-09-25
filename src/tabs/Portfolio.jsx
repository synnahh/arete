// Portfolio.jsx — Stock portfolio tracker + AI advisor
// Holdings stored in Supabase `portfolio_holdings` table.
// Live prices via Finnhub. AI advice via Claude.

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS }  from '../utils/storage.js';
import { DEFAULT_CURRENCY } from '../utils/currency.js';

// ─── Shared primitives ────────────────────────────────────────────────────────

const GLASS = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 16,
  padding: '18px 20px',
  backdropFilter: 'blur(24px)',
  boxShadow: '0 1px 0 0 rgba(255,255,255,0.07) inset, 0 12px 40px rgba(0,0,0,0.4)',
  position: 'relative',
  overflow: 'hidden',
};

function GlassCard({ children, style }) {
  return (
    <div style={{ ...GLASS, ...style }}>
      <div style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 1,
        background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)', pointerEvents: 'none' }} />
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 18, height: 1, background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap' }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(255,255,255,0.1),transparent)' }} />
    </div>
  );
}

const INPUT = {
  padding: '9px 12px', borderRadius: 9,
  border: '0.5px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.85)',
  fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%',
  boxSizing: 'border-box',
};

const BTN = {
  padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
  background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
};

const BTN_GHOST = {
  padding: '7px 14px', borderRadius: 9, border: '0.5px solid rgba(255,255,255,0.1)',
  cursor: 'pointer', background: 'transparent',
  color: 'rgba(255,255,255,0.5)', fontSize: 13,
};

// ─── Finnhub quote fetcher ────────────────────────────────────────────────────

async function fetchQuote(symbol, apiKey) {
  if (!apiKey || !symbol) return null;
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// ─── Mini sparkline ──────────────────────────────────────────────────────────

function Sparkline({ values, colour, width = 80, height = 28 }) {
  if (!values || values.length < 2) return <div style={{ width, height }} />;
  const min  = Math.min(...values);
  const max  = Math.max(...values);
  const span = max - min || 1;
  const pts  = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: height - ((v - min) / span) * height,
  }));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <path d={d} fill="none" stroke={colour} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Allocation donut ────────────────────────────────────────────────────────

const PALETTE = ['#6BE3A4','#4a9eff','#a78bfa','#f4a642','#e55a5a','#38bdf8','#fb923c','#e879f9'];

function AllocationDonut({ holdings, size = 100, thickness = 16 }) {
  const total = holdings.reduce((s, h) => s + (h.value || 0), 0) || 1;
  const r     = (size - thickness) / 2;
  const cx    = size / 2, cy = size / 2;
  let   angle = -Math.PI / 2;

  const segments = holdings.map((h, i) => {
    const sweep = ((h.value || 0) / total) * 2 * Math.PI;
    const x1    = cx + r * Math.cos(angle);
    const y1    = cy + r * Math.sin(angle);
    angle      += sweep;
    const x2    = cx + r * Math.cos(angle);
    const y2    = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return { d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, colour: PALETTE[i % PALETTE.length], label: h.symbol, pct: Math.round(((h.value || 0) / total) * 100) };
  });

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <svg width={size} height={size}>
        {segments.length === 0
          ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
          : segments.map((s, i) => <path key={i} d={s.d} fill="none" stroke={s.colour} strokeWidth={thickness} strokeLinecap="butt" />)}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: s.colour, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{s.label}</span>
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace,monospace' }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Overview panel ───────────────────────────────────────────────────────────

function Overview({ enriched, fmt, currency }) {
  const totalValue    = enriched.reduce((s, h) => s + (h.currentValue || 0), 0);
  const totalCost     = enriched.reduce((s, h) => s + (h.costBasis    || 0), 0);
  const totalPL       = totalValue - totalCost;
  const totalPLPct    = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  const dayPL         = enriched.reduce((s, h) => s + (h.dayPL || 0), 0);
  const plColour      = totalPL >= 0 ? '#6BE3A4' : '#FF6B6B';
  const dayColour     = dayPL  >= 0 ? '#6BE3A4' : '#FF6B6B';

  const donutData = enriched
    .filter(h => h.currentValue > 0)
    .map(h => ({ symbol: h.symbol, value: h.currentValue }))
    .sort((a, b) => b.value - a.value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 24px 32px' }}>

      {/* Hero card */}
      <GlassCard>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace,monospace', marginBottom: 8 }}>
          TOTAL PORTFOLIO VALUE
        </div>
        <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1,
          color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginBottom: 8 }}>
          {fmt(totalValue)}
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', fontFamily: 'ui-monospace,monospace', marginBottom: 3 }}>TOTAL RETURN</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: plColour, fontVariantNumeric: 'tabular-nums' }}>
              {totalPL >= 0 ? '+' : ''}{fmt(Math.abs(totalPL))}
              <span style={{ fontSize: 12, marginLeft: 6, opacity: 0.75 }}>({totalPLPct >= 0 ? '+' : ''}{totalPLPct.toFixed(2)}%)</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', fontFamily: 'ui-monospace,monospace', marginBottom: 3 }}>TODAY</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: dayColour, fontVariantNumeric: 'tabular-nums' }}>
              {dayPL >= 0 ? '+' : ''}{fmt(Math.abs(dayPL))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', fontFamily: 'ui-monospace,monospace', marginBottom: 3 }}>COST BASIS</div>
            <div style={{ fontSize: 20, fontWeight: 300, color: 'rgba(255,255,255,0.6)', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(totalCost)}
            </div>
          </div>
        </div>
        {donutData.length > 1 && (
          <div style={{ marginTop: 20 }}>
            <AllocationDonut holdings={donutData} size={90} thickness={14} />
          </div>
        )}
      </GlassCard>

      {/* Positions mini-list */}
      {enriched.length === 0 ? (
        <GlassCard>
          <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
            No holdings yet — add positions in the Holdings tab.
          </div>
        </GlassCard>
      ) : (
        <GlassCard>
          <SectionLabel>Positions</SectionLabel>
          {enriched.map((h, i) => {
            const pl     = h.pl || 0;
            const plPct  = h.plPct || 0;
            const colour = pl >= 0 ? '#6BE3A4' : '#FF6B6B';
            return (
              <div key={h.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: i < enriched.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : 'none',
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: PALETTE[i % PALETTE.length] + '22',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: PALETTE[i % PALETTE.length], letterSpacing: '-0.02em' }}>
                    {h.symbol?.slice(0, 4)}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{h.symbol}</div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace,monospace' }}>
                    {h.shares} shares @ {fmt(h.avgCost)} avg
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums' }}>
                    {h.currentPrice ? fmt(h.currentValue) : '—'}
                  </div>
                  {h.currentPrice && (
                    <div style={{ fontSize: 10.5, color: colour, fontFamily: 'ui-monospace,monospace', fontWeight: 700 }}>
                      {pl >= 0 ? '+' : ''}{fmt(Math.abs(pl))} ({plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%)
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </GlassCard>
      )}
    </div>
  );
}

// ─── Holdings manager ─────────────────────────────────────────────────────────

function Holdings({ holdings, enriched, onAdd, onRemove, onUpdate, fmt, loading }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    symbol: '', shares: '', avgCost: '', buyDate: new Date().toISOString().split('T')[0], note: '',
  });

  function handleAdd() {
    const sym    = form.symbol.trim().toUpperCase();
    const shares = parseFloat(form.shares);
    const cost   = parseFloat(form.avgCost);
    if (!sym || !shares || !cost || shares <= 0 || cost <= 0) return;
    onAdd({ symbol: sym, shares, avgCost: cost, buyDate: form.buyDate, note: form.note.trim() });
    setForm({ symbol: '', shares: '', avgCost: '', buyDate: new Date().toISOString().split('T')[0], note: '' });
    setShowForm(false);
  }

  const enrichMap = Object.fromEntries(enriched.map(h => [h.id, h]));

  return (
    <div style={{ padding: '16px 24px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'ui-monospace,monospace' }}>
          {holdings.length} position{holdings.length !== 1 ? 's' : ''} · prices refresh every 60s
        </div>
        <button onClick={() => setShowForm(v => !v)} style={BTN}>
          {showForm ? 'Cancel' : '+ Add position'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <GlassCard>
          <SectionLabel>New position</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.06em' }}>TICKER</div>
              <input
                value={form.symbol}
                onChange={e => setForm(p => ({ ...p, symbol: e.target.value.toUpperCase() }))}
                placeholder="AAPL"
                style={INPUT}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.06em' }}>SHARES</div>
              <input type="number" min="0" step="any"
                value={form.shares}
                onChange={e => setForm(p => ({ ...p, shares: e.target.value }))}
                placeholder="100"
                style={INPUT}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.06em' }}>AVG BUY PRICE</div>
              <input type="number" min="0" step="any"
                value={form.avgCost}
                onChange={e => setForm(p => ({ ...p, avgCost: e.target.value }))}
                placeholder="150.00"
                style={INPUT}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.06em' }}>BUY DATE</div>
              <input type="date"
                value={form.buyDate}
                onChange={e => setForm(p => ({ ...p, buyDate: e.target.value }))}
                style={INPUT}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.06em' }}>NOTE (optional)</div>
            <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              placeholder="e.g. Long-term hold, dividend play..." style={INPUT} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={BTN_GHOST}>Cancel</button>
            <button onClick={handleAdd} style={BTN}>Add position</button>
          </div>
        </GlassCard>
      )}

      {/* Holdings list */}
      {holdings.length === 0 && !showForm ? (
        <GlassCard>
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
            No positions yet. Add your first holding above.
          </div>
        </GlassCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {holdings.map((h, i) => {
            const e      = enrichMap[h.id] || h;
            const pl     = e.pl || 0;
            const plPct  = e.plPct || 0;
            const colour = pl >= 0 ? '#6BE3A4' : '#FF6B6B';
            const isLoading = loading && !e.currentPrice;
            return (
              <GlassCard key={h.id} style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  {/* Ticker badge */}
                  <div style={{ width: 44, height: 44, borderRadius: 12,
                    background: PALETTE[i % PALETTE.length] + '20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: PALETTE[i % PALETTE.length], letterSpacing: '-0.02em' }}>
                      {h.symbol?.slice(0, 4)}
                    </span>
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{h.symbol}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace,monospace' }}>
                        {h.shares} shares
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, fontFamily: 'ui-monospace,monospace' }}>
                      avg cost {fmt(h.avgCost)} · bought {h.buyDate || '—'}
                    </div>
                    {h.note && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 3, fontStyle: 'italic' }}>{h.note}</div>
                    )}
                  </div>

                  {/* Price + P&L */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {isLoading ? (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>Loading...</div>
                    ) : e.currentPrice ? (
                      <>
                        <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(e.currentPrice)}
                          <span style={{ fontSize: 10, color: e.dayChangePct >= 0 ? '#6BE3A4' : '#FF6B6B', marginLeft: 6 }}>
                            {e.dayChangePct >= 0 ? '+' : ''}{(e.dayChangePct || 0).toFixed(2)}%
                          </span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colour, fontVariantNumeric: 'tabular-nums' }}>
                          {pl >= 0 ? '+' : ''}{fmt(Math.abs(pl))} ({plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%)
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace,monospace' }}>
                          {fmt(e.currentValue)} total
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>No price (add Finnhub key)</div>
                    )}
                  </div>

                  {/* Remove */}
                  <button onClick={() => onRemove(h.id)} style={{
                    width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: 'rgba(229,90,90,0.1)', color: '#e55a5a', fontSize: 15, flexShrink: 0,
                    marginLeft: 8,
                  }}>&#215;</button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── AI Advisor ───────────────────────────────────────────────────────────────

function AIAdvisor({ enriched, fmt, settings, ai }) {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Build portfolio context string
  const portfolioContext = useMemo(() => {
    const totalValue = enriched.reduce((s, h) => s + (h.currentValue || 0), 0);
    const totalPL    = enriched.reduce((s, h) => s + (h.pl || 0), 0);
    const lines      = enriched.map(h =>
      `- ${h.symbol}: ${h.shares} shares @ ${fmt(h.avgCost)} avg, current ${h.currentPrice ? fmt(h.currentPrice) : 'price unavailable'}, P&L: ${fmt(h.pl || 0)} (${(h.plPct || 0).toFixed(2)}%)`
    ).join('\n');
    const monthlyIncome = (settings?.monthlyIncome || 0);
    return `Portfolio snapshot:\n${lines || 'No holdings yet.'}\nTotal value: ${fmt(totalValue)}\nTotal P&L: ${fmt(totalPL)}\n${monthlyIncome ? `Monthly income: ${fmt(monthlyIncome)}` : ''}`;
  }, [enriched, fmt, settings]);

  const SYSTEM = `You are VALERIE's financial advisor module. You have access to the user's portfolio data. Be concise, direct, and data-driven. Provide actionable insight. Never give legally binding advice — frame recommendations as analysis. Portfolio data:\n${portfolioContext}`;

  const STARTERS = [
    'Analyse my portfolio performance and highlight any concerns.',
    'Based on my portfolio and income, what sectors am I overexposed to?',
    'Which of my positions should I consider trimming or averaging down?',
    'Suggest 3 ETFs or stocks that would diversify my current holdings.',
    'What is my current portfolio risk profile?',
  ];

  async function send(text) {
    const msg = text || input.trim();
    if (!msg) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      let reply = '';
      if (ai?.streamMessage) {
        // Use VALERIE's AI with portfolio system context
        reply = await ai.streamMessage(msg, SYSTEM, (chunk) => {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return [...prev.slice(0, -1), { role: 'assistant', content: last.content + chunk }];
            }
            return [...prev, { role: 'assistant', content: chunk }];
          });
        });
      } else {
        reply = 'AI not available. Check your Claude API key in Settings → AI.';
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 24px 0' }}>

      {/* Context banner */}
      <GlassCard style={{ marginBottom: 12, padding: '12px 16px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace,monospace', marginBottom: 6 }}>
          PORTFOLIO CONTEXT LOADED — {enriched.length} POSITIONS
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
          VALERIE has access to your full portfolio including positions, P&L, and pricing. Ask anything about your investments.
        </div>
      </GlassCard>

      {/* Starter prompts */}
      {messages.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {STARTERS.map((s, i) => (
            <button key={i} onClick={() => send(s)} style={{
              padding: '6px 12px', borderRadius: 20, border: '0.5px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)',
              fontSize: 11, cursor: 'pointer', textAlign: 'left', lineHeight: 1.4,
            }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '78%', padding: '10px 14px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: m.role === 'user' ? 'var(--accent)22' : 'rgba(255,255,255,0.04)',
              border: `0.5px solid ${m.role === 'user' ? 'var(--accent)44' : 'rgba(255,255,255,0.08)'}`,
              fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 4, padding: '8px 14px', alignItems: 'center' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
                animation: `bounce 0.9s ${i * 0.15}s ease-in-out infinite`,
              }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', gap: 8, paddingBottom: 20, paddingTop: 8,
        borderTop: '0.5px solid rgba(255,255,255,0.07)',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask about your portfolio..."
          style={{ ...INPUT, flex: 1 }}
        />
        <button onClick={() => send()} disabled={!input.trim() || loading} style={{
          ...BTN, opacity: (!input.trim() || loading) ? 0.5 : 1,
          padding: '8px 16px',
        }}>
          Send
        </button>
      </div>
    </div>
  );
}

// ─── Main Portfolio Tab ───────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',  label: 'OVERVIEW'  },
  { id: 'holdings',  label: 'HOLDINGS'  },
  { id: 'advisor',   label: 'AI ADVISOR' },
];

export default function Portfolio({ settings = {}, ai }) {
  const [section,   setSection]   = useState('overview');
  const [quotes,    setQuotes]    = useState({});
  const [quotesLoading, setQLoading] = useState(false);

  const holdings = useCollection('portfolio_holdings', 'valerie_portfolio');

  const finnhubKey = settings?.finnhubKey || '';

  // Fetch live quotes for all holdings
  useEffect(() => {
    if (!finnhubKey || !holdings.items.length) return;

    async function refresh() {
      setQLoading(true);
      const symbols = [...new Set(holdings.items.map(h => h.symbol))];
      const results = await Promise.all(symbols.map(async sym => {
        const q = await fetchQuote(sym, finnhubKey);
        return [sym, q];
      }));
      setQuotes(Object.fromEntries(results.filter(([, q]) => q && q.c)));
      setQLoading(false);
    }

    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [holdings.items, finnhubKey]);

  // Enrich holdings with live price data
  const enriched = useMemo(() => holdings.items.map(h => {
    const q            = quotes[h.symbol];
    const currentPrice = q?.c || null;
    const dayChange    = q?.d || 0;
    const dayChangePct = q?.dp || 0;
    const currentValue = currentPrice ? currentPrice * h.shares : null;
    const costBasis    = h.avgCost * h.shares;
    const pl           = currentValue != null ? currentValue - costBasis : null;
    const plPct        = pl != null && costBasis > 0 ? (pl / costBasis) * 100 : null;
    const dayPL        = currentPrice ? dayChange * h.shares : 0;
    return { ...h, currentPrice, dayChange, dayChangePct, currentValue, costBasis, pl, plPct, dayPL };
  }), [holdings.items, quotes]);

  // Currency formatter
  const currency = settings?.currency || DEFAULT_CURRENCY;
  function getCurrencySymbol(code) {
    if (code === 'GBP') return '£';
    if (code === 'EUR') return '€';
    if (code === 'AUD') return 'A$';
    return '$';
  }
  const sym = getCurrencySymbol(currency);
  const fmt = (n) => `${sym}${Math.abs(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function addHolding(data) { holdings.add({ ...data, createdAt: new Date().toISOString() }); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {/* Header */}
      <div style={{ padding: '18px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 300, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.01em' }}>
            Portfolio
          </div>
          {quotesLoading && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace,monospace', letterSpacing: '0.06em' }}>
              REFRESHING PRICES...
            </div>
          )}
          {!finnhubKey && (
            <div style={{ fontSize: 10.5, color: '#F2C063', padding: '4px 10px', borderRadius: 8,
              background: 'rgba(242,192,99,0.1)', border: '0.5px solid rgba(242,192,99,0.2)' }}>
              Add Finnhub key in Settings for live prices
            </div>
          )}
        </div>

        {/* Nav tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setSection(t.id)} style={{
              padding: '7px 18px 9px', border: 'none', cursor: 'pointer', background: 'transparent',
              color: section === t.id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              fontFamily: 'ui-monospace,monospace',
              borderBottom: section === t.id ? '1.5px solid var(--accent)' : '1.5px solid transparent',
              marginBottom: -0.5, transition: 'all 0.15s ease',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: section === 'advisor' ? 'hidden' : 'auto' }}>
        {section === 'overview' && (
          <Overview enriched={enriched} fmt={fmt} currency={currency} />
        )}
        {section === 'holdings' && (
          <Holdings
            holdings={holdings.items}
            enriched={enriched}
            onAdd={addHolding}
            onRemove={holdings.remove}
            onUpdate={holdings.update}
            fmt={fmt}
            loading={quotesLoading}
          />
        )}
        {section === 'advisor' && (
          <AIAdvisor enriched={enriched} fmt={fmt} settings={settings} ai={ai} />
        )}
      </div>
    </div>
  );
}
