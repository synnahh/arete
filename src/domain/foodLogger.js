// foodLogger.js — the logic behind the add-food flow. Pure.
//
// One search box finds everything at once: your favourites, what you eat often,
// your own foods and saved meals first, then the food database. Whatever you pick
// becomes a "food" with an amount to choose (grams, or servings), and the amount you
// used last time is remembered, so logging your usual 180 g of chicken is one tap.
//
// A food: { key, kind, name, sub, amountKind: 'grams' | 'servings', per100? (grams),
//           fixed? (servings), defaultAmount, unit, source?, ingredients? }

import { customFoodEntry, favouriteEntry, servingText } from './customFoods.js';
import { mealEntry } from './recipes.js';
import { mealSection, SECTIONS, cleanIngredients } from './foods.js';
import { scaleMicros } from '../utils/micronutrients.js';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r1 = (n) => Math.round(n * 10) / 10;
const clock = (now) => `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

export const portionKey = (name) => norm(name);

// ── Building foods from what you have ─────────────────────────────────────────

function fromEntry(kind, e) {
  const grams = String(e?.unit || '').toLowerCase() === 'g' && num(e?.qty) > 0;
  const base = {
    kind, name: String(e.name).trim(), source: e,
    ingredients: cleanIngredients(e.ingredients),
  };
  if (grams) {
    const f = 100 / num(e.qty);
    return {
      ...base, key: `${kind}:${norm(e.name)}`, amountKind: 'grams', unit: 'g', defaultAmount: num(e.qty),
      per100: { calories: num(e.calories) * f, protein: num(e.protein) * f, carbs: num(e.carbs) * f, fat: num(e.fat) * f, micros: scaleMicros(e.micros || {}, f) },
      sub: `${Math.round(num(e.calories))} kcal · ${Math.round(num(e.qty))} g`,
    };
  }
  return {
    ...base, key: `${kind}:${norm(e.name)}`, amountKind: 'servings', unit: 'serving', defaultAmount: 1,
    fixed: { calories: num(e.calories), protein: num(e.protein), carbs: num(e.carbs), fat: num(e.fat), micros: e.micros || {} },
    sub: `${Math.round(num(e.calories))} kcal · P${Math.round(num(e.protein))}`,
  };
}

/** Everything you already own, as foods, in search order: favourites, recents, your foods, your meals. */
export function localFoods({ favourites = [], recents = [], customFoods = [], savedMeals = [] } = {}) {
  const out = [];
  const seen = new Set();
  const push = (food) => { if (!food.name || seen.has(norm(food.name))) return; seen.add(norm(food.name)); out.push(food); };

  for (const f of favourites) if (f?.name && num(f.calories) > 0) push({ ...fromEntry('favourite', f), starred: true });
  recents.forEach((r, i) => { if (r?.name && num(r.calories) > 0) push({ ...fromEntry('recent', r), uses: r.count ?? 0, rank: i }); });
  for (const c of customFoods) {
    if (!c?.name) continue;
    const name = c.brand ? `${c.name} (${c.brand})` : c.name;
    push({
      key: `custom:${c.id}`, kind: 'custom', name, source: c, amountKind: 'servings', unit: servingText(c), defaultAmount: 1,
      fixed: { calories: num(c.calories), protein: num(c.protein), carbs: num(c.carbs), fat: num(c.fat), micros: {} },
      sub: `${Math.round(num(c.calories))} kcal · per ${servingText(c)}`, ingredients: [],
    });
  }
  for (const m of savedMeals) {
    if (!m?.name) continue;
    push({
      key: `meal:${m.id}`, kind: 'meal', name: m.name, source: m, amountKind: 'servings', unit: 'serving', defaultAmount: 1,
      fixed: { calories: num(m.calories), protein: num(m.protein), carbs: num(m.carbs), fat: num(m.fat), micros: m.micros || {} },
      sub: `${Math.round(num(m.calories))} kcal · P${Math.round(num(m.protein))} · meal`, ingredients: cleanIngredients(m.ingredients),
    });
  }
  return out;
}

/** A database result ({ name, per100 }) as a food. */
export function remoteFood(r) {
  return {
    key: `db:${norm(r.name)}`, kind: 'db', name: r.name, amountKind: 'grams', unit: 'g', defaultAmount: 100,
    per100: { calories: num(r.per100?.calories), protein: num(r.per100?.protein), carbs: num(r.per100?.carbs), fat: num(r.per100?.fat), micros: r.per100?.micros || {} },
    sub: `${Math.round(num(r.per100?.calories))} kcal / 100 g`, source: r, ingredients: [],
  };
}

// ── Search ────────────────────────────────────────────────────────────────────

const KIND_BOOST = { favourite: 18, recent: 8, custom: 10, meal: 10, db: 0 };

/** Your own foods that match, best first. Empty query returns your quick picks (favourites, then most-eaten). */
export function searchLocal(query, foods = [], limit = 8) {
  const q = norm(query);
  if (!q) return quickPicks(foods, limit);
  const words = q.split(' ');
  const scored = [];
  for (const f of foods) {
    const name = norm(f.name);
    if (!words.every(w => name.includes(w))) continue;
    let s = name === q ? 100 : name.startsWith(q) ? 60 : name.split(' ').some(t => t.startsWith(words[0])) ? 40 : 20;
    s += KIND_BOOST[f.kind] ?? 0;
    s += Math.min(f.uses ?? 0, 10);
    scored.push({ f, s });
  }
  return scored.sort((a, b) => b.s - a.s || a.f.name.localeCompare(b.f.name)).slice(0, limit).map(x => x.f);
}

/** Favourites first, then recents in their eaten-often order. */
export function quickPicks(foods = [], limit = 8) {
  const fav = foods.filter(f => f.kind === 'favourite');
  const rec = foods.filter(f => f.kind === 'recent');
  return [...fav, ...rec].slice(0, limit);
}

/** Local matches first, then database results that are not the same food. */
export function mergeResults(local = [], remote = [], limit = 14) {
  const names = new Set(local.map(f => norm(f.name)));
  const keys = new Set(local.map(f => f.key));
  const extra = [];
  for (const f of remote) {
    if (names.has(norm(f.name)) || keys.has(f.key)) continue;     // already shown, or the same product listed twice
    keys.add(f.key);
    extra.push(f);
  }
  return [...local, ...extra].slice(0, limit);
}

// ── Amounts ───────────────────────────────────────────────────────────────────

/** Macros for an amount: grams for per-100 g foods, a multiplier of one serving otherwise. */
export function macrosFor(food, amount) {
  const a = Math.max(0, num(amount));
  if (food.amountKind === 'grams') {
    const k = a / 100;
    return { calories: Math.round(food.per100.calories * k), protein: r1(food.per100.protein * k), carbs: r1(food.per100.carbs * k), fat: r1(food.per100.fat * k), micros: scaleMicros(food.per100.micros || {}, k) };
  }
  return { calories: Math.round(food.fixed.calories * a), protein: r1(food.fixed.protein * a), carbs: r1(food.fixed.carbs * a), fat: r1(food.fixed.fat * a), micros: scaleMicros(food.fixed.micros || {}, a) };
}

/** Quick amounts to tap: what you used last time first, then sensible steps. */
export function amountChips(food, remembered = null) {
  const steps = food.amountKind === 'grams' ? [50, 100, 150, 200, 250] : [0.5, 1, 1.5, 2, 3];
  const first = num(remembered) > 0 ? num(remembered) : food.defaultAmount;
  return [...new Set([first, ...steps])].slice(0, 6);
}

/** The amount to start from: what you used last time, else the food's own default. */
export function startAmount(food, memory = {}) {
  const m = num(memory[portionKey(food.name)]);
  return m > 0 ? m : food.defaultAmount;
}

// ── Making the log entry ──────────────────────────────────────────────────────

export const SLOT_TIME = { breakfast: '08:00', lunch: '12:30', dinner: '18:30', snacks: '15:30' };

/** Which meal section "now" falls in (the chip that is pre-selected). */
export const defaultSection = (now = new Date()) => mealSection(clock(now));

/**
 * The nutrition-log entry. Saved meals and your own foods reuse their existing
 * builders; everything else is built here. `section` is stored so a lunch logged at
 * 3 pm still shows under Lunch.
 */
export function entryFor(food, amount, { now = new Date(), section } = {}) {
  const a = num(amount) > 0 ? num(amount) : food.defaultAmount;
  let entry;
  if (food.kind === 'meal') entry = { ...mealEntry(food.source, a, now), time: clock(now) };
  else if (food.kind === 'custom') entry = customFoodEntry(food.source, a, now);
  else {
    const m = macrosFor(food, a);
    entry = {
      id: `m_${now.getTime()}`, name: food.name, ...m,
      qty: food.amountKind === 'grams' ? a : (food.defaultAmount === 1 && a === 1 ? (food.source?.qty ?? null) : null),
      unit: food.amountKind === 'grams' ? 'g' : (food.source?.unit ?? null),
      time: clock(now),
    };
    if (food.kind === 'favourite' && food.amountKind === 'servings' && a === 1) entry = { ...favouriteEntry(food.source, now) };
    if (food.ingredients?.length) entry.ingredients = food.ingredients.map(i => ({ ...i }));
  }
  if (SECTIONS.some(s => s.id === section)) entry.section = section;
  return entry;
}

/** A hand-typed food as a nutrition-log entry (name and calories required). */
export function quickFoodEntry({ name, calories, protein = 0, carbs = 0, fat = 0 }, { now = new Date(), section } = {}) {
  const kcal = Math.round(num(calories));
  if (!(kcal > 0)) return null;
  const entry = { id: `m_${now.getTime()}`, name: String(name || '').trim() || 'Quick add', calories: kcal, protein: r1(num(protein)), carbs: r1(num(carbs)), fat: r1(num(fat)), micros: {}, qty: null, unit: null, time: clock(now) };
  if (SECTIONS.some(s => s.id === section)) entry.section = section;
  return entry;
}

/** The remembered-amount map after logging `amount` of `food` (newest first, capped). */
export function remember(memory = {}, food, amount, cap = 300) {
  const key = portionKey(food.name);
  const a = num(amount);
  if (!key || !(a > 0)) return memory;
  const { [key]: _old, ...rest } = memory;
  return Object.fromEntries(Object.entries({ [key]: a, ...rest }).slice(0, cap));
}
