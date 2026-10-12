//  Goal HQ  Coach's home: one locked goal, the targets it sets, and a
//  weekly check of those targets against what actually happened.
//  Pure logic lives in src/domain/goals.js.
import { useMemo, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useHealthData } from '../hooks/useHealthData.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { updateSettings } from '../utils/settingsStore.js';
import CoachIntake from '../components/CoachIntake.jsx';
import GuideImport from '../components/GuideImport.jsx';
import CustomGoalFields, { fieldsFromPreset } from '../components/CustomGoalFields.jsx';
import { baseTemplateFor } from '../domain/intake.js';
import WeeklyCheckIn from '../components/WeeklyCheckIn.jsx';
import GoalEta from '../components/GoalEta.jsx';
import CoachUpdates from '../components/CoachUpdates.jsx';
import { cycleFor, todaysTargets, scheduledTrainingDaysPerWeek } from '../utils/todaysTargets.js';
import { cycleTargets } from '../domain/goals.js';
import {
  GOAL_TEMPLATES, TEMPLATE_IDS, computeTargets, estimateMaintenance, PACES, paceRows,
  adaptiveMaintenance, makeGoal, settingsForGoal,
} from '../domain/goals.js';
import { weightCoach } from '../domain/weight.js';

const card = {
  position: 'relative', padding: 20, borderRadius: 16,
  background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
};
const label = {
  fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--text-secondary)',
};
const input = {
  width: '100%', boxSizing: 'border-box', height: 44, padding: '0 12px', borderRadius: 10,
  background: 'var(--input-bg)', border: '0.5px solid var(--input-border)',
  color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 16,
};
const primaryBtn = {
  height: 46, padding: '0 22px', borderRadius: 12, border: 'none', cursor: 'pointer',
  background: 'var(--tab-accent)', color: 'var(--on-tab-accent)',
  fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
};
const ghostBtn = {
  height: 46, padding: '0 18px', borderRadius: 12, cursor: 'pointer',
  background: 'transparent', border: '0.5px solid var(--card-border)',
  color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: 14,
};

// HUD corner ticks on live cards (approved board)
function Ticks() {
  const t = { position: 'absolute', width: 9, height: 9, borderColor: 'var(--tab-accent)', borderStyle: 'solid', borderWidth: 0 };
  return (
    <>
      <span style={{ ...t, left: 7,  top: 7,    borderLeftWidth: 1,  borderTopWidth: 1 }} />
      <span style={{ ...t, right: 7, top: 7,    borderRightWidth: 1, borderTopWidth: 1 }} />
      <span style={{ ...t, left: 7,  bottom: 7, borderLeftWidth: 1,  borderBottomWidth: 1 }} />
      <span style={{ ...t, right: 7, bottom: 7, borderRightWidth: 1, borderBottomWidth: 1 }} />
    </>
  );
}

function TargetRow({ targets, training }) {
  const items = [
    ['Calories', targets.kcal, 'kcal'],
    ['Protein',  targets.protein, 'g'],
    ['Carbs',    targets.carbs, 'g'],
    ['Fat',      targets.fat, 'g'],
    ['Weekly',   targets.weeklyRateKg > 0 ? `+${targets.weeklyRateKg}` : targets.weeklyRateKg, 'kg'],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 10 }}>
        {items.map(([l, v, u]) => (
          <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={label}>{l}</span>
            <span className="val-num" style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-primary)' }}>
              {v}<span style={{ fontSize: 13, color: 'var(--text-secondary)', marginLeft: 3 }}>{u}</span>
            </span>
          </div>
        ))}
      </div>
      {training && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Training: {training}</div>}
    </div>
  );
}

