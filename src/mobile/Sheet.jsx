// Bottom sheet for the phone screens: backdrop tap or Escape closes it. Focus
// moves into the sheet when it opens, Tab stays inside it, and focus returns to
// what opened it when it closes (so keyboard and screen-reader users are not
// left behind the overlay).
import { useEffect, useRef } from 'react';
import { haptics } from './utils/haptics.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Sheet({ title, onClose, children }) {
  const panel = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Recorded during the first render: an autoFocus field inside the sheet takes focus
  // before any effect runs, and would then be mistaken for the opener.
  const openerRef = useRef(undefined);
  if (openerRef.current === undefined) openerRef.current = typeof document !== 'undefined' ? document.activeElement : null;

  // Drag the handle or title bar down to dismiss: the panel follows the finger
  // (transform only) and either closes past 110px / a quick flick, or springs back.
  const drag = useRef(null);
  const onDragStart = (e) => {
    if (e.target.closest('button')) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onDragMove = (e) => {
    const d = drag.current;
    if (!d) return;
    d.dy = Math.max(0, e.clientY - d.y);
    if (panel.current) { panel.current.style.animation = 'none'; panel.current.style.transition = 'none'; panel.current.style.transform = `translateY(${d.dy}px)`; }
  };
  const onDragEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !panel.current) return;
    const velocity = d.dy / Math.max(1, performance.now() - d.t); // px per ms
    if (d.dy > 110 || (d.dy > 40 && velocity > 0.6)) { haptics.light(); onCloseRef.current(); return; }
    panel.current.style.transition = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
    panel.current.style.transform = 'translateY(0)';
  };

  useEffect(() => {
    const opener = openerRef.current;
    const focusables = () => [...(panel.current?.querySelectorAll(FOCUSABLE) || [])].filter(el => el.offsetParent !== null || el === document.activeElement);
    // Land on the first field (skipping the close button); fall back to the panel itself.
    const first = focusables().find(el => el.getAttribute('aria-label') !== 'Close') || focusables()[0];
    (first || panel.current)?.focus?.();

    const onKey = (e) => {
      if (e.key === 'Escape') { onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) { e.preventDefault(); return; }
      const firstEl = list[0], lastEl = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === firstEl || !panel.current.contains(document.activeElement))) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && (document.activeElement === lastEl || !panel.current.contains(document.activeElement))) { e.preventDefault(); firstEl.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose} className="sheet-backdrop"
      style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}>
      <div ref={panel} tabIndex={-1} className="sheet-panel" onClick={e => e.stopPropagation()} style={{
        width: '100%', maxHeight: '86vh', overflowY: 'auto', boxSizing: 'border-box', outline: 'none',
        background: 'var(--bg-panel)', borderRadius: '20px 20px 0 0',
        padding: '16px 18px calc(18px + env(safe-area-inset-bottom))',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div aria-hidden="true" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}
          style={{ margin: '-10px -18px 0', padding: '10px 0 6px', display: 'flex', justifyContent: 'center', touchAction: 'none', cursor: 'grab' }}>
          <div style={{ width: 38, height: 5, borderRadius: 999, background: 'var(--card-border)' }} />
        </div>
        <div onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', touchAction: 'none' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ width: 44, height: 44, margin: '-8px -10px -8px 0', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
