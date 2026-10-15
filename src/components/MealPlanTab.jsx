// MealPlanTab — your own weekly meal plan, with no AI link needed. Build it by hand, pick from
// your saved recipes, or paste a plan that Claude/ChatGPT (or anyone) wrote for you: copy the
// prompt from the Import tab, give it to the AI, paste the answer back. Rules and the reader
// live in domain/mealPlanImport.js. The plan is the `meal_plan` document, which Supplies reads
// to build the shopping list, so the shape ({ plan: [{ day, meals, totals }] }) is unchanged.
import { useEffect, useMemo, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument } from '../supabase/useDocument.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { currencySymbol } from '../utils/currency.js';
import { Sheet } from './Motion.jsx';
import RecipeBuilder from './RecipeBuilder.jsx';
import { useFoodLibrary } from '../hooks/useFoodLibrary.js';
import { appendMeals, mealFromPlan } from '../domain/foods.js';
import { draftFromSaved } from '../domain/recipes.js';
import {
  PLAN_DAYS, MEAL_TYPES, emptyPlan, makeDay, withTotals, mergePlans, planIngredients, parseMealPlan,
  buildPlanPrompt, parseIngredientLines, ingredientsToText, cleanMeal,
} from '../domain/mealPlanImport.js';

const TYPE_COLOUR = { breakfast: '#f4a642', lunch: '#4caf7d', dinner: '#4a9eff', snack: '#9b5de5' };
const toast = (message, type = 'success', undo) => window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type, ...(undo ? { undo } : {}) } }));

