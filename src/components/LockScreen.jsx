// LockScreen — password-only gate with Face ID / Touch ID via WebAuthn
import { useState, useEffect, useRef } from 'react';
import AreteLogo from './AreteLogo.jsx';
import { applyTheme } from '../styles/themes.js';

applyTheme('obsidian');

const LOCK_HASH_KEY   = 'valerie_lock_hash';
const WEBAUTHN_ID_KEY = 'valerie_webauthn_id';

// ─── helpers ────────────────────────────────────────────────────────────────

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function b64encode(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64decode(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function platformAuthAvailable() {
  try {
    return !!(
      window.PublicKeyCredential &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    );
  } catch { return false; }
}

async function registerBiometric() {
  const challenge = randomBytes(32);
  const userId    = randomBytes(16);
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Arete', id: window.location.hostname },
      user: { id: userId, name: 'valerie-user', displayName: 'Arete' },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        requireResidentKey: false,
      },
      timeout: 60000,
    },
  });
  localStorage.setItem(WEBAUTHN_ID_KEY, b64encode(credential.rawId));
  return true;
}

async function verifyBiometric() {
  const credId = localStorage.getItem(WEBAUTHN_ID_KEY);
  if (!credId) return false;
  await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ id: b64decode(credId), type: 'public-key' }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  return true; // throws on failure / cancel
}

// ─── component ───────────────────────────────────────────────────────────────

