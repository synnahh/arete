//  Train · Session  Strong/Liftoff-style logger. Today's exercises are
//  pre-filled from progressive overload (target weight, reps, last time's
//  sets as a ghost); one tap on ✓ logs a set, starts the rest timer and
//  checks for a PR. Logic: src/domain/training.js. Data: workout_logs rows,
//  one per exercise per day, same shape every other screen already reads.
//
//  Layout: a live summary at the top (sets, volume, time, PRs, a ring for the whole session);
//  the exercise you are on is highlighted and its next set is marked, with one-tap weight and
//  rep nudges; finished exercises fold into one line; settings live in a sheet behind the gear.
//  Typed-but-unlogged values and the start time survive a refresh (domain/sessionDraft.js); the
//  rest timer survives too (components/RestTimer.jsx).
import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { toLocalDateKey } from '../utils/localDate.js';
import {
  bests, detectPR, plannedRows, previousSets, restSeconds, setsOf, todaysLog, topSetOf, volume, recommendedSets,
} from '../domain/training.js';
import { plateaus, applyReadiness, liftHistory, validRpe, sessionsOf } from '../domain/progression.js';
import LiftSessions from '../components/LiftSessions.jsx';
import { isBarbell, platesFor, warmupOne, parsePlates, barFrom, DEFAULT_PLATES_KG } from '../domain/plates.js';
import { exerciseDetail } from '../domain/exerciseDetail.js';
import { updateSettings } from '../utils/settingsStore.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import LiftChart from '../components/LiftChart.jsx';
import StrengthCard from '../components/StrengthCard.jsx';
import { useRecovery } from '../hooks/useRecovery.js';
import { useSettingsValue } from '../hooks/useSettingsValue.js';
import { cleanTrainPrefs, effortOptions, effortLabel, ownRest } from '../domain/trainPrefs.js';
import ExerciseDemo from '../components/ExerciseDemo.jsx';
import { WEEK, dayExercises, withDayTargets, materialize, sessionChoices, sessionDayKey, dayKeyFromDate } from '../domain/splits.js';
import { startRest, stopRest } from '../components/RestTimer.jsx';   // the timer itself is mounted once by each app shell
import { AnimatedNumber, Collapse, ProgressBar, ProgressRing, Sheet, SlidingTabs, haptic as softHaptic } from '../components/Motion.jsx';
import { loadDraft, saveDraft, markStarted, clearDraft, applyDraft, loadWarmups, saveWarmups, clearWarmups, carryForward } from '../domain/sessionDraft.js';
import { haptics } from '../mobile/utils/haptics.js';

const today = () => toLocalDateKey(new Date());
const toast = (message, type = 'success', undo = null) =>
  window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type, ...(undo ? { undo } : {}) } }));

const readPref = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const writePref = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

const label = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--text-secondary)',
};
const numInput = {
  width: '100%', minWidth: 0, boxSizing: 'border-box', height: 42, padding: '0 6px', borderRadius: 10,
  background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)', fontSize: 16, textAlign: 'center',
  transition: 'border-color var(--dur-1) var(--ease-out), box-shadow var(--dur-1) var(--ease-out), opacity var(--dur-2) var(--ease-out)',
};
const ACTION_COLOUR = { 'ADD WEIGHT': 'var(--ok)', HOLD: 'var(--text-secondary)', 'DROP WEIGHT': 'var(--bad)', DELOAD: 'var(--warn)', 'FIRST SET': 'var(--tab-accent)' };
const GRID = '26px minmax(0,1fr) 74px 60px 44px';

