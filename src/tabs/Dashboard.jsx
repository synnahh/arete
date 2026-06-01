// ─── Dashboard Tab — Dense Layout ─────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react';
import { getGreeting, formatTime, formatDate } from '../utils/time.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { askClaude } from '../ai/claude.js';
import { askOllama } from '../ai/ollama.js';
import { getXP, getRank, TIER_CONFIG, TIER_THRESHOLDS } from '../utils/xp.js';
import DayRing from '../components/DayRing.jsx';

// ── Badge SVG (mirrored from Progress.jsx) ────────────────────────────────────
const toRad = d => d * Math.PI / 180;
function poly(cx, cy, r, n, start = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = toRad(start + i * 360 / n);
    return [+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)];
  });
}
function starPts(cx, cy, R, r, n, start = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = toRad(start + i * 180 / n);
    pts.push([+(cx + (i % 2 === 0 ? R : r) * Math.cos(a)).toFixed(2), +(cy + (i % 2 === 0 ? R : r) * Math.sin(a)).toFixed(2)]);
  }
  return pts;
}
function ptsToD(pts) { return pts.map((p, i) => `${i===0?'M':'L'}${p[0]},${p[1]}`).join(' ') + ' Z'; }
function crossD(cx, cy, R, hw) {
  return `M${cx-hw},${cy-R} L${cx+hw},${cy-R} L${cx+hw},${cy-hw} L${cx+R},${cy-hw} L${cx+R},${cy+hw} L${cx+hw},${cy+hw} L${cx+hw},${cy+R} L${cx-hw},${cy+R} L${cx-hw},${cy+hw} L${cx-R},${cy+hw} L${cx-R},${cy-hw} L${cx-hw},${cy-hw} Z`;
}
function holeD(cx, cy, r) { return `M${cx+r},${cy-r} L${cx-r},${cy-r} L${cx-r},${cy+r} L${cx+r},${cy+r} Z`; }

