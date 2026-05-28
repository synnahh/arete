// ─── Assistant Tab ────────────────────────────────────────────────────────────
// VaIerieOrb + chat interface + input bar + quick action buttons

import { useState, useRef, useEffect, useCallback } from 'react';
import VaIerieOrb from '../components/VaIerieOrb.jsx';
import { storage, STORAGE_KEYS } from '../utils/storage.js';

// ─── Icons ─────────────────────────────────────────────────────────────────────
const MicIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
    <path d="M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8" />
  </svg>
);

const SendIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const TrashIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6 M14 11v6" />
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);

// ─── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 10,
    }}>
      <div style={{
        maxWidth: '72%',
        padding: '10px 14px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: isUser ? 'var(--active-bg)' : 'var(--card-fill)',
        border: '0.5px solid var(--card-border)',
        fontSize: 13.5,
        color: 'var(--text-primary)',
        lineHeight: 1.65,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.content}
        {msg.engine && msg.engine !== 'none' && msg.engine !== 'error' && (
          <div style={{
            marginTop: 5, fontSize: 9.5,
            color: 'var(--text-muted)', textAlign: 'right',
          }}>
            via {msg.engine}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quick action chips ────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Daily brief',    prompt: 'Give me a sharp daily brief. What should I focus on today?' },
  { label: 'Motivate me',   prompt: 'Give me a single powerful motivational insight for today. No fluff.' },
  { label: 'Stoic quote',   prompt: 'Give me a relevant Stoic quote and a one-sentence application to daily life.' },
  { label: 'Clear my head', prompt: 'I need to clear my head. Give me a 3-step mental reset I can do right now.' },
];

// ─── Main Assistant Tab ────────────────────────────────────────────────────────
export default function Assistant({ settings, ai }) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Get current theme for orb
  const currentTheme = storage.get(STORAGE_KEYS.SETTINGS, {})?.theme ?? 'obsidian';

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ai?.messages]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || ai?.loading) return;
    ai?.sendMessage(inputText.trim());
    setInputText('');
  }, [inputText, ai]);

  const handleVoice = useCallback(() => {
    if (!ai?.startListening) return;
    ai.startListening();
  }, [ai]);

  const handleQuickAction = useCallback((prompt) => {
    ai?.sendMessage(prompt);
  }, [ai]);

  if (!ai) return null;

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* ── Top: Orb + status ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 24px 12px',
        gap: 8,
        flexShrink: 0,
        borderBottom: '0.5px solid var(--sidebar-divider)',
      }}>
        <VaIerieOrb
          state={ai.orbState}
          theme={currentTheme}
          size={320}
          showHUD={true}
          showWave={true}
        />

        {/* Engine status pills */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <span style={{
            fontSize: 10, padding: '3px 9px', borderRadius: 20,
            background: ai.claudeOnline ? 'rgba(76,175,125,0.12)' : 'rgba(255,255,255,0.04)',
            border: `0.5px solid ${ai.claudeOnline ? 'rgba(76,175,125,0.35)' : 'var(--card-border)'}`,
            color: ai.claudeOnline ? '#4caf7d' : 'var(--text-muted)',
          }}>
            Claude {ai.claudeOnline ? '●' : '○'}
          </span>
          <span style={{
            fontSize: 10, padding: '3px 9px', borderRadius: 20,
            background: ai.ollamaOnline ? 'rgba(76,175,125,0.12)' : 'rgba(255,255,255,0.04)',
            border: `0.5px solid ${ai.ollamaOnline ? 'rgba(76,175,125,0.35)' : 'var(--card-border)'}`,
            color: ai.ollamaOnline ? '#4caf7d' : 'var(--text-muted)',
          }}>
            Ollama {ai.ollamaOnline ? '●' : '○'}
          </span>
          {!ai.claudeOnline && !ai.ollamaOnline && (
            <span style={{
              fontSize: 10, padding: '3px 9px', borderRadius: 20,
              background: 'rgba(229,90,90,0.1)',
              border: '0.5px solid rgba(229,90,90,0.3)',
              color: '#e55a5a',
            }}>
              offline
            </span>
          )}
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 24px',
      }}>
        {ai.messages.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 16, opacity: 0.5,
          }}>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 280 }}>
              Ask me anything. I'm ready when you are.
            </p>

            {/* Quick actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', opacity: 1 }}>
              {QUICK_ACTIONS.map(qa => (
                <button
                  key={qa.label}
                  onClick={() => handleQuickAction(qa.prompt)}
                  style={{
                    padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                    background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
                    color: 'var(--text-secondary)', fontSize: 12,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  {qa.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {ai.messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {ai.loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 10px' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--accent)',
                      animation: `orb-breathe 1s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>VALERIE is thinking…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <div style={{
        padding: '12px 24px 20px',
        borderTop: '0.5px solid var(--sidebar-divider)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        flexShrink: 0,
      }}>
        {/* Quick actions row (when messages exist) */}
        {ai.messages.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK_ACTIONS.slice(0, 3).map(qa => (
              <button
                key={qa.label}
                onClick={() => handleQuickAction(qa.prompt)}
                disabled={ai.loading}
                style={{
                  padding: '4px 10px', borderRadius: 16, cursor: 'pointer',
                  background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
                  color: 'var(--text-secondary)', fontSize: 11,
                  transition: 'all 0.15s ease',
                  opacity: ai.loading ? 0.4 : 1,
                }}
                onMouseEnter={e => { if (!ai.loading) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                {qa.label}
              </button>
            ))}
            <button
              onClick={() => ai.clearHistory?.()}
              style={{
                padding: '4px 8px', borderRadius: 16, cursor: 'pointer',
                background: 'none', border: '0.5px solid var(--card-border)',
                color: 'var(--text-muted)', fontSize: 11,
                display: 'flex', alignItems: 'center', gap: 4,
                marginLeft: 'auto',
              }}
              title="Clear conversation"
            >
              <TrashIcon /> Clear
            </button>
          </div>
        )}

        {/* Text input row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            disabled={ai.loading}
            placeholder={ai.orbState === 'listening' ? 'Listening…' : 'Talk to VALERIE…'}
            style={{
              flex: 1,
              background: 'var(--input-bg)',
              border: '0.5px solid var(--input-border)',
              borderRadius: 10,
              padding: '11px 16px',
              fontSize: 13.5,
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
          />

          {/* Mic */}
          <button
            onClick={handleVoice}
            disabled={ai.loading || ai.orbState === 'listening'}
            title="Voice input"
            style={{
              width: 40, height: 40, borderRadius: 10, border: 'none',
              background: ai.orbState === 'listening' ? 'var(--accent)' : 'var(--hover-bg)',
              color: ai.orbState === 'listening' ? 'var(--bg-base)' : 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease', flexShrink: 0,
            }}
          >
            <MicIcon />
          </button>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || ai.loading}
            title="Send (Enter)"
            style={{
              width: 40, height: 40, borderRadius: 10, border: 'none',
              background: inputText.trim() && !ai.loading ? 'var(--active-bg)' : 'var(--hover-bg)',
              color: inputText.trim() && !ai.loading ? 'var(--accent)' : 'var(--text-muted)',
              cursor: inputText.trim() && !ai.loading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease', flexShrink: 0,
            }}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
