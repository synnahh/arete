// foodDb.js — the bundled food database: search, ranking and turning a row into a loggable food. Pure.
//
// Two kinds of pack, loaded lazily (src/hooks/useFoodDb.js):
//   generic  USDA FoodData Central (SR Legacy + Foundation), public domain (CC0). Row:
//            [name, kcal, protein, carbs, fat, fibre, sugar, sodiumMg, category, "1 cup=240|1 slice=28"]
//   branded  packaged products with a brand (Coles, Woolworths, Chobani ...). Row:
//            [name, brand, kcal, protein, carbs, fat, fibre, sugar, sodiumMg, servingLabel, servingGrams, barcode]
// All numbers are per 100 g. Search is on name and brand words, with Australian words mapped to the
// American ones the USDA data uses (mince -> ground, capsicum -> pepper ...), and branded products
// ranked above generic foods when both match.

const norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Query word -> other words that mean the same thing in the data (any one of them is enough).
export const SYNONYMS = {
  mince: ['ground'], minced: ['ground'], capsicum: ['pepper', 'peppers'], prawn: ['shrimp'], prawns: ['shrimp'],
  rocket: ['arugula'], coriander: ['cilantro'], aubergine: ['eggplant'], zucchini: ['courgette'], courgette: ['zucchini'],
  chips: ['fries', 'french'], fries: ['chips'], crisps: ['chips'], biscuit: ['cookie', 'cracker'], biscuits: ['cookies', 'crackers'],
  lollies: ['candy', 'candies'], sultanas: ['raisins'], beetroot: ['beets'], porridge: ['oatmeal', 'oats'], cornflour: ['cornstarch'],
  yoghurt: ['yogurt'], yogurt: ['yoghurt'], icing: ['powdered'], scone: ['biscuit'], rockmelon: ['cantaloupe'], cantaloupe: ['rockmelon'],
  mandarin: ['tangerine'], swede: ['rutabaga'], silverbeet: ['chard'], spud: ['potato'], potatoes: ['potato'], tomatoes: ['tomato'],
  eggs: ['egg'], mayo: ['mayonnaise'], 'veg': ['vegetable', 'vegetables'], wholemeal: ['whole'], 'oats': ['oat'],
  steak: ['beef'], schnitzel: ['breaded'], sausage: ['sausages'], sausages: ['sausage'], 'bbq': ['barbecue'], 'soda': ['carbonated'],
};

// "bananas" and "banana" are the same word, "berries" and "berry" too.
const stem = (w) => (w.length > 3 ? w.replace(/ies$/, 'y').replace(/(?<![s])s$/, '') : w);
const wordsOf = (s) => norm(s).split(' ').filter(Boolean).map(stem);

/** Rows -> index entries with their normalised search text. */
export function buildIndex(kind, rows = []) {
  const out = [];
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const e = kind === 'branded'
      ? { kind, name: String(r[0] || ''), brand: String(r[1] || ''), per100: { calories: num(r[2]), protein: num(r[3]), carbs: num(r[4]), fat: num(r[5]) }, fibre: num(r[6]), sugar: num(r[7]), sodium: num(r[8]), serving: r[9] || '', servingGrams: num(r[10]), barcode: String(r[11] || '') }
      : { kind: 'generic', name: String(r[0] || ''), brand: '', per100: { calories: num(r[1]), protein: num(r[2]), carbs: num(r[3]), fat: num(r[4]) }, fibre: num(r[5]), sugar: num(r[6]), sodium: num(r[7]), category: String(r[8] || ''), portions: parsePortions(r[9]) };
    if (!e.name) continue;
    e.hay = norm(`${e.brand} ${e.name}`);
    e.list = e.hay.split(' ').map(stem);
    e.tokens = new Set(e.list);
    out.push(e);
  }
  return out;
}

/** "1 cup=240|1 slice=28" -> [{ label, grams }]. */
export function parsePortions(text) {
  return String(text || '').split('|').map(p => {
    const i = p.lastIndexOf('=');
    const grams = num(p.slice(i + 1));
    const label = p.slice(0, i).trim();
    return i > 0 && grams > 0 && label ? { label, grams } : null;
  }).filter(Boolean);
}

const tokenHit = (e, word, prefixOk) => {
  if (e.tokens.has(word)) return 2;
  if (prefixOk) for (const t of e.tokens) if (t.startsWith(word)) return 1;
  return 0;
};

