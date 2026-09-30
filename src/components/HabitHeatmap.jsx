// Habit heatmap: the last 12 weeks, one square a day, darker the more of your
// habits you did. Rules and the "days before you started are blank" logic:
// src/domain/habits.js heatmap().
import { useMemo } from 'react';
import { heatmap } from '../domain/habits.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { label } from './ui.js';

// Explicit lookup: Tailwind would purge interpolated class names, and these are inline styles anyway.
const FILL = {
  0: 'var(--hover-bg)',
  1: 'color-mix(in srgb, var(--tab-accent) 28%, transparent)',
  2: 'color-mix(in srgb, var(--tab-accent) 50%, transparent)',
  3: 'color-mix(in srgb, var(--tab-accent) 75%, transparent)',
  4: 'var(--tab-accent)',
};
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const fmt = (key) => new Date(key + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function HabitHeatmap({ habits, weeks = 12 }) {
  const today = toLocalDateKey(new Date());
  const map = useMemo(() => heatmap(habits, today, { weeks }), [habits, today, weeks]);
  if (!map.trackedDays) return null;

  const summary = `${map.perfectDays} perfect day${map.perfectDays === 1 ? '' : 's'} and ${map.activeDays} active day${map.activeDays === 1 ? '' : 's'} out of ${map.trackedDays} tracked in the last ${weeks} weeks`;
  return (
    <section aria-label="Habit history" style={{ padding: 14, borderRadius: 14, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={label}>Last {weeks} weeks</div>
      <div role="img" aria-label={summary} style={{ display: 'flex', gap: 4 }}>
        <div aria-hidden="true" style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gap: 3, fontSize: 9.5, color: 'var(--text-secondary)', paddingTop: 0 }}>
          {DAY_LETTERS.map((d, i) => <span key={i} style={{ height: 'clamp(11px, 3.4vw, 16px)', display: 'flex', alignItems: 'center' }}>{i % 2 === 0 ? d : ''}</span>)}
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${map.weeks.length}, 1fr)`, gap: 3 }}>
          {map.weeks.map((col, w) => (
            <div key={w} style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gap: 3 }}>
              {col.map(c => (
                <span key={c.date} title={c.level == null ? fmt(c.date) : `${fmt(c.date)}: ${c.done} of ${c.total}`} style={{
                  height: 'clamp(11px, 3.4vw, 16px)', borderRadius: 3,
                  background: c.level == null ? 'transparent' : FILL[c.level],
                  border: c.level == null ? (c.future ? 'none' : '0.5px dashed var(--card-border)') : 'none',
                }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span className="val-num" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>{map.perfectDays}</strong> perfect · <strong style={{ color: 'var(--text-primary)' }}>{map.activeDays}</strong> active of {map.trackedDays} days
        </span>
        <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--text-secondary)' }}>
          Less {[0, 1, 2, 3, 4].map(l => <span key={l} style={{ width: 11, height: 11, borderRadius: 3, background: FILL[l] }} />)} More
        </span>
      </div>
    </section>
  );
}
