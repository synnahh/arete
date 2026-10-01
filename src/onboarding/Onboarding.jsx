import { useState } from 'react';
import AreteLogo from '../components/AreteLogo.jsx';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { applyTheme } from '../styles/themes.js';
import { PrimaryButton } from './steps/Step1Welcome.jsx';

applyTheme('obsidian');

export default function Onboarding({ onComplete }) {
  const [name,  setName]  = useState('');
  const [ready, setReady] = useState(false);

  function finish(overrideName) {
    const userName = (overrideName ?? name).trim();
    storage.set(STORAGE_KEYS.USER,     { name: userName });
    storage.set(STORAGE_KEYS.SETTINGS, { userName, theme: 'obsidian' });
    storage.set(STORAGE_KEYS.ONBOARDED, true);
    onComplete({ userName, theme: 'obsidian' });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 999, padding: '0 24px',
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 36, textAlign: 'center',
      }}>

        {/* Logo */}
        <AreteLogo alt="Arete" style={{
          width: 100, height: 100, objectFit: 'contain',
          filter: 'drop-shadow(0 0 24px var(--orb-glow))',
          animation: 'orb-breathe 3.2s ease-in-out infinite',
        }} />

        {/* Heading */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h1 style={{ fontSize: 32, fontWeight: 300, letterSpacing: '0.06em', color: 'var(--text-primary)', margin: 0 }}>
            Welcome.
          </h1>
        </div>

        {/* Name input */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            What's your name?
          </p>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setReady(e.target.value.trim().length > 0); }}
            onKeyDown={e => { if (e.key === 'Enter' && ready) finish(); }}
            placeholder="Your name"
            style={{
              width: '100%', padding: '13px 18px', borderRadius: 12,
              border: '0.5px solid var(--input-border)', background: 'var(--input-bg)',
              color: 'var(--text-primary)', fontSize: 16, fontWeight: 300,
              outline: 'none', textAlign: 'center', letterSpacing: '0.04em',
              transition: 'border-color 0.18s ease', boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
          <PrimaryButton onClick={() => finish()} disabled={!ready}>
            Continue
          </PrimaryButton>
          <button onClick={() => finish('')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.04em', padding: 0,
          }}>
            Skip for now
          </button>
        </div>

      </div>
    </div>
  );
}
