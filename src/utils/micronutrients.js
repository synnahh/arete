// micronutrients.js — canonical micronutrient registry + helpers
// Shared by Health → Nutrition (food-derived) and Supplements (supplement-derived)
// so both feed ONE unified daily intake-vs-RDA view.
//
// OpenFoodFacts returns every nutrient in its `*_100g` field in GRAMS. We convert
// to each nutrient's natural display unit (g / mg / µg) on the way in, then store
// and sum everything in display units.

// off:    OpenFoodFacts nutriment base key (the API field is `${off}_100g`)
// unit:   display unit
// fromG:  grams → display-unit multiplier (mg = 1e3, µg = 1e6, g = 1)
// rda:    reference daily amount in display unit (adult; US DV where sensible)
// limit:  true = a ceiling to stay UNDER (sodium, sugar, sat-fat, cholesterol)
// group:  'vitamin' | 'mineral' | 'other'
export const MICRONUTRIENTS = [
  // ── Vitamins ────────────────────────────────────────────────
  { key: 'vitaminA',  off: 'vitamin-a',  label: 'Vitamin A',        unit: 'µg', fromG: 1e6, rda: 900,  group: 'vitamin' },
  { key: 'vitaminC',  off: 'vitamin-c',  label: 'Vitamin C',        unit: 'mg', fromG: 1e3, rda: 90,   group: 'vitamin' },
  { key: 'vitaminD',  off: 'vitamin-d',  label: 'Vitamin D',        unit: 'µg', fromG: 1e6, rda: 20,   group: 'vitamin' },
  { key: 'vitaminE',  off: 'vitamin-e',  label: 'Vitamin E',        unit: 'mg', fromG: 1e3, rda: 15,   group: 'vitamin' },
  { key: 'vitaminK',  off: 'vitamin-k',  label: 'Vitamin K',        unit: 'µg', fromG: 1e6, rda: 120,  group: 'vitamin' },
  { key: 'thiamin',   off: 'vitamin-b1', label: 'B1 · Thiamin',     unit: 'mg', fromG: 1e3, rda: 1.2,  group: 'vitamin' },
  { key: 'riboflavin',off: 'vitamin-b2', label: 'B2 · Riboflavin',  unit: 'mg', fromG: 1e3, rda: 1.3,  group: 'vitamin' },
  { key: 'niacin',    off: 'vitamin-pp', label: 'B3 · Niacin',      unit: 'mg', fromG: 1e3, rda: 16,   group: 'vitamin' },
  { key: 'b6',        off: 'vitamin-b6', label: 'B6',               unit: 'mg', fromG: 1e3, rda: 1.7,  group: 'vitamin' },
  { key: 'folate',    off: 'vitamin-b9', label: 'B9 · Folate',      unit: 'µg', fromG: 1e6, rda: 400,  group: 'vitamin' },
  { key: 'b12',       off: 'vitamin-b12',label: 'B12',              unit: 'µg', fromG: 1e6, rda: 2.4,  group: 'vitamin' },
  // ── Minerals ────────────────────────────────────────────────
  { key: 'sodium',    off: 'sodium',     label: 'Sodium',           unit: 'mg', fromG: 1e3, rda: 2300, group: 'mineral', limit: true },
  { key: 'potassium', off: 'potassium',  label: 'Potassium',        unit: 'mg', fromG: 1e3, rda: 3400, group: 'mineral' },
  { key: 'calcium',   off: 'calcium',    label: 'Calcium',          unit: 'mg', fromG: 1e3, rda: 1000, group: 'mineral' },
  { key: 'iron',      off: 'iron',       label: 'Iron',             unit: 'mg', fromG: 1e3, rda: 18,   group: 'mineral' },
  { key: 'magnesium', off: 'magnesium',  label: 'Magnesium',        unit: 'mg', fromG: 1e3, rda: 420,  group: 'mineral' },
  { key: 'zinc',      off: 'zinc',       label: 'Zinc',             unit: 'mg', fromG: 1e3, rda: 11,   group: 'mineral' },
  { key: 'phosphorus',off: 'phosphorus', label: 'Phosphorus',       unit: 'mg', fromG: 1e3, rda: 1250, group: 'mineral' },
  { key: 'copper',    off: 'copper',     label: 'Copper',           unit: 'mg', fromG: 1e3, rda: 0.9,  group: 'mineral' },
  { key: 'manganese', off: 'manganese',  label: 'Manganese',        unit: 'mg', fromG: 1e3, rda: 2.3,  group: 'mineral' },
  { key: 'selenium',  off: 'selenium',   label: 'Selenium',         unit: 'µg', fromG: 1e6, rda: 55,   group: 'mineral' },
  { key: 'iodine',    off: 'iodine',     label: 'Iodine',           unit: 'µg', fromG: 1e6, rda: 150,  group: 'mineral' },
  // ── Other (still micro-tracked) ─────────────────────────────
  { key: 'fiber',     off: 'fiber',         label: 'Fibre',         unit: 'g',  fromG: 1,   rda: 28,   group: 'other' },
  { key: 'sugars',    off: 'sugars',        label: 'Sugars',        unit: 'g',  fromG: 1,   rda: 50,   group: 'other', limit: true },
  { key: 'satFat',    off: 'saturated-fat', label: 'Saturated fat', unit: 'g',  fromG: 1,   rda: 20,   group: 'other', limit: true },
  { key: 'cholesterol',off:'cholesterol',   label: 'Cholesterol',   unit: 'mg', fromG: 1e3, rda: 300,  group: 'other', limit: true },
];

export const MICRO_BY_KEY = Object.fromEntries(MICRONUTRIENTS.map(m => [m.key, m]));

export const MICRO_GROUPS = [
  { id: 'vitamin', label: 'Vitamins', colour: '#4caf7d' },
  { id: 'mineral', label: 'Minerals', colour: '#4a9eff' },
  { id: 'other',   label: 'Other',    colour: '#f4a642' },
];

const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Pull a micros object (display units, per the serving the nutriments describe — i.e.
// per 100g for OFF `_100g` fields) out of an OpenFoodFacts `nutriments` blob.
export function extractMicrosFromOFF(nutriments) {
  if (!nutriments || typeof nutriments !== 'object') return {};
  const out = {};
  for (const m of MICRONUTRIENTS) {
    let grams = nutriments[`${m.off}_100g`];
    // Fall back: derive sodium from salt (salt ≈ sodium × 2.5) when only salt is present.
    if (grams == null && m.key === 'sodium' && nutriments['salt_100g'] != null) {
      grams = nutriments['salt_100g'] / 2.5;
    }
    if (typeof grams === 'number' && isFinite(grams) && grams > 0) {
      out[m.key] = round(grams * m.fromG);
    }
  }
  return out;
}

export function scaleMicros(micros, factor) {
  if (!micros) return {};
  const out = {};
  for (const k in micros) out[k] = round((micros[k] || 0) * factor);
  return out;
}

export function addMicros(a, b) {
  const out = { ...(a || {}) };
  for (const k in (b || {})) out[k] = round((out[k] || 0) + (b[k] || 0));
  return out;
}

// Sum an array of micros objects into one.
export function sumMicros(list) {
  return (list || []).reduce((acc, m) => addMicros(acc, m), {});
}

// Does a micros object actually carry any tracked nutrient?
export function hasMicros(micros) {
  if (!micros) return false;
  return Object.keys(micros).some(k => MICRO_BY_KEY[k] && (micros[k] || 0) > 0);
}
