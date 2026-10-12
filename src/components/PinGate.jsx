// PinGate.jsx — simple hardcoded PIN entry to open the app.
// Single-user, local-only. No creation flow — the PIN is fixed.
import { useState, useEffect, useCallback, useRef } from 'react';
import AreteLogo from './AreteLogo.jsx';
import { applyTheme } from '../styles/themes.js';
import { biometricAvailable, biometricLabel, faceIdEnabled, faceIdDeclined, declineFaceId, enableFaceIdDetailed, unlockWithFaceId, forgetFaceId } from '../utils/faceId.js';

applyTheme('obsidian');

const PIN = '0308';
const LEN = PIN.length;

export default function PinGate({ onUnlock }) {
  const [entry, setEntry] = useState('');
  const [error, setError] = useState(false);
  const [bioReady, setBioReady] = useState(false);   // device can do Face ID
  const [bioOn, setBioOn] = useState(faceIdEnabled());
  const [offer, setOffer] = useState(false);         // asking whether to turn Face ID on
  const [offerError, setOfferError] = useState('');  // why turning it on failed (never counts as declining)
  const label = biometricLabel();

  useEffect(() => { biometricAvailable().then(setBioReady); }, []);

  const unlockRef = useRef(onUnlock);
  unlockRef.current = onUnlock;   // keeps tryFaceId stable so the prompt fires once, not on every parent render
  const tryFaceId = useCallback(async () => {
    if (await unlockWithFaceId()) unlockRef.current();
  }, []);

  // Prompt for Face ID as soon as the gate opens; the button below covers the
  // case where the browser wants a tap first.
  useEffect(() => { if (bioOn) tryFaceId(); }, [bioOn, tryFaceId]);

  const press = useCallback((digit) => {
    setEntry(prev => (prev.length >= LEN ? prev : prev + digit));
  }, []);

  const backspace = useCallback(() => setEntry(prev => prev.slice(0, -1)), []);

  // Auto-submit as soon as the full PIN is entered — no Enter key needed.
  useEffect(() => {
    if (entry.length < LEN) return;
    if (entry === PIN) {
      if (bioReady && !faceIdEnabled() && !faceIdDeclined()) setOffer(true);
      else onUnlock();
    } else {
      setError(true);
      const t = setTimeout(() => { setError(false); setEntry(''); }, 500);
      return () => clearTimeout(t);
    }
  }, [entry, onUnlock, bioReady]);

  // Physical keyboard support
  useEffect(() => {
    const onKey = (e) => {
      if (offer) return;
      if (e.key >= '0' && e.key <= '9') press(e.key);
      else if (e.key === 'Backspace') backspace();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, backspace, offer]);

  const keySx = {
    width: 64, height: 64, borderRadius: '50%',
    border: '0.5px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.85)', fontSize: 22, fontWeight: 300,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.12s, transform 0.08s', userSelect: 'none',
  };

  const linkSx = { background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', padding: 4 };

  const Key = ({ children, onClick, faint }) => (
    <button
      onClick={onClick}
      style={{ ...keySx, ...(faint ? { border: 'none', background: 'transparent', fontSize: 14, color: 'var(--text-muted)' } : {}) }}
      onMouseDown={e => { e.currentTarget.style.background = faint ? 'transparent' : 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'scale(0.94)'; }}
      onMouseUp={e => { e.currentTarget.style.background = faint ? 'transparent' : 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = faint ? 'transparent' : 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {children}
    </button>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-base, #080c14)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
        {/* Logo */}
        <AreteLogo
          alt="Arete"
          style={{
            width: 64, height: 64, objectFit: 'contain',
            filter: 'drop-shadow(0 0 28px rgba(167,139,250,0.5))',
            animation: 'pin-breathe 3.2s ease-in-out infinite',
          }}
        />

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.28em',
            textTransform: 'uppercase', color: 'var(--text-muted)',
            fontFamily: 'ui-monospace, monospace', marginBottom: 10,
          }}>ARETE</div>
          <div style={{ fontSize: 15, fontWeight: 300, color: 'var(--text-secondary)' }}>
            {offer ? `Unlock faster with ${label}?` : 'Enter your PIN'}
          </div>
        </div>

        {!offer && (<>
        {/* PIN dots */}
        <div style={{ display: 'flex', gap: 16, animation: error ? 'pin-shake 0.4s' : 'none' }}>
          {Array.from({ length: LEN }).map((_, i) => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: '50%',
              border: `1.5px solid ${error ? '#e55a5a' : 'rgba(167,139,250,0.6)'}`,
              background: i < entry.length ? (error ? '#e55a5a' : 'rgba(167,139,250,0.9)') : 'transparent',
              transition: 'background 0.12s, border-color 0.12s',
            }} />
          ))}
        </div>

        {/* Keypad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: 18, justifyItems: 'center' }}>
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <Key key={d} onClick={() => press(d)}>{d}</Key>
          ))}
          <div />
          <Key onClick={() => press('0')}>0</Key>
          <Key faint onClick={backspace}>⌫</Key>
        </div>
        {bioReady && bioOn && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <button onClick={tryFaceId} style={{ ...linkSx, fontSize: 14 }}>Use {label}</button>
            <button onClick={() => { forgetFaceId(); setBioOn(false); }} style={linkSx}>Turn off {label} on this device</button>
          </div>
        )}
        </>)}
        {offer && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <button
              onClick={async () => {
                const r = await enableFaceIdDetailed();
                if (r.ok) { setBioOn(true); onUnlock(); } else setOfferError(r.error);   // stay here so you can try again
              }}
              style={{ ...linkSx, fontSize: 15, padding: '12px 28px', border: '0.5px solid rgba(167,139,250,0.6)', borderRadius: 12 }}
            >{offerError ? `Try ${label} again` : `Turn on ${label}`}</button>
            {offerError && <div role="alert" style={{ maxWidth: 280, textAlign: 'center', fontSize: 12.5, lineHeight: 1.45, color: '#e8a13a' }}>{offerError}</div>}
            <button onClick={() => { if (!offerError) declineFaceId(); onUnlock(); }} style={linkSx}>{offerError ? 'Skip for now' : 'Not now'}</button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pin-breathe {
          0%, 100% { transform: scale(1);    opacity: 0.9; }
          50%       { transform: scale(1.06); opacity: 1;   }
        }
        @keyframes pin-shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
