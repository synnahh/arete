//  MobileWorkout.jsx  Progressive overload workout logger for iOS PWA 
import { useState, useMemo } from 'react';
import { useCollection }  from '../../supabase/useCollection.js';
import { useDocument }    from '../../supabase/useDocument.js';
import { STORAGE_KEYS }   from '../../utils/storage.js';
import { haptics }        from '../utils/haptics.js';
import {
  DEFAULT_OVERLOAD_EXERCISES,
  DEFAULT_SPLITS,
  computeProgression,
} from '../../tabs/Workout.jsx';
import { toLocalDateKey } from '../../utils/localDate.js';

const DAY_KEYS   = ['sun','mon','tue','wed','thu','fri','sat'];
const SPLIT_COLOURS = { push:'#e25d7a', pull:'#4a9eff', legs:'#f4a642', rest:'rgba(255,255,255,0.18)', custom:'#9b5de5' };
const ACTION_COLOURS = { 'ADD WEIGHT':'#4caf7d', 'HOLD':'#f59e0b', 'DROP WEIGHT':'#e05555', 'DELOAD':'#e8a13a', 'FIRST SET':'var(--accent)' };

function MCard({ children, style = {} }) {
  return (
    <div style={{ background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 14, overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

//  Reps grid 
function RepsGrid({ repsMin, repsMax, selected, onSelect }) {
  const options = Array.from({ length: repsMax + 4 - Math.max(1, repsMin - 2) }, (_, i) => Math.max(1, repsMin - 2) + i);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(r => {
        const inRange = r >= repsMin && r <= repsMax;
        const active  = selected === r;
        return (
          <button key={r} onClick={() => { haptics.light(); onSelect(r); }} style={{
            width: 38, height: 38, borderRadius: 10,
            border: active ? '2px solid var(--accent)' : `1px solid ${inRange ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'}`,
            background: active ? 'var(--active-bg)' : inRange ? 'var(--hover-bg)' : 'transparent',
            color: active ? 'var(--accent)' : inRange ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: 13, fontWeight: active ? 700 : 400,
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}>{r}</button>
        );
      })}
    </div>
  );
}

//  Exercise row 
function ExerciseRow({ ex, workoutLogs, onLog, todayLog }) {
  const [expanded, setExpanded] = useState(false);
  const [weight,   setWeight]   = useState(null);
  const [reps,     setReps]     = useState(null);
  const [saving,   setSaving]   = useState(false);

  const prog = useMemo(() => computeProgression(ex, workoutLogs), [ex, workoutLogs]);

  // Initialise weight from progression when expanding
  function toggle() {
    haptics.tap();
    if (!expanded && weight === null) setWeight(prog.nextWeight);
    setExpanded(e => !e);
  }

  async function logSet() {
    if (reps === null) return;
    setSaving(true);
    haptics.success();
    const w = ex.bodyweight ? 0 : (weight ?? prog.nextWeight);
    await onLog({ exerciseName: ex.name, topSet: { weight: w, reps }, date: toLocalDateKey(new Date()) });
    setSaving(false);
    setExpanded(false);
  }

  const colour     = SPLIT_COLOURS[ex.day] || 'var(--accent)';
  const actionCol  = ACTION_COLOURS[prog.action] || 'var(--accent)';
  const logged     = todayLog != null;

  return (
    <div style={{ borderBottom: '0.5px solid var(--card-border)' }}>
      {/* Header row */}
      <button onClick={toggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 16px', background: 'none', border: 'none',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent', textAlign: 'left',
      }}>
        {/* Done indicator */}
        <div style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          border: logged ? 'none' : '1.5px solid var(--card-border)',
          background: logged ? '#4caf7d' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {logged && <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l2.5 2.5L9 1" stroke="var(--bg-base)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: logged ? 'var(--text-muted)' : 'var(--text-primary)',
            fontWeight: 500, textDecoration: logged ? 'line-through' : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ex.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {ex.bodyweight ? `BW · ${ex.repsMin}${ex.repsMax} reps` : `${prog.nextWeight}kg · ${ex.repsMin}${ex.repsMax} reps`}
          </div>
        </div>

        {/* Action badge */}
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
          padding: '3px 7px', borderRadius: 6,
          background: `${actionCol}20`, color: actionCol, flexShrink: 0,
        }}>{prog.action}</div>

        {/* Chevron */}
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" style={{
          transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0,
        }}>
          <path d="M1 1l5 5-5 5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Expanded logger */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Hint */}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{prog.hint}</div>

          {/* Weight stepper (skip for bodyweight) */}
          {!ex.bodyweight && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Weight (kg)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {[[-5],[-2.5],[-1.25]].map(([d]) => (
                  <button key={d} onClick={() => setWeight(w => Math.max(0, parseFloat(((w ?? prog.nextWeight) + d).toFixed(2))))}
                    style={{ flex: 1, height: 44, background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
                      borderRadius: d === -5 ? '10px 0 0 10px' : 'none', color: 'var(--text-secondary)',
                      fontSize: 12, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                    {d}
                  </button>
                ))}
                <div style={{ flex: 2, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--input-bg)', border: '0.5px solid var(--card-border)', borderLeft: 'none', borderRight: 'none',
                  fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {weight ?? prog.nextWeight}
                </div>
                {[[1.25],[2.5],[5]].map(([d]) => (
                  <button key={d} onClick={() => setWeight(w => parseFloat(((w ?? prog.nextWeight) + d).toFixed(2)))}
                    style={{ flex: 1, height: 44, background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
                      borderRadius: d === 5 ? '0 10px 10px 0' : 'none', borderLeft: 'none',
                      color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                    +{d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reps grid */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Reps</div>
            <RepsGrid repsMin={ex.repsMin} repsMax={ex.repsMax} selected={reps} onSelect={setReps} />
          </div>

          {/* Log button */}
          <button onClick={logSet} disabled={reps === null || saving} style={{
            padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 600,
            background: reps !== null ? '#4caf7d' : 'var(--hover-bg)',
            color: reps !== null ? '#fff' : 'var(--text-muted)',
            border: 'none', cursor: reps !== null ? 'pointer' : 'default',
            WebkitTapHighlightColor: 'transparent', transition: 'all 0.15s ease',
            opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Saving…' : reps !== null ? `Log ${ex.bodyweight ? '' : `${weight ?? prog.nextWeight}kg  `}${reps} reps S` : 'Select reps to log'}
          </button>
        </div>
      )}
    </div>
  );
}

//  Main 
export default function MobileWorkout() {
  const today    = toLocalDateKey(new Date());
  const todayKey = DAY_KEYS[new Date().getDay()];

  const { items: programs    = [] }                  = useCollection('programs',      STORAGE_KEYS.PROGRAMS);
  const { items: workoutLogs = [], add: addLog }      = useCollection('workout_logs',  STORAGE_KEYS.WORKOUT_LOGS);
  const { data:  storedEx }                           = useDocument('overload_exercises', STORAGE_KEYS.OVERLOAD_EXERCISES, null);

  const exercises  = (Array.isArray(storedEx) && storedEx.length) ? storedEx : DEFAULT_OVERLOAD_EXERCISES;
  const active     = programs.find(p => p.isActive) ?? null;
  const todayData  = active?.days?.[todayKey] ?? null;
  const splitType  = todayData?.splitType ?? null;
  const isRest     = !splitType || splitType === 'rest';
  const colour     = SPLIT_COLOURS[splitType] ?? 'var(--accent)';

  const todayExercises = useMemo(() =>
    isRest ? [] : exercises.filter(e => e.day === splitType),
  [exercises, splitType, isRest]);

  const todayLogs = useMemo(() =>
    workoutLogs.filter(l => l.date === today),
  [workoutLogs, today]);

  const doneCount = todayExercises.filter(ex =>
    todayLogs.some(l => l.exerciseName === ex.name)
  ).length;

  async function handleLog(entry) {
    await addLog({ ...entry, createdAt: new Date().toISOString() });
  }

  //  No program 
  if (!active) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <MCard style={{ padding: '20px 18px' }}>
        <div style={{ fontSize: 15, color: 'var(--text-primary)', marginBottom: 8 }}>No active program</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Set up a workout program on your desktop to start logging here.
        </div>
      </MCard>
    </div>
  );

  //  Rest day 
  if (isRest) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <MCard style={{ padding: '28px 18px', textAlign: 'center' }}>
<div style={{ fontSize: 32, marginBottom: 12 }}>🏋️</div>
        <div style={{ fontSize: 18, fontWeight: 300, color: 'var(--text-primary)', marginBottom: 6 }}>Rest Day</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{active.name} · {active.days?.[todayKey]?.label || 'Recovery'}</div>
      </MCard>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Today's split card */}
      <div style={{
        padding: '16px 18px', borderRadius: 14,
        background: `${colour}14`, border: `0.5px solid ${colour}35`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: colour, marginBottom: 4 }}>Today's Workout</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
            {todayData?.label || splitType}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {active.name} · {todayExercises.length} exercises
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 200, color: colour }}>{doneCount}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>of {todayExercises.length} done</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--hover-bg)', borderRadius: 2 }}>
        <div style={{
          height: '100%', borderRadius: 2, background: colour,
          width: `${todayExercises.length ? (doneCount / todayExercises.length * 100) : 0}%`,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Exercise list */}
      <MCard style={{ padding: 0 }}>
        {todayExercises.map((ex, i) => {
          const todayLog = todayLogs.find(l => l.exerciseName === ex.name) ?? null;
          return (
            <ExerciseRow
              key={ex.id}
              ex={ex}
              workoutLogs={workoutLogs}
              todayLog={todayLog}
              onLog={handleLog}
            />
          );
        })}
        {todayExercises.length === 0 && (
          <div style={{ padding: '20px 18px', fontSize: 13, color: 'var(--text-muted)' }}>
            No exercises found for {splitType} split.
          </div>
        )}
      </MCard>

      {/* All done state */}
      {doneCount === todayExercises.length && todayExercises.length > 0 && (
        <MCard style={{ padding: '20px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>x </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#4caf7d', marginBottom: 4 }}>Session Complete!</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>All {todayExercises.length} exercises logged.</div>
        </MCard>
      )}
    </div>
  );
}


