// dayLogs.js — canonical rows for things the assistant logs on the user's behalf
// (water, sleep, calories). They must match exactly what the Health screens and
// useHealthData read, so an assistant-logged entry looks like a hand-logged one
// and syncs like one:
//   water_logs      one row per drink   { date, amount(ml), time }
//   sleep_data      one row per date    { date, duration(min), efficiency, ... }
//   nutrition_logs  one row per day     { date, meals: [...], calories, protein, carbs, fat }

const clockTime = (now) =>
  `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

export function waterRow({ date, amountMl, now = new Date() }) {
  const amount = Math.min(2000, Math.max(50, Number(amountMl) || 250));
  return { date, amount, time: clockTime(now), source: 'assistant' };
}

/**
 * Sleep for a date. Keeps any richer data already on that date's row
 * (stages, efficiency from Apple Health) and only sets what was stated.
 */
export function sleepRow({ date, hours, quality = null, existing = null }) {
  const h = Number(hours);
  if (!(h > 0 && h <= 24)) return null;
  return {
    ...(existing || {}),
    date,
    duration: Math.round(h * 60),
    ...(quality ? { quality } : {}),
    source: existing?.source ?? 'assistant',
  };
}

const TOTAL_KEYS = ['calories', 'protein', 'carbs', 'fat'];

/**
 * Add one meal entry to a day's nutrition row (creating it when there is none)
 * and recompute the totals from the meals, as the Fuel screen does.
 */
export function nutritionDay({ date, entry, existing = null, now = new Date() }) {
  const calories = Math.abs(Number(entry?.calories));
  if (!(calories > 0)) return null;
  const meal = {
    id: `m_${now.getTime()}`,
    name: String(entry.meal || entry.name || 'Logged by assistant'),
    calories,
    protein: Math.abs(Number(entry.protein)) || 0,
    carbs: Math.abs(Number(entry.carbs)) || 0,
    fat: Math.abs(Number(entry.fat)) || 0,
    micros: {},
    qty: null, unit: null,
    time: clockTime(now),
  };
  const meals = [...(existing?.meals || []), meal];
  const totals = Object.fromEntries(TOTAL_KEYS.map(k => [k, meals.reduce((s, m) => s + (Number(m[k]) || 0), 0)]));
  return { ...(existing || {}), date, meals, ...totals };
}
