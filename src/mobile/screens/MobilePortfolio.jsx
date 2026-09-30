// MobilePortfolio.jsx — Portfolio screen for VALERIE iOS PWA

import { useState, useEffect, useRef } from 'react';
import { useCollection } from '../../supabase/useCollection.js';
import { askClaudeRaw }  from '../../utils/claudeRaw.js';
import { currencySymbol as currencySym, readCurrency } from '../../utils/currency.js';
import { toLocalDateKey } from '../../utils/localDate.js';

const FINNHUB_KEY_KEY = 'valerie_finnhub_key';

function getFinnhubKey() { return localStorage.getItem(FINNHUB_KEY_KEY) || ''; }

async function fetchPrice(ticker) {
  const key = getFinnhubKey();
  if (!key) return null;
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${key}`);
    const d = await r.json();
    return { price: d.c, change: d.d, pct: d.dp };
  } catch { return null; }
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function MCard({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 16, overflow: 'hidden', ...style,
    }}>{children}</div>
  );
}

const INPUT = {
  width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10,
  border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)',
  color: 'rgba(255,255,255,0.85)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
};
const BTN = {
  width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer',
  background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600,
};
const BTN_GHOST = {
  padding: '9px 18px', borderRadius: 10, cursor: 'pointer',
  border: '0.5px solid rgba(255,255,255,0.12)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 13,
};

function Label({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)',
      fontFamily: 'ui-monospace,monospace', marginBottom: 5, textTransform: 'uppercase' }}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)',
          animation: `mBounce 0.9s ${i*0.15}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

function PctBadge({ val }) {
  const pos = val >= 0;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
      background: pos ? 'rgba(107,227,164,0.12)' : 'rgba(229,90,90,0.12)',
      color: pos ? '#6BE3A4' : '#e55a5a',
    }}>{pos?'+':''}{typeof val==='number'?val.toFixed(2):val}%</span>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function Overview({ holdings, prices }) {
  const currency = readCurrency();
  const sym = currencySym(currency);

  let totalValue = 0, totalCost = 0;
  holdings.forEach(h => {
    const qty = parseFloat(h.shares) || 0;
    const avg = parseFloat(h.avgPrice) || 0;
    const price = prices[h.ticker]?.price || 0;
    totalValue += qty * price;
    totalCost  += qty * avg;
  });
  const pnl = totalValue - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  // Allocation data (top 5 + rest)
  const alloc = holdings.map(h => {
    const qty   = parseFloat(h.shares) || 0;
    const price = prices[h.ticker]?.price || 0;
    return { ticker: h.ticker, value: qty * price };
  }).sort((a,b) => b.value - a.value);

  const allocTop = alloc.slice(0, 5);
  const restVal  = alloc.slice(5).reduce((s,x) => s + x.value, 0);
  if (restVal > 0) allocTop.push({ ticker: 'Other', value: restVal });

  const COLOURS = ['#4a9eff','#6BE3A4','#a78bfa','#f4a642','#e879f9','rgba(255,255,255,0.2)'];

  return (
    <div style={{ padding: '0 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Hero */}
      <MCard>
        <div style={{ padding: '20px 20px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace',
            letterSpacing: '0.1em', marginBottom: 6 }}>TOTAL PORTFOLIO VALUE</div>
          <div style={{ fontSize: 36, fontWeight: 200, color: 'rgba(255,255,255,0.95)', letterSpacing: '-1px', marginBottom: 6 }}>
            {sym}{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <PctBadge val={pnlPct} />
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
            All-time P&L: <span style={{ color: pnl>=0?'#6BE3A4':'#e55a5a' }}>{sym}{Math.abs(pnl).toFixed(2)}</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            Cost basis: {sym}{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </MCard>

      {/* Allocation bar */}
      {allocTop.length > 0 && totalValue > 0 && (
        <MCard>
          <div style={{ padding: '14px 16px' }}>
            <Label>Allocation</Label>
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1, marginBottom: 10 }}>
              {allocTop.map((a,i) => (
                <div key={a.ticker} style={{
                  flex: a.value / totalValue, background: COLOURS[i % COLOURS.length], borderRadius: 2,
                }} />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
              {allocTop.map((a,i) => (
                <div key={a.ticker} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: COLOURS[i % COLOURS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {a.ticker} <span style={{ color: 'var(--text-muted)' }}>
                      {((a.value/totalValue)*100).toFixed(1)}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </MCard>
      )}

      {holdings.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>
          No holdings added yet.{'\n'}Go to Holdings to add your first position.
        </div>
      )}
    </div>
  );
}

// ─── Holdings ─────────────────────────────────────────────────────────────────

function Holdings({ holdings, prices, refreshPrices, loading }) {
  const portfolio = useCollection('portfolio_holdings', 'valerie_portfolio');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ticker:'', shares:'', avgPrice:'', note:'' });
  const currency = readCurrency();
  const sym = currencySym(currency);
  const f = (k,v) => setForm(p => ({...p,[k]:v}));

  function add() {
    if (!form.ticker || !form.shares) return;
    portfolio.add({ ...form, ticker: form.ticker.toUpperCase(), date: toLocalDateKey(new Date()), createdAt: new Date().toISOString() });
    setForm({ ticker:'', shares:'', avgPrice:'', note:'' }); setShowAdd(false);
    setTimeout(refreshPrices, 1000);
  }

  return (
    <div style={{ padding: '0 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setShowAdd(v=>!v)} style={{ ...BTN, flex: 1 }}>+ Add holding</button>
        <button onClick={refreshPrices} style={{ ...BTN_GHOST, padding: '9px 14px' }}>{loading ? '...' : '↻'}</button>
      </div>

      {showAdd && (
        <MCard>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="Ticker (e.g. AAPL)" value={form.ticker}
                onChange={e=>f('ticker',e.target.value.toUpperCase())} style={{ ...INPUT, flex: 1, fontFamily: 'ui-monospace,monospace' }} />
              <input placeholder="Shares" type="number" value={form.shares}
                onChange={e=>f('shares',e.target.value)} style={{ ...INPUT, flex: 1 }} />
            </div>
            <input placeholder="Avg buy price" type="number" step="0.01" value={form.avgPrice}
              onChange={e=>f('avgPrice',e.target.value)} style={INPUT} />
            <input placeholder="Note (optional)" value={form.note}
              onChange={e=>f('note',e.target.value)} style={INPUT} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowAdd(false)} style={{ ...BTN_GHOST, flex: 1 }}>Cancel</button>
              <button onClick={add} style={{ ...BTN, flex: 2 }}>Add</button>
            </div>
          </div>
        </MCard>
      )}

      {holdings.length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>
          No positions yet.
        </div>
      )}

      {holdings.map((h,i) => {
        const qty  = parseFloat(h.shares) || 0;
        const avg  = parseFloat(h.avgPrice) || 0;
        const p    = prices[h.ticker];
        const price = p?.price;
        const value = price ? qty * price : 0;
        const cost  = qty * avg;
        const pnl   = price ? value - cost : null;
        const pnlPct = cost > 0 && pnl !== null ? (pnl/cost)*100 : null;
        return (
          <MCard key={h.id||i}>
            <div style={{ padding: '13px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: 'ui-monospace,monospace' }}>{h.ticker}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{qty} shares · avg {sym}{avg.toFixed(2)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {price ? (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{sym}{price.toFixed(2)}</div>
                      {pnlPct !== null && <PctBadge val={pnlPct} />}
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>no price</div>
                  )}
                </div>
              </div>
              {price && pnl !== null && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Value: {sym}{value.toFixed(2)} · P&L: <span style={{ color: pnl>=0?'#6BE3A4':'#e55a5a' }}>
                    {pnl>=0?'+':''}{sym}{Math.abs(pnl).toFixed(2)}
                  </span>
                </div>
              )}
              {h.note && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{h.note}</div>}
            </div>
          </MCard>
        );
      })}
    </div>
  );
}

// ─── AI Advisor ───────────────────────────────────────────────────────────────

function AIAdvisor({ holdings, prices }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const currency = readCurrency();
  const sym = currencySym(currency);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [msgs]);

  const portfolioCtx = holdings.map(h => {
    const p = prices[h.ticker]?.price;
    const qty = parseFloat(h.shares)||0;
    const avg = parseFloat(h.avgPrice)||0;
    return `${h.ticker}: ${qty} shares @ avg ${sym}${avg}, current ${p?`${sym}${p.toFixed(2)}`:'no price'}`;
  }).join('\n');

  const sys = `You are a portfolio analyst AI advisor. The user's current holdings:\n${portfolioCtx||'No positions yet.'}\nCurrency: ${currency}. Provide clear, direct, actionable analysis. Max 3 paragraphs.`;

  async function send(text) {
    const msg = (text||input).trim(); if (!msg||loading) return;
    setInput('');
    const next = [...msgs, { role:'user', content:msg }];
    setMsgs(next); setLoading(true);
    try {
      const reply = await askClaudeRaw(msg, sys, msgs);
      setMsgs([...next, { role:'assistant', content:reply }]);
    } catch(e) {
      setMsgs([...next, { role:'assistant', content:`Error: ${e.message}` }]);
    } finally { setLoading(false); }
  }

  const starters = ['Analyse my portfolio','Where should I rebalance?','What are my biggest risks?'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {starters.map(s => (
              <button key={s} onClick={() => send(s)} style={{
                padding: '10px 14px', borderRadius: 12, fontSize: 13, textAlign: 'left', cursor: 'pointer',
                border: '0.5px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-secondary)',
              }}>{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m,i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role==='user'?'flex-end':'flex-start' }}>
            <div style={{
              maxWidth: '88%', padding: '10px 14px', fontSize: 14, lineHeight: 1.65,
              color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap',
              borderRadius: m.role==='user'?'18px 18px 4px 18px':'4px 18px 18px 18px',
              background: m.role==='user'?'color-mix(in srgb, var(--accent) 13%, transparent)':'rgba(255,255,255,0.05)',
              border: `0.5px solid ${m.role==='user'?'color-mix(in srgb, var(--accent) 27%, transparent)':'rgba(255,255,255,0.08)'}`,
            }}>{m.content}</div>
          </div>
        ))}
        {loading && <Spinner />}
        <div ref={endRef} />
      </div>
      <div style={{ padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', flexShrink: 0,
        borderTop: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}
          placeholder="Ask about your portfolio..." style={{ ...INPUT, flex: 1, borderRadius: 20, padding: '11px 16px' }} />
        <button onClick={()=>send()} disabled={!input.trim()||loading}
          style={{ ...BTN, width:'auto', padding:'11px 18px', borderRadius:20, opacity:(!input.trim()||loading)?0.5:1 }}>
          Send
        </button>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'overview',  label: 'Overview',  emoji: '📊' },
  { id: 'holdings',  label: 'Holdings',  emoji: '📈' },
  { id: 'advisor',   label: 'Advisor',   emoji: '🤖' },
];

export default function MobilePortfolio() {
  const [section, setSection]   = useState('overview');
  const portfolio = useCollection('portfolio_holdings', 'valerie_portfolio');
  const [prices, setPrices]     = useState({});
  const [priceLoading, setPL]   = useState(false);

  const holdings = portfolio.items;

  async function refreshPrices() {
    if (!getFinnhubKey() || holdings.length === 0) return;
    setPL(true);
    const results = await Promise.allSettled(holdings.map(h => fetchPrice(h.ticker)));
    const map = {};
    holdings.forEach((h,i) => {
      if (results[i].status === 'fulfilled' && results[i].value) map[h.ticker] = results[i].value;
    });
    setPrices(map);
    setPL(false);
  }

  useEffect(() => { refreshPrices(); }, [holdings.length]);
  useEffect(() => {
    const id = setInterval(refreshPrices, 60000);
    return () => clearInterval(id);
  }, [holdings.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 300, color: 'rgba(255,255,255,0.9)' }}>Portfolio</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', letterSpacing: '0.08em' }}>
            INVESTMENTS
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, paddingBottom: 12 }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace,monospace', letterSpacing: '0.06em',
              background: section === s.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: section === s.id ? '#fff' : 'rgba(255,255,255,0.4)',
            }}>{s.emoji} {s.label.toUpperCase()}</button>
          ))}
        </div>
        <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingTop: 14 }}>
        {section === 'overview' && <Overview holdings={holdings} prices={prices} />}
        {section === 'holdings' && <Holdings holdings={holdings} prices={prices} refreshPrices={refreshPrices} loading={priceLoading} />}
        {section === 'advisor'  && <AIAdvisor holdings={holdings} prices={prices} />}
      </div>

      <style>{`
        @keyframes mBounce {
          0%,100% { transform:translateY(0); opacity:0.4; }
          50% { transform:translateY(-4px); opacity:1; }
        }
      `}</style>
    </div>
  );
}
