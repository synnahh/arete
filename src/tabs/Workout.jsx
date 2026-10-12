// ─── Workout Tab ──────────────────────────────────────────────────────────────
// Sub-sections: Overload Coach · Exercises · Split Planner
// All data via Firebase — workout_logs collection + meta docs for library/program

import { Icon } from '../components/icons.jsx';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument }   from '../supabase/useDocument.js';
import { STORAGE_KEYS }  from '../utils/storage.js';
import { anteriorData, posteriorData } from '../components/bodyModel.js';
import { toLocalDateKey } from '../utils/localDate.js';
import TrainSession from './TrainSession.jsx';
import { suggestNext } from '../domain/progression.js';
import SplitBuilder from '../components/SplitBuilder.jsx';
import { EXERCISE_MUSCLES, MUSCLE_MAP, musclesForLog as getLogMuscles, musclesForExercise } from '../domain/muscles.js';
import ExerciseSuggest from '../components/ExerciseSuggest.jsx';
import ExerciseBrowser from '../components/ExerciseBrowser.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────
const todayStr = () => toLocalDateKey(new Date());
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };
const SPLIT_COLOURS = { push: '#e25d7a', pull: '#4a9eff', legs: '#f4a642', rest: 'rgba(255,255,255,0.2)', custom: '#9b5de5' };

// ── Shared style tokens ───────────────────────────────────────────────────────
const inputSx = {
  width: '100%', background: 'var(--input-bg)', border: '0.5px solid var(--input-border)',
  borderRadius: 7, padding: '7px 10px', fontSize: 12.5, color: 'var(--text-primary)',
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s ease',
};
const btnPrimary = {
  padding: '7px 16px', borderRadius: 8, border: '0.5px solid var(--card-border)',
  background: 'var(--active-bg)', color: 'var(--accent)', cursor: 'pointer',
  fontSize: 12, fontWeight: 500, transition: 'all 0.15s ease',
};
const btnGhost = {
  padding: '6px 14px', borderRadius: 8, border: '0.5px solid var(--card-border)',
  background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
  fontSize: 12, transition: 'all 0.15s ease',
};
const lblSx = {
  display: 'block', fontSize: 11, color: 'var(--text-muted)',
  letterSpacing: '0.06em', marginBottom: 4,
};

const GLASS = {
  background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '16px 18px', marginBottom: 10,
  backdropFilter: 'blur(24px)',
  boxShadow: '0 1px 0 0 rgba(255,255,255,0.07) inset, 0 12px 40px rgba(0,0,0,0.4)',
  position: 'relative', overflow: 'hidden',
};
function GlassCard({ children, style }) {
  return (
    <div style={{ ...GLASS, ...style }}>
      <div style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)', pointerEvents: 'none' }} />
      {children}
    </div>
  );
}
function GlassLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 18, height: 1, background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap' }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(255,255,255,0.1),transparent)' }} />
    </div>
  );
}
function Section({ title, children, action }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '18px 24px 12px', borderBottom: '0.5px solid var(--sidebar-divider)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', margin: 0, flex: 1 }}>{title}</h2>
        {action}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* Capped so cards and bars do not stretch across very wide windows. */}
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>{children}</div>
      </div>
    </div>
  );
}

// ── Default exercise library ───────────────────────────────────────────────────
export const DEFAULT_SPLITS = { push: 'Push', pull: 'Pull', legs: 'Legs' };

// ── Progression logic ────────────────────────────────────────────────────────
// Next-session target: the rules live in domain/progression.js (all working sets,
// no drop after one bad day, plateau deload, layoff restart).
export function computeProgression(ex, workoutLogs) {
  return suggestNext(ex, workoutLogs, toLocalDateKey(new Date()));
}

