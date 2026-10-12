// ─── MobileDashboard.jsx — Full desktop widget parity for iOS PWA ────────────
import { useState, useEffect } from 'react';
import { storage, STORAGE_KEYS } from '../../utils/storage.js';
import { getGreeting } from '../../utils/time.js';
import { useCollection }  from '../../supabase/useCollection.js';
import { useDocument }    from '../../supabase/useDocument.js';
import { getXP, getRank, TIER_CONFIG, TIER_THRESHOLDS } from '../../utils/xp.js';
import DayRing from '../../components/DayRing.jsx';
import { toLocalDateKey } from '../../utils/localDate.js';
import { useTasks } from '../../hooks/useTasks.js';
import GoalRing from '../../components/GoalRing.jsx';
import NextMoves from '../../components/NextMoves.jsx';
import OverallCard from '../../components/OverallCard.jsx';
import { HomeRecap, HomeStreak } from '../../components/HomeRecap.jsx';
import CoachUpdates from '../../components/CoachUpdates.jsx';

// ── Shared components ──────────────────────────────────────────────────────────
function MCard({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 16, padding: '14px 16px', ...style,
    }}>
      {children}
    </div>
  );
}

function MLabel({ children, style = {} }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10, ...style }}>
      {children}
    </div>
  );
}

