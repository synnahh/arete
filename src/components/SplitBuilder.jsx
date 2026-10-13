// SplitBuilder — build your own training week. Every day is yours to name, switch
// between workout and rest, and fill with exercises from your library, in the
// order you want. Programs can be renamed, copied and deleted (any of them, with
// Undo). The volume panel shows what the plan trains per muscle each week against
// what you really logged. Rules: src/domain/splits.js.
import { useEffect, useMemo, useState } from 'react';
import {
  WEEK, WEEK_LABEL, TEMPLATES, isRest, dayExercises, addToDay, removeFromDay, moveInDay, setDayKind, materialize,
  buildFromTemplate, plannedSets, doneSets, volumeRows, dayKeyFromDate, SETS_BAND, templatesFor,
  dayTarget, setDayTarget, moveDay, copyDay, trainingDays,
} from '../domain/splits.js';
import { EXPERIENCE } from '../domain/intake.js';
import SplitCoverage from './SplitCoverage.jsx';
import GuideSplit from './GuideSplit.jsx';
import { swapOptions, swapInDay, dayMuscles } from '../domain/splitCoach.js';
import { searchExercises } from '../domain/exerciseDb.js';
import { freshEntries } from '../domain/exercisePick.js';
import { toLibraryEntry } from '../domain/exerciseDb.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { label } from './ui.js';

const card = { padding: 16, borderRadius: 14, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 };
const btn = (primary) => ({ minHeight: 36, padding: '0 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, border: primary ? 'none' : '0.5px solid var(--card-border)', background: primary ? 'var(--accent)' : 'transparent', color: primary ? '#fff' : 'var(--text-primary)' });
const field = { minHeight: 38, borderRadius: 10, padding: '0 12px', border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' };
const toast = (message, undo) => window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type: 'success', undo } }));
const STATUS = { none: ['Not planned', 'var(--text-secondary)'], low: ['Low', '#e8a13a'], ok: ['In range', '#4caf7d'], high: ['High', '#e25d7a'] };

// One sets / reps box. Keeps what you are typing as typed and saves when you leave the box (or press
// Enter), so "10" in Max is never judged against Min after only the "1" has been typed.
function TargetInput({ value, label: ariaLabel, title, onCommit }) {
  const stored = value ?? '';
  const [text, setText] = useState(String(stored));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(String(stored)); }, [stored, focused]);
  const commit = () => { setFocused(false); if (text !== String(stored)) onCommit(text); };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 10.5, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{title}</span>
      <input type="text" inputMode="numeric" pattern="[0-9]*" aria-label={ariaLabel} value={text}
        onFocus={e => { setFocused(true); e.target.select(); }}
        onChange={e => setText(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        style={{ ...field, width: 56, minHeight: 34, padding: '0 6px', textAlign: 'center', fontSize: 14 }} />
    </label>
  );
}

