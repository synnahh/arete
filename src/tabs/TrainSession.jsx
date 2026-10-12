//  Train · Session  Strong/Liftoff-style logger. Today's exercises are
//  pre-filled from progressive overload (target weight, reps, last time's
//  sets as a ghost); one tap on ✓ logs a set, starts the rest timer and
//  checks for a PR. Logic: src/domain/training.js. Data: workout_logs rows,
//  one per exercise per day, same shape every other screen already reads.
import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { toLocalDateKey } from '../utils/localDate.js';
import {
  bests, detectPR, plannedRows, previousSets, restSeconds, setsOf, todaysLog, topSetOf, volume, recommendedSets,
} from '../domain/training.js';
import { plateaus, applyReadiness, liftHistory, validRpe, sessionsOf } from '../domain/progression.js';
import LiftSessions from '../components/LiftSessions.jsx';
import { isBarbell, platesFor, warmupSets, parsePlates, barFrom, DEFAULT_PLATES_KG } from '../domain/plates.js';
import { updateSettings } from '../utils/settingsStore.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import LiftChart from '../components/LiftChart.jsx';
import StrengthCard from '../components/StrengthCard.jsx';
import { useRecovery } from '../hooks/useRecovery.js';
import { WEEK, dayExercises, withDayTargets, materialize, sessionChoices, sessionDayKey, dayKeyFromDate } from '../domain/splits.js';

const today = () => toLocalDateKey(new Date());
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const haptic = (ms = 15) => { try { navigator.vibrate?.(ms); } catch {} };
const toast = (message, type = 'success') =>
  window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type } }));

// Per-viewer conveniences that survive switching tabs.
let restUntil = 0;
let restTotal = 0;
let sessionStartedAt = null;
const readPref = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const writePref = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

const label = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--text-secondary)',
};
const numInput = {
  width: '100%', minWidth: 0, boxSizing: 'border-box', height: 38, padding: '0 8px', borderRadius: 9,
  background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)', fontSize: 15, textAlign: 'center',
};
const pill = (on) => ({
  minHeight: 36, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
  border: `0.5px solid ${on ? 'var(--tab-accent)' : 'var(--card-border)'}`,
  background: on ? 'color-mix(in srgb, var(--tab-accent) 14%, transparent)' : 'transparent',
  color: on ? 'var(--tab-accent)' : 'var(--text-secondary)', fontWeight: on ? 600 : 500,
});
const ACTION_COLOUR = { 'ADD WEIGHT': '#4caf7d', HOLD: 'var(--text-secondary)', 'DROP WEIGHT': '#e25d7a', DELOAD: '#e8a13a', 'FIRST SET': 'var(--tab-accent)' };

//  Rest timer
function RestTimer({ onDone }) {
  const [, tick] = useState(0);
  const active = restUntil > Date.now();
  // Ticks only while a rest is running; idle costs nothing.
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => {
      if (restUntil && Date.now() >= restUntil) {
        restUntil = 0;
        haptic([120, 60, 120]);
        onDone();
      }
      tick(n => n + 1);
    }, 250);
    return () => clearInterval(t);
  }, [active, onDone]);

  if (!restUntil) return null;
  const left = Math.ceil((restUntil - Date.now()) / 1000);
  const pct = restTotal ? Math.max(0, left / restTotal) : 0;
  const adjust = (d) => { restUntil = Math.max(Date.now() + 1000, restUntil + d * 1000); restTotal = Math.max(restTotal + d, 1); tick(n => n + 1); };

  return (
    <div role="timer" aria-live="off" style={{
      position: 'sticky', bottom: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', margin: '0 -4px', borderRadius: 14,
      background: 'var(--bg-sidebar)', border: '0.5px solid var(--card-border)',
      boxShadow: '0 -6px 24px rgba(0,0,0,0.35)',
    }}>
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r="14" fill="none" stroke="var(--card-border)" strokeWidth="3.5" />
        <circle cx="17" cy="17" r="14" fill="none" stroke="var(--tab-accent)" strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray="88" strokeDashoffset={88 * (1 - pct)} transform="rotate(-90 17 17)" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <span style={label}>Rest</span>
        <span className="val-num" style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.1 }}>{fmt(left)}</span>
      </div>
      <button type="button" onClick={() => adjust(-15)} style={pill(false)} aria-label="Rest 15 seconds less">−15</button>
      <button type="button" onClick={() => adjust(15)} style={pill(false)} aria-label="Rest 15 seconds more">+15</button>
      <button type="button" onClick={() => { restUntil = 0; tick(n => n + 1); }} style={pill(true)}>Skip</button>
    </div>
  );
}

