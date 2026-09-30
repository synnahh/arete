import { useState } from 'react';
import { Icon as LineIcon } from '../../components/icons.jsx';
import { PrimaryButton } from './Step1Welcome.jsx';
import { BackButton } from './Step2Name.jsx';

export default function Step4ApiKey({ data, update, next, back }) {
  const [val, setVal]   = useState(data.apiKey || '');
  const [show, setShow] = useState(false);

  function handleContinue() {
    update({ apiKey: val.trim() });
    next();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <BackButton onClick={back} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><LineIcon name="key" size={26} strokeWidth={1.5} /></div>
        <h2 style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          Anthropic API key
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Optional — paste your key for full AI intelligence. Without it I'll run
          locally via Ollama. You can add this later in Settings.
        </p>
      </div>

      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="sk-ant-… (optional)"
          style={{
            width: '100%', padding: '14px 44px 14px 16px', borderRadius: 10,
            border: '0.5px solid var(--input-border)',
            background: 'var(--input-bg)', color: 'var(--text-primary)',
            fontSize: 14, outline: 'none', fontFamily: 'monospace',
            transition: 'border-color 0.18s ease',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; }}
        />
        <button onClick={() => setShow(s => !s)} style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 12,
        }}>
          {show ? 'hide' : 'show'}
        </button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        🔒 Your key is stored encrypted on your device and never shared.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <PrimaryButton onClick={handleContinue}>Continue →</PrimaryButton>
        <button onClick={() => { update({ apiKey: '' }); next(); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 13, letterSpacing: '0.04em',
            padding: '8px 0', textAlign: 'left',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={e => e.target.style.color = 'var(--text-secondary)'}
          onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
