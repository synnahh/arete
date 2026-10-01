// PlanToday — the Plan group's front page: one week strip, one ordered agenda for the
// selected day (events, routines, the training session, tasks), what is overdue, what is
// coming, today's focus time and what is running low. Rules: src/domain/plan.js.
import { useMemo, useState } from 'react';
import { useTasks } from '../hooks/useTasks.js';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { buildDay, daySummary, overdue, weekStrip, upcoming, addDays } from '../domain/plan.js';
import { applyUsage, dueItems } from '../domain/ahead.js';
import { label } from '../components/ui.js';

const CARD = { padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 };
const KIND = {
  event:   { name: 'Event',   colour: '#6FA8F2' },
  routine: { name: 'Routine', colour: '#A98FF2' },
  train:   { name: 'Train',   colour: '#F2784B' },
  task:    { name: 'Task',    colour: 'var(--tab-accent)' },
};
const PRIORITY_COLOUR = { high: '#e55a5a', med: '#f4a642', low: 'var(--text-secondary)' };
const SCREEN_FOR = { event: 'calendar', routine: 'routines', train: 'workout', task: 'tasks' };

const parse = (key) => new Date(`${key}T00:00:00`);
const longDay = (key) => parse(key).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDay = (key) => parse(key).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function Ring({ pct, size = 84 }) {
  const R = 34, C = 2 * Math.PI * R;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="40" r={R} fill="none" stroke="var(--card-border)" strokeWidth="6" />
      <circle cx="40" cy="40" r={R} fill="none" stroke="var(--tab-accent)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 40 40)" style={{ transition: 'stroke-dashoffset 400ms ease' }} />
    </svg>
  );
}

function Check({ done, onClick, name }) {
  return (
    <button type="button" onClick={onClick} aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${name}`} aria-pressed={done}
      style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1.5px solid ${done ? 'var(--tab-accent)' : 'var(--text-secondary)'}`, background: done ? 'var(--tab-accent)' : 'transparent', color: 'var(--on-tab-accent)' }}>
      {done && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
    </button>
  );
}