// Bar weight and plate set, saved in settings (barKg, platesKg) so they follow you.
const readEquipment = () => {
  const s = storage.get(STORAGE_KEYS.SETTINGS, {}) || {};
  return { bar: barFrom(s.barKg), plates: Array.isArray(s.platesKg) && s.platesKg.length ? s.platesKg : DEFAULT_PLATES_KG };
};
function useEquipment() {
  const [eq, setEq] = useState(readEquipment);
  useEffect(() => {
    const on = () => setEq(readEquipment());
    window.addEventListener('valerie:settings-changed', on);
    return () => window.removeEventListener('valerie:settings-changed', on);
  }, []);
  return eq;
}

function EquipmentSettings({ eq }) {
  const [text, setText] = useState(eq.plates.join(', '));
  const save = () => { const p = parsePlates(text); if (p) updateSettings({ platesKg: p }); else setText(eq.plates.join(', ')); };
  return (
    <details style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
      <summary style={{ cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center' }}>Bar {eq.bar} kg · plates {eq.plates.join(' ')}</summary>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', paddingTop: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={label}>Bar (kg)</span>
          <select value={eq.bar} onChange={e => updateSettings({ barKg: Number(e.target.value) })} style={{ ...numInput, width: 96, textAlign: 'left' }}>
            {[10, 15, 20, 25].map(b => <option key={b} value={b}>{b} kg</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
          <span style={label}>Plates you own (kg, per side)</span>
          <input value={text} onChange={e => setText(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); }}
            aria-label="Plates you own in kilograms" style={{ ...numInput, textAlign: 'left' }} />
        </label>
      </div>
    </details>
  );
}

//  One exercise card
function ExerciseCard({ ex, prog, rows, onChange, onTick, onRate, onAddSet, onRemoveSet, prs, compact, history, sessions = [], rec = null, eq, alternatives = [], onReplace }) {
  const doneSets = rows.filter(r => r.done);
  const [showChart, setShowChart] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const barbell = !ex.bodyweight && isBarbell(ex.name);
  const workKg = Number(rows[0]?.weight) || prog.nextWeight;
  const plates = barbell ? platesFor(workKg, { bar: eq.bar, plates: eq.plates }) : null;
  const warmups = barbell ? warmupSets(workKg, { bar: eq.bar }) : [];
  return (
    <section aria-label={ex.name} style={{
      display: 'flex', flexDirection: 'column', gap: 10, padding: compact ? 14 : 16, borderRadius: 16,
      background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>{ex.name}</span>
        <span className="val-num" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{doneSets.length}/{rows.length} sets</span>
      </div>
      {onReplace && doneSets.length === 0 && (
        <div>
          <button type="button" aria-expanded={swapping} onClick={() => setSwapping(s => !s)} style={{ background: 'none', border: 'none', padding: 0, minHeight: 28, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--accent)' }}>Replace</button>
          {swapping && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {alternatives.length === 0
                ? <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>No other exercise in your library trains the same muscle. Add one from the exercise database in Exercises.</div>
                : alternatives.slice(0, 6).map(a => (
                  <button key={a.id} type="button" onClick={() => { setSwapping(false); onReplace(a); }} style={{ textAlign: 'left', minHeight: 38, padding: '0 12px', borderRadius: 10, border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer' }}>{a.name}</button>
                ))}
            </div>
          )}
        </div>
      )}
      {rec && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{rec.text}</div>}
      <div className="val-num" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        TARGET {ex.bodyweight ? 'BW' : `${prog.nextWeight} kg`} × {ex.repsMin}–{ex.repsMax} ·{' '}
        <span style={{ color: ACTION_COLOUR[prog.action] ?? 'var(--text-secondary)', fontWeight: 600 }}>{prog.action}</span>
        {prog.plateau?.status && prog.plateau.status !== 'none' && (
          <span style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#e8a13a', border: '0.5px solid #e8a13a' }}>
            {prog.plateau.status === 'regressing' ? 'SLIDING' : 'STALLED'} {prog.plateau.sessions}
          </span>
        )}
      </div>
      {prog.hint && prog.action !== 'FIRST SET' && (
        <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{prog.hint}</div>
      )}

      {barbell && (plates || warmups.length > 0) && (
        <div className="val-num" style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          {plates && workKg > eq.bar && (
            <div>Per side for {plates.total} kg: {plates.perSide.length ? plates.perSide.join(' + ') : 'bar only'}{plates.short > 0 ? ` (${plates.short} kg short)` : ''}</div>
          )}
          {warmups.length > 0 && <div>Warm-up: {warmups.map(w => `${w.weight}×${w.reps}`).join(' · ')}</div>}
        </div>
      )}

      <div role="table" aria-label={`${ex.name} sets`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div role="row" style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) 76px 64px 40px', gap: 8, alignItems: 'center', ...label, fontSize: 10.5 }}>
          <span role="columnheader">Set</span><span role="columnheader">Previous</span>
          <span role="columnheader" style={{ textAlign: 'center' }}>kg</span><span role="columnheader" style={{ textAlign: 'center' }}>Reps</span>
          <span role="columnheader" aria-label="Done" />
        </div>
        {rows.map((r, i) => {
          const pr = prs[i];
          return (
            <Fragment key={i}>
            <div role="row" style={{
              display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) 76px 64px 40px', gap: 8, alignItems: 'center',
              padding: '4px 6px', margin: '0 -6px', borderRadius: 10,
              background: r.done ? 'color-mix(in srgb, var(--tab-accent) 10%, transparent)' : 'transparent',
            }}>
              <span className="val-num" style={{ fontSize: 14, color: r.done ? 'var(--tab-accent)' : 'var(--text-secondary)' }}>{i + 1}</span>
              <span className="val-num" style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.prev ? `${ex.bodyweight ? 'BW' : r.prev.weight} × ${r.prev.reps}` : '—'}
                {pr && <span className="val-pop" style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', background: 'var(--tab-accent)', color: 'var(--on-tab-accent)' }}>PR</span>}
              </span>
              <input aria-label={`Set ${i + 1} weight`} inputMode="decimal" disabled={ex.bodyweight || r.done} value={ex.bodyweight ? 'BW' : r.weight}
                onFocus={e => e.target.select()} onChange={e => onChange(i, { weight: e.target.value })} style={{ ...numInput, opacity: r.done ? 0.75 : 1 }} />
              <input aria-label={`Set ${i + 1} reps`} inputMode="numeric" disabled={r.done} value={r.reps}
                onFocus={e => e.target.select()} onChange={e => onChange(i, { reps: e.target.value })} style={{ ...numInput, opacity: r.done ? 0.75 : 1 }} />
              <button type="button" onClick={() => onTick(i)} aria-pressed={r.done}
                aria-label={r.done ? `Undo set ${i + 1}` : `Log set ${i + 1}`}
                className={r.justDone ? 'val-signature val-rep-kick' : undefined}
                style={{
                  width: 38, height: 38, borderRadius: 999, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: r.done ? 'none' : '1.5px solid var(--card-border)',
                  background: r.done ? 'var(--tab-accent)' : 'transparent', color: r.done ? 'var(--on-tab-accent)' : 'var(--text-secondary)',
                }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5 10 17l9-10" /></svg>
              </button>
            </div>
            {r.done && (
              <div role="group" aria-label={`Set ${i + 1} effort`} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px 4px 36px', margin: '-2px 0 2px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginRight: 4 }} title="Rate of perceived exertion: 10 means nothing left in the tank">How hard?</span>
                {[6, 7, 8, 9, 10].map(v => {
                  const on = validRpe(r.rpe) === v;
                  return (
                    <button key={v} type="button" aria-pressed={on} aria-label={`RPE ${v}`} onClick={() => onRate(i, v)} style={{
                      minWidth: 32, height: 28, borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, WebkitTapHighlightColor: 'transparent',
                      border: `0.5px solid ${on ? 'var(--tab-accent)' : 'var(--card-border)'}`, fontWeight: on ? 700 : 500,
                      background: on ? 'var(--tab-accent)' : 'transparent', color: on ? 'var(--on-tab-accent)' : 'var(--text-secondary)',
                    }}>{v}</button>
                  );
                })}
              </div>
            )}
            </Fragment>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onAddSet} style={pill(false)}>+ Add set</button>
        {rows.length > 1 && !rows[rows.length - 1].done && (
          <button type="button" onClick={onRemoveSet} style={pill(false)}>Remove set</button>
        )}
        {(history.length > 0 || sessions.length > 0) && (
          <button type="button" aria-expanded={showChart} onClick={() => setShowChart(v => !v)} style={{ ...pill(showChart), marginLeft: 'auto' }}>History</button>
        )}
      </div>
      {showChart && (<><LiftChart history={history} /><LiftSessions sessions={sessions} /></>)}
    </section>
  );
}

//  Session
export default function TrainSession({
  exercises, workoutLogs, addWorkoutLog, updateWorkoutLog, removeWorkoutLog,
  splitNames, todaySplitType, progression, musclesFor, compact = false, program = null, updateProgram = null,
}) {
  const date = today();
  const [gym, setGymState] = useState(() => readPref('valerie_train_gym', 'home'));
  // With an active program the session days are the program's own workout days
  // (week-day keys, e.g. 'mon'); without one it falls back to push / pull / legs.
  const [day, setDay] = useState(() => (program ? (sessionDayKey(program, dayKeyFromDate()) ?? 'push') : (['push', 'pull', 'legs'].includes(todaySplitType) ? todaySplitType : 'push')));
  useEffect(() => {
    if (!program) { if (WEEK.includes(day)) setDay(['push', 'pull', 'legs'].includes(todaySplitType) ? todaySplitType : 'push'); return; }
    const d = program.days?.[day];
    if (!WEEK.includes(day) || !d || d.splitType === 'rest') setDay(sessionDayKey(program, dayKeyFromDate()) ?? 'push');
  }, [program, day, todaySplitType]);
  const [extraIds, setExtraIds] = useState([]);
  const [hiddenIds, setHiddenIds] = useState([]);
  // exId → rows. Mirrored in a ref and updated synchronously so two taps in
  // the same frame each see the other's set (state alone would be stale).
  const planRef = useRef({});
  const [plan, setPlanState] = useState({});
  const setPlan = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(planRef.current) : updater;
    planRef.current = next;
    setPlanState(next);
  }, []);
  const [prs, setPrs] = useState({});            // exId → { rowIndex: pr }
  const [, rerender] = useState(0);
  const logsRef = useRef(workoutLogs);
  logsRef.current = workoutLogs;
  const rowIds = useRef({});                     // exId → today's workout_logs id
  const queue = useRef({});                      // exId → pending write chain
  // Last server-confirmed rows and newest optimistic mutation per exercise.
  // If queued writes fail, only the newest mutation may repair the UI, and it
  // repairs to confirmed state (not another optimistic snapshot).
  const confirmedRows = useRef({});
  const mutationRevision = useRef({});

  const setGym = (g) => { setGymState(g); writePref('valerie_train_gym', g); };
  const onRestDone = useCallback(() => toast('Rest done — next set'), []);

  const recovery = useRecovery();
  const equipment = useEquipment();

  // What the coach knows (goal, experience) shapes the recommended sets; the rest time is yours to set.
  const saved = storage.get(STORAGE_KEYS.SETTINGS, {}) || {};
  const recPrefs = { goal: saved.coachGoal?.template ?? null, experience: saved.coachIntake?.answers?.experience ?? null };
  const [restPref, setRestPref] = useState(() => Number(saved.restSeconds) || 0);   // 0 = automatic
  const chooseRest = (v) => { setRestPref(v); updateSettings({ restSeconds: v || null }); };

  const todays = useMemo(() => {
    const gymOk = (e) => e.gym === gym || e.gym === 'both';
    const base = (program && WEEK.includes(day)
      ? withDayTargets(dayExercises(program.days?.[day], exercises).filter(gymOk), program.days?.[day])
      : exercises.filter(e => gymOk(e) && e.day === day)).filter(e => !hiddenIds.includes(e.id));
    const extra = exercises.filter(e => extraIds.includes(e.id) && !base.some(b => b.id === e.id));
    return [...base, ...extra];
  }, [exercises, gym, day, extraIds, hiddenIds, program]);

  // Swap an exercise for another that trains the same muscle (equipment busy, joint sore).
  // With a program the swap is saved into that day, so next week has it too.
  const alternativesFor = (ex) => {
    const m = musclesFor(ex)?.[0];
    return exercises.filter(e => e.id !== ex.id && !todays.some(t => t.id === e.id) && (e.gym === gym || e.gym === 'both') && musclesFor(e)?.[0] === m);
  };
  const replaceExercise = async (oldEx, newEx) => {
    setHiddenIds(h => [...h, oldEx.id]);
    setExtraIds(ids => [...ids, newEx.id]);
    const d = program?.days?.[day];
    if (program && updateProgram && d && WEEK.includes(day)) {
      const ids = materialize(d, exercises).exerciseIds.map(x => (x === oldEx.id ? newEx.id : x));
      await updateProgram(program.id, { days: { ...program.days, [day]: { ...d, exerciseIds: ids } } });
    }
  };

  // What we pre-filled for each exercise (weight x reps per row), so a later change of
  // readiness only rewrites rows you have not touched.
  const autoPlan = useRef({});
  const sig = (rows) => rows.map(r => `${r.weight}x${r.reps}`).join('|');

  // Build (or resume) rows for exercises not yet planned this session.
  useEffect(() => {
    setPlan(prev => {
      let changed = false;
      const next = { ...prev };
      for (const ex of todays) {
        if (next[ex.id]) continue;
        const prog = applyReadiness(progression(ex, workoutLogs.filter(l => l.date < date)), recovery);
        const rows = plannedRows(ex, prog, previousSets(workoutLogs, ex.name, date), recommendedSets(ex, recPrefs).sets);
        const existing = todaysLog(workoutLogs, ex.name, date);
        if (existing) {
          rowIds.current[ex.id] = existing.id;
          setsOf(existing).forEach((s, i) => {
            if (!rows[i]) rows[i] = { weight: s.weight, reps: s.reps, prev: null, done: false };
            rows[i] = { ...rows[i], weight: s.weight, reps: s.reps, rpe: validRpe(s.rpe) ?? '', done: true };
          });
        }
        confirmedRows.current[ex.id] = rows.map(r => ({ ...r, justDone: false }));
        if (!existing) autoPlan.current[ex.id] = sig(rows);
        next[ex.id] = rows;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [todays, workoutLogs, date, progression, setPlan]);

  // Sleep logged (or loaded) after the screen opened: refresh pre-filled rows the
  // lifter has not touched, so a low-readiness hold is not missed. Never overwrites
  // an edit or a logged set.
  useEffect(() => {
    setPlan(prev => {
      let changed = false;
      const next = { ...prev };
      for (const ex of todays) {
        const rows = prev[ex.id];
        const auto = autoPlan.current[ex.id];
        if (!rows || auto == null || rows.some(r => r.done) || sig(rows) !== auto) continue;
        const fresh = plannedRows(ex, applyReadiness(progression(ex, workoutLogs.filter(l => l.date < date)), recovery), previousSets(workoutLogs, ex.name, date), recommendedSets(ex, recPrefs).sets);
        if (sig(fresh) === auto) continue;
        autoPlan.current[ex.id] = sig(fresh);
        confirmedRows.current[ex.id] = fresh.map(r => ({ ...r, justDone: false }));
        next[ex.id] = fresh;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [recovery.status, recovery.band]); // eslint-disable-line react-hooks/exhaustive-deps

  const progFor = (ex) => applyReadiness(progression(ex, workoutLogs.filter(l => l.date < date)), recovery);
  // Lifts (any day) with no new best for weeks: one place to see what needs a deload.
  const stalled = useMemo(() => plateaus(exercises, workoutLogs.filter(l => l.date < date), date), [exercises, workoutLogs, date]);

  const setRows = (exId, fn) => setPlan(p => ({ ...p, [exId]: fn(p[exId] ?? []) }));

  // Serialise writes per exercise so quick ticks never race or duplicate.
  function persist(ex, rows) {
    const sets = rows.filter(r => r.done).map(r => {
      const rpe = validRpe(r.rpe);
      return { weight: Number(r.weight) || 0, reps: Number(r.reps) || 0, ...(rpe != null ? { rpe } : {}) };
    });
    const payload = {
      date, exerciseName: ex.name, muscle: ex.day, muscles: musclesFor(ex),
      topSet: topSetOf(sets), sets,
    };
    const run = async () => {
      const id = rowIds.current[ex.id] ?? todaysLog(logsRef.current, ex.name, date)?.id;
      if (!sets.length) {
        if (id) { const ok = await removeWorkoutLog(id); if (ok) delete rowIds.current[ex.id]; return ok; }
        return true;
      }
      if (id) return updateWorkoutLog(id, payload);
      const newId = await addWorkoutLog(payload);
      if (newId) rowIds.current[ex.id] = newId;
      return !!newId;
    };
    const chain = (queue.current[ex.id] ?? Promise.resolve()).then(run, run);
    queue.current[ex.id] = chain.catch(() => false);
    return queue.current[ex.id];
  }

  async function tick(ex, i) {
    const rows = planRef.current[ex.id];
    const row = rows[i];
    const undo = row.done;
    if (!undo && !ex.bodyweight && !(Number(row.weight) >= 0 && row.weight !== '')) return;
    if (!undo && !(Number(row.reps) > 0)) return;

    const nextRows = rows.map((r, j) => j === i ? { ...r, done: !undo, justDone: !undo } : { ...r, justDone: false });
    const revision = (mutationRevision.current[ex.id] ?? 0) + 1;
    mutationRevision.current[ex.id] = revision;
    setRows(ex.id, () => nextRows);
    haptic();

    let pr = null;
    if (!undo) {
      const history = bests(logsRef.current, ex.name, { excludeDate: date });
      const todaySets = rows.filter((r, j) => r.done && j !== i).map(r => ({ weight: Number(r.weight) || 0, reps: Number(r.reps) || 0 }));
      pr = detectPR({ weight: Number(row.weight) || 0, reps: Number(row.reps) }, { history, todaySets });
      if (!sessionStartedAt) sessionStartedAt = Date.now();
      restTotal = restSeconds(ex, restPref);
      restUntil = Date.now() + restTotal * 1000;
    }
    setPrs(p => ({ ...p, [ex.id]: { ...(p[ex.id] ?? {}), [i]: pr } }));

    const ok = await persist(ex, nextRows);
    if (!ok) {
      // A newer queued write includes this row and owns recovery. Rolling back
      // an older failure here would make the UI disagree with that later save.
      if (mutationRevision.current[ex.id] !== revision) return;
      setRows(ex.id, () => (confirmedRows.current[ex.id] ?? []).map(r => ({ ...r, justDone: false })));
      setPrs(p => ({ ...p, [ex.id]: {} }));
      restUntil = 0;
      restTotal = 0;
      rerender(n => n + 1);
      return;
    }
    confirmedRows.current[ex.id] = nextRows.map(r => ({ ...r, justDone: false }));
    if (pr) {
      haptic([30, 40, 60]);
      toast(`New PR · ${ex.name} ${ex.bodyweight ? 'BW' : `${row.weight} kg`} × ${row.reps}`);
    }
    rerender(n => n + 1);
  }

  // How hard a finished set felt (RPE). Saved with the set; tapping the same number clears it.
  async function rate(ex, i, value) {
    const rows = planRef.current[ex.id];
    if (!rows?.[i]?.done) return;
    const rpe = validRpe(rows[i].rpe) === value ? '' : value;
    const nextRows = rows.map((r, j) => (j === i ? { ...r, rpe } : r));
    const revision = (mutationRevision.current[ex.id] ?? 0) + 1;
    mutationRevision.current[ex.id] = revision;
    setRows(ex.id, () => nextRows);
    const ok = await persist(ex, nextRows);
    if (ok) { confirmedRows.current[ex.id] = nextRows.map(r => ({ ...r, justDone: false })); return; }
    if (mutationRevision.current[ex.id] !== revision) return;
    setRows(ex.id, () => (confirmedRows.current[ex.id] ?? []).map(r => ({ ...r, justDone: false })));
    rerender(n => n + 1);
  }

  // Session totals
  const allDone = todays.flatMap(ex => (plan[ex.id] ?? []).filter(r => r.done).map(r => ({ weight: Number(r.weight) || 0, reps: Number(r.reps) || 0 })));
  const prCount = Object.values(prs).reduce((s, m) => s + Object.values(m).filter(Boolean).length, 0);
  const minutes = sessionStartedAt ? Math.round((Date.now() - sessionStartedAt) / 60000) : 0;
  const others = exercises.filter(e => !todays.some(t => t.id === e.id));

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: compact ? 16 : '20px 28px 28px', maxWidth: 760, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h1 style={{ margin: 0, fontSize: compact ? 26 : 30, fontWeight: 700, color: 'var(--text-primary)' }}>{program && WEEK.includes(day) ? (program.days?.[day]?.label || 'Workout') : (splitNames[day] ?? day)}</h1>
            <span className="val-num" style={{ fontSize: 12, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
              {allDone.length} SETS · {volume(allDone).toLocaleString()} KG{minutes ? ` · ${minutes} MIN` : ''}{prCount ? ` · ${prCount} PR${prCount > 1 ? 'S' : ''}` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(program ? sessionChoices(program, exercises).map(c => ({ id: c.key, label: c.label })) : ['push', 'pull', 'legs'].map(d => ({ id: d, label: splitNames[d] ?? d }))).map(c => (
              <button key={c.id} type="button" aria-pressed={day === c.id} onClick={() => { setDay(c.id); setExtraIds([]); setHiddenIds([]); }} style={pill(day === c.id)}>{c.label}</button>
            ))}
            <button type="button" onClick={() => setGym(gym === 'home' ? 'commercial' : 'home')} style={pill(false)}
              aria-label={`Gym: ${gym === 'home' ? 'Home' : 'Commercial'}. Switch`}>
              {gym === 'home' ? 'Home gym' : 'Commercial'}
            </button>
          </div>
        </div>

        <div role="group" aria-label="Rest time between sets" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={label}>Rest</span>
          {[[0, 'Auto'], [60, '60 s'], [90, '90 s'], [120, '2 min'], [180, '3 min']].map(([v, text]) => (
            <button key={v} type="button" aria-pressed={restPref === v} onClick={() => chooseRest(v)} style={pill(restPref === v)}>{text}</button>
          ))}
        </div>

        {todays.some(e => !e.bodyweight && isBarbell(e.name)) && <EquipmentSettings key={equipment.plates.join(',')} eq={equipment} />}

        {recovery.status === 'ok' && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
            <span className="val-num" style={{ fontSize: 15, fontWeight: 600, color: recovery.band === 'push' ? '#4caf7d' : recovery.band === 'go-easy' ? '#e25d7a' : '#e8a13a' }}>{recovery.score}</span>
            <span><strong style={{ color: 'var(--text-primary)' }}>{recovery.label}.</strong> {recovery.advice}</span>
          </div>
        )}

        <StrengthCard logs={workoutLogs} />

        {stalled.length > 0 && (
          <div role="status" style={{ padding: '10px 14px', borderRadius: 14, border: '0.5px solid #e8a13a', background: 'color-mix(in srgb, #e8a13a 8%, transparent)', fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)' }}>
            <strong style={{ color: '#e8a13a' }}>{stalled.length === 1 ? '1 lift has stalled' : `${stalled.length} lifts have stalled`}.</strong>{' '}
            {stalled.slice(0, 3).map(s => `${s.name} (${s.sessions} sessions${s.action === 'DELOAD' ? `, deload to ${s.nextWeight} kg` : ''})`).join('; ')}.
          </div>
        )}

        {todays.length === 0 && (
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '24px 0' }}>
            {program ? 'No exercises on this day for this gym. Edit the day in Split, or add one below.' : 'No exercises for this day and gym. Add some in Exercises, or add one below.'}
          </div>
        )}

        {todays.map(ex => plan[ex.id] && (
          <ExerciseCard key={ex.id} ex={ex} prog={progFor(ex)} rows={plan[ex.id]} prs={prs[ex.id] ?? {}} compact={compact}
            onChange={(i, patch) => setRows(ex.id, rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r))}
            onTick={(i) => tick(ex, i)} onRate={(i, v) => rate(ex, i, v)}
            onAddSet={() => setRows(ex.id, rs => [...rs, { ...(rs[rs.length - 1] ?? { weight: 0, reps: ex.repsMin }), prev: null, done: false, justDone: false, rpe: '' }])}
            onRemoveSet={() => setRows(ex.id, rs => rs.slice(0, -1))} history={liftHistory(workoutLogs, ex.name)} sessions={sessionsOf(workoutLogs.filter(l => l.date < date), ex.name)} rec={recommendedSets(ex, recPrefs)} eq={equipment}
            alternatives={alternativesFor(ex)} onReplace={(n) => replaceExercise(ex, n)} />
        ))}

        {others.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={label}>Add exercise</span>
            <select value="" onChange={e => e.target.value && setExtraIds(ids => [...ids, e.target.value])}
              style={{ ...numInput, textAlign: 'left', flex: 1, fontFamily: 'inherit' }}>
              <option value="">Choose…</option>
              {others.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
        )}

        <RestTimer onDone={onRestDone} />
      </div>
    </div>
  );
}
