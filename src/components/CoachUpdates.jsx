// Coach updates: what the coach changed in your plan and why, with Undo, plus the
// bigger changes waiting for your OK. Rules: domain/coachEngine.js; runner:
// hooks/useCoachEngine.js. On Home it hides when there is nothing to show; on Goal
// HQ (`always`) it explains what the coach watches.
import { useState } from 'react';
import { useCoachEngine } from '../hooks/useCoachEngine.js';
import { label } from './ui.js';

const RECENT_DAYS = 14;
const btn = (primary) => ({
  minHeight: 36, padding: '0 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: primary ? 600 : 500,
  border: primary ? 'none' : '0.5px solid var(--card-border)',
  background: primary ? 'var(--tab-accent, var(--accent))' : 'transparent', color: primary ? 'var(--on-tab-accent, #fff)' : 'var(--text-primary)',
});
const when = (iso) => {
  const d = Math.round((Date.now() - Date.parse(iso)) / 86400000);
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
};

export default function CoachUpdates({ compact = false, always = false }) {
  const { pending, log, applyAsk, dismiss, undo, undoable } = useCoachEngine();
  const [busy, setBusy] = useState(null);
  const recent = log.filter(e => (e.status === 'applied' || e.status === 'undone') && Date.now() - Date.parse(e.at) < RECENT_DAYS * 86400000).slice(0, 4);

  if (!always && !pending.length && !recent.length) return null;
  const card = { padding: compact ? 14 : 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 };
  const run = async (key, fn) => { setBusy(key); try { await fn(); } finally { setBusy(null); } };

  return (
    <section aria-label="Coach updates" style={card}>
      <div style={label}>Coach updates</div>

      {pending.map(u => (
        <div key={u.key} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, border: '0.5px solid var(--tab-accent, var(--accent))', background: 'color-mix(in srgb, var(--tab-accent, var(--accent)) 7%, transparent)' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{u.title}</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{u.why}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={busy === u.key} onClick={() => run(u.key, () => applyAsk(u))} style={btn(true)}>Apply</button>
            <button type="button" disabled={busy === u.key} onClick={() => dismiss(u)} style={btn(false)}>Not now</button>
          </div>
        </div>
      ))}

      {recent.map((e, i) => (
        <div key={e.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingTop: i || pending.length ? 10 : 0, borderTop: i || pending.length ? '0.5px solid var(--card-border)' : 'none' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: e.status === 'undone' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: e.status === 'undone' ? 'line-through' : 'none' }}>{e.title}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{e.status === 'undone' ? 'Undone' : when(e.at)}</span>
            </div>
            {e.status !== 'undone' && <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: 2 }}>{e.why}</div>}
          </div>
          {undoable(e) && <button type="button" disabled={busy === e.id} onClick={() => run(e.id, () => undo(e))} style={{ ...btn(false), flexShrink: 0 }}>Undo</button>}
        </div>
      ))}

      {!pending.length && !recent.length && (
        <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
          Nothing to change right now. The coach watches your weigh-ins, food and training and adjusts your targets when the data shows they're off: your real maintenance after two weeks, protein and fat as your weight moves, and your split if you're training fewer days than planned. Each change shows here with the reason and an Undo.
        </div>
      )}
    </section>
  );
}
