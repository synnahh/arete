// ahead.js — the Ahead engine: predict when each supply runs out, when to
// reorder, learn real usage from restocks, and build this week's cart.
// Pure functions; Supplies (src/tabs/Essentials.jsx) does the UI.
//
// An `essentials` row (all new fields optional, so old rows keep working):
//   name, category, boughtDate (= opened), lifespanDays (legacy manual days),
//   packQty, unit, dosePerUse, usesPerDay, packsOnHand (default 1),
//   leadDays (default 3), bufferDays (default 2), asin, storeUrl, price,
//   learnedDaysPerPack, learnCycles, restocks: [{ date, packs }]

export const DEFAULT_LEAD_DAYS = 3;
export const DEFAULT_BUFFER_DAYS = 2;
const ALPHA = 0.3; // EWMA weight on each new observed cycle

const DAY = 86400000;
const dayIndex = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
};
const keyOf = (idx) => new Date(idx * DAY).toISOString().slice(0, 10);

/** Days one pack lasts on the planned schedule, or null. */
export function scheduledDaysPerPack(item) {
  const qty = Number(item.packQty), dose = Number(item.dosePerUse), uses = Number(item.usesPerDay);
  if (qty > 0 && dose > 0 && uses > 0) return qty / (dose * uses);
  return null;
}

/**
 * Best estimate of days per pack and where it came from:
 * learned (2+ real cycles) → schedule → learned (1 cycle) → manual lifespan.
 */
export function daysPerPack(item) {
  const learned = Number(item.learnedDaysPerPack) > 0 ? Number(item.learnedDaysPerPack) : null;
  const cycles = Number(item.learnCycles) || 0;
  const scheduled = scheduledDaysPerPack(item);
  if (learned && cycles >= 2) return { days: learned, source: 'learned', confidence: Math.min(0.95, 0.5 + cycles * 0.1) };
  if (scheduled)              return { days: scheduled, source: 'schedule', confidence: 0.7 };
  if (learned)                return { days: learned, source: 'learned', confidence: 0.5 };
  if (Number(item.lifespanDays) > 0) return { days: Number(item.lifespanDays), source: 'manual', confidence: 0.4 };
  return null;
}

/**
 * Run-out and reorder dates for an item as of `today` (YYYY-MM-DD).
 * status: 'out' (past run-out), 'order' (past reorder-by), 'soon' (reorder
 * within 7 days), 'ok', or 'unknown' (not enough information).
 */
export function forecast(item, today) {
  const per = daysPerPack(item);
  if (!per || !item.boughtDate) return { status: 'unknown', source: per?.source ?? null };
  const packs = Number(item.packsOnHand) > 0 ? Number(item.packsOnHand) : 1;
  const lead = Number.isFinite(Number(item.leadDays)) && item.leadDays !== '' && item.leadDays != null ? Number(item.leadDays) : DEFAULT_LEAD_DAYS;
  const buffer = Number.isFinite(Number(item.bufferDays)) && item.bufferDays !== '' && item.bufferDays != null ? Number(item.bufferDays) : DEFAULT_BUFFER_DAYS;

  const start = dayIndex(item.boughtDate);
  const runOutIdx = Math.floor(start + per.days * packs);
  const reorderIdx = runOutIdx - lead - buffer;
  const t = dayIndex(today);
  const daysLeft = runOutIdx - t;
  const daysToReorder = reorderIdx - t;
  const status = daysLeft <= 0 ? 'out' : daysToReorder <= 0 ? 'order' : daysToReorder <= 7 ? 'soon' : 'ok';

  return {
    status, source: per.source, confidence: per.confidence,
    daysPerPack: +per.days.toFixed(1),
    runOut: keyOf(runOutIdx), reorderBy: keyOf(reorderIdx),
    daysLeft, daysToReorder,
  };
}

/**
 * Record a restock on `date` and learn from the cycle that just ended:
 * observed days per pack = days since opened / packs that were on hand.
 * Observations far off the current estimate (under ¼ or over 4×, e.g. a
 * forgotten restock) are ignored. Returns the fields to update.
 */
export function restock(item, date, packs = 1) {
  const prevPacks = Number(item.packsOnHand) > 0 ? Number(item.packsOnHand) : 1;
  const out = {
    boughtDate: date,
    packsOnHand: packs,
    restocks: [...(item.restocks || []), { date, packs }].slice(-24),
  };
  if (!item.boughtDate) return out;

  const observed = (dayIndex(date) - dayIndex(item.boughtDate)) / prevPacks;
  if (!(observed >= 1)) return out;
  const expected = daysPerPack(item)?.days;
  if (expected && (observed < expected / 4 || observed > expected * 4)) return out;

  const prev = Number(item.learnedDaysPerPack) > 0 ? Number(item.learnedDaysPerPack) : null;
  out.learnedDaysPerPack = +(prev ? prev * (1 - ALPHA) + observed * ALPHA : observed).toFixed(2);
  out.learnCycles = (Number(item.learnCycles) || 0) + 1;
  return out;
}

/** Items to put in this week's cart: due now or within `withinDays`. */
export function dueItems(items, today, withinDays = 7) {
  return items
    .map(item => ({ item, f: forecast(item, today) }))
    .filter(({ f }) => f.status !== 'unknown' && f.daysToReorder <= withinDays)
    .sort((a, b) => a.f.daysToReorder - b.f.daysToReorder);
}

const ASIN_RE = /^[A-Z0-9]{10}$/;

/** Pull an ASIN out of a pasted Amazon URL or a bare ASIN. */
export function parseAsin(input) {
  const s = String(input || '').trim();
  if (ASIN_RE.test(s.toUpperCase())) return s.toUpperCase();
  const m = s.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Links that put the cart together for review. Items with an ASIN share one
 * Amazon add-to-cart link; the rest get a search link. Nothing is bought:
 * the owner reviews and checks out in the store.
 */
export function cartLinks(entries, { domain = 'amazon.com.au' } = {}) {
  const withAsin = entries.filter(e => parseAsin(e.asin));
  const params = withAsin
    .map((e, i) => `ASIN.${i + 1}=${parseAsin(e.asin)}&Quantity.${i + 1}=${Math.max(1, Math.round(e.qty || 1))}`)
    .join('&');
  return {
    cart: withAsin.length ? `https://www.${domain}/gp/aws/cart/add.html?${params}` : null,
    searches: entries
      .filter(e => !parseAsin(e.asin))
      .map(e => ({ name: e.name, url: e.storeUrl || `https://www.${domain}/s?k=${encodeURIComponent(e.name)}` })),
  };
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Shopping list from a saved meal plan: ingredients summed by name and unit,
 * minus pantry items that are in stock (Kitchen supplies not yet due).
 */
export function shoppingList(plan, pantry = [], today) {
  const inStock = new Set(
    pantry.filter(p => {
      const f = forecast(p, today);
      return f.status === 'ok' || f.status === 'soon';
    }).map(p => norm(p.name))
  );
  const totals = new Map();
  for (const day of plan || []) {
    for (const meal of day?.meals || []) {
      for (const ing of meal?.ingredients || []) {
        const name = norm(ing.name);
        if (!name || inStock.has(name)) continue;
        const unit = norm(ing.unit) || 'x';
        const k = `${name}|${unit}`;
        const cur = totals.get(k) || { name: ing.name.trim(), unit: ing.unit || '', qty: 0 };
        cur.qty += Number(ing.qty) || 0;
        totals.set(k, cur);
      }
    }
  }
  return [...totals.values()]
    .map(x => ({ ...x, qty: Math.round(x.qty * 10) / 10 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
