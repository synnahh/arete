// A lift's estimated 1RM over time: one dot per training day, a line through
// them, and the best one marked. Data: liftHistory() in domain/progression.js.
const W = 300, H = 92, PAD_X = 10, PAD_TOP = 10, PAD_BOTTOM = 16;

export default function LiftChart({ history, label = 'Estimated max' }) {
  if (!history || history.length < 2) {
    return <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Log this lift on two different days to see its trend.</div>;
  }
  const vals = history.map(h => h.e1rm);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = Math.max(hi - lo, 1);
  const x = (i) => PAD_X + (i / (history.length - 1)) * (W - PAD_X * 2);
  const y = (v) => PAD_TOP + (1 - (v - lo) / span) * (H - PAD_TOP - PAD_BOTTOM);
  const bestIdx = vals.lastIndexOf(hi);
  const points = history.map((h, i) => `${x(i).toFixed(1)},${y(h.e1rm).toFixed(1)}`).join(' ');
  const first = history[0], last = history[history.length - 1];
  const change = +(last.e1rm - first.e1rm).toFixed(1);
  const summary = `${label}: ${first.e1rm} kg on ${first.date}, ${last.e1rm} kg on ${last.date}, best ${hi} kg`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} style={{ width: '100%', height: 'auto', maxHeight: 130 }}>
        <polyline points={points} fill="none" stroke="var(--tab-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {history.map((h, i) => (
          <circle key={h.date} cx={x(i)} cy={y(h.e1rm)} r={i === bestIdx ? 4.5 : 2.5}
            fill={i === bestIdx ? 'var(--tab-accent)' : 'var(--bg-panel)'} stroke="var(--tab-accent)" strokeWidth="1.5" />
        ))}
        <text x={x(bestIdx)} y={Math.max(9, y(hi) - 7)} fontSize="9" textAnchor={bestIdx > history.length * 0.8 ? 'end' : 'middle'} fill="var(--text-primary)" style={{ fontFamily: 'var(--font-mono)' }}>{hi}</text>
        <text x={PAD_X} y={H - 3} fontSize="8.5" fill="var(--text-secondary)">{first.date.slice(5)}</text>
        <text x={W - PAD_X} y={H - 3} fontSize="8.5" textAnchor="end" fill="var(--text-secondary)">{last.date.slice(5)}</text>
      </svg>
      <div className="val-num" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        {label}: <strong style={{ color: 'var(--text-primary)' }}>{last.e1rm} kg</strong> now · best {hi} kg ·{' '}
        <span style={{ color: change >= 0 ? '#4caf7d' : '#e25d7a' }}>{change > 0 ? '+' : ''}{change} kg</span> over {history.length} sessions
      </div>
    </div>
  );
}
