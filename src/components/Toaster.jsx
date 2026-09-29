// Toast host: listens for `valerie:toast` ({ message, type, undo }) and shows
// messages one at a time, each with an optional Undo. Mounted by both
// shells; before this the phone shell had none, so every toast there (save
// errors, Undo) was lost. A later toast never replaces one that carries an
// Undo: it waits its turn.
import { useEffect, useRef, useState } from 'react';

const ICON = { sleep: '\uD83C\uDF19', success: '\u2713', error: '\u26A0\uFE0F' };
const MAX_QUEUE = 5;

export default function Toaster({ phone = false }) {
  const [queue, setQueue] = useState([]);
  const toast = queue[0] ?? null;
  const seq = useRef(0);

  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail || {};
      if (!detail.message) return;
      // Plain toasts replace each other (newest wins); one with an Undo is kept until it times out or is used.
      setQueue(q => [...q.filter(t => t.undo), { ...detail, _id: ++seq.current }].slice(-MAX_QUEUE));
    };
    window.addEventListener('valerie:toast', handler);
    return () => window.removeEventListener('valerie:toast', handler);
  }, []);

  // Each toast gets its own time on screen: longer when there is an Undo to act on.
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setQueue(q => q.slice(1)), toast.undo ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [toast?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!toast) return null;
  const next = () => setQueue(q => q.slice(1));
  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
      bottom: phone ? 'calc(88px + env(safe-area-inset-bottom))' : 28,
      maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box',
      background: 'rgba(8,12,20,0.96)', border: '0.5px solid rgba(74,158,255,0.3)',
      borderRadius: 12, padding: '11px 18px', fontSize: 13, color: 'var(--text-primary)',
      whiteSpace: phone ? 'normal' : 'nowrap', boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeIn 0.25s ease',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{ICON[toast.type] || '\u2139\uFE0F'}</span>
      <span style={{ minWidth: 0 }}>{toast.message}</span>
      {toast.undo && (
        <button type="button" onClick={() => { try { toast.undo(); } catch { /* the undo is best effort */ } next(); }}
          style={{ marginLeft: 4, minHeight: 32, flexShrink: 0, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Undo</button>
      )}
      {queue.length > 1 && <span className="val-num" style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>+{queue.length - 1}</span>}
    </div>
  );
}
