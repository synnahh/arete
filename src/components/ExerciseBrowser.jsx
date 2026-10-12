// Search the exercise database (domain/exerciseDb.js) and add single exercises to
// the Exercise Library. Filters by muscle and equipment; shows a form cue per move.
import { useMemo, useState } from 'react';
import { searchExercises, DB_MUSCLES, DB_EQUIPMENT, toLibraryEntry } from '../domain/exerciseDb.js';
import { freshEntries } from '../domain/exercisePick.js';
import { label } from './ui.js';
import ExerciseDemo from './ExerciseDemo.jsx';

const chip = (on) => ({
  minHeight: 32, padding: '0 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 600 : 500, textTransform: 'capitalize',
  border: `0.5px solid ${on ? 'var(--accent)' : 'var(--card-border)'}`, background: on ? 'var(--active-bg)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-secondary)',
});

export default function ExerciseBrowser({ exercises, saveExercises }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [added, setAdded] = useState(null);
  const [demoId, setDemoId] = useState(null);

  const results = useMemo(() => (open ? searchExercises(q, { muscle, equipment, limit: 30 }) : []), [open, q, muscle, equipment]);
  const have = useMemo(() => new Set(exercises.map(e => String(e.name).trim().toLowerCase())), [exercises]);

  async function add(ex) {
    const [entry] = freshEntries([toLibraryEntry(ex)], exercises);
    if (!entry) return;
    await saveExercises([...exercises, entry]);
    setAdded(ex.name);
  }

  return (
    <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} style={{ ...label, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', minHeight: 28 }}>
        Exercise database {open ? '▾' : '▸'}
      </button>
      {open && (
        <>
          <input
            type="search" value={q} onChange={e => { setQ(e.target.value); setAdded(null); }} placeholder="Search 120+ exercises, e.g. incline press"
            aria-label="Search exercises"
            style={{ minHeight: 40, borderRadius: 10, padding: '0 12px', border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit' }}
          />
          <div role="group" aria-label="Muscle" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DB_MUSCLES.map(m => <button key={m} type="button" aria-pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)} style={chip(muscle === m)}>{m}</button>)}
          </div>
          <div role="group" aria-label="Equipment" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DB_EQUIPMENT.map(e => <button key={e} type="button" aria-pressed={equipment === e} onClick={() => setEquipment(equipment === e ? null : e)} style={chip(equipment === e)}>{e}</button>)}
          </div>
          {added && <div role="status" style={{ fontSize: 12.5, color: 'var(--accent)' }}>{added} added to your library.</div>}
          {results.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No exercise matches. Try fewer words.</div> : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map(ex => {
                const owned = have.has(ex.name.toLowerCase());
                return (
                  <li key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', paddingBottom: 8, borderBottom: '0.5px solid var(--card-border)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{ex.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {ex.muscle}{ex.helpers.length ? ` + ${ex.helpers.join(', ')}` : ''} · {ex.equipment} · {ex.kind}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{ex.cue}</div>
                      <button type="button" aria-expanded={demoId === ex.id} onClick={() => setDemoId(demoId === ex.id ? null : ex.id)} style={{ marginTop: 6, minHeight: 30, padding: '0 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)' }}>{demoId === ex.id ? 'Hide demo' : 'Demo'}</button>
                      {demoId === ex.id && <div style={{ marginTop: 8 }}><ExerciseDemo name={ex.name} /></div>}
                    </div>
                    <button type="button" disabled={owned} onClick={() => add(ex)} style={{ flexShrink: 0, minHeight: 34, padding: '0 12px', borderRadius: 10, border: 'none', cursor: owned ? 'default' : 'pointer', opacity: owned ? 0.5 : 1, fontWeight: 600, fontSize: 12.5, background: 'var(--accent)', color: '#fff' }}>
                      {owned ? 'In library' : 'Add'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
