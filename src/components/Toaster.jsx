// Toast host: listens for `valerie:toast` ({ message, type, undo }) and shows
// one message at a time, with an optional Undo. Mounted by both shells; before
// this the phone shell had none, so every toast there (save errors, Undo) was lost.
import { useEffect, useRef, useState } from 'react';

const ICON = { sleep: '🌙', success: '✓', error: '⚠️' };

export default function Toaster({ phone = false }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail || {};
      if (!detail.message) return;
      setToast(detail);
      if (timer.current) clearTimeout(timer.current);
      // A longer window when there is an Undo to act on.
      timer.current = setTimeout(() => setToast(null), detail.undo ? 8000 : 5000);
    };
    window.addEventListener('valerie:toast', handler);
    return () => { window.removeEventListener('valerie:toast', handler); if (timer.current) clearTimeout(timer.current); };
  }, []);

  if (!toast) return null;
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
      <span style={{ fontSize: 16, flexShrink: 0 }}>{ICON[toast.type] || 'ℹ️'}</span>
      <span style={{ minWidth: 0 }}>{toast.message}</span>
      {toast.undo && (
        <button type="button" onClick={() => { try { toast.undo(); } catch { /* the undo is best effort */ } setToast(null); }}
          style={{ marginLeft: 4, minHeight: 32, flexShrink: 0, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Undo</button>
      )}
    </div>
  );
}
