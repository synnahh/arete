import { useState } from 'react';
import { PrimaryButton } from './Step1Welcome.jsx';
import { BackButton } from './Step2Name.jsx';

export default function Step3AssistantName({ data, update, next, back }) {
  const [val, setVal]         = useState(data.assistantName || 'VALERIE');
  const [editing, setEditing] = useState(false);

  function handleKeep() {
    update({ assistantName: 'VALERIE' });
    next();
  }
  function handleCustom() {
    const trimmed = val.trim();
    if (!trimmed) return;
    update({ assistantName: trimmed });
    next();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <BackButton onClick={back} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          What's my name?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          I'm <span style={{ color: 'var(--accent)' }}>VALERIE</span> by default — but you can call me anything.
          {' '}This can be changed anytime in Settings.
        </p>
      </div>

      {editing ? (
        <>
          <input
            autoFocus
            type="text"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCustom(); }}
            placeholder="Enter a name"
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 10,
              border: '0.5px solid var(--accent)',
              background: 'var(--input-bg)', color: 'var(--text-primary)',
              fontSize: 16, outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 12 }}>
            <PrimaryButton onClick={handleCustom} disabled={!val.trim()}>
              Use this name →
            </PrimaryButton>
            <button onClick={() => { setVal('VALERIE'); setEditing(false); }}
              style={{
                padding: '12px 20px', borderRadius: 10,
                border: '0.5px solid var(--card-border)',
                background: 'transparent', color: 'var(--text-secondary)',
                fontSize: 14, cursor: 'pointer',
              }}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PrimaryButton onClick={handleKeep}>Keep VALERIE →</PrimaryButton>
          <button onClick={() => { setVal(''); setEditing(true); }}
            style={{
              padding: '10px 16px', borderRadius: 10, border: 'none',
              background: 'none', color: 'var(--text-muted)', fontSize: 13,
              cursor: 'pointer', letterSpacing: '0.04em',
              textAlign: 'left',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => e.target.style.color = 'var(--text-secondary)'}
            onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
          >
            Change it
          </button>
        </div>
      )}
    </div>
  );
}
