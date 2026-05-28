// ─── Dashboard Tab ────────────────────────────────────────────────────────────
// Greeting banner · VALERIE launch greeting · Daily brief · Widget grid

import { useState, useEffect, useRef, useCallback } from 'react';
import { getGreeting, formatTime, formatDate } from '../utils/time.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { askClaude } from '../ai/claude.js';
import { askOllama } from '../ai/ollama.js';

// ── Tiny inline icon ──────────────────────────────────────────────────────────
const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

// ── Card wrapper ───────────────────────────────────────────────────────────────
function Card({ children, style = {}, className = '' }) {
  return (
    <div className={`glass-card ${className}`} style={{
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Live clock widget ──────────────────────────────────────────────────────────
function ClockWidget() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = now.getHours().toString().padStart(2,'0');
  const m = now.getMinutes().toString().padStart(2,'0');
  const s = now.getSeconds().toString().padStart(2,'0');
  const day = now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Card style={{ alignItems: 'center', gap: 4 }}>
      <div style={{
        fontSize: 42, fontWeight: 200, letterSpacing: '0.05em',
        color: 'var(--text-primary)', lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {h}<span style={{ opacity: 0.4, animation: 'blink 1s step-end infinite' }}>:</span>{m}
        <span style={{ fontSize: 22, opacity: 0.45, marginLeft: 4 }}>{s}</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
        {day}
      </div>
    </Card>
  );
}

// ── Daily Quote ────────────────────────────────────────────────────────────────
const QUOTES = [
  { text: "Discipline equals freedom.", author: "Jocko Willink" },
  { text: "You have power over your mind, not outside events. Realise this, and you will find strength.", author: "Marcus Aurelius" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
  { text: "We suffer more in imagination than in reality.", author: "Seneca" },
  { text: "Do not indulge in dreams of having what you have not, but reckon up the chief of the blessings you do possess.", author: "Marcus Aurelius" },
  { text: "If it is not right, do not do it; if it is not true, do not say it.", author: "Marcus Aurelius" },
  { text: "The obstacle is the way.", author: "Ryan Holiday" },
  { text: "Hard choices, easy life. Easy choices, hard life.", author: "Jerzy Gregorek" },
  { text: "A ship in harbour is safe, but that is not what ships are for.", author: "J. A. Shedd" },
];

function QuoteWidget() {
  const quote = QUOTES[new Date().getDate() % QUOTES.length];
  return (
    <Card style={{ minHeight: 90 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>DAILY QUOTE</div>
      <p style={{
        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65,
        fontStyle: 'italic', margin: 0,
      }}>
        "{quote.text}"
      </p>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>— {quote.author}</div>
    </Card>
  );
}

// ── Tasks preview ──────────────────────────────────────────────────────────────
function TasksWidget({ onTabChange }) {
  const tasks = storage.get(STORAGE_KEYS.TASKS, []);
  const pending = tasks.filter(t => !t.done).slice(0, 5);

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TASKS</div>
        <button
          onClick={() => onTabChange?.('tasks')}
          style={{ fontSize: 10.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          View all →
        </button>
      </div>
      {pending.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0, padding: '4px 0' }}>
          All clear. No pending tasks.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {pending.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                background: t.priority === 'high' ? 'var(--priority-high)'
                          : t.priority === 'med'  ? 'var(--priority-med)'
                          : 'var(--priority-low)',
              }} />
              <span style={{
                fontSize: 12.5, color: 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>{t.text}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Spotify placeholder ────────────────────────────────────────────────────────
function SpotifyWidget() {
  return (
    <Card style={{ alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', alignSelf: 'flex-start' }}>NOW PLAYING</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          background: 'linear-gradient(135deg, #1db954 0%, #0a7a33 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>
          ♪
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Spotify not connected</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Connect in Settings → Integrations</div>
        </div>
      </div>
    </Card>
  );
}

// ── Progress streak ────────────────────────────────────────────────────────────
function ProgressWidget({ onTabChange }) {
  const progress = storage.get(STORAGE_KEYS.PROGRESS, {});
  const xp    = progress.xp ?? 0;
  const rank  = progress.rank ?? 'Initiate';
  const streak = progress.streak ?? 0;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>PROGRESS</div>
        <button
          onClick={() => onTabChange?.('progress')}
          style={{ fontSize: 10.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          View →
        </button>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--accent)' }}>{xp.toLocaleString()}</div>
          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>XP</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)' }}>{streak}</div>
          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>DAY STREAK</div>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', paddingTop: 4 }}>{rank}</div>
          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>RANK</div>
        </div>
      </div>
    </Card>
  );
}

// ── Daily Brief ────────────────────────────────────────────────────────────────
function DailyBriefCard({ ai }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const generated = useRef(false);

  const generateBrief = useCallback(async () => {
    if (!ai?.sendMessage || loading) return;
    setLoading(true);

    const tasks = storage.get(STORAGE_KEYS.TASKS, []);
    const pending = tasks.filter(t => !t.done);
    const greeting = getGreeting();
    const dateStr  = formatDate();

    const prompt = `${greeting}. Today is ${dateStr}. I have ${pending.length} pending task${pending.length !== 1 ? 's' : ''}.${pending.length > 0 ? ` Top items: ${pending.slice(0,3).map(t => t.text).join(', ')}.` : ''} Give me a sharp, motivating daily brief in 2-3 sentences. No fluff.`;

    try {
      // Temporarily intercept — brief doesn't go to chat history
      const settings = storage.get(STORAGE_KEYS.SETTINGS, {});
      let text = '';
      if (ai.claudeOnline && settings.apiKey) {
        text = await askClaude(prompt, [], settings.apiKey);
      } else if (ai.ollamaOnline) {
        text = await askOllama(prompt, []);
      } else {
        text = `${greeting}. You have ${pending.length} task${pending.length !== 1 ? 's' : ''} waiting. Stay focused and move with intention today.`;
      }
      setBrief(text);
    } catch {
      setBrief(`${greeting}. Let's make today count.`);
    } finally {
      setLoading(false);
    }
  }, [ai, loading]);

  useEffect(() => {
    if (!generated.current && ai) {
      generated.current = true;
      generateBrief();
    }
  }, [ai, generateBrief]);

  return (
    <Card style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>DAILY BRIEF</div>
        <button
          onClick={() => { generated.current = false; generateBrief(); }}
          disabled={loading}
          style={{
            fontSize: 10.5, color: 'var(--accent)', background: 'none', border: 'none',
            cursor: loading ? 'default' : 'pointer', padding: 0, opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Generating…' : '↻ Refresh'}
        </button>
      </div>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
            animation: 'orb-breathe 1.2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>VALERIE is preparing your brief…</span>
        </div>
      ) : (
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          {brief ?? 'Your daily brief will appear here.'}
        </p>
      )}
    </Card>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard({ settings, onTabChange, ai }) {
  const [hasGreeted, setHasGreeted] = useState(false);
  const userName = storage.get(STORAGE_KEYS.USER, {})?.name
    ?? storage.get(STORAGE_KEYS.SETTINGS, {})?.userName
    ?? 'there';

  // VALERIE launch greeting — spoken once per session on Dashboard mount
  useEffect(() => {
    if (hasGreeted || !ai) return;
    const sessionKey = `valerie_greeted_${new Date().toDateString()}`;
    if (sessionStorage.getItem(sessionKey)) return;

    const delay = setTimeout(() => {
      const greeting = getGreeting();
      const text = `${greeting}, ${userName}. Ready when you are.`;

      if (window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        const savedSettings = storage.get(STORAGE_KEYS.SETTINGS, {});
        const utt = new SpeechSynthesisUtterance(text);
        if (savedSettings.voice?.voiceURI) {
          const v = voices.find(v => v.voiceURI === savedSettings.voice.voiceURI);
          if (v) utt.voice = v;
        }
        window.speechSynthesis.speak(utt);
      }

      setHasGreeted(true);
      sessionStorage.setItem(sessionKey, '1');
    }, 900);

    return () => clearTimeout(delay);
  }, [ai, hasGreeted, userName]);

  const greeting = getGreeting();

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      padding: '28px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
    }}>

      {/* ── Greeting banner ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 300, color: 'var(--text-primary)',
          letterSpacing: '0.03em', margin: 0,
        }}>
          {greeting}, <span style={{ color: 'var(--accent)' }}>{userName}</span>.
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          {formatDate()} · {formatTime()}
        </p>
      </div>

      {/* ── Daily Brief ───────────────────────────────────────────────────── */}
      <DailyBriefCard ai={ai} />

      {/* ── Widget grid ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}>
        <ClockWidget />
        <QuoteWidget />
        <TasksWidget onTabChange={onTabChange} />
        <SpotifyWidget />
        <ProgressWidget onTabChange={onTabChange} />
      </div>
    </div>
  );
}
