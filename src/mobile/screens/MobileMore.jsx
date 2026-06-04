// ─── MobileMore.jsx — Feature hub with brick widget grid ─────────────────────
import { useState, useMemo, useRef, useEffect } from 'react';
import { storage, STORAGE_KEYS } from '../../utils/storage.js';
import { useCollection } from '../../firebase/useCollection.js';
import { haptics }       from '../utils/haptics.js';
import MobileWorkout     from './MobileWorkout.jsx';

// ── Shared card ────────────────────────────────────────────────────────────────
function MCard({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 16, overflow: 'hidden', ...style,
    }}>
      {children}
    </div>
  );
}

// ── Back header with swipe-back support ────────────────────────────────────────
function SubHeader({ title, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10,
      paddingTop: 4, marginBottom: 20 }}>
      <button onClick={() => { haptics.tap(); onBack(); }} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px',
        color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4,
        WebkitTapHighlightColor: 'transparent', fontSize: 15,
      }}>
        <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
          <path d="M8 1L2 7.5 8 14" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        More
      </button>
      <div style={{ fontSize: 20, fontWeight: 300, color: 'var(--text-primary)',
        borderLeft: '0.5px solid var(--card-border)', paddingLeft: 10 }}>
        {title}
      </div>
    </div>
  );
}

// ── Sub-screen wrapper with swipe-back ─────────────────────────────────────────
function SubScreen({ title, onBack, children }) {
  const ref      = useRef(null);
  const startX   = useRef(null);
  const startY   = useRef(null);
  const swiping  = useRef(false);

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = false;
  }
  function onTouchMove(e) {
    if (!startX.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = Math.abs(e.touches[0].clientY - startY.current);
    if (!swiping.current && dx > 12 && dy < 40 && startX.current < 40) {
      swiping.current = true;
    }
    if (swiping.current && ref.current) {
      ref.current.style.transform = `translateX(${Math.max(0, dx)}px)`;
      ref.current.style.opacity   = `${Math.max(0.5, 1 - dx / 300)}`;
    }
  }
  function onTouchEnd(e) {
    if (!ref.current) return;
    const dx = e.changedTouches[0].clientX - (startX.current || 0);
    ref.current.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
    if (swiping.current && dx > 100) {
      ref.current.style.transform = 'translateX(100%)';
      ref.current.style.opacity   = '0';
      setTimeout(() => { haptics.tap(); onBack(); }, 220);
    } else {
      ref.current.style.transform = 'translateX(0)';
      ref.current.style.opacity   = '1';
    }
    setTimeout(() => { if (ref.current) ref.current.style.transition = ''; }, 300);
    startX.current = null; swiping.current = false;
  }

  return (
    <div ref={ref} style={{ willChange: 'transform, opacity' }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <SubHeader title={title} onBack={onBack} />
      {children}
    </div>
  );
}

// ── Tasks sub-screen ───────────────────────────────────────────────────────────
function TasksScreen({ onBack }) {
  const [tasks,  setTasks]  = useState(() => storage.get(STORAGE_KEYS.TASKS, []));
  const [input,  setInput]  = useState('');
  const [filter, setFilter] = useState('pending');

  function save(u) { setTasks(u); storage.set(STORAGE_KEYS.TASKS, u); }
  function addTask() {
    if (!input.trim()) return;
    haptics.success();
    save([{ id: Date.now(), text: input.trim(), done: false, createdAt: new Date().toISOString() }, ...tasks]);
    setInput('');
  }
  function toggle(id) { haptics.light(); save(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t)); }
  function remove(id) { haptics.tap(); save(tasks.filter(t => t.id !== id)); }

  const filtered = useMemo(() => {
    if (filter === 'pending') return tasks.filter(t => !t.done);
    if (filter === 'done')    return tasks.filter(t =>  t.done);
    return tasks;
  }, [tasks, filter]);

  const doneCount    = tasks.filter(t =>  t.done).length;
  const pendingCount = tasks.filter(t => !t.done).length;

  return (
    <SubScreen title="Tasks" onBack={onBack}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{doneCount}/{tasks.length} done</span>
        </div>

        <MCard style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder="Add a task…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 14, color: 'var(--text-primary)', caretColor: 'var(--accent)' }} />
            <button onClick={addTask} style={{
              background: 'var(--accent)', color: 'var(--bg-base)', border: 'none',
              borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              opacity: input.trim() ? 1 : 0.4,
            }}>Add</button>
          </div>
        </MCard>

        <div style={{ display: 'flex', gap: 8 }}>
          {[['pending', `Pending (${pendingCount})`], ['done', `Done (${doneCount})`], ['all', 'All']].map(([v, label]) => (
            <button key={v} onClick={() => { haptics.tap(); setFilter(v); }} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12,
              fontWeight: filter === v ? 600 : 400, cursor: 'pointer',
              border: filter === v ? '1px solid var(--accent)' : '0.5px solid var(--card-border)',
              background: filter === v ? 'var(--active-bg)' : 'none',
              color: filter === v ? 'var(--accent)' : 'var(--text-secondary)',
              WebkitTapHighlightColor: 'transparent',
            }}>{label}</button>
          ))}
        </div>

        <MCard style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '20px 18px', fontSize: 13, color: 'var(--text-muted)' }}>
              {filter === 'pending' ? 'All clear — you\'re on top of everything.' : 'No tasks here.'}
            </div>
          ) : (
            filtered.map((t, i) => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                borderBottom: i < filtered.length - 1 ? '0.5px solid var(--card-border)' : 'none',
              }}>
                <button onClick={() => toggle(t.id)} style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  border: t.done ? 'none' : '1.5px solid var(--card-border)',
                  background: t.done ? 'var(--accent)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                }}>
                  {t.done && <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                    <path d="M1 4l3 3 6-6" stroke="var(--bg-base)" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>}
                </button>
                <span style={{ flex: 1, fontSize: 14, lineHeight: 1.4,
                  color: t.done ? 'var(--text-muted)' : 'var(--text-primary)',
                  textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                <button onClick={() => remove(t.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: '4px', fontSize: 16,
                  WebkitTapHighlightColor: 'transparent', lineHeight: 1,
                }}>×</button>
              </div>
            ))
          )}
        </MCard>
      </div>
    </SubScreen>
  );
}

