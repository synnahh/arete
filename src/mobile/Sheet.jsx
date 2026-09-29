// Bottom sheet for the phone screens: backdrop tap or Escape closes it.
import { useEffect } from 'react';

export default function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxHeight: '86vh', overflowY: 'auto', boxSizing: 'border-box',
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