const card = { padding: 16, borderRadius: 14, background: 'var(--card-fill)', border: '0.5px solid var(--card-border)' };
const field = { width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '0 12px', borderRadius: 10, border: '0.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 16 };
const cap = { fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' };
const btn = (primary) => ({
  minHeight: 44, padding: '0 16px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: primary ? 700 : 500, WebkitTapHighlightColor: 'transparent',
  border: primary ? 'none' : '0.5px solid var(--card-border)', background: primary ? 'var(--tab-accent, var(--accent))' : 'var(--hover-bg)', color: primary ? 'var(--on-tab-accent, #111)' : 'var(--text-primary)',
});
const small = { minHeight: 36, padding: '0 12px', fontSize: 13 };

const BLANK = { name: '', type: 'dinner', calories: '', protein: '', carbs: '', fat: '', ingredients: '', description: '' };

export default function MealPlanTab({ settings = {}, savedMeals = [], addSavedMeal, updateSavedMeal, removeSavedMeal }) {
  const sym = currencySymbol(settings?.currency);
  const goals = settings?.macros ?? {};
  const targets = { calories: settings?.macroGoal ?? 2300, protein: settings?.proteinGoal ?? 150, carbs: goals.carbs ?? 250, fat: goals.fat ?? 70 };

  const { data: savedPlan, save: savePlanDoc } = useDocument('meal_plan', STORAGE_KEYS.MEAL_PLANS, null);
  const [plan, setPlan] = useState(() => (savedPlan?.plan?.length ? savedPlan.plan : null));
  useEffect(() => { if (!plan && savedPlan?.plan?.length) setPlan(savedPlan.plan); }, [savedPlan]); // eslint-disable-line react-hooks/exhaustive-deps
  const nutrition = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);
  const lib = useFoodLibrary();

  const [view, setView] = useState('plan'); // plan | recipes | import
  const [activeDay, setActiveDay] = useState(() => Math.max(0, (new Date().getDay() + 6) % 7));
  const [form, setForm] = useState(null); // null | { index: number|null, ...BLANK }
  const [recipeDraft, setRecipeDraft] = useState(null);
  const [showList, setShowList] = useState(false);

  const commit = (next, note) => {
    const clean = withTotals(next);
    setPlan(clean);
    savePlanDoc({ generatedOn: toLocalDateKey(new Date()), plan: clean, source: 'manual' });
    if (note) toast(note);
  };

  const day = plan?.[activeDay] ?? null;
  const dayIndex = Math.min(activeDay, Math.max(0, (plan?.length ?? 1) - 1));
  useEffect(() => { if (plan && activeDay > plan.length - 1) setActiveDay(plan.length - 1); }, [plan, activeDay]);

  // ── plan edits ────────────────────────────────────────────────────────────
  const setDayMeals = (idx, meals, note) => commit(plan.map((d, i) => (i === idx ? makeDay(d.day, meals) : d)), note);

  const submitForm = () => {
    const meal = cleanMeal({
      name: form.name, type: form.type, calories: form.calories, protein: form.protein, carbs: form.carbs, fat: form.fat,
      description: form.description, ingredients: parseIngredientLines(form.ingredients),
    });
    if (!meal) { toast('Give the meal a name', 'error'); return; }
    if (!meal.calories) { toast('Add its calories so the day adds up', 'error'); return; }
    const meals = [...(day.meals || [])];
    if (form.index == null) meals.push(meal); else meals[form.index] = meal;
    setDayMeals(dayIndex, meals, form.index == null ? `Added ${meal.name} to ${day.day}` : `Updated ${meal.name}`);
    setForm(null);
  };

  const removeMeal = (mi) => {
    const before = plan;
    const gone = day.meals[mi];
    setDayMeals(dayIndex, day.meals.filter((_, i) => i !== mi));
    toast(`Removed ${gone.name}`, 'success', () => { setPlan(before); savePlanDoc({ generatedOn: toLocalDateKey(new Date()), plan: before, source: 'manual' }); });
  };

  const addRecipeToDay = (recipe, dayName) => {
    const target = plan.findIndex(d => d.day === dayName);
    if (target < 0) return;
    const meal = cleanMeal({ name: recipe.name, type: recipe.section === 'snacks' ? 'snack' : recipe.section, calories: recipe.calories, protein: recipe.protein, carbs: recipe.carbs, fat: recipe.fat, ingredients: recipe.ingredients, description: recipe.description });
    if (!meal) return;
    setDayMeals(target, [...plan[target].meals, meal], `${recipe.name} added to ${dayName}`);
  };

  const saveAsRecipe = async (meal) => {
    if (savedMeals.some(s => String(s.name).toLowerCase() === meal.name.toLowerCase())) { toast(`${meal.name} is already in your recipes`); return; }
    const ok = await addSavedMeal({ name: meal.name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, ...(meal.ingredients ? { ingredients: meal.ingredients } : {}), ...(meal.description ? { description: meal.description } : {}) });
    if (ok !== false) toast(`${meal.name} saved to your recipes`);
  };

  const logNow = async (meal) => {
    const entry = mealFromPlan(meal);
    if (!entry) { toast('That meal has no calories to log', 'error'); return; }
    const dayKey = toLocalDateKey(new Date());
    const existing = nutrition.items.find(l => l.date === dayKey);
    const prev = existing ? { meals: existing.meals, calories: existing.calories, protein: existing.protein, carbs: existing.carbs, fat: existing.fat } : { meals: [], calories: 0, protein: 0, carbs: 0, fat: 0 };
    const row = appendMeals(existing, [entry], dayKey);
    const fields = { meals: row.meals, calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat };
    if (existing?.id) await nutrition.update(existing.id, fields); else await nutrition.add({ date: dayKey, ...fields });
    toast(`Logged ${entry.name} · ${entry.calories} kcal`, 'success', async () => {
      const saved = storage.get(STORAGE_KEYS.MACROS, []).find(l => l.date === dayKey && !String(l.id).startsWith('local_'));
      if (saved) await nutrition.update(saved.id, prev);
    });
  };

  const weeklyCost = useMemo(() => (plan || []).reduce((s, d) => s + (d.totals?.cost || 0), 0), [plan]);
  const groceries = useMemo(() => planIngredients(plan), [plan]);

  const colourFor = (actual, target) => { const p = actual / Math.max(target, 1); return p >= 0.9 && p <= 1.1 ? '#4caf7d' : p >= 0.8 ? '#f4a642' : '#e25d7a'; };

  const tabBtn = (id, text) => (
    <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} style={{ ...btn(false), flex: 1, fontWeight: view === id ? 700 : 500, border: `1px solid ${view === id ? 'var(--tab-accent, var(--accent))' : 'var(--card-border)'}`, color: view === id ? 'var(--tab-accent, var(--accent))' : 'var(--text-primary)', background: view === id ? 'var(--active-bg)' : 'transparent' }}>{text}</button>
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '18px clamp(14px, 3vw, 24px) 48px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Meal plan</h2>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Your week, your recipes. Build it here, or bring one in from Claude or ChatGPT.</div>
        </div>
        <div role="group" aria-label="Meal plan sections" style={{ display: 'flex', gap: 8 }}>
          {tabBtn('plan', 'Plan')}{tabBtn('recipes', `Recipes${savedMeals.length ? ` (${savedMeals.length})` : ''}`)}{tabBtn('import', 'Import')}
        </div>

        {view === 'plan' && (!plan ? (
          <div style={{ ...card, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, padding: '28px 18px' }}>
            <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 600 }}>No plan yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Start with a blank week and add meals, or paste a plan someone (or an AI) wrote for you.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" style={btn(true)} onClick={() => commit(emptyPlan())}>Start a blank week</button>
              <button type="button" style={btn(false)} onClick={() => setView('import')}>Import a plan</button>
            </div>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label="Day" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {plan.map((d, i) => (
                <button key={d.day + i} role="tab" aria-selected={dayIndex === i} type="button" onClick={() => { setActiveDay(i); setForm(null); }} style={{ flexShrink: 0, minHeight: 40, padding: '0 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: dayIndex === i ? 700 : 500, border: `1px solid ${dayIndex === i ? 'var(--accent)' : 'var(--card-border)'}`, background: dayIndex === i ? 'var(--active-bg)' : 'transparent', color: dayIndex === i ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {d.day.length > 5 ? d.day.slice(0, 3) : d.day}{d.meals.length ? ` · ${d.meals.length}` : ''}
                </button>
              ))}
            </div>

            {day && (
              <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
                {[['Calories', day.totals.calories, targets.calories, ''], ['Protein', day.totals.protein, targets.protein, 'g'], ['Carbs', day.totals.carbs, targets.carbs, 'g'], ['Fat', day.totals.fat, targets.fat, 'g']].map(([l, v, t, u]) => (
                  <div key={l}>
                    <div style={cap}>{l}</div>
                    <div className="val-num" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, color: v ? colourFor(v, t) : 'var(--text-muted)' }}>{Math.round(v)}{u}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>target {t}{u}</div>
                  </div>
                ))}
                {day.totals.cost > 0 && <div><div style={cap}>Food cost</div><div className="val-num" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, color: '#f4a642' }}>{sym}{day.totals.cost.toFixed(2)}</div></div>}
              </div>
            )}

            {day && day.meals.map((meal, mi) => {
              const colour = TYPE_COLOUR[meal.type] ?? 'var(--accent)';
              return (
                <div key={`${meal.name}-${mi}`} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: colour, flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{meal.name}</span>
                    <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 99, background: `${colour}22`, color: colour, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{meal.type}</span>
                  </div>
                  {meal.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{meal.description}</div>}
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span><b className="val-num" style={{ color: '#f4a642' }}>{meal.calories}</b> kcal</span>
                    <span><b className="val-num" style={{ color: '#4a9eff' }}>{meal.protein}</b>g P</span>
                    <span><b className="val-num" style={{ color: '#4caf7d' }}>{meal.carbs}</b>g C</span>
                    <span><b className="val-num" style={{ color: '#9b5de5' }}>{meal.fat}</b>g F</span>
                    {meal.estimatedCost != null && <span style={{ marginLeft: 'auto' }}>{sym}{meal.estimatedCost.toFixed(2)}</span>}
                  </div>
                  {meal.ingredients?.length > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{meal.ingredients.map(i => `${i.qty}${i.unit ? ` ${i.unit}` : '×'} ${i.name}`).join(' · ')}</div>}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" style={{ ...btn(true), ...small }} onClick={() => logNow(meal)}>Log now</button>
                    <button type="button" style={{ ...btn(false), ...small }} onClick={() => saveAsRecipe(meal)}>Save as recipe</button>
                    <button type="button" style={{ ...btn(false), ...small }} onClick={() => setForm({ index: mi, name: meal.name, type: meal.type, calories: String(meal.calories), protein: String(meal.protein), carbs: String(meal.carbs), fat: String(meal.fat), ingredients: ingredientsToText(meal.ingredients), description: meal.description || '' })}>Edit</button>
                    <button type="button" style={{ ...btn(false), ...small, marginLeft: 'auto' }} onClick={() => removeMeal(mi)}>Remove</button>
                  </div>
                </div>
              );
            })}

            {day && !day.meals.length && !form && <div style={{ ...card, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13.5 }}>Nothing planned for {day.day} yet.</div>}

            {form ? (
              <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{form.index == null ? `Add a meal to ${day?.day}` : 'Edit meal'}</div>
                <input aria-label="Meal name" placeholder="Meal name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={field} />
                <div role="group" aria-label="Meal type" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {MEAL_TYPES.map(t => <button key={t} type="button" aria-pressed={form.type === t} onClick={() => setForm({ ...form, type: t })} style={{ ...btn(false), ...small, textTransform: 'capitalize', border: `1px solid ${form.type === t ? TYPE_COLOUR[t] : 'var(--card-border)'}`, color: form.type === t ? TYPE_COLOUR[t] : 'var(--text-primary)' }}>{t}</button>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                  {[['calories', 'Kcal'], ['protein', 'Protein g'], ['carbs', 'Carbs g'], ['fat', 'Fat g']].map(([k, l]) => (
                    <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}><span style={cap}>{l}</span><input inputMode="decimal" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} style={{ ...field, padding: '0 8px' }} /></label>
                  ))}
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={cap}>Ingredients (one per line, optional, feeds your shopping list)</span>
                  <textarea rows={3} value={form.ingredients} onChange={e => setForm({ ...form, ingredients: e.target.value })} placeholder={'200 g chicken breast\n2 eggs'} style={{ ...field, padding: 10, minHeight: 80, resize: 'vertical' }} /></label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={cap}>Notes (optional)</span>
                  <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={field} /></label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={btn(true)} onClick={submitForm}>{form.index == null ? 'Add meal' : 'Save changes'}</button>
                  <button type="button" style={btn(false)} onClick={() => setForm(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={btn(true)} onClick={() => setForm({ ...BLANK, index: null })}>+ Add a meal</button>
                {savedMeals.length > 0 && (
                  <select aria-label="Add from my recipes" value="" onChange={e => { const r = savedMeals.find(s => String(s.id) === e.target.value); if (r && day) addRecipeToDay(r, day.day); }} style={{ ...field, width: 'auto', minWidth: 190, cursor: 'pointer' }}>
                    <option value="">+ From my recipes…</option>
                    {savedMeals.map(s => <option key={s.id} value={s.id}>{s.name} · {Math.round(s.calories)} kcal</option>)}
                  </select>
                )}
              </div>
            )}

            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="button" onClick={() => setShowList(v => !v)} aria-expanded={showList} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                Shopping list{groceries.length ? ` (${groceries.length})` : ''}<span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }}>{showList ? 'Hide' : 'Show'}</span>
              </button>
              {showList && (groceries.length ? (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 4 }}>
                  {groceries.map(i => <li key={`${i.name}|${i.unit}`} style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}><b className="val-num" style={{ color: 'var(--text-primary)' }}>{i.qty}{i.unit ? ` ${i.unit}` : '×'}</b> {i.name}</li>)}
                </ul>
              ) : <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Add ingredients to your meals and the week adds up here. Supplies uses the same list.</div>)}
              {weeklyCost > 0 && <div style={{ fontSize: 13, color: '#f4a642' }}>Estimated {sym}{weeklyCost.toFixed(2)} for the week</div>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" style={{ ...btn(false), ...small }} onClick={() => {
                if (!window.confirm('Clear the whole plan? Your saved recipes are not touched.')) return;
                const before = plan; setPlan(null); savePlanDoc({ generatedOn: toLocalDateKey(new Date()), plan: [], source: 'manual' });
                toast('Plan cleared', 'success', () => { setPlan(before); savePlanDoc({ generatedOn: toLocalDateKey(new Date()), plan: before, source: 'manual' }); });
              }}>Clear plan</button>
            </div>
          </>
        ))}

        {view === 'recipes' && (
          <>
            <button type="button" style={{ ...btn(true), alignSelf: 'flex-start' }} onClick={() => setRecipeDraft({ initial: null })}>+ New recipe</button>
            {!savedMeals.length && <div style={{ ...card, color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.5 }}>No recipes yet. Build one from ingredients, or save any planned meal as a recipe. Saved recipes also show up in the food logger for one-tap logging.</div>}
            {savedMeals.map(r => (
              <div key={r.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{Math.round(r.calories)} kcal · P {Math.round(r.protein || 0)} · C {Math.round(r.carbs || 0)} · F {Math.round(r.fat || 0)}{r.ingredients?.length ? ` · ${r.ingredients.length} ingredients` : ''}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {plan ? (
                    <select aria-label={`Add ${r.name} to a day`} value="" onChange={e => { if (e.target.value) addRecipeToDay(r, e.target.value); }} style={{ ...field, width: 'auto', minHeight: 36, fontSize: 13, cursor: 'pointer' }}>
                      <option value="">Add to plan…</option>
                      {plan.map(d => <option key={d.day} value={d.day}>{d.day}</option>)}
                    </select>
                  ) : <button type="button" style={{ ...btn(false), ...small }} onClick={() => { commit(emptyPlan()); setView('plan'); }}>Start a plan to add it</button>}
                  <button type="button" style={{ ...btn(false), ...small }} onClick={() => setRecipeDraft({ initial: { ...draftFromSaved(r), id: r.id } })}>Edit</button>
                </div>
              </div>
            ))}
          </>
        )}

        {view === 'import' && <ImportPanel targets={targets} currency={settings?.currency || 'AUD'} hasPlan={!!plan?.some(d => d.meals.length)} onUse={(incoming, mode) => {
          commit(mode === 'replace' || !plan ? incoming : mergePlans(plan, incoming), mode === 'replace' || !plan ? 'Plan imported' : 'Meals added to your plan');
          setActiveDay(0); setView('plan');
        }} />}
      </div>

      <Sheet wide open={!!recipeDraft} onClose={() => setRecipeDraft(null)} title={recipeDraft?.initial?.id ? 'Edit recipe' : 'Build a recipe'}>
        {recipeDraft && (
          <RecipeBuilder key={recipeDraft.initial?.id || 'new'} initial={recipeDraft.initial} recent={[]} foods={lib.customFoods}
            onCancel={() => setRecipeDraft(null)}
            onDelete={async (id) => { await removeSavedMeal(id); setRecipeDraft(null); }}
            onSave={async (row, id) => {
              const ok = id ? await updateSavedMeal(id, row) : await addSavedMeal(row);
              if (ok) { setRecipeDraft(null); toast(id ? 'Recipe updated' : 'Recipe saved'); }
            }} />
        )}
      </Sheet>
    </div>
  );
}

