// MetricsCard — every number the body and the phone report, as tiles on Home: steps, heart rate,
// HRV, sleep, weight, body fat and whatever else Apple Health / the Fitbit / the scale send.
// Nothing is configured: a tile appears when its first reading arrives. Rules: domain/metrics.js.
import { useMemo } from 'react';
import { useHealthHistory } from '../hooks/useHealthHistory.js';
import { useHealthData } from '../hooks/useHealthData.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { buildMetrics, formatMetric, freshness, GROUP_ORDER } from '../domain/metrics.js';
import { label } from './ui.js';

const small = { fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45 };
const TONE = { good: '#4caf7d', warn: '#e8a13a', flat: 'var(--text-secondary)' };

function Spark({ series, colour }) {
  if (series.length < 2) return <div style={{ height: 28 }} aria-hidden="true" />;
  const vs = series.map(p => p.v);
  const lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const pts = series.map((p, i) => [(i / (series.length - 1)) * 100, 26 - ((p.v - lo) / span) * 22]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" width="100%" height="28" aria-hidden="true" style={{ overflow: 'visible' }}>
      <path d={d} fill="none" stroke={colour} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pathLength="1" className="ui-draw" />
    </svg>
  );
}

function Tile({ t }) {
  const colour = TONE[t.tone];
  const arrow = t.change > 0 ? '▲' : t.change < 0 ? '▼' : '•';
  const stale = t.daysAgo > 2;
  return (
    <div role="group" aria-label={`${t.label} ${formatMetric(t)} ${t.unit}`} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 12px 10px', borderRadius: 14, border: '0.5px solid var(--card-border)', background: 'var(--bg-base)', minWidth: 0, opacity: stale ? 0.75 : 1 }}>
      <div style={{ ...small, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
        <span className="val-num" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 24, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>{formatMetric(t)}</span>
        {t.unit && <span style={{ ...small, fontSize: 12 }}>{t.unit}</span>}
      </div>
      <Spark series={t.series} colour={colour === TONE.flat ? 'var(--tab-accent, var(--accent))' : colour} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
        <span style={{ color: colour }}>{t.hasChange ? `${arrow} ${t.change === 0 ? 'steady' : Math.abs(t.change).toLocaleString('en-AU')}` : 'first reading'}</span>
        <span style={{ color: stale ? '#e8a13a' : undefined }}>{freshness(t.daysAgo)}</span>
      </div>
    </div>
  );
}

export default function MetricsCard({ compact = false }) {
  const { rows } = useHealthHistory(30);
  const health = useHealthData();
  const today = toLocalDateKey(new Date());
  const tiles = useMemo(
    () => buildMetrics({ health: rows, body: health.body.items || [], sleep: health.sleep.items || [], today }),
    [rows, health.body.items, health.sleep.items, today],
  );
  const groups = GROUP_ORDER.map(g => [g, tiles.filter(t => t.group === g)]).filter(([, xs]) => xs.length);
  const hasPhoneData = rows.length > 0;

  return (
    <section aria-label="Metrics" className="ui-card" style={{ padding: compact ? 16 : 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={label}>Metrics</div>
        <span style={small}>{tiles.length ? `${tiles.length} tracked · vs your last 7 days` : ''}</span>
      </div>
      {tiles.length === 0 ? (
        <div style={small}>
          Nothing to show yet. Weigh-ins and sleep appear here as you log them. Connect Apple Health (the Fitbit and the scale feed it) and steps, heart rate, HRV and every other metric appear on their own.
        </div>
      ) : groups.map(([g, xs]) => (
        <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ ...label, fontSize: 10 }}>{g}</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 136 : 160}px, 1fr))`, gap: 10 }}>
            {xs.map(t => <Tile key={t.id} t={t} />)}
          </div>
        </div>
      ))}
      {tiles.length > 0 && !hasPhoneData && (
        <div style={small}>Steps, heart rate and HRV will join these once Apple Health sync is connected.</div>
      )}
    </section>
  );
}
