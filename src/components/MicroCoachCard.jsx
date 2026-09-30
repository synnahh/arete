// Micro coach card: shared by the desktop and phone Nutrition screens.
// `advice` is the result of microCoach() in src/domain/micros.js.
export default function MicroCoachCard({ advice, style = {} }) {
  if (!advice || advice.status === 'no-data') return null;
  const ok = advice.status === 'ok';
  return (
    <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.07em' }}>MICRO COACH · LAST 7 DAYS</div>
      {advice.status === 'low-coverage' && (
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          Only {advice.coverage}% of the meals you logged carry micronutrient data ({advice.dataDays} day{advice.dataDays === 1 ? '' : 's'}), so gaps can't be judged yet. Search or scan foods, or tick supplements that list what they provide.
        </div>
      )}
      {ok && advice.gaps.length === 0 && advice.overs.length === 0 && (
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: '#4caf7d' }}>No consistent gaps across the nutrients your logs report. Nice.</div>
      )}
      {ok && advice.gaps.map(g => (
        <div key={g.key} style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>
          <strong style={{ color: '#e8a13a' }}>{g.label}</strong> averages {g.avgPct}% of the daily reference.
          {g.foods.length > 0 && <span style={{ color: 'var(--text-secondary)' }}> Try {g.foods.slice(0, 3).join(', ')}.</span>}
        </div>
      ))}
      {ok && advice.overs.map(o => (
        <div key={o.key} style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>
          <strong style={{ color: '#e55a5a' }}>{o.label}</strong> averages {o.avgPct}% of the daily limit.
        </div>
      ))}
      {ok && (
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Based on {advice.dataDays} days with micronutrient data ({advice.coverage}% of meals). General reference values, not medical advice.</div>
      )}
    </div>
  );
}
