// Toast host: listens for `valerie:toast` ({ message, type, undo }) and shows
// messages one at a time, each with an optional Undo. Mounted by both
// shells; before this the phone shell had none, so every toast there (save
// errors, Undo) was lost. A later toast never replaces one that carries an
// Undo: it waits its turn.
//
// Motion: each toast rises in, a thin line counts down the time left to Undo, and it slides out
// before the next one comes in. Hovering (desktop) or touching it pauses the countdown.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MAX_QUEUE = 5;
const LEAVE_MS = 200;
const TONE = { success: 'var(--ok)', error: 'var(--bad)', warning: 'var(--warn)', sleep: 'var(--info)' };
const PATH = {
  success: 'M5 12.5 10 17l9-10',
  error: 'M12 8v5M12 16.5v.5M10.3 3.9 2.6 17.3A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.7L13.7 3.9a2 2 0 0 0-3.4 0z',
  warning: 'M12 8v5M12 16.5v.5M10.3 3.9 2.6 17.3A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.7L13.7 3.9a2 2 0 0 0-3.4 0z',
  sleep: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  info: 'M12 11v6M12 7.5v.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
};

export default function Toaster({ phone = false }) {
  const [queue, setQueue] = useState([]);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const toast = queue[0] ?? null;
  const seq = useRef(0);
  const left = useRef(0);
  const started = useRef(0);

  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail || {};
      if (!detail.message) return;
      // Plain toasts replace each other (newest wins); one with an Undo is kept until it times out or is used.
      setQueue(q => [...q.filter((t, i) => t.undo || i === 0), { ...detail, _id: ++seq.current }].slice(-MAX_QUEUE));
    };
    window.addEventListener('valerie:toast', handler);
    return () => window.removeEventListener('valerie:toast', handler);
  }, []);

  // Once per toast: an Undo tap racing the timeout must not drop the toast after it too.
  const goingFor = useRef(null);
  const next = () => {
    const id = queue[0]?._id;
    if (id == null || goingFor.current === id) return;
    goingFor.current = id;
    setLeaving(true);
    setTimeout(() => { setQueue(q => (q[0]?._id === id ? q.slice(1) : q)); setLeaving(false); setPaused(false); }, LEAVE_MS);
  };

  // A plain toast that is showing gives way at once to a newer one.
  useEffect(() => {
    if (toast && !toast.undo && queue.length > 1 && !leaving) next();
  }, [queue.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Each toast gets its own time on screen: longer when there is an Undo to act on. Pausable.
  useEffect(() => { if (toast) left.current = toast.undo ? 8000 : 4500; }, [toast?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!toast || leaving || paused) return undefined;
    started.current = Date.now();
    const t = setTimeout(next, left.current);
    return () => { clearTimeout(t); left.current = Math.max(600, left.current - (Date.now() - started.current)); };
  }, [toast?._id, leaving, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!toast) return null;
  const type = PATH[toast.type] ? toast.type : 'info';
  const tone = TONE[type] || 'var(--tab-accent)';
  const total = toast.undo ? 8000 : 4500;

  return createPortal(
    <div key={toast._id} role="status" aria-live="polite" className={`ui-toast${leaving ? ' is-leaving' : ''}`}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)} onTouchEnd={() => setTimeout(() => setPaused(false), 1200)}
      style={{
        position: 'fixed', left: '50%', zIndex: 10000, overflow: 'hidden',
        bottom: phone ? 'calc(86px + env(safe-area-inset-bottom))' : 92, // above the tab bar / dock
        maxWidth: 'min(460px, calc(100vw - 32px))', width: phone ? 'calc(100vw - 32px)' : 'max-content', boxSizing: 'border-box',
        background: 'color-mix(in srgb, var(--surface-2) 94%, transparent)', WebkitBackdropFilter: 'blur(18px)', backdropFilter: 'blur(18px)',
        border: '0.5px solid var(--hairline)', borderRadius: 16, padding: '11px 12px 11px 14px', fontSize: 13.5, color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-3)', display: 'flex', alignItems: 'center', gap: 11, lineHeight: 1.4,
      }}>
      <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${tone} 18%, transparent)`, color: tone }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={PATH[type]} /></svg>
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>{toast.message}</span>
      {queue.length > 1 && <span className="t-num" style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>+{queue.length - 1}</span>}
      {toast.undo && (
        <button type="button" className="ui-btn is-sm is-soft" onClick={() => { try { toast.undo(); } catch { /* the undo is best effort */ } next(); }}
          style={{ minHeight: 34, flexShrink: 0 }}>Undo</button>
      )}
      {toast.undo && <span className="ui-toast-timer" aria-hidden="true" style={{ animationDuration: `${total}ms`, animationPlayState: paused || leaving ? 'paused' : 'running' }} />}
    </div>,
    document.body,
  );
}
