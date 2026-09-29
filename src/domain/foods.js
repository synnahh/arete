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
    }));
}
