// Phone Habits: tick today, watch the streak, see the week. Same `habits`
// collection and streak rules as desktop (src/domain/habits.js).
import { useMemo, useRef, useState } from 'react';
import { useCollection } from '../../supabase/useCollection.js';
import { STORAGE_KEYS } from '../../utils/storage.js';
import { toLocalDateKey } from '../../utils/localDate.js';
import { haptics } from '../utils/haptics.js';
import Sheet from '../Sheet.jsx';
import { isDone, currentStreak, bestStreak, toggleDay, weekDots, completionRate, todayProgress } from '../../domain/habits.js';

const ICONS = ['💧', '🏋️', '🥗', '📖', '🧘', '😴', '🚶', '🧴', '💊', '☕', '🎯', '✅'];
const IDEAS = ['Drink 3 L of water', 'Lift or train', 'Walk 10 minutes', 'Read 10 pages', 'Skincare AM and PM', 'In bed by 10:30', 'No caffeine after 2pm'];

const card = { background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', borderRadius: 14 };
const input = { width: '100%', boxSizing: 'border-box', height: 44, padding: '0 12px', borderRadius: 10, background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 15 };
const primary = { minHeight: 48, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, background: 'var(--tab-accent)', color: 'var(--on-tab-accent)', WebkitTapHighlightColor: 'transparent' };
const ghost = { minHeight: 44, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, background: 'transparent', border: '0.5px solid var(--card-border)', color: 'var(--text-secondary)', WebkitTapHighlightColor: 'transparent' };
const label = { fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)' };

function HabitSheet({ habit, onSave, onDelete, onClose }) {
  const [name, setName] = useState(habit?.name ?? '');
  const [icon, setIcon] = useState(habit?.icon || ICONS[0]);
  const save = () => { if (name.trim()) onSave({ name: name.trim(), icon }); };

  return (
    <Sheet title={habit ? 'Edit habit' : 'New habit'} onClose={onClose}>
      <input aria-label="Habit name" placeholder="e.g. No caffeine after 2pm" value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); }} style={input} autoFocus={!habit} />
      <div style={label}>Icon</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {ICONS.map(ic => (
          <button key={ic} type="button" aria-pressed={icon === ic} aria-label={`Icon ${ic}`} onClick={() => setIcon(ic)} style={{
            width: 44, height: 44, borderRadius: 12, fontSize: 20, cursor: 'pointer',
            border: `1.5px solid ${icon === ic ? 'var(--tab-accent)' : 'var(--card-border)'}`,
            background: icon === ic ? 'color-mix(in srgb, var(--tab-accent) 14%, transparent)' : 'transparent',
          }}>{ic}</button>
        ))}
      </div>
      {!habit && (
        <>
          <div style={label}>Ideas</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {IDEAS.map(i => (
              <button key={i} type="button" onClick={() => setName(i)} style={{ ...ghost, minHeight: 36, padding: '0 12px', fontSize: 13 }}>{i}</button>
            ))}
          </div>
        </>
      )}
      <button type="button" onClick={save} disabled={!name.trim()} style={{ ...primary, opacity: name.trim() ? 1 : 0.5 }}>{habit ? 'Save' : 'Add habit'}</button>
      {habit && <button type="button" onClick={onDelete} style={{ ...ghost, color: '#e55a5a', borderColor: '#e55a5a' }}>Delete habit</button>}
    </Sheet>
  );
}

