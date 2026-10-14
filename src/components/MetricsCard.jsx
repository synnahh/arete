// MetricsCard — the readings you care about, as quiet tiles on Home: steps, sleep, weight, heart,
// and whatever else Apple Health / the Fitbit / the scale send. You choose which tiles show and in
// what order (Edit); until you do, Home shows the first few that have a reading. Rules: domain/metrics.js.
import { useMemo, useState } from 'react';
import { useHealthHistory } from '../hooks/useHealthHistory.js';
import { useHealthData } from '../hooks/useHealthData.js';
import { useSettingsValue } from '../hooks/useSettingsValue.js';
import { updateSettings } from '../utils/settingsStore.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { buildMetrics, formatMetric, freshness, pickTiles, cleanMetricChoice, toggleMetric, moveMetric, DEFAULT_METRICS } from '../domain/metrics.js';
import { Collapse } from './Motion.jsx';
import { label } from './ui.js';

const small = { fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45 };
const GOOD = '#4caf7d', WARN = '#e8a13a';
const TONE_COLOUR = { good: GOOD, warn: WARN, flat: 'var(--text-secondary)' };

function Spark({ series, colour }) {
  if (series.length < 2) return null;
  const vs = series.map(p => p.v);
  const lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const pts = series.map((p, i) => [(i / (series.length - 1)) * 100, 28 - ((p.v - lo) / span) * 24]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 30, opacity: 0.4, pointerEvents: 'none' }}>
      <path d={`${line} L100 30 L0 30 Z`} fill={colour} opacity="0.12" stroke="none" />
      <path d={line} fill="none" stroke={colour} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pathLength="1" className="ui-draw" />
    </svg>
  );
}

function Tile({ t }) {
  const colour = TONE_COLOUR[t.tone];
  const accent = t.tone === 'flat' ? 'var(--tab-accent, var(--accent))' : colour;
  const delta = t.hasChange && t.change !== 0 ? `${t.change > 0 ? '▲' : '▼'} ${Math.abs(t.change).toLocaleString('en-AU')}` : null;
  const stale = t.daysAgo > 0;
  return (
    <div role="group" aria-label={`${t.label} ${formatMetric(t)} ${t.unit}`}
      style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 92, padding: '12px 12px 30px', borderRadius: 14, background: 'var(--hover-bg)', minWidth: 0 }}>
      <Spark series={t.series} colour={accent} />
      <div style={{ ...small, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', position: 'relative' }}>{t.label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0, position: 'relative' }}>
        <span className="val-num" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 24, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>{formatMetric(t)}</span>
        {t.unit && <span style={{ ...small, fontSize: 11.5 }}>{t.unit}</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: 11.5, position: 'relative', whiteSpace: 'nowrap' }}>
        {delta && <span style={{ color: colour }}>{delta}</span>}
        {stale && <span style={{ color: t.daysAgo > 2 ? WARN : 'var(--text-secondary)' }}>{freshness(t.daysAgo)}</span>}
      </div>
    </div>
  );
}

function Editor({ all, chosen, onChange }) {
  const shownIds = pickTiles(all, chosen).map(t => t.id);
  const hidden = all.filter(t => !shownIds.includes(t.id));
  const byId = new Map(all.map(t => [t.id, t]));
  const row = (id, on, i) => {
    const t = byId.get(id);
    return (
      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
        <input type="checkbox" checked={on} aria-label={`Show ${t.label}`} onChange={() => onChange(toggleMetric(shownIds, id, !on))} style={{ width: 20, height: 20 }} />
        <span style={{ flex: 1, fontSize: 14.5, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
        <span className="val-num" style={{ ...small, fontSize: 12 }}>{formatMetric(t)} {t.unit}</span>
        {on && <>
          <button type="button" aria-label={`Move ${t.label} up`} disabled={i === 0} onClick={() => onChange(moveMetric(shownIds, id, -1))} className="ui-btn is-sm is-icon">↑</button>
          <button type="button" aria-label={`Move ${t.label} down`} disabled={i === shownIds.length - 1} onClick={() => onChange(moveMetric(shownIds, id, 1))} className="ui-btn is-sm is-icon">↓</button>
        </>}
      </div>
    );
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 4 }}>
      <div style={small}>Tick what you want on Home and use the arrows to order it. New readings from your phone, watch and scale appear in this list on their own.</div>
      {shownIds.map((id, i) => row(id, true, i))}
      {hidden.length > 0 && <div style={{ ...label, fontSize: 10, marginTop: 8 }}>Also available</div>}
      {hidden.map(t => row(t.id, false, 0))}
    </div>
  );
}

export default function MetricsCard({ compact = false }) {
  const { rows } = useHealthHistory(30);
  const health = useHealthData();
  const settings = useSettingsValue();
  const [editing, setEditing] = useState(false);
  const today = toLocalDateKey(new Date());
  const all = useMemo(
    () => buildMetrics({ health: rows, body: health.body.items || [], sleep: health.sleep.items || [], today }),
    [rows, health.body.items, health.sleep.items, today],
  );
  const chosen = cleanMetricChoice(settings?.home?.metrics);
  const shown = pickTiles(all, chosen);
  const save = (list) => updateSettings({ home: { ...(settings?.home || {}), metrics: list } });
  const usingDefault = chosen == null;

  return (
    <section aria-label="Metrics" className="ui-card" style={{ padding: compact ? 16 : 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={label}>Metrics</div>
        {all.length > 0 && <button type="button" onClick={() => setEditing(e => !e)} aria-expanded={editing} className={`ui-btn is-sm${editing ? ' is-soft' : ''}`}>{editing ? 'Done' : 'Edit'}</button>}
      </div>

      {all.length === 0 && (
        <div style={small}>Nothing yet. Weigh-ins and sleep show up as you log them. Connect Apple Health (your Fitbit and scale feed it) and steps, heart rate, HRV and every other reading appear here by themselves.</div>
      )}

      <Collapse open={editing}><Editor all={all} chosen={chosen} onChange={save} /></Collapse>

      {all.length > 0 && shown.length === 0 && !editing && <div style={small}>No metrics selected. Tap Edit to choose some.</div>}
      {shown.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {shown.map(t => <Tile key={t.id} t={t} />)}
        </div>
      )}
      {usingDefault && all.length > shown.length && !editing && <div style={small}>Showing {shown.length} of {all.length}. Tap Edit to pick your own.</div>}
    </section>
  );
}

export { DEFAULT_METRICS };
