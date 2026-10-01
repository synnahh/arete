// recipes.js — build a meal from ingredients and save it for one-tap logging. Pure; UI is
// components/RecipeBuilder.jsx.
//
// A saved meal's top-level numbers (calories, protein, carbs, fat, micros, ingredients) are ONE
// SERVING, which is exactly what logging reads, so recipes and plain saved meals log the same
// way. `recipe: { servings, items }` keeps the whole recipe so it can be edited later; items are
// the whole-recipe ingredients with their macros for the quantity used.
import { scaleMicros, sumMicros } from '../utils/micronutrients.js';

export const UNITS = ['g', 'ml', 'each'];
export const MAX_ITEMS = 40;

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
const r1 = (n) => Math.round(n * 10) / 10;

export const blankItem = () => ({ name: '', qty: 100, unit: 'g', calories: 0, protein: 0, carbs: 0, fat: 0, micros: {} });

/** An ingredient from a food-database result ({ name, per100 }) at `qty` g or ml. */
export function itemFromFood(food, qty = 100, unit = 'g') {
  const q = num(qty), f = q / 100, p = food?.per100 || {};
  return {
    name: String(food?.name || '').trim(), qty: q, unit: unit === 'ml' ? 'ml' : 'g',
    calories: Math.round(num(p.calories) * f), protein: r1(num(p.protein) * f), carbs: r1(num(p.carbs) * f), fat: r1(num(p.fat) * f),
    micros: scaleMicros(p.micros, f),
  };
}

/** An ingredient from something you have logged before (a recent food): its numbers as logged. */
export function itemFromEntry(entry) {
  const hasQty = num(entry?.qty) > 0;
  return {
    name: String(entry?.name || '').trim(),
    qty: hasQty ? num(entry.qty) : 1, unit: hasQty && ['g', 'ml'].includes(entry.unit) ? entry.unit : 'each',
    calories: Math.round(num(entry?.calories)), protein: r1(num(entry?.protein)), carbs: r1(num(entry?.carbs)), fat: r1(num(entry?.fat)),
    micros: entry?.micros || {},
  };
}

/**
 * Change an ingredient's quantity; its numbers scale with it. `qty` is kept as typed so a field can
 * be cleared and retyped: while it is empty or zero the numbers stay as they were and the per-unit
 * values are remembered (`per`), so typing a quantity again scales from them.
 */
export function rescaleItem(item, newQty) {
  const q = num(newQty), old = num(item?.qty);
  const per = old > 0
    ? { calories: num(item.calories) / old, protein: num(item.protein) / old, carbs: num(item.carbs) / old, fat: num(item.fat) / old, micros: scaleMicros(item.micros, 1 / old) }
    : item?.per || null;
  if (!(q > 0) || !per) return { ...item, qty: newQty, ...(per ? { per } : {}) };
  return { ...item, qty: newQty, per, calories: Math.round(per.calories * q), protein: r1(per.protein * q), carbs: r1(per.carbs * q), fat: r1(per.fat * q), micros: scaleMicros(per.micros, q) };
}

/** Whole-recipe totals. */
export function recipeTotals(items = []) {
  const sum = (k) => items.reduce((s, i) => s + num(i?.[k]), 0);
  return { calories: Math.round(sum('calories')), protein: r1(sum('protein')), carbs: r1(sum('carbs')), fat: r1(sum('fat')), micros: sumMicros(items.map(i => i?.micros)) };
}

/** One serving of a recipe of `servings` servings. */
export function perServing(totals, servings) {
  const s = Math.max(1, num(servings) || 1);
  return { calories: Math.round(totals.calories / s), protein: r1(totals.protein / s), carbs: r1(totals.carbs / s), fat: r1(totals.fat / s), micros: scaleMicros(totals.micros, 1 / s) };
}

/** What is missing before a recipe can be saved. */
export function recipeProblems({ name, servings, items }) {
  const out = [];
  if (!String(name || '').trim()) out.push('Give the recipe a name.');
  const named = (items || []).filter(i => String(i?.name || '').trim());
  if (!named.length) out.push('Add at least one ingredient.');
  if ((items || []).some(i => String(i?.name || '').trim() && !(num(i.qty) > 0))) out.push('Every ingredient needs a quantity above zero.');
  if (!(num(servings) >= 1 && num(servings) <= 100)) out.push('Servings must be between 1 and 100.');
  if (named.length && !(recipeTotals(named).calories > 0)) out.push('The ingredients add up to zero calories. Enter their calories.');
  return out;
}

/** The row to store in saved_meals for a recipe (one serving at the top, the full recipe inside). */
export function toSavedMeal({ name, servings, items }) {
  const kept = (items || []).filter(i => String(i?.name || '').trim() && num(i.qty) > 0).slice(0, MAX_ITEMS)
    .map(i => ({ name: String(i.name).trim().slice(0, 80), qty: r1(num(i.qty)), unit: UNITS.includes(i.unit) ? i.unit : 'g', calories: Math.round(num(i.calories)), protein: r1(num(i.protein)), carbs: r1(num(i.carbs)), fat: r1(num(i.fat)), micros: i.micros || {} }));
  const s = Math.max(1, Math.min(100, Math.round(num(servings) || 1)));
  const per = perServing(recipeTotals(kept), s);
  return {
    name: String(name).trim().slice(0, 80),
    calories: per.calories, protein: per.protein, carbs: per.carbs, fat: per.fat, micros: per.micros,
    // Per-serving quantities, so logging a portion uses up the matching pantry stock.
    ingredients: kept.filter(i => i.unit !== 'each').map(i => ({ name: i.name, qty: r1(i.qty / s), unit: i.unit })).filter(i => i.qty > 0),
    servings: s,
    recipe: { servings: s, items: kept },
  };
}

/** An editable draft from a saved meal: a recipe as built, or a plain meal as one "whole meal" ingredient. */
export function draftFromSaved(meal) {
  if (meal?.recipe?.items?.length) return { name: meal.name || '', servings: num(meal.recipe.servings) || 1, items: meal.recipe.items.map(i => ({ ...blankItem(), ...i })) };
  return {
    name: meal?.name || '', servings: 1,
    items: [{ name: meal?.name || 'Meal', qty: 1, unit: 'each', calories: Math.round(num(meal?.calories)), protein: r1(num(meal?.protein)), carbs: r1(num(meal?.carbs)), fat: r1(num(meal?.fat)), micros: meal?.micros || {} }],
  };
}

export const PORTIONS = [0.5, 1, 1.5, 2];

/** A nutrition-log entry for `portions` servings of a saved meal, with ingredients scaled to match. */
export function mealEntry(meal, portions = 1, now = new Date()) {
  const p = num(portions) > 0 ? num(portions) : 1;
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const ingredients = (Array.isArray(meal?.ingredients) ? meal.ingredients : [])
    .map(i => ({ name: String(i?.name || '').trim(), qty: r1(num(i?.qty) * p), unit: String(i?.unit || '').trim() })).filter(i => i.name && i.qty > 0);
  return {
    id: `m_${now.getTime()}`,
    name: meal.name,
    calories: Math.round(num(meal?.calories) * p), protein: r1(num(meal?.protein) * p), carbs: r1(num(meal?.carbs) * p), fat: r1(num(meal?.fat) * p),
    micros: scaleMicros(meal?.micros, p),
    qty: null, unit: null, time: clock, savedMealId: meal?.id,
    ...(p !== 1 ? { portions: p } : {}),
    ...(ingredients.length ? { ingredients } : {}),
  };
}
