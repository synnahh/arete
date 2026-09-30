// Fasting timer: start a fast, watch the ring fill, end it, and see how the
// last month went. Rules: src/domain/fasting.js. State is saved in settings so
// it follows you between phone and desktop.
import { useEffect, useState } from 'react';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { updateSettings } from '../utils/settingsStore.js';
import { PROTOCOLS, startFast, fastProgress, endFast, addToLog, fastStats, formatHours } from '../domain/fasting.js';
import { label } from './ui.js';

const R = 34;
const CIRC = 2 * Math.PI * R;
const chip = (on) => ({
  minHeight: 40, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5,
  border: `0.5px solid ${on ? 'var(--tab-accent)' : 'var(--card-border)'}`,
  background: on ? 'color-mix(in srgb, var(--tab-accent) 14%, transparent)' : 'transparent',
  color: on ? 'var(--tab-accent)' : 'var(--text-secondary)', fontWeight: on ? 600 : 500, WebkitTapHighlightColor: 'transparent',
});
const primary = { minHeight: 44, padding: '0 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, background: 'var(--tab-accent)', color: 'var(--on-tab-accent)', WebkitTapHighlightColor: 'transparent' };

const read = () => { const s = storage.get(STORAGE_KEYS.SETTINGS, {}) || {}; return { fast: s.fast || null, log: Array.isArray(s.fastLog) ? s.fastLog : [] }; };

export default function FastingCard() {
  const [state, setState] = useState(read);
  const [target, setTarget] = useState(16);
  const [now, setNow] = useState(() => Date.now());
  const fasting = !!state.fast;

  useEffect(() => {
    const onChange = () => setState(read());
    window.addEventListener('valerie:settings-changed', onChange);
    return () => window.removeEventListener('valerie:settings-changed', onChange);
  }, []);

  // Tick once a minute, and only while a fast is running.
  useEffect(() => {
    if (!fasting) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, [fasting]);

  const progress = fasting ? fastProgress(state.fast, now) : null;
  const stats = fastStats(state.log, now);

  function start() { updateSettings({ fast: startFast(target) }); }
  function stop() {
    const entry = endFast(state.fast, Date.now());
    updateSettings({ fast: null, fastLog: addToLog(state.log, entry) });
    if (entry) window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: `Fast ended · ${formatHours(entry.hours)}${entry.completed ? ' · target reached' : ''}`, type: 'success' } }));
  }

  return (
    <section aria-label="Fasting" style={{ padding: 16, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
      <div style={label}>Fasting</div>
      {progress ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
            <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
              <circle cx="40" cy="40" r={R} fill="none" stroke="var(--card-border)" strokeWidth="6" />
              <circle cx="40" cy="40" r={R} fill="none" stroke={progress.done ? '#4caf7d' : 'var(--tab-accent)'} strokeWidth="6" strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress.pct)} transform="rotate(-90 40 40)" />
            </svg>
            <span className="val-num" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round(progress.pct * 100)}%</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="val-num" style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-primary)' }}>{formatHours(progress.elapsedH)}</div>
            <div role="status" style={{ fontSize: 13, lineHeight: 1.45, color: progress.done ? '#4caf7d' : 'var(--text-secondary)' }}>
              {progress.done
                ? `Target of ${progress.targetHours} h reached${progress.overH >= 0.25 ? `, ${formatHours(progress.overH)} over` : ''}.`
                : `${formatHours(progress.remainingH)} to go, until ${new Date(progress.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Fast length">
          {PROTOCOLS.map(p => <button key={p.hours} type="button" aria-pressed={target === p.hours} onClick={() => setTarget(p.hours)} style={chip(target === p.hours)}>{p.label}</button>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {fasting
          ? <button type="button" onClick={stop} style={primary}>End fast</button>
          : <button type="button" onClick={start} style={primary}>Start {target} h fast</button>}
        {stats.count > 0 && (
          <span className="val-num" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Last 30 days: {stats.completed} of {stats.count} reached target · avg {stats.avgHours} h{stats.run > 1 ? ` · ${stats.run} in a row` : ''}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>Fasting isn't right for everyone (pregnancy, eating disorders, diabetes or other medical conditions). Check with a doctor first if that could be you.</div>
    </section>
  );
}
