//  WeightChart  daily weigh-ins as dots and the smoothed trend as a line.
//  Plain SVG on the theme's variables (accent follows the tab colour).
import { useMemo } from 'react';
import { useWidth } from '../hooks/useWidth.js';

const H = 200, PAD = { l: 38, r: 12, t: 12, b: 24 };

export default function WeightChart({ series, days = 60 }) {
  // Drawn at its real width, so labels stay 11px on any window size.
  const [box, W] = useWidth(640);
  const pts = useMemo(() => series.slice(-days), [series, days]);
  const geo = useMemo(() => {
    if (pts.length < 2) return null;
    const values = pts.flatMap(p => [p.weight, p.trend]);
    let lo = Math.min(...values), hi = Math.max(...values);
    const pad = Math.max(0.5, (hi - lo) * 0.15);
    lo -= pad; hi += pad;
    const t0 = Date.parse(pts[0].date), t1 = Date.parse(pts[pts.length - 1].date);
    const x = (d) => PAD.l + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
    const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const ticks = [lo, (lo + hi) / 2, hi].map(v => ({ v, y: y(v) }));
    return { x, y, ticks, line: pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.trend).toFixed(1)}`).join(' ') };
  }, [pts, W]);

  if (!geo) return <div ref={box} />;
  const last = pts[pts.length - 1];

  return (
    <div ref={box} style={{ width: '100%' }}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" style={{ display: 'block' }}
      aria-label={`Weight over ${pts.length} weigh-ins. Latest ${last.weight} kilograms, trend ${last.trend} kilograms.`}>
      {geo.ticks.map(t => (
        <g key={t.v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="var(--card-border)" strokeWidth="1" />
          <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fontSize="11" fill="var(--text-secondary)" style={{ fontFamily: 'var(--font-mono)' }}>{t.v.toFixed(1)}</text>
        </g>
      ))}
      {pts.map(p => <circle key={p.date} cx={geo.x(p.date)} cy={geo.y(p.weight)} r="2.6" fill="var(--text-secondary)" opacity="0.55" />)}
      {/* Keyed by the data (not the width), so the trend redraws when the range changes but not on resize. */}
      <path key={`${pts.length}:${pts[0].date}:${last.date}`} className="ui-draw" pathLength="1" d={geo.line} fill="none" stroke="var(--tab-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle key={`end:${last.date}`} className="ui-fade-late" cx={geo.x(last.date)} cy={geo.y(last.trend)} r="4.5" fill="var(--tab-accent)" />
      <text x={PAD.l} y={H - 6} fontSize="11" fill="var(--text-secondary)" style={{ fontFamily: 'var(--font-mono)' }}>{pts[0].date.slice(5)}</text>
      <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="11" fill="var(--text-secondary)" style={{ fontFamily: 'var(--font-mono)' }}>{last.date.slice(5)}</text>
    </svg>
    </div>
  );
}
