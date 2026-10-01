// RecipeBuilder — build a meal from ingredients, see the total and the per-serving numbers,
// and save it to My Meals (or update one). Rules: src/domain/recipes.js. Used on desktop
// (Fuel > Nutrition) and on the phone (a sheet).
import { useMemo, useState } from 'react';
import { searchOpenFoodFacts } from '../utils/openFoodFacts.js';
import { itemFromCustom } from '../domain/customFoods.js';
import { UNITS, blankItem, itemFromFood, itemFromEntry, rescaleItem, recipeTotals, perServing, recipeProblems, toSavedMeal } from '../domain/recipes.js';
import { label } from './ui.js';

const field = { height: 36, padding: '0 8px', borderRadius: 8, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', color: 'var(--text-primary)', fontSize: 13.5, fontFamily: 'inherit', minWidth: 0, boxSizing: 'border-box' };
const num = { ...field, fontFamily: 'var(--font-mono)', textAlign: 'right' };
const btn = { height: 36, padding: '0 14px', borderRadius: 9, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const primary = { ...btn, background: 'var(--tab-accent, var(--accent))', color: 'var(--on-tab-accent, #fff)', border: 'none' };
const chip = { ...btn, height: 32, padding: '0 12px', fontSize: 12.5, fontWeight: 500, borderRadius: 999 };
const cap = { ...label, marginBottom: 2 };

function Cell({ title, children, width }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, width, minWidth: 0 }}>
      <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</span>
      {children}
    </label>
  );
}