//  Goal editor: pick a template (or custom), confirm weight and maintenance
function GoalEditor({ settings, latestWeight, adaptive, onDone, onCancel }) {
  const current = settings?.coachGoal;
  const [template, setTemplate] = useState(current?.template ?? 'cut');
  const [custom, setCustom]     = useState(!!current?.customText);
  // A custom goal carries its own numbers: calories vs maintenance, protein per kg.
  const [cf, setCf] = useState(() => current?.custom
    ? { customPreset: null, customText: current.customText ?? '', customDeltaPct: current.custom.deltaPct, customProtein: current.custom.proteinPerKg, customFat: current.custom.fatPerKg }
    : fieldsFromPreset('muscleDeficit'));
  const customText = cf.customText ?? '';
  const [weight, setWeight]     = useState(latestWeight ? String(latestWeight) : '');
  const suggested = adaptive?.kcal ?? estimateMaintenance(Number(weight));
  const [maint, setMaint]       = useState('');
  const [targetWeight, setTargetWeight] = useState(current?.targetWeightKg ? String(current.targetWeightKg) : '');
  const [pace, setPace]         = useState(current?.pace && PACES[current.pace] ? current.pace : 'normal');
  const maintenanceKcal = Number(maint) || suggested || 0;
  const maintenanceSource = maint ? 'manual' : adaptive ? 'adaptive' : 'estimate';
  const customSpec = custom ? { deltaPct: Number(cf.customDeltaPct), proteinPerKg: Number(cf.customProtein) || 2.2, fatPerKg: Number(cf.customFat) || 0.9 } : null;
  const baseTemplate = custom ? baseTemplateFor(customSpec.deltaPct) : template;
  const targets = computeTargets(baseTemplate, { weightKg: Number(weight), maintenanceKcal, paceFactor: baseTemplate === 'recomp' ? 1 : PACES[pace].factor, custom: customSpec });
  const t = GOAL_TEMPLATES[baseTemplate];

  function lockIn() {
    const goal = makeGoal({
      template: baseTemplate, customText: custom ? customText : '', weightKg: Number(weight),
      maintenanceKcal, maintenanceSource, startedOn: toLocalDateKey(new Date()), targetWeightKg: Number(targetWeight) || null,
      pace: baseTemplate === 'recomp' || custom ? 'normal' : pace, custom: customSpec,
    });
    if (!goal) return;
    updateSettings(settingsForGoal(goal, settings?.macros));
    onDone();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {TEMPLATE_IDS.map(id => {
          const on = id === template && !custom;
          return (
            <button key={id} type="button" aria-pressed={on} onClick={() => { setTemplate(id); setCustom(false); }}
              style={{
                textAlign: 'left', padding: 16, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                background: on ? 'color-mix(in srgb, var(--tab-accent) 12%, var(--bg-panel))' : 'var(--bg-panel)',
                border: `1px solid ${on ? 'var(--tab-accent)' : 'var(--card-border)'}`,
                display: 'flex', flexDirection: 'column', gap: 6, minHeight: 88,
              }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: on ? 'var(--tab-accent)' : 'var(--text-primary)' }}>
                {GOAL_TEMPLATES[id].label}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{GOAL_TEMPLATES[id].blurb}</span>
            </button>
          );
        })}
        <button type="button" aria-pressed={custom} onClick={() => setCustom(true)}
          style={{
            textAlign: 'left', padding: 16, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
            background: custom ? 'color-mix(in srgb, var(--tab-accent) 12%, var(--bg-panel))' : 'var(--bg-panel)',
            border: `1px ${custom ? 'solid var(--tab-accent)' : 'dashed var(--card-border)'}`,
            display: 'flex', flexDirection: 'column', gap: 6, minHeight: 88,
          }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: custom ? 'var(--tab-accent)' : 'var(--text-primary)' }}>Custom</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>Your own goal, in your words</span>
        </button>
      </div>

      {baseTemplate !== 'recomp' && !custom && Number(weight) > 0 && (
        <div role="group" aria-label="Speed" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={label}>Speed</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
            {paceRows(template, Number(weight)).map(r => {
              const on = pace === r.id;
              return (
                <button key={r.id} type="button" aria-pressed={on} onClick={() => setPace(r.id)}
                  style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', minHeight: 62,
                    background: on ? 'color-mix(in srgb, var(--tab-accent) 12%, var(--bg-panel))' : 'var(--bg-panel)',
                    border: `1px solid ${on ? 'var(--tab-accent)' : 'var(--card-border)'}` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: on ? 'var(--tab-accent)' : 'var(--text-primary)' }}>{r.label}</div>
                  <div className="val-num" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{r.weeklyRateKg > 0 ? '+' : ''}{r.weeklyRateKg} kg a week</div>
                  <div style={{ fontSize: 11.5, color: r.discouraged ? '#e8a13a' : r.recommended ? '#4caf7d' : 'var(--text-muted)' }}>{r.note}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {custom && (
        <CustomGoalFields value={cf} onChange={(patch) => setCf(prev => ({ ...prev, ...patch }))} weightKg={Number(weight) || null} maintenanceKcal={maintenanceKcal || null} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>Bodyweight (kg)</span>
          <input inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} placeholder="80" style={input} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>Goal weight (kg, optional)</span>
          <input inputMode="decimal" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} placeholder="78" style={input} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Adds a projected date to your weight trend.</span>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>Maintenance (kcal/day)</span>
          <input inputMode="numeric" value={maint} onChange={e => setMaint(e.target.value)} placeholder={suggested ? String(suggested) : '2600'} style={input} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {maint ? 'Your number' : adaptive
              ? `From your last ${adaptive.days} days: ${adaptive.avgIntake} kcal eaten, ${adaptive.slopeKgPerWeek} kg/week`
              : 'Estimate: bodyweight × 32. Gets replaced by your real number after 2 weeks of logging.'}
          </span>
        </label>
      </div>

      {targets ? (
        <div style={card}>
          <Ticks />
          <div style={{ ...label, marginBottom: 12 }}>Your targets</div>
          <TargetRow targets={targets} training={t.training} />
          {(settings?.macroGoal || settings?.proteinGoal) && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 14 }}>
              Replaces your current targets ({settings.macroGoal ?? '—'} kcal · {settings.proteinGoal ?? '—'} g protein).
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Enter your bodyweight to see your targets.</div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" disabled={!targets || (custom && !customText.trim())} onClick={lockIn}
          style={{ ...primaryBtn, opacity: !targets || (custom && !customText.trim()) ? 0.45 : 1 }}>
          Lock in goal
        </button>
        {onCancel && <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>}
      </div>
    </div>
  );
}

//  Training days vs rest days: same weekly calories, moved toward the days you train
function DayCycleCard({ goal, settings }) {
  const cycle = cycleFor(settings);
  const bonus = cycle?.trainingBonusKcal ?? 0;
  const days = cycle?.trainingDaysPerWeek ?? scheduledTrainingDaysPerWeek() ?? 4;
  const base = goal.targets;
  const train = cycleTargets(base, { trainingBonusKcal: bonus, trainingDaysPerWeek: days }, true);
  const rest = cycleTargets(base, { trainingBonusKcal: bonus, trainingDaysPerWeek: days }, false);
  const today = todaysTargets(settings);
  const set = (b) => updateSettings({ dayCycle: b ? { trainingBonusKcal: b } : null });
  const chip = (on) => ({
    minHeight: 40, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14,
    border: `0.5px solid ${on ? 'var(--tab-accent)' : 'var(--card-border)'}`,
    background: on ? 'color-mix(in srgb, var(--tab-accent) 14%, transparent)' : 'transparent',
    color: on ? 'var(--tab-accent)' : 'var(--text-secondary)', fontWeight: on ? 600 : 500,
  });
  return (
    <div style={card}>
      <div style={{ ...label, marginBottom: 8 }}>Training days vs rest days</div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
        Eat more on the days you train and less on the days you don't, with the same weekly total. The difference is all carbs; protein and fat stay put.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[0, 150, 250, 400].map(b => (
          <button key={b} type="button" aria-pressed={bonus === b} onClick={() => set(b)} style={chip(bonus === b)}>{b ? `+${b} kcal` : 'Off'}</button>
        ))}
      </div>
      {bonus > 0 && (
        <div className="val-num" style={{ marginTop: 14, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
          Training day ({days}/week): {train.kcal} kcal · {train.carbs} g carbs<br />
          Rest day ({7 - days}/week): {rest.kcal} kcal · {rest.carbs} g carbs<br />
          {train.capped && <span style={{ color: '#e8a13a' }}>Trimmed to +{train.delta} kcal so rest days keep at least half their carbs.<br /></span>}
          {today.kind ? <span style={{ color: 'var(--text-secondary)' }}>Today is a {today.kind} day: {today.kcal} kcal.</span> : null}
        </div>
      )}
    </div>
  );
}

//  The locked goal, progress since starting, and the weekly target check
function GoalCard({ goal, settings, latestWeight, coach, adaptive, onChange }) {
  const t = GOAL_TEMPLATES[goal.template];
  const today = toLocalDateKey(new Date());
  const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(goal.startedOn)) / 86400000));
  const week = Math.floor(days / 7) + 1;
  // Judge progress by the smoothed trend, not a single noisy weigh-in.
  const shownWeight = coach?.trend ?? latestWeight ?? goal.startWeightKg;
  const delta = (coach?.trend ?? latestWeight) && goal.startWeightKg ? +((coach?.trend ?? latestWeight) - goal.startWeightKg).toFixed(1) : null;


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={card}>
        <Ticks />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={label}>Week {week} · since {goal.startedOn}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--tab-accent)', lineHeight: 1.1 }}>{t?.label ?? goal.template}</span>
            {goal.customText && <span style={{ fontSize: 15, color: 'var(--text-primary)' }}>{goal.customText}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={label}>{coach ? 'Trend weight' : 'Bodyweight'}</span>
            <span className="val-num" style={{ fontSize: 26, fontWeight: 500 }}>
              {shownWeight}<span style={{ fontSize: 13, color: 'var(--text-secondary)' }}> kg</span>
            </span>
            {delta !== null && (
              <span className="val-num" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {delta > 0 ? '+' : ''}{delta} kg since start
              </span>
            )}
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--card-border)', margin: '16px 0' }} />
        <TargetRow targets={goal.targets} training={t?.training} />
        {coach?.pace && (
          <div role="status" style={{ marginTop: 14, fontSize: 14, lineHeight: 1.45, color: coach.pace.status === 'on-track' ? '#4caf7d' : '#e8a13a' }}>{coach.pace.message}</div>
        )}
        <div style={{ marginTop: 10 }}><GoalEta eta={coach?.eta} targetKg={goal.targetWeightKg} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={label}>Goal weight</span>
          <input key={goal.targetWeightKg ?? 'none'} inputMode="decimal" defaultValue={goal.targetWeightKg ?? ''} placeholder="kg" aria-label="Goal weight in kilograms"
            onBlur={e => {
              const v = Number(e.target.value) || null;
              if (v !== (goal.targetWeightKg ?? null)) {
                const { targetWeightKg: _drop, ...rest } = goal;
                updateSettings({ coachGoal: v ? { ...rest, targetWeightKg: v } : rest });
              }
            }}
            style={{ ...input, width: 96, height: 36 }} />
        </label>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onChange} style={ghostBtn}>Change goal</button>
        </div>
      </div>

      <DayCycleCard goal={goal} settings={settings} />

      {/* The coach applies maintenance and macro changes itself; they show here with Undo. */}
      <CoachUpdates always />
    </div>
  );
}

