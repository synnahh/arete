// Suggest exercises for push / pull / legs from the equipment you have and your
// Coach goal. Shows the picks first; only the ones you don't already have are
// added, and only when you tap Add. Rules: src/domain/exercisePick.js.
import { useMemo, useState } from 'react';
import { PRESETS, suggestLibrary, freshEntries, styleFor } from '../domain/exercisePick.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';

const label = { fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)' };
const chip = (on) => ({
  minHeight: 36, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 600 : 500,
  border: `0.5px solid ${on ? 'var(--accent)' : 'var(--card-border)'}`, background: on ? 'var(--active-bg)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-secondary)',
});

export default function ExerciseSuggest({ exercises, saveExercises }) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState('gym');
  const goal = styleFor(storage.get(STORAGE_KEYS.SETTINGS, {})?.coachGoal?.template);
  const picks = useMemo(() => suggestLibrary(PRESETS[preset].equipment, goal), [preset, goal]);
  const fresh = useMemo(() => freshEntries(Object.values(picks).flat(), exercises), [picks, exercises]);
  const isFresh = (e) => fresh.some(f => f.name === e.name);

  async function add() {
    if (!fresh.length) return;
    await saveExercises([...exercises, ...fresh]);
    setOpen(false);
  }

  return (
    <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} style={{ ...label, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', minHeight: 28 }}>
        Suggest exercises {open ? '▾' : '▸'}
      </button>
      {open && (
        <>
          <div role="group" aria-label="Equipment" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(PRESETS).map(([k, p]) => <button key={k} type="button" aria-pressed={preset === k} onClick={() => setPreset(k)} style={chip(preset === k)}>{p.label}</button>)}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Picked for a <strong>{goal}</strong> focus{goal === 'strength' ? ': fewer, heavier lifts' : ': compounds first, then isolation'}. Change the goal in Coach.
          </div>
          {['push', 'pull', 'legs'].map(day => (
            <div key={day}>
              <div style={{ ...label, marginBottom: 4 }}>{day}</div>
              {picks[day].length === 0 ? <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nothing fits this equipment.</div> : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {picks[day].map(e => (
                    <li key={e.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, color: isFresh(e) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      <span>{e.name}{isFresh(e) ? '' : ' (in your library)'}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.repsMin}–{e.repsMax} reps</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Starting weights are cautious. Adjust them to what you can do with good form.</div>
          <div>
            <button type="button" onClick={add} disabled={!fresh.length} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', cursor: fresh.length ? 'pointer' : 'default', opacity: fresh.length ? 1 : 0.5, fontWeight: 600, fontSize: 13, background: 'var(--accent)', color: '#fff' }}>
              {fresh.length ? `Add ${fresh.length} to library` : 'All already in your library'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
