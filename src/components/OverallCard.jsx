// Overall: one long-run rating that rises with what you do (rules and what it
// counts: src/domain/overall.js). It moves slowly on purpose: 28 days against
// the 28 before.
import { useOverall } from '../hooks/useOverall.js';
import { label } from './ui.js';

const PILLAR_LABEL = { training: 'Training', fuel: 'Fuel', sleep: 'Sleep', habits: 'Habits', body: 'Weigh-ins' };
const TIP = {
  training: 'Training is your biggest lever: one more session a week lifts it most.',
  fuel: 'Logging food on more days lifts it fastest, and landing near your calorie target.',
  sleep: 'Logging sleep every night and getting closer to your sleep need lifts it.',
  habits: 'Ticking your habits on more days lifts it.',
  body: 'A weigh-in every week keeps it full.',
};
const TIER_COLOUR = { elite: '#4caf7d', gold: '#e8a13a', silver: '#9aa4b2', bronze: '#c08457' };

export default function OverallCard({ compact = false }) {
  const o = useOverall();
  const card = { padding: compact ? 14 : 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 };

  if (!o) {
    return (
      <section aria-label="Overall rating" style={card}>
        <div style={label}>Overall</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Log workouts, food, sleep or habits for a couple of weeks and Arete gives you an overall rating.</div>
      </section>
    );
  }

  const colour = TIER_COLOUR[o.tier.id];
  const entries = Object.entries(o.pillars);
  const weakest = [...entries].sort((a, b) => a[1] - b[1])[0];
  return (
    <section aria-label="Overall rating" style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 78, height: 78, borderRadius: 18, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${colour}`, background: `color-mix(in srgb, ${colour} 12%, transparent)` }}>
          <span className="val-num" style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: colour }}>{o.ovr}</span>
          <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: colour }}>{o.tier.label}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={label}>Overall</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
            {o.delta == null ? 'Your first month of data. Check back as it builds.' : o.delta > 0 ? `Up ${o.delta} on the month before.` : o.delta < 0 ? `Down ${-o.delta} on the month before.` : 'Level with the month before.'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span style={{ width: 78, color: 'var(--text-primary)' }}>{PILLAR_LABEL[k]}</span>
            <span aria-hidden="true" style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--hover-bg)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${Math.round(v * 100)}%`, background: colour }} />
            </span>
            <span className="val-num" style={{ width: 34, textAlign: 'right', color: 'var(--text-secondary)' }}>{Math.round(v * 100)}</span>
          </div>
        ))}
      </div>
      {weakest && weakest[1] < 0.85 && <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{TIP[weakest[0]]}</div>}
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>The last 28 days of what you logged. A guide to consistency, not to health or physique.</div>
    </section>
  );
}
