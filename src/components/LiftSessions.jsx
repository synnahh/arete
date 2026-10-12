// LiftSessions — an exercise's history as dated sets, newest first, the way a gym log
// reads: each day shows its sets as reps at weight. Data: sessionsOf() in
// domain/progression.js. (The chart above it shows the trend; this is the detail.)
const when = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); };
const kg = (w) => (Number.isInteger(w) ? w : Math.round(w * 10) / 10);

export default function LiftSessions({ sessions = [], limit = 8 }) {
  if (!sessions.length) return null;
  const shown = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {shown.map(s => (
        <div key={s.date}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{when(s.date)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: 6 }}>
            {s.sets.map((x, i) => (
              <div key={i} style={{ padding: '6px 8px', borderRadius: 10, background: 'var(--hover-bg)', textAlign: 'center' }}>
                <div className="val-num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{x.reps}</div>
                <div className="val-num" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{x.weight > 0 ? `${kg(x.weight)} kg` : 'bodyweight'}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {sessions.length > limit && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Showing the last {limit} of {sessions.length} sessions.</div>}
    </div>
  );
}
