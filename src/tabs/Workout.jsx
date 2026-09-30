//  Workout Tab 
// Sub-sections: Overload Coach · Exercises · Split Planner
// All data via Firebase  workout_logs collection + meta docs for library/program

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument }   from '../supabase/useDocument.js';
import { STORAGE_KEYS }  from '../utils/storage.js';
import { anteriorData, posteriorData } from '../components/bodyModel.js';
import { toLocalDateKey } from '../utils/localDate.js';
import TrainSession from './TrainSession.jsx';
import { suggestNext } from '../domain/progression.js';
import { suggestWeek, describeWeek } from '../domain/split.js';
import { EXERCISE_MUSCLES, MUSCLE_MAP, musclesForLog as getLogMuscles, musclesForExercise } from '../domain/muscles.js';
import ExerciseSuggest from '../components/ExerciseSuggest.jsx';

//  Helpers 
const todayStr = () => toLocalDateKey(new Date());
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };
const SPLIT_COLOURS = { push: '#e25d7a', pull: '#4a9eff', legs: '#f4a642', rest: 'rgba(255,255,255,0.2)', custom: '#9b5de5' };

//  Shared style tokens 
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
  display: 'block', fontSize: 10, color: 'var(--text-muted)',
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
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap' }}>{children}</span>
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
        {children}
      </div>
    </div>
  );
}

//  Default exercise library 
export const DEFAULT_OVERLOAD_EXERCISES = [
  // Push
  { id:'bp',  name:'Bench Press',         gym:'both',       day:'push', bodyweight:false, startingWeight:40, repsMin:6, repsMax:8,  increment:2.5 },
  { id:'ohp', name:'Overhead Press',      gym:'both',       day:'push', bodyweight:false, startingWeight:30, repsMin:6, repsMax:8,  increment:2.5 },
  { id:'dip', name:'Dips',                gym:'both',       day:'push', bodyweight:true,  startingWeight:0,  repsMin:6, repsMax:10, increment:0   },
  { id:'ppe', name:'Push Press',          gym:'commercial', day:'push', bodyweight:false, startingWeight:35, repsMin:5, repsMax:8,  increment:2.5 },
  { id:'dbp', name:'DB Shoulder Press',   gym:'both',       day:'push', bodyweight:false, startingWeight:16, repsMin:8, repsMax:12, increment:2   },
  // Pull
  { id:'dl',  name:'Deadlift',            gym:'both',       day:'pull', bodyweight:false, startingWeight:60, repsMin:4, repsMax:6,  increment:5   },
  { id:'pu',  name:'Pull-ups',            gym:'both',       day:'pull', bodyweight:true,  startingWeight:0,  repsMin:5, repsMax:8,  increment:0   },
  { id:'br',  name:'Barbell Row',         gym:'both',       day:'pull', bodyweight:false, startingWeight:40, repsMin:6, repsMax:8,  increment:2.5 },
  { id:'lr',  name:'Lat Pulldown',        gym:'commercial', day:'pull', bodyweight:false, startingWeight:50, repsMin:8, repsMax:12, increment:5   },
  { id:'fc',  name:'Face Pulls',          gym:'commercial', day:'pull', bodyweight:false, startingWeight:20, repsMin:12,repsMax:15, increment:2.5 },
  // Legs
  { id:'sq',  name:'Barbell Squat',       gym:'both',       day:'legs', bodyweight:false, startingWeight:60, repsMin:5, repsMax:8,  increment:2.5 },
  { id:'rdl', name:'Romanian Deadlift',   gym:'both',       day:'legs', bodyweight:false, startingWeight:50, repsMin:8, repsMax:10, increment:2.5 },
  { id:'lp',  name:'Leg Press',           gym:'commercial', day:'legs', bodyweight:false, startingWeight:80, repsMin:8, repsMax:12, increment:10  },
  { id:'lg',  name:'Leg Curl',            gym:'commercial', day:'legs', bodyweight:false, startingWeight:40, repsMin:8, repsMax:12, increment:5   },
  { id:'lu',  name:'Walking Lunges',      gym:'both',       day:'legs', bodyweight:true,  startingWeight:0,  repsMin:10,repsMax:14, increment:0   },
  { id:'crf', name:'Calf Raises',         gym:'both',       day:'legs', bodyweight:false, startingWeight:20, repsMin:12,repsMax:15, increment:5   },
];

export const DEFAULT_SPLITS = { push: 'Push', pull: 'Pull', legs: 'Legs' };