// ── Live clock ─────────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = n => n.toString().padStart(2, '0');
  return (
    <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
      <div style={{ fontSize: 32, fontWeight: 200, color: 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>
        {pad(now.getHours())}
        <span style={{ opacity: 0.4 }}>:</span>
        {pad(now.getMinutes())}
        <span style={{ fontSize: 14, opacity: 0.4, marginLeft: 2 }}>{pad(now.getSeconds())}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
        {now.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
      </div>
    </div>
  );
}

// ── Stat cards strip ───────────────────────────────────────────────────────────
const QUOTES = [
  { text: "Discipline equals freedom.", author: "Jocko Willink" },
  { text: "The impediment to action advances action.", author: "Marcus Aurelius" },
  { text: "We suffer more in imagination than in reality.", author: "Seneca" },
  { text: "Hard choices, easy life. Easy choices, hard life.", author: "Jerzy Gregorek" },
  { text: "The obstacle is the way.", author: "Ryan Holiday" },
  { text: "You have power over your mind, not outside events.", author: "Marcus Aurelius" },
  { text: "If it is not right, do not do it; if it is not true, do not say it.", author: "Marcus Aurelius" },
];
const VERSES = [
  { text: "I can do all things through Christ who strengthens me.", ref: "Philippians 4:13" },
  { text: "Trust in the Lord with all your heart and lean not on your own understanding.", ref: "Proverbs 3:5" },
  { text: "Be strong and courageous. Do not be afraid; do not be discouraged.", ref: "Joshua 1:9" },
  { text: "For I know the plans I have for you, plans to prosper you and not to harm you.", ref: "Jeremiah 29:11" },
  { text: "The Lord will fight for you; you need only to be still.", ref: "Exodus 14:14" },
  { text: "Cast all your anxiety on him because he cares for you.", ref: "1 Peter 5:7" },
  { text: "Greater is he that is in you, than he that is in the world.", ref: "1 John 4:4" },
  { text: "With God all things are possible.", ref: "Matthew 19:26" },
];
const WMO_ICONS = { 0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',51:'🌦️',61:'🌧️',80:'🌦️',95:'⛈️' };
const WMO_DESC  = { 0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',51:'Drizzle',61:'Rain',80:'Showers',95:'Thunderstorm' };

function StatStrip({ tasks }) {
  const pending  = tasks.filter(t => !t.done).length;
  const done     = tasks.filter(t =>  t.done).length;
  const quote    = QUOTES[new Date().getDate() % QUOTES.length];
  const verse    = VERSES[new Date().getDate() % VERSES.length];
  const [wx, setWx] = useState(null);
  const [wxErr, setWxErr] = useState(null);

  useEffect(() => {
    const WX_KEY = 'valerie_wx_cache';
    try {
      const cached = JSON.parse(localStorage.getItem(WX_KEY) || 'null');
      if (cached && Date.now() - cached.ts < 3600_000) { setWx(cached); return; }
    } catch {}

    function doFetch(lat, lon) {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`)
        .then(r => r.json()).then(d => {
          const data = { temp: Math.round(d.current.temperature_2m), feels: Math.round(d.current.apparent_temperature), code: d.current.weather_code, wind: Math.round(d.current.wind_speed_10m), ts: Date.now() };
          localStorage.setItem(WX_KEY, JSON.stringify(data));
          setWx(data);
        }).catch(() => setWxErr('Unavailable'));
    }

    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(({ state }) => {
        if (state === 'granted') navigator.geolocation.getCurrentPosition(({ coords }) => doFetch(coords.latitude, coords.longitude), () => setWxErr('No location'));
      }).catch(() => navigator.geolocation?.getCurrentPosition(({ coords }) => doFetch(coords.latitude, coords.longitude), () => {}));
    } else {
      navigator.geolocation?.getCurrentPosition(({ coords }) => doFetch(coords.latitude, coords.longitude), () => {});
    }
  }, []);

  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2,
      scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>

      {/* Tasks */}
      <div style={{ flexShrink: 0, width: 130, background: 'var(--bg-panel)',
        border: '0.5px solid var(--card-border)', borderRadius: 14, padding: '12px 14px' }}>
        <MLabel style={{ marginBottom: 6 }}>Tasks Today</MLabel>
        <div style={{ fontSize: 38, fontWeight: 200, color: 'var(--text-primary)', lineHeight: 1 }}>{pending}</div>
        <div style={{ fontSize: 10.5, color: 'var(--accent)', marginTop: 4 }}>
          {done > 0 ? `${done} completed` : "Let's go"}
        </div>
      </div>

      {/* Quote */}
      <div style={{ flexShrink: 0, width: 200, background: 'var(--bg-panel)',
        border: '0.5px solid var(--card-border)', borderRadius: 14, padding: '12px 14px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <MLabel style={{ marginBottom: 6 }}>Quote</MLabel>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic',
          lineHeight: 1.55, flex: 1 }}>"{quote.text}"</p>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 8 }}>— {quote.author}</div>
      </div>

      {/* Verse */}
      <div style={{ flexShrink: 0, width: 200, background: 'var(--bg-panel)',
        border: '0.5px solid var(--card-border)', borderRadius: 14, padding: '12px 14px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <MLabel style={{ marginBottom: 6 }}>Verse</MLabel>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic',
          lineHeight: 1.55, flex: 1 }}>"{verse.text}"</p>
        <div style={{ fontSize: 10.5, color: 'var(--accent)', marginTop: 8 }}>{verse.ref}</div>
      </div>

      {/* Weather */}
      <div style={{ flexShrink: 0, width: 140, background: 'var(--bg-panel)',
        border: '0.5px solid var(--card-border)', borderRadius: 14, padding: '12px 14px' }}>
        <MLabel style={{ marginBottom: 6 }}>Weather</MLabel>
        {!wx && !wxErr && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fetching…</div>}
        {wxErr && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{wxErr}</div>}
        {wx && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 28 }}>{WMO_ICONS[wx.code] ?? '🌡️'}</span>
              <div style={{ fontSize: 26, fontWeight: 200, color: 'var(--text-primary)' }}>{wx.temp}°</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{WMO_DESC[wx.code] ?? ''}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>x {wx.wind} km/h</div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Today's Workout card ───────────────────────────────────────────────────────
const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];
const SPLIT_COLOURS = { push:'#e25d7a', pull:'#4a9eff', legs:'#f4a642', rest:'rgba(255,255,255,0.2)', custom:'#9b5de5' };

function TodayWorkoutCard({ onTabChange }) {
  const { items: programs = [] } = useCollection('programs', STORAGE_KEYS.PROGRAMS);
  const { data: storedEx }       = useDocument('overload_exercises', STORAGE_KEYS.OVERLOAD_EXERCISES, null);
  const exercises = Array.isArray(storedEx) ? storedEx : [];

  const todayKey  = DAY_KEYS[new Date().getDay()];
  const active    = programs.find(p => p.isActive) ?? null;
  const todayData = active?.days?.[todayKey] ?? null;
  const splitType = todayData?.splitType ?? null;
  const label     = todayData?.label ?? 'Workout';
  const isRest    = !splitType || splitType === 'rest';
  const exCount   = isRest ? 0 : exercises.filter(e => e.day === splitType).length;
  const colour    = SPLIT_COLOURS[splitType] ?? 'var(--accent)';

  if (!active) return null;

  return (
    <div onClick={() => onTabChange?.('workout')} style={{
      padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
      background: isRest ? 'rgba(255,255,255,0.03)' : `${colour}14`,
      border: `0.5px solid ${isRest ? 'rgba(255,255,255,0.08)' : `${colour}35`}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: isRest ? 'rgba(255,255,255,0.3)' : colour, marginBottom: 4 }}>Today's Workout</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          {isRest ? 'Rest Day' : `${label} — ${exCount} exercise${exCount !== 1 ? 's' : ''}`}
        </div>
      </div>
      <div style={{ fontSize: 14, color: colour, opacity: 0.7 }}> </div>
    </div>
  );
}

// ── Peak State card (full, matching desktop) ───────────────────────────────────
function PeakStateCard({ peakState, onTabChange }) {
  if (!peakState) return null;
  const { score, color, suggestion, factors } = peakState;

  const size = 80, thickness = 7, r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = Math.max(0, Math.min(100, score || 0)) / 100;

  return (
    <MCard onClick={() => onTabChange?.('health')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <MLabel style={{ marginBottom: 0 }}>Peak State</MLabel>
        <span style={{ fontSize: 11, color: 'var(--accent)' }}>Health  </span>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Ring */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color || 'var(--accent)'}
              strokeWidth={thickness} strokeLinecap="round"
              strokeDasharray={`${pct * circ} ${circ}`}
              style={{ transition: 'stroke-dasharray 0.6s ease' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 300, color: color || 'var(--text-primary)', lineHeight: 1 }}>{score ?? 0}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>/100</div>
          </div>
        </div>

        {/* Factor bars */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {factors && Object.entries(factors).map(([key, f]) => {
            const barPct = f.pct ?? 0;
            const barCol = barPct > 66 ? '#4caf7d' : barPct > 33 ? '#f59e0b' : 'rgba(255,255,255,0.15)';
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 90, flexShrink: 0 }}>{f.label}</span>
                <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                  <div style={{ width: `${barPct}%`, height: '100%', background: barCol,
                    borderRadius: 2, transition: 'width 0.5s ease' }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 16, textAlign: 'right' }}>{f.pts}</span>
              </div>
            );
          })}
        </div>
      </div>

      {suggestion && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 12,
          paddingTop: 10, borderTop: '0.5px solid var(--card-border)' }}>
            {suggestion}
        </div>
      )}
    </MCard>
  );
}

