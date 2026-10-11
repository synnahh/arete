// LogCalendar — a month of the days you logged, like the training calendar in STANCE.
// A filled day means you logged something; the ring marks today. Workout days get
// the strongest mark. Tap a day to see what was logged. Rules: domain/logCalendar.js.
import { useMemo, useState } from 'react';
import { monthGrid, shiftMonth, KIND_LABEL } from '../domain/logCalendar.js';
import { label } from './ui.js';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const KIND_COLOUR = { workout: 'var(--tab-accent)', food: '#52CC9C', sleep: '#A98FF2', weight: '#6FA8F2', habit: '#D8B26E' };

export default function LogCalendar({ data, compact = false }) {
  const [y, m] = data.today.split('-').map(Number);
  const [view, setView] = useState({ year: y, month: m - 1 });
  const [picked, setPicked] = useState(null);
  const grid = useMemo(() => monthGrid(view.year, view.month, data, data.today), [view, data]);
  const atNow = view.year === y && view.month === m - 1;
  const cell = picked ? grid.weeks.flat().find(c => c.key === picked) : null;
  const { loggedDays, workoutDays, daysInMonthSoFar } = grid.summary;

  const nav = { minWidth: 40, minHeight: 40, borderRadius: 10, border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' };

  return (
    <section aria-label="Logging calendar" style={{ padding: compact ? 14 : 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={label}>Calendar</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" aria-label="Previous month" onClick={() => { setView(v => shiftMonth(v, -1)); setPicked(null); }} style={nav}>‹</button>
          <div style={{ minWidth: 118, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{grid.title}</div>
          <button type="button" aria-label="Next month" disabled={atNow} onClick={() => { setView(v => shiftMonth(v, 1)); setPicked(null); }} style={{ ...nav, opacity: atNow ? 0.35 : 1, cursor: atNow ? 'default' : 'pointer' }}>›</button>
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
        {loggedDays} of {daysInMonthSoFar} days logged · {workoutDays} workout day{workoutDays === 1 ? '' : 's'}
      </div>

      <div role="grid" aria-label={grid.title} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {DOW.map((d, i) => <div key={i} role="columnheader" style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)', paddingBottom: 2 }}>{d}</div>)}
        {grid.weeks.flat().map(c => {
          const hasWorkout = c.kinds.includes('workout');
          const on = c.logged;
          return (
            <button
              key={c.key} type="button" role="gridcell" disabled={!c.inMonth || c.isFuture}
              aria-label={`${c.key}${on ? `, logged: ${c.kinds.map(k => KIND_LABEL[k]).join(', ')}` : ', nothing logged'}`}
              aria-pressed={picked === c.key} onClick={() => setPicked(picked === c.key ? null : c.key)}
              style={{
                position: 'relative', aspectRatio: '1 / 1', minHeight: 34, borderRadius: 10, fontFamily: 'var(--font-mono)', fontSize: 12.5, cursor: c.inMonth && !c.isFuture ? 'pointer' : 'default',
                border: c.isToday ? '1.5px solid var(--tab-accent)' : picked === c.key ? '1px solid var(--text-secondary)' : '0.5px solid transparent',
                background: !c.inMonth ? 'transparent' : hasWorkout ? 'var(--tab-accent)' : on ? 'color-mix(in srgb, var(--tab-accent) 22%, transparent)' : 'var(--hover-bg)',
                color: !c.inMonth ? 'transparent' : hasWorkout ? 'var(--on-tab-accent, #111)' : c.isFuture ? 'var(--text-secondary)' : 'var(--text-primary)',
                opacity: c.isFuture && c.inMonth ? 0.45 : 1,
              }}
            >
              {c.inMonth ? c.day : ''}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--text-secondary)' }}>
        <span><span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--tab-accent)', marginRight: 5 }} />Workout</span>
        <span><span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'color-mix(in srgb, var(--tab-accent) 22%, transparent)', marginRight: 5 }} />Other logs</span>
      </div>

      {cell && (
        <div role="status" style={{ paddingTop: 8, borderTop: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {new Date(`${cell.key}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          {cell.kinds.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nothing logged.</div> : (
            <>
              {cell.workouts.length > 0 && <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>Workout: {cell.workouts.join(', ')}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {cell.kinds.filter(k => k !== 'workout').map(k => (
                  <span key={k} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, border: `0.5px solid ${KIND_COLOUR[k]}`, color: KIND_COLOUR[k] }}>{KIND_LABEL[k]}</span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
