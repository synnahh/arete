// CoachIntake — the coach's first questions, one at a time, ending in the plan they
// produce. Applying it sets your goal and daily targets, your profile, your skin
// profile, the Train gym and (when your library is empty) a starter exercise library
// and a training week built from it. Nothing is applied until you tap Apply, and your
// existing programs and exercises are never overwritten. Rules: src/domain/intake.js.
import { useMemo, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument } from '../supabase/useDocument.js';
import { useHealthData } from '../hooks/useHealthData.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { updateSettings } from '../utils/settingsStore.js';
import { settingsForGoal, GOAL_TEMPLATES, TEMPLATE_IDS, paceRows } from '../domain/goals.js';
import { ACTIVITY, EXPERIENCE, EQUIPMENT_CHOICES, planFromAnswers, fitDays } from '../domain/intake.js';
import { buildFromTemplate } from '../domain/splits.js';
import { PRESETS, suggestLibrary, freshEntries, styleFor } from '../domain/exercisePick.js';
import { SKIN_TYPES, SKIN_CONCERNS, CONCERN_LABEL } from '../domain/skinScore.js';
import { label } from './ui.js';
import CustomGoalFields, { fieldsFromPreset } from './CustomGoalFields.jsx';
import { maintenanceFrom, ageFrom } from '../domain/intake.js';
import { ROB_GUIDE_ANSWERS } from '../domain/guideAnswers.js';