// Fast food chains and baby foods in the USDA data crowd out the basics, so they rank lower.
// The everyday version of the most common foods, shown first for that search. Matched on the start of the name.
export const STAPLES = {
  milk: ['Milk, whole, 3.25%', 'Milk, reduced fat, fluid, 2%', 'Milk, nonfat, fluid'], 'skim milk': ['Milk, nonfat, fluid'],
  egg: ['Egg, whole, raw, fresh', 'Egg, whole, cooked, hard-boiled', 'Egg, whole, cooked, fried'],
  oat: ['Oats, whole grain, rolled, old fashioned', 'Oats, whole grain, steel cut'], 'rolled oat': ['Oats, whole grain, rolled, old fashioned'],
  'chicken breast': ['Chicken, breast, boneless, skinless, raw', 'Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, grilled'],
  'beef mince': ['Beef, ground, 90% lean meat / 10% fat, raw', 'Beef, ground, 95% lean meat / 5% fat, raw'],
  rice: ['Rice, white, long-grain, regular, enriched, cooked', 'Rice, brown, long-grain, cooked', 'Rice, white, long-grain, regular, raw'],
  'brown rice': ['Rice, brown, long-grain, cooked'], 'white rice': ['Rice, white, long-grain, regular, enriched, cooked'],
  bread: ['Bread, whole-wheat, commercially prepared', 'Bread, white, commercially prepared'],
  butter: ['Butter, salted'], cheese: ['Cheese, cheddar'], pasta: ['Pasta, cooked, enriched, without added salt', 'Pasta, dry, enriched'],
  potato: ['Potatoes, white, flesh and skin, raw', 'Potatoes, white, flesh and skin, baked'], 'sweet potato': ['Sweet potato, raw, unprepared', 'Sweet potato, cooked, baked in skin'],
  banana: ['Bananas, raw'], apple: ['Apples, raw, with skin', 'Apples, raw, fuji, with skin'], avocado: ['Avocados, raw, all commercial varieties', 'Avocado, Hass'],
  broccoli: ['Broccoli, raw', 'Broccoli, cooked, boiled'], spinach: ['Spinach, raw'], 'peanut butter': ['Peanut butter, smooth style, with salt'],
  'greek yoghurt': ['Yogurt, Greek, plain, nonfat', 'Yogurt, Greek, plain, lowfat', 'Yogurt, Greek, plain, whole milk'],
  yoghurt: ['Yogurt, Greek, plain, nonfat', 'Yogurt, plain, low fat'], 'olive oil': ['Oil, olive, salad or cooking'],
  salmon: ['Fish, salmon, Atlantic, farm raised, raw', 'Fish, salmon, Atlantic, farmed, cooked, dry heat'], tuna: ['Fish, tuna, light, canned in water'],
  mince: ['Beef, ground, 90% lean meat / 10% fat, raw', 'Beef, ground, 95% lean meat / 5% fat, raw'],
  capsicum: ['Peppers, sweet, red, raw', 'Peppers, sweet, green, raw'], 'red capsicum': ['Peppers, sweet, red, raw'],
  almond: ['Nuts, almonds'], whey: ['Beverages, Whey protein powder isolate', 'Beverages, Protein powder whey based'],
};

// Searches where you almost always mean a packaged product: the plain food is only a small nudge there.
const SOFT_PINS = new Set(['yoghurt', 'greek yoghurt', 'bread', 'peanut butter', 'whey', 'cheese', 'pasta', 'butter']);

const PLAIN = ['raw', 'fluid', 'whole', 'plain', 'fresh'];
const ODD = ['dried', 'dehydrated', 'powder', 'imitation', 'substitute', 'canned', 'frozen', 'buttermilk'];
const EXOTIC = ['sheep', 'goat', 'human', 'buffalo', 'camel', 'mare', 'horse', 'whale', 'seal', 'moose', 'elk', 'caribou', 'duck', 'goose', 'emu', 'ostrich', 'quail', 'turtle', 'alligator'];
const NOISE = /^(mcdonald|burger king|wendy|taco bell|pizza hut|kfc|subway|domino|applebee|denny|carl|arby|popeye)/i;
const BABY = /\bbaby food\b|^babyfood|infant formula/i;

/**
 * Best matches first. Every query word must match (a word, a synonym, or a prefix for the last word).
 * Branded products rank above generic ones; shorter, plainer names rank above long ones.
 */
export function searchIndex(index, query, limit = 12) {
  const words = wordsOf(query);
  if (!words.length) return [];
  const q = words.join(' ');
  const pins = (STAPLES[q] || []).map(norm);
  const scored = [];
  for (const e of index) {
    let total = 0, ok = true;
    for (let i = 0; i < words.length && ok; i++) {
      const w = words[i];
      const last = i === words.length - 1;
      let best = tokenHit(e, w, last);
      for (const s of SYNONYMS[w] || []) best = Math.max(best, tokenHit(e, s, false) ? 1.5 : 0);
      if (!best) ok = false; else total += best;
    }
    if (!ok) continue;
    let s = total * 10;
    const name = norm(e.name);
    if (name === q || e.hay === q) s += 60;
    else if (name.startsWith(q) || e.hay.startsWith(q)) s += 35;
    else if (name.split(' ')[0] === words[0]) s += 15;
    s -= Math.min(30, e.list.length * 1.2);                            // plainer names first
    // The words you typed sitting at the front of the name beat the same words buried in a long one.
    if (words.every(w => { const i = e.list.indexOf(w); return i >= 0 && i < words.length + 1; })) s += 20;
    if (e.kind === 'generic') {
      for (const w of PLAIN) if (e.tokens.has(w)) s += 3;
      for (const w of ODD) if (e.tokens.has(w) && !words.includes(w)) s -= 5;
      for (const w of EXOTIC) if (e.tokens.has(w) && !words.includes(w)) s -= 9;
    }
    if (e.kind === 'branded') s += 25;       // a packaged product wins a tie, but a plain food still beats a loose word match (Banana Milk for "banana")
    if (e.kind === 'generic') {
      if (NOISE.test(e.name) || BABY.test(e.name)) s -= 25;
      if (/\braw\b/i.test(e.name)) s += 4;
    }
    if (pins.length) { const at = pins.findIndex(p => name.startsWith(p)); if (at >= 0 && e.kind === 'generic') s += (SOFT_PINS.has(q) ? 12 : 70) - at * 4; }
    scored.push({ e, s });
  }
  return scored.sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name)).slice(0, limit).map(x => x.e);
}

