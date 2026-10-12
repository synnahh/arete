// SplitCoverage — "Muscles hit": every muscle group against the weekly sets your guide asks for,
// and one-tap fills for any that are short. Fills are suggestions you tick, shown with the day and
// sets they would go on; the ones for forearms, traps and abs are Arete's own addition (they are
// not in your guide's table) and say so. Nothing changes until you tap Add. Rules: domain/splitCoach.js.
import { useMemo, useState } from 'react';
import { label } from './ui.js';
import { coverage, suggestFills, applyFills, TARGETS } from '../domain/splitCoach.js';

const card = { padding: 16, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 };
const btn = { minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--bg-base)', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
const small = { fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 };
const COLOUR = { ok: '#4caf7d', low: '#e8a13a', none: '#e25d7a' };
const WORD = { ok: 'covered', low: 'a little short', none: 'not trained' };

export default function SplitCoverage({ program, exercises, saveExercises, updateProgram }) {
  const rows = useMemo(() => coverage(program, exercises), [program, exercises]);
  const fills = useMemo(() => suggestFills(program, exercises), [program, exercises]);
  const [skipped, setSkipped] = useState({});      // fill id -> true when unticked
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const chosen = fills.filter(f => !skipped[f.id]);
  const short = rows.filter(r => r.status !== 'ok');

  const apply = async () => {
    if (!chosen.length || busy) return;
    setBusy(true); setMessage('');
    try {
      const { days, newEntries } = applyFills(program, exercises, chosen);
      if (newEntries.length) await saveExercises([...exercises, ...newEntries]);
      await updateProgram(program.id, { days });
      setMessage(`Added ${chosen.length} exercise${chosen.length === 1 ? '' : 's'} to ${program.name}.`);
      setSkipped({});
    } finally { setBusy(false); }
  };

  return (
    <section style={card} aria-label="Muscles hit">
      <div style={label}>Muscles hit · {program.name}</div>
      <div style={small}>
        {short.length === 0 ? 'Every muscle group is covered this week.' : `${short.length} muscle group${short.length === 1 ? ' is' : 's are'} short this week.`}
        {' '}Sets count fully for the main muscle and half for helpers. Targets are your guide's weekly numbers; forearms, traps and abs are Arete's own (marked +).
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(r => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(96px, 1fr) 2fr minmax(104px, auto)', gap: 10, alignItems: 'center', fontSize: 13 }}>
            <span style={{ color: 'var(--text-primary)' }}>{r.label}{TARGETS[r.id].from === 'added' ? ' +' : ''}</span>
            <span aria-hidden="true" style={{ height: 6, borderRadius: 999, background: 'var(--hover-bg)', overflow: 'hidden', position: 'relative' }}>
              <span style={{ display: 'block', height: '100%', width: `${Math.min(100, Math.round((r.total / (r.target * 1.5)) * 100))}%`, background: COLOUR[r.status] }} />
            </span>
            <span className="val-num" style={{ color: COLOUR[r.status], textAlign: 'right' }}>{r.total} of {r.target} · {WORD[r.status]}</span>
          </div>
        ))}
      </div>

      {fills.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '0.5px solid var(--card-border)' }}>
          <div style={label}>Fill the gaps</div>
          {fills.map(f => (
            <label key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={!skipped[f.id]} onChange={e => setSkipped(s => ({ ...s, [f.id]: !e.target.checked }))} style={{ marginTop: 3, width: 18, height: 18 }} />
              <span>
                <strong>{f.name}</strong> {f.sets} × {f.repsMin}–{f.repsMax} on {f.dayLabel}
                <span style={{ ...small, display: 'block' }}>{f.label}{TARGETS[f.group].from === 'added' ? ': not in your guide, added by Arete' : ': brings you up to your guide\'s weekly target'}</span>
              </span>
            </label>
          ))}
          <div><button type="button" onClick={apply} disabled={!chosen.length || busy} style={{ ...btn, opacity: chosen.length ? 1 : 0.5 }}>{busy ? 'Adding…' : `Add ${chosen.length} to my split`}</button></div>
          <div style={small}>Nothing here is overhead pressing, upright rows or anything else hard on your right shoulder. You can still remove or swap any of it afterwards.</div>
        </div>
      )}
      {message && <div role="status" style={{ fontSize: 13.5, color: '#4caf7d' }}>{message}</div>}
    </section>
  );
}