function RankBadge({ tier, subRank = 1, size = 80, pulse = false }) {
  const cfg = TIER_CONFIG[tier - 1];
  const col = cfg.color;
  const c   = 50;
  const glow = subRank === 3 || tier === 8 ? 10 : subRank === 2 ? 5 : 2;
  const sw = 1.6, sw2 = 1.1;
  let shapes = null;

  if (tier === 1) {
    const outer = poly(c,c,36,6,0), inner = poly(c,c,20,6,0);
    const diam = [[outer[0],outer[3]],[outer[1],outer[4]],[outer[2],outer[5]]];
    shapes = <>{[ptsToD(outer)].map((d,i)=><path key={i} d={d} fill="none" stroke={col} strokeWidth={sw}/>)}
      {diam.map(([a,b],i)=><line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={col} strokeWidth={sw2} opacity={0.55}/>)}
      {subRank>=2&&<><path d={ptsToD(inner)} fill="none" stroke={col} strokeWidth={sw2} opacity={0.7}/><circle cx={c} cy={c} r={7} fill="none" stroke={col} strokeWidth={sw2}/></>}
      {subRank>=3&&<circle cx={c} cy={c} r={4} fill={col} opacity={0.9}/>}</>;
  } else if (tier === 2) {
    shapes = <><path d={ptsToD(starPts(c,c,40,6,4,-45))} fill="none" stroke={col} strokeWidth={sw}/>
      {subRank>=2&&<><path d={ptsToD(starPts(c,c,26,4,4,-45))} fill="none" stroke={col} strokeWidth={sw2} opacity={0.7}/><circle cx={c} cy={c} r={6} fill="none" stroke={col} strokeWidth={sw2}/></>}
      {subRank>=3&&<circle cx={c} cy={c} r={3.5} fill={col} opacity={0.9}/>}</>;
  } else if (tier === 3) {
    const cross = crossD(c,c,36,12)+' '+holeD(c,c,8);
    shapes = <><path d={cross} fillRule="evenodd" fill={col} opacity={subRank>=2?0.85:0.7}/>
      {subRank>=2&&<path d={crossD(c,c,24,7)+' '+holeD(c,c,5)} fillRule="evenodd" fill="none" stroke={col} strokeWidth={sw2} opacity={0.55}/>}
      {subRank>=3&&<circle cx={c} cy={c} r={4} fill={col}/>}</>;
  } else if (tier === 4) {
    shapes = <><path d={ptsToD(starPts(c,c,38,16,6,-90))} fill="none" stroke={col} strokeWidth={sw}/>
      {subRank>=2&&<><path d={ptsToD(starPts(c,c,24,10,6,-90))} fill="none" stroke={col} strokeWidth={sw2} opacity={0.7}/><circle cx={c} cy={c} r={6} fill="none" stroke={col} strokeWidth={sw2}/></>}
      {subRank>=3&&<circle cx={c} cy={c} r={3.5} fill={col} opacity={0.9}/>}</>;
  } else if (tier === 5) {
    shapes = <><path d={ptsToD(starPts(c,c,40,7,8,-90))} fill="none" stroke={col} strokeWidth={sw}/>
      {subRank>=2&&<><path d={ptsToD(starPts(c,c,26,5,8,-90))} fill="none" stroke={col} strokeWidth={sw2} opacity={0.65}/><circle cx={c} cy={c} r={7} fill="none" stroke={col} strokeWidth={sw2}/></>}
      {subRank>=3&&<circle cx={c} cy={c} r={4} fill={col} opacity={0.9}/>}</>;
  } else if (tier === 6) {
    shapes = <><path d={ptsToD(starPts(c,c,38,20,8,-90))} fill="none" stroke={col} strokeWidth={sw}/>
      <path d={ptsToD(starPts(c,c,32,15,8,-90))} fill="none" stroke={col} strokeWidth={sw2} opacity={0.6}/>
      {subRank>=2&&<><path d={ptsToD(starPts(c,c,22,10,8,-90))} fill="none" stroke={col} strokeWidth={sw2} opacity={0.5}/><circle cx={c} cy={c} r={7} fill="none" stroke={col} strokeWidth={sw2}/></>}
      {subRank>=3&&<circle cx={c} cy={c} r={4} fill={col} opacity={0.95}/>}</>;
  } else if (tier === 7) {
    shapes = <><path d={ptsToD(starPts(c,c,40,7,12,-90))} fill="none" stroke={col} strokeWidth={sw}/>
      {subRank>=2&&<><path d={ptsToD(starPts(c,c,26,5,12,-90))} fill="none" stroke={col} strokeWidth={sw2} opacity={0.6}/><circle cx={c} cy={c} r={7} fill="none" stroke={col} strokeWidth={sw2}/></>}
      {subRank>=3&&<circle cx={c} cy={c} r={4} fill={col} opacity={0.95}/>}</>;
  } else if (tier === 8) {
    shapes = <>
      {[{d:ptsToD(starPts(c,c,40,22,16,-90))},{d:ptsToD(starPts(c,c,28,15,8,-90)),op:0.8}].map((s,i)=><path key={i} d={s.d} fill="none" stroke={col} strokeWidth={sw} opacity={s.op??1}/>)}
      <path d={ptsToD([[c,c-14],[c+10,c],[c,c+14],[c-10,c]])} fill="none" stroke={col} strokeWidth={sw2} opacity={0.7}/>
      <circle cx={c} cy={c} r={8} fill="none" stroke={col} strokeWidth={sw}/>
      <circle cx={c} cy={c} r={4.5} fill={col} opacity={0.95}/></>;
  }

  return (
    <svg viewBox="0 0 100 100" width={size} height={size}
      style={{ filter:`drop-shadow(0 0 ${glow}px ${col})`, ...(pulse?{animation:'orbPulse 2.5s ease-in-out infinite'}:{}) }}>
      {tier === 8 && <style>{`@keyframes orbPulse{0%,100%{opacity:0.7}50%{opacity:1}}`}</style>}
      {shapes}
    </svg>
  );
}