// ── Stepper ───────────────────────────────────────────────────────────────────
function Stepper({ value, onChange, min = 0, step = 1, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={lblSx}>{label}</span>}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button onClick={() => onChange(Math.max(min, parseFloat((value - step).toFixed(2))))}
          style={{ width: 40, height: 42, borderRadius: '8px 0 0 8px', border: '0.5px solid var(--card-border)', background: 'var(--card-fill)', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer' }}>−</button>
        <div style={{ flex: 1, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '0.5px solid var(--card-border)', borderLeft: 'none', borderRight: 'none', background: 'var(--input-bg)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', minWidth: 70 }}>
          {value}
        </div>
        <button onClick={() => onChange(parseFloat((value + step).toFixed(2)))}
          style={{ width: 40, height: 42, borderRadius: '0 8px 8px 0', border: '0.5px solid var(--card-border)', background: 'var(--card-fill)', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer' }}>+</button>
      </div>
    </div>
  );
}

// ── Toggle group ─────────────────────────────────────────────────────────────
function ToggleGroup({ label, options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
      {label && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', minWidth: 36, textTransform: 'uppercase' }}>{label}</span>}
      <div style={{ display: 'flex', flex: 1, borderRadius: 8, overflow: 'hidden', border: '0.5px solid var(--card-border)' }}>
        {options.map(o => (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            flex: 1, padding: '8px 0', border: 'none',
            background: value === o.value ? 'rgba(255,255,255,0.92)' : 'var(--card-fill)',
            color: value === o.value ? '#111' : 'var(--text-secondary)',
            fontWeight: value === o.value ? 600 : 400, fontSize: 12.5, cursor: 'pointer', transition: 'all 0.15s',
          }}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

// ── Add / Edit Exercise Modal ─────────────────────────────────────────────────
function ExerciseModal({ onClose, onSave, initial = null }) {
  const [name, setName]             = useState(initial?.name ?? '');
  const [gym, setGym]               = useState(initial?.gym ?? 'both');
  const [day, setDay]               = useState(initial?.day ?? 'push');
  const [bodyweight, setBodyweight] = useState(initial?.bodyweight ?? false);
  const [startWeight, setStartWeight] = useState(initial?.startingWeight ?? 20);
  const [repsMin, setRepsMin]       = useState(initial?.repsMin ?? 6);
  const [repsMax, setRepsMax]       = useState(initial?.repsMax ?? 10);
  const [increment, setIncrement]   = useState(initial?.increment ?? 2.5);

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id ?? Date.now().toString(),
      name: name.trim(), gym, day, bodyweight,
      startingWeight: startWeight, repsMin, repsMax, increment,
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
        borderRadius: 16, padding: '24px 22px', width: 340, maxHeight: '90vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {initial ? 'Edit exercise' : 'Add exercise'}
        </div>
        <div>
          <span style={lblSx}>NAME</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Incline DB Press"
            style={inputSx} onFocus={e => e.target.style.borderColor = 'var(--accent)'} onBlur={e => e.target.style.borderColor = 'var(--input-border)'} />
        </div>
        <ToggleGroup label="GYM" options={[{value:'home',label:'Home'},{value:'commercial',label:'Commercial'},{value:'both',label:'Both'}]} value={gym} onChange={setGym} />
        <ToggleGroup label="DAY" options={[{value:'push',label:'Push'},{value:'pull',label:'Pull'},{value:'legs',label:'Legs'}]} value={day} onChange={setDay} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={bodyweight} onChange={e => setBodyweight(e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--accent)' }} />
          Bodyweight (track reps only)
        </label>
        {!bodyweight && <Stepper label="STARTING WEIGHT (KG)" value={startWeight} onChange={setStartWeight} step={2.5} />}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Stepper label="REPS MIN" value={repsMin} onChange={setRepsMin} min={1} step={1} />
          <Stepper label="REPS MAX" value={repsMax} onChange={v => setRepsMax(Math.max(repsMin, v))} min={1} step={1} />
        </div>
        {!bodyweight && <Stepper label="INCREMENT (KG)" value={increment} onChange={setIncrement} step={0.5} />}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
          <button onClick={save} style={{ ...btnPrimary, flex: 1 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
// 1. OVERLOAD COACH
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
function OverloadCoach({ workoutLogs, addWorkoutLog, exercises, saveExercises, splitNames, saveSplitNames, todaySplitType }) {
  const [editingSplits, setEditingSplits] = useState(false);
  const [draftNames, setDraftNames]       = useState(splitNames);
  const [gym, setGym]                     = useState('home');
  const [day, setDay]                     = useState(() => todaySplitType && ['push','pull','legs'].includes(todaySplitType) ? todaySplitType : 'push');
  const [selectedId, setSelectedId]       = useState(null);
  const [weight, setWeight]               = useState(20);
  const [selectedReps, setSelectedReps]   = useState(null);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [showAdd, setShowAdd]             = useState(false);

  // Keep draft names in sync if splitNames prop updates (cross-device)
  useEffect(() => { setDraftNames(splitNames); }, [splitNames]);

  // Auto-select today's split when active program updates
  useEffect(() => {
    if (todaySplitType && ['push','pull','legs'].includes(todaySplitType)) setDay(todaySplitType);
  }, [todaySplitType]);

  const saveSplits = () => {
    const trimmed = { push: draftNames.push.trim() || 'Push', pull: draftNames.pull.trim() || 'Pull', legs: draftNames.legs.trim() || 'Legs' };
    saveSplitNames(trimmed);
    setEditingSplits(false);
  };

  const filtered = useMemo(() => exercises.filter(e => (e.gym === gym || e.gym === 'both') && e.day === day), [exercises, gym, day]);
  const selected = useMemo(() => filtered.find(e => e.id === selectedId) ?? filtered[0] ?? null, [filtered, selectedId]);

  useEffect(() => {
    if (filtered.length && (!selectedId || !filtered.find(e => e.id === selectedId))) setSelectedId(filtered[0]?.id ?? null);
  }, [filtered]);

  const prog = useMemo(() => selected ? computeProgression(selected, workoutLogs) : null, [selected, workoutLogs]);

  useEffect(() => {
    if (prog) { setWeight(prog.currentWeight); setSelectedReps(null); }
  }, [selected?.id]);

  const repRange = useMemo(() => {
    if (!selected) return [];
    const min = Math.max(1, selected.repsMin - 2);
    const max = selected.repsMax + 2;
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [selected]);

  const handleLog = async () => {
    if (!selected || selectedReps === null || saving) return;
    setSaving(true);
    const muscles = EXERCISE_MUSCLES[selected.name] || MUSCLE_MAP[selected.day] || [];
    await addWorkoutLog({ date: todayStr(), exerciseName: selected.name, muscle: selected.day, muscles, topSet: { weight: selected.bodyweight ? 0 : weight, reps: selectedReps } });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const addExercise = ex => { const u = [...exercises, ex]; saveExercises(u); setSelectedId(ex.id); setShowAdd(false); };

  const actionColour = { 'ADD WEIGHT': '#4caf7d', 'HOLD': 'rgba(255,255,255,0.5)', 'DROP WEIGHT': '#e25d7a', 'DELOAD': '#e8a13a', 'FIRST SET': 'var(--accent)' };

  return (
    <Section title="Progressive Overload">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <GlassCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ToggleGroup label="GYM" options={[{value:'home',label:'Home Gym'},{value:'commercial',label:'Commercial Gym'}]} value={gym} onChange={setGym} />
            {editingSplits ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', minWidth: 36, textTransform: 'uppercase' }}>DAY</span>
                {['push','pull','legs'].map(k => (
                  <input key={k} value={draftNames[k]} onChange={e => setDraftNames(p => ({ ...p, [k]: e.target.value }))}
                    style={{ ...inputSx, flex: 1, padding: '6px 8px', fontSize: 12, textAlign: 'center' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--input-border)'} />
                ))}
                <button onClick={saveSplits} style={{ ...btnPrimary, padding: '6px 12px', fontSize: 11, whiteSpace: 'nowrap' }}>Save</button>
                <button onClick={() => { setDraftNames(splitNames); setEditingSplits(false); }} style={{ ...btnGhost, padding: '6px 10px', fontSize: 11 }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <ToggleGroup label="DAY"
                  options={[{value:'push',label:splitNames.push},{value:'pull',label:splitNames.pull},{value:'legs',label:splitNames.legs}]}
                  value={day} onChange={setDay} />
                <button onClick={() => { setDraftNames(splitNames); setEditingSplits(true); }}
                  style={{ flexShrink: 0, background: 'none', border: '0.5px solid var(--card-border)', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11 }}
title="Rename splits">✎</button>
              </div>
            )}
          </div>
        </GlassCard>

        <div>
          <GlassLabel>Exercise</GlassLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={selected?.id ?? ''} onChange={e => setSelectedId(e.target.value)}
              style={{ ...inputSx, flex: 1, fontSize: 14, fontWeight: 500 }}>
              {filtered.map(e => <option key={e.id} value={e.id}>{e.name}{prog && e.id === selected?.id ? ` · ${prog.currentWeight}kg` : ''}</option>)}
              {filtered.length === 0 && <option disabled>No exercises for this selection</option>}
            </select>
            <button onClick={() => setShowAdd(true)} style={{ ...btnGhost, padding: '0 14px', fontSize: 18, borderRadius: 8 }} title="Add exercise">+</button>
          </div>
        </div>

        {selected && prog && (
          <>
            <div>
              <GlassLabel>Log Today's Top Set</GlassLabel>
              {prog.last && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '0.5px solid var(--card-border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>LAST TIME</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selected.bodyweight ? 'BW' : `${prog.last.topSet?.weight}kg`} × {prog.last.topSet?.reps}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{prog.last.date === todayStr() ? 'today' : prog.last.date?.slice(5)}</span>
                </div>
              )}
              {!selected.bodyweight && <div style={{ marginBottom: 16 }}><Stepper label="WEIGHT (KG)" value={weight} onChange={setWeight} step={selected.increment || 2.5} /></div>}
              <div>
                <span style={lblSx}>REPS</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {repRange.map(r => (
                    <button key={r} onClick={() => setSelectedReps(r)} style={{
                      width: 38, height: 38, borderRadius: 8, border: `0.5px solid ${selectedReps === r ? 'rgba(255,255,255,0.8)' : 'var(--card-border)'}`,
                      background: selectedReps === r ? 'rgba(255,255,255,0.9)' : 'var(--card-fill)',
                      color: selectedReps === r ? '#111' : 'var(--text-secondary)',
                      fontSize: 13, fontWeight: selectedReps === r ? 700 : 400, cursor: 'pointer', transition: 'all 0.12s',
                    }}>{r}</button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={handleLog} disabled={selectedReps === null || saving} style={{
              width: '100%', padding: '14px 0', borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.25)',
              background: saved ? 'rgba(76,175,125,0.15)' : 'rgba(255,255,255,0.08)',
              color: saved ? '#4caf7d' : 'var(--text-primary)',
              fontSize: 14, fontWeight: 600, cursor: selectedReps === null ? 'not-allowed' : 'pointer',
              opacity: selectedReps === null ? 0.4 : 1, transition: 'all 0.15s', letterSpacing: '0.03em',
            }}>
              {saved ? '✔️ Logged' : saving ? 'Saving...' : 'Log set'}
            </button>

            <GlassCard style={{ background: 'rgba(30,50,30,0.55)', border: '0.5px solid rgba(76,175,125,0.2)' }}>
              <GlassLabel>Next Session</GlassLabel>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>{selected.name}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                {selected.bodyweight ? 'Bodyweight' : `${prog.nextWeight}kg`} × {selected.repsMin} reps
              </div>
              <span style={{
                display: 'inline-block', padding: '2px 9px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                background: `${actionColour[prog.action]}22`, color: actionColour[prog.action],
                border: `0.5px solid ${actionColour[prog.action]}55`, letterSpacing: '0.08em', marginBottom: 10,
              }}>{prog.action}</span>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{prog.hint}</div>
            </GlassCard>
          </>
        )}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            No exercises for {gym === 'home' ? 'Home Gym' : 'Commercial Gym'} / {splitNames[day]}.<br />
            <button onClick={() => setShowAdd(true)} style={{ ...btnPrimary, marginTop: 12 }}>Add one</button>
          </div>
        )}
      </div>
      {showAdd && <ExerciseModal onClose={() => setShowAdd(false)} onSave={addExercise} />}
    </Section>
  );
}

// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
// 2. EXERCISES LIBRARY
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
function ExercisesLibrary({ exercises, saveExercises }) {
  const [filter, setFilter]   = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() =>
    filter === 'all' ? exercises : exercises.filter(e => e.day === filter),
    [exercises, filter]);

  const handleSave = ex => {
    const idx = exercises.findIndex(e => e.id === ex.id);
    const updated = idx >= 0 ? exercises.map(e => e.id === ex.id ? ex : e) : [...exercises, ex];
    saveExercises(updated);
    setShowAdd(false); setEditing(null);
  };

  const handleRemove = id => {
    saveExercises(exercises.filter(e => e.id !== id));
  };

  const dayColour = { push: '#e25d7a', pull: '#4a9eff', legs: '#f4a642' };
  const gymLabel  = { home: 'Home', commercial: 'Commercial', both: 'Both' };

  return (
    <Section title="Exercise Library" action={
      <button onClick={() => setShowAdd(true)} style={{ ...btnPrimary, fontSize: 11 }}>+ Add exercise</button>
    }>
      <ExerciseSuggest exercises={exercises} saveExercises={saveExercises} />
      <ExerciseBrowser exercises={exercises} saveExercises={saveExercises} />
      {/* Filter row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {['all','push','pull','legs'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 14px', borderRadius: 20, border: '0.5px solid var(--card-border)', cursor: 'pointer', fontSize: 11.5, fontWeight: 500,
            background: filter === f ? 'var(--active-bg)' : 'transparent',
            color: filter === f ? 'var(--accent)' : 'var(--text-secondary)',
            textTransform: 'capitalize',
          }}>{f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map(ex => (
          <div key={ex.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10,
            background: 'var(--card-fill)', border: '0.5px solid var(--card-border)',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: dayColour[ex.day] ?? 'var(--accent)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{ex.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {gymLabel[ex.gym]} · {ex.bodyweight ? 'Bodyweight' : `${ex.startingWeight}kg`} · {ex.repsMin}–{ex.repsMax} reps
                {!ex.bodyweight && ex.increment > 0 && ` · +${ex.increment}kg`}
              </div>
            </div>
            <button onClick={() => setEditing(ex)} style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }}>Edit</button>
            <button onClick={() => handleRemove(ex.id)} style={{ ...btnGhost, padding: '4px 10px', fontSize: 11, color: '#e25d7a', borderColor: 'rgba(226,93,122,0.3)' }}>🗑</button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
            No exercises yet.
            <button onClick={() => setShowAdd(true)} style={{ ...btnPrimary, display: 'block', margin: '12px auto 0' }}>Add one</button>
          </div>
        )}
      </div>

      {showAdd && <ExerciseModal onClose={() => setShowAdd(false)} onSave={handleSave} />}
      {editing  && <ExerciseModal onClose={() => setEditing(null)} onSave={handleSave} initial={editing} />}
    </Section>
  );
}

// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
// MUSCLE RANKING
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

// All tracked muscles with display metadata
const MUSCLES = [
  // Front
  { id: 'chest',      label: 'Chest',       side: 'front', x: 43,  y: 22, color: '#e25d7a' },
  { id: 'shoulders',  label: 'Shoulders',   side: 'front', x: 30,  y: 18, color: '#f4a642' },
  { id: 'biceps',     label: 'Biceps',      side: 'front', x: 24,  y: 30, color: '#4a9eff' },
  { id: 'triceps',    label: 'Triceps',     side: 'front', x: 57,  y: 30, color: '#9b5de5' },
  { id: 'forearms',   label: 'Forearms',    side: 'front', x: 20,  y: 40, color: '#00c9a7' },
  { id: 'quads',      label: 'Quads',       side: 'front', x: 38,  y: 62, color: '#e25d7a' },
  { id: 'calves',     label: 'Calves',      side: 'front', x: 38,  y: 82, color: '#4a9eff' },
  // Back
  { id: 'back',       label: 'Back',        side: 'back',  x: 43,  y: 26, color: '#4a9eff' },
  { id: 'hamstrings', label: 'Hamstrings',  side: 'back',  x: 38,  y: 62, color: '#f4a642' },
  { id: 'glutes',     label: 'Glutes',      side: 'back',  x: 43,  y: 52, color: '#9b5de5' },
];

// Slow progression — sessions are distinct days a muscle was trained (all-time).
const RANK_LEVELS = [
  { min: 0,  label: 'Untrained',    color: 'rgba(255,255,255,0.08)' },
  { min: 1,  label: 'Beginner',     color: '#3b5bdb' },
  { min: 8,  label: 'Developing',   color: '#4a9eff' },
  { min: 20, label: 'Intermediate', color: '#4caf7d' },
  { min: 40, label: 'Advanced',     color: '#f4a642' },
  { min: 70, label: 'Elite',        color: '#e25d7a' },
];
const RANK_MAX = 70;  // sessions to reach Elite (drives progress bars)

function getRankLevel(sessions) {
  let level = RANK_LEVELS[0];
  for (const r of RANK_LEVELS) { if (sessions >= r.min) level = r; }
  return level;
}

// Sessions per muscle = number of distinct days that muscle was trained (all-time).
function computeMuscleSessions(workoutLogs) {
  const days = {};
  MUSCLES.forEach(m => { days[m.id] = new Set(); });
  (workoutLogs || []).forEach(log => {
    if (!log.date) return;
    getLogMuscles(log).forEach(mid => { if (days[mid]) days[mid].add(log.date); });
  });
  const counts = {};
  MUSCLES.forEach(m => { counts[m.id] = days[m.id].size; });
  return counts;
}

// Real anatomical figure rendered from vendored react-body-highlighter polygon
// data (viewBox 0 0 100 200). Muscles are coloured by our rank system.
const LIB_TO_MUSCLE = {
  'chest': 'chest',
  'front-deltoids': 'shoulders', 'back-deltoids': 'shoulders',
  'biceps': 'biceps', 'triceps': 'triceps', 'forearm': 'forearms',
  'trapezius': 'back', 'upper-back': 'back', 'lower-back': 'back',
  'quadriceps': 'quads', 'hamstring': 'hamstrings', 'gluteal': 'glutes',
  'calves': 'calves', 'left-soleus': 'calves', 'right-soleus': 'calves',
};
const BODY_FILL    = '#cfd4df';   // untracked anatomy (abs, neck, head, knees…)
const UNTRAINED    = '#5a6072';   // tracked muscle, 0 sessions

function BodySVG({ side, muscleSessions, large = false }) {
  const modelData = side === 'back' ? posteriorData : anteriorData;

  const fillFor = (slug) => {
    const mid = LIB_TO_MUSCLE[slug];
    if (!mid) return BODY_FILL;
    const s = muscleSessions[mid] || 0;
    return s === 0 ? UNTRAINED : getRankLevel(s).color;
  };

  return (
    <svg viewBox="0 0 100 200"
      style={{ width: '100%', maxWidth: large ? '100%' : 168, height: 'auto', display: 'block' }}>
      {modelData.map((m, gi) =>
        m.svgPoints.map((pts, i) => (
          <polygon key={`${gi}-${i}`} points={pts}
            fill={fillFor(m.muscle)}
            stroke="rgba(0,0,0,0.28)" strokeWidth={0.3} strokeLinejoin="round"
            style={{ transition: 'fill 0.4s ease' }} />
        ))
      )}
    </svg>
  );
}

function MuscleRanking({ workoutLogs, settings }) {
  const [view, setView] = useState('front');
  const muscleSessions = useMemo(() => computeMuscleSessions(workoutLogs), [workoutLogs]);
  const bodyWeight = useMemo(() => {
    const logs = workoutLogs.filter(l => l.bodyWeight).sort((a, b) => a.date?.localeCompare(b.date));
    return logs.slice(-12).map(l => ({ date: l.date, w: l.bodyWeight }));
  }, [workoutLogs]);

  const frontMuscles = MUSCLES.filter(m => m.side === 'front');
  const backMuscles  = MUSCLES.filter(m => m.side === 'back');

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 24px' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Muscle Ranking</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>Ranks rise slowly as you log sets — every muscle each set hits is credited</div>

      {/* Body map — one large figure with Front/Back toggle */}
      <div style={{ display: 'flex', gap: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          {/* Front / Back toggle */}
          <div style={{ display: 'flex', borderRadius: 9, overflow: 'hidden', border: '0.5px solid var(--card-border)' }}>
            {['front', 'back'].map(s => (
              <button key={s} onClick={() => setView(s)} style={{
                padding: '6px 22px', border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                background: view === s ? 'rgba(255,255,255,0.9)' : 'var(--card-fill)',
                color: view === s ? '#111' : 'var(--text-secondary)', transition: 'all 0.12s',
              }}>{s}</button>
            ))}
          </div>
          {/* Big figure */}
          <div style={{ width: 320, maxWidth: '78vw' }}>
            <BodySVG side={view} muscleSessions={muscleSessions} large />
          </div>
        </div>

        {/* Rank legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {RANK_LEVELS.map(r => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-muscle table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 28 }}>
        {MUSCLES.map(m => {
          const sessions = muscleSessions[m.id] || 0;
          const rank = getRankLevel(sessions);
          const pct = Math.min((sessions / RANK_MAX) * 100, 100);
          return (
            <div key={m.id} style={{
              background: 'var(--hover-bg)', borderRadius: 10,
              border: '0.5px solid var(--card-border)', padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{m.label}</span>
                <span style={{ fontSize: 11, color: rank.color, fontWeight: 600 }}>{rank.label}</span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: rank.color, borderRadius: 2, transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sessions} session{sessions !== 1 ? 's' : ''} logged</div>
            </div>
          );
        })}
      </div>

      {/* Weight tracker */}
      {bodyWeight.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>Body Weight</div>
          <div style={{ background: 'var(--hover-bg)', borderRadius: 12, border: '0.5px solid var(--card-border)', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
              {bodyWeight.map((d, i) => {
                const vals = bodyWeight.map(x => x.w);
                const min = Math.min(...vals), max = Math.max(...vals);
                const range = max - min || 1;
                const h = Math.max(8, ((d.w - min) / range) * 50 + 10);
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{d.w}kg</div>
                    <div style={{ width: '100%', height: h, background: 'rgba(91,156,246,0.4)', borderRadius: '3px 3px 0 0', border: '0.5px solid rgba(91,156,246,0.6)' }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{bodyWeight[0]?.date?.slice(5)}</span>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{bodyWeight[bodyWeight.length - 1]?.date?.slice(5)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
// TRAINING CALENDAR
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
const MUSCLE_BY_ID = Object.fromEntries(MUSCLES.map(m => [m.id, m]));
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEK_HEADS  = ['S','M','T','W','T','F','S'];
const pad2 = n => String(n).padStart(2, '0');
const dateStr = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

// Colour for a logged day: single split → its colour, multiple → "mixed" purple.
function daySplitColour(splits) {
  if (!splits || splits.size === 0) return null;
  if (splits.size === 1) return SPLIT_COLOURS[[...splits][0]] || SPLIT_COLOURS.custom;
  return SPLIT_COLOURS.custom;
}

function WorkoutCalendar({ workoutLogs }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [mode, setMode]     = useState('month');   // 'month' | 'overall'
  const [selected, setSelected] = useState(null);  // date string

  // date → { logs, splits:Set, muscles:Set, sets:n }
  const byDate = useMemo(() => {
    const map = {};
    (workoutLogs || []).forEach(l => {
      if (!l.date) return;
      const e = (map[l.date] ||= { logs: [], splits: new Set(), muscles: new Set(), sets: 0 });
      e.logs.push(l); e.sets++;
      const sp = l.muscle || l.splitType || l.day; if (sp) e.splits.add(sp);
      getLogMuscles(l).forEach(mid => e.muscles.add(mid));
    });
    return map;
  }, [workoutLogs]);

  const totalDays = Object.keys(byDate).length;

  const stepMonth = (delta) => setCursor(c => {
    let m = c.m + delta, y = c.y;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    return { y, m };
  });

  // ── Month grid ──
  const renderMonth = () => {
    const { y, m } = cursor;
    const firstDow = new Date(y, m, 1).getDay();
    const daysIn   = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysIn; d++) cells.push(d);

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 14 }}>
          <button onClick={() => stepMonth(-1)} style={{ ...btnGhost, padding: '4px 12px' }}>‹</button>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', minWidth: 150, textAlign: 'center' }}>{MONTH_NAMES[m]} {y}</div>
          <button onClick={() => stepMonth(1)} style={{ ...btnGhost, padding: '4px 12px' }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 10, maxWidth: 820, margin: '0 auto' }}>
          {WEEK_HEADS.map((w, i) => (
            <div key={`h${i}`} style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, paddingBottom: 6 }}>{w}</div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={`b${i}`} />;
            const ds = dateStr(y, m, d);
            const e = byDate[ds];
            const colour = e ? daySplitColour(e.splits) : null;
            const isSel = selected === ds;
            return (
              <button key={ds} onClick={() => setSelected(isSel ? null : ds)}
                title={e ? `${e.sets} set${e.sets !== 1 ? 's' : ''}` : ''}
                style={{
                  aspectRatio: '1', borderRadius: 12, cursor: 'pointer',
                  border: isSel ? '1.5px solid var(--accent)' : `0.5px solid ${colour ? colour : 'var(--card-border)'}`,
                  background: colour ? `${colour}33` : 'var(--card-fill)',
                  color: colour ? '#fff' : 'var(--text-muted)',
                  fontSize: 15, fontWeight: e ? 600 : 400, position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s',
                }}>
                {d}
                {e && (
                  <span style={{ position: 'absolute', bottom: 4, left: 0, right: 0, display: 'flex', gap: 2, justifyContent: 'center' }}>
                    {[...e.splits].slice(0, 3).map((s, k) => (
                      <span key={k} style={{ width: 4, height: 4, borderRadius: '50%', background: SPLIT_COLOURS[s] || SPLIT_COLOURS.custom }} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Overall: full-year contribution heatmap ──
  const renderOverall = () => {
    const { y } = cursor;
    const start = new Date(y, 0, 1); start.setDate(start.getDate() - start.getDay());
    const end   = new Date(y, 11, 31);
    const weeks = []; let cur = new Date(start);
    while (cur <= end) {
      const wk = [];
      for (let i = 0; i < 7; i++) { wk.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
      weeks.push(wk);
    }
    const heat = (n) => {
      if (!n) return 'rgba(255,255,255,0.05)';
      const t = Math.min(n / 8, 1);
      return `rgba(74,158,255,${0.22 + t * 0.65})`;
    };
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 14 }}>
          <button onClick={() => setCursor(c => ({ ...c, y: c.y - 1 }))} style={{ ...btnGhost, padding: '4px 12px' }}>‹</button>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', minWidth: 80, textAlign: 'center' }}>{y}</div>
          <button onClick={() => setCursor(c => ({ ...c, y: c.y + 1 }))} style={{ ...btnGhost, padding: '4px 12px' }}>›</button>
        </div>
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <div style={{ display: 'flex', gap: 4, minWidth: 'min-content', justifyContent: 'center' }}>
            {weeks.map((wk, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {wk.map((day, di) => {
                  const ds = dateStr(day.getFullYear(), day.getMonth(), day.getDate());
                  const e = byDate[ds];
                  const inYear = day.getFullYear() === y;
                  return (
                    <div key={di} onClick={() => e && setSelected(ds)}
                      title={e ? `${ds} · ${e.sets} sets` : ds}
                      style={{
                        width: 15, height: 15, borderRadius: 3, cursor: e ? 'pointer' : 'default',
                        background: inYear ? heat(e?.sets || 0) : 'transparent',
                        outline: selected === ds ? '1.5px solid var(--accent)' : 'none',
                      }} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const sel = selected ? byDate[selected] : null;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 24px' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Training Calendar</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>{totalDays} day{totalDays !== 1 ? 's' : ''} logged · highlighted by split</div>

      {/* Month / Overall toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <div style={{ display: 'flex', borderRadius: 9, overflow: 'hidden', border: '0.5px solid var(--card-border)' }}>
          {[['month', 'Month'], ['overall', 'Overall']].map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)} style={{
              padding: '6px 22px', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 500,
              background: mode === id ? 'rgba(255,255,255,0.9)' : 'var(--card-fill)',
              color: mode === id ? '#111' : 'var(--text-secondary)', transition: 'all 0.12s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {mode === 'month' ? renderMonth() : renderOverall()}

      {/* Split legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
        {[['push', 'Push'], ['pull', 'Pull'], ['legs', 'Legs'], ['custom', 'Mixed / other']].map(([k, l]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: SPLIT_COLOURS[k] }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Selected-day detail */}
      {sel && (
        <div style={{ marginTop: 22, background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)', borderRadius: 12, padding: '16px 20px', maxWidth: 820, margin: '22px auto 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{selected}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sel.sets} set{sel.sets !== 1 ? 's' : ''}</span>
          </div>
          {/* muscles hit */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {[...sel.muscles].map(mid => {
              const mm = MUSCLE_BY_ID[mid];
              return (
                <span key={mid} style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 20, background: `${mm?.color || '#888'}22`, color: mm?.color || 'var(--text-secondary)', border: `0.5px solid ${mm?.color || '#888'}55` }}>
                  {mm?.label || mid}
                </span>
              );
            })}
          </div>
          {/* exercises */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {sel.logs.map((l, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{l.exerciseName || 'Set'}</span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>
                  {l.topSet ? `${l.topSet.weight || 0}kg × ${l.topSet.reps}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
// ROOT — Workout Tab
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
const SUB_NAV = [
  { id: 'session',  label: 'Session',   icon: 'focus' },
  { id: 'splits',   label: 'Split',     icon: 'plan' },
  { id: 'exercises',label: 'Exercises', icon: 'workout' },
  { id: 'muscles',  label: 'Muscles',   icon: 'activity' },
  { id: 'calendar', label: 'History',   icon: 'calendar' },
  // 'overload' (the old Overload Coach logger) is no longer in the menu: Session now suggests each
  // weight itself. Its code stays in this file.
];

// Muscles a lift trains (drives Muscle Ranking and Look).
export const musclesFor = musclesForExercise;

// Shared Train data: logs, exercise library, split names, today's split.
export function useTrainData() {
  const { items: workoutLogs, add: addWorkoutLog, update: updateWorkoutLog, remove: removeWorkoutLog } = useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS);
  const { data: storedExercises,  save: saveExercisesDoc  } = useDocument('overload_exercises', STORAGE_KEYS.OVERLOAD_EXERCISES, null);
  const { data: storedSplitNames, save: saveSplitNamesDoc } = useDocument('split_names',        STORAGE_KEYS.SPLIT_NAMES,        DEFAULT_SPLITS);
  const { items: programs, add: addProgram, update: updateProgram, remove: removeProgram } = useCollection('programs', STORAGE_KEYS.PROGRAMS);

  const exercises  = Array.isArray(storedExercises) ? storedExercises : [];
  const splitNames = storedSplitNames?.push ? storedSplitNames : { ...DEFAULT_SPLITS };

  // Today's split type from active program
  const todayKey       = DAY_KEYS[new Date().getDay()];
  const activeProgram  = programs.find(p => p.isActive) ?? null;
  const todaySplitType = activeProgram?.days?.[todayKey]?.splitType ?? null;

  return {
    workoutLogs, addWorkoutLog, updateWorkoutLog, removeWorkoutLog,
    exercises, saveExercisesDoc, splitNames, saveSplitNamesDoc,
    programs, addProgram, updateProgram, removeProgram, todaySplitType, activeProgram,
  };
}

// Train · Session on its own (the phone's Train screen).
export function TrainSessionScreen({ compact = true }) {
  const d = useTrainData();
  return (
    <TrainSession exercises={d.exercises} workoutLogs={d.workoutLogs}
      addWorkoutLog={d.addWorkoutLog} updateWorkoutLog={d.updateWorkoutLog} removeWorkoutLog={d.removeWorkoutLog}
      splitNames={d.splitNames} todaySplitType={d.todaySplitType} program={d.activeProgram} updateProgram={d.updateProgram} saveExercises={d.saveExercisesDoc}
      progression={computeProgression} musclesFor={musclesFor} compact={compact} />
  );
}

export default function WorkoutTab({ settings, compact = false }) {
  const [sub, setSub] = useState('session');
  const {
    workoutLogs, addWorkoutLog, updateWorkoutLog, removeWorkoutLog,
    exercises, saveExercisesDoc, splitNames, saveSplitNamesDoc,
    programs, addProgram, updateProgram, removeProgram, todaySplitType, activeProgram,
  } = useTrainData();

  return (
    <div style={{ display: 'flex', flexDirection: compact ? 'column' : 'row', height: '100%', overflow: 'hidden' }}>
      {/* Sub-nav: a column on desktop, a scrolling chip row on the phone */}
      {compact && (
        <div role="tablist" aria-label="Train sections" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 14px', flexShrink: 0, borderBottom: '0.5px solid var(--sidebar-divider)', WebkitOverflowScrolling: 'touch' }}>
          {SUB_NAV.map(s => (
            <button key={s.id} role="tab" aria-selected={sub === s.id} onClick={() => setSub(s.id)} style={{
              flexShrink: 0, minHeight: 40, padding: '0 16px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, whiteSpace: 'nowrap',
              border: `0.5px solid ${sub === s.id ? 'var(--tab-accent)' : 'var(--card-border)'}`, fontWeight: sub === s.id ? 600 : 500,
              background: sub === s.id ? 'color-mix(in srgb, var(--tab-accent) 14%, transparent)' : 'transparent',
              color: sub === s.id ? 'var(--tab-accent)' : 'var(--text-secondary)',
            }}>{s.label}</button>
          ))}
        </div>
      )}
      {!compact && <div style={{ width: 176, flexShrink: 0, borderRight: '0.5px solid var(--sidebar-divider)', display: 'flex', flexDirection: 'column', padding: '16px 0', gap: 2, overflowY: 'auto' }}>
        {SUB_NAV.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, minHeight: 36, whiteSpace: 'nowrap',
            padding: '8px 16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            borderLeft: `2px solid ${sub === s.id ? 'var(--tab-accent)' : 'transparent'}`,
            color: sub === s.id ? 'var(--tab-accent)' : 'var(--text-secondary)',
            fontSize: 13, fontWeight: sub === s.id ? 500 : 400,
            transition: 'all 0.15s ease', textAlign: 'left',
            background: sub === s.id ? 'var(--active-bg)' : 'transparent',
          }}>
            <Icon name={s.icon} size={17} />
            {s.label}
          </button>
        ))}
      </div>}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {sub === 'session'   && <TrainSession exercises={exercises} workoutLogs={workoutLogs} addWorkoutLog={addWorkoutLog} updateWorkoutLog={updateWorkoutLog} removeWorkoutLog={removeWorkoutLog} splitNames={splitNames} todaySplitType={todaySplitType} program={activeProgram} updateProgram={updateProgram} saveExercises={saveExercisesDoc} progression={computeProgression} musclesFor={musclesFor} compact={compact} onEditProgram={() => setSub('splits')} />}
        {sub === 'overload'  && <OverloadCoach workoutLogs={workoutLogs} addWorkoutLog={addWorkoutLog} exercises={exercises} saveExercises={saveExercisesDoc} splitNames={splitNames} saveSplitNames={saveSplitNamesDoc} todaySplitType={todaySplitType} />}
        {sub === 'splits'    && <SplitBuilder programs={programs} addProgram={addProgram} updateProgram={updateProgram} removeProgram={removeProgram} exercises={exercises} workoutLogs={workoutLogs} saveExercises={saveExercisesDoc} />}
        {sub === 'exercises' && <ExercisesLibrary exercises={exercises} saveExercises={saveExercisesDoc} />}
        {sub === 'muscles'   && <MuscleRanking workoutLogs={workoutLogs} settings={settings} />}
        {sub === 'calendar'  && <WorkoutCalendar workoutLogs={workoutLogs} />}
      </div>
    </div>
  );
}