export default function GoalHQ({ settings, overview = null, compact = false }) {
  const [editing, setEditing] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(() => !settings?.coachIntake);   // the coach asks first until you have answered
  const { latestWeight } = useHealthData();
  const { items: bodyMetrics = [] }   = useCollection('body_metrics',   STORAGE_KEYS.BODY);
  const { items: nutritionLogs = [] } = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);
  const adaptive = useMemo(
    () => adaptiveMaintenance(bodyMetrics, nutritionLogs, { today: toLocalDateKey(new Date()) }),
    [bodyMetrics, nutritionLogs]
  );
  const goal = settings?.coachGoal;
  const coach = useMemo(() => weightCoach(bodyMetrics, goal?.targets?.weeklyRateKg ?? null, goal?.targetWeightKg ?? null, toLocalDateKey(new Date())), [bodyMetrics, goal]);
  const showEditor = !goal || editing;

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: compact ? 16 : '20px 28px 40px', maxWidth: 980, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: compact ? 26 : 32, fontWeight: 700, color: 'var(--text-primary)' }}>Goal HQ</h1>
          <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
            {showEditor ? 'Pick one goal. Everything in Coach works toward it.' : 'One goal. Everything in Coach works toward it.'}
          </span>
        </div>

        {intakeOpen
          ? <CoachIntake settings={settings} onDone={() => setIntakeOpen(false)} />
          : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderRadius: 14, border: '0.5px solid var(--card-border)', background: 'var(--bg-panel)' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Coach intake done{settings?.coachIntake?.doneOn ? ' on ' + settings.coachIntake.doneOn : ''}. Redo it when your goal, days or equipment change.</span>
              <button type="button" onClick={() => setIntakeOpen(true)} style={{ minHeight: 40, padding: '0 16px', borderRadius: 10, border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Redo intake</button>
            </div>
          )}

        {!intakeOpen && (showEditor
          ? <GoalEditor settings={settings} latestWeight={latestWeight} adaptive={adaptive}
              onDone={() => setEditing(false)} onCancel={goal ? () => setEditing(false) : null} />
          : <GoalCard goal={goal} settings={settings} latestWeight={latestWeight} coach={coach} adaptive={adaptive} onChange={() => setEditing(true)} />)}

        {!intakeOpen && !showEditor && goal && <WeeklyCheckIn goal={goal} />}
        <GuideImport settings={settings} />
      </div>

      {overview && !showEditor && !intakeOpen && <div style={{ minHeight: 480 }}>{overview}</div>}
    </div>
  );
}
