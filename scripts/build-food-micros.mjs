// build-food-micros.mjs — turns the USDA FoodData Central "SR Legacy" CSV download into
// src/data/micros/usda-micros.json: vitamins and minerals per 100 g for the bundled everyday foods.
// USDA data is public domain (CC0).
//
//   node scripts/build-food-micros.mjs <folder with food.csv, food_nutrient.csv, nutrient.csv>
//
// Download: https://fdc.nal.usda.gov/download-datasets  ->  "SR Legacy" -> CSV (about 7 MB zip). Unzip it.
// Foods are matched to generic.json by their exact USDA description. Missing is stored as null, never 0.
import { createReadStream, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// USDA nutrient number -> the app's key (units already match src/utils/micronutrients.js: µg, mg, g per 100 g)
export const NUTRIENT_KEYS = {
  320: 'vitaminA', 401: 'vitaminC', 328: 'vitaminD', 323: 'vitaminE', 430: 'vitaminK',
  404: 'thiamin', 405: 'riboflavin', 406: 'niacin', 415: 'b6', 417: 'folate', 418: 'b12',
  301: 'calcium', 303: 'iron', 304: 'magnesium', 306: 'potassium', 309: 'zinc',
  305: 'phosphorus', 312: 'copper', 315: 'manganese', 317: 'selenium',
  601: 'cholesterol', 606: 'satFat',
};
export const ORDER = Object.values(NUTRIENT_KEYS);

/** One CSV line to fields (handles "quoted, fields" and "" escapes). */
export function csvLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * Pure core: food rows [{ id, name }], nutrient rows [{ id, number }], amounts [{ food, nutrient, amount }],
 * wanted names (Set) -> { order, rows: { name: [values aligned to ORDER, null when unknown] } }.
 */
export function buildMicros({ foods, nutrients, amounts, wanted }) {
  const keyByNutrient = new Map();
  for (const n of nutrients) { const k = NUTRIENT_KEYS[Number(n.number)]; if (k) keyByNutrient.set(String(n.id), k); }
  const nameByFood = new Map();
  for (const f of foods) if (!wanted || wanted.has(f.name)) nameByFood.set(String(f.id), f.name);
  const byName = new Map();
  for (const a of amounts) {
    const name = nameByFood.get(String(a.food)), key = keyByNutrient.get(String(a.nutrient));
    if (!name || !key) continue;
    const v = Number(a.amount);
    if (!Number.isFinite(v) || v < 0) continue;
    if (!byName.has(name)) byName.set(name, {});
    byName.get(name)[key] = Math.round(v * 1000) / 1000;
  }
  const rows = {};
  for (const [name, m] of byName) {
    if (!ORDER.some(k => m[k] > 0)) continue;
    rows[name] = ORDER.map(k => (m[k] == null ? null : m[k]));
  }
  return { order: ORDER, rows };
}

async function readCsv(file, onRow) {
  const rl = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  let head = null;
  for await (const line of rl) {
    if (!line) continue;
    const f = csvLine(line);
    if (!head) { head = f; continue; }
    onRow(Object.fromEntries(head.map((h, i) => [h, f[i]])));
  }
}

async function main() {
  const dir = process.argv[2];
  if (!dir) { console.error('Usage: node scripts/build-food-micros.mjs <folder with the SR Legacy CSV files>'); process.exit(1); }
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const generic = JSON.parse(readFileSync(join(root, 'src/data/foods/generic.json'), 'utf8'));
  const wanted = new Set(generic.map(r => String(r[0])));
  const foods = [], nutrients = [], amounts = [];
  await readCsv(join(dir, 'food.csv'), r => foods.push({ id: r.fdc_id, name: r.description }));
  await readCsv(join(dir, 'nutrient.csv'), r => nutrients.push({ id: r.id, number: r.nutrient_nbr }));
  const wantedIds = new Set(foods.filter(f => wanted.has(f.name)).map(f => String(f.id)));
  await readCsv(join(dir, 'food_nutrient.csv'), r => { if (wantedIds.has(r.fdc_id)) amounts.push({ food: r.fdc_id, nutrient: r.nutrient_id, amount: r.amount }); });
  const out = buildMicros({ foods, nutrients, amounts, wanted });
  const outDir = join(root, 'src/data/micros');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'usda-micros.json'), JSON.stringify(out));
  const n = Object.keys(out.rows).length;
  console.log(`Matched ${n} of ${generic.length} everyday foods (${Math.round((n / generic.length) * 100)}%). Wrote src/data/micros/usda-micros.json`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
