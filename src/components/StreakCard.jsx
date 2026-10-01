// StreakCard — the logging streak (rules: src/domain/recap.js). A day counts when you
// logged anything; today does not break it until the day is over. On the day a
// milestone is reached the number does a short scale-in (transform/opacity only,
// skipped when animation is reduced).
import { label } from './ui.js';

export default function StreakCard({ streak, compact = false }) {
  if (!streak) return null;
  const { current, best, next, active, justReached, milestone } = streak;
  const toGo = next != null ? next - current : null;
  const pct = next != null ? Math.min(100, Math.round((current / next) * 100)) : 100;
  return (
    <section aria-label="Logging streak" style={{ padding: compact ? 14 : 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={label}>Logging streak</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Best {best} day{best === 1 ? '' : 's'}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className={justReached ? 'streak-pop' : undefined} style={{ fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 700, lineHeight: 1, color: current > 0 ? 'var(--tab-accent)' : 'var(--text-secondary)' }}>{current}</span>
        <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>day{current === 1 ? '' : 's'} in a row</span>
      </div>
      {next != null && (
        <>
          <div aria-hidden="true" style={{ height: 6, borderRadius: 999, background: 'var(--hover-bg)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--tab-accent)' }} />
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            {justReached ? `${milestone} days. ` : ''}{toGo} more day{toGo === 1 ? '' : 's'} to reach {next}.
          </div>
        </>
      )}
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
        {active ? 'You have logged something today.' : current > 0 ? 'Log anything today to keep it going.' : 'Log a workout, a meal, sleep, a weigh-in or a habit to start one.'}
      </div>
    </section>
  );
}
