// ─── Quick Capture — floating universal input accessible from any tab ─────────
// Ctrl+Space to open | Esc to close | Enter to send to VALERIE

import { useState, useEffect, useRef, useCallback } from 'react';

const MicIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
    <path d="M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8" />
  </svg>
);

const SendIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export default function QuickCapture({ ai }) {
  const [open, setOpen]     = useState(false);
  const [text, setText]     = useState('');
  const [sent, setSent]     = useState(false);
  const [listening, setListening] = useState(false);
  const inputRef = useRef(null);

  // ── Keyboard shortcut: Ctrl+Space ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setText('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      setText('');
      setSent(false);
    }
  }, [open]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    if (!text.trim()) return;
    ai?.sendMessage(text.trim());
    setSent(true);
    setTimeout(() => {
      setOpen(false);
      setText('');
      setSent(false);
    }, 600);
  }, [text, ai]);

  // ── Voice capture ─────────────────────────────────────────────────────────
  const handleVoice = useCallback(() => {
    if (!ai?.startListening) return;
    setListening(true);
    ai.startListening((transcript) => {
      setText(transcript);
      setListening(false);
    });
  }, [ai]);

  if (!open) {
    return (
      <button
        title="Quick Capture (Ctrl+Space)"
        onClick={() => setOpen(true)}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--active-bg)',
          border: '0.5px solid var(--card-border)',
          color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
          fontSize: 18,
          zIndex: 100,
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >⚡</button>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: 24,
      right: 24,
      zIndex: 200,
    }}>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.2)',
          backdropFilter: 'blur(2px)',
          zIndex: -1,
        }}
      />

      {/* Input panel */}
      <div style={{
        background: 'var(--bg-panel)',
        border: '0.5px solid var(--card-border)',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: 380,
        boxShadow: '0 12px 48px rgba(0,0,0,0.55)',
        backdropFilter: 'blur(24px)',
        animation: 'slide-up 0.18s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Label */}
        <div style={{
          fontSize: 10.5, color: 'var(--text-muted)',
          letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: 'var(--accent)', fontSize: 14 }}>✦</span>
          QUICK CAPTURE
          <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: 10.5 }}>Esc to close</span>
        </div>

        {/* Input row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={sent ? '✓ Sent to VALERIE' : 'Ask VALERIE anything...'}
            disabled={sent}
            style={{
              flex: 1,
              background: 'var(--input-bg)',
              border: '0.5px solid var(--input-border)',
              borderRadius: 8,
              padding: '9px 12px',
              fontSize: 13.5,
              color: sent ? 'var(--accent)' : 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
          />

          {/* Voice button */}
          <button
            onClick={handleVoice}
            disabled={sent || listening}
            title="Voice input"
            style={{
              width: 34, height: 34, borderRadius: 8, border: 'none',
              background: listening ? 'var(--accent)' : 'var(--hover-bg)',
              color: listening ? 'var(--bg-base)' : 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            <MicIcon />
          </button>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!text.trim() || sent}
            title="Send (Enter)"
            style={{
              width: 34, height: 34, borderRadius: 8, border: 'none',
              background: text.trim() && !sent ? 'var(--active-bg)' : 'var(--hover-bg)',
              color: text.trim() && !sent ? 'var(--accent)' : 'var(--text-muted)',
              cursor: text.trim() && !sent ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            <SendIcon />
          </button>
        </div>

        {/* Engine hint */}
        {ai && (
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
            <span style={{ color: ai.claudeOnline ? '#4caf7d' : 'var(--text-muted)' }}>
               Claude {ai.claudeOnline ? 'ready' : 'offline'}
            </span>
            <span style={{ color: ai.ollamaOnline ? '#4caf7d' : 'var(--text-muted)' }}>
               Ollama {ai.ollamaOnline ? 'ready' : 'offline'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
