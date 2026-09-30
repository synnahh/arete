// Strength Score: your main lifts against bodyweight, as one number, plus which
// lift trails. Rough yardstick, not a verdict (see the note in domain/strength.js).
import { useMemo } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { weightCoach } from '../domain/weight.js';
import { strengthScore } from '../domain/strength.js';
import { label } from './ui.js';


export default function StrengthCard({ logs }) {
  const { items: bodyMetrics = [] } = useCollection('body_metrics', STORAGE_KEYS.BODY);
  const today = toLocalDateKey(new Date());
  const bodyweight = useMemo(() => weightCoach(bodyMetrics)?.trend ?? null, [bodyMetrics]);
  const result = useMemo(() => strengthScore(logs, bodyweight, today), [logs, bodyweight, today]);

  return (
    <details style={{ padding: '4px 14px', borderRadius: 14, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)' }}>
      <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, listStyle: 'none' }}>
        <span style={label}>Strength score</span>
        <span className="val-num" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {result ? <><strong style={{ fontSize: 18, color: 'var(--tab-accent)' }}>{result.score}</strong> · {result.level}</> : 'Not enough data yet'}
        </span>
      </summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0 14px' }}>
        {!result && (
          <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            {bodyweight ? 'Log a barbell bench, squat, deadlift, overhead press or row and Arete scores it against your bodyweight.' : 'Log your bodyweight (Coach > Body) and a main barbell lift to get a score.'}
          </div>
        )}
        {result && result.lifts.map(l => (
          <div key={l.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-primary)' }}>{l.label}</span>
              <span className="val-num" style={{ color: 'var(--text-secondary)' }}>{l.e1rm} kg · {l.ratio}× bodyweight · {l.level}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--hover-bg)', overflow: 'hidden' }} role="img" aria-label={`${l.label} score ${l.score} of 100`}>
              <div style={{ width: `${l.score}%`, height: '100%', background: result.weakest?.key === l.key ? '#e8a13a' : 'var(--tab-accent)' }} />
            </div>
          </div>
        ))}
        {result?.weakest && (
          <div role="status" style={{ fontSize: 13, lineHeight: 1.5, color: '#e8a13a' }}>
            Your {result.weakest.label.toLowerCase()} trails your other lifts. It is the best place to add work.
          </div>
        )}
        {result && (
          <div style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
            Estimated max in the last 6 months against a rough adult-male bodyweight scale (bodyweight {result.bodyweightKg} kg). A guide for your own progress, not a ranking.
          </div>
        )}
      </div>
    </details>
  );
}
