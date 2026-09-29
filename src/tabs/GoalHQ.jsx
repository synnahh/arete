//  Goal HQ  Coach's home: one locked goal, the targets it sets, and a
//  weekly check of those targets against what actually happened.
//  Pure logic lives in src/domain/goals.js.
import { useMemo, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useHealthData } from '../hooks/useHealthData.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { updateSettings } from '../utils/settingsStore.js';
import {
  GOAL_TEMPLATES, TEMPLATE_IDS, computeTargets, estimateMaintenance,
  adaptiveMaintenance, makeGoal, settingsForGoal,
} from '../domain/goals.js';

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
  const [customText, setText]   = useState(current?.customText ?? '');
  const [weight, setWeight]     = useState(latestWeight ? String(latestWeight) : '');
  const suggested = adaptive?.kcal ?? estimateMaintenance(Number(weight));
  const [maint, setMaint]       = useState('');
  const maintenanceKcal = Number(maint) || suggested || 0;
  const maintenanceSource = maint ? 'manual' : adaptive ? 'adaptive' : 'estimate';
  const targets = computeTargets(template, { weightKg: Number(weight), maintenanceKcal });
  const t = GOAL_TEMPLATES[template];

  function lockIn() {
    const goal = makeGoal({
      template, customText: custom ? customText : '', weightKg: Number(weight),
      maintenanceKcal, maintenanceSource, startedOn: toLocalDateKey(new Date()),
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

      {custom && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={label}>Your goal</span>
            <input value={customText} onChange={e => setText(e.target.value)} placeholder="e.g. Visible abs by summer without losing my bench"
              style={{ ...input, fontFamily: 'inherit', fontSize: 15 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={label}>Closest template (sets the numbers)</span>
            <select value={template} onChange={e => setTemplate(e.target.value)} style={{ ...input, fontFamily: 'inherit', fontSize: 15 }}>
              {TEMPLATE_IDS.map(id => <option key={id} value={id}>{GOAL_TEMPLATES[id].label}</option>)}
            </select>
          </label>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>Bodyweight (kg)</span>
          <input inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} placeholder="80" style={input} />
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

//  The locked goal, progress since starting, and the weekly target check
function GoalCard({ goal, settings, latestWeight, adaptive, onChange }) {
  const [dismissed, setDismissed] = useState(false);
  const t = GOAL_TEMPLATES[goal.template];
  const today = toLocalDateKey(new Date());
  const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(goal.startedOn)) / 86400000));
  const week = Math.floor(days / 7) + 1;
  const delta = latestWeight && goal.startWeightKg ? +(latestWeight - goal.startWeightKg).toFixed(1) : null;

  // Weekly check: propose new targets when real maintenance has drifted.
  const drift = adaptive ? adaptive.kcal - goal.maintenanceKcal : 0;
  const proposal = adaptive && Math.abs(drift) >= 100 && !dismissed
    ? makeGoal({ ...goal, weightKg: latestWeight || goal.startWeightKg, maintenanceKcal: adaptive.kcal, maintenanceSource: 'adaptive' })
    : null;

  function applyProposal() {
    updateSettings(settingsForGoal({ ...proposal, startedOn: goal.startedOn, startWeightKg: goal.startWeightKg }, settings?.macros));
  }

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
            <span style={label}>Bodyweight</span>
            <span className="val-num" style={{ fontSize: 26, fontWeight: 500 }}>
              {latestWeight ?? goal.startWeightKg}<span style={{ fontSize: 13, color: 'var(--text-secondary)' }}> kg</span>
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
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onChange} style={ghostBtn}>Change goal</button>
        </div>
      </div>

      {proposal && (
        <div role="status" style={{ ...card, borderColor: 'var(--tab-accent)' }}>
          <div style={{ ...label, color: 'var(--tab-accent)', marginBottom: 8 }}>Suggestion · weekly check</div>
          <div style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            Over the last {adaptive.days} days you ate {adaptive.avgIntake} kcal a day and your weight moved {adaptive.slopeKgPerWeek} kg a week,
            so your real maintenance is about <strong className="val-num">{adaptive.kcal} kcal</strong>, not {goal.maintenanceKcal}.
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }} className="val-num">
            New targets: {proposal.targets.kcal} kcal · {proposal.targets.protein} g protein · {proposal.targets.carbs} g carbs · {proposal.targets.fat} g fat
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="button" onClick={applyProposal} style={primaryBtn}>Apply</button>
            <button type="button" onClick={() => setDismissed(true)} style={ghostBtn}>Not now</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GoalHQ({ settings, overview = null, compact = false }) {
  const [editing, setEditing] = useState(false);
  const { latestWeight } = useHealthData();
  const { items: bodyMetrics = [] }   = useCollection('body_metrics',   STORAGE_KEYS.BODY);
  const { items: nutritionLogs = [] } = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);
  const adaptive = useMemo(
    () => adaptiveMaintenance(bodyMetrics, nutritionLogs, { today: toLocalDateKey(new Date()) }),
    [bodyMetrics, nutritionLogs]
  );
  const goal = settings?.coachGoal;
  const showEditor = !goal || editing;

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: compact ? 16 : '20px 28px 40px', maxWidth: 980 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: compact ? 26 : 32, fontWeight: 700, color: 'var(--text-primary)' }}>Goal HQ</h1>
          <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
            {showEditor ? 'Pick one goal. Everything in Coach works toward it.' : 'One goal. Everything in Coach works toward it.'}
          </span>
        </div>

        {showEditor
          ? <GoalEditor settings={settings} latestWeight={latestWeight} adaptive={adaptive}
              onDone={() => setEditing(false)} onCancel={goal ? () => setEditing(false) : null} />
          : <GoalCard goal={goal} settings={settings} latestWeight={latestWeight} adaptive={adaptive} onChange={() => setEditing(true)} />}
      </div>

      {overview && !showEditor && <div style={{ minHeight: 480 }}>{overview}</div>}
    </div>
  );
}
