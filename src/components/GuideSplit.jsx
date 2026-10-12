// GuideSplit — put the training week from your 25 Sep guide into the app in one tap: the 5-day
// frame-priority split (Upper A / Lower A / Upper B / Lower B / Upper C) with the guide's own sets
// and reps, plus the guide's 2-week re-entry block. Optionally fills the muscles the guide does not
// train directly (forearms, traps, glutes): those are Arete's additions and are listed before you
// confirm. Your other programs are kept, switched off. Rules: domain/splitCoach.js planGuideSplit.
import { useMemo, useState } from 'react';
import { label } from './ui.js';
import { planGuideSplit } from '../domain/splitCoach.js';
import { WEEK, WEEK_LABEL, isRest } from '../domain/splits.js';

const card = { padding: 16, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid color-mix(in srgb, var(--accent) 45%, var(--card-border))', display: 'flex', flexDirection: 'column', gap: 10 };
const btn = (primary) => ({ minHeight: 46, padding: '0 18px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, border: primary ? 'none' : '0.5px solid var(--card-border)', background: primary ? 'var(--accent)' : 'transparent', color: primary ? 'var(--bg-base)' : 'var(--text-primary)' });
const small = { fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 };

export default function GuideSplit({ programs, exercises, saveExercises, addProgram, updateProgram }) {
  const [fill, setFill] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const preview = useMemo(() => planGuideSplit({ library: exercises, programs, start: 'five', fill }), [exercises, programs, fill]);
  const five = preview.programs.find(p => /frame-priority/i.test(p.name));
  if (!five || !saveExercises) return null;

  const run = async (start) => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const plan = planGuideSplit({ library: exercises, programs, start, fill });
      if (plan.newExercises > 0) await saveExercises(plan.library);
      for (const p of programs) if (p.isActive) await updateProgram(p.id, { isActive: false });
      for (const p of plan.programs) await addProgram(p);
      setMessage(`Done. ${start === 'five' ? 'The 5-day split is active.' : 'The 2-week re-entry block is active; switch to the 5-day split from the list when it ends.'}`);
    } catch (e) { setMessage(`Something went wrong: ${e?.message || e}. Nothing was lost; try again.`); }
    finally { setBusy(false); }
  };

  return (
    <section aria-label="Your guide's split" style={card}>
      <div style={label}>Your guide's split</div>
      <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 600 }}>5 days, upper body three times and legs twice, built for width and shoulders.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: 6 }}>
        {WEEK.map(k => {
          const d = five.days[k];
          return (
            <div key={k} style={{ padding: '8px 10px', borderRadius: 10, border: '0.5px solid var(--card-border)', background: isRest(d) ? 'transparent' : 'color-mix(in srgb, var(--tab-accent) 10%, transparent)' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>{WEEK_LABEL[k].toUpperCase()}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{isRest(d) ? 'Rest' : d.label}</div>
              {!isRest(d) && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{d.exerciseIds.length} exercises</div>}
            </div>
          );
        })}
      </div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', ...small }}>
        <input type="checkbox" checked={fill} onChange={e => setFill(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
        <span>Also train every muscle: adds {preview.added.length ? preview.added.join(', ') : 'nothing extra'}. These are not in your guide; they close its gaps (forearms, traps, glutes). Nothing involves overhead pressing.</span>
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy} onClick={() => run('five')} style={btn(true)}>{busy ? 'Setting up…' : 'Use the 5-day split now'}</button>
        <button type="button" disabled={busy} onClick={() => run('reentry')} style={btn(false)}>Start with the 2-week re-entry block</button>
      </div>
      <div style={small}>The guide starts with 2 easy weeks (3 full-body days, 2 sets each) before the 5-day week; pick that if you are coming back from a break. Both are added either way, and your other programs are kept. Meals, supplements and the skin routine come from Goal HQ &gt; Import my guide.</div>
      {message && <div role="status" style={{ fontSize: 13.5, color: '#4caf7d' }}>{message}</div>}
    </section>
  );
}
