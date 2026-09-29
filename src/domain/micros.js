// micros.js — the micronutrient coach: looks at the last week of logged food and
// taken supplements and says which nutrients you're consistently low on and
// what to eat. Pure functions.
//
// The honest limit: micros only exist on a food when it was scanned or searched
// (OpenFoodFacts) or a supplement lists them. A nutrient that is simply
// missing from the data is NOT a deficiency, so gaps are only judged when
// enough of what you logged actually carries micronutrient data.
import { MICRONUTRIENTS, MICRO_BY_KEY, sumMicros, hasMicros } from '../utils/micronutrients.js';

const dayIndex = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

// General food sources, most accessible first. Cosmetic guidance, not medical advice.
export const FOOD_SOURCES = {
  vitaminA:   ['carrots', 'sweet potato', 'eggs', 'spinach'],
  vitaminC:   ['capsicum', 'oranges', 'kiwifruit', 'broccoli'],
  vitaminD:   ['salmon', 'eggs', 'fortified milk', 'sunlight'],
  vitaminE:   ['almonds', 'sunflower seeds', 'avocado'],
  vitaminK:   ['spinach', 'broccoli', 'kale'],
  thiamin:    ['pork', 'oats', 'legumes'],
  riboflavin: ['milk', 'eggs', 'yoghurt'],
  niacin:     ['chicken breast', 'tuna', 'peanuts'],
  b6:         ['chicken', 'bananas', 'potatoes'],
  folate:     ['lentils', 'spinach', 'asparagus'],
  b12:        ['beef', 'eggs', 'dairy', 'fish'],
  potassium:  ['bananas', 'potatoes', 'beans', 'yoghurt'],
  calcium:    ['milk', 'yoghurt', 'cheese', 'tinned sardines'],
  iron:       ['red meat', 'lentils', 'spinach with vitamin C'],
  magnesium:  ['pumpkin seeds', 'almonds', 'dark chocolate', 'oats'],
  zinc:       ['beef', 'oysters', 'pumpkin seeds'],
  phosphorus: ['dairy', 'fish', 'poultry'],
  copper:     ['nuts', 'seeds', 'shellfish'],
  manganese:  ['oats', 'nuts', 'brown rice'],
  selenium:   ['brazil nuts', 'tuna', 'eggs'],
  iodine:     ['fish', 'dairy', 'iodised salt'],
  fiber:      ['oats', 'beans', 'berries', 'wholegrain bread'],
};

/**
 * Per-day micronutrient totals over the last `days` days, food + supplements.
 * A day counts as a "data day" only if at least one meal carried micros.
 * `coverage` is the share of meals in the window that carried micros.
 */
export function weeklyMicros({ nutritionLogs = [], supplements = [], suppLogs = [], today, days = 7 }) {
  const end = dayIndex(today);
  const start = end - days + 1;
  const suppById = new Map(supplements.map(s => [s.id, s]));

  const perDay = [];
  let meals = 0, mealsWithMicros = 0;
  for (const log of nutritionLogs) {
    const d = log?.date ? dayIndex(log.date) : NaN;
    if (!(d >= start && d <= end)) continue;
    const list = log.meals || [];
    meals += list.length;
    const withMicros = list.filter(m => hasMicros(m.micros));
    mealsWithMicros += withMicros.length;
    if (!withMicros.length) continue;
    const taken = suppLogs.filter(l => l.date === log.date).map(l => suppById.get(l.suppId)?.micros).filter(Boolean);
    perDay.push({ date: log.date, micros: sumMicros([...withMicros.map(m => m.micros), ...taken]) });
  }

  const avg = {};
  for (const m of MICRONUTRIENTS) {
    avg[m.key] = perDay.length ? perDay.reduce((s, d) => s + (d.micros[m.key] || 0), 0) / perDay.length : 0;
  }
  return { perDay, dataDays: perDay.length, avg, meals, mealsWithMicros, coverage: meals ? mealsWithMicros / meals : 0 };
}

/**
 * Coaching from a weekly summary.
 * status: 'no-data' (nothing logged with micros), 'low-coverage' (too little data
 * to judge), or 'ok'. Gaps: average under `lowBelow` of the RDA. Overs: limit
 * nutrients (sodium, sugars, ...) averaging above their ceiling.
 */
export function microCoach(summary, { lowBelow = 0.6, minDays = 3, minCoverage = 0.5, top = 3 } = {}) {
  if (!summary.dataDays) return { status: 'no-data', gaps: [], overs: [], coverage: 0, dataDays: 0 };
  const coverage = Math.round(summary.coverage * 100);
  if (summary.dataDays < minDays || summary.coverage < minCoverage) {
    return { status: 'low-coverage', gaps: [], overs: [], coverage, dataDays: summary.dataDays };
  }

  const gaps = [], overs = [];
  for (const m of MICRONUTRIENTS) {
    const amt = summary.avg[m.key] || 0;
    const ratio = m.rda > 0 ? amt / m.rda : 0;
    if (m.limit) {
      if (ratio > 1) overs.push({ key: m.key, label: m.label, avgPct: Math.round(ratio * 100) });
    } else if (amt > 0 && ratio < lowBelow) {
      gaps.push({ key: m.key, label: m.label, avgPct: Math.round(ratio * 100), foods: FOOD_SOURCES[m.key] || [] });
    }
  }
  gaps.sort((a, b) => a.avgPct - b.avgPct);
  overs.sort((a, b) => b.avgPct - a.avgPct);
  return { status: 'ok', gaps: gaps.slice(0, top), overs: overs.slice(0, 2), coverage, dataDays: summary.dataDays };
}

export { MICRO_BY_KEY };
