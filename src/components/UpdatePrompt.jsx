// UpdatePrompt — a small banner when a new version of the app is ready (or the app has finished
// saving itself for offline use). Never reloads by itself. Rules: utils/pwaUpdate.js.
import { useEffect, useState } from 'react';
import { applyPwaUpdate } from '../utils/pwaUpdate.js';

const pill = (primary) => ({ minHeight: 40, padding: '0 16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, border: primary ? 'none' : '0.5px solid rgba(255,255,255,0.2)', background: primary ? '#D8B26E' : 'transparent', color: primary ? '#080808' : '#e9e9e9' });

export default function UpdatePrompt() {
  const [state, setState] = useState(null);     // 'update' | 'offline' | null
  useEffect(() => {
    const onUpdate = () => setState('update');
    const onOffline = () => setState(s => s || 'offline');
    window.addEventListener('arete:update-ready', onUpdate);
    window.addEventListener('arete:offline-ready', onOffline);
    return () => { window.removeEventListener('arete:update-ready', onUpdate); window.removeEventListener('arete:offline-ready', onOffline); };
  }, []);
  useEffect(() => {
    if (state !== 'offline') return undefined;
    const t = setTimeout(() => setState(null), 5000);
    return () => clearTimeout(t);
  }, [state]);
  if (!state) return null;
  return (
    <div role="status" aria-live="polite" style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(88px + env(safe-area-inset-bottom))', zIndex: 9500, maxWidth: 440, margin: '0 auto', padding: '12px 14px', borderRadius: 14, background: '#15171c', border: '0.5px solid rgba(255,255,255,0.14)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 10, color: '#f1f1f1' }}>
      <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.4 }}>
        {state === 'update' ? 'A new version of Arete is ready. Reload when you have finished what you are doing.' : 'Arete is saved for offline use.'}
      </div>
      {state === 'update' && <button type="button" onClick={applyPwaUpdate} style={pill(true)}>Reload</button>}
      <button type="button" onClick={() => setState(null)} style={pill(false)}>{state === 'update' ? 'Later' : 'OK'}</button>
    </div>
  );
}
