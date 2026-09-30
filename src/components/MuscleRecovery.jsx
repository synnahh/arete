// Muscle recovery: which muscles are fresh, which are still recovering, and how
// many hard sets each has had this week against the usual 10-20. Built from your
// workout logs (rules and limits: src/domain/muscleRecovery.js). Advice only.
import { useMemo } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { muscleRecovery, summary, suggestSplitDay, WEEK_TARGET } from '../domain/muscleRecovery.js';
import { MUSCLE_IDS, MUSCLE_LABEL } from '../domain/muscles.js';
import { label } from './ui.js';

const STATUS = {
  worked: { colour: '#e25d7a', text: 'Worked today' },
  recovering: { colour: '#e8a13a', text: 'Recovering' },
  fresh: { colour: '#4caf7d', text: 'Ready' },
};
const list = (ids) => ids.map(id => MUSCLE_LABEL[id].toLowerCase()).join(', ');

export default function MuscleRecovery({ compact = false }) {
  const { items: logs = [] } = useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS);
  const today = toLocalDateKey(new Date());
  const map = useMemo(() => muscleRecovery(logs, today), [logs, today]);
  const sum = useMemo(() => summary(map), [map]);
  const split = useMemo(() => suggestSplitDay(map), [map]);
  const any = MUSCLE_IDS.some(id => map[id].daysSince != null);
  const card = { padding: compact ? 14 : 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 };

  if (!any) {
    return (
      <section aria-label="Muscle recovery" style={card}>
        <div style={label}>Muscle recovery</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Log a few workouts and Arete shows which muscles are ready to train and which need another day.</div>
      </section>
    );
  }

  return (
    <section aria-label="Muscle recovery" style={card}>
      <div style={label}>Muscle recovery</div>
      <div role="status" style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>
        {sum.rest.length ? <>Give {list(sum.rest)} another day. </> : 'Everything is ready. '}
        {split && split.freshShare > 0 ? <>Best fit today: <strong style={{ textTransform: 'capitalize' }}>{split.day}</strong>.</> : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 8 }}>
        {MUSCLE_IDS.map(id => {
          const r = map[id];
          const st = STATUS[r.status];
          const pct = Math.min(100, Math.round((r.sets7d / WEEK_TARGET.max) * 100));
          return (
            <div key={id} style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--hover-bg)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 999, background: st.colour, flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{MUSCLE_LABEL[id]}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {st.text}{r.daysSince != null && r.daysSince > 0 ? ` · ${r.daysSince} day${r.daysSince === 1 ? '' : 's'} ago` : r.daysSince == null ? ' · not in 2 weeks' : ''}
              </div>
              <div aria-hidden="true" style={{ height: 4, borderRadius: 999, background: 'var(--card-border)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: r.volume === 'on-target' ? '#4caf7d' : r.volume === 'high' ? '#e8a13a' : 'var(--text-secondary)' }} />
              </div>
              <div className="val-num" style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sets7d} sets this week{r.volume === 'low' ? ' · low' : r.volume === 'high' ? ' · high' : ''}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>A guide from your logged sets: about 48 to 72 hours between hard sessions for a muscle, and 10 to {WEEK_TARGET.max} sets a week. It cannot see how hard each set was.</div>
    </section>
  );
}
