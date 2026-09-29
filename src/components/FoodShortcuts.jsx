// Two ways to log faster than searching: copy yesterday's meals, or quick-add
// just calories (and optionally protein). Rules: src/domain/foods.js.
// Used by the desktop Nutrition screen and the phone Nutrition tab.
import { useState } from 'react';
import { quickEntry } from '../domain/foods.js';

const btn = {
  minHeight: 44, padding: '0 16px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5,
  border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', color: 'var(--text-primary)', WebkitTapHighlightColor: 'transparent',
};
const field = {
  height: 44, minWidth: 0, boxSizing: 'border-box', padding: '0 10px', borderRadius: 10, fontFamily: 'inherit', fontSize: 15,
  background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', color: 'var(--text-primary)',
};

export default function FoodShortcuts({ yesterday, onCopy, onQuickAdd }) {
  const [open, setOpen] = useState(false);
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function copy() {
    if (busy) return;
    setBusy(true);
    try { await onCopy(); } finally { setBusy(false); }
  }

  async function add() {
    const entry = quickEntry({ name, calories: kcal, protein });
    if (!entry) { setError('Enter calories between 1 and 10,000.'); return; }
    setError(''); setBusy(true);
    try { await onQuickAdd(entry); setKcal(''); setProtein(''); setName(''); setOpen(false); } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={copy} disabled={!yesterday || busy} style={{ ...btn, opacity: yesterday ? 1 : 0.5 }}
          aria-label={yesterday ? `Copy yesterday: ${yesterday.count} items, ${yesterday.kcal} kilocalories` : 'Copy yesterday (nothing logged yesterday)'}>
          {yesterday ? `Copy yesterday · ${yesterday.count} item${yesterday.count === 1 ? '' : 's'} · ${yesterday.kcal.toLocaleString()} kcal` : 'Copy yesterday'}
        </button>
        <button type="button" aria-pressed={open} onClick={() => { setOpen(o => !o); setError(''); }} style={btn}>Quick add</button>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input aria-label="Calories" inputMode="numeric" placeholder="kcal" value={kcal} onChange={e => setKcal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add(); }} style={{ ...field, width: 96 }} autoFocus />
            <input aria-label="Protein in grams (optional)" inputMode="decimal" placeholder="protein g" value={protein} onChange={e => setProtein(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add(); }} style={{ ...field, width: 108 }} />
            <input aria-label="Name (optional)" placeholder="name (optional)" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add(); }} style={{ ...field, flex: 1 }} />
          </div>
          {error && <div role="alert" style={{ fontSize: 12.5, color: '#e25d7a' }}>{error}</div>}
          <button type="button" onClick={add} disabled={busy} style={{ ...btn, background: 'var(--tab-accent)', color: 'var(--on-tab-accent)', border: 'none', fontWeight: 600 }}>Add</button>
        </div>
      )}
    </div>
  );
}