// ── XP progress bar ───────────────────────────────────────────────────────────
function XpBar({ value, color }) {
  return (
    <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--hover-bg)', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.min(100, Math.max(0, value))}%`,
        background: color, borderRadius: 2, transition: 'width 0.6s ease',
      }} />
    </div>
  );
}

// ── Shared card ───────────────────────────────────────────────────────────────
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

// ── Label chip ─────────────────────────────────────────────────────────────────
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

// ── Top stat: Tasks count ──────────────────────────────────────────────────────
function TasksCountCard() {
  const tasks   = storage.get(STORAGE_KEYS.TASKS, []);
  const pending = tasks.filter(t => !t.done).length;
  const done    = tasks.filter(t => t.done).length;

  return (
    <Card style={{ flex: '1 1 0', minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TASKS REMAINING TODAY</div>
      <div style={{ fontSize: 44, fontWeight: 200, color: 'var(--text-primary)', lineHeight: 1 }}>
        {pending}
      </div>
      <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>
        {done > 0 ? `${done} completed today` : "Nothing completed yet — let’s go"}
      </div>
    </Card>
  );
}

// ── Top stat: Quote ────────────────────────────────────────────────────────────
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

function QuoteCard() {
  const quote = QUOTES[new Date().getDate() % QUOTES.length];
  return (
    <Card style={{ flex: '2 1 0', minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TODAY'S QUOTE</div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic', margin: 0, flex: 1 }}>
        "{quote.text}"
      </p>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>— {quote.author}</div>
    </Card>
  );
}

// ── Inline clock for banner ────────────────────────────────────────────────────
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

// ── Bible verse of the day ─────────────────────────────────────────────────────
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

function VerseCard() {
  const verse = VERSES[new Date().getDate() % VERSES.length];
  return (
    <Card style={{ flex: '1.4 1 0', minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TODAY'S VERSE</div>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.65, fontStyle: 'italic', margin: 0, flex: 1 }}>
        "{verse.text}"
      </p>
      <div style={{ fontSize: 10.5, color: 'var(--accent)' }}>{verse.ref}</div>
    </Card>
  );
}

// ── Weather card (Open-Meteo, no API key) ─────────────────────────────────────
const WMO_ICONS = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};
const WMO_DESC = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Showers', 81: 'Rain showers', 82: 'Violent showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};

function WeatherCard() {
  const [wx, setWx] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const cached = sessionStorage.getItem('valerie_wx');
    if (cached) { setWx(JSON.parse(cached)); return; }

    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lon } = coords;
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
          `&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto`
        )
          .then(r => r.json())
          .then(d => {
            const c = d.current;
            const data = {
              temp: Math.round(c.temperature_2m),
              feels: Math.round(c.apparent_temperature),
              code: c.weather_code,
              wind: Math.round(c.wind_speed_10m),
            };
            sessionStorage.setItem('valerie_wx', JSON.stringify(data));
            setWx(data);
          })
          .catch(() => setErr('Could not load weather'));
      },
      () => setErr('Location access denied')
    );
  }, []);

  const icon = wx ? (WMO_ICONS[wx.code] ?? '🌡️') : null;
  const desc = wx ? (WMO_DESC[wx.code]  ?? 'Unknown') : null;

  return (
    <Card style={{ flex: '1.2 1 0', minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TODAY'S WEATHER</div>
      {!wx && !err && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Fetching…</div>
      )}
      {err && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{err}</div>
      )}
      {wx && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
            <span style={{ fontSize: 34, lineHeight: 1 }}>{icon}</span>
            <div>
              <div style={{ fontSize: 28, fontWeight: 200, color: 'var(--text-primary)', lineHeight: 1 }}>
                {wx.temp}°C
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                Feels {wx.feels}°C
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{desc}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>💨 {wx.wind} km/h</div>
        </>
      )}
    </Card>
  );
}

