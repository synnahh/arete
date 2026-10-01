// AuthGate.jsx — Email / password authentication wall
import { useState, useEffect } from 'react';
import AreteLogo from './AreteLogo.jsx';
import { signInWithEmail, signUpWithEmail } from '../supabase/supabase.js';
import { applyTheme } from '../styles/themes.js';

applyTheme('obsidian');

const REMEMBER_KEY = 'valerie_remember_email';

export default function AuthGate() {
  const [mode,     setMode]     = useState('login');   // 'login' | 'signup'
  const [email,    setEmail]    = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [info,     setInfo]     = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) { setEmail(saved); setRemember(true); }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'login') {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password, username.trim());
        setInfo('Account created — you are now signed in.');
      }
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
      // App.jsx onAuthStateChange fires and clears this gate
    } catch (err) {
      if (err.message === 'CHECK_EMAIL') {
        setInfo('Check your email and click the confirmation link, then sign in.');
      } else {
        setError(err.message || 'Authentication failed.');
      }
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
        width: '100%', maxWidth: 380,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 28,
        textAlign: 'center', padding: '0 28px',
        position: 'relative',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <AreteLogo
            alt="Arete"
            style={{
              width: 72, height: 72, objectFit: 'contain',
              filter: 'drop-shadow(0 0 28px rgba(167,139,250,0.5))',
              animation: 'orb-breathe 3.2s ease-in-out infinite',
            }}
          />
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.28em',
              textTransform: 'uppercase', color: 'var(--text-muted)',
              fontFamily: 'ui-monospace, monospace', marginBottom: 10,
            }}>
              ARETE
            </div>
            <div style={{ fontSize: 20, fontWeight: 300, color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.01em' }}>
              {mode === 'login' ? 'Welcome back.' : 'Create account.'}
            </div>
          </div>
        </div>

        <div style={{ width: '100%', height: '0.5px', background: 'rgba(255,255,255,0.07)' }} />

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(167,139,250,0.5)'; }}
            onBlur={e =>  { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          />
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'rgba(167,139,250,0.5)'; }}
              onBlur={e =>  { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
          )}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(167,139,250,0.5)'; }}
            onBlur={e =>  { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          />

          {/* Remember me */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            padding: '2px 2px', userSelect: 'none',
          }}>
            <div
              onClick={() => setRemember(r => !r)}
              style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                border: `1.5px solid ${remember ? 'rgba(167,139,250,0.8)' : 'rgba(255,255,255,0.2)'}`,
                background: remember ? 'rgba(167,139,250,0.2)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              {remember && (
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.5L3.5 6L8 1" stroke="rgba(167,139,250,1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Remember me</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              width: '100%', padding: '13px 20px', borderRadius: 12,
              border: '0.5px solid rgba(167,139,250,0.3)',
              background: loading ? 'rgba(167,139,250,0.05)' : 'rgba(167,139,250,0.12)',
              color: 'rgba(167,139,250,0.9)', fontSize: 14, fontWeight: 500,
              cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading
              ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(167,139,250,0.2)', borderTopColor: 'rgba(167,139,250,0.8)', animation: 'spin 0.7s linear infinite' }} /> Signing in...</>
              : mode === 'login' ? 'Sign in' : 'Create account'
            }
          </button>

          {error && <div style={{ fontSize: 12, color: '#e55a5a', textAlign: 'center', lineHeight: 1.4 }}>{error}</div>}
          {info  && <div style={{ fontSize: 12, color: '#4caf7d', textAlign: 'center', lineHeight: 1.4 }}>{info}</div>}
        </form>

        {/* Toggle mode */}
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); setInfo(''); }}
            style={{ background: 'none', border: 'none', color: 'rgba(167,139,250,0.7)', fontSize: 12, cursor: 'pointer', padding: 0 }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', lineHeight: 1.6 }}>
          Private access only. Unauthorised access is not permitted.
        </div>
      </div>

      <style>{`
        @keyframes orb-breathe {
          0%, 100% { transform: scale(1);    opacity: 0.9; }
          50%       { transform: scale(1.06); opacity: 1;   }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>
    </div>
  );
}
