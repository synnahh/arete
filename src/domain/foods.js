// foods.js — "Recent & frequent": the foods you actually eat, ranked from your
// own nutrition log, so re-logging is one tap instead of a search. Pure.
//
// nutrition_logs rows are one per day: { date, meals: [{ name, calories, protein,
// carbs, fat, micros, qty, unit, ... }], ...totals }.

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const dayIndex = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

// Entries the assistant logged with no name aren't a food you can re-pick.
const GENERIC = new Set(['logged by assistant', '']);

/**
 * Ranked foods from the last `windowDays`. A food is the same food when its
 * name matches; the most recent entry supplies the portion and macros, so
 * tapping it repeats what you last had. Ranked by how often, then how recently.
 */
export function recentFoods(nutritionLogs = [], { today, limit = 8, windowDays = 60 } = {}) {
  const end = today ? dayIndex(today) : Infinity;
  const start = end - windowDays;
  const byName = new Map();

  for (const log of nutritionLogs) {
    const day = log?.date ? dayIndex(log.date) : NaN;
    if (!(day >= start && day <= end)) continue;
    for (const meal of log.meals || []) {
      const key = norm(meal?.name);
      if (GENERIC.has(key) || !(Number(meal.calories) > 0)) continue;
      const cur = byName.get(key) || { name: String(meal.name).trim(), count: 0, lastDate: '', entry: null };
      cur.count += 1;
      if (log.date >= cur.lastDate) { cur.lastDate = log.date; cur.entry = meal; }
      byName.set(key, cur);
    }
  }

  return [...byName.values()]
    .sort((a, b) => (b.count - a.count) || b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ name, count, lastDate, entry }) => ({
      name, count, lastDate,
      calories: Math.round(Number(entry.calories) || 0),
      protein: Math.round(Number(entry.protein) || 0),
      carbs: Math.round(Number(entry.carbs) || 0),
      fat: Math.round(Number(entry.fat) || 0),
      micros: entry.micros || {},
      qty: entry.qty ?? null,
      unit: entry.unit ?? null,
      ingredients: cleanIngredients(entry.ingredients),
    }));
}

// ── Shortcuts: copy a day, quick-add ────────────────────────────────────────

const clock = (now) => `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

/** The local day before `today` ('YYYY-MM-DD'). */
export function yesterdayKey(today) {
  const t = dayIndex(today) - 1;
  return new Date(t * 86400000).toISOString().slice(0, 10);
}

/** Fresh copies of a day's meals, ready to append to another day. */
export function copyMeals(log, now = new Date()) {
  const stamp = now.getTime();
  return (log?.meals || [])
    .filter(m => m && Number(m.calories) >= 0 && String(m.name || '').trim())
    .map((m, i) => ({
      ...m,
      id: `m_${stamp}_${i}`,
      time: clock(now),
      ...(m.savedMealId ? { savedMealId: m.savedMealId } : {}),
    }));
}

/**
 * A quick-add entry from just calories (and optionally protein/carbs/fat and a
 * name), for when you know the number but not the food. Null unless calories
 * are between 1 and 10,000.
 */
export function quickEntry({ name = '', calories, protein = 0, carbs = 0, fat = 0 } = {}, now = new Date()) {
  const kcal = Math.round(Number(calories));
  if (!(kcal >= 1 && kcal <= 10000)) return null;
  const grams = (v) => { const n = Math.round((Number(v) || 0) * 10) / 10; return n > 0 && n <= 1000 ? n : 0; };
  return {
    id: `m_${now.getTime()}`,
    name: String(name).trim().slice(0, 60) || 'Quick add',
    calories: kcal, protein: grams(protein), carbs: grams(carbs), fat: grams(fat),
    micros: {}, qty: null, unit: null, time: clock(now), quick: true,
  };
}

/** A day's row with `entries` appended and the totals recomputed from the meals. */
export function appendMeals(existing, entries, date) {
  const meals = [...(existing?.meals || []), ...entries];
  const sum = (k) => Math.round(meals.reduce((s, m) => s + (Number(m[k]) || 0), 0) * 10) / 10;
  return { ...(existing || {}), date, meals, calories: sum('calories'), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat') };
}

/** Ingredient lists reduced to usable { name, qty, unit } rows (empty array when none). */
export function cleanIngredients(list) {
  return (Array.isArray(list) ? list : [])
    .map(i => ({ name: String(i?.name || '').trim(), qty: Number(i?.qty) || 0, unit: String(i?.unit || '').trim() }))
    .filter(i => i.name && i.qty > 0);
}

/**
 * A nutrition-log entry from a meal in the AI meal plan, keeping its
 * ingredients so logging it also uses up the matching pantry supplies.
 * Null when the plan meal has no usable calories.
 */
export function mealFromPlan(meal, now = new Date()) {
  const calories = Math.round(Number(meal?.calories));
  if (!(calories >= 1 && calories <= 10000)) return null;
  const grams = (v) => Math.max(0, Math.round((Number(v) || 0) * 10) / 10);
  const ingredients = cleanIngredients(meal.ingredients);
  return {
    id: `m_${now.getTime()}`,
    name: String(meal.name || 'Planned meal').trim().slice(0, 80),
    calories, protein: grams(meal.protein), carbs: grams(meal.carbs), fat: grams(meal.fat),
    micros: {}, qty: null, unit: null, time: clock(now), fromPlan: true,
    ...(ingredients.length ? { ingredients } : {}),
  };
}

// ── Meal sections ───────────────────────────────────────────────────────────

export const SECTIONS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' },
];

/** Which section a logged time falls in: 4-11 breakfast, 11-15 lunch, 17-22 dinner, otherwise snacks. */
export function mealSection(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || '').trim());
  if (!m || +m[1] > 23) return 'snacks';
  const h = +m[1];
  if (h >= 4 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  if (h >= 17 && h < 22) return 'dinner';
  return 'snacks';
}

/** Non-empty sections in day order, each with its meals (by time) and calorie subtotal. */
export function groupBySection(meals = []) {
  const order = new Map(SECTIONS.map((s, i) => [s.id, i]));
  const groups = new Map();
  for (const m of meals) {
    const id = mealSection(m?.time);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(m);
  }
  return [...groups.entries()]
    .sort((a, b) => order.get(a[0]) - order.get(b[0]))
    .map(([id, list]) => ({
      id, label: SECTIONS.find(s => s.id === id).label,
      meals: [...list].sort((a, b) => String(a.time || '').localeCompare(String(b.time || ''))),
      kcal: Math.round(list.reduce((s, m) => s + (Number(m.calories) || 0), 0)),
    }));
}