const Glyph = ({ d, size = 18, w = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const GEAR = 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z';
const TICK = 'M5 12.5 10 17l9-10';
const CHEV = 'M6 9l6 6 6-6';

// How Train behaves for you. Saved in settings.train; every choice defaults to the old behaviour.
function TrainPrefsPanel({ prefs }) {
  const set = (patch) => updateSettings({ train: { ...prefs, ...patch } });
  const toggle = (key, text) => (
    <button key={key} type="button" className="ui-chip" aria-pressed={prefs[key]} onClick={() => set({ [key]: !prefs[key] })}>{text}</button>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>Effort after each set</span>
        <SlidingTabs mode="toggle" boxed label="Effort scale" value={prefs.effort} onChange={v => set({ effort: v })}
          items={[{ id: 'rpe', label: 'How hard (RPE)' }, { id: 'rir', label: 'Reps left' }, { id: 'off', label: 'Off' }]} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>Show and do</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {toggle('autoRest', 'Rest timer on each set')}
          {toggle('restVibrate', 'Buzz at rest end')}
          {toggle('restSound', 'Tone at rest end')}
          {toggle('warmups', 'Warm-up set')}
          {toggle('plates', 'Plate breakdown')}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>The buzz works on Android; iPhone web apps cannot vibrate. Cues play only while the app is open, but the timer stays right if you leave and come back.</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>Default sets (your program's own sets still win)</span>
        <SlidingTabs mode="toggle" boxed label="Default sets" value={prefs.defaultSets ?? 'auto'} onChange={v => set({ defaultSets: v === 'auto' ? null : v })}
          items={[{ id: 'auto', label: 'Auto' }, { id: 2, label: '2' }, { id: 3, label: '3' }, { id: 4, label: '4' }, { id: 5, label: '5' }]} />
      </div>
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
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>Bar</span>
        <select value={eq.bar} onChange={e => updateSettings({ barKg: Number(e.target.value) })} className="ui-input" style={{ width: 100, height: 44 }}>
          {[10, 15, 20, 25].map(b => <option key={b} value={b}>{b} kg</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 180 }}>
        <span style={label}>Plates you own (kg, per side)</span>
        <input value={text} onChange={e => setText(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); }}
          aria-label="Plates you own in kilograms" className="ui-input" />
      </label>
    </div>
  );
}

// Your own note and rest time for one exercise, saved on the exercise in your library.
function ExerciseTweaks({ ex, onEdit }) {
  const [note, setNote] = useState(ex.note || '');
  const rest = ownRest(ex);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>Note (seat setting, grip, a cue)</span>
        <input value={note} maxLength={140} onChange={e => setNote(e.target.value)} onBlur={() => note !== (ex.note || '') && onEdit({ note: note.trim() || null })}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} aria-label={`Note for ${ex.name}`} className="ui-input" />
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>Rest for this exercise</span>
        <div role="group" aria-label={`Rest time for ${ex.name}`} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[[null, 'Session'], [45, '45 s'], [60, '60 s'], [90, '90 s'], [120, '2 min'], [180, '3 min']].map(([v, text]) => (
            <button key={text} type="button" className="ui-chip" aria-pressed={rest === v} onClick={() => onEdit({ restSeconds: v })}>{text}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// The check button: the tick draws itself, the button pops once and a ring ripples out.
function SetCheck({ done, justDone, onClick, label: aria }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={done} aria-label={aria}
      className={`ui-check${done ? ' is-on' : ''}${justDone ? ' ui-confirm' : ''}`}
      style={{
        position: 'relative', width: 44, height: 44, cursor: 'pointer', border: done ? '1.5px solid transparent' : '1.5px solid var(--card-hover-border)',
        background: done ? 'var(--tab-accent)' : 'transparent', color: done ? 'var(--on-tab-accent)' : 'var(--text-muted)',
        transition: 'background-color var(--dur-1) var(--ease-out), border-color var(--dur-1) var(--ease-out), color var(--dur-1) var(--ease-out)',
      }}>
      {justDone && <span className="ui-ripple" aria-hidden="true" />}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        style={{ position: 'relative' }}><path d={TICK} style={done ? undefined : { strokeDashoffset: 0, opacity: 0.35 }} /></svg>
    </button>
  );
}

//  One exercise card. stage: 'current' (the one you are on), 'done' (all sets logged) or 'next'.
function ExerciseCard({ ex, prog, rows, onChange, onTick, onRate, onAddSet, onRemoveSet, prs, compact, history, sessions = [], rec = null, eq, alternatives = [], onReplace, prefs, onEdit = null, stage = 'next', index = 0, warm = [], onWarm }) {
  const doneSets = rows.filter(r => r.done);
  const [panel, setPanel] = useState(null);          // 'demo' | 'swap' | 'history' | 'tweak'
  const [openDone, setOpenDone] = useState(false);
  const [glow, setGlow] = useState(false);
  const barbell = !ex.bodyweight && isBarbell(ex.name);
  const workKg = Number(rows[0]?.weight) || prog.nextWeight;
  const plates = barbell ? platesFor(workKg, { bar: eq.bar, plates: eq.plates }) : null;
  const step0 = Number(ex.increment) || 2.5;
  const workReps = Number(rows[0]?.reps) || ex.repsMin;
  const one = warmupOne(workKg, { barbell, bar: eq.bar, step: step0, bodyweight: !!ex.bodyweight, workReps });
  const detail = exerciseDetail(ex.name);
  const setWarm = (fn) => onWarm?.(fn(warm));
  const addWarm = () => setWarm(w => [...w, { weight: String(one ? one.weight : (ex.bodyweight ? 0 : Math.round((workKg * 0.5) / step0) * step0)), reps: String(one ? one.reps : 5), done: false }]);
  const nextIdx = rows.findIndex(r => !r.done);
  const step = Number(ex.increment) || 2.5;
  const folded = stage === 'done' && !openDone;
  const prCount = Object.values(prs).filter(Boolean).length;
  const toggle = (p) => setPanel(v => (v === p ? null : p));

  // A PR lights the card once.
  const prKey = Object.entries(prs).filter(([, v]) => v).map(([k]) => k).join(',');
  useEffect(() => { if (!prKey) return undefined; setGlow(true); const t = setTimeout(() => setGlow(false), 950); return () => clearTimeout(t); }, [prKey]);

  const nudge = (i, field, delta) => {
    const cur = Number(rows[i]?.[field]) || 0;
    const next = Math.max(0, +(cur + delta).toFixed(2));
    onChange(i, { [field]: String(next) });
  };

  return (
    <section aria-label={`${ex.name}${stage === 'current' ? ', current exercise' : stage === 'done' ? ', done' : ''}`}
      className={`ui-card ui-enter${stage === 'current' ? ' is-focus' : ''}${glow ? ' ui-glow' : ''}`}
      style={{ '--i': Math.min(index, 6), display: 'flex', flexDirection: 'column', gap: folded ? 0 : 12, padding: compact ? 14 : 18,
        opacity: stage === 'next' ? 0.94 : 1 }}>

      {/* Header: name, progress, actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {stage === 'done' ? (
          <span className="ui-check is-on ui-scale" aria-hidden="true" style={{ width: 30, height: 30, flexShrink: 0, background: 'color-mix(in srgb, var(--ok) 18%, transparent)', color: 'var(--ok)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d={TICK} /></svg>
          </span>
        ) : (
          <ProgressRing value={rows.length ? doneSets.length / rows.length : 0} size={30} stroke={3}>
            <span className="t-num" style={{ fontSize: 10.5, fontWeight: 650, color: 'var(--text-secondary)' }}>{index + 1}</span>
          </ProgressRing>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: stage === 'current' ? 18 : 16, fontWeight: 650, color: 'var(--text-primary)', lineHeight: 1.25, transition: 'font-size var(--dur-2) var(--ease-out)' }}>{ex.name}</div>
          <div className="t-num" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {folded
              ? `${doneSets.length} sets · ${volume(doneSets.map(r => ({ weight: Number(r.weight) || 0, reps: Number(r.reps) || 0 }))).toLocaleString()} kg${prCount ? ` · ${prCount} PR` : ''}`
              : <>{ex.bodyweight ? 'BW' : `${prog.nextWeight} kg`} × {ex.repsMin}–{ex.repsMax} · <span style={{ color: ACTION_COLOUR[prog.action] ?? 'var(--text-secondary)', fontWeight: 600 }}>{prog.action}</span></>}
          </div>
        </div>
        {stage === 'done'
          ? <button type="button" className="ui-btn is-sm is-quiet is-icon" aria-expanded={openDone} aria-label={openDone ? `Fold ${ex.name}` : `Show ${ex.name} sets`} onClick={() => setOpenDone(v => !v)}><span className={`ui-chev${openDone ? ' is-open' : ''}`}><Glyph d={CHEV} /></span></button>
          : <span className="t-num" style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>{doneSets.length}/{rows.length}</span>}
      </div>

      <Collapse open={!folded}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: stage === 'done' ? 12 : 0 }}>
          {rows.length > 0 && <ProgressBar value={doneSets.length / rows.length} height={3} label={`${doneSets.length} of ${rows.length} sets done`} />}

          {/* Small actions: one panel open at a time, opening smoothly */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="ui-chip" aria-expanded={panel === 'demo'} aria-pressed={panel === 'demo'} onClick={() => toggle('demo')}>Demo</button>
            {(history.length > 0 || sessions.length > 0) && <button type="button" className="ui-chip" aria-expanded={panel === 'history'} aria-pressed={panel === 'history'} onClick={() => toggle('history')}>History</button>}
            {onReplace && doneSets.length === 0 && <button type="button" className="ui-chip" aria-expanded={panel === 'swap'} aria-pressed={panel === 'swap'} onClick={() => toggle('swap')}>Replace</button>}
            {onEdit && <button type="button" className="ui-chip" aria-expanded={panel === 'tweak'} aria-pressed={panel === 'tweak'} onClick={() => toggle('tweak')}>Note and rest{ownRest(ex) || ex.note ? ' ·' : ''}</button>}
          </div>
          {/* Panels sit in one wrapper with no gap, so closed ones take no space at all. */}
          <div style={{ display: 'flex', flexDirection: 'column', margin: panel ? 0 : '-12px 0 0' }}>
          <Collapse open={panel === 'demo'}>{panel === 'demo' && <ExerciseDemo name={ex.name} />}</Collapse>
          <Collapse open={panel === 'history'}>{panel === 'history' && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><LiftChart history={history} /><LiftSessions sessions={sessions} /></div>}</Collapse>
          <Collapse open={panel === 'swap'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {alternatives.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No other exercise in your library trains the same muscle. Add one from the exercise database in Exercises.</div>
                : alternatives.slice(0, 6).map(a => (
                  <button key={a.id} type="button" className="ui-btn is-sm" onClick={() => { setPanel(null); onReplace(a); }} style={{ justifyContent: 'flex-start' }}>{a.name}</button>
                ))}
            </div>
          </Collapse>
          <Collapse open={panel === 'tweak'}>{onEdit && <ExerciseTweaks key={`${ex.id}:${ex.note || ''}`} ex={ex} onEdit={onEdit} />}</Collapse>
          </div>

          {rec && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{rec.text}</div>}
          {ex.note && <div style={{ fontSize: 13, color: 'var(--text-primary)', fontStyle: 'italic' }}>{ex.note}</div>}
          {prog.plateau?.status && prog.plateau.status !== 'none' && (
            <span style={{ alignSelf: 'flex-start', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--warn)', border: '0.5px solid var(--warn)' }}>
              {prog.plateau.status === 'regressing' ? 'SLIDING' : 'STALLED'} {prog.plateau.sessions}
            </span>
          )}
          {prog.hint && prog.action !== 'FIRST SET' && stage === 'current' && (
            <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{prog.hint}</div>
          )}

          {/* How to do it: grip, set-up and the form cue. Full on the lift you are on, grip only on the rest. */}
          {detail && (detail.grip || detail.setup || detail.cue) && stage !== 'done' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 10, rowGap: 4, fontSize: 12.5, lineHeight: 1.45, padding: '9px 11px', borderRadius: 10, background: 'var(--hover-bg)' }}>
              {detail.grip && <><span style={{ ...label, fontSize: 9.5, paddingTop: 2 }}>Grip</span><span style={{ color: 'var(--text-primary)' }}>{detail.grip}</span></>}
              {stage === 'current' && detail.setup && <><span style={{ ...label, fontSize: 9.5, paddingTop: 2 }}>Set-up</span><span style={{ color: 'var(--text-secondary)' }}>{detail.setup}</span></>}
              {stage === 'current' && detail.cue && <><span style={{ ...label, fontSize: 9.5, paddingTop: 2 }}>Form</span><span style={{ color: 'var(--text-secondary)' }}>{detail.cue}</span></>}
            </div>
          )}

          {barbell && prefs.plates && plates && workKg > eq.bar && stage !== 'done' && (
            <div className="t-num" style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Per side for {plates.total} kg: <span style={{ color: 'var(--text-primary)' }}>{plates.perSide.length ? plates.perSide.join(' + ') : 'bar only'}</span>{plates.short > 0 ? ` (${plates.short} kg short)` : ''}
            </div>
          )}

          {/* Warm-ups: one tap adds a single warm-up set to tick off. They are not logged as work. */}
          {prefs.warmups && warm.length === 0 && one && stage !== 'done' && doneSets.length === 0 && (
            <button type="button" className="ui-btn is-sm is-soft" onClick={addWarm} style={{ alignSelf: 'flex-start' }}>
              Add warm-up set · {ex.bodyweight ? 'BW' : one.weight}×{one.reps}
            </button>
          )}

          {/* Sets */}
          <div role="table" aria-label={`${ex.name} sets`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div role="row" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center', ...label, fontSize: 10 }}>
              <span role="columnheader">Set</span><span role="columnheader">Last time</span>
              <span role="columnheader" style={{ textAlign: 'center' }}>kg</span><span role="columnheader" style={{ textAlign: 'center' }}>Reps</span>
              <span role="columnheader" aria-label="Done" />
            </div>
            {warm.map((w, k) => (
              <div key={`w${k}`} role="row" aria-label={`Warm-up set ${k + 1}`} className="ui-row-in" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center', padding: '3px 6px', margin: '0 -6px', borderRadius: 12, opacity: w.done ? 0.6 : 0.92 }}>
                <span className="t-num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--warn)', textAlign: 'center' }} title="Warm-up">W</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>warm-up</span>
                <input aria-label={`Warm-up ${k + 1} weight`} inputMode="decimal" disabled={ex.bodyweight || w.done} value={ex.bodyweight ? 'BW' : w.weight}
                  onFocus={e => e.target.select()} onChange={e => setWarm(ws => ws.map((x, n) => (n === k ? { ...x, weight: e.target.value } : x)))} className="ui-input" style={numInput} />
                <input aria-label={`Warm-up ${k + 1} reps`} inputMode="numeric" disabled={w.done} value={w.reps}
                  onFocus={e => e.target.select()} onChange={e => setWarm(ws => ws.map((x, n) => (n === k ? { ...x, reps: e.target.value } : x)))} className="ui-input" style={numInput} />
                <SetCheck done={w.done} onClick={() => setWarm(ws => ws.map((x, n) => (n === k ? { ...x, done: !x.done } : x)))} label={w.done ? `Undo warm-up ${k + 1}` : `Done warm-up ${k + 1}`} />
              </div>
            ))}
            {rows.map((r, i) => {
              const pr = prs[i];
              const isNext = i === nextIdx && stage !== 'done';
              return (
                <Fragment key={i}>
                  <div role="row" className={r.isNew ? 'ui-row-in' : undefined} aria-current={isNext ? 'step' : undefined} style={{
                    display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center',
                    padding: '5px 6px', margin: '0 -6px', borderRadius: 12, position: 'relative',
                    background: r.done ? 'color-mix(in srgb, var(--tab-accent) 9%, transparent)' : isNext ? 'var(--hover-bg)' : 'transparent',
                    boxShadow: isNext ? 'inset 0 0 0 1px var(--accent-line)' : 'none',
                    transition: 'background-color var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out)',
                  }}>
                    <span className="t-num" style={{ fontSize: 14, fontWeight: isNext ? 700 : 500, color: r.done || isNext ? 'var(--tab-accent)' : 'var(--text-muted)', textAlign: 'center' }}>{i + 1}</span>
                    <span className="t-num" style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pr
                        ? <span className="val-pop" style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', background: 'var(--tab-accent)', color: 'var(--on-tab-accent)' }} title={r.prev ? `Last time ${r.prev.weight} × ${r.prev.reps}` : undefined}>NEW PR</span>
                        : r.prev ? `${ex.bodyweight ? 'BW' : r.prev.weight} × ${r.prev.reps}` : '—'}
                    </span>
                    <input aria-label={`Set ${i + 1} weight`} inputMode="decimal" disabled={ex.bodyweight || r.done} value={ex.bodyweight ? 'BW' : r.weight}
                      onFocus={e => e.target.select()} onChange={e => onChange(i, { weight: e.target.value })} className="ui-input"
                      style={{ ...numInput, opacity: r.done ? 0.7 : 1, ...(isNext ? { borderColor: 'var(--accent-line)' } : {}) }} />
                    <input aria-label={`Set ${i + 1} reps`} inputMode="numeric" disabled={r.done} value={r.reps}
                      onFocus={e => e.target.select()} onChange={e => onChange(i, { reps: e.target.value })} className="ui-input"
                      style={{ ...numInput, opacity: r.done ? 0.7 : 1, ...(isNext ? { borderColor: 'var(--accent-line)' } : {}) }} />
                    <SetCheck done={r.done} justDone={r.justDone} onClick={() => onTick(i)} label={r.done ? `Undo set ${i + 1}` : `Log set ${i + 1}`} />
                  </div>
                  {/* One-tap nudges for the set you are about to do: no keyboard needed. */}
                  {isNext && (
                    <div className="ui-row-in" role="group" aria-label={`Adjust set ${i + 1}`} style={{ display: 'grid', gridTemplateColumns: ex.bodyweight ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 6, padding: '2px 0 4px' }}>
                      {!ex.bodyweight && <button type="button" className="ui-btn is-sm" onClick={() => nudge(i, 'weight', -step)} aria-label={`${step} kg less`}>−{step} kg</button>}
                      {!ex.bodyweight && <button type="button" className="ui-btn is-sm" onClick={() => nudge(i, 'weight', step)} aria-label={`${step} kg more`}>+{step} kg</button>}
                      <button type="button" className="ui-btn is-sm" onClick={() => nudge(i, 'reps', -1)} aria-label="One rep less">−1 rep</button>
                      <button type="button" className="ui-btn is-sm" onClick={() => nudge(i, 'reps', 1)} aria-label="One rep more">+1 rep</button>
                    </div>
                  )}
                  {r.done && prefs.effort !== 'off' && (
                    <div role="group" aria-label={`Set ${i + 1} effort`} className="ui-row-in" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 0 4px 34px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginRight: 4 }} title={prefs.effort === 'rir' ? 'Reps in reserve: 0 means nothing left in the tank' : 'Rate of perceived exertion: 10 means nothing left in the tank'}>{effortLabel(prefs.effort)}</span>
                      {effortOptions(prefs.effort).map(({ rpe: v, text }) => {
                        const on = validRpe(r.rpe) === v;
                        return (
                          <button key={v} type="button" className="ui-chip" aria-pressed={on} aria-label={prefs.effort === 'rir' ? `${text} reps left` : `RPE ${v}`} onClick={() => onRate(i, v)}
                            style={{ minHeight: 30, minWidth: 34, padding: '0 8px', justifyContent: 'center', fontSize: 12.5 }}>{text}</button>
                        );
                      })}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ui-btn is-sm" onClick={onAddSet}>+ Add set</button>
            <button type="button" className="ui-btn is-sm is-quiet" onClick={addWarm}>+ Warm-up</button>
            {warm.length > 0 && !warm.some(w => w.done) && <button type="button" className="ui-btn is-sm is-quiet" onClick={() => onWarm?.([])}>Clear warm-ups</button>}
            {rows.length > 1 && !rows[rows.length - 1].done && (
              <button type="button" className="ui-btn is-sm is-quiet" onClick={onRemoveSet}>Remove set</button>
            )}
          </div>
        </div>
      </Collapse>
    </section>
  );
}

// Live minutes since the first set, updated each minute (not every frame).
function useMinutes(startedAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return undefined;
    const t = setInterval(() => setNow(Date.now()), 30000);
    const v = () => setNow(Date.now());
    document.addEventListener('visibilitychange', v);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v); };
  }, [startedAt]);
  return startedAt ? Math.max(0, Math.round((now - startedAt) / 60000)) : 0;
}

// 1,250 -> "1.25k" once a number gets wide; the finish sheet shows it in full.
const short = (n) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n >= 1000 ? `${(n / 1000).toFixed(2).replace(/0$/, '')}k` : String(Math.round(n)));

function Stat({ value, unit, label: text, format, size = 19 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span className="t-num" style={{ fontSize: size, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
        <AnimatedNumber value={value} duration={500} format={format} />{unit && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span>}
      </span>
      <span className="t-caption" style={{ fontSize: 9.5 }}>{text}</span>
    </div>
  );
}

//  Session
export default function TrainSession({
  exercises, workoutLogs, addWorkoutLog, updateWorkoutLog, removeWorkoutLog,
  splitNames, todaySplitType, progression, musclesFor, compact = false, program = null, updateProgram = null, saveExercises = null, onEditProgram = null,
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
  const draft = useRef(loadDraft(date));
  const [startedAt, setStartedAt] = useState(() => draft.current.startedAt);
  const [warm, setWarmState] = useState(() => loadWarmups(date));   // exId -> warm-up rows (this device, today only)
  const setWarm = (exId, rows) => setWarmState(w => { const next = { ...w, [exId]: rows }; saveWarmups(date, next); return next; });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);

  const setGym = (g) => { setGymState(g); writePref('valerie_train_gym', g); };

  const recovery = useRecovery();
  const equipment = useEquipment();

  // What the coach knows (goal, experience) shapes the recommended sets; the rest time is yours to set.
  const saved = storage.get(STORAGE_KEYS.SETTINGS, {}) || {};
  const settingsNow = useSettingsValue();
  const prefs = cleanTrainPrefs(settingsNow.train);
  const recPrefs = { goal: saved.coachGoal?.template ?? null, experience: saved.coachIntake?.answers?.experience ?? null, defaultSets: prefs.defaultSets };
  const editExercise = saveExercises ? (id, patch) => saveExercises(exercises.map(e => (e.id === id ? { ...e, ...patch } : e))) : null;
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
  // With a program the swap is saved into that day, so next week has it too. Undo puts it back.
  const alternativesFor = (ex) => {
    const m = musclesFor(ex)?.[0];
    return exercises.filter(e => e.id !== ex.id && !todays.some(t => t.id === e.id) && (e.gym === gym || e.gym === 'both') && musclesFor(e)?.[0] === m);
  };
  const replaceExercise = async (oldEx, newEx, { quiet = false } = {}) => {
    setHiddenIds(h => [...h.filter(x => x !== newEx.id), oldEx.id]);
    setExtraIds(ids => [...ids.filter(x => x !== oldEx.id), newEx.id]);
    const d = program?.days?.[day];
    if (program && updateProgram && d && WEEK.includes(day)) {
      const ids = materialize(d, exercises).exerciseIds.map(x => (x === oldEx.id ? newEx.id : x));
      await updateProgram(program.id, { days: { ...program.days, [day]: { ...d, exerciseIds: ids } } });
    }
    if (!quiet) toast(`${newEx.name} in for ${oldEx.name}`, 'success', () => replaceExercise(newEx, oldEx, { quiet: true }));
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
        let rows = plannedRows(ex, prog, previousSets(workoutLogs, ex.name, date), recommendedSets(ex, recPrefs).sets);
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
        // Typed-but-unlogged values from before a refresh come back on top.
        const drafted = draft.current.rows[ex.id];
        if (drafted) { const withDraft = applyDraft(rows, drafted); if (sig(withDraft) !== sig(rows) || withDraft.length !== rows.length) { rows = withDraft; delete autoPlan.current[ex.id]; } }
        next[ex.id] = rows;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [todays, workoutLogs, date, progression, setPlan]);

  // Keep the draft current (cheap: a few hundred bytes).
  useEffect(() => { saveDraft(date, plan, startedAt); draft.current = loadDraft(date); }, [plan, date, startedAt]);

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

  // What comes after this set: the next set of this lift, or the next lift.
  const nextLabel = (ex, rows) => {
    const i = rows.findIndex(r => !r.done);
    if (i >= 0) return `${ex.name}, set ${i + 1}`;
    const after = todays.find(t => t.id !== ex.id && (planRef.current[t.id] ?? []).some(r => !r.done));
    return after ? after.name : null;
  };

  async function tick(ex, i) {
    const rows = planRef.current[ex.id];
    const row = rows[i];
    const undo = row.done;
    if (!undo && !ex.bodyweight && !(Number(row.weight) >= 0 && row.weight !== '')) return;
    if (!undo && !(Number(row.reps) > 0)) return;

    const ticked = rows.map((r, j) => j === i ? { ...r, done: !undo, justDone: !undo, isNew: false } : { ...r, justDone: false, isNew: false });
    // The sets still to do take the weight and reps you just did (unless you typed into them).
    const nextRows = undo ? ticked : carryForward(ticked, i);
    const revision = (mutationRevision.current[ex.id] ?? 0) + 1;
    mutationRevision.current[ex.id] = revision;
    setRows(ex.id, () => nextRows);   // the tap itself buzzes (installTapHaptics); a PR adds a stronger one below

    let pr = null;
    if (!undo) {
      const history = bests(logsRef.current, ex.name, { excludeDate: date });
      const todaySets = rows.filter((r, j) => r.done && j !== i).map(r => ({ weight: Number(r.weight) || 0, reps: Number(r.reps) || 0 }));
      pr = detectPR({ weight: Number(row.weight) || 0, reps: Number(row.reps) }, { history, todaySets });
      if (!startedAt) setStartedAt(markStarted(date));
      const next = nextLabel(ex, nextRows);
      if (prefs.autoRest && next) startRest(restSeconds(ex, restPref), next);
    }
    setPrs(p => ({ ...p, [ex.id]: { ...(p[ex.id] ?? {}), [i]: pr } }));

    const ok = await persist(ex, nextRows);
    if (!ok) {
      // A newer queued write includes this row and owns recovery. Rolling back
      // an older failure here would make the UI disagree with that later save.
      if (mutationRevision.current[ex.id] !== revision) return;
      setRows(ex.id, () => (confirmedRows.current[ex.id] ?? []).map(r => ({ ...r, justDone: false })));
      setPrs(p => ({ ...p, [ex.id]: {} }));
      stopRest();
      rerender(n => n + 1);
      return;
    }
    confirmedRows.current[ex.id] = nextRows.map(r => ({ ...r, justDone: false }));
    if (pr) {
      haptics.success();
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
  const planned = todays.reduce((s, ex) => s + (plan[ex.id]?.length ?? 0), 0);
  // Today's records, worked out from the logged sets (the same test a tick runs), so they survive
  // a refresh; a tick's own result still wins for the set it just logged.
  const savedPrs = useMemo(() => {
    const out = {};
    for (const ex of todays) {
      const rows = plan[ex.id] ?? [];
      if (!rows.some(r => r.done)) continue;
      const history = bests(workoutLogs, ex.name, { excludeDate: date });
      const before = [];
      rows.forEach((r, i) => {
        if (!r.done) return;
        const set = { weight: Number(r.weight) || 0, reps: Number(r.reps) || 0 };
        const pr = detectPR(set, { history, todaySets: before });
        if (pr) (out[ex.id] ||= {})[i] = pr;
        before.push(set);
      });
    }
    return out;
  }, [todays, plan, workoutLogs, date]);
  const prsFor = (id) => ({ ...(savedPrs[id] ?? {}), ...(prs[id] ?? {}) });
  const prCount = todays.reduce((s, ex) => s + Object.values(prsFor(ex.id)).filter(Boolean).length, 0);
  const minutes = useMinutes(startedAt);
  const others = exercises.filter(e => !todays.some(t => t.id === e.id));
  const vol = volume(allDone);
  const complete = planned > 0 && allDone.length >= planned;
  // Last time's volume for the same lifts, to compare on the finish sheet.
  const lastVol = useMemo(() => todays.reduce((s, ex) => s + volume(previousSets(workoutLogs, ex.name, date)), 0), [todays, workoutLogs, date]);
  // The current exercise: the first with a set still to do.
  const currentId = todays.find(ex => (plan[ex.id] ?? []).some(r => !r.done))?.id ?? null;

  const dayChoices = program ? sessionChoices(program, exercises).map(c => ({ id: c.key, label: c.label })) : ['push', 'pull', 'legs'].map(d => ({ id: d, label: splitNames[d] ?? d }));
  const title = program && WEEK.includes(day) ? (program.days?.[day]?.label || 'Workout') : (splitNames[day] ?? day);

  const finish = () => {
    setFinishOpen(false);
    stopRest();
    clearDraft();
    clearWarmups(); setWarmState({});
    setStartedAt(null);
    softHaptic([10, 40, 10]);
    toast(`Workout saved · ${allDone.length} sets · ${vol.toLocaleString()} kg`);
  };

  return (
    <div style={compact ? undefined : { height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: compact ? '14px 16px 96px' : '20px 28px 110px', maxWidth: 760, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {/* Title and day */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h1 key={title} className="ui-enter" style={{ margin: 0, fontSize: compact ? 26 : 30, fontWeight: 700, color: 'var(--text-primary)', minWidth: 0 }}>{title}</h1>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button type="button" className="ui-btn is-sm" onClick={() => setGym(gym === 'home' ? 'commercial' : 'home')} aria-label={`Gym: ${gym === 'home' ? 'Home' : 'Commercial'}. Switch`}>{gym === 'home' ? 'Home gym' : 'Commercial'}</button>
            <button type="button" className="ui-btn is-sm is-icon" onClick={() => setSettingsOpen(true)} aria-label="Session settings" style={{ width: 36 }}><Glyph d={GEAR} size={17} w={1.6} /></button>
          </div>
        </div>
        {dayChoices.length > 1 && (
          <SlidingTabs label="Workout day" mode="toggle" scroll value={day} items={dayChoices}
            onChange={(id) => { setDay(id); setExtraIds([]); setHiddenIds([]); }} />
        )}

        {/* Live summary */}
        <div className="ui-card" style={{ position: 'sticky', top: compact ? 6 : 0, zIndex: 4, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          background: 'color-mix(in srgb, var(--surface-1) 90%, transparent)', WebkitBackdropFilter: 'blur(16px)', backdropFilter: 'blur(16px)' }}>
          <ProgressRing value={planned ? allDone.length / planned : 0} size={44} stroke={4} color={complete ? 'var(--ok)' : 'var(--tab-accent)'}
            label={`${allDone.length} of ${planned} sets done`}>
            <span className="t-num" style={{ fontSize: 11, fontWeight: 650, color: complete ? 'var(--ok)' : 'var(--text-primary)' }}>{planned ? Math.round((allDone.length / planned) * 100) : 0}%</span>
          </ProgressRing>
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.2fr) minmax(0, 1fr)', gap: 6 }}>
            <Stat value={allDone.length} label={`of ${planned}`} size={compact ? 17 : 19} />
            <Stat value={vol} unit="kg" label="Volume" format={short} size={compact ? 17 : 19} />
            <Stat value={minutes} unit="m" label={prCount ? `${prCount} PR${prCount > 1 ? 's' : ''}` : 'Time'} size={compact ? 17 : 19} />
          </div>
          {allDone.length > 0 && <button type="button" className={`ui-btn is-sm${complete ? ' is-primary' : ' is-soft'}`} onClick={() => setFinishOpen(true)}>Finish</button>}
        </div>

        {recovery.status === 'ok' && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
            <span className="t-num" style={{ fontSize: 15, fontWeight: 600, color: recovery.band === 'push' ? 'var(--ok)' : recovery.band === 'go-easy' ? 'var(--bad)' : 'var(--warn)' }}>{recovery.score}</span>
            <span><strong style={{ color: 'var(--text-primary)' }}>{recovery.label}.</strong> {recovery.advice}</span>
          </div>
        )}

        {stalled.length > 0 && (
          <div role="status" style={{ padding: '10px 14px', borderRadius: 14, border: '0.5px solid color-mix(in srgb, var(--warn) 60%, transparent)', background: 'color-mix(in srgb, var(--warn) 8%, transparent)', fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)' }}>
            <strong style={{ color: 'var(--warn)' }}>{stalled.length === 1 ? '1 lift has stalled' : `${stalled.length} lifts have stalled`}.</strong>{' '}
            {stalled.slice(0, 3).map(s => `${s.name} (${s.sessions} sessions${s.action === 'DELOAD' ? `, deload to ${s.nextWeight} kg` : ''})`).join('; ')}.
          </div>
        )}

        {complete && (
          <div className="ui-card ui-scale" role="status" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderColor: 'color-mix(in srgb, var(--ok) 45%, transparent)' }}>
            <span className="ui-check is-on ui-confirm" aria-hidden="true" style={{ width: 40, height: 40, flexShrink: 0, background: 'var(--ok)', color: '#0b1a12' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d={TICK} /></svg>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--text-primary)' }}>Every planned set is done</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Add a set, or finish to see the summary.</div>
            </div>
            <button type="button" className="ui-btn is-sm is-primary" onClick={() => setFinishOpen(true)}>Finish</button>
          </div>
        )}

        {todays.length === 0 && (
          <div className="ui-card ui-enter" style={{ padding: '22px 18px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Nothing planned here</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {program ? 'No exercises on this day for this gym. Edit the day in Split, or add one below.' : 'No exercises for this day and gym. Add some in Exercises, or add one below.'}
            </div>
            {onEditProgram && <button type="button" className="ui-btn is-sm is-soft" onClick={onEditProgram}>{program ? 'Edit this program' : 'Create a program'}</button>}
          </div>
        )}

        {todays.map((ex, idx) => plan[ex.id] && (
          <ExerciseCard key={ex.id} index={idx} ex={ex} prog={progFor(ex)} rows={plan[ex.id]} prs={prsFor(ex.id)} compact={compact}
            stage={ex.id === currentId ? 'current' : (plan[ex.id].length && plan[ex.id].every(r => r.done)) ? 'done' : 'next'}
            onChange={(i, patch) => setRows(ex.id, rs => rs.map((r, j) => j === i ? { ...r, ...patch, touched: true } : r))}
            onTick={(i) => tick(ex, i)} onRate={(i, v) => rate(ex, i, v)}
            onAddSet={() => setRows(ex.id, rs => [...rs.map(r => ({ ...r, isNew: false })), { ...(rs[rs.length - 1] ?? { weight: 0, reps: ex.repsMin }), prev: null, done: false, justDone: false, rpe: '', isNew: true, touched: false }])}
            onRemoveSet={() => setRows(ex.id, rs => rs.slice(0, -1))} history={liftHistory(workoutLogs, ex.name)} sessions={sessionsOf(workoutLogs.filter(l => l.date < date), ex.name)} rec={recommendedSets(ex, recPrefs)} eq={equipment}
            alternatives={alternativesFor(ex)} onReplace={(n) => replaceExercise(ex, n)} prefs={prefs} onEdit={editExercise ? (patch) => editExercise(ex.id, patch) : null}
            warm={warm[ex.id] ?? []} onWarm={(rows) => setWarm(ex.id, rows)} />
        ))}

        {others.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={label}>Add exercise</span>
            <select value="" onChange={e => e.target.value && setExtraIds(ids => [...ids, e.target.value])} className="ui-input" style={{ flex: 1, height: 44 }}>
              <option value="">Choose…</option>
              {others.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
        )}

        <StrengthCard logs={workoutLogs} />
      </div>

      {/* Settings: everything that used to sit above the workout */}
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Session settings">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 650, color: 'var(--text-primary)' }}>Session settings</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={label}>Rest between sets</span>
            <SlidingTabs mode="toggle" boxed label="Rest time between sets" value={restPref} onChange={chooseRest}
              items={[{ id: 0, label: 'Auto' }, { id: 60, label: '60 s' }, { id: 90, label: '90 s' }, { id: 120, label: '2 min' }, { id: 180, label: '3 min' }]} />
          </div>
          <TrainPrefsPanel prefs={prefs} />
          {todays.some(e => !e.bodyweight && isBarbell(e.name)) && <EquipmentSettings key={equipment.plates.join(',')} eq={equipment} />}
          {onEditProgram && <button type="button" className="ui-btn is-block" onClick={() => { setSettingsOpen(false); onEditProgram(); }}>{program ? 'Edit this program' : 'Create a program'}</button>}
          <button type="button" className="ui-btn is-quiet is-block" onClick={() => setSettingsOpen(false)}>Done</button>
        </div>
      </Sheet>

      {/* Finish: a summary. Every set is already saved as you tick it. */}
      <Sheet open={finishOpen} onClose={() => setFinishOpen(false)} title="Workout summary">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <ProgressRing value={planned ? allDone.length / planned : 0} size={64} stroke={6} color={complete ? 'var(--ok)' : 'var(--tab-accent)'}>
              <span className="t-num" style={{ fontSize: 15, fontWeight: 650, color: 'var(--text-primary)' }}>{allDone.length}</span>
            </ProgressRing>
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{allDone.length} of {planned} planned sets · {minutes} min</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <div className="ui-card" style={{ padding: 12 }}><Stat value={vol} unit="kg" label="Volume" /></div>
            <div className="ui-card" style={{ padding: 12 }}><Stat value={prCount} label="Records" /></div>
            <div className="ui-card" style={{ padding: 12 }}><Stat value={todays.filter(ex => (plan[ex.id] ?? []).some(r => r.done)).length} label="Exercises" /></div>
          </div>
          {lastVol > 0 && (
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Last time these lifts moved <span className="t-num" style={{ color: 'var(--text-primary)' }}>{lastVol.toLocaleString()} kg</span>.{' '}
              {vol >= lastVol
                ? <strong style={{ color: 'var(--ok)' }}>Up {(vol - lastVol).toLocaleString()} kg.</strong>
                : <span>{(lastVol - vol).toLocaleString()} kg to go to match it.</span>}
            </div>
          )}
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Every set was saved the moment you ticked it. Finishing stops the timer and clears today's draft.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ui-btn" style={{ flex: 1 }} onClick={() => setFinishOpen(false)}>Keep training</button>
            <button type="button" className="ui-btn is-primary" style={{ flex: 1 }} onClick={finish}>Finish workout</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
