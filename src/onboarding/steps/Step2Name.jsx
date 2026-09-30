import { useState } from 'react';
import { PrimaryButton } from './Step1Welcome.jsx';

export default function Step2Name({ data, update, next, back }) {
  const [val, setVal] = useState(data.userName || '');

  function handleNext() {
    const trimmed = val.trim();
    if (!trimmed) return;
    update({ userName: trimmed });
    next();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <BackButton onClick={back} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          What do I call you?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          This is how I'll address you throughout the app.{' '}
          You can change it anytime in Settings.
        </p>
      </div>

      <input
        autoFocus
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleNext(); }}
        placeholder="Your name or preferred title"
        style={{
          width: '100%',
          padding: '14px 16px',
          borderRadius: 10,
          border: '0.5px solid var(--input-border)',
          background: 'var(--input-bg)',
          color: 'var(--text-primary)',
          fontSize: 16,
          outline: 'none',
          transition: 'border-color 0.18s ease',
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; }}
      />

      <PrimaryButton onClick={handleNext} disabled={!val.trim()}>
        Continue →
      </PrimaryButton>
    </div>
  );
}

export function BackButton({ onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--text-muted)', fontSize: 12,
      padding: 0, letterSpacing: '0.04em',
      transition: 'color 0.15s ease',
    }}
    onMouseEnter={e => e.target.style.color = 'var(--text-secondary)'}
    onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
    >
      ← Back
    </button>
  );
}
