// ── Dashboard Tab — Decluttered Layout ──────────────────────────────────────
// Redesign notes (makeover pass):
//   - Old layout forced 10 bordered cards into one fixed, no-scroll viewport
//     (4 stat cards + tasks + productivity + brief + spotify + peak state +
//     workout + day ring). That density is what made the tab feel "too much".
//   - This version keeps every feature but re-prioritises them:
//       1. Header stays minimal (greeting, date, clock).
//       2. A single-line "at a glance" strip replaces the 4 heavy stat cards.
//       3. Tasks (primary) + a single unified "Today" panel (secondary
//          info as internal rows, not 4 separate bordered cards) fill the
//          first screen.
//       4. Lower-priority content (reflection quote/verse, productivity
//          breakdown, day ring) lives below the fold — the page scrolls
//          instead of cramming everything above it.
//   - Also removed ~150 lines of dead code (RankBadge/XpBar/ProgressHeroCard
//     and their SVG helpers) that were defined but never rendered here.
import { useState, useEffect, useRef, useCallback } from 'react';
import { getGreeting, formatDate } from '../utils/time.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { askClaude } from '../ai/claude.js';
import { askOllama } from '../ai/ollama.js';
import { rateLimitClaude } from '../utils/rateLimit.js';
import DayRing from '../components/DayRing.jsx';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument }   from '../supabase/useDocument.js';
import { getNowPlaying, pausePlayback, resumePlayback, skipNext, skipPrev, isSpotifyConnected } from '../utils/spotify.js';
import { DEFAULT_OVERLOAD_EXERCISES } from './Workout.jsx';
import { toLocalDateKey } from '../utils/localDate.js';

// ── Shared card (used only for the secondary, below-the-fold section) ──────
function Card({ children, style = {}, className = '' }) {
  return (
    <div className={`glass-card ${className}`} style={{
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      ...style,
    }}>
      {children}
    </div>
  );
}

function Label({ text, color }) {
  return (
    <span style={{
      fontSize: 9.5,
      fontWeight: 600,
      letterSpacing: '0.05em',
      padding: '2px 7px',
      borderRadius: 4,
      background: color ?? 'var(--hover-bg)',
      color: color ? '#fff' : 'var(--text-muted)',
      flexShrink: 0,
      textTransform: 'uppercase',
    }}>
      {text}
    </span>
  );
}

// ── Inline clock for banner ──────────────────────────────────────────────
function InlineClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = n => n.toString().padStart(2, '0');
  return (
    <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
      <div style={{
        fontSize: 28, fontWeight: 200, letterSpacing: '0.04em',
        color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums',
      }}>
        {pad(now.getHours())}
        <span style={{ opacity: 0.4, animation: 'blink 1s step-end infinite' }}>:</span>
        {pad(now.getMinutes())}
        <span style={{ fontSize: 16, opacity: 0.4, marginLeft: 3 }}>{pad(now.getSeconds())}</span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
        {now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>
    </div>
  );
}

// ── "At a glance" strip — replaces the old 4 heavy stat cards ──────────────
const WMO_ICONS = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '❄️', 73: '❄️', 75: '❄️',
  80: '🌦️', 81: '🌦️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

function useWeather() {
  const [wx, setWx] = useState(null);

  useEffect(() => {
    const WX_KEY = 'valerie_wx_cache';
    try {
      const cached = JSON.parse(localStorage.getItem(WX_KEY) || 'null');
      if (cached && Date.now() - cached.ts < 3600_000) { setWx(cached); return; }
    } catch {}

    function doFetch(lat, lon) {
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
        `&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto`
      )
        .then(r => r.json())
        .then(d => {
          const c = d.current;
          const data = { temp: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature), code: c.weather_code, wind: Math.round(c.wind_speed_10m), ts: Date.now() };
          localStorage.setItem(WX_KEY, JSON.stringify(data));
          setWx(data);
        })
        .catch(() => {});
    }

    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(({ state }) => {
        if (state === 'granted') {
          navigator.geolocation.getCurrentPosition(({ coords }) => doFetch(coords.latitude, coords.longitude), () => {});
        }
      }).catch(() => {
        navigator.geolocation?.getCurrentPosition(({ coords }) => doFetch(coords.latitude, coords.longitude), () => {});
      });
    } else {
      navigator.geolocation?.getCurrentPosition(({ coords }) => doFetch(coords.latitude, coords.longitude), () => {});
    }
  }, []);

  return wx;
}