// ── Priority dot colour ────────────────────────────────────────────────────────
const PRIORITY_COLOR = { high: '#e55', med: '#f90', low: '#5a9' };

// ── Left panel: Today's Tasks ──────────────────────────────────────────────────
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
  const visible = pending.slice(0, 7);

  return (
    <div style={{
      flex: '1.1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0,
      background: 'var(--bg-panel)', borderRadius: 12,
      border: '0.5px solid var(--card-border)',
      overflow: 'hidden',
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
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

              {/* Priority flag */}
              {t.priority === 'high' && (
                <span style={{ fontSize: 12, color: '#e55', flexShrink: 0 }}>⚑</span>
              )}

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

        {pending.length > 7 && (
          <div style={{ padding: '8px 18px', fontSize: 11, color: 'var(--text-muted)' }}>
            +{pending.length - 7} more — view all tasks
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

// ── Right panel: stacked cards ─────────────────────────────────────────────────
function DailyBriefCard({ ai }) {
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
    <Card>
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
    </Card>
  );
}

function ProgressHeroCard({ onTabChange }) {
  const xpData  = getXP();
  const totalXp = xpData.total ?? 0;
  const rank    = getRank(totalXp);
  const streak  = storage.get(STORAGE_KEYS.PROGRESS, {}).streak ?? 0;

  const cfg      = rank.config;
  const subLabels = ['I', 'II', 'III'];
  const rankLabel = rank.tier < 8
    ? `${cfg.name} ${subLabels[rank.subRank - 1]}`
    : cfg.name;

  // XP progress within current sub-rank band
  const tierLow  = TIER_THRESHOLDS[rank.tier - 1] ?? 0;
  const tierHigh = TIER_THRESHOLDS[rank.tier]      ?? tierLow + 1;
  const bandSize = (tierHigh - tierLow) / 3;
  const bandLow  = tierLow + (rank.subRank - 1) * bandSize;
  const pct      = rank.tier < 8 ? ((totalXp - bandLow) / bandSize) * 100 : 100;

  const xpToNext = rank.tier < 8
    ? Math.ceil(bandLow + bandSize - totalXp)
    : 0;

  // Mini tier track — all 8 tiers as small badges
  const miniTiers = TIER_CONFIG.map((tc, i) => ({
    tier: i + 1, reached: i + 1 <= rank.tier, active: i + 1 === rank.tier, cfg: tc,
  }));

  return (
    <div className="glass-card" style={{
      borderRadius: 12, padding: '18px 20px', flex: 1,
      display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>PROGRESS</div>
        <button
          onClick={() => onTabChange?.('progress')}
          style={{ fontSize: 10.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >View all →</button>
      </div>

      {/* Hero badge + rank info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ flexShrink: 0 }}>
          <RankBadge tier={rank.tier} subRank={rank.subRank} size={110} pulse={rank.tier === 8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 300, color: cfg.color, lineHeight: 1, letterSpacing: '0.02em' }}>
            {rankLabel}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, marginBottom: 12 }}>
            {rank.tier < 8 ? `${xpToNext.toLocaleString()} XP to next rank` : 'Maximum rank achieved'}
          </div>
          <XpBar value={pct} color={cfg.color} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{totalXp.toLocaleString()} XP total</span>
            <span style={{ fontSize: 10, color: cfg.color }}>{Math.round(pct)}%</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: 0,
        borderTop: '0.5px solid var(--card-border)',
        paddingTop: 12,
      }}>
        {[
          { label: 'TOTAL XP',   value: totalXp.toLocaleString(), color: cfg.color },
          { label: 'DAY STREAK', value: streak,                   color: 'var(--text-primary)' },
          { label: 'TIER',       value: `${rank.tier} / 8`,       color: 'var(--text-secondary)' },
        ].map((s, i, arr) => (
          <div key={s.label} style={{
            flex: 1, textAlign: 'center',
            borderRight: i < arr.length - 1 ? '0.5px solid var(--card-border)' : 'none',
          }}>
            <div style={{ fontSize: 20, fontWeight: 300, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 8.5, color: 'var(--text-muted)', letterSpacing: '0.07em', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Mini tier track */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {miniTiers.map(({ tier, reached, active, cfg: tc }) => (
          <div key={tier} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ opacity: reached ? 1 : 0.2, transition: 'opacity 0.3s' }}>
              <RankBadge tier={tier} subRank={active ? rank.subRank : tier < rank.tier ? 3 : 1} size={30} />
            </div>
            <span style={{ fontSize: 7, color: active ? tc.color : 'var(--text-muted)', letterSpacing: '0.04em' }}>
              {tc.name.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpotifyCard() {
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        background: 'linear-gradient(135deg, #1db954 0%, #0a7a33 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>♪</div>
      <div>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 3 }}>NOW PLAYING</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Spotify not connected</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Settings → Integrations</div>
      </div>
    </Card>
  );
}

// ── Productivity Widget — Task tags donut + Focus time donut ──────────────────
const TAG_COLOURS = [
  'var(--accent)', '#f59e0b', '#10b981', '#6366f1', '#ec4899',
  '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4', '#84cc16',
];

// SVG donut chart — segments defined by value array
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
  const today = new Date().toISOString().split('T')[0];

  // ── A: Task completion by tag ──────────────────────────────────────────────
  const tasks    = storage.get(STORAGE_KEYS.TASKS, []);
  const todayTasks = tasks; // tasks don't have a date field — show all pending/done

  // Group by tag
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

  // ── B: Focus session time by label ────────────────────────────────────────
  const allSessions = storage.get(STORAGE_KEYS.FOCUS_SESSIONS, []);
  const todaySessions = allSessions.filter(s => s.date === today);

  // Group by taskLabel
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
    <div className="glass-card" style={{ borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>PRODUCTIVITY</div>
        <button
          onClick={() => onTabChange?.('tasks')}
          style={{ fontSize: 10.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >View tasks →</button>
      </div>

      <div style={{ display: 'flex', gap: 32 }}>

        {/* ── Donut A: Tasks by tag ──────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <DonutChart segments={taskSegments} size={110} thickness={18} />
            {/* Centre label */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 18, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>
                {doneTasks}/{totalTasks}
              </div>
              <div style={{ fontSize: 8.5, color: 'var(--text-muted)', letterSpacing: '0.04em', marginTop: 2 }}>TASKS</div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>By Category</div>
            {taskSegments.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No tasks yet</div>
            )}
            {taskSegments.map((s, i) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{
                  fontSize: 11, color: 'var(--text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>{s.label}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {tagMap[s.label]?.done ?? 0}/{s.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: '0.5px', background: 'var(--card-border)', alignSelf: 'stretch' }} />

        {/* ── Donut B: Focus time ────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <DonutChart segments={focusSegments} size={110} thickness={18} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 16, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>
                {focusH > 0 ? `${focusH}h ${focusM}m` : `${focusM}m`}
              </div>
              <div style={{ fontSize: 8.5, color: 'var(--text-muted)', letterSpacing: '0.04em', marginTop: 2 }}>FOCUS</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
              Focus Today
              {todaySessions.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
                  {todaySessions.length} session{todaySessions.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {focusSegments.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                No focus sessions yet —{' '}
                <span
                  onClick={() => onTabChange?.('focus')}
                  style={{ color: 'var(--accent)', cursor: 'pointer' }}
                >start one →</span>
              </div>
            ) : focusSegments.map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{
                  fontSize: 11, color: 'var(--text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>{s.label}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
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

// ── Main Dashboard ─────────────────────────────────────────────────────────────
// ── Peak State Card ───────────────────────────────────────────────────────────
function PeakStateCard({ peakState, onTabChange }) {
  if (!peakState) return null;
  const { score, color, suggestion, factors } = peakState;

  return (
    <Card style={{ gap: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>PEAK STATE</div>
        <button onClick={() => onTabChange?.('health')}
          style={{ fontSize: 10.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          Health →
        </button>
      </div>

      {/* Score + ring */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        {/* Mini ring */}
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <svg viewBox="0 0 72 72" width="72" height="72">
            <defs>
              <filter id="ps-glow">
                <feGaussianBlur stdDeviation="1.5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle cx="36" cy="36" r="28" fill="none"
              stroke={color} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 28}
              strokeDashoffset={2 * Math.PI * 28 * (1 - score / 100)}
              filter="url(#ps-glow)"
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1), stroke 0.5s' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{score}</div>
            <div style={{ fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: 1 }}>/ 100</div>
          </div>
        </div>

        {/* Factor bars */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.values(factors).map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', width: 70, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</div>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ width: `${f.pct}%`, height: '100%', background: f.pct >= 80 ? '#4caf7d' : f.pct >= 50 ? '#f4a642' : '#e25d7a', borderRadius: 2, transition: 'width 0.6s' }} />
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 22, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.pts}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggestion */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, paddingTop: 10, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
        <span style={{ color, fontWeight: 600 }}>→ </span>{suggestion}
      </div>
    </Card>
  );
}

export default function Dashboard({ settings, onTabChange, ai, density = 'standard', peakState }) {
  const [hasGreeted, setHasGreeted] = useState(false);

  const userName = storage.get(STORAGE_KEYS.USER, {})?.name
    ?? storage.get(STORAGE_KEYS.SETTINGS, {})?.userName
    ?? 'there';

  // VALERIE launch greeting — spoken once per session
  useEffect(() => {
    if (hasGreeted || !ai) return;
    const sessionKey = `valerie_greeted_${new Date().toDateString()}`;
    if (sessionStorage.getItem(sessionKey)) return;

    const delay = setTimeout(() => {
      const text = `${getGreeting()}, ${userName}. Ready when you are.`;
      if (window.speechSynthesis) {
        const savedSettings = storage.get(STORAGE_KEYS.SETTINGS, {});
        const utt = new SpeechSynthesisUtterance(text);
        if (savedSettings.voice?.voiceURI) {
          const v = window.speechSynthesis.getVoices().find(v => v.voiceURI === savedSettings.voice.voiceURI);
          if (v) utt.voice = v;
        }
        window.speechSynthesis.speak(utt);
      }
      setHasGreeted(true);
      sessionStorage.setItem(sessionKey, '1');
    }, 900);

    return () => clearTimeout(delay);
  }, [ai, hasGreeted, userName]);

  const pad  = density === 'compact' ? '14px 18px' : density === 'spacious' ? '32px 36px' : '22px 28px';
  const gap  = density === 'compact' ? 10 : density === 'spacious' ? 24 : 14;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: pad, display: 'flex', flexDirection: 'column', gap, position: 'relative' }}>

      {/* ── Greeting banner ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '0.03em', margin: 0 }}>
            {getGreeting()}, <span style={{ color: 'var(--accent)' }}>{userName}</span>.
          </h1>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate()}</span>
        </div>
        <InlineClock />
      </div>

      {/* ── Top strip — 4 stat cards ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap, minHeight: 0 }}>
        <TasksCountCard />
        <QuoteCard />
        <VerseCard />
        <WeatherCard />
      </div>

      {/* ── Main body — Tasks left | Right stack ─────────────────────────── */}
      <div style={{ display: 'flex', gap, flex: 1, minHeight: 400 }}>
        <TasksPanel onTabChange={onTabChange} />

        <div style={{ flex: '0.9 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap }}>
          <DailyBriefCard ai={ai} />
          <SpotifyCard />
          <PeakStateCard peakState={peakState} onTabChange={onTabChange} />
          <Card style={{ justifyContent: 'center' }}>
            <DayRing />
          </Card>
        </div>
      </div>

      {/* ── Productivity strip — full width ──────────────────────────────── */}
      <ProductivityWidget onTabChange={onTabChange} />
    </div>
  );
}