/** Tidy a USDA name for display: "Chicken, broilers or fryers, breast, meat only, raw" stays readable, just sentence-cased. */
export function prettyName(name) {
  const s = String(name || '').trim();
  return s.replace(/\s+/g, ' ').replace(/^./, c => c.toUpperCase());
}

/**
 * What the bundled data knows beyond calories and macros, per 100 g, in the micronutrient tracker's keys and units:
 * fibre and sugars (g) and sodium (mg) from the pack itself, plus the vitamins and minerals from the micros pack
 * when it has this food (attached by useFoodDb as `e.micros`). Missing is left out, never zero.
 */
export function microsOf(e) {
  const out = {};
  if (e.fibre > 0) out.fiber = e.fibre;
  if (e.sugar > 0) out.sugars = e.sugar;
  if (e.sodium > 0) out.sodium = e.sodium;
  return { ...out, ...(e.micros || {}) };
}

/**
 * Attach the vitamins and minerals from the micros pack ({ order: [keys], rows: { name: [values|null] } }) to the
 * everyday foods, matched by exact USDA name. Returns how many foods got some. Packaged products are left alone.
 */
export function attachMicros(index, pack) {
  const order = Array.isArray(pack?.order) ? pack.order : [], rows = pack?.rows || {};
  let n = 0;
  for (const e of index || []) {
    if (e.kind !== 'generic') continue;
    const r = rows[e.name];
    if (!Array.isArray(r)) continue;
    const m = {};
    order.forEach((k, i) => { if (r[i] != null && r[i] > 0) m[k] = r[i]; });
    if (Object.keys(m).length) { e.micros = m; n++; }
  }
  return n;
}

/** An index entry as a loggable food (the shape src/domain/foodLogger.js expects). */
export function dbFood(e) {
  // Packaged products read "Brand Product", unless the product name already starts with the brand.
  const display = e.brand ? (norm(e.name).startsWith(norm(e.brand)) ? e.name : `${e.brand} ${e.name}`) : prettyName(e.name);
  const portions = e.kind === 'branded'
    ? (e.servingGrams > 0 ? [{ label: `1 serving${e.serving ? ` (${e.serving})` : ''}`, grams: e.servingGrams }] : [])
    : e.portions;
  const sub = e.kind === 'branded'
    ? `${Math.round(e.per100.calories)} kcal / 100 g${e.servingGrams ? ` · ${Math.round(e.per100.calories * e.servingGrams / 100)} kcal a serving` : ''}`
    : `${Math.round(e.per100.calories)} kcal / 100 g${e.category ? ` · ${e.category}` : ''}`;
  return {
    // The barcode keeps two products with the same brand and name apart (they get different list keys).
    key: `${e.kind === 'branded' ? 'brand' : 'usda'}:${norm(e.brand + ' ' + e.name)}:${e.barcode || Math.round(e.per100.calories)}`, kind: 'db', name: display,
    amountKind: 'grams', unit: 'g', defaultAmount: portions[0]?.grams ?? 100,
    per100: { ...e.per100, micros: microsOf(e) }, sub, source: { name: display, per100: e.per100, brand: e.brand || null, barcode: e.barcode || null },
    portions, ingredients: [], brand: e.brand || null,
  };
}

/** A barcode without leading zeros, so a 12-digit UPC and its 13-digit EAN form match. */
export const barcodeKey = (code) => String(code || '').replace(/\D/g, '').replace(/^0+/, '');

/** The bundled product with this barcode, as a loggable food, or null. */
export function findByBarcode(index, code) {
  const k = barcodeKey(code);
  if (!k) return null;
  const e = (index || []).find(x => x.barcode && barcodeKey(x.barcode) === k);
  return e ? dbFood(e) : null;
}

/** The tap-to-pick portions for a food, each with its grams. Empty when the food has none. */
export function portionChips(food) {
  return (food?.portions || []).filter(p => p.grams > 0).slice(0, 5);
}