function GlanceStat({ icon, value, label, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 6,
      paddingRight: 18, marginRight: 18,
      borderRight: last ? 'none' : '0.5px solid var(--card-border)',
    }}>
      <span style={{ fontSize: 14, opacity: 0.85 }}>{icon}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

function GlanceStrip() {
  const tasks   = storage.get(STORAGE_KEYS.TASKS, []);
  const pending = tasks.filter(t => !t.done).length;
  const done    = tasks.filter(t => t.done).length;
  const streak  = storage.get(STORAGE_KEYS.PROGRESS, {}).streak ?? 0;
  const wx      = useWeather();

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', rowGap: 6 }}>
      <GlanceStat icon="✓" value={pending} label={pending === 1 ? 'task left' : 'tasks left'} />
      <GlanceStat icon="●" value={done} label="done today" />
      <GlanceStat icon="🔥" value={streak} label={streak === 1 ? 'day streak' : 'day streak'} />
      {wx && (
        <GlanceStat icon={WMO_ICONS[wx.code] ?? '🌤️'} value={`${wx.temp}°`} label={`feels ${wx.feels}°`} last />
      )}
    </div>
  );
}

// ── Reflection card — quote + verse combined into one card (was two) ───────
const QUOTES = [
  { text: "Discipline equals freedom.", author: "Jocko Willink" },
  { text: "You have power over your mind, not outside events.", author: "Marcus Aurelius" },
  { text: "The impediment to action advances action.", author: "Marcus Aurelius" },
  { text: "We suffer more in imagination than in reality.", author: "Seneca" },
  { text: "Hard choices, easy life. Easy choices, hard life.", author: "Jerzy Gregorek" },
  { text: "A ship in harbour is safe, but that is not what ships are for.", author: "J. A. Shedd" },
  { text: "The obstacle is the way.", author: "Ryan Holiday" },
  { text: "If it is not right, do not do it; if it is not true, do not say it.", author: "Marcus Aurelius" },
];