export default function SplitBuilder({ programs, addProgram, updateProgram, removeProgram, exercises, workoutLogs = [], saveExercises = null }) {
  const [viewId, setViewId] = useState(null);   // the program being edited (any of them, not only the active one)
  const active = programs.find(p => p.id === viewId) ?? programs.find(p => p.isActive) ?? programs[0] ?? null;
  const todayKey = dayKeyFromDate();
  const [editing, setEditing] = useState(null);
  const [naming, setNaming] = useState(null);       // program id being renamed
  const [draftName, setDraftName] = useState('');
  const [creating, setCreating] = useState(false);
  const [template, setTemplate] = useState('ppl');
  const [newName, setNewName] = useState('');
  const [pick, setPick] = useState('');
  const [q, setQ] = useState('');                // search the exercise database from inside a day
  const [level, setLevel] = useState(null);    // experience filter for starting weeks
  const [maxDays, setMaxDays] = useState(null);

  const planned = useMemo(() => plannedSets(active, exercises), [active, exercises]);
  const done = useMemo(() => doneSets(workoutLogs, toLocalDateKey(new Date())), [workoutLogs]);
  const rows = useMemo(() => volumeRows(planned, done), [planned, done]);

  // Open on a training day (today if it is one) so the week is editable at once, not behind a tap.
  useEffect(() => {
    if (!active || editing) return;
    const trains = (k) => !isRest(active.days?.[k] ?? { splitType: 'rest' });
    const first = trains(todayKey) ? todayKey : WEEK.find(trains);
    if (first) setEditing(first);
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const choices = useMemo(() => templatesFor({ experience: level, days: maxDays }), [level, maxDays]);
  useEffect(() => { if (!choices.includes(template)) setTemplate(choices[0] || 'blank'); }, [choices, template]);

  const makeActive = async (id) => { for (const p of programs) if (p.isActive !== (p.id === id)) await updateProgram(p.id, { isActive: p.id === id }); };

  const create = async () => {
    const { days, missing } = buildFromTemplate(template, exercises);
    const name = newName.trim() || TEMPLATES[template].label;
    const id = await addProgram({ name, isActive: programs.length === 0, days, pinnedExercises: {} });
    setCreating(false); setNewName('');
    if (id) setEditing(null);
    if (missing.length) toast(`${name} created. Your library has no ${missing.join(', ')} exercise yet. Add some in Exercises.`);
  };

  const duplicate = async (p) => { const { id: _i, isActive: _a, ...rest } = p; await addProgram({ ...rest, name: `${p.name} copy`, isActive: false }); };

  const remove = async (p) => {
    const { id: _i, ...rest } = p;
    await removeProgram(p.id);
    if (p.isActive) { const next = programs.find(x => x.id !== p.id); if (next) await updateProgram(next.id, { isActive: true }); }
    toast(`Deleted ${p.name}`, () => addProgram({ ...rest, isActive: p.isActive && programs.length === 1 }));
  };

  const commitRename = async (p) => {
    const name = draftName.trim();
    setNaming(null);
    if (name && name !== p.name) await updateProgram(p.id, { name });
  };

  const saveDay = (key, day) => active && updateProgram(active.id, { days: { ...active.days, [key]: day } });
  const day = editing && active ? (active.days?.[editing] ?? { splitType: 'rest', label: 'Rest' }) : null;
  const inDay = day ? dayExercises(day, exercises) : [];
  const available = day ? exercises.filter(e => !inDay.some(x => x.id === e.id)) : [];
  const dbResults = q.trim().length >= 2 ? searchExercises(q, { limit: 6 }) : [];

  const addFromDb = async (ex) => {
    const mine = exercises.find(e => String(e.name).trim().toLowerCase() === ex.name.toLowerCase());
    let lib = exercises, id = mine?.id;
    if (!mine) {
      const entry = freshEntries([toLibraryEntry(ex)], exercises)[0];
      lib = [...exercises, entry]; id = entry.id;
      await saveExercises(lib);
    }
    if (day && !inDay.some(e => e.id === id)) saveDay(editing, addToDay(day, lib, id));
    setQ('');
  };
  const moveTo = (to) => { if (!to) return; updateProgram(active.id, { days: moveDay(active.days, editing, to) }); setEditing(to); };
  const copyTo = (to) => { if (!to) return; updateProgram(active.id, { days: copyDay(active.days, editing, to) }); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px clamp(14px, 3vw, 28px) 32px', maxWidth: 980, margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto', height: '100%' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>Your split</h1>

      <GuideSplit programs={programs} exercises={exercises} saveExercises={saveExercises} addProgram={addProgram} updateProgram={updateProgram} />

      <section style={card} aria-label="Programs">
        <div style={label}>Programs</div>
        {programs.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>You have no program. Make one below, or leave it empty: Train still works from your Exercise Library.</div>}
        {[...programs].sort((a, b) => Number(!!b.favourite) - Number(!!a.favourite)).map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 10, border: `0.5px solid ${p.isActive ? 'var(--accent)' : 'var(--card-border)'}` }}>
            {naming === p.id
              ? <input autoFocus value={draftName} onChange={e => setDraftName(e.target.value)} onBlur={() => commitRename(p)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setNaming(null); }} aria-label="Program name" style={{ ...field, flex: 1, minWidth: 120 }} />
              : <button type="button" onClick={() => { setNaming(p.id); setDraftName(p.name); }} title="Rename" style={{ flex: 1, minWidth: 120, textAlign: 'left', background: 'none', border: 'none', cursor: 'text', fontFamily: 'inherit', fontSize: 14, fontWeight: p.isActive ? 700 : 500, color: p.isActive ? 'var(--accent)' : 'var(--text-primary)', padding: 0 }}>{p.name}</button>}
            <button type="button" aria-pressed={!!p.favourite} aria-label={p.favourite ? `Unstar ${p.name}` : `Star ${p.name}`} onClick={() => updateProgram(p.id, { favourite: !p.favourite })} style={{ width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: p.favourite ? '#e8a13a' : 'var(--text-secondary)' }}>{p.favourite ? '★' : '☆'}</button>
            {p.isActive ? <span style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--accent)' }}>ACTIVE</span> : <button type="button" onClick={() => makeActive(p.id)} style={btn(false)}>Make active</button>}
            {active?.id === p.id ? <span style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>EDITING</span> : <button type="button" onClick={() => { setViewId(p.id); setEditing(null); }} style={btn(false)}>Edit</button>}
            <button type="button" onClick={() => duplicate(p)} style={btn(false)}>Copy</button>
            <button type="button" onClick={() => remove(p)} aria-label={`Delete ${p.name}`} style={{ ...btn(false), color: '#e25d7a', borderColor: 'rgba(226,93,122,0.4)' }}>Delete</button>
          </div>
        ))}
        {!creating
          ? <div><button type="button" onClick={() => setCreating(true)} style={btn(true)}>New program</button></div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8, borderTop: '0.5px solid var(--card-border)' }}>
              <div style={label}>Start from</div>
              <div role="group" aria-label="Filter by experience" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Suits</span>
                {[[null, 'Anyone'], ...Object.entries(EXPERIENCE).map(([id, e]) => [id, e.label])].map(([id, text]) => (
                  <button key={String(id)} type="button" aria-pressed={level === id} onClick={() => setLevel(id)} style={{ ...btn(false), minHeight: 32, fontSize: 12.5, borderColor: level === id ? 'var(--accent)' : undefined, color: level === id ? 'var(--accent)' : undefined }}>{text}</button>
                ))}
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginLeft: 6 }}>Days</span>
                {[null, 3, 4, 5, 6].map(n => (
                  <button key={String(n)} type="button" aria-pressed={maxDays === n} onClick={() => setMaxDays(n)} style={{ ...btn(false), minHeight: 32, minWidth: 40, padding: '0 10px', fontSize: 12.5, borderColor: maxDays === n ? 'var(--accent)' : undefined, color: maxDays === n ? 'var(--accent)' : undefined }}>{n ?? 'Any'}</button>
                ))}
              </div>
              <div role="group" aria-label="Template" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {choices.map(id => {
                  const t = TEMPLATES[id];
                  return <button key={id} type="button" aria-pressed={template === id} onClick={() => setTemplate(id)} style={{ ...btn(false), borderColor: template === id ? 'var(--accent)' : undefined, color: template === id ? 'var(--accent)' : undefined }}>{t.label}{t.trainDays ? ' - ' + t.trainDays + ' days' : ''}</button>;
                })}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{TEMPLATES[template].note}{TEMPLATES[template].levels.length < 3 ? ` Best for ${TEMPLATES[template].levels.join(' and ')}.` : ''} The days are filled from the exercises in your library, and every day stays editable.</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={TEMPLATES[template].label} aria-label="New program name" style={{ ...field, flex: 1, minWidth: 160 }} onKeyDown={e => e.key === 'Enter' && create()} />
                <button type="button" onClick={create} style={btn(true)}>Create</button>
                <button type="button" onClick={() => setCreating(false)} style={btn(false)}>Cancel</button>
              </div>
            </div>
          )}
      </section>

      {active && (
        <>
          <section style={card} aria-label="Week">
            <div style={label}>{active.name}: your week · {trainingDays(active)} training day{trainingDays(active) === 1 ? '' : 's'}{active.isActive ? '' : ' · not active'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8 }}>
              {WEEK.map(k => {
                const d = active.days?.[k] ?? { splitType: 'rest', label: 'Rest' };
                const n = dayExercises(d, exercises).length;
                const on = editing === k;
                return (
                  <button key={k} type="button" aria-pressed={on} onClick={() => setEditing(on ? null : k)}
                    style={{ textAlign: 'left', padding: '10px 10px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', minHeight: 74,
                      border: `${k === todayKey ? 1.5 : 0.5}px solid ${on ? 'var(--accent)' : k === todayKey ? 'var(--tab-accent)' : 'var(--card-border)'}`,
                      background: isRest(d) ? 'transparent' : 'color-mix(in srgb, var(--tab-accent) 10%, transparent)', color: 'var(--text-primary)' }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>{WEEK_LABEL[k].toUpperCase()}{k === todayKey ? ' · TODAY' : ''}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isRest(d) ? 'Rest' : (d.label || 'Workout')}</div>
                    {!isRest(d) && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{n} exercise{n === 1 ? '' : 's'}</div>}
                  </button>
                );
              })}
            </div>
          </section>

          {editing && day && (
            <section style={card} aria-label={`Edit ${WEEK_LABEL[editing]}`}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <button type="button" onClick={() => setEditing(WEEK[(WEEK.indexOf(editing) + WEEK.length - 1) % WEEK.length])} aria-label="Previous day" style={{ ...btn(false), minWidth: 40, padding: 0 }}>‹</button>
                <div style={label}>{WEEK_LABEL[editing]}</div>
                <button type="button" onClick={() => setEditing(WEEK[(WEEK.indexOf(editing) + 1) % WEEK.length])} aria-label="Next day" style={{ ...btn(false), minWidth: 40, padding: 0 }}>›</button>
              </div>
              <div role="group" aria-label="Day type" style={{ display: 'flex', gap: 6 }}>
                <button type="button" aria-pressed={!isRest(day)} onClick={() => saveDay(editing, setDayKind(materialize(day, exercises), true, day.label === 'Rest' ? 'Workout' : day.label))} style={{ ...btn(false), borderColor: !isRest(day) ? 'var(--accent)' : undefined, color: !isRest(day) ? 'var(--accent)' : undefined }}>Workout</button>
                <button type="button" aria-pressed={isRest(day)} onClick={() => saveDay(editing, setDayKind(day, false))} style={{ ...btn(false), borderColor: isRest(day) ? 'var(--accent)' : undefined, color: isRest(day) ? 'var(--accent)' : undefined }}>Rest</button>
              </div>
              {!isRest(day) && (
                <>
                  <input value={day.label ?? ''} onChange={e => saveDay(editing, { ...materialize(day, exercises), label: e.target.value })} placeholder="Name, e.g. Upper body" aria-label="Day name" style={field} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select aria-label="Move this day to" value="" onChange={e => moveTo(e.target.value)} style={{ ...field, flex: 1, minWidth: 130, minHeight: 40 }}>
                      <option value="">Move this day to…</option>
                      {WEEK.filter(k => k !== editing).map(k => <option key={k} value={k}>{WEEK_LABEL[k]}{isRest(active.days?.[k]) ? ' (rest day)' : ' (swap with it)'}</option>)}
                    </select>
                    <select aria-label="Copy this day to" value="" onChange={e => copyTo(e.target.value)} style={{ ...field, flex: 1, minWidth: 130, minHeight: 40 }}>
                      <option value="">Copy this day to…</option>
                      {WEEK.filter(k => k !== editing).map(k => <option key={k} value={k}>{WEEK_LABEL[k]}{isRest(active.days?.[k]) ? '' : ' (replaces it)'}</option>)}
                    </select>
                  </div>
                  {inDay.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Hits: {dayMuscles(day, exercises).join(' · ')}. Set the sets and the rep range (min to max) for each exercise.</div>}
                  {inDay.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No exercises yet. Add some from your library below.</div>}
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {inDay.map((ex, i) => (
                      <li key={ex.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, padding: '6px 10px', borderRadius: 10, border: '0.5px solid var(--card-border)' }}>
                        <span style={{ flex: '1 1 160px', minWidth: 0, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</span>
                        {[['sets', 'Sets', 'sets'], ['repsMin', 'Min', 'min reps'], ['repsMax', 'Max', 'max reps']].map(([k, title, aria]) => (
                          <TargetInput key={k} title={title} label={`${ex.name} ${aria}`} value={dayTarget(day, ex.id)[k]}
                            onCommit={(v) => saveDay(editing, setDayTarget(materialize(day, exercises), ex.id, { [k]: v }))} />
                        ))}
                        {saveExercises && (() => {
                          const o = swapOptions(ex, day, exercises);
                          if (!o.guide.length && !o.sameMuscle.length) return null;
                          return (
                            <select aria-label={`Swap ${ex.name}`} value="" onChange={async (e) => {
                              const r = swapInDay(day, ex.id, e.target.value, exercises);
                              if (!r) return;
                              if (r.entry) await saveExercises([...exercises, r.entry]);
                              saveDay(editing, r.day);
                            }} style={{ ...field, width: 96, minHeight: 34, padding: '0 6px', fontSize: 13 }}>
                              <option value="">Swap…</option>
                              {o.guide.length > 0 && <optgroup label="Your guide's option">{o.guide.map(n => <option key={n} value={n}>{n}</option>)}</optgroup>}
                              {o.sameMuscle.length > 0 && <optgroup label="Same muscle">{o.sameMuscle.map(n => <option key={n} value={n}>{n}</option>)}</optgroup>}
                            </select>
                          );
                        })()}
                        <button type="button" aria-label={`Move ${ex.name} up`} disabled={i === 0} onClick={() => saveDay(editing, moveInDay(day, exercises, ex.id, -1))} style={{ ...btn(false), minWidth: 36, padding: 0, opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                        <button type="button" aria-label={`Move ${ex.name} down`} disabled={i === inDay.length - 1} onClick={() => saveDay(editing, moveInDay(day, exercises, ex.id, 1))} style={{ ...btn(false), minWidth: 36, padding: 0, opacity: i === inDay.length - 1 ? 0.4 : 1 }}>↓</button>
                        <button type="button" aria-label={`Remove ${ex.name}`} onClick={() => saveDay(editing, removeFromDay(day, exercises, ex.id))} style={{ ...btn(false), minWidth: 36, padding: 0, color: '#e25d7a' }}>×</button>
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select value={pick} onChange={e => setPick(e.target.value)} aria-label="Add exercise" style={{ ...field, flex: 1 }}>
                      <option value="">{available.length ? 'Add an exercise…' : 'Your library has no more exercises'}</option>
                      {available.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    <button type="button" disabled={!pick} onClick={() => { saveDay(editing, addToDay(day, exercises, pick)); setPick(''); }} style={{ ...btn(true), opacity: pick ? 1 : 0.5 }}>Add</button>
                  </div>
                  {saveExercises ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Or search all exercises (e.g. shrug, split squat)" aria-label="Search the exercise database" style={field} />
                      {dbResults.map(ex => (
                        <button key={ex.id} type="button" onClick={() => addFromDb(ex)} style={{ ...btn(false), textAlign: 'left', minHeight: 40 }}>
                          Add {ex.name} <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>· {ex.muscle} · {ex.equipment}</span>
                        </button>
                      ))}
                      {q.trim().length >= 2 && dbResults.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Nothing in the database matches that.</div>}
                    </div>
                  ) : <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Need something else? Search the exercise database in Exercises and add it to your library, then pick it here.</div>}
                </>
              )}
            </section>
          )}

          {saveExercises && <SplitCoverage program={active} exercises={exercises} saveExercises={saveExercises} updateProgram={updateProgram} />}

          <section style={card} aria-label="Weekly volume">
            <div style={label}>Weekly sets per muscle</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Planned uses the sets you set on each exercise (3 where none is set). {SETS_BAND.low} to {SETS_BAND.high} hard sets a week per muscle is the usual range. "Done" is your last 7 days of logs.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rows.map(r => {
                const [text, colour] = STATUS[r.status];
                const pct = Math.min(100, Math.round((r.planned / (SETS_BAND.high + 5)) * 100));
                return (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 118px', gap: 10, alignItems: 'center', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-primary)' }}>{r.label}</span>
                    <span aria-hidden="true" style={{ height: 6, borderRadius: 999, background: 'var(--hover-bg)', overflow: 'hidden', position: 'relative' }}>
                      <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: colour }} />
                    </span>
                    <span className="val-num" style={{ color: colour, textAlign: 'right' }}>{r.planned} · {text}{r.done ? ` · did ${r.done}` : ''}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