// ── Tasks panel (full, matching desktop) ───────────────────────────────────────
const PRIORITY_COLOR = { high: '#e55', med: '#f90', low: '#5a9' };

function TasksPanel({ onTabChange, tasks, toggle, addTask: addTaskToStore }) {
  const [newText, setNewText] = useState('');
  const [adding,  setAdding]  = useState(false);

  const addTask = async () => {
    const text = newText.trim();
    if (!text || adding) return;
    setAdding(true);
    const id = await addTaskToStore(text, { priority: 'low' });
    setAdding(false);
    if (id) setNewText(''); // keep the text if the save failed
  };

  const pending = tasks.filter(t => !t.done);
  const visible = pending.slice(0, 8);

  return (
    <MCard style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 10px', borderBottom: '0.5px solid var(--card-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Today's Tasks</span>
        <button onClick={() => onTabChange?.('tasks')}
          style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none',
            cursor: 'pointer', padding: 0, WebkitTapHighlightColor: 'transparent' }}>
          View all  
        </button>
      </div>

      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {visible.length === 0 ? (
          <div style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)' }}>
            All clear — you're on top of everything.
          </div>
        ) : visible.map((t) => {
          const pCol = PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.low;
          return (
            <div key={t.id} onClick={() => toggle(t)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px',
              borderBottom: '0.5px solid var(--card-border)', cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                border: `1.5px solid ${pCol}`, background: t.done ? pCol : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
{t.done && <span style={{ fontSize: 10.5, color: "#fff" }}>✓</span>}
              </div>
              {t.priority === 'high' && <span style={{ fontSize: 12, color: '#e55', flexShrink: 0 }}>a</span>}
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.45 : 1 }}>
                {t.text}
              </span>
            </div>
          );
        })}
        {pending.length > 8 && (
          <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-muted)' }}>
            +{pending.length - 8} more
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '10px 12px',
        borderTop: '0.5px solid var(--card-border)' }}>
        <input value={newText} onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="Add a task for today…"
          style={{ flex: 1, background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
            borderRadius: 8, padding: '8px 12px', fontSize: 13,
            color: 'var(--text-primary)', outline: 'none' }} />
        <button onClick={addTask} disabled={adding} style={{
          padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: 'var(--accent)', color: 'var(--bg-base)',
          border: 'none', cursor: adding ? 'default' : 'pointer', flexShrink: 0,
          opacity: adding ? 0.6 : 1,
          WebkitTapHighlightColor: 'transparent' }}>
          {adding ? 'Saving…' : 'Add'}
        </button>
      </div>
    </MCard>
  );
}

// ── Productivity widget (full, matching desktop) ───────────────────────────────
const TAG_COLOURS = ['var(--accent)','#f59e0b','#10b981','#6366f1','#ec4899','#14b8a6','#f97316','#8b5cf6'];