const VERSES = [
  { text: "I can do all things through Christ who strengthens me.", ref: "Philippians 4:13" },
  { text: "The Lord is my shepherd; I shall not want.", ref: "Psalm 23:1" },
  { text: "Trust in the Lord with all your heart and lean not on your own understanding.", ref: "Proverbs 3:5" },
  { text: "Be strong and courageous. Do not be afraid; do not be discouraged.", ref: "Joshua 1:9" },
  { text: "For I know the plans I have for you, plans to prosper you and not to harm you.", ref: "Jeremiah 29:11" },
  { text: "And we know that in all things God works for the good of those who love him.", ref: "Romans 8:28" },
  { text: "The Lord will fight for you; you need only to be still.", ref: "Exodus 14:14" },
  { text: "Cast all your anxiety on him because he cares for you.", ref: "1 Peter 5:7" },
  { text: "He gives strength to the weary and increases the power of the weak.", ref: "Isaiah 40:29" },
  { text: "Do not conform to the pattern of this world, but be transformed by the renewing of your mind.", ref: "Romans 12:2" },
  { text: "Commit to the Lord whatever you do, and he will establish your plans.", ref: "Proverbs 16:3" },
  { text: "The name of the Lord is a fortified tower; the righteous run to it and are safe.", ref: "Proverbs 18:10" },
  { text: "No weapon formed against you shall prosper.", ref: "Isaiah 54:17" },
  { text: "Those who hope in the Lord will renew their strength.", ref: "Isaiah 40:31" },
  { text: "Be still, and know that I am God.", ref: "Psalm 46:10" },
  { text: "Greater is he that is in you, than he that is in the world.", ref: "1 John 4:4" },
  { text: "The Lord bless you and keep you; the Lord make his face shine on you.", ref: "Numbers 6:24-25" },
  { text: "Love the Lord your God with all your heart and with all your soul and with all your mind.", ref: "Matthew 22:37" },
  { text: "Seek first his kingdom and his righteousness, and all these things will be given to you.", ref: "Matthew 6:33" },
  { text: "Do not be anxious about anything, but in every situation, by prayer, present your requests to God.", ref: "Philippians 4:6" },
  { text: "With God all things are possible.", ref: "Matthew 19:26" },
  { text: "The Lord is close to the brokenhearted and saves those who are crushed in spirit.", ref: "Psalm 34:18" },
  { text: "I am the way and the truth and the life.", ref: "John 14:6" },
  { text: "Fear not, for I am with you; be not dismayed, for I am your God.", ref: "Isaiah 41:10" },
  { text: "Your word is a lamp to my feet and a light to my path.", ref: "Psalm 119:105" },
  { text: "Come to me, all who are weary and burdened, and I will give you rest.", ref: "Matthew 11:28" },
  { text: "Have I not commanded you? Be strong and courageous.", ref: "Joshua 1:9" },
  { text: "But those who hope in the Lord will soar on wings like eagles.", ref: "Isaiah 40:31" },
  { text: "The joy of the Lord is your strength.", ref: "Nehemiah 8:10" },
  { text: "This is the day the Lord has made; let us rejoice and be glad in it.", ref: "Psalm 118:24" },
  { text: "Give thanks to the Lord, for he is good; his love endures forever.", ref: "Psalm 107:1" },
];

function ReflectionCard() {
  const quote = QUOTES[new Date().getDate() % QUOTES.length];
  const verse = VERSES[new Date().getDate() % VERSES.length];
  return (
    <Card style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TODAY'S REFLECTION</div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
        “{quote.text}”
      </p>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>— {quote.author}</div>
      <div style={{ height: '0.5px', background: 'var(--card-border)', margin: '4px 0' }} />
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.65, fontStyle: 'italic', margin: 0 }}>
        “{verse.text}”
      </p>
      <div style={{ fontSize: 10.5, color: 'var(--accent)' }}>{verse.ref}</div>
    </Card>
  );
}

// ── Priority dot colour ──────────────────────────────────────────────────
const PRIORITY_COLOR = { high: '#e55', med: '#f90', low: '#5a9' };

