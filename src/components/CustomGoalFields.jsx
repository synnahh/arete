// CustomGoalFields — set your own goal: say it in words, then pick how far above or
// below maintenance to eat and how much protein. Presets give sensible starting points
// (the first is "build muscle in a deficit"); every number can be changed. Shows what
// the numbers come to when weight and maintenance are known.
import { CUSTOM_PRESETS, CUSTOM_LIMITS, cleanCustom, customFieldsFromPreset } from '../domain/goals.js';
import { label } from './ui.js';

const field = { width: '100%', boxSizing: 'border-box', minHeight: 46, borderRadius: 12, padding: '0 14px', border: '0.5px solid var(--card-border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 16 };
const chip = (on) => ({ minHeight: 40, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: on ? 700 : 500, border: `0.5px solid ${on ? 'var(--accent)' : 'var(--card-border)'}`, background: on ? 'var(--active-bg)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-secondary)' });

export const fieldsFromPreset = customFieldsFromPreset;

export default function CustomGoalFields({ value, onChange, weightKg = null, maintenanceKcal = null }) {
  const c = cleanCustom({ deltaPct: value.customDeltaPct, proteinPerKg: value.customProtein, fatPerKg: value.customFat });
  const kcal = maintenanceKcal && c ? Math.max(1300, Math.round(maintenanceKcal * (1 + c.deltaPct / 100) / 10) * 10) : null;
  const protein = weightKg && c ? Math.round((weightKg * c.proteinPerKg) / 5) * 5 : null;
  const preset = CUSTOM_PRESETS[value.customPreset];
  const [lo, hi] = CUSTOM_LIMITS.deltaPct;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div role="group" aria-label="Starting point" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(CUSTOM_PRESETS).map(([id, p]) => (
          <button key={id} type="button" aria-pressed={value.customPreset === id} onClick={() => onChange(fieldsFromPreset(id))} style={chip(value.customPreset === id)}>{p.label}</button>
        ))}
      </div>
      {preset && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{preset.note}</div>}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>Your goal, in your words</span>
        <input value={value.customText ?? ''} onChange={e => onChange({ customText: e.target.value })} placeholder="e.g. Build muscle as fast as possible in a calorie deficit" style={field} />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>Calories vs maintenance (%)</span>
          <input type="number" inputMode="decimal" min={lo} max={hi} step="1" value={value.customDeltaPct ?? ''} onChange={e => onChange({ customDeltaPct: e.target.value, customPreset: null })} style={field} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>Protein (g per kg)</span>
          <input type="number" inputMode="decimal" min="1.2" max="3" step="0.1" value={value.customProtein ?? ''} onChange={e => onChange({ customProtein: e.target.value, customPreset: null })} style={field} />
        </label>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Negative is a deficit, positive a surplus. The app allows {lo}% to +{hi}%.</div>
      {(kcal || protein) && (
        <div role="status" className="val-num" style={{ fontSize: 14, color: 'var(--text-primary)' }}>
          {kcal ? `About ${kcal} kcal a day` : ''}{kcal && protein ? ' · ' : ''}{protein ? `${protein} g protein` : ''}
        </div>
      )}
    </div>
  );
}