//  Default program template (PPL MonSat, rest Sun) 
const DEFAULT_PROGRAM_DAYS = {
  mon: { splitType: 'push', label: 'Push' },
  tue: { splitType: 'pull', label: 'Pull' },
  wed: { splitType: 'legs', label: 'Legs' },
  thu: { splitType: 'push', label: 'Push' },
  fri: { splitType: 'pull', label: 'Pull' },
  sat: { splitType: 'legs', label: 'Legs' },
  sun: { splitType: 'rest', label: 'Rest' },
};

//  Progression logic 
// Next-session target: the rules live in domain/progression.js (all working sets,
// no drop after one bad day, plateau deload, layoff restart).
export function computeProgression(ex, workoutLogs) {
  return suggestNext(ex, workoutLogs, toLocalDateKey(new Date()));
}

//  Stepper 
function Stepper({ value, onChange, min = 0, step = 1, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={lblSx}>{label}</span>}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button onClick={() => onChange(Math.max(min, parseFloat((value - step).toFixed(2))))}
          style={{ width: 40, height: 42, borderRadius: '8px 0 0 8px', border: '0.5px solid var(--card-border)', background: 'var(--card-fill)', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer' }}></button>
        <div style={{ flex: 1, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '0.5px solid var(--card-border)', borderLeft: 'none', borderRight: 'none', background: 'var(--input-bg)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', minWidth: 70 }}>
          {value}
        </div>
        <button onClick={() => onChange(parseFloat((value + step).toFixed(2)))}
          style={{ width: 40, height: 42, borderRadius: '0 8px 8px 0', border: '0.5px solid var(--card-border)', background: 'var(--card-fill)', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer' }}>+</button>
      </div>
    </div>
  );
}

//  Toggle group 
function ToggleGroup({ label, options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
      {label && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', minWidth: 36, textTransform: 'uppercase' }}>{label}</span>}
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

//  Add / Edit Exercise Modal 
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
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', minWidth: 36, textTransform: 'uppercase' }}>DAY</span>
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
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selected.bodyweight ? 'BW' : `${prog.last.topSet?.weight}kg`}  {prog.last.topSet?.reps}</span>
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
              <div style={{ fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase' }}>{selected.name}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                {selected.bodyweight ? 'Bodyweight' : `${prog.nextWeight}kg`}  {selected.repsMin} reps
              </div>
              <span style={{
                display: 'inline-block', padding: '2px 9px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                background: `${actionColour[prog.action]}22`, color: actionColour[prog.action],
                border: `0.5px solid ${actionColour[prog.action]}55`, letterSpacing: '0.08em', marginBottom: 10,
              }}>{prog.action}</span>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{prog.hint}</div>
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
                {gymLabel[ex.gym]} · {ex.bodyweight ? 'Bodyweight' : `${ex.startingWeight}kg`} · {ex.repsMin}{ex.repsMax} reps
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
// 3. SPLIT PLANNER
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
function SplitPlanner({ programs, addProgram, updateProgram, removeProgram, exercises, splitNames }) {
  const todayKey   = DAY_KEYS[new Date().getDay()];
  const activeProgram = programs.find(p => p.isActive) ?? null;

  const [editingDay, setEditingDay] = useState(null);
  const [showNewProgram, setShowNewProgram] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');

  const setActiveProgram = useCallback(async (id) => {
    for (const p of programs) {
      if (p.isActive !== (p.id === id)) await updateProgram(p.id, { isActive: p.id === id });
    }
  }, [programs, updateProgram]);

  const createProgram = async () => {
    const name = newProgramName.trim() || 'My Program';
    await addProgram({ name, isActive: programs.length === 0, days: { ...DEFAULT_PROGRAM_DAYS }, pinnedExercises: {} });
    setShowNewProgram(false); setNewProgramName('');
  };

  // Suggest a week from how many days you can train; creates a NEW program
  // (never edits the one you have) and only switches to it if asked.
  const [suggestDays, setSuggestDays] = useState(null);
  const suggestion = useMemo(() => suggestWeek(suggestDays, splitNames), [suggestDays, splitNames]);
  const createSuggested = async (makeActive) => {
    if (!suggestion) return;
    const id = await addProgram({ name: `${suggestDays}-day ${splitNames.push || 'Push'}/${splitNames.pull || 'Pull'}/${splitNames.legs || 'Legs'}`, isActive: programs.length === 0, days: suggestion, pinnedExercises: {} });
    if (makeActive && id) {
      for (const p of programs) if (p.isActive) await updateProgram(p.id, { isActive: false });
      await updateProgram(id, { isActive: true });
    }
    setSuggestDays(null);
  };

  const updateDay = async (dayKey, patch) => {
    if (!activeProgram) return;
    const days = { ...activeProgram.days, [dayKey]: { ...activeProgram.days?.[dayKey], ...patch } };
    await updateProgram(activeProgram.id, { days });
  };

  const SPLIT_OPTIONS = [
    { value: 'push', label: splitNames.push || 'Push' },
    { value: 'pull', label: splitNames.pull || 'Pull' },
    { value: 'legs', label: splitNames.legs || 'Legs' },
    { value: 'rest', label: 'Rest' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <Section title="Split Planner">
      <div style={{ maxWidth: '100%' }}>

        {/* Program selector */}
        <GlassCard style={{ marginBottom: 20 }}>
          <GlassLabel>Active Program</GlassLabel>
          {programs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No programs yet.
              <button onClick={() => setShowNewProgram(true)} style={{ ...btnPrimary, display: 'block', margin: '12px auto 0' }}>Create program</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {programs.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: p.isActive ? 'rgba(255,255,255,0.06)' : 'transparent', border: `0.5px solid ${p.isActive ? 'var(--accent)' : 'var(--card-border)'}` }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: p.isActive ? 600 : 400, color: p.isActive ? 'var(--accent)' : 'var(--text-secondary)' }}>{p.name}</div>
                  {p.isActive && <span style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em' }}>ACTIVE</span>}
                  {!p.isActive && <button onClick={() => setActiveProgram(p.id)} style={{ ...btnGhost, padding: '3px 10px', fontSize: 11 }}>Set active</button>}
                  <button onClick={() => removeProgram(p.id)} style={{ ...btnGhost, padding: '3px 8px', fontSize: 11, color: '#e25d7a', borderColor: 'rgba(226,93,122,0.3)' }}>🗑</button>
                </div>
              ))}
              <button onClick={() => setShowNewProgram(true)} style={{ ...btnGhost, alignSelf: 'flex-start', marginTop: 4, fontSize: 11 }}>+ New program</button>
            </div>
          )}
        </GlassCard>

        {/* Suggest a week */}
        <GlassCard style={{ marginBottom: 16 }}>
          <GlassLabel>Suggest a week</GlassLabel>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8 }}>How many days can you train? Arete lays out a push / pull / legs week with the hard days spread out. Edit it after.</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[2, 3, 4, 5, 6].map(n => (
              <button key={n} type="button" aria-pressed={suggestDays === n} onClick={() => setSuggestDays(suggestDays === n ? null : n)}
                style={{ ...btnGhost, minHeight: 40, padding: '0 16px', borderColor: suggestDays === n ? 'var(--accent)' : undefined, color: suggestDays === n ? 'var(--accent)' : undefined }}>{n} days</button>
            ))}
          </div>
          {suggestion && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="val-num" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{describeWeek(suggestion)}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => createSuggested(false)} style={btnGhost}>Save as a program</button>
                <button type="button" onClick={() => createSuggested(true)} style={btnPrimary}>Save and make active</button>
              </div>
            </div>
          )}
        </GlassCard>

        {/* New program inline form */}
        {showNewProgram && (
          <GlassCard style={{ marginBottom: 16 }}>
            <GlassLabel>New Program</GlassLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newProgramName} onChange={e => setNewProgramName(e.target.value)} placeholder="Program name" style={{ ...inputSx, flex: 1 }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'} onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
                onKeyDown={e => e.key === 'Enter' && createProgram()} />
              <button onClick={createProgram} style={btnPrimary}>Create</button>
              <button onClick={() => setShowNewProgram(false)} style={btnGhost}>Cancel</button>
            </div>
          </GlassCard>
        )}

        {/* Weekly grid */}
        {activeProgram && (
          <>
            <GlassLabel>Weekly Schedule</GlassLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 20 }}>
              {DAY_KEYS.map(dk => {
                const dayData   = activeProgram.days?.[dk] ?? { splitType: 'rest', label: 'Rest' };
                const isToday   = dk === todayKey;
                const colour    = SPLIT_COLOURS[dayData.splitType] ?? 'var(--accent)';
                const isEditing = editingDay === dk;
                return (
                  <div key={dk} style={{
                    borderRadius: 10, padding: '10px 8px', border: `0.5px solid ${isToday ? colour : 'var(--card-border)'}`,
                    background: isToday ? `${colour}15` : 'var(--card-fill)',
                    cursor: 'pointer', transition: 'all 0.15s', minWidth: 0,
                  }} onClick={() => setEditingDay(isEditing ? null : dk)}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: isToday ? colour : 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>
                      {DAY_LABELS[dk]}{isToday ? ' ·' : ''}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: colour, textAlign: 'center', lineHeight: 1.3 }}>
                      {dayData.label || dayData.splitType}
                    </div>
                    {isToday && (
                      <div style={{ fontSize: 9, color: colour, textAlign: 'center', marginTop: 4, opacity: 0.7 }}>Today</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Day editor */}
            {editingDay && (
              <GlassCard style={{ marginBottom: 16 }}>
                <GlassLabel>{DAY_LABELS[editingDay]}  Edit Day</GlassLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <span style={lblSx}>SPLIT TYPE</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {SPLIT_OPTIONS.map(opt => {
                        const current = activeProgram.days?.[editingDay]?.splitType;
                        return (
                          <button key={opt.value} onClick={() => updateDay(editingDay, { splitType: opt.value, label: opt.label })} style={{
                            padding: '5px 14px', borderRadius: 20, border: `0.5px solid ${current === opt.value ? SPLIT_COLOURS[opt.value] : 'var(--card-border)'}`,
                            background: current === opt.value ? `${SPLIT_COLOURS[opt.value]}22` : 'transparent',
                            color: current === opt.value ? SPLIT_COLOURS[opt.value] : 'var(--text-secondary)',
                            fontSize: 12, cursor: 'pointer', transition: 'all 0.12s',
                          }}>{opt.label}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom label input */}
                  {activeProgram.days?.[editingDay]?.splitType === 'custom' && (
                    <div>
                      <span style={lblSx}>CUSTOM LABEL</span>
                      <input
                        value={activeProgram.days?.[editingDay]?.label ?? ''}
                        onChange={e => updateDay(editingDay, { label: e.target.value })}
                        placeholder="e.g. Upper Body"
                        style={inputSx}
                        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                        onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
                      />
                    </div>
                  )}

                  {/* Exercise count for the assigned day */}
                  {['push','pull','legs'].includes(activeProgram.days?.[editingDay]?.splitType) && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {exercises.filter(e => e.day === activeProgram.days[editingDay].splitType).length} exercises in library for this split type.
                    </div>
                  )}

                  <button onClick={() => setEditingDay(null)} style={{ ...btnGhost, alignSelf: 'flex-start', fontSize: 11 }}>Done</button>
                </div>
              </GlassCard>
            )}

            {/* Today's workout summary */}
            {(() => {
              const today = activeProgram.days?.[todayKey];
              if (!today || today.splitType === 'rest') return (
                <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '0.5px solid var(--card-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Rest day  recover and recharge.</div>
                </div>
              );
              const exCount = exercises.filter(e => e.day === today.splitType).length;
              const colour  = SPLIT_COLOURS[today.splitType] ?? 'var(--accent)';
              return (
                <div style={{ padding: '16px 20px', borderRadius: 12, background: `${colour}12`, border: `0.5px solid ${colour}40`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 12, color: colour, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Today</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{today.label} Day  {exCount} exercise{exCount !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
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
                <span style={{ fontSize: 10, color: rank.color, fontWeight: 600 }}>{rank.label}</span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: rank.color, borderRadius: 2, transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{sessions} session{sessions !== 1 ? 's' : ''} logged</div>
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
                    <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>{d.w}kg</div>
                    <div style={{ width: '100%', height: h, background: 'rgba(91,156,246,0.4)', borderRadius: '3px 3px 0 0', border: '0.5px solid rgba(91,156,246,0.6)' }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{bodyWeight[0]?.date?.slice(5)}</span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{bodyWeight[bodyWeight.length - 1]?.date?.slice(5)}</span>
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
// ROOT  Workout Tab
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
const SUB_NAV = [
  { id: 'session',  label: 'Session',        icon: '⏱️' },
  { id: 'overload', label: 'Overload Coach', icon: '📈' },
  { id: 'splits',   label: 'Split Planner',  icon: '📋' },
  { id: 'exercises',label: 'Exercises',      icon: '🏋️' },
  { id: 'muscles',  label: 'Muscle Ranking', icon: '💪' },
  { id: 'calendar', label: 'Calendar',       icon: '📅' },
];

// Muscles a lift trains (drives Muscle Ranking and Look).
export const musclesFor = musclesForExercise;

// Shared Train data: logs, exercise library, split names, today's split.
export function useTrainData() {
  const { items: workoutLogs, add: addWorkoutLog, update: updateWorkoutLog, remove: removeWorkoutLog } = useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS);
  const { data: storedExercises,  save: saveExercisesDoc  } = useDocument('overload_exercises', STORAGE_KEYS.OVERLOAD_EXERCISES, null);
  const { data: storedSplitNames, save: saveSplitNamesDoc } = useDocument('split_names',        STORAGE_KEYS.SPLIT_NAMES,        DEFAULT_SPLITS);
  const { items: programs, add: addProgram, update: updateProgram, remove: removeProgram } = useCollection('programs', STORAGE_KEYS.PROGRAMS);

  const exercises  = (Array.isArray(storedExercises) && storedExercises.length) ? storedExercises : DEFAULT_OVERLOAD_EXERCISES;
  const splitNames = storedSplitNames?.push ? storedSplitNames : { ...DEFAULT_SPLITS };

  // Today's split type from active program
  const todayKey       = DAY_KEYS[new Date().getDay()];
  const activeProgram  = programs.find(p => p.isActive) ?? null;
  const todaySplitType = activeProgram?.days?.[todayKey]?.splitType ?? null;

  return {
    workoutLogs, addWorkoutLog, updateWorkoutLog, removeWorkoutLog,
    exercises, saveExercisesDoc, splitNames, saveSplitNamesDoc,
    programs, addProgram, updateProgram, removeProgram, todaySplitType,
  };
}

// Train · Session on its own (the phone's Train screen).
export function TrainSessionScreen({ compact = true }) {
  const d = useTrainData();
  return (
    <TrainSession exercises={d.exercises} workoutLogs={d.workoutLogs}
      addWorkoutLog={d.addWorkoutLog} updateWorkoutLog={d.updateWorkoutLog} removeWorkoutLog={d.removeWorkoutLog}
      splitNames={d.splitNames} todaySplitType={d.todaySplitType}
      progression={computeProgression} musclesFor={musclesFor} compact={compact} />
  );
}

export default function WorkoutTab({ settings }) {
  const [sub, setSub] = useState('session');
  const {
    workoutLogs, addWorkoutLog, updateWorkoutLog, removeWorkoutLog,
    exercises, saveExercisesDoc, splitNames, saveSplitNamesDoc,
    programs, addProgram, updateProgram, removeProgram, todaySplitType,
  } = useTrainData();

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left sub-nav */}
      <div style={{ width: 150, flexShrink: 0, borderRight: '0.5px solid var(--sidebar-divider)', display: 'flex', flexDirection: 'column', padding: '16px 0', gap: 2, overflowY: 'auto' }}>
        {SUB_NAV.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', border: 'none', cursor: 'pointer',
            borderLeft: `2px solid ${sub === s.id ? 'var(--tab-accent)' : 'transparent'}`,
            color: sub === s.id ? 'var(--tab-accent)' : 'var(--text-secondary)',
            fontSize: 13, fontWeight: sub === s.id ? 500 : 400,
            transition: 'all 0.15s ease', textAlign: 'left',
            background: sub === s.id ? 'var(--active-bg)' : 'transparent',
          }}>
            <span style={{ fontSize: 15, opacity: 0.8 }}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {sub === 'session'   && <TrainSession exercises={exercises} workoutLogs={workoutLogs} addWorkoutLog={addWorkoutLog} updateWorkoutLog={updateWorkoutLog} removeWorkoutLog={removeWorkoutLog} splitNames={splitNames} todaySplitType={todaySplitType} progression={computeProgression} musclesFor={musclesFor} />}
        {sub === 'overload'  && <OverloadCoach workoutLogs={workoutLogs} addWorkoutLog={addWorkoutLog} exercises={exercises} saveExercises={saveExercisesDoc} splitNames={splitNames} saveSplitNames={saveSplitNamesDoc} todaySplitType={todaySplitType} />}
        {sub === 'splits'    && <SplitPlanner programs={programs} addProgram={addProgram} updateProgram={updateProgram} removeProgram={removeProgram} exercises={exercises} splitNames={splitNames} />}
        {sub === 'exercises' && <ExercisesLibrary exercises={exercises} saveExercises={saveExercisesDoc} />}
        {sub === 'muscles'   && <MuscleRanking workoutLogs={workoutLogs} settings={settings} />}
        {sub === 'calendar'  && <WorkoutCalendar workoutLogs={workoutLogs} />}
      </div>
    </div>
  );
}

