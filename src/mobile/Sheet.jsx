// Bottom sheet for the phone screens: backdrop tap or Escape closes it. Focus
// moves into the sheet when it opens, Tab stays inside it, and focus returns to
// what opened it when it closes (so keyboard and screen-reader users are not
// left behind the overlay).
import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Sheet({ title, onClose, children }) {
  const panel = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Recorded during the first render: an autoFocus field inside the sheet takes focus
  // before any effect runs, and would then be mistaken for the opener.
  const openerRef = useRef(undefined);
  if (openerRef.current === undefined) openerRef.current = typeof document !== 'undefined' ? document.activeElement : null;

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
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}>
      <div ref={panel} tabIndex={-1} onClick={e => e.stopPropagation()} style={{
        width: '100%', maxHeight: '86vh', overflowY: 'auto', boxSizing: 'border-box', outline: 'none',
        background: 'var(--bg-panel)', borderRadius: '20px 20px 0 0',
        padding: '16px 18px calc(18px + env(safe-area-inset-bottom))',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ width: 44, height: 44, margin: '-8px -10px -8px 0', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