// ── Placeholder sub-screen ─────────────────────────────────────────────────────
function PlaceholderScreen({ title, onBack }) {
  return (
    <SubScreen title={title} onBack={onBack}>
      <MCard style={{ padding: '24px 18px' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {title} is available on your desktop. Data syncs automatically via Firebase.
        </div>
      </MCard>
    </SubScreen>
  );
}

// ── Feature bricks ─────────────────────────────────────────────────────────────
const BRICKS = [
  { id: 'tasks',    label: 'Tasks',    icon: '✓',  accent: 'var(--accent)',  action: 'sub'  },
  { id: 'workout',  label: 'Workout',  icon: '💪', accent: '#f59e0b',        action: 'sub'  },
  { id: 'finance',  label: 'Finance',  icon: '$',  accent: '#4caf7d',        action: 'tab'  },
  { id: 'focus',    label: 'Focus',    icon: '⏱',  accent: '#a78bfa',        action: 'sub'  },
  { id: 'notes',    label: 'Notes',    icon: '✏',  accent: '#f472b6',        action: 'sub'  },
  { id: 'lists',    label: 'Lists',    icon: '≡',  accent: '#38bdf8',        action: 'sub'  },
  { id: 'routines', label: 'Routines', icon: '↺',  accent: '#fb923c',        action: 'sub'  },
  { id: 'calendar', label: 'Calendar', icon: '▦',  accent: '#e05555',        action: 'sub'  },
];

// ── Quick stats strip ──────────────────────────────────────────────────────────
function QuickStats() {
  const today = new Date().toISOString().split('T')[0];
  const tasks = storage.get(STORAGE_KEYS.TASKS, []);
  const pending = tasks.filter(t => !t.done).length;
  const done    = tasks.filter(t =>  t.done).length;

  const { items: waterLogs   = [] } = useCollection('water_logs',   'valerie_water_logs');
  const { items: supplements = [] } = useCollection('supplements',  'valerie_supplements');

  const todayWater = useMemo(() =>
    waterLogs.filter(l => l.date === today).reduce((s, l) => s + (l.amount || 0), 0),
  [waterLogs, today]);
  const takenToday = supplements.filter(s => s.takenDates?.includes(today)).length;

  const sessions   = storage.get(STORAGE_KEYS.FOCUS_SESSIONS, []);
  const focusMins  = sessions.filter(s => s.date === today).reduce((s, f) => s + (f.duration || 0), 0);

  const stats = [
    { label: 'Tasks Left',  value: pending, unit: `${done} done`,       color: 'var(--accent)' },
    { label: 'Water',       value: `${(todayWater/1000).toFixed(1)}`, unit: 'litres', color: '#4a9eff' },
    { label: 'Supplements', value: `${takenToday}/${supplements.length}`, unit: 'taken', color: '#a78bfa' },
    { label: 'Focus',       value: focusMins >= 60 ? `${Math.floor(focusMins/60)}h${focusMins%60}m` : `${focusMins}m`, unit: 'today', color: '#f59e0b' },
  ];

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
        Today at a Glance
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
            borderRadius: 14, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 200, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{s.unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MobileMore({ settings, onSettingsChange, onTabChange }) {
  const [active, setActive] = useState(null);

  function handleBrick(brick) {
    haptics.tap();
    if (brick.action === 'tab') {
      // Navigate to a main tab instead of sub-screen
      if (brick.id === 'finance') onTabChange?.('finance');
      return;
    }
    setActive(brick.id);
  }

  function renderSub() {
    if (active === 'tasks')   return <TasksScreen   onBack={() => setActive(null)} />;
    if (active === 'workout') return (
      <SubScreen title="Workout" onBack={() => setActive(null)}>
        <MobileWorkout />
      </SubScreen>
    );
    const b = BRICKS.find(b => b.id === active);
    return <PlaceholderScreen title={b?.label} onBack={() => setActive(null)} />;
  }

  return (
    <div style={{ padding: '16px', paddingTop: 20 }}>

      {active ? renderSub() : (
        <>
          <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)',
            marginBottom: 20 }}>More</div>

          {/* Brick grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {BRICKS.map(brick => (
              <button
                key={brick.id}
                onClick={() => handleBrick(brick)}
                style={{
                  aspectRatio: '1 / 0.85',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'flex-start', justifyContent: 'space-between',
                  padding: '14px 14px 12px',
                  background: 'var(--bg-panel)',
                  border: '0.5px solid var(--card-border)',
                  borderRadius: 18,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  textAlign: 'left',
                  transition: 'border-color 0.15s ease, transform 0.1s ease',
                  position: 'relative',
                }}
                onTouchStart={e => {
                  e.currentTarget.style.borderColor = brick.accent;
                  e.currentTarget.style.transform = 'scale(0.96)';
                }}
                onTouchEnd={e => {
                  e.currentTarget.style.borderColor = 'var(--card-border)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {/* External link indicator for tab-navigating bricks */}
                {brick.action === 'tab' && (
                  <div style={{ position: 'absolute', top: 10, right: 10,
                    fontSize: 8, color: 'var(--text-muted)', opacity: 0.5 }}>↗</div>
                )}
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--hover-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: brick.icon.length === 1 && /[A-Za-z$✓≡↺▦⏱✏]/.test(brick.icon) ? 17 : 20,
                  color: brick.accent, fontWeight: 700,
                }}>
                  {brick.icon}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                  {brick.label}
                </div>
              </button>
            ))}
          </div>

          {/* Quick stats */}
          <QuickStats />
        </>
      )}
    </div>
  );
}
