// TrendChart — one series as a line or as bars, drawn at its real width so the
// text stays at its real size. Plain SVG on the theme variables. Gaps are not
// joined across missing days when the points are far apart.
import { useMemo } from 'react';
import { useWidth } from '../hooks/useWidth.js';

const H = 170, PAD = { l: 44, r: 12, t: 12, b: 24 };
const mono = { fontFamily: 'var(--font-mono)' };

const fmt = (v, digits) => (digits === 0 ? Math.round(v).toLocaleString() : v.toFixed(digits));

export default function TrendChart({ points, kind = 'line', unit = '', digits = 1, target = null, ariaLabel }) {
  const [box, W] = useWidth(520);
  const geo = useMemo(() => {
    if (!points || !points.length) return null;
    const values = points.map(p => p.value);
    let lo = Math.min(...values, ...(target != null ? [target] : [])), hi = Math.max(...values, ...(target != null ? [target] : []));
    if (kind === 'bar') lo = 0;
    const pad = kind === 'bar' ? 0 : Math.max(digits === 0 ? 20 : 0.3, (hi - lo) * 0.15);
    lo -= pad; hi += pad;
    if (hi === lo) { hi += 1; lo -= 1; }
    const t0 = Date.parse(points[0].date), t1 = Date.parse(points[points.length - 1].date);
    const inner = W - PAD.l - PAD.r;
    const x = (d) => (t1 === t0 ? PAD.l + inner / 2 : PAD.l + ((Date.parse(d) - t0) / (t1 - t0)) * inner);
    const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const ticks = [lo, (lo + hi) / 2, hi].map(v => ({ v, y: y(v) }));
    const barW = Math.max(3, Math.min(22, (inner / Math.max(points.length, 1)) * 0.6));
    return { x, y, ticks, barW, line: points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ') };
  }, [points, W, kind, target, digits]);

  if (!geo) return <div ref={box} />;
  const last = points[points.length - 1];
  return (
    <div ref={box} style={{ width: '100%' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" style={{ display: 'block' }}
        aria-label={ariaLabel || `${points.length} points, latest ${fmt(last.value, digits)} ${unit}`}>
        {geo.ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="var(--card-border)" strokeWidth="1" />
            <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fontSize="11" fill="var(--text-secondary)" style={mono}>{fmt(Math.max(t.v, 0), digits)}</text>
          </g>
        ))}
        {target != null && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(target)} y2={geo.y(target)} stroke="var(--text-secondary)" strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />
            <text x={W - PAD.r} y={geo.y(target) - 4} textAnchor="end" fontSize="11" fill="var(--text-secondary)" style={mono}>target {fmt(target, digits)}</text>
          </g>
        )}
        {kind === 'bar'
          ? points.map(p => <rect key={p.date} x={geo.x(p.date) - geo.barW / 2} y={geo.y(p.value)} width={geo.barW} height={Math.max(1, geo.y(0) - geo.y(p.value))} rx="2" fill="var(--tab-accent)" opacity="0.9" />)
          : (
            <>
              {points.length > 1 && <path d={geo.line} fill="none" stroke="var(--tab-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
              {points.map(p => <circle key={p.date} cx={geo.x(p.date)} cy={geo.y(p.value)} r={points.length > 40 ? 1.8 : 3} fill="var(--tab-accent)" />)}
            </>
          )}
        <text x={PAD.l} y={H - 6} fontSize="11" fill="var(--text-secondary)" style={mono}>{points[0].date.slice(5)}</text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="11" fill="var(--text-secondary)" style={mono}>{last.date.slice(5)}</text>
      </svg>
    </div>
  );
}