export default function MobileHabits() {
  const { items: habits = [], add, update, remove } = useCollection('habits', STORAGE_KEYS.HABITS);
  const today = toLocalDateKey(new Date());
  const [sheet, setSheet] = useState(null); // null | 'new' | habit
  const busy = useRef(new Set());

  const prog = useMemo(() => todayProgress(habits, today), [habits, today]);
  const topStreak = useMemo(() => habits.reduce((m, h) => Math.max(m, currentStreak(h, today)), 0), [habits, today]);

  async function tick(h) {
    if (busy.current.has(h.id)) return;
    busy.current.add(h.id);
    if (!isDone(h, today)) haptics.success(); else haptics.tap();
    try { await update(h.id, toggleDay(h, today)); }
    finally { busy.current.delete(h.id); }
  }

  async function saveSheet(fields) {
    if (sheet && sheet !== 'new') await update(sheet.id, fields);
    else await add({ ...fields, frequency: 'daily', streak: 0, lastCompleted: '', history: [], best: 0 });
    setSheet(null);
  }

  async function deleteHabit() {
    if (!window.confirm(`Delete "${sheet.name}" and its streak? This can't be undone.`)) return;
    await remove(sheet.id);
    setSheet(null);
  }

  const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <div style={label}>Today</div>
            <div className="val-num" style={{ fontSize: 34, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {prog.done}<span style={{ fontSize: 18, color: 'var(--text-secondary)' }}> / {prog.total}</span>
            </div>
          </div>
          {topStreak > 0 && <div className="val-num" style={{ fontSize: 13, color: 'var(--tab-accent)' }}>{'🔥'} best run {topStreak}d</div>}
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--hover-bg)', overflow: 'hidden' }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Habits done today">
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--tab-accent)', transition: 'width 0.3s var(--ease-out)' }} />
        </div>
        {prog.total > 0 && prog.done === prog.total && <div role="status" style={{ fontSize: 13, color: 'var(--tab-accent)' }}>Every habit done today.</div>}
      </div>

      {habits.length === 0 && (
        <div style={{ ...card, padding: 28, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.5 }}>
          No habits yet. Start with one or two you will actually do every day.
        </div>
      )}

      {habits.map(h => {
        const done = isDone(h, today);
        const streak = currentStreak(h, today);
        const best = bestStreak(h);
        const rate = completionRate(h, today);
        return (
          <div key={h.id} style={{ ...card, padding: 12, display: 'flex', alignItems: 'center', gap: 12, borderColor: done ? 'var(--tab-accent)' : 'var(--card-border)' }}>
            <button type="button" aria-pressed={done} aria-label={`${h.name}: ${done ? 'done today, tap to undo' : 'mark done'}`} onClick={() => tick(h)} style={{
              width: 48, height: 48, borderRadius: 999, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: done ? 'none' : '2px solid var(--card-border)', background: done ? 'var(--tab-accent)' : 'transparent', color: 'var(--on-tab-accent)',
              transition: 'transform 0.15s var(--ease-spring), background 0.2s', WebkitTapHighlightColor: 'transparent',
            }}>
              {done && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5 10 17l9-10" /></svg>}
            </button>
            <button type="button" onClick={() => setSheet(h)} aria-label={`Edit ${h.name}`} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent' }}>
              <div style={{ fontSize: 15, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span aria-hidden="true">{h.icon} </span>{h.name}
              </div>
              <div className="val-num" style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                {streak > 0 ? `${streak} day streak` : 'No streak yet'}{best > streak ? ` · best ${best}` : ''}{rate != null ? ` · ${rate}% of 30d` : ''}
              </div>
              <div style={{ display: 'flex', gap: 5, marginTop: 7 }} aria-hidden="true">
                {weekDots(h, today).map(d => (
                  <span key={d.date} style={{
                    width: 12, height: 12, borderRadius: 999,
                    background: d.done ? 'var(--tab-accent)' : 'transparent',
                    border: `1.5px solid ${d.done ? 'var(--tab-accent)' : d.isToday ? 'var(--text-secondary)' : 'var(--card-border)'}`,
                  }} />
                ))}
              </div>
            </button>
          </div>
        );
      })}

      <button type="button" onClick={() => setSheet('new')} style={primary}>+ Add habit</button>

      {sheet && <HabitSheet habit={sheet === 'new' ? null : sheet} onSave={saveSheet} onDelete={deleteHabit} onClose={() => setSheet(null)} />}
    </div>
  );
}