// ── Left panel: Today's Tasks (unchanged — already well-scoped) ────────────
function TasksPanel({ onTabChange }) {
  const [tasks,    setTasks]    = useState(() => storage.get(STORAGE_KEYS.TASKS, []));
  const [newText,  setNewText]  = useState('');

  const save = (next) => { setTasks(next); storage.set(STORAGE_KEYS.TASKS, next); };

  const toggle = (i) => {
    const next = [...tasks];
    next[i] = { ...next[i], done: !next[i].done };
    save(next);
  };

  const addTask = () => {
    if (!newText.trim()) return;
    save([...tasks, { text: newText.trim(), done: false, priority: 'low', createdAt: Date.now() }]);
    setNewText('');
  };

  const pending = tasks.filter(t => !t.done);
  const visible = pending.slice(0, 8);

  return (
    <div style={{
      flex: '1.2 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0,
      background: 'var(--bg-panel)', borderRadius: 12,
      border: '0.5px solid var(--card-border)',
      overflow: 'hidden', minHeight: 380,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px 10px',
        borderBottom: '0.5px solid var(--card-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
          Today's Tasks
        </span>
        <button
          onClick={() => onTabChange?.('tasks')}
          style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          View all →
        </button>
      </div>

      {/* Task list */}
      <div style={{ overflowY: 'auto', padding: '8px 0', minHeight: 200, flex: 1 }}>
        {visible.length === 0 ? (
          <div style={{ padding: '20px 18px', fontSize: 13, color: 'var(--text-muted)' }}>
            All clear — you're on top of everything.
          </div>
        ) : visible.map((t, i) => {
          const realIdx = tasks.indexOf(pending[i]);
          const pCol = PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.low;
          return (
            <div
              key={realIdx}
              onClick={() => toggle(realIdx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 18px', cursor: 'pointer',
                borderBottom: '0.5px solid var(--card-border)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Checkbox */}
              <div style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                border: `1.5px solid ${pCol}`,
                background: t.done ? pCol : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {t.done && <span style={{ fontSize: 9, color: '#fff' }}>✓</span>}
              </div>

              {/* Text */}
              <span style={{
                flex: 1, fontSize: 13, color: 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textDecoration: t.done ? 'line-through' : 'none',
                opacity: t.done ? 0.45 : 1,
              }}>
                {t.text}
              </span>

              {/* Tag */}
              {t.tag && <Label text={t.tag} color="var(--accent)" />}
              {t.priority === 'high' && !t.tag && <Label text="urgent" color="#c44" />}
            </div>
          );
        })}

        {pending.length > 8 && (
          <div style={{ padding: '8px 18px', fontSize: 11, color: 'var(--text-muted)' }}>
            +{pending.length - 8} more — view all tasks
          </div>
        )}
      </div>

      {/* Add task row */}
      <div style={{
        display: 'flex', gap: 8, borderTop: '0.5px solid var(--card-border)',
        padding: '10px 12px',
      }}>
        <input
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="Add a task for today…"
          style={{
            flex: 1, background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
            borderRadius: 7, padding: '7px 12px', fontSize: 12.5,
            color: 'var(--text-primary)', outline: 'none',
          }}
        />
        <button
          onClick={addTask}
          style={{
            padding: '7px 16px', borderRadius: 7, fontSize: 12.5,
            background: 'var(--accent)', color: '#fff',
            border: 'none', cursor: 'pointer', fontWeight: 600, flexShrink: 0,
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Unified "Today" panel — one card, internal sections instead of 4 boxes ─
function SectionDivider() {
  return <div style={{ height: '0.5px', background: 'var(--card-border)', flexShrink: 0 }} />;
}

function DailyBriefSection({ ai }) {
  const [brief,   setBrief]   = useState(null);
  const [loading, setLoading] = useState(false);
  const generated = useRef(false);

  const generateBrief = useCallback(async () => {
    if (!ai?.sendMessage || loading) return;
    setLoading(true);
    const tasks   = storage.get(STORAGE_KEYS.TASKS, []);
    const pending = tasks.filter(t => !t.done);
    const greeting = getGreeting();
    const dateStr  = formatDate();
    const prompt = `${greeting}. Today is ${dateStr}. I have ${pending.length} pending task${pending.length !== 1 ? 's' : ''}.${pending.length > 0 ? ` Top items: ${pending.slice(0,3).map(t => t.text).join(', ')}.` : ''} Give me a sharp, motivating daily brief in 2-3 sentences. No fluff.`;
    try {
      const settings = storage.get(STORAGE_KEYS.SETTINGS, {});
      let text = '';
      if (ai.claudeOnline && settings.apiKey) {
        rateLimitClaude();
        text = await askClaude(prompt, [], settings.apiKey);
      } else if (ai.ollamaOnline) {
        text = await askOllama(prompt, []);
      } else {
        text = `${greeting}. ${pending.length} task${pending.length !== 1 ? 's' : ''} waiting. Stay sharp and move with intention.`;
      }
      setBrief(text);
    } catch {
      setBrief(`${greeting}. Let's make today count.`);
    } finally {
      setLoading(false);
    }
  }, [ai, loading]);

  useEffect(() => {
    if (!generated.current && ai) { generated.current = true; generateBrief(); }
  }, [ai, generateBrief]);

  return (
    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>DAILY BRIEF</div>
        <button
          onClick={() => { generated.current = false; generateBrief(); }}
          disabled={loading}
          style={{ fontSize: 10.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1, padding: 0 }}
        >
          {loading ? 'Thinking…' : '↻ Refresh'}
        </button>
      </div>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'orb-breathe 1.2s ease-in-out infinite' }} />
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>VALERIE is preparing your brief…</span>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
          {brief ?? 'Your daily brief will appear here.'}
        </p>
      )}
    </div>
  );
}

function PeakStateSection({ peakState, onTabChange }) {
  if (!peakState) return null;
  const { score, color, suggestion, factors } = peakState;

  return (
    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>PEAK STATE</div>
        <button onClick={() => onTabChange?.('health')}
          style={{ fontSize: 10.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          Health →
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
          <svg viewBox="0 0 60 60" width="60" height="60">
            <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
            <circle cx="30" cy="30" r="24" fill="none"
              stroke={color} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 24}
              strokeDashoffset={2 * Math.PI * 24 * (1 - score / 100)}
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1), stroke 0.5s' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{score}</div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.values(factors).slice(0, 3).map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', width: 88, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</div>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ width: `${f.pct}%`, height: '100%', background: f.pct >= 80 ? '#4caf7d' : f.pct >= 50 ? '#f4a642' : '#e25d7a', borderRadius: 2, transition: 'width 0.6s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {suggestion}
      </div>
    </div>
  );
}

const DAY_KEYS_W = ['sun','mon','tue','wed','thu','fri','sat'];
const SPLIT_COLOURS_W = { push:'#e25d7a', pull:'#4a9eff', legs:'#f4a642', rest:'rgba(255,255,255,0.2)', custom:'#9b5de5' };

function WorkoutSection({ onTabChange }) {
  const { items: programs } = useCollection('programs', STORAGE_KEYS.PROGRAMS);
  const { data: storedExercises } = useDocument('overload_exercises', STORAGE_KEYS.OVERLOAD_EXERCISES, null);
  const exercises = (Array.isArray(storedExercises) && storedExercises.length) ? storedExercises : DEFAULT_OVERLOAD_EXERCISES;

  const todayKey  = DAY_KEYS_W[new Date().getDay()];
  const active    = programs.find(p => p.isActive) ?? null;
  if (!active) return null;

  const todayData = active?.days?.[todayKey] ?? null;
  const splitType = todayData?.splitType ?? null;
  const label     = todayData?.label ?? 'Workout';
  const isRest    = !splitType || splitType === 'rest';
  const exCount   = isRest ? 0 : exercises.filter(e => e.day === splitType).length;
  const colour    = SPLIT_COLOURS_W[splitType] ?? 'var(--accent)';

  return (
    <div
      onClick={() => onTabChange?.('workout')}
      style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
    >
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: isRest ? 'var(--text-muted)' : colour, textTransform: 'uppercase', marginBottom: 3 }}>Today's Workout</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {isRest ? 'Rest Day' : `${label} Day — ${exCount} exercise${exCount !== 1 ? 's' : ''}`}
        </div>
      </div>
      <span style={{ fontSize: 11, color: isRest ? 'var(--text-muted)' : colour, opacity: 0.7 }}>→</span>
    </div>
  );
}

function SpotifySection({ onTabChange }) {
  const [track,   setTrack]   = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const connected = isSpotifyConnected();

  useEffect(() => {
    if (!connected) return;
    let alive = true;

    async function poll() {
      const data = await getNowPlaying();
      if (!alive) return;
      if (data?.item) {
        setTrack({
          name:    data.item.name,
          artist:  data.item.artists?.map(a => a.name).join(', ') ?? '',
          art:     data.item.album?.images?.[0]?.url ?? null,
        });
        setPlaying(data.is_playing);
      } else {
        setTrack(null);
        setPlaying(false);
      }
    }

    poll();
    const id = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [connected]);

  async function toggle() {
    setLoading(true);
    if (playing) await pausePlayback(); else await resumePlayback();
    setPlaying(p => !p);
    setLoading(false);
  }

  const Btn = ({ onClick, children }) => (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--text-secondary)', fontSize: 13, padding: '2px 5px',
    }}>{children}</button>
  );

  if (!connected) {
    return (
      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.08em', flex: 1 }}>
          NOW PLAYING
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', letterSpacing: 'normal', marginTop: 3 }}>Spotify not connected</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 6, flexShrink: 0, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {track?.art ? <img src={track.art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 14 }}>♪</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {track ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
          </>
        ) : (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Nothing playing</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <Btn onClick={() => skipPrev()}>⏮</Btn>
        <Btn onClick={toggle}>{loading ? '…' : playing ? '⏸' : '▶'}</Btn>
        <Btn onClick={() => skipNext()}>⏭</Btn>
      </div>
    </div>
  );
}

function TodayPanel({ ai, peakState, onTabChange }) {
  const sections = [
    <DailyBriefSection key="brief" ai={ai} />,
    peakState ? <PeakStateSection key="peak" peakState={peakState} onTabChange={onTabChange} /> : null,
    <WorkoutSection key="workout" onTabChange={onTabChange} />,
    <SpotifySection key="spotify" onTabChange={onTabChange} />,
  ].filter(Boolean);

  return (
    <div className="glass-card" style={{ borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: '1 1 0', minWidth: 0, minHeight: 380 }}>
      {sections.map((section, i) => (
        <div key={section.key} style={{ display: 'flex', flexDirection: 'column' }}>
          {i > 0 && <SectionDivider />}
          {section}
        </div>
      ))}
    </div>
  );
}

// ── Secondary "More today" section — productivity breakdown + day ring ─────
const TAG_COLOURS = [
  'var(--accent)', '#f59e0b', '#10b981', '#6366f1', '#ec4899',
  '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4', '#84cc16',
];

function DonutChart({ segments, size = 110, thickness = 18, emptyColor = 'var(--hover-bg)' }) {
  const r   = (size - thickness) / 2;
  const cx  = size / 2;
  const cy  = size / 2;
  const circ = 2 * Math.PI * r;

  const total = segments.reduce((s, seg) => s + seg.value, 0);

  if (total === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={emptyColor} strokeWidth={thickness} />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'inherit' }}>
          No data
        </text>
      </svg>
    );
  }

  let offset = 0;
  const arcs = segments.map((seg) => {
    const pct  = seg.value / total;
    const dash = pct * circ;
    const gap  = circ - dash;
    const arc  = { ...seg, dashArray: `${dash} ${gap}`, dashOffset: -offset * circ, pct };
    offset += pct;
    return arc;
  });

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={emptyColor} strokeWidth={thickness} />
      {arcs.map((arc, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={arc.color} strokeWidth={thickness}
          strokeDasharray={arc.dashArray}
          strokeDashoffset={arc.dashOffset}
          strokeLinecap="butt"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      ))}
    </svg>
  );
}