export default function LockScreen({ onUnlock }) {
  const hasHash     = !!localStorage.getItem(LOCK_HASH_KEY);
  const [mode, setMode] = useState(hasHash ? 'lock' : 'setup'); // 'setup' | 'lock'

  const [pass,    setPass]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvail, setBiometricAvail] = useState(false);
  const [hasBiometric,   setHasBiometric]   = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    (async () => {
      const avail = await platformAuthAvailable();
      setBiometricAvail(avail);
      setHasBiometric(avail && !!localStorage.getItem(WEBAUTHN_ID_KEY));
    })();
  }, []);

  // ── auto-trigger Face ID if credential already registered ─────────────────
  useEffect(() => {
    if (mode === 'lock' && hasBiometric) {
      setTimeout(() => handleBiometric(), 400);
    }
  }, [mode, hasBiometric]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSetup(e) {
    e.preventDefault();
    if (pass.length < 4) { setError('Minimum 4 characters.'); return; }
    if (pass !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const hash = await sha256(pass);
      localStorage.setItem(LOCK_HASH_KEY, hash);

      // Offer to register biometrics right after setting password
      if (biometricAvail) {
        try { await registerBiometric(); setHasBiometric(true); } catch { /* skipped */ }
      }
      onUnlock();
    } catch (err) {
      setError(err.message || 'Setup failed.');
      setLoading(false);
    }
  }

  async function handleUnlock(e) {
    e.preventDefault();
    if (!pass) return;
    setLoading(true);
    setError('');
    try {
      const hash   = await sha256(pass);
      const stored = localStorage.getItem(LOCK_HASH_KEY);
      if (hash === stored) {
        onUnlock();
      } else {
        setError('Incorrect password.');
        setPass('');
        setLoading(false);
        inputRef.current?.focus();
      }
    } catch (err) {
      setError(err.message || 'Error.');
      setLoading(false);
    }
  }

  async function handleBiometric() {
    setError('');
    try {
      await verifyBiometric();
      onUnlock();
    } catch (err) {
      if (err?.name !== 'NotAllowedError') {
        setError('Biometric failed — enter your password.');
      }
    }
  }

  const inputStyle = {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    border: '0.5px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.9)', fontSize: 16,
    outline: 'none', boxSizing: 'border-box',
    letterSpacing: '0.08em', textAlign: 'center',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-base, #080c14)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      <div style={{
        width: '100%', maxWidth: 340,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 32,
        textAlign: 'center', padding: '0 28px',
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <AreteLogo
            alt="Arete"
            style={{
              width: 68, height: 68, objectFit: 'contain',
              filter: 'drop-shadow(0 0 28px rgba(167,139,250,0.5))',
              animation: 'orb-breathe 3.2s ease-in-out infinite',
            }}
          />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.2)', fontFamily: 'ui-monospace, monospace' }}>
            ARETE
          </div>
          <div style={{ fontSize: 18, fontWeight: 300, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
            {mode === 'setup' ? 'Create your access code.' : 'Welcome back.'}
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={mode === 'setup' ? handleSetup : handleUnlock}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <input
            ref={inputRef}
            type="password"
            placeholder={mode === 'setup' ? 'Create password' : 'Password'}
            value={pass}
            onChange={e => { setPass(e.target.value); setError(''); }}
            autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
            style={inputStyle}
            onFocus={e  => { e.target.style.borderColor = 'rgba(167,139,250,0.5)'; }}
            onBlur={e   => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          />
          {mode === 'setup' && (
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(''); }}
              autoComplete="new-password"
              style={inputStyle}
              onFocus={e  => { e.target.style.borderColor = 'rgba(167,139,250,0.5)'; }}
              onBlur={e   => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px 20px', borderRadius: 12,
              border: '0.5px solid rgba(167,139,250,0.3)',
              background: loading ? 'rgba(167,139,250,0.05)' : 'rgba(167,139,250,0.12)',
              color: 'rgba(167,139,250,0.9)', fontSize: 14, fontWeight: 500,
              cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading
              ? <><Spinner />Unlocking...</>
              : mode === 'setup' ? 'Set access code' : 'Unlock'
            }
          </button>
        </form>

        {/* Face ID / Touch ID button */}
        {mode === 'lock' && hasBiometric && (
          <button
            onClick={handleBiometric}
            style={{
              background: 'none', border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '12px 24px',
              color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.15s',
            }}
          >
            <FaceIDIcon />
            Use Face ID
          </button>
        )}

        {/* Setup: offer to register biometrics later */}
        {mode === 'setup' && biometricAvail && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>
            Face ID will be offered after you set your password.
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12, color: '#e55a5a', lineHeight: 1.4 }}>{error}</div>
        )}

        {/* Reset link */}
        {mode === 'lock' && (
          <button
            onClick={() => {
              if (window.confirm('This will clear your access code and sign you out. Continue?')) {
                localStorage.removeItem(LOCK_HASH_KEY);
                localStorage.removeItem(WEBAUTHN_ID_KEY);
                window.location.reload();
              }
            }}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)', fontSize: 11, cursor: 'pointer', padding: 0 }}
          >
            Forgot password
          </button>
        )}
      </div>

      <style>{`
        @keyframes orb-breathe {
          0%, 100% { transform: scale(1);    opacity: 0.9; }
          50%       { transform: scale(1.06); opacity: 1;   }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      border: '2px solid rgba(167,139,250,0.2)',
      borderTopColor: 'rgba(167,139,250,0.8)',
      animation: 'spin 0.7s linear infinite',
    }} />
  );
}

function FaceIDIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7V5a2 2 0 0 1 2-2h2"/>
      <path d="M22 7V5a2 2 0 0 0-2-2h-2"/>
      <path d="M2 17v2a2 2 0 0 0 2 2h2"/>
      <path d="M22 17v2a2 2 0 0 1-2 2h-2"/>
      <path d="M9 10h.01"/>
      <path d="M15 10h.01"/>
      <path d="M9.5 15a3.5 3.5 0 0 0 5 0"/>
      <path d="M12 7v3"/>
    </svg>
  );
}

// ─── exported helpers for Settings ───────────────────────────────────────────

export async function changeLockPassword(newPass) {
  const hash = await sha256(newPass);
  localStorage.setItem(LOCK_HASH_KEY, hash);
}

export async function clearLockScreen() {
  localStorage.removeItem(LOCK_HASH_KEY);
  localStorage.removeItem(WEBAUTHN_ID_KEY);
}

export function lockScreenEnabled() {
  return !!localStorage.getItem(LOCK_HASH_KEY);
}
