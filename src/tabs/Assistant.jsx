// ─── Assistant Tab — VALERIE voice interface ───────────────────────────────────
// Continuous voice session mode: one click starts, stays open until silence/stop intent.
// Orb state drives all visual feedback. Messages display cleaned AI output.

import { useState, useRef, useEffect, useCallback } from 'react';
import VaIerieOrb from '../components/VaIerieOrb.jsx';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { MIC_DISABLED } from '../ai/useAI.js';
import { toLocalDateKey } from '../utils/localDate.js';

// ─── Icons ─────────────────────────────────────────────────────────────────────
const MicIcon = ({ active }) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={active ? 2 : 1.7}
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
    <path d="M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8" />
  </svg>
);

const SendIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const StopIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);

const TrashIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.6}
    strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6 M14 11v6" />
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);

const CopyIcon = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const ExportIcon = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.7}
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// ─── Quick actions ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Daily brief',   prompt: 'Give me my daily brief.' },
  { label: 'How am I doing', prompt: 'How am I doing overall — tasks, habits, everything.' },
  { label: 'Focus mode',    prompt: 'Start a focus session.' },
  { label: 'Stoic quote',   prompt: 'Give me a Stoic quote worth thinking about today.' },
];

// ─── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 10,
    }}>
      <div
        style={{
          maxWidth: '74%',
          padding: '10px 14px',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: isUser
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(255,255,255,0.03)',
          border: isUser
            ? '0.5px solid rgba(255,255,255,0.07)'
            : '0.5px solid rgba(255,255,255,0.06)',
          fontSize: 13.5,
          color: 'var(--text-primary)',
          lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          position: 'relative',
          group: true,
        }}
        onMouseEnter={e => {
          const btn = e.currentTarget.querySelector('.copy-btn');
          if (btn) btn.style.opacity = '1';
        }}
        onMouseLeave={e => {
          const btn = e.currentTarget.querySelector('.copy-btn');
          if (btn) btn.style.opacity = '0';
        }}
      >
        {msg.content}

        {/* Copy button — appears on hover */}
        {!isUser && (
          <button
            className="copy-btn"
            onClick={handleCopy}
            style={{
              position: 'absolute', bottom: 6, right: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              color: copied ? 'var(--accent)' : 'var(--text-muted)',
              opacity: 0, transition: 'opacity 0.15s, color 0.15s',
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 11, padding: '2px 4px',
            }}
            title="Copy"
          >
            <CopyIcon /> {copied ? 'Copied' : ''}
          </button>
        )}

        {/* Engine label */}
        {msg.engine && msg.engine !== 'none' && msg.engine !== 'error' && (
          <div style={{ marginTop: 5, fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'right' }}>
            via {msg.engine}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Voice session indicator ───────────────────────────────────────────────────
function VoiceSessionBadge({ active, onEnd }) {
  if (!active) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 14px', borderRadius: 20,
      background: 'rgba(229,90,90,0.1)',
      border: '0.5px solid rgba(229,90,90,0.3)',
      fontSize: 11, color: '#e55a5a',
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: '#e55a5a',
        animation: 'orb-breathe 1s ease-in-out infinite',
      }} />
      Voice session active
      <button
        onClick={onEnd}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#e55a5a', fontSize: 11, padding: 0, marginLeft: 4,
          display: 'flex', alignItems: 'center',
        }}
        title="End voice session"
      >
        <StopIcon />
      </button>
    </div>
  );
}

