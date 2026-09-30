//  MobileAI.jsx  VALERIE AI assistant screen for iOS PWA
//  Text-only on iOS  voice (mic input + TTS output) is disabled on mobile.
import { useState, useRef, useEffect } from 'react';
import { storage, STORAGE_KEYS }          from '../../utils/storage.js';

// ── Orb ────────────────────────────────────────────────────────────────────────
function Orb({ state }) {
  const color = state === 'listening' ? '#4a9eff'
              : state === 'thinking'  ? '#f59e0b'
              : state === 'speaking'  ? 'var(--accent)'
              : 'var(--text-muted)';

  const pulse = state === 'listening' || state === 'speaking';

  return (
    <div style={{ position: 'relative', width: 80, height: 80,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {pulse && (
        <div style={{
          position: 'absolute', inset: -12, borderRadius: '50%',
          background: color, opacity: 0.12,
          animation: 'orbPulse 1.6s ease-in-out infinite',
        }} />
      )}
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${color}40, ${color}15)`,
        border: `1.5px solid ${color}60`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.3s ease',
        boxShadow: pulse ? `0 0 24px ${color}40` : 'none',
      }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%',
          background: color, opacity: state === 'idle' ? 0.4 : 0.9 }} />
      </div>
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 8,
    }}>
      <div style={{
        maxWidth: '80%', padding: '10px 14px', borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isUser ? 'var(--active-bg)' : 'var(--bg-panel)',
        border: `0.5px solid ${isUser ? 'var(--accent)' : 'var(--card-border)'}`,
        fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5,
      }}>
        {msg.content}
      </div>
    </div>
  );
}

export default function MobileAI({ settings, ai, compact = false }) {
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  const orbState = ai?.orbState || 'idle';
  const messages = ai?.messages || [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function send() {
    if (!input.trim() || ai?.loading) return;
    ai.sendMessage(input.trim());
    setInput('');
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      <style>{`
        @keyframes orbPulse {
          0%, 100% { transform: scale(1); opacity: 0.12; }
          50%       { transform: scale(1.3); opacity: 0.06; }
        }
      `}</style>

      {/* Header — hidden when compact (sheet has its own) */}
      {!compact && (
        <div style={{ padding: '16px 16px 0', paddingTop: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', marginBottom: 4 }}>
            VALERIE
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {ai?.claudeOnline ? 'Claude online' : 'Offline mode'}
          </div>
        </div>
      )}

      {/* Orb — shown when no messages or always on top */}
      {messages.length === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 32px' }}>
          <Orb state={orbState} />
          <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Type a message below<br />to chat with VALERIE
          </div>
        </div>
      )}

      {/* Message history */}
      {messages.length > 0 && (
        <div ref={scrollRef} style={{
          flex: 1, overflowY: 'auto', padding: '16px',
          scrollBehavior: 'smooth',
        }}>
          {messages.filter(m => m.role !== 'system').map((m, i) => (
            <Bubble key={i} msg={m} />
          ))}
          {ai?.loading && (
            <div style={{ display: 'flex', gap: 6, padding: '8px 14px' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)',
                  animation: `orbPulse 1s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input bar */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-sidebar)',
        borderTop: '0.5px solid var(--card-border)',
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        {/* Text input  (mic removed: iOS is text-only) */}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask VALERIE anything…"
          style={{
            flex: 1, background: 'var(--input-bg)', border: '0.5px solid var(--input-border)',
            borderRadius: 22, padding: '10px 16px', fontSize: 14,
            color: 'var(--text-primary)', outline: 'none',
            caretColor: 'var(--accent)',
          }}
        />

        {/* Send */}
        <button onClick={send} disabled={!input.trim() || ai?.loading} style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: input.trim() ? 'var(--accent)' : 'var(--hover-bg)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent', transition: 'background 0.2s ease',
          opacity: input.trim() && !ai?.loading ? 1 : 0.4,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
              stroke="var(--bg-base)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
