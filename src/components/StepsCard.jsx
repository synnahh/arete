// StepsCard — type in today's steps, see the 7-day average and your goal, and step the goal up
// when you have earned it (the guide: find your real average, then add about 1,000 every 1-2
// weeks towards 8-10k). Typed by hand until Apple Health sync is deployed. Rules: domain/steps.js.
import { useState } from 'react';
import { useDocument } from '../supabase/useDocument.js';
import { useSettingsValue } from '../hooks/useSettingsValue.js';
import { updateSettings } from '../utils/settingsStore.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { dayIndex } from '../utils/dayIndex.js';
import { label } from './ui.js';
import { cleanLog, setSteps, weekAverage, rampedGoal, startingGoal, STEP_LIMITS } from '../domain/steps.js';

const card = { padding: 16, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 };
const field = { minHeight: 44, borderRadius: 12, padding: '0 14px', border: '0.5px solid var(--card-border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 16, width: 140, boxSizing: 'border-box' };
const btn = { minHeight: 44, padding: '0 16px', borderRadius: 12, border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
const small = { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 };

export default function StepsCard() {
  const doc = useDocument('step_log', 'valerie_step_log', {});
  const settings = useSettingsValue();
  const today = toLocalDateKey(new Date());
  const log = cleanLog(doc.data);
  const [value, setValue] = useState('');
  const goal = Number(settings.stepGoal) || null;
  const avg = weekAverage(log, today);
  const since = settings.stepGoalOn ? dayIndex(today) - dayIndex(settings.stepGoalOn) : null;
  const next = avg && goal ? rampedGoal(avg, goal, Number.isFinite(since) ? since : null) : null;
  const start = !goal && avg ? startingGoal(avg) : null;

  const save = async () => {
    const n = Number(value);
    if (!(n >= 0 && n <= 100000)) return;
    await doc.save(setSteps(log, today, n));
    setValue('');
  };
  const setGoal = (g) => updateSettings({ stepGoal: g, stepGoalOn: today });

  return (
    <section aria-label="Steps" style={card}>
      <div style={label}>Steps</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <span className="val-num" style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{(log[today] ?? 0).toLocaleString('en-AU')}</span>
        <span style={small}>today{goal ? ` of ${goal.toLocaleString('en-AU')}` : ''}</span>
        {avg != null && <span style={small}>7-day average {avg.toLocaleString('en-AU')}</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="number" inputMode="numeric" min="0" aria-label="Steps today" placeholder="Steps today" value={value} onChange={e => setValue(e.target.value)} style={field} />
        <button type="button" onClick={save} style={btn}>Save today</button>
        {goal && (
          <>
            <button type="button" aria-label="Lower the step goal" onClick={() => setGoal(Math.max(STEP_LIMITS.min, goal - 500))} style={btn}>-500</button>
            <button type="button" aria-label="Raise the step goal" onClick={() => setGoal(Math.min(STEP_LIMITS.max, goal + 500))} style={btn}>+500</button>
          </>
        )}
      </div>
      {start && <div style={small}>Your real average is {avg.toLocaleString('en-AU')}. <button type="button" onClick={() => setGoal(start)} style={{ ...btn, minHeight: 36, marginLeft: 6 }}>Set the goal to {start.toLocaleString('en-AU')}</button></div>}
      {!goal && !start && <div style={small}>Log 3 days and the goal can start from your real average, not a guess.</div>}
      {next && <div style={small}>You met your goal this week. <button type="button" onClick={() => setGoal(next)} style={{ ...btn, minHeight: 36, marginLeft: 6 }}>Raise it to {next.toLocaleString('en-AU')}</button></div>}
    </section>
  );
}
