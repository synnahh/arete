// customFoods.js — your own foods (a label you typed in, something homemade) and favourites.
// Pure; UI is components/CustomFoodForm.jsx and hooks/useFoodLibrary.js.
//
// A custom food row (collection `custom_foods`): { name, brand, serving: { qty, unit }, calories,
// protein, carbs, fat } with the numbers for ONE serving as written on the label.
//
// Favourites are snapshots kept in one document, so anything can be starred (a recent food, a saved
// meal, a custom food, a food you logged today) and logged again in one tap, as it was.
import { cleanIngredients } from './foods.js';
import { scaleMicros } from '../utils/micronutrients.js';

export const SERVING_UNITS = ['g', 'ml', 'serving', 'each'];
export const MAX_FAVOURITES = 40;

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
const r1 = (n) => Math.round(n * 10) / 10;
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const clock = (now) => `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

/** What is wrong with a custom-food form, as messages. */
export function customFoodProblems(f) {
  const out = [];
  if (!String(f?.name || '').trim()) out.push('Give the food a name.');
  if (!(num(f?.servingQty) > 0)) out.push('Serving size must be above zero.');
  const kcal = Number(f?.calories);
  if (!(kcal > 0 && kcal <= 10000)) out.push('Enter calories for one serving (1 to 10,000).');
  for (const [k, label] of [['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']]) {
    const v = f?.[k];
    if (v !== '' && v != null && !(Number(v) >= 0 && Number(v) <= 1000)) out.push(`${label} must be between 0 and 1000 g.`);
  }
  return out;
}

// Optional extra nutrients on a custom food, per serving, in the units the micronutrient tracker uses.
export const EXTRA_NUTRIENTS = ['fiber', 'sugars', 'sodium', 'satFat', 'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'vitaminC', 'vitaminD', 'vitaminA', 'b12'];

/** The numbers typed into the optional nutrient boxes, as { key: number } (blank, zero and junk dropped). */
export function cleanExtra(raw) {
  const out = {};
  for (const k of EXTRA_NUTRIENTS) {
    const v = Number(raw?.[k]);
    if (raw?.[k] !== '' && raw?.[k] != null && Number.isFinite(v) && v > 0 && v < 100000) out[k] = Math.round(v * 100) / 100;
  }
  return out;
}

/** The row to store from a form ({ name, brand, servingQty, servingUnit, calories, protein, carbs, fat, micros? }). */
export function makeCustomFood(f) {
  const micros = cleanExtra(f.micros);
  return {
    ...(Object.keys(micros).length ? { micros } : {}),
    name: String(f.name).trim().slice(0, 80),
    brand: String(f.brand || '').trim().slice(0, 60),
    serving: { qty: r1(num(f.servingQty) || 1), unit: SERVING_UNITS.includes(f.servingUnit) ? f.servingUnit : 'serving' },
    calories: Math.round(num(f.calories)), protein: r1(num(f.protein)), carbs: r1(num(f.carbs)), fat: r1(num(f.fat)),
  };
}

/** A form from a stored food, for editing. */
export const formFromCustomFood = (food) => ({
  id: food?.id, name: food?.name || '', brand: food?.brand || '',
  servingQty: food?.serving?.qty ?? 100, servingUnit: food?.serving?.unit || 'g',
  calories: food?.calories ?? '', protein: food?.protein ?? '', carbs: food?.carbs ?? '', fat: food?.fat ?? '',
  micros: Object.fromEntries(Object.entries(food?.micros || {}).map(([k, v]) => [k, String(v)])),
});

/** "30 g", "1 serving", "2 each" */
export const servingText = (food) => `${food?.serving?.qty ?? 1} ${food?.serving?.unit ?? 'serving'}`;

/** A nutrition-log entry for `servings` servings of a custom food. */
export function customFoodEntry(food, servings = 1, now = new Date()) {
  const n = num(servings) > 0 ? num(servings) : 1;
  const unit = food?.serving?.unit || 'serving';
  return {
    id: `m_${now.getTime()}`,
    name: food.brand ? `${food.name} (${food.brand})` : food.name,
    calories: Math.round(num(food.calories) * n), protein: r1(num(food.protein) * n), carbs: r1(num(food.carbs) * n), fat: r1(num(food.fat) * n),
    micros: scaleMicros(food?.micros, n), qty: r1((food?.serving?.qty || 1) * n), unit, time: clock(now), customFoodId: food?.id,
  };
}

/** A recipe-builder ingredient from a custom food (g and ml stay as they are; anything else is "each"). */
export function itemFromCustom(food, servings = 1) {
  const n = num(servings) > 0 ? num(servings) : 1;
  const unit = ['g', 'ml'].includes(food?.serving?.unit) ? food.serving.unit : 'each';
  return {
    name: food.brand ? `${food.name} (${food.brand})` : food.name,
    qty: r1((food?.serving?.qty || 1) * n), unit,
    calories: Math.round(num(food.calories) * n), protein: r1(num(food.protein) * n), carbs: r1(num(food.carbs) * n), fat: r1(num(food.fat) * n), micros: scaleMicros(food?.micros, n),
  };
}

// ── Favourites ────────────────────────────────────────────────────────────────

/** A favourite snapshot from any food-like entry (logged entry, recent food, saved meal, custom-food entry). */
export function favouriteFromEntry(e) {
  return {
    name: String(e?.name || '').trim().slice(0, 80),
    calories: Math.round(num(e?.calories)), protein: r1(num(e?.protein)), carbs: r1(num(e?.carbs)), fat: r1(num(e?.fat)),
    micros: e?.micros && typeof e.micros === 'object' ? e.micros : {},
    qty: num(e?.qty) > 0 ? num(e.qty) : null, unit: e?.unit ? String(e.unit) : null,
    ingredients: cleanIngredients(e?.ingredients),
  };
}

export const isFavourite = (list = [], name) => list.some(f => norm(f?.name) === norm(name));

/** Star or unstar by name. Returns the new list (newest first, capped) and whether it was added. */
export function toggleFavourite(list = [], entry) {
  const fav = favouriteFromEntry(entry);
  if (!fav.name || !(fav.calories > 0)) return { list, added: false, rejected: true };
  if (isFavourite(list, fav.name)) return { list: list.filter(f => norm(f.name) !== norm(fav.name)), added: false };
  return { list: [fav, ...list].slice(0, MAX_FAVOURITES), added: true };
}

/** A nutrition-log entry from a favourite, as it was when starred. */
export function favouriteEntry(fav, now = new Date()) {
  const ingredients = cleanIngredients(fav?.ingredients);
  return {
    id: `m_${now.getTime()}`, name: fav.name,
    calories: Math.round(num(fav.calories)), protein: r1(num(fav.protein)), carbs: r1(num(fav.carbs)), fat: r1(num(fav.fat)),
    micros: scaleMicros(fav?.micros, 1), qty: fav?.qty ?? null, unit: fav?.unit ?? null, time: clock(now),
    ...(ingredients.length ? { ingredients } : {}),
  };
}
