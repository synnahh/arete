// ahead.js — the Ahead engine: predict when each supply runs out, when to
// reorder, learn real usage from restocks, and build this week's cart.
// Pure functions; Supplies (src/tabs/Essentials.jsx) does the UI.
//
// An `essentials` row (all new fields optional, so old rows keep working):
//   name, category, boughtDate (= opened), lifespanDays (legacy manual days),
//   packQty, unit, dosePerUse, usesPerDay, packsOnHand (default 1),
//   leadDays (default 3), bufferDays (default 2), asin, storeUrl, price,
//   learnedDaysPerPack, learnCycles, restocks: [{ date, packs }],
//   autoSubtract (false = don't subtract logged food from this Kitchen supply),
//   paoMonths (shelf life once opened, the jar-with-a-lid symbol: 6M, 12M …)
// applyUsage() adds derived, never-saved fields: usageDaysLeft, usageDaysPerPack,
// stockLeft, stockUnit.

export const DEFAULT_LEAD_DAYS = 3;
export const DEFAULT_BUFFER_DAYS = 2;
const ALPHA = 0.3; // EWMA weight on each new observed cycle

const DAY = 86400000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const keyOf = (idx) => Number.isFinite(idx) ? new Date(idx * DAY).toISOString().slice(0, 10) : null;
const dayIndex = (key) => {
  if (!DATE_KEY_RE.test(String(key))) return null;
  const [y, m, d] = String(key).split('-').map(Number);
  const idx = Date.UTC(y, m - 1, d) / DAY;
  return keyOf(idx) === key ? idx : null;
};

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
  if (Number(item.usageDaysPerPack) > 0) return { days: Number(item.usageDaysPerPack), source: 'usage', confidence: 0.6 };
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
  const t = dayIndex(today);
  // Old/manual rows can contain free-text or impossible dates. One bad row
  // must not throw while Supplies maps every item to a forecast.
  if (start == null || t == null) return { status: 'unknown', source: per.source };
  let runOutIdx = Math.floor(start + per.days * packs);
  let source = per.source, confidence = per.confidence;
  // What the food log says is left, when that runs out sooner than the schedule.
  // Logging is never perfect, so the earlier date wins: a small early reorder
  // costs less than running out.
  const usageLeft = Number(item.usageDaysLeft);
  if (item.usageDaysLeft != null && Number.isFinite(usageLeft) && usageLeft >= 0) {
    const byUsage = t + Math.floor(usageLeft);
    if (byUsage < runOutIdx) { runOutIdx = byUsage; source = 'usage'; confidence = 0.8; }
  }
  const reorderIdx = runOutIdx - lead - buffer;
  const daysLeft = runOutIdx - t;
  const daysToReorder = reorderIdx - t;
  const status = daysLeft <= 0 ? 'out' : daysToReorder <= 0 ? 'order' : daysToReorder <= 7 ? 'soon' : 'ok';

  return {
    status, source, confidence,
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

/**
 * What restocking supplies will cost over the next `days` days, for Finance.
 * A supply is bought when it reaches its order-by date (today if already
 * overdue) and again every `days per pack` after that; only supplies with a
 * price and a known forecast count. Prices are per pack.
 */
export function projectedSpend(items, today, { days = 30 } = {}) {
  const end = dayIndex(today) + days;
  const lines = [];
  for (const item of items) {
    const price = Number(item.price);
    if (!(price > 0)) continue;
    const f = forecast(item, today);
    if (f.status === 'unknown') continue;
    let buy = Math.max(dayIndex(f.reorderBy), dayIndex(today));
    const dates = [];
    while (buy <= end && dates.length < 12) {
      dates.push(keyOf(buy));
      buy += Math.max(1, f.daysPerPack);
    }
    if (dates.length) lines.push({ name: item.name, price, dates, subtotal: +(price * dates.length).toFixed(2) });
  }
  lines.sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
  return { total: +lines.reduce((s, l) => s + l.subtotal, 0).toFixed(2), lines };
}

// ── Food log → pantry ────────────────────────────────────────────────────────
// Kitchen supplies that measure a pack in g/kg/ml/l lose stock as you log food:
// each nutrition-log entry with a g/ml quantity whose name contains the supply's
// name (Rice ⊂ "Basmati rice, cooked") counts against it. Everything is derived
// from the log on read, so deleting a meal puts the stock back and nothing is
// written or double-counted.

const UNITS = { g: ['mass', 1], gram: ['mass', 1], grams: ['mass', 1], kg: ['mass', 1000], ml: ['vol', 1], l: ['vol', 1000], litre: ['vol', 1000], litres: ['vol', 1000], liter: ['vol', 1000], liters: ['vol', 1000] };

/** A quantity in base units (g or ml), or null when the unit isn't a mass/volume. */
export function toBase(qty, unit) {
  const u = UNITS[String(unit || '').toLowerCase().trim()];
  const q = Number(qty);
  return u && q > 0 ? { kind: u[0], amount: q * u[1], factor: u[1] } : null;
}

const singular = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const tokens = (name) => norm(name).split(' ').filter(w => w.length > 1).map(singular);

/** Kitchen supplies that can lose stock to logged food. */
export function isTracked(item) {
  return item?.category === 'kitchen' && item.autoSubtract !== false && !!toBase(item.packQty, item.unit) && tokens(item.name).length > 0;
}

// The tracked supply a food belongs to: every word of the supply's name is in
// the food's name and the units are the same kind. The most specific supply
// wins; a tie between different supplies matches nothing rather than guessing.
function bestMatch(foodTokens, kind, tracked) {
  let best = null, tie = false;
  for (const t of tracked) {
    if (t.kind !== kind || !t.toks.every(w => foodTokens.includes(w))) continue;
    if (!best || t.toks.length > best.toks.length) { best = t; tie = false; }
    else if (t.toks.length === best.toks.length) tie = true;
  }
  return tie ? null : best;
}

/**
 * Per tracked supply, from the nutrition log since it was opened:
 * { consumed, left, perDay, days } in the supply's own unit, perDay averaged
 * over the last `windowDays` and days = distinct days with use in that window.
 */
export function pantryUsage(items = [], nutritionLogs = [], today, { windowDays = 14 } = {}) {
  const t = dayIndex(today);
  if (t == null) return new Map();
  const tracked = items.filter(isTracked).map(item => {
    const pack = toBase(item.packQty, item.unit);
    const packs = Number(item.packsOnHand) > 0 ? Number(item.packsOnHand) : 1;
    return { item, toks: tokens(item.name), kind: pack.kind, factor: pack.factor, total: pack.amount * packs, start: dayIndex(item.boughtDate), consumed: 0, window: 0, days: new Set() };
  }).filter(x => x.start != null);

  for (const log of nutritionLogs) {
    const day = dayIndex(log?.date);
    if (day == null || day > t) continue;
    for (const meal of log.meals || []) {
      // A meal logged from the meal plan carries its ingredients: count each of
      // those (2 eggs, 200 g chicken) rather than the meal as one lump.
      const parts = Array.isArray(meal?.ingredients) && meal.ingredients.length ? meal.ingredients : [meal];
      for (const part of parts) {
        const b = toBase(part?.qty, part?.unit);
        if (!b) continue;
        const m = bestMatch(tokens(part.name), b.kind, tracked);
        if (!m || day < m.start) continue;
        m.consumed += b.amount;
        if (day > t - windowDays) { m.window += b.amount; m.days.add(day); }
      }
    }
  }

  const out = new Map();
  for (const m of tracked) {
    if (!m.consumed) continue;
    const spanDays = Math.min(windowDays, t - m.start + 1);
    out.set(m.item.id ?? m.item.name, {
      consumed: +(m.consumed / m.factor).toFixed(1),
      left: +(Math.max(0, m.total - m.consumed) / m.factor).toFixed(1),
      perDay: +(m.window / m.factor / Math.max(1, spanDays)).toFixed(2),
      perDayBase: m.window / Math.max(1, spanDays),
      leftBase: Math.max(0, m.total - m.consumed),
      packBase: m.total / (Number(m.item.packsOnHand) > 0 ? Number(m.item.packsOnHand) : 1),
      days: m.days.size,
    });
  }
  return out;
}

/**
 * Items with the food-log usage folded in (new objects; nothing is saved).
 * The run-out date only follows the log once it has 3+ days of use in the last
 * two weeks; before that the stock is shown but the schedule still forecasts.
 */
export function applyUsage(items = [], nutritionLogs = [], today, opts) {
  const usage = pantryUsage(items, nutritionLogs, today, opts);
  if (!usage.size) return items;
  return items.map(item => {
    const u = usage.get(item.id ?? item.name);
    if (!u) return item;
    const out = { ...item, stockLeft: u.left, stockUnit: item.unit };
    if (u.days >= 3 && u.perDayBase > 0) {
      out.usageDaysLeft = u.leftBase / u.perDayBase;
      out.usageDaysPerPack = u.packBase / u.perDayBase;
    }
    return out;
  });
}

// ── Shelf life after opening (PAO) ───────────────────────────────────────────

const addMonths = (key, months) => {
  const [y, m, d] = key.split('-').map(Number);
  const total = (m - 1) + Math.round(months);
  const yy = y + Math.floor(total / 12), mm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate(); // clamp 31 Jan + 1 month to 28/29 Feb
  return keyOf(Date.UTC(yy, mm, Math.min(d, last)) / DAY);
};

/**
 * When an opened product should be used by, from the day it was opened
 * (`openedDate`, else `boughtDate`) plus `paoMonths`. status: 'expired',
 * 'soon' (within `warnDays`), 'ok', or 'unknown' when either is missing.
 * Guidance printed on the product wins over this; it is a prompt, not a test.
 */
export function expiry(item, today, { warnDays = 30 } = {}) {
  const months = Number(item?.paoMonths);
  const opened = item?.openedDate || item?.boughtDate;
  const t = dayIndex(today);
  if (!(months >= 1 && months <= 60) || dayIndex(opened) == null || t == null) return { status: 'unknown' };
  const useBy = addMonths(opened, months);
  const daysLeft = dayIndex(useBy) - t;
  return { status: daysLeft < 0 ? 'expired' : daysLeft <= warnDays ? 'soon' : 'ok', useBy, daysLeft };
}

/** Items past or near their use-by date, soonest first. */
export function expiringItems(items = [], today, { warnDays = 30 } = {}) {
  return items
    .map(item => ({ item, e: expiry(item, today, { warnDays }) }))
    .filter(({ e }) => e.status === 'expired' || e.status === 'soon')
    .sort((a, b) => a.e.daysLeft - b.e.daysLeft);
}