function DonutChart({ segments, size = 64, thickness = 9 }) {
  const r = (size - thickness) / 2, cx = size/2, cy = size/2, circ = 2*Math.PI*r;
  const total = segments.reduce((s,seg) => s + seg.value, 0);

  if (total === 0) return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--hover-bg)" strokeWidth={thickness} />
    </svg>
  );

  let offset = 0;
  const arcs = segments.map(seg => {
    const pct = seg.value/total, dash = pct*circ, gap = circ-dash;
    const arc = { ...seg, dashArray:`${dash} ${gap}`, dashOffset: -offset*circ };
    offset += pct;
    return arc;
  });

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--hover-bg)" strokeWidth={thickness} />
      {arcs.map((arc,i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={arc.color}
          strokeWidth={thickness} strokeDasharray={arc.dashArray} strokeDashoffset={arc.dashOffset}
          strokeLinecap="butt" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      ))}
    </svg>
  );
}

function ProductivityWidget({ onTabChange, tasks }) {
  const today = toLocalDateKey(new Date());
  const tagMap = {};
  tasks.forEach(t => {
    const k = t.tag || 'Untagged';
    if (!tagMap[k]) tagMap[k] = { total:0, done:0 };
    tagMap[k].total++;
    if (t.done) tagMap[k].done++;
  });
  const tagEntries = Object.entries(tagMap).sort((a,b)=>b[1].total-a[1].total).slice(0,8);
  const taskSegments = tagEntries.map(([tag,{total}],i) => ({ label:tag, value:total, color:TAG_COLOURS[i%TAG_COLOURS.length] }));
  const doneTasks = tasks.filter(t=>t.done).length;
  const totalTasks = tasks.length;

  const allSessions = storage.get(STORAGE_KEYS.FOCUS_SESSIONS, []);
  const todaySessions = allSessions.filter(s => s.date === today);
  const focusMap = {};
  todaySessions.forEach(s => { const k = s.taskLabel||'Focus'; focusMap[k]=(focusMap[k]||0)+(s.duration||0); });
  const focusEntries = Object.entries(focusMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const focusSegments = focusEntries.map(([label,mins],i) => ({ label, value:mins, color:TAG_COLOURS[(i+2)%TAG_COLOURS.length] }));
  const totalFocusMin = todaySessions.reduce((s,f)=>s+(f.duration||0),0);
  const focusH = Math.floor(totalFocusMin/60), focusM = totalFocusMin%60;

  return (
    <MCard>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <MLabel style={{ marginBottom: 0 }}>Productivity</MLabel>
        <button onClick={() => onTabChange?.('tasks')}
          style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none',
            cursor: 'pointer', padding: 0, WebkitTapHighlightColor: 'transparent' }}>
          View tasks →
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {/* Tasks donut */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <DonutChart segments={taskSegments} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div className="val-num" style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1 }}>{doneTasks}/{totalTasks}</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Tasks</div>
            {taskSegments.length === 0
              ? <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>None yet</div>
              : taskSegments.slice(0,4).map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{tagMap[s.label]?.done??0}/{s.value}</span>
                </div>
              ))
            }
          </div>
        </div>

        <div style={{ width: '0.5px', background: 'var(--card-border)', alignSelf: 'stretch' }} />

        {/* Focus donut */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <DonutChart segments={focusSegments} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div className="val-num" style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1 }}>
                {focusH > 0 ? `${focusH}h${focusM}m` : `${focusM}m`}
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Focus</div>
            {focusSegments.length === 0
              ? <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>None yet</div>
              : focusSegments.slice(0,4).map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{s.value}m</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </MCard>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function MobileDashboard({ settings, peakState, onTabChange }) {
  const userName = settings?.userName || 'Rob';
  const { tasks, toggle, addTask } = useTasks();

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`@keyframes mPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        paddingTop: 4, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{getGreeting()},</div>
          <div style={{ fontSize: 26, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1.1 }}>{userName}.</div>
        </div>
        <LiveClock />
      </div>

      {/*  Goal ring — today's score against the Coach goal  */}
      <GoalRing settings={settings} onTabChange={onTabChange} compact />

      <NextMoves onTabChange={onTabChange} compact />
      <HomeRecap compact />
      <CoachUpdates compact />
      <OverallCard compact />
      <HomeStreak compact />

      {/* ── Stat strip (horizontal scroll) ── */}
      <StatStrip tasks={tasks} />


      {/* ── Today Workout ── */}
      <TodayWorkoutCard onTabChange={onTabChange} />

      {/* ── Peak State ── */}
      <PeakStateCard peakState={peakState} onTabChange={onTabChange} />

      {/* ── Day Ring ── */}
      <MCard style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <DayRing />
      </MCard>

      {/* ── Tasks Panel ── */}
      <TasksPanel onTabChange={onTabChange} tasks={tasks} toggle={toggle} addTask={addTask} />

      {/* ── Productivity ── */}
      <ProductivityWidget onTabChange={onTabChange} tasks={tasks} />
    </div>
  );
}


