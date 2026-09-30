// Starter routines in three tiers (Essential / Complete / Power), tuned to the
// skin profile. Shows the steps first; nothing is added until you tap Add, and
// steps you already have are skipped. Rules: src/domain/skinTiers.js.
import { useMemo, useState } from 'react';
import { TIERS, TIER_LABEL, TIER_BLURB, suggestRoutine, newSteps, tierWarnings } from '../domain/skinTiers.js';
import { WHEN_LABEL } from '../domain/skin.js';
import { label } from './ui.js';

const chip = (on) => ({
  minHeight: 40, padding: '0 16px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, WebkitTapHighlightColor: 'transparent',
  border: `0.5px solid ${on ? 'var(--tab-accent)' : 'var(--card-border)'}`, fontWeight: on ? 600 : 500,
  background: on ? 'color-mix(in srgb, var(--tab-accent) 14%, transparent)' : 'transparent', color: on ? 'var(--tab-accent)' : 'var(--text-secondary)',
});
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const daysText = (d) => (d.length === 7 ? 'daily' : d.map(i => DAY[i]).join(', '));

export default function SkinTiers({ steps, skinProfile = {}, onAdd }) {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState('essential');
  const [busy, setBusy] = useState(false);
  const suggested = useMemo(() => suggestRoutine(tier, skinProfile), [tier, skinProfile]);
  const fresh = useMemo(() => newSteps(suggested, steps), [suggested, steps]);
  const warnings = useMemo(() => tierWarnings(fresh, steps), [fresh, steps]);

  async function add() {
    if (busy || !fresh.length) return;
    setBusy(true);
    try { await onAdd(fresh); setOpen(false); } finally { setBusy(false); }
  }

  return (
    <div style={{ padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} style={{ ...label, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', minHeight: 32 }}>
        Suggest a routine {open ? '▾' : '▸'}
      </button>
      {open && (
        <>
          <div role="group" aria-label="Routine tier" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TIERS.map(t => <button key={t} type="button" aria-pressed={tier === t} onClick={() => setTier(t)} style={chip(tier === t)}>{TIER_LABEL[t]}</button>)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {TIER_BLURB[tier]}{skinProfile.type || skinProfile.concerns?.length ? ' Tuned to your skin profile.' : ' Set your skin type and concerns in Check a product to tune it.'}
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {suggested.map(s => {
              const have = !fresh.includes(s);
              return (
                <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, color: have ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                  <span>{s.name}{have ? ' (already in your routine)' : ''}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>{WHEN_LABEL[s.when]} · {daysText(s.days)}</span>
                </li>
              );
            })}
          </ul>
          {warnings.map(w => <div key={w.text} role="status" style={{ fontSize: 13, color: '#e8a13a' }}>{w.text}</div>)}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>General starting points, not medical advice. Swap in real products with Check a product, and add new actives slowly.</div>
          <div>
            <button type="button" onClick={add} disabled={busy || !fresh.length} style={{ minHeight: 44, padding: '0 16px', borderRadius: 12, border: 'none', cursor: fresh.length ? 'pointer' : 'default', opacity: fresh.length ? 1 : 0.5, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, background: 'var(--tab-accent)', color: 'var(--on-tab-accent)' }}>
              {fresh.length ? `Add ${fresh.length} step${fresh.length === 1 ? '' : 's'}` : 'Nothing new to add'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
