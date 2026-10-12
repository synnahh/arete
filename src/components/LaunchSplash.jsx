// LaunchSplash — the screen you see for the first moment of every launch: the emblem, the name
// and a thin progress line, on the app's own black. It stays up for a short, fixed time (long
// enough to read as a deliberate launch screen, short enough never to feel slow), fades out, and
// removes itself. It sits above everything, including the PIN screen, so there is no blank flash
// while the app starts. Reduced motion gets a shorter, still version. Transform and opacity only.
import { useEffect, useState } from 'react';

const SHOW_MS = 1200;
const SHOW_MS_REDUCED = 500;
const FADE_MS = 380;

export default function LaunchSplash() {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState('show');       // show -> fade -> gone

  useEffect(() => {
    const a = setTimeout(() => setPhase('fade'), reduced ? SHOW_MS_REDUCED : SHOW_MS);
    const b = setTimeout(() => setPhase('gone'), (reduced ? SHOW_MS_REDUCED : SHOW_MS) + FADE_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [reduced]);

  if (phase === 'gone') return null;
  return (
    <div role="status" aria-live="polite" aria-label="Arete is starting" className={`arete-splash${phase === 'fade' ? ' is-leaving' : ''}`}
      style={{ position: 'fixed', inset: 0, zIndex: 10001, background: '#080808', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <img src="/assets/arete-emblem-gold.png" alt="" width="92" height="92" className="arete-splash-emblem" style={{ width: 92, height: 92, objectFit: 'contain' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 26, letterSpacing: '0.42em', paddingLeft: '0.42em', color: '#F2EAD8' }}>ARETE</div>
        <div style={{ marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#8a8f98' }}>Train · Fuel · Look</div>
      </div>
      <div aria-hidden="true" style={{ width: 120, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div className="arete-splash-bar" style={{ height: '100%', width: '100%', background: '#D8B26E', transformOrigin: 'left center' }} />
      </div>
      <style>{`
        .arete-splash { transition: opacity ${FADE_MS}ms ease; opacity: 1; }
        .arete-splash.is-leaving { opacity: 0; pointer-events: none; }
        .arete-splash-emblem { animation: arete-splash-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; filter: drop-shadow(0 0 24px rgba(216,178,110,0.35)); }
        .arete-splash-bar { animation: arete-splash-fill ${SHOW_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both; }
        @keyframes arete-splash-in { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
        @keyframes arete-splash-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @media (prefers-reduced-motion: reduce) { .arete-splash-emblem, .arete-splash-bar { animation: none; } }
        html[data-motion="reduced"] .arete-splash-emblem, html[data-motion="none"] .arete-splash-emblem { animation: none; }
      `}</style>
    </div>
  );
}
