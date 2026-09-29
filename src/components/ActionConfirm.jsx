// Confirmation cards for assistant actions that change settings. actions.js
// raises `valerie:confirm-action`; nothing runs until Apply is tapped.
// Rules for what needs a card: src/ai/confirm.js.
import { useEffect, useState } from 'react';
import { runConfirmed } from '../ai/actions.js';

export default function ActionConfirm({ phone = false }) {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const onAsk = (e) => {
      const d = e.detail;
      if (!d?.action || !d.title) return;
      setQueue(q => [...q, { id: `${Date.now()}_${q.length}`, ...d }].slice(-5));
    };
    window.addEventListener('valerie:confirm-action', onAsk);
    return () => window.removeEventListener('valerie:confirm-action', onAsk);
  }, []);

  if (!queue.length) return null;
  const [item, ...rest] = queue;
  const done = () => setQueue(rest);

  return (
    <div role="alertdialog" aria-label="Assistant request" aria-live="assertive" style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', zIndex: 10001,
      bottom: phone ? 'calc(150px + env(safe-area-inset-bottom))' : 90,
      width: 'min(420px, calc(100vw - 32px))', boxSizing: 'border-box',
      background: 'var(--bg-panel)', border: '0.5px solid var(--tab-accent)', borderRadius: 14, padding: 14,
      boxShadow: '0 6px 28px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
        VALERIE wants to change a setting{rest.length ? ` · ${rest.length} more waiting` : ''}
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.4, color: 'var(--text-primary)' }}>{item.title}</div>
      {item.detail && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: -4 }}>{item.detail}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={async () => { done(); await runConfirmed(item.action); }}
          style={{ flex: 1, minHeight: 44, borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, background: 'var(--tab-accent)', color: 'var(--on-tab-accent)' }}>Apply</button>
        <button type="button" onClick={done}
          style={{ flex: 1, minHeight: 44, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, background: 'transparent', border: '0.5px solid var(--card-border)', color: 'var(--text-secondary)' }}>Not now</button>
      </div>
    </div>
  );
}
