// FitbitRead — what Arete can see from the Fitbit Air / phone / scale data and what it concludes,
// with no AI: baselines and trends from domain/fitbitCoach.js. The proposals that follow from it
// (go lighter today, calories, split) appear in Coach updates with a reason and Undo.
import { useMemo } from 'react';
import { useHealthHistory } from '../hooks/useHealthHistory.js';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { fitbitRead } from '../domain/fitbitCoach.js';
import { label } from './ui.js';

const TONE = { good: '#4caf7d', warn: '#e8a13a', flat: 'var(--text-muted)' };

export default function FitbitRead() {
  const today = toLocalDateKey(new Date());
  const { rows } = useHealthHistory(35);
  const sleep = useCollection('sleep_data', STORAGE_KEYS.SLEEP);
  const read = useMemo(() => fitbitRead({ health: rows, sleep: sleep.items || [], today }), [rows, sleep.items, today]);

  return (
    <section aria-label="What Arete reads from your Fitbit" style={{ padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={label}>What Arete reads from your Fitbit</div>
      {read.days === 0 && !read.lines.length ? (
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>Nothing has arrived yet. Follow the Health sync setup guide on Profile; once readings flow in, this page shows your baselines and the coach starts adjusting your training and calories from them.</div>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{read.days} day{read.days === 1 ? '' : 's'} of readings in the last month</div>
          {read.lines.map(l => (
            <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: TONE[l.tone], flexShrink: 0, transform: 'translateY(-1px)' }} />
              <span style={{ fontSize: 14, color: 'var(--text-primary)' }}><b style={{ fontWeight: 600 }}>{l.label}:</b> <span style={{ color: 'var(--text-secondary)' }}>{l.text}</span></span>
            </div>
          ))}
          {read.missing.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>Not enough yet for: {read.missing.join(', ')}.</div>}
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>The coach uses these to suggest a lighter day when resting heart rate, HRV or sleep slip, to check your calories against your real activity, and to cut a training day if resting heart rate keeps climbing. You approve each change.</div>
        </>
      )}
    </section>
  );
}