function ImportPanel({ targets, currency, hasPlan, onUse }) {
  const [t, setT] = useState({ calories: String(targets.calories), protein: String(targets.protein), carbs: String(targets.carbs), fat: String(targets.fat), mealsPerDay: '4', notes: '' });
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);

  const prompt = useMemo(() => buildPlanPrompt({ calories: +t.calories || targets.calories, protein: +t.protein || targets.protein, carbs: +t.carbs || targets.carbs, fat: +t.fat || targets.fat, mealsPerDay: +t.mealsPerDay || 4, notes: t.notes, currency }), [t, targets, currency]);

  async function copy() {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 2200); }
    catch { toast('Could not copy. Select the text and copy it by hand.', 'error'); }
  }

  return (
    <>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>1. Get a plan from Claude or ChatGPT</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Set your targets, copy the prompt, paste it into Claude or ChatGPT, and paste its reply into step 2. No AI is connected to this app, so nothing leaves your phone until you paste it yourself.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8 }}>
          {[['calories', 'Kcal'], ['protein', 'Protein g'], ['carbs', 'Carbs g'], ['fat', 'Fat g'], ['mealsPerDay', 'Meals/day']].map(([k, l]) => (
            <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}><span style={cap}>{l}</span><input inputMode="numeric" value={t[k]} onChange={e => setT({ ...t, [k]: e.target.value })} style={{ ...field, padding: '0 8px' }} /></label>
          ))}
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={cap}>Notes for the AI (optional)</span><input value={t.notes} onChange={e => setT({ ...t, notes: e.target.value })} placeholder="e.g. no dairy, quick lunches, beef bowl twice a week" style={field} /></label>
        <details><summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>See the prompt</summary><pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--hover-bg)', padding: 10, borderRadius: 10, userSelect: 'text', maxHeight: 260, overflow: 'auto' }}>{prompt}</pre></details>
        <button type="button" style={{ ...btn(true), alignSelf: 'flex-start' }} onClick={copy}>{copied ? 'Copied' : 'Copy prompt'}</button>
      </div>

      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>2. Paste the plan</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Paste the AI's reply, a document, or your own notes. Plain text works too: a day heading, then lines like “Breakfast: Oats and whey, 450 kcal, 35P 55C 9F”.</div>
        <textarea aria-label="Pasted meal plan" rows={8} value={text} onChange={e => { setText(e.target.value); setResult(null); }} placeholder="Paste here" style={{ ...field, padding: 10, minHeight: 160, resize: 'vertical', fontSize: 14 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={btn(true)} disabled={!text.trim()} onClick={() => setResult(parseMealPlan(text))}>Read plan</button>
          {text && <button type="button" style={btn(false)} onClick={() => { setText(''); setResult(null); }}>Clear</button>}
        </div>
        {result && !result.ok && <div role="alert" style={{ fontSize: 13, color: '#e25d7a', padding: '8px 12px', borderRadius: 10, background: 'rgba(226,93,122,0.08)', border: '0.5px solid rgba(226,93,122,0.25)' }}>{result.reason}</div>}
        {result?.ok && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>Found {result.meals} meals across {result.plan.length} day{result.plan.length === 1 ? '' : 's'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {result.plan.map(d => <div key={d.day} style={{ fontSize: 13, color: 'var(--text-secondary)' }}><b style={{ color: 'var(--text-primary)' }}>{d.day}</b> · {d.meals.map(m => m.name).join(', ')} · {d.totals.calories} kcal, {Math.round(d.totals.protein)}g protein</div>)}
            </div>
            {result.warnings.map((w, i) => <div key={i} style={{ fontSize: 12.5, color: '#f4a642' }}>{w}</div>)}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={btn(true)} onClick={() => { if (!hasPlan || window.confirm('Replace your current plan with this one?')) onUse(result.plan, 'replace'); }}>{hasPlan ? 'Replace my plan' : 'Use this plan'}</button>
              {hasPlan && <button type="button" style={btn(false)} onClick={() => onUse(result.plan, 'merge')}>Add to my plan</button>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
