// RestTimer — the rest between sets. The data and maths live in domain/restTimer.js (an end
// time, not a running counter), saved in localStorage so a refresh, a closed app or a locked
// phone never loses or skews it. A docked bar sits above the tab bar while you rest; tap the
// ring for a large view with every control.
//
// Cues when a rest ends: a buzz on Android (iPhone web apps have no vibration API) and an
// optional short tone. Both need the app open: a web app is paused in the background, so it
// cannot alert you there, but the time is right the moment you come back.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import * as R from '../domain/restTimer.js';
import { ProgressRing, usePresence, haptic } from './Motion.jsx';
import { useSettingsValue } from '../hooks/useSettingsValue.js';
import { cleanTrainPrefs } from '../domain/trainPrefs.js';

// ── Store ────────────────────────────────────────────────────────────────────
let state = typeof window !== 'undefined' ? R.load() : null;
const listeners = new Set();
const emit = () => listeners.forEach(f => f());
function set(next) { state = next; R.save(next); emit(); }
const subscribe = (f) => { listeners.add(f); return () => listeners.delete(f); };
const snapshot = () => state;

/** Start (or restart) a rest of `seconds`, labelled with what comes next. */
export function startRest(seconds, next = null) {
  unlockAudio();
  set({ ...R.start(seconds), next });
}
export const stopRest = () => set(null);
export const restState = () => state;

// ── Sound: a short two-note tone, made on the device (no file to download) ─────
let ctx = null;
function unlockAudio() {
  // Called from a tap, the only moment iOS lets a page start audio.
  try { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch { ctx = null; }
}
function tone() {
  if (!ctx) return;
  try {
    [0, 0.18].forEach((at, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = i ? 1175 : 880; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.16);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + 0.18);
    });
  } catch { /* audio is a nicety */ }
}

// ── Clock: redraw four times a second while a rest runs, and on return to the app ──
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const on = () => setNow(Date.now());
    document.addEventListener('visibilitychange', on);
    window.addEventListener('focus', on);
    let t = null;
    if (active) t = setInterval(on, 250);
    return () => { if (t) clearInterval(t); document.removeEventListener('visibilitychange', on); window.removeEventListener('focus', on); };
  }, [active]);
  return now;
}

let cuedFor = null;   // the rest (by start time) whose end has been signalled

const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const PAUSE = 'M9 6v12M15 6v12';
const PLAY = 'M8 5.5v13l10-6.5z';
const RESET = 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4.5h4.5';
const SKIP = 'M6 6l8 6-8 6zM17 6v12';