// ─── Main Assistant Tab ────────────────────────────────────────────────────────
export default function Assistant({ settings, ai }) {
  const [inputText,    setInputText]    = useState('');
  const [typingHint,   setTypingHint]   = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  const currentTheme = storage.get(STORAGE_KEYS.SETTINGS, {})?.theme ?? 'obsidian';

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ai?.messages]);

  // Show typing hint when session starts and no messages yet
  useEffect(() => {
    if (ai?.voiceSessionActive && ai.messages.length === 0) {
      setTypingHint(true);
      const t = setTimeout(() => setTypingHint(false), 4000);
      return () => clearTimeout(t);
    }
  }, [ai?.voiceSessionActive, ai?.messages?.length]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || ai?.loading) return;
    ai?.sendMessage(inputText.trim());
    setInputText('');
  }, [inputText, ai]);

  const handleVoiceToggle = useCallback(() => {
    if (!ai) return;
    if (ai.voiceSessionActive) {
      ai.endVoiceSession();
    } else {
      ai.startVoiceSession();
    }
  }, [ai]);

  const handleQuickAction = useCallback((prompt) => {
    ai?.sendMessage(prompt);
  }, [ai]);

  const handleExport = useCallback(() => {
    if (!ai?.messages?.length) return;
    const settings = storage.get(STORAGE_KEYS.SETTINGS, {});
    const userName = settings.userName || 'Rob';
    const text = ai.messages
      .map(m => `[${m.role === 'user' ? userName : 'VALERIE'}]\n${m.content}`)
      .join('\n\n─────────────────────\n\n');
    const header = `VALERIE Conversation Export\n${new Date().toLocaleString('en-AU')}\n${'═'.repeat(40)}\n\n`;
    const blob = new Blob([header + text], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `VALERIE_${toLocalDateKey(new Date())}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [ai?.messages]);

  if (!ai) return null;

  const isListening = ai.orbState === 'listening';
  const isSpeaking  = ai.orbState === 'speaking';
  const isThinking  = ai.orbState === 'thinking';
  const sessionActive = ai.voiceSessionActive;

  // Determine orb state label
  const stateLabel = isListening ? 'Listening…'
    : isThinking ? 'Thinking…'
    : isSpeaking  ? 'Speaking…'
    : 'Ready';

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* ── Top: Orb + status ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 24px 14px',
        gap: 10,
        flexShrink: 0,
        borderBottom: '0.5px solid var(--sidebar-divider)',
      }}>
        <VaIerieOrb
          state={ai.orbState}
          theme={currentTheme}
          size={300}
          showHUD={true}
          showWave={true}
        />

        {/* Status row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Voice session badge */}
          <VoiceSessionBadge
            active={sessionActive}
            onEnd={() => ai.endVoiceSession()}
          />

          {/* Engine pills (when no session active) */}
          {!sessionActive && (
            <>
              <span style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 20,
                background: ai.claudeOnline ? 'rgba(76,175,125,0.12)' : 'rgba(255,255,255,0.04)',
                border: `0.5px solid ${ai.claudeOnline ? 'rgba(76,175,125,0.35)' : 'var(--card-border)'}`,
                color: ai.claudeOnline ? '#4caf7d' : 'var(--text-muted)',
              }}>
                Claude {ai.claudeOnline ? '' : ''}
              </span>
              <span style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 20,
                background: ai.ollamaOnline ? 'rgba(76,175,125,0.12)' : 'rgba(255,255,255,0.04)',
                border: `0.5px solid ${ai.ollamaOnline ? 'rgba(76,175,125,0.35)' : 'var(--card-border)'}`,
                color: ai.ollamaOnline ? '#4caf7d' : 'var(--text-muted)',
              }}>
                Ollama {ai.ollamaOnline ? '' : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 24px',
      }}>
        {ai.messages.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 16,
          }}>
            {typingHint ? (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 280 }}>
                I'm listening. Go ahead.
              </p>
            ) : (
              <p style={{ fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 280, opacity: 0.6 }}>
                Tap the mic to start a voice conversation, or type below.
              </p>
            )}

            {/* Quick actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
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

            {/* Thinking indicator */}
            {ai.loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 10px' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: 'var(--accent)',
                      animation: `orb-breathe 1s ease-in-out ${i * 0.22}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ── Input bar ────────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 24px 20px',
        borderTop: '0.5px solid var(--sidebar-divider)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        flexShrink: 0,
      }}>
        {/* Quick action chips (when messages exist) */}
        {ai.messages.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
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
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {ai.messages.length > 0 && (
                <button
                  onClick={handleExport}
                  style={{
                    padding: '4px 8px', borderRadius: 16, cursor: 'pointer',
                    background: 'none', border: '0.5px solid var(--card-border)',
                    color: 'var(--text-muted)', fontSize: 11,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  title="Export conversation"
                >
                  <ExportIcon /> Export
                </button>
              )}
              <button
                onClick={() => ai.clearHistory?.()}
                style={{
                  padding: '4px 8px', borderRadius: 16, cursor: 'pointer',
                  background: 'none', border: '0.5px solid var(--card-border)',
                  color: 'var(--text-muted)', fontSize: 11,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
                title="Clear conversation"
              >
                <TrashIcon /> Clear
              </button>
            </div>
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
            placeholder={
              isListening  ? 'Listening…'  :
              isThinking   ? 'Thinking…'   :
              isSpeaking   ? 'Speaking…'   :
              sessionActive ? 'Voice session active — or type here'
              : 'Talk to VALERIE'
            }
            style={{
              flex: 1,
              background: 'var(--input-bg)',
              border: `0.5px solid ${sessionActive && isListening ? 'var(--accent)' : 'var(--input-border)'}`,
              borderRadius: 10,
              padding: '11px 16px',
              fontSize: 13.5,
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = sessionActive && isListening ? 'var(--accent)' : 'var(--input-border)'}
          />

          {/* Mic / voice session toggle — hidden when mic input is disabled */}
          {!MIC_DISABLED && (
          <button
            onClick={handleVoiceToggle}
            disabled={ai.loading && !sessionActive}
            title={sessionActive ? 'End voice session' : 'Start voice session'}
            style={{
              width: 40, height: 40, borderRadius: 10, border: 'none',
              background: sessionActive
                ? (isListening ? 'var(--accent)' : 'rgba(229,90,90,0.2)')
                : 'var(--hover-bg)',
              color: sessionActive
                ? (isListening ? 'var(--bg-base)' : '#e55a5a')
                : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease', flexShrink: 0,
              boxShadow: sessionActive && isListening ? '0 0 12px color-mix(in srgb, var(--accent) 33%, transparent)' : 'none',
            }}
          >
            {sessionActive ? <MicIcon active={isListening} /> : <MicIcon />}
          </button>
          )}

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

        {/* Session hint text */}
        <p style={{
          fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', margin: 0,
          opacity: sessionActive ? 0.8 : 0.4,
          transition: 'opacity 0.3s',
        }}>
          {sessionActive
            ? 'Say "stop" or "that\'s all" to end the conversation'
            : 'Tap mic for a continuous voice conversation'}
        </p>
      </div>
    </div>
  );
}
