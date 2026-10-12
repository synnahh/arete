// RednessAzelaic — the guide's barrier-first rosacea plan: a weekly redness score (0-10) and
// azelaic acid introduced only after 14 calm days, on two non-consecutive nights, building
// only if skin tolerates it. You confirm "calm"; the app does not guess it. Rules: domain/rosacea.js.
import { useMemo, useState } from 'react';
import { label } from './ui.js';
import { newStep } from '../domain/skin.js';
import { rednessTrend, rednessReadings, azelaicPlan, validRedness, AZELAIC_NAME, AZELAIC_NIGHTS } from '../domain/rosacea.js';

const card = { padding: 16, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 };
const btn = { minHeight: 44, padding: '0 16px', borderRadius: 12, border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
const small = { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 };

export default function RednessAzelaic({ rows, todayRow, todayKey, steps, profile, routineStart, onRate, onSteps }) {
  const [calm, setCalm] = useState(false);
  const trend = useMemo(() => rednessTrend(rows, todayKey), [rows, todayKey]);
  const last = useMemo(() => rednessReadings(rows).slice(-1)[0] || null, [rows]);
  const azelaicStart = profile?.azelaicStart || null;
  const hasStep = steps.some(s => /azelaic/i.test(s.name));
  const plan = azelaicPlan({ routineStart, azelaicStart, today: todayKey });
  const current = todayRow?.redness ?? '';

  const add = async () => {
    if (hasStep) return;
    await onSteps([...steps, { ...newStep(AZELAIC_NAME, 'pm'), days: [...AZELAIC_NIGHTS.start] }], { azelaicStart: todayKey });
  };
  const build = async () => {
    await onSteps(steps.map(s => (/azelaic/i.test(s.name) ? { ...s, days: [...AZELAIC_NIGHTS.build] } : s)));
  };

  return (
    <div style={card}>
      <span style={label}>Redness and azelaic acid</span>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={small}>Redness today, 0 (none) to 10 (worst). Note it weekly, or when something changes.</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="range" min="0" max="10" step="0.5" aria-label="Redness 0 to 10" value={current === '' ? 0 : current} onChange={e => onRate(validRedness(e.target.value))} style={{ flex: 1 }} />
          <span className="val-num" style={{ fontSize: 18, fontWeight: 700, minWidth: 36, textAlign: 'right', color: 'var(--text-primary)' }}>{current === '' ? '–' : current}</span>
        </div>
      </label>
      {trend
        ? <div role="status" style={small}>Last 2 weeks average {trend.avg}{trend.delta != null && Math.abs(trend.delta) >= 0.5 ? ` (${trend.delta > 0 ? 'up' : 'down'} ${Math.abs(trend.delta)} on the 2 weeks before)` : ''}. A flare is a reason to stop the newest active.</div>
        : <div style={small}>{last ? `Last noted ${last.score} on ${last.date}. ` : ''}Note a few readings and the trend shows here.</div>}

      <div role="status" style={{ ...small, color: 'var(--text-primary)' }}>{plan.message}</div>

      {plan.phase === 'ready' && !hasStep && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', ...small }}>
            <input type="checkbox" checked={calm} onChange={e => setCalm(e.target.checked)} style={{ marginTop: 3 }} />
            <span>My skin has been calm: no sustained stinging, burning or worse redness on the base routine.</span>
          </label>
          <div><button type="button" disabled={!calm} onClick={add} style={{ ...btn, opacity: calm ? 1 : 0.5 }}>Add azelaic acid, Monday and Thursday nights</button></div>
          <div style={small}>Thin layer on fully dry skin, then moisturiser. Not on broken skin or straight after shaving. Do not start niacinamide at the same time.</div>
        </div>
      )}
      {plan.phase === 'build' && hasStep && (
        <div><button type="button" onClick={build} style={btn}>Go to Mon, Wed, Fri nights</button><span style={{ ...small, marginLeft: 8 }}>Only if redness and burning are no worse.</span></div>
      )}
    </div>
  );
}
