// Guided breathing: pick a pattern and a length, follow the circle. Rules and
// timing: src/domain/breathing.js. The circle only scales for people who have not
// asked for reduced motion; the words and countdown are always there.
import { useEffect, useRef, useState } from 'react';
import { PATTERNS, DURATIONS_MIN, phaseAt } from '../domain/breathing.js';
import { label } from './ui.js';

const chip = (on) => ({
  minHeight: 40, padding: '0 16px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, WebkitTapHighlightColor: 'transparent',
  border: `0.5px solid ${on ? 'var(--tab-accent, var(--accent))' : 'var(--card-border)'}`, fontWeight: on ? 600 : 500,
  background: on ? 'color-mix(in srgb, var(--tab-accent, var(--accent)) 14%, transparent)' : 'transparent', color: on ? 'var(--tab-accent, var(--accent))' : 'var(--text-secondary)',
});
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function BreathingTool() {
  const [patternId, setPatternId] = useState('box');
  const [minutes, setMinutes] = useState(3);
  const [running, setRunning] = useState(false);
  const [state, setState] = useState(null);
  const startedAt = useRef(0);
  const raf = useRef(0);
  const pattern = PATTERNS[patternId];

  useEffect(() => {
    if (!running) return undefined;
    const total = minutes * 60000;
    startedAt.current = performance.now();
    const tick = (now) => {
      const s = phaseAt(pattern, now - startedAt.current, total);
      setState(s);
      if (s.done) { setRunning(false); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, pattern, minutes]);

  const card = { padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 520 };
  const still = !running && !(state && state.done) ? null : state;
  const scale = running && state ? (reducedMotion() ? 0.8 : state.scale) : 0.55;

  return (
    <section aria-label="Breathing" style={card}>
      <div style={label}>Breathe</div>
      <div role="group" aria-label="Pattern" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(PATTERNS).map(([id, p]) => <button key={id} type="button" aria-pressed={patternId === id} disabled={running} onClick={() => setPatternId(id)} style={chip(patternId === id)}>{p.name}</button>)}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{pattern.blurb}</div>
      <div role="group" aria-label="Length" style={{ display: 'flex', gap: 8 }}>
        {DURATIONS_MIN.map(m => <button key={m} type="button" aria-pressed={minutes === m} disabled={running} onClick={() => setMinutes(m)} style={chip(minutes === m)}>{m} min</button>)}
      </div>

      <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div aria-hidden="true" style={{
          width: 180, height: 180, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          background: 'color-mix(in srgb, var(--tab-accent, var(--accent)) 18%, transparent)', border: '1.5px solid var(--tab-accent, var(--accent))',
          transform: `scale(${scale})`, transition: reducedMotion() ? 'none' : 'transform 120ms linear',
        }}>
          <span className="val-num" style={{ fontSize: 34, color: 'var(--text-primary)', transform: `scale(${1 / scale})` }}>{running && state && !state.done ? state.remaining : ''}</span>
        </div>
      </div>

      <div role="status" aria-live="polite" style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', minHeight: 28 }}>
        {running && state && !state.done ? state.phase : still?.done ? 'Done. Notice how you feel.' : 'Ready when you are'}
      </div>
      {running && state && !state.done && <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-secondary)' }}>Round {state.cycle}</div>}

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button type="button" onClick={() => { if (running) { setRunning(false); setState(null); } else { setState(null); setRunning(true); } }}
          style={{ minHeight: 48, padding: '0 28px', borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, background: 'var(--tab-accent, var(--accent))', color: 'var(--on-tab-accent, #fff)' }}>
          {running ? 'Stop' : 'Start'}
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', textAlign: 'center' }}>If you feel dizzy, stop and breathe normally.</div>
    </section>
  );
}
