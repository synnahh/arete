// productLookup.js — scan a supplement (or any pack) and get a ready-to-save supply: its name,
// pack size and unit, how much one use is, and the ingredients. Looks the barcode up in three
// open databases that share one API: Open Food Facts (most supplements are here), Open Beauty
// Facts and Open Products Facts. Coverage is patchy, so the add form is always editable.
// Pure parsers are exported for tests; only lookupProduct touches the network.
import { platformFetch } from './platform.js';
import { parsePao, isBarcode } from './openBeautyFacts.js';

const FIELDS = 'product_name,generic_name,brands,quantity,serving_size,ingredients_text,ingredients_text_en,periods_after_opening';
export const SOURCES = [
  'https://world.openfoodfacts.org/api/v2/product',
  'https://world.openbeautyfacts.org/api/v2/product',
  'https://world.openproductsfacts.org/api/v2/product',
];

// Count units: how a pack or a dose is written on a label, and the one word we keep.
const UNIT_WORDS = [
  ['capsules', /^(capsules?|caps?|vcaps?|veggie caps?)$/],
  ['tablets', /^(tablets?|tabs?|caplets?)$/],
  ['softgels', /^(softgels?|soft gels?|gels?)$/],
  ['gummies', /^(gummies|gummy)$/],
  ['sachets', /^(sachets?|packets?|stick ?packs?)$/],
  ['lozenges', /^(lozenges?)$/],
  ['serves', /^(serves?|servings?|doses?)$/],
  ['scoops', /^(scoops?)$/],
  ['drops', /^(drops?)$/],
  ['g', /^(g|gr|grams?)$/],
  ['mg', /^(mg|milligrams?)$/],
  ['ml', /^(ml|millilit(re|er)s?)$/],
];
const SCALE = { kg: ['g', 1000], l: ['ml', 1000], litre: ['ml', 1000], liter: ['ml', 1000], litres: ['ml', 1000], liters: ['ml', 1000], kilograms: ['g', 1000], kilogram: ['g', 1000] };

const NUM = '(\\d+(?:[.,]\\d+)?)';
const unitOf = (raw) => {
  const w = String(raw || '').toLowerCase().trim();
  if (SCALE[w]) return SCALE[w][0];
  if (w === 'kg') return 'g';
  if (w === 'l') return 'ml';
  const hit = UNIT_WORDS.find(([, re]) => re.test(w));
  return hit ? hit[0] : null;
};
const num = (s) => Number(String(s).replace(',', '.'));
const factor = (raw) => { const w = String(raw || '').toLowerCase(); return w === 'kg' || w === 'kilogram' || w === 'kilograms' ? 1000 : (w === 'l' || /^lit(re|er)s?$/.test(w)) ? 1000 : 1; };

/**
 * "60 capsules" -> { qty: 60, unit: 'capsules' }; "1.5 kg" -> { qty: 1500, unit: 'g' };
 * "2 x 30 tablets" -> 60 tablets. null when nothing usable.
 */
export function parsePackSize(text) {
  const t = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const multi = new RegExp(`${NUM}\\s*[x×]\\s*${NUM}\\s*([a-z ]+?)(?:\\b|$)`).exec(t);
  if (multi) { const unit = unitOf(multi[3].trim().split(' ')[0]); if (unit) return { qty: +(num(multi[1]) * num(multi[2])).toFixed(2), unit }; }
  const re = new RegExp(`${NUM}\\s*([a-z]+(?: ?gels?| ?caps?)?)`, 'g');
  let m;
  while ((m = re.exec(t))) {
    const unit = unitOf(m[2]);
    if (unit) return { qty: +(num(m[1]) * factor(m[2])).toFixed(2), unit };
    const first = unitOf(m[2].split(' ')[0]);
    if (first) return { qty: +(num(m[1]) * factor(m[2].split(' ')[0])).toFixed(2), unit: first };
  }
  return null;
}

/**
 * How much one use is, in the pack's own unit where the serving text allows it.
 * ("2 capsules (1.5 g)", pack unit capsules) -> 2;  ("1 scoop (30 g)", pack unit g) -> 30.
 */
export function doseFor(packUnit, serving) {
  const t = String(serving || '').toLowerCase();
  if (!t || !packUnit) return null;
  const re = new RegExp(`${NUM}\\s*([a-z]+)`, 'g');
  const found = [];
  let m;
  while ((m = re.exec(t))) { const u = unitOf(m[2]); if (u) found.push({ qty: num(m[1]) * factor(m[2]), unit: u }); }
  const same = found.find(f => f.unit === packUnit);
  if (same) return +same.qty.toFixed(2);
  // A powder sold in grams but served by the scoop: the grams in brackets are the dose.
  return null;
}

const strip = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** A tidy supply from one API answer, or null when the barcode is unknown there. */
export function parseSupplement(json, code) {
  const p = json?.status === 1 || json?.product ? json.product : null;
  if (!p) return null;
  const rawName = strip(p.product_name || p.generic_name);
  const brand = strip(String(p.brands || '').split(',')[0]);
  const ingredients = strip(p.ingredients_text_en || p.ingredients_text);
  if (!rawName && !ingredients) return null;
  const name = rawName
    ? (brand && !rawName.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${rawName}` : rawName)
    : brand;
  const pack = parsePackSize(p.quantity);
  return {
    code: String(code || ''),
    name: name.slice(0, 80),
    brand,
    packQty: pack?.qty ?? null,
    unit: pack?.unit ?? null,
    dosePerUse: pack ? doseFor(pack.unit, p.serving_size) : null,
    serving: strip(p.serving_size),
    ingredients,
    paoMonths: parsePao(p.periods_after_opening),
  };
}

/** Look a barcode up in all three databases. Resolves to a supply, or rejects with .notFound set. */
export async function lookupProduct(code, { fetcher = platformFetch } = {}) {
  const c = String(code || '').trim();
  if (!isBarcode(c)) throw Object.assign(new Error('Enter the digits under the barcode (6 to 14 numbers).'), { notFound: true });
  let reached = false;
  for (const base of SOURCES) {
    try {
      const res = await fetcher(`${base}/${c}.json?fields=${FIELDS}`);
      reached = true;
      if (!res.ok) continue;
      const found = parseSupplement(await res.json(), c);
      if (found) return found;
    } catch { /* try the next database */ }
  }
  throw Object.assign(new Error(reached ? 'That product is not in the open databases yet. Fill it in by hand.' : 'Lookup failed. Check your connection.'), { notFound: reached });
}