export default function RecipeBuilder({ initial, recent = [], foods = [], onSave, onCancel, onDelete, compact = false }) {
  const [name, setName] = useState(initial?.name || '');
  const [servings, setServings] = useState(initial?.servings || 1);
  const [items, setItems] = useState(() => (initial?.items?.length ? initial.items : []));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null = not searched yet
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [problems, setProblems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = !!initial?.id;

  const totals = useMemo(() => recipeTotals(items.filter(i => i.name.trim())), [items]);
  const per = useMemo(() => perServing(totals, servings), [totals, servings]);

  const patch = (idx, p) => setItems(list => list.map((it, k) => (k === idx ? { ...it, ...p } : it)));
  const remove = (idx) => setItems(list => list.filter((_, k) => k !== idx));
  const add = (item) => setItems(list => [...list, item]);

  async function search() {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true); setSearchError('');
    try { setResults((await searchOpenFoodFacts(q)).slice(0, 6)); }
    catch { setResults([]); setSearchError('Food search is unavailable right now. Add the ingredient by hand instead.'); }
    finally { setSearching(false); }
  }

  async function save() {
    const draft = { name, servings, items };
    const found = recipeProblems(draft);
    setProblems(found);
    if (found.length || saving) return;
    setSaving(true);
    try { await onSave(toSavedMeal(draft), initial?.id ?? null); } finally { setSaving(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Cell title="Recipe name"><input aria-label="Recipe name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chicken and rice" style={{ ...field, width: compact ? '100%' : 280 }} /></Cell>
        <Cell title="Makes (servings)" width={110}>
          <input aria-label="Servings" inputMode="numeric" value={servings} onChange={e => setServings(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} style={num} />
        </Cell>
      </div>

      <div>
        <div style={cap}>Add ingredients</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input aria-label="Search foods" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search(); }} placeholder="Search foods (e.g. basmati rice)" style={{ ...field, flex: 1, minWidth: 160 }} />
          <button type="button" style={btn} onClick={search} disabled={searching || !query.trim()}>{searching ? 'Searching…' : 'Search'}</button>
          <button type="button" style={btn} onClick={() => add(blankItem())}>Add by hand</button>
        </div>
        {searchError && <div role="alert" style={{ fontSize: 12.5, color: '#e55a5a', marginTop: 6 }}>{searchError}</div>}
        {results && !searchError && results.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 6 }}>No matches. Try another word, or add it by hand.</div>}
        {results && results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {results.map((f, i) => (
              <button key={`${f.name}-${i}`} type="button" onClick={() => { add(itemFromFood(f, 100)); setResults(null); setQuery(''); }}
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--hover-bg)', fontSize: 13.5, color: 'var(--text-primary)' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span style={{ color: 'var(--text-secondary)', flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{Math.round(f.per100?.calories || 0)} kcal / 100 g · add</span>
              </button>
            ))}
          </div>
        )}
        {foods.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ ...cap, marginBottom: 6 }}>My foods</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {foods.slice(0, 12).map(f => <button key={f.id ?? f.name} type="button" style={chip} onClick={() => add(itemFromCustom(f))}>+ {f.name}</button>)}
            </div>
          </div>
        )}
        {recent.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ ...cap, marginBottom: 6 }}>Recent foods</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {recent.slice(0, 8).map(r => <button key={r.name} type="button" style={chip} onClick={() => add(itemFromEntry(r))}>+ {r.name}</button>)}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={cap}>Ingredients{items.length ? ` · ${items.length}` : ''}</div>
        {items.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Search for a food, tap a recent one, or add one by hand. Change a quantity and its numbers scale with it.</div>}
        {items.map((it, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 12, background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <Cell title="Ingredient" width={compact ? '100%' : undefined}><input aria-label={`Ingredient ${idx + 1} name`} value={it.name} onChange={e => patch(idx, { name: e.target.value })} placeholder="Name" style={{ ...field, minWidth: compact ? 0 : 200, width: compact ? '100%' : 220 }} /></Cell>
              <Cell title="Qty" width={84}><input aria-label={`${it.name || 'Ingredient'} quantity`} inputMode="decimal" value={it.qty} onChange={e => setItems(list => list.map((x, k) => (k === idx ? rescaleItem(x, e.target.value.replace(/[^0-9.]/g, '')) : x)))} style={num} /></Cell>
              <Cell title="Unit" width={72}>
                <select aria-label={`${it.name || 'Ingredient'} unit`} value={it.unit} onChange={e => patch(idx, { unit: e.target.value })} style={{ ...field, paddingRight: 24 }}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
              </Cell>
              <button type="button" aria-label={`Remove ${it.name || 'ingredient'}`} onClick={() => remove(idx)} style={{ ...btn, width: 36, padding: 0, marginLeft: 'auto' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
              {[['calories', 'kcal'], ['protein', 'Protein g'], ['carbs', 'Carbs g'], ['fat', 'Fat g']].map(([k, t]) => (
                <Cell key={k} title={t}><input aria-label={`${it.name || 'Ingredient'} ${t}`} inputMode="decimal" value={it[k]} onChange={e => patch(idx, { [k]: e.target.value.replace(/[^0-9.]/g, '') })} style={num} /></Cell>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px', borderRadius: 12, border: '0.5px solid var(--card-border)' }}>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Whole recipe: <span className="val-num" style={{ color: 'var(--text-primary)' }}>{totals.calories} kcal · P{totals.protein} C{totals.carbs} F{totals.fat}</span></div>
        <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 600 }}>Per serving ({Math.max(1, Number(servings) || 1)}): <span className="val-num">{per.calories} kcal · P{per.protein} C{per.carbs} F{per.fat}</span></div>
      </div>

      {problems.length > 0 && <ul role="alert" style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#e55a5a', lineHeight: 1.5 }}>{problems.map(p => <li key={p}>{p}</li>)}</ul>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={primary} onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update recipe' : 'Save recipe'}</button>
        <button type="button" style={btn} onClick={onCancel}>Cancel</button>
        {editing && onDelete && (
          <button type="button" style={{ ...btn, marginLeft: 'auto', color: confirmDelete ? '#e55a5a' : 'var(--text-secondary)', borderColor: confirmDelete ? '#e55a5a' : undefined }}
            onClick={() => { if (confirmDelete) onDelete(initial.id); else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 4000); } }}>{confirmDelete ? 'Tap again to delete' : 'Delete'}</button>
        )}
      </div>
    </div>
  );
}