export default function PlanToday({ onTabChange, compact = false }) {
  const today = toLocalDateKey(new Date());
  const [selected, setSelected] = useState(today);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const { tasks, toggle, addTask, update } = useTasks();
  const { items: events = [] } = useCollection('events', STORAGE_KEYS.EVENTS);
  const { items: routines = [] } = useCollection('routines', STORAGE_KEYS.ROUTINES);
  const { items: programs = [] } = useCollection('programs', STORAGE_KEYS.PROGRAMS);
  const { items: workouts = [] } = useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS);
  const { items: sessions = [] } = useCollection('focus_sessions', STORAGE_KEYS.FOCUS_SESSIONS);
  const { items: supplies = [] } = useCollection('essentials', STORAGE_KEYS.ESSENTIALS);
  const { items: nutrition = [] } = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);

  const program = useMemo(() => programs.find(p => p?.isActive) || null, [programs]);
  const ctx = { today, tasks, events, routines, program, workouts };
  const items = useMemo(() => buildDay({ date: selected, ...ctx }), [selected, tasks, events, routines, program, workouts]); // eslint-disable-line react-hooks/exhaustive-deps
  const strip = useMemo(() => weekStrip({ anchor: selected, selected, ...ctx }), [selected, tasks, events, routines, program, workouts]); // eslint-disable-line react-hooks/exhaustive-deps
  const summary = useMemo(() => daySummary(items), [items]);
  const late = useMemo(() => overdue(tasks, today), [tasks, today]);
  const coming = useMemo(() => upcoming({ today, days: 7, tasks, events }), [today, tasks, events]);
  const low = useMemo(() => dueItems(applyUsage(supplies, nutrition, today), today, 7).slice(0, 3), [supplies, nutrition, today]);
  const focusMin = useMemo(() => sessions.filter(s => s.date === today).reduce((n, s) => n + (Number(s.duration) || 0), 0), [sessions, today]);

  async function submit() {
    let text = draft.trim();
    if (!text || busy) return;
    const high = /!+$/.test(text);
    text = text.replace(/\s*!+$/, '');
    if (!text) return;
    setBusy(true);
    try {
      const id = await addTask(text, { dueDate: selected, ...(high ? { priority: 'high' } : {}) });
      if (id) setDraft('');
    } finally { setBusy(false); }
  }
  const moveToToday = (t) => update(t.id, { dueDate: today });
  const moveAll = async () => { for (const t of late) await update(t.id, { dueDate: today }); };
  const go = (screen) => onTabChange?.(screen);
  const isToday = selected === today;

  return (
    <div style={{ padding: compact ? '12px 14px 28px' : '20px 28px 40px', display: 'flex', flexDirection: 'column', gap: 16, width: '100%', boxSizing: 'border-box', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={label}>{isToday ? 'Today' : selected < today ? 'Earlier' : 'Coming up'}</div>
          <h1 style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)', fontSize: compact ? 22 : 28, fontWeight: 600, letterSpacing: '0.03em', color: 'var(--text-primary)' }}>{longDay(selected)}</h1>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" aria-label="Previous week" onClick={() => setSelected(addDays(selected, -7))} style={navBtn}>‹</button>
          <button type="button" onClick={() => setSelected(today)} disabled={isToday} style={{ ...navBtn, width: 'auto', padding: '0 14px', opacity: isToday ? 0.5 : 1 }}>Today</button>
          <button type="button" aria-label="Next week" onClick={() => setSelected(addDays(selected, 7))} style={navBtn}>›</button>
        </div>
      </div>

      <div role="group" aria-label="Week" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: compact ? 4 : 8 }}>
        {strip.map(d => (
          <button key={d.date} type="button" onClick={() => setSelected(d.date)} aria-pressed={d.isSelected} aria-label={`${shortDay(d.date)}: ${plural(d.open, 'task')} open, ${plural(d.events, 'event')}${d.train ? ', training day' : ''}`}
            style={{ padding: compact ? '8px 0' : '10px 0', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              border: `0.5px solid ${d.isToday ? 'var(--tab-accent)' : 'var(--card-border)'}`,
              background: d.isSelected ? 'var(--tab-accent)' : 'var(--bg-panel)', color: d.isSelected ? 'var(--on-tab-accent)' : 'var(--text-primary)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: d.isSelected ? 0.85 : 0.65 }}>{d.weekday}</span>
            <span className="val-num" style={{ fontSize: compact ? 17 : 20, fontWeight: 600, lineHeight: 1 }}>{d.day}</span>
            <span aria-hidden="true" style={{ display: 'flex', gap: 3, height: 6 }}>
              {d.open > 0 && <i style={dot(d.isSelected ? 'currentColor' : KIND.task.colour)} />}
              {d.events > 0 && <i style={dot(d.isSelected ? 'currentColor' : KIND.event.colour)} />}
              {d.train && <i style={dot(d.isSelected ? 'currentColor' : KIND.train.colour)} />}
            </span>
          </button>
        ))}
      </div>

      <div className="plan-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section aria-label="Add a task" style={{ ...CARD, flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 }}>
            <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder={compact ? `Add a task… (end with ! = high)` : `Add a task for ${isToday ? 'today' : shortDay(selected)}…  (end with ! for high priority)`} aria-label="New task"
              style={{ flex: 1, minWidth: 0, height: 40, padding: '0 12px', borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 14.5, fontFamily: 'inherit', outline: 'none' }} />
            <button type="button" onClick={submit} disabled={!draft.trim() || busy}
              style={{ height: 40, padding: '0 18px', borderRadius: 10, border: 'none', cursor: draft.trim() ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                background: draft.trim() ? 'var(--tab-accent)' : 'var(--hover-bg)', color: draft.trim() ? 'var(--on-tab-accent)' : 'var(--text-secondary)' }}>Add</button>
          </section>

          {isToday && late.length > 0 && (
            <section aria-label="Overdue" style={{ ...CARD, borderColor: 'color-mix(in srgb, #e55a5a 45%, var(--card-border))' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ ...label, color: '#e55a5a' }}>Overdue · {late.length}</div>
                <button type="button" onClick={moveAll} style={linkBtn}>Move all to today</button>
              </div>
              {late.slice(0, 6).map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                  <Check done={false} name={t.text} onClick={() => toggle(t)} />
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>{shortDay(t.dueDate)}</span>
                  <button type="button" onClick={() => moveToToday(t)} style={linkBtn}>Today</button>
                </div>
              ))}
              {late.length > 6 && <button type="button" onClick={() => go('tasks')} style={{ ...linkBtn, alignSelf: 'flex-start' }}>and {late.length - 6} more in Tasks</button>}
            </section>
          )}

          <section aria-label="Agenda" style={{ ...CARD, gap: 4 }}>
            <div style={{ ...label, marginBottom: 6 }}>Agenda · {items.length ? plural(items.length, 'item') : 'clear'}</div>
            {items.length === 0 && (
              <div style={{ padding: '22px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 15, color: 'var(--text-primary)' }}>Nothing planned for {isToday ? 'today' : shortDay(selected)}.</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Add a task above, or put an event or a routine on this day.</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => go('calendar')} style={ghost}>Add an event</button>
                  <button type="button" onClick={() => go('routines')} style={ghost}>Build a routine</button>
                </div>
              </div>
            )}
            {items.map(it => {
              const k = KIND[it.kind];
              const doable = it.kind === 'task';
              return (
                <div key={`${it.kind}:${it.id}`} style={{ display: 'grid', gridTemplateColumns: '52px 4px minmax(0, 1fr) auto', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '0.5px solid var(--card-border)', opacity: it.done ? 0.55 : 1 }}>
                  <span className="val-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-secondary)' }}>{it.time || (it.kind === 'task' ? '' : 'All day')}</span>
                  <span aria-hidden="true" style={{ alignSelf: 'stretch', borderRadius: 2, background: it.kind === 'task' ? PRIORITY_COLOUR[it.priority] : k.colour, opacity: 0.9 }} />
                  <button type="button" onClick={() => go(SCREEN_FOR[it.kind])} style={{ all: 'unset', cursor: 'pointer', minWidth: 0 }} aria-label={`Open ${k.name}: ${it.title}`}>
                    <span style={{ display: 'block', fontSize: 14.5, color: 'var(--text-primary)', textDecoration: it.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {k.name}{it.end ? ` · until ${it.end}` : ''}{it.kind === 'routine' ? ` · ${plural(it.steps, 'step')}` : ''}{it.repeat ? ` · repeats ${it.repeat}` : ''}{it.kind === 'train' && it.done ? ' · logged' : ''}
                    </span>
                  </button>
                  {doable ? <Check done={it.done} name={it.title} onClick={() => toggle(it.ref)} /> : <span />}
                </div>
              );
            })}
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section aria-label="Day progress" style={{ ...CARD, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <span style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
              <Ring pct={summary.pct} />
              <span className="val-num" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{summary.total ? `${summary.pct}%` : '–'}</span>
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={label}>{isToday ? 'Today' : shortDay(selected)}</div>
              <div style={{ fontSize: 15, color: 'var(--text-primary)', marginTop: 4 }}>
                {summary.total === 0 ? 'No tasks or training set.' : summary.done === summary.total ? 'All done. Nicely played.' : `${summary.done} of ${summary.total} done`}
              </div>
              {summary.total > 0 && summary.done < summary.total && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>{plural(summary.total - summary.done, 'thing')} left</div>}
            </div>
          </section>

          <section aria-label="Next 7 days" style={CARD}>
            <div style={label}>Next 7 days</div>
            {coming.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Nothing dated in the coming week.</div>}
            {coming.slice(0, 5).map(d => (
              <button key={d.date} type="button" onClick={() => setSelected(d.date)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3, padding: '6px 0', borderTop: '0.5px solid var(--card-border)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--tab-accent)' }}>{shortDay(d.date).toUpperCase()}</span>
                {d.items.slice(0, 3).map((x, i) => (
                  <span key={i} style={{ fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {x.time ? <span className="val-num" style={{ color: 'var(--text-secondary)', marginRight: 8 }}>{x.time}</span> : null}{x.title}
                  </span>
                ))}
                {d.items.length > 3 && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>+{d.items.length - 3} more</span>}
              </button>
            ))}
          </section>

          <section aria-label="Focus" style={{ ...CARD, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={label}>Focus today</div>
              <div className="val-num" style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{focusMin} min</div>
            </div>
            <button type="button" onClick={() => go('focus')} style={ghost}>Start a session</button>
          </section>

          {low.length > 0 && (
            <section aria-label="Running low" style={CARD}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={label}>Running low</div>
                <button type="button" onClick={() => go('essentials')} style={linkBtn}>Supplies</button>
              </div>
              {low.map(({ item, f }) => (
                <div key={item.id ?? item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14 }}>
                  <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  <span style={{ color: f.daysToReorder <= 0 ? '#e55a5a' : 'var(--text-secondary)', flexShrink: 0 }}>{f.daysToReorder <= 0 ? 'reorder now' : `reorder in ${plural(f.daysToReorder, 'day')}`}</span>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

const navBtn = { width: 36, height: 36, borderRadius: 10, border: '0.5px solid var(--card-border)', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' };
const ghost = { height: 36, padding: '0 14px', borderRadius: 10, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const linkBtn = { background: 'none', border: 'none', color: 'var(--tab-accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 4, fontFamily: 'inherit' };
const dot = (c) => ({ width: 5, height: 5, borderRadius: '50%', background: c, display: 'block' });