function ProductivityWidget({ onTabChange }) {
  const today = toLocalDateKey(new Date());

  const tasks    = storage.get(STORAGE_KEYS.TASKS, []);
  const todayTasks = tasks;

  const tagMap = {};
  todayTasks.forEach(t => {
    const key = t.tag || 'Untagged';
    if (!tagMap[key]) tagMap[key] = { total: 0, done: 0 };
    tagMap[key].total++;
    if (t.done) tagMap[key].done++;
  });

  const tagEntries = Object.entries(tagMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8);

  const taskSegments = tagEntries.map(([tag, { total }], i) => ({
    label: tag, value: total, color: TAG_COLOURS[i % TAG_COLOURS.length],
  }));
  const totalTasks   = todayTasks.length;
  const doneTasks    = todayTasks.filter(t => t.done).length;

  const allSessions = storage.get(STORAGE_KEYS.FOCUS_SESSIONS, []);
  const todaySessions = allSessions.filter(s => s.date === today);

  const focusMap = {};
  todaySessions.forEach(s => {
    const key = s.taskLabel || 'Focus';
    focusMap[key] = (focusMap[key] || 0) + (s.duration || 0);
  });

  const focusEntries = Object.entries(focusMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const focusSegments = focusEntries.map(([label, mins], i) => ({
    label, value: mins, color: TAG_COLOURS[(i + 2) % TAG_COLOURS.length],
  }));
  const totalFocusMin = todaySessions.reduce((s, f) => s + (f.duration || 0), 0);
  const focusH = Math.floor(totalFocusMin / 60);
  const focusM = totalFocusMin % 60;

  return (
    <div className="glass-card" style={{ borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>PRODUCTIVITY</div>
        <button
          onClick={() => onTabChange?.('tasks')}
          style={{ fontSize: 10.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >View tasks →</button>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <DonutChart segments={taskSegments} size={72} thickness={12} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 14, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>
                {doneTasks}/{totalTasks}
              </div>
              <div style={{ fontSize: 7.5, color: 'var(--text-muted)', letterSpacing: '0.04em', marginTop: 2 }}>TASKS</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>By Category</div>
            {taskSegments.length === 0 && (
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>No tasks yet</div>
            )}
            {taskSegments.map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{
                  fontSize: 10.5, color: 'var(--text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>{s.label}</span>
                <span style={{ fontSize: 9.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {tagMap[s.label]?.done ?? 0}/{s.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: '0.5px', background: 'var(--card-border)', alignSelf: 'stretch' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <DonutChart segments={focusSegments} size={72} thickness={12} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 13, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>
                {focusH > 0 ? `${focusH}h ${focusM}m` : `${focusM}m`}
              </div>
              <div style={{ fontSize: 7.5, color: 'var(--text-muted)', letterSpacing: '0.04em', marginTop: 2 }}>FOCUS</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
              Focus Today
              {todaySessions.length > 0 && (
                <span style={{ fontSize: 9.5, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
                  {todaySessions.length} session{todaySessions.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {focusSegments.length === 0 ? (
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                No focus sessions yet{' '}
                <span
                  onClick={() => onTabChange?.('focus')}
                  style={{ color: 'var(--accent)', cursor: 'pointer' }}
                >start one</span>
              </div>
            ) : focusSegments.map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{
                  fontSize: 10.5, color: 'var(--text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>{s.label}</span>
                <span style={{ fontSize: 9.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {s.value}m
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────
export default function Dashboard({ settings, onTabChange, ai, density = 'standard', peakState }) {

  const userName = storage.get(STORAGE_KEYS.USER, {})?.name
    ?? storage.get(STORAGE_KEYS.SETTINGS, {})?.userName
    ?? 'there';

  const pad  = density === 'compact' ? '14px 18px' : density === 'spacious' ? '32px 36px' : '22px 28px';
  const gap  = density === 'compact' ? 10 : density === 'spacious' ? 24 : 14;

  return (
    // Page now scrolls — primary content (tasks + today panel) sits in the
    // first screen; secondary content (reflection/productivity/day ring)
    // is reachable below the fold instead of being crammed above it.
    <div style={{ height: '100%', padding: pad, display: 'flex', flexDirection: 'column', gap: gap * 1.4, boxSizing: 'border-box', overflowY: 'auto' }}>

      {/* Greeting banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '0.03em', margin: 0 }}>
            {getGreeting()}, <span style={{ color: 'var(--accent)' }}>{userName}</span>.
          </h1>
        </div>
        <InlineClock />
      </div>

      {/* At-a-glance strip — replaces the old 4 heavy stat cards */}
      <div style={{ flexShrink: 0 }}>
        <GlanceStrip />
      </div>

      {/* Primary: Tasks + unified Today panel */}
      <div style={{ display: 'flex', gap, flexShrink: 0, alignItems: 'stretch' }}>
        <TasksPanel onTabChange={onTabChange} />
        <TodayPanel ai={ai} peakState={peakState} onTabChange={onTabChange} />
      </div>

      {/* Secondary — below the fold, reachable by scroll */}
      <div style={{ display: 'flex', flexDirection: 'column', gap, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.6 }}>
          More today
        </div>
        <div style={{ display: 'flex', gap, flexWrap: 'wrap' }}>
          <ReflectionCard />
          <ProductivityWidget onTabChange={onTabChange} />
        </div>
        <Card>
          <DayRing />
        </Card>
      </div>
    </div>
  );
}
