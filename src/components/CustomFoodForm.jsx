// CustomFoodForm — add or edit one of your own foods, with the numbers for one serving
// as written on the label. Rules: src/domain/customFoods.js. Desktop card and phone sheet.
import { useState } from 'react';
import { SERVING_UNITS, customFoodProblems, makeCustomFood, formFromCustomFood } from '../domain/customFoods.js';

const field = { height: 44, padding: '0 10px', borderRadius: 8, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', minWidth: 0, boxSizing: 'border-box', width: '100%' };
const mono = { ...field, fontFamily: 'var(--font-mono)', textAlign: 'right' };
const btn = { height: 48, padding: '0 16px', borderRadius: 9, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const primary = { ...btn, background: 'var(--tab-accent, var(--accent))', color: 'var(--on-tab-accent, #fff)', border: 'none' };

function Cell({ title, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</span>
      {children}
    </label>
  );
}

export default function CustomFoodForm({ initial, onSave, onCancel, onDelete, canLog = false }) {
  const [f, setF] = useState(() => (initial ? formFromCustomFood(initial) : { name: '', brand: '', servingQty: 100, servingUnit: 'g', calories: '', protein: '', carbs: '', fat: '' }));
  const [problems, setProblems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const editing = !!initial?.id;
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const digits = (v) => v.replace(/[^0-9.]/g, '');

  // andLog: after saving a NEW food, also add one serving to today's diary (the caller does the logging).
  async function save(andLog = false) {
    const found = customFoodProblems(f);
    setProblems(found);
    if (found.length || saving) return;
    setSaving(true);
    try { await onSave(makeCustomFood(f), initial?.id ?? null, { log: andLog }); } finally { setSaving(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <Cell title="Food name"><input aria-label="Food name" value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Protein bar" style={field} /></Cell>
        <Cell title="Brand (optional)"><input aria-label="Brand" value={f.brand} onChange={e => set('brand', e.target.value)} placeholder="e.g. Brand X" style={field} /></Cell>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
        <Cell title="One serving is"><input aria-label="Serving size" inputMode="decimal" value={f.servingQty} onChange={e => set('servingQty', digits(e.target.value))} style={mono} /></Cell>
        <Cell title="Unit">
          <select aria-label="Serving unit" value={f.servingUnit} onChange={e => set('servingUnit', e.target.value)} style={{ ...field, paddingRight: 28 }}>{SERVING_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
        </Cell>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        {[['calories', 'Kcal'], ['protein', 'Protein g'], ['carbs', 'Carbs g'], ['fat', 'Fat g']].map(([k, t]) => (
          <Cell key={k} title={t}><input aria-label={t} inputMode="decimal" value={f[k]} onChange={e => set(k, digits(e.target.value))} placeholder="0" style={mono} /></Cell>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>Enter the numbers for one serving, as on the label. When you log it you pick how many servings.</div>
      {problems.length > 0 && <ul role="alert" style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#e55a5a', lineHeight: 1.5 }}>{problems.map(p => <li key={p}>{p}</li>)}</ul>}
      {/* Always visible: the bar sticks to the bottom of the sheet, so Save never sits below the keyboard or the fold. */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 1, display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 0 2px', background: 'var(--bg-panel, var(--surface-1))', borderTop: '0.5px solid var(--card-border)' }}>
        <button type="button" style={{ ...primary, flex: '1 1 140px' }} onClick={() => save(canLog && !editing)} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update food' : canLog ? 'Save and add to today' : 'Save food'}</button>
        {canLog && !editing && <button type="button" style={{ ...btn, flex: '1 1 100px' }} onClick={() => save(false)} disabled={saving}>Save only</button>}
        <button type="button" style={btn} onClick={onCancel}>Cancel</button>
        {editing && onDelete && (
          <button type="button" style={{ ...btn, marginLeft: 'auto', color: confirm ? '#e55a5a' : 'var(--text-secondary)', borderColor: confirm ? '#e55a5a' : undefined }}
            onClick={() => { if (confirm) onDelete(initial.id); else { setConfirm(true); setTimeout(() => setConfirm(false), 4000); } }}>{confirm ? 'Tap again to delete' : 'Delete'}</button>
        )}
      </div>
    </div>
  );
}