// Mounted once by each app shell, so a rest keeps showing on every tab.
export default function RestTimer() {
  const prefs = cleanTrainPrefs(useSettingsValue().train);
  const live = useSyncExternalStore(subscribe, snapshot, snapshot);
  const last = useRef(live);
  if (live) last.current = live;
  const s = live || last.current;   // keep drawing the last rest while it fades out
  const running = !!live && !R.isPaused(live) && !R.isDone(live, Date.now());
  const now = useNow(running);
  const [big, setBig] = useState(false);
  const [mounted, leaving] = usePresence(!!live, 240);

  const done = R.isDone(s, now);
  const low = R.isLow(s, now);
  const paused = R.isPaused(s);
  const left = R.remaining(s, now);

  // Signal the end once, then clear the timer a few seconds later.
  useEffect(() => {
    if (!live || !done) return undefined;
    if (cuedFor !== live.startedAt) {
      cuedFor = live.startedAt;
      // Only cue a rest that ended just now; one that ended while the app was closed stays quiet.
      if (now - (live.until ?? now) < 3000) {
        if (prefs.restVibrate !== false) haptic([120, 60, 120]);
        if (prefs.restSound) tone();
      }
    }
    const t = setTimeout(() => { if (state === live) set(null); }, 4500);
    return () => clearTimeout(t);
  }, [done, live]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!live) setBig(false); }, [live]);

  if (!mounted || !s) return null;
  const colour = done ? 'var(--ok)' : low ? 'var(--warn)' : 'var(--tab-accent)';
  const frac = R.fraction(s, now);
  const act = (fn) => () => { if (state) set(fn(state, Date.now())); };
  const shown = done ? 'Go' : R.fmt(left);
  const statusText = done ? 'Rest done' : paused ? 'Paused' : low ? 'Almost time' : 'Resting';

  const controls = (lg) => (
    <>
      {lg && <button type="button" className="ui-btn is-sm" onClick={act((x, n) => R.add(x, -15, n))} disabled={done} aria-label="15 seconds less">−15</button>}
      <button type="button" className={`ui-btn is-sm${lg ? '' : ' is-quiet'}`} onClick={act((x, n) => R.add(x, 15, n))} disabled={done} aria-label="15 seconds more">+15</button>
      {lg && <button type="button" className="ui-btn is-sm" onClick={act((x, n) => R.add(x, 30, n))} disabled={done} aria-label="30 seconds more">+30</button>}
      <button type="button" className="ui-btn is-sm is-icon" onClick={act((x, n) => (R.isPaused(x) ? R.resume(x, n) : R.pause(x, n)))} disabled={done}
        aria-label={paused ? 'Resume rest' : 'Pause rest'} style={{ width: 40 }}><Icon d={paused ? PLAY : PAUSE} size={18} /></button>
      {lg && <button type="button" className="ui-btn is-sm is-icon" onClick={act(R.reset)} aria-label="Restart rest" style={{ width: 40 }}><Icon d={RESET} size={18} /></button>}
      <button type="button" className="ui-btn is-sm is-soft" onClick={() => set(null)} aria-label={done ? 'Close timer' : 'Skip rest'}>{done ? 'Close' : <><Icon d={SKIP} size={16} />Skip</>}</button>
    </>
  );

  return createPortal(
    <>
      <span role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{done ? 'Rest done. Next set.' : ''}</span>
      <div role="timer" aria-label={`Rest: ${statusText}, ${R.fmt(left)} left`}
        className={`ui-card rest-dock${leaving ? ' ui-leave' : ' ui-enter'}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 12px', borderRadius: 'var(--r-lg)', background: 'color-mix(in srgb, var(--surface-2) 92%, transparent)',
          WebkitBackdropFilter: 'blur(18px)', backdropFilter: 'blur(18px)', boxShadow: 'var(--shadow-3)',
          borderColor: done ? 'color-mix(in srgb, var(--ok) 50%, transparent)' : low ? 'color-mix(in srgb, var(--warn) 45%, transparent)' : undefined,
        }}>
        <button type="button" onClick={() => setBig(true)} aria-label="Open the large timer" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%' }}>
          <ProgressRing value={frac} size={52} stroke={4.5} color={colour}>
            <span className={`t-num${low && !paused ? ' rest-low' : ''}`} style={{ fontSize: done ? 14 : 13, fontWeight: 650, color: done ? 'var(--ok)' : 'var(--text-primary)' }}>{shown}</span>
          </ProgressRing>
        </button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="t-caption" style={{ color: done ? 'var(--ok)' : low ? 'var(--warn)' : undefined, transition: 'color var(--dur-2) var(--ease-out)' }}>{statusText}</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {s.next ? `Next: ${s.next}` : `of ${R.fmt(s.total)}`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{controls(false)}</div>
      </div>

      {big && live && (
        <BigTimer onClose={() => setBig(false)} frac={frac} color={colour} shown={shown} statusText={statusText} done={done} low={low} paused={paused} total={s.total} next={s.next} controls={controls(true)} />
      )}
    </>,
    document.body,
  );
}

function BigTimer({ onClose, frac, color, shown, statusText, done, low, paused, total, next, controls }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <>
      <div className="ui-backdrop" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Rest timer" className="ui-sheet" style={{ textAlign: 'center' }}>
        <div className="ui-sheet-grip" aria-hidden="true" />
        <div className="t-caption" style={{ color: done ? 'var(--ok)' : low ? 'var(--warn)' : undefined, marginBottom: 14 }}>{statusText}</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <ProgressRing value={frac} size={232} stroke={10} color={color}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span className={`t-num${low && !paused ? ' rest-low' : ''}`} style={{ fontSize: 58, fontWeight: 600, letterSpacing: '-0.03em', color: done ? 'var(--ok)' : 'var(--text-primary)', lineHeight: 1 }}>{shown}</span>
              <span className="t-num" style={{ fontSize: 12, color: 'var(--text-muted)' }}>of {R.fmt(total)}</span>
            </div>
          </ProgressRing>
        </div>
        {next && <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>Next: <strong style={{ color: 'var(--text-primary)' }}>{next}</strong></div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>{controls}</div>
        <button type="button" className="ui-btn is-quiet is-block" onClick={onClose}>Done</button>
      </div>
    </>
  );
}
