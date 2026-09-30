// SignIn.jsx — one-time sign-in per device.
// Supabase persists the session and auto-refreshes it, so this appears once and
// then effectively never again. It exists so every device shares ONE user id,
// which is what makes cross-device sync work (RLS scopes rows to auth.uid()).
import { useState, useEffect } from 'react';
import { signInWithEmail } from '../supabase/supabase.js';
import { applyTheme } from '../styles/themes.js';

applyTheme('obsidian');

const LAST_EMAIL_KEY = 'valerie_last_email';

export default function SignIn({ onSignedIn }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(LAST_EMAIL_KEY);
    if (saved) setEmail(saved);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password || loading) return;
    setLoading(true);
    setError('');
    try {
      await signInWithEmail(email.trim(), password);
      localStorage.setItem(LAST_EMAIL_KEY, email.trim());
      onSignedIn?.();
    } catch (err) {
      setError(err?.message || 'Sign in failed.');
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '0.5px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.85)', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-base, #080c14)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998,
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      <div style={{
        width: '100%', maxWidth: 360, padding: '0 28px', position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center',
      }}>
        <img
          src="/assets/valerie-logo.png"
          alt="Arete"
          style={{ width: 60, height: 60, objectFit: 'contain', filter: 'drop-shadow(0 0 28px rgba(167,139,250,0.5))' }}
        />

        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase',
            color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace', marginBottom: 10,
          }}>ARETE</div>
          <div style={{ fontSize: 18, fontWeight: 300, color: 'rgba(255,255,255,0.85)' }}>
            Connect this device
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
            One time only — this device stays signed in afterwards so your data
            syncs everywhere.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email" placeholder="Email" value={email} autoComplete="email" required
            onChange={e => setEmail(e.target.value)} style={inputStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(167,139,250,0.5)'; }}
            onBlur={e =>  { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          />
          <input
            type="password" placeholder="Password" value={password} autoComplete="current-password" required
            onChange={e => setPassword(e.target.value)} style={inputStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(167,139,250,0.5)'; }}
            onBlur={e =>  { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          />
          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 4, width: '100%', padding: '13px 20px', borderRadius: 12,
              border: '0.5px solid rgba(167,139,250,0.3)',
              background: loading ? 'rgba(167,139,250,0.05)' : 'rgba(167,139,250,0.12)',
              color: 'rgba(167,139,250,0.9)', fontSize: 14, fontWeight: 500,
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Connecting…' : 'Connect'}
          </button>
          {error && <div style={{ fontSize: 12, color: '#e55a5a', lineHeight: 1.4 }}>{error}</div>}
        </form>
      </div>

      <style>{`input::placeholder { color: rgba(255,255,255,0.25); }`}</style>
    </div>
  );
}