const card = { padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 14 };
const field = { width: '100%', boxSizing: 'border-box', minHeight: 46, borderRadius: 12, padding: '0 14px', border: '0.5px solid var(--card-border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 16 };
const btn = (primary) => ({ minHeight: 46, padding: '0 20px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, border: primary ? 'none' : '0.5px solid var(--card-border)', background: primary ? 'var(--accent)' : 'transparent', color: primary ? 'var(--bg-base)' : 'var(--text-primary)' });
const choice = (on) => ({ textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', minHeight: 56, border: `1px solid ${on ? 'var(--accent)' : 'var(--card-border)'}`, background: on ? 'var(--active-bg)' : 'transparent', color: 'var(--text-primary)' });

const STEPS = ['goal', 'body', 'pace', 'training', 'activity', 'life', 'skin', 'plan'];

function Choice({ on, title, hint, onClick }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} style={choice(on)}>
      <div style={{ fontSize: 15, fontWeight: 700, color: on ? 'var(--accent)' : 'var(--text-primary)' }}>{title}</div>
      {hint && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{hint}</div>}
    </button>
  );
}
const Field = ({ name, children }) => <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={label}>{name}</span>{children}</label>;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 };

export default function CoachIntake({ settings, onDone }) {
  const today = toLocalDateKey(new Date());
  const { latestWeight } = useHealthData();
  const saved = settings?.coachIntake?.answers || {};
  const profile = settings?.profile || {};
  const [a, setA] = useState(() => ({
    sleepHours: settings?.sleepNeedHours || 8, ...saved,
    birthDate: saved.birthDate ?? profile.birthDate ?? '', sex: saved.sex ?? profile.sex ?? '', heightCm: saved.heightCm ?? profile.heightCm ?? '',
    weightKg: saved.weightKg ?? (latestWeight ? String(latestWeight) : ''),
  }));
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const set = (patch) => setA(prev => ({ ...prev, ...patch }));

  const exDoc = useDocument('overload_exercises', STORAGE_KEYS.OVERLOAD_EXERCISES, null);
  const programs = useCollection('programs', STORAGE_KEYS.PROGRAMS);
  const lm = useDocument('lm_profile', 'valerie_lm_profile', {});

  const plan = useMemo(() => planFromAnswers({
    ...a, heightCm: Number(a.heightCm) || '', weightKg: Number(a.weightKg) || '', days: a.days ? Number(a.days) : '',
  }, today), [a, today]);
  const ready = !plan.missing;
  const stepId = STEPS[step];
  const skipsPace = a.goal === 'recomp' || a.goal === 'custom';
  const visible = STEPS.filter(s => !(s === 'pace' && skipsPace));
  const pos = visible.indexOf(stepId);
  const go = (d) => { let n = step + d; while (STEPS[n] === 'pace' && skipsPace) n += d; setStep(Math.max(0, Math.min(STEPS.length - 1, n))); };

  const bodyOk = a.birthDate && a.sex && Number(a.heightCm) > 0 && Number(a.weightKg) > 0;
  const stepOk = { goal: !!a.goal && (a.goal !== 'custom' || (String(a.customText || '').trim() && a.customDeltaPct !== '' && a.customDeltaPct != null)), body: bodyOk, pace: true, training: a.experience && a.days && a.equipment, activity: !!a.activity, life: true, skin: true, plan: ready }[stepId];

  async function apply() {
    if (!ready || busy) return;
    setBusy(true); setMessage('');
    try {
      const lines = [];
      updateSettings({
        ...settingsForGoal(plan.goal, settings?.macros),
        profile: { ...(settings?.profile || {}), ...plan.profile },
        ...(plan.sleepNeedHours ? { sleepNeedHours: plan.sleepNeedHours } : {}),
        coachIntake: { answers: a, doneOn: today },
      });
      lines.push(`Goal set: ${plan.goal.customText || GOAL_TEMPLATES[plan.goal.template].label}, ${plan.goal.targets.kcal} kcal a day.`);

      try { localStorage.setItem('valerie_train_gym', plan.equipment.gym); } catch { /* storage blocked */ }

      // Library: only filled when you have none. Yours is never touched.
      let library = Array.isArray(exDoc.data) ? exDoc.data : [];
      if (library.length === 0) {
        const picks = Object.values(suggestLibrary(PRESETS[plan.equipment.preset].equipment, styleFor(plan.goal.template))).flat();
        library = freshEntries(picks, []);
        if (library.length) { await exDoc.save(library); lines.push(`Added ${library.length} starter exercises for ${plan.equipment.label.toLowerCase()}.`); }
      }

      // Training week: a new program, made active. Older programs are kept.
      const built = buildFromTemplate(plan.split.templateId, library);
      const days = fitDays(built.days, plan.split.days);
      for (const pr of programs.items || []) if (pr.isActive) await programs.update(pr.id, { isActive: false });
      await programs.add({ name: `${plan.split.label} (${plan.split.days} days)`, isActive: true, days, pinnedExercises: {} });
      lines.push(`Training week: ${plan.split.label}, ${plan.split.days} days.${built.missing.length ? ` Your library has no ${built.missing.join(', ')} exercises yet.` : ''}`);

      if (plan.skinProfile.type || plan.skinProfile.concerns.length || plan.skinProfile.avoid) {
        await lm.save({ ...(lm.data || {}), skinProfile: { ...(lm.data?.skinProfile || {}), ...plan.skinProfile } });
        lines.push('Skin profile saved.');
      }
      setMessage(lines.join(' '));
      onDone?.();
    } catch (e) {
      setMessage(`Something went wrong: ${e?.message || e}. Nothing is lost; try Apply again.`);
    } finally { setBusy(false); }
  }

  return (
    <section aria-label="Coach intake" style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <div style={label}>Coach intake · {pos + 1} of {visible.length}</div>
        {settings?.coachIntake?.doneOn && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Last done {settings.coachIntake.doneOn}</span>}
      </div>
      <div aria-hidden="true" style={{ height: 4, borderRadius: 999, background: 'var(--hover-bg)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${((pos + 1) / visible.length) * 100}%`, background: 'var(--accent)', transition: 'width 0.25s' }} />
      </div>

      {stepId === 'goal' && (<>
        <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-primary)' }}>What is your goal?</h2>
        <div style={grid}>
          {TEMPLATE_IDS.map(id => <Choice key={id} on={a.goal === id} title={GOAL_TEMPLATES[id].label} hint={GOAL_TEMPLATES[id].blurb} onClick={() => set({ goal: id })} />)}
          <Choice on={a.goal === 'custom'} title="Custom" hint="Your own goal and numbers, e.g. build muscle in a deficit" onClick={() => set(a.goal === 'custom' ? {} : { goal: 'custom', ...(a.customDeltaPct == null || a.customDeltaPct === '' ? fieldsFromPreset('muscleDeficit') : {}) })} />
        </div>
        {a.goal === 'custom' && (
          <CustomGoalFields value={a} onChange={set} weightKg={Number(a.weightKg) || null}
            maintenanceKcal={ageFrom(a.birthDate, today) && a.sex && Number(a.heightCm) > 0 && Number(a.weightKg) > 0 && a.activity ? maintenanceFrom({ weightKg: Number(a.weightKg), heightCm: Number(a.heightCm), age: ageFrom(a.birthDate, today), sex: a.sex }, a.activity) : null} />
        )}
        <div>
          <button type="button" onClick={() => setA(prev => ({ ...prev, ...ROB_GUIDE_ANSWERS, birthDate: prev.birthDate }))} style={{ ...btn(false), minHeight: 40, fontSize: 14 }}>Fill in the answers from my guide</button>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 6 }}>Fills this form from your two guides (weight, height, five training days, shoulder, skin and the muscle-in-a-deficit goal). Nothing is saved until you apply the plan. Your birth date is not in the guides, so enter it in the next step.</div>
        </div>
      </>)}

      {stepId === 'body' && (<>
        <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-primary)' }}>About you</h2>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Used to work out how many calories you burn. Stays on your account.</div>
        <div style={grid}>
          <Field name="Birth date"><input type="date" value={a.birthDate} max={today} onChange={e => set({ birthDate: e.target.value })} style={field} /></Field>
          <Field name="Sex">
            <div style={{ display: 'flex', gap: 8 }}>{['male', 'female'].map(s => <button key={s} type="button" aria-pressed={a.sex === s} onClick={() => set({ sex: s })} style={{ ...choice(a.sex === s), flex: 1, textTransform: 'capitalize', textAlign: 'center' }}>{s}</button>)}</div>
          </Field>
          <Field name="Height (cm)"><input type="number" inputMode="decimal" value={a.heightCm} onChange={e => set({ heightCm: e.target.value })} style={field} /></Field>
          <Field name="Weight now (kg)"><input type="number" inputMode="decimal" value={a.weightKg} onChange={e => set({ weightKg: e.target.value })} style={field} /></Field>
          <Field name="Goal weight (kg, optional)"><input type="number" inputMode="decimal" value={a.targetWeightKg ?? ''} onChange={e => set({ targetWeightKg: e.target.value })} style={field} /></Field>
        </div>
      </>)}

      {stepId === 'pace' && (<>
        <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-primary)' }}>How fast?</h2>
        <div style={grid}>
          {paceRows(a.goal || 'cut', Number(a.weightKg)).map(r => (
            <Choice key={r.id} on={(a.pace || 'normal') === r.id} title={r.label} onClick={() => set({ pace: r.id })}
              hint={<><span className="val-num">{r.weeklyRateKg > 0 ? '+' : ''}{r.weeklyRateKg} kg a week</span><br /><span style={{ color: r.discouraged ? '#e8a13a' : r.recommended ? '#4caf7d' : 'inherit' }}>{r.note}</span></>} />
          ))}
        </div>
        {!(Number(a.weightKg) > 0) && <div style={{ fontSize: 13, color: '#e8a13a' }}>Enter your weight in the last step to see the weekly change.</div>}
      </>)}

      {stepId === 'training' && (<>
        <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-primary)' }}>How do you train?</h2>
        <Field name="Experience"><div style={grid}>{Object.entries(EXPERIENCE).map(([id, e]) => <Choice key={id} on={a.experience === id} title={e.label} hint={e.hint} onClick={() => set({ experience: id })} />)}</div></Field>
        <Field name="Days a week you can train"><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{[2, 3, 4, 5, 6].map(n => <button key={n} type="button" aria-pressed={Number(a.days) === n} onClick={() => set({ days: n })} style={{ ...choice(Number(a.days) === n), minWidth: 56, textAlign: 'center' }}>{n}</button>)}</div></Field>
        <Field name="What you train with"><div style={grid}>{Object.entries(EQUIPMENT_CHOICES).map(([id, e]) => <Choice key={id} on={a.equipment === id} title={e.label} hint={e.hint} onClick={() => set({ equipment: id })} />)}</div></Field>
      </>)}

      {stepId === 'activity' && (<>
        <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-primary)' }}>How active are you day to day?</h2>
        <div style={grid}>{Object.entries(ACTIVITY).map(([id, e]) => <Choice key={id} on={a.activity === id} title={e.label} hint={e.hint} onClick={() => set({ activity: id })} />)}</div>
      </>)}

      {stepId === 'life' && (<>
        <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-primary)' }}>Anything the plan should work around?</h2>
        <Field name="Injuries or limits"><textarea value={a.limitations ?? ''} onChange={e => set({ limitations: e.target.value })} rows={2} placeholder="e.g. left shoulder, lower back" style={{ ...field, padding: 12, resize: 'vertical' }} /></Field>
        <Field name="Foods you avoid or can't eat"><textarea value={a.foodAvoid ?? ''} onChange={e => set({ foodAvoid: e.target.value })} rows={2} placeholder="e.g. dairy, shellfish" style={{ ...field, padding: 12, resize: 'vertical' }} /></Field>
        <Field name="Hours of sleep you aim for"><input type="number" inputMode="decimal" min="5" max="11" step="0.5" value={a.sleepHours ?? ''} onChange={e => set({ sleepHours: e.target.value })} style={{ ...field, maxWidth: 160 }} /></Field>
      </>)}

      {stepId === 'skin' && (<>
        <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-primary)' }}>Your skin</h2>
        <Field name="Type"><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{SKIN_TYPES.map(t => <button key={t} type="button" aria-pressed={a.skinType === t} onClick={() => set({ skinType: a.skinType === t ? null : t })} style={{ ...choice(a.skinType === t), minHeight: 44, textTransform: 'capitalize' }}>{t}</button>)}</div></Field>
        <Field name="Concerns"><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{SKIN_CONCERNS.map(c => { const on = (a.skinConcerns || []).includes(c); return <button key={c} type="button" aria-pressed={on} onClick={() => set({ skinConcerns: on ? a.skinConcerns.filter(x => x !== c) : [...(a.skinConcerns || []), c] })} style={{ ...choice(on), minHeight: 44 }}>{CONCERN_LABEL[c]}</button>; })}</div></Field>
        <Field name="Ingredients that irritate you"><input value={a.skinAvoid ?? ''} onChange={e => set({ skinAvoid: e.target.value })} placeholder="fragrance, coconut" style={field} /></Field>
      </>)}

      {stepId === 'plan' && (
        <>
          <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-primary)' }}>Your plan</h2>
          {!ready ? (
            <div role="status" style={{ fontSize: 14, color: '#e8a13a', lineHeight: 1.5 }}>The coach still needs {plan.missing.join(', ')}. Go back and fill that in.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="val-num" style={{ fontSize: 34, fontWeight: 800, color: 'var(--text-primary)' }}>{plan.goal.targets.kcal}<span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}> kcal a day</span></div>
              <div style={{ display: 'flex', gap: 16, fontSize: 15, flexWrap: 'wrap' }}>
                <span style={{ color: '#e879a0' }}>Protein {plan.goal.targets.protein} g</span>
                <span style={{ color: '#a78bfa' }}>Carbs {plan.goal.targets.carbs} g</span>
                <span style={{ color: '#4caf7d' }}>Fat {plan.goal.targets.fat} g</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                <li>Maintenance about {plan.maintenance.kcal} kcal (age {plan.maintenance.age}, {ACTIVITY[a.activity].label.toLowerCase()}). It becomes exact once you have 2 weeks of weigh-ins and food logs.</li>
                <li>{plan.goal.customText || GOAL_TEMPLATES[plan.goal.template].label}{plan.goal.targets.weeklyRateKg ? `: about ${plan.goal.targets.weeklyRateKg > 0 ? '+' : ''}${plan.goal.targets.weeklyRateKg} kg a week` : ''}{plan.goal.targetWeightKg ? `, towards ${plan.goal.targetWeightKg} kg` : ''}.</li>
                <li>Training: {plan.split.label}, {plan.split.days} days, {plan.equipment.label.toLowerCase()}.</li>
                {(plan.skinProfile.type || plan.skinProfile.concerns.length) && <li>Skin: {plan.skinProfile.type || 'type not set'}{plan.skinProfile.concerns.length ? `, ${plan.skinProfile.concerns.map(c => CONCERN_LABEL[c]).join(', ').toLowerCase()}` : ''}.</li>}
              </ul>
              {plan.notes.map(n => <div key={n} role="status" style={{ fontSize: 13.5, color: '#e8a13a' }}>{n}</div>)}
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Applying sets your goal and targets, saves your profile, and adds a new training week (your existing programs and exercises are kept). If your Exercise Library is empty it is started for your equipment.</div>
            </div>
          )}
          {message && <div role="status" style={{ fontSize: 13.5, color: 'var(--accent)', lineHeight: 1.5 }}>{message}</div>}
        </>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
        <button type="button" onClick={() => go(-1)} disabled={step === 0} style={{ ...btn(false), opacity: step === 0 ? 0.4 : 1 }}>Back</button>
        {stepId !== 'plan'
          ? <button type="button" onClick={() => go(1)} disabled={!stepOk} style={{ ...btn(true), opacity: stepOk ? 1 : 0.5 }}>Next</button>
          : <button type="button" onClick={apply} disabled={!ready || busy} style={{ ...btn(true), opacity: ready && !busy ? 1 : 0.5 }}>{busy ? 'Applying…' : 'Apply this plan'}</button>}
      </div>
    </section>
  );
}
