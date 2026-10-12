// skin.js — structured skincare routine: which steps run when, how much of each
// supply that uses per day (feeds the Ahead engine), and ingredient conflicts.
// Pure functions; the UI is src/tabs/SkinRoutine.jsx.
//
// A step: { id, name, when: 'am' | 'pm' | 'both', days: [0..6], supplyId | null }
// `days` are weekdays the step runs (0 = Sunday), so "retinol Mon/Wed/Fri" works.

import { dayIndex as dayIdx } from '../utils/dayIndex.js';

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const WHEN_LABEL = { am: 'Morning', pm: 'Night', both: 'Morning + night' };

let seq = 0;
export function newStep(name, when = 'both', supplyId = null) {
  return { id: `st_${Date.now().toString(36)}${(seq++).toString(36)}`, name: String(name).trim(), when, days: [...ALL_DAYS], supplyId };
}

const runsAm = (s) => s.when === 'am' || s.when === 'both';
const runsPm = (s) => s.when === 'pm' || s.when === 'both';

/** Uses per day of the linked supply, averaged over the week. */
export function usesPerDay(step) {
  const days = Array.isArray(step.days) ? new Set(step.days.filter(d => d >= 0 && d <= 6)).size : 7;
  const sessions = step.when === 'both' ? 2 : 1;
  return +((days / 7) * sessions).toFixed(3);
}

/** Total uses per day of one supply across every step linked to it. */
export function supplyUsage(steps, supplyId) {
  return +steps.filter(s => s.supplyId === supplyId).reduce((sum, s) => sum + usesPerDay(s), 0).toFixed(3);
}

/** Steps to do in a period on a given weekday, in routine order. */
export function stepsFor(steps, period, weekday) {
  return steps.filter(s => (period === 'am' ? runsAm(s) : runsPm(s)) && (s.days ?? ALL_DAYS).includes(weekday));
}

/** Done / total for a period given today's ticks ({ [stepId]: true }). */
export function completion(steps, ticks = {}, period, weekday) {
  const todays = stepsFor(steps, period, weekday);
  return { done: todays.filter(s => ticks[s.id]).length, total: todays.length };
}

// Ingredient families, recognised from the step's name.
const TAGS = [
  ['retinoid',     /\b(retinol|retinal|retinaldehyde|retinoid|tretinoin|adapalene|differin)\b/i],
  ['aha',          /\b(aha|glycolic|lactic|mandelic)\b/i],
  ['bha',          /\b(bha|salicylic)\b/i],
  ['bpo',          /\b(benzoyl\s*peroxide|bpo)\b/i],
  ['vitc',         /\b(vitamin\s*c|ascorbic|l-ascorbic)\b/i],
  ['spf',          /\b(spf|sunscreen|sun\s*screen|sunblock)\b/i],
  ['niacinamide',  /\bniacinamide\b/i],
  ['azelaic',      /\b(azelaic)\b/i],
  ['copper',       /\b(copper\s*(tri)?peptide|ghk-?cu)\b/i],
  ['scrub',        /\b(scrub|exfoliating\s*(beads|polish|mitt)|microdermabrasion|dermaplan\w*)\b/i],
];

export function tagsFor(name) {
  const tags = new Set();
  for (const [tag, re] of TAGS) if (re.test(String(name))) tags.add(tag);
  return tags;
}

const sharesDay = (a, b) => (a.days ?? ALL_DAYS).some(d => (b.days ?? ALL_DAYS).includes(d));
const sharesPeriod = (a, b) => (runsAm(a) && runsAm(b)) || (runsPm(a) && runsPm(b));

/**
 * Conflicts and gaps in a routine. level 'warn' = likely irritation or a step
 * that undermines another; 'tip' = a gap worth knowing. General cosmetic
 * guidance, not medical advice.
 */
export function routineWarnings(steps) {
  const out = [];
  // `tagText` lets a step be judged by its ingredient list rather than just its name.
  const tagged = steps.map(s => ({ s, tags: tagsFor(s.tagText ?? s.name) }));
  const add = (level, text) => { if (!out.some(o => o.text === text)) out.push({ level, text }); };

  for (let i = 0; i < tagged.length; i++) {
    const { s, tags } = tagged[i];
    if (tags.has('retinoid') && runsAm(s)) {
      add('warn', `${s.name}: retinoids are best at night. They make skin more sun-sensitive and lose potency in daylight.`);
    }
    for (let j = i + 1; j < tagged.length; j++) {
      const other = tagged[j];
      if (!sharesPeriod(s, other.s) || !sharesDay(s, other.s)) continue;
      const pair = (a, b) => (tags.has(a) && other.tags.has(b)) || (tags.has(b) && other.tags.has(a));
      const label = `${s.name} + ${other.s.name}`;
      if (pair('retinoid', 'aha') || pair('retinoid', 'bha')) add('warn', `${label}: a retinoid with an exfoliating acid in the same routine is a common cause of irritation. Alternate nights instead.`);
      if (pair('retinoid', 'bpo')) add('warn', `${label}: benzoyl peroxide can break down tretinoin-type retinoids. Use them at different times.`);
      if (pair('vitc', 'bpo')) add('warn', `${label}: benzoyl peroxide can oxidise vitamin C. Keep them in separate routines.`);
      const acid = (t) => t.has('aha') || t.has('bha');
      if ((tags.has('retinoid') && other.tags.has('retinoid'))) add('warn', `${label}: two retinoids in the same routine adds irritation without adding benefit. Pick one.`);
      if (pair('vitc', 'retinoid')) add('tip', `${label}: both are active and can sting together. Vitamin C in the morning and the retinoid at night is the usual split.`);
      if ((tags.has('vitc') && acid(other.tags)) || (other.tags.has('vitc') && acid(tags))) add('tip', `${label}: vitamin C and an exfoliating acid together can sting. Use them at different times of day.`);
      if ((tags.has('bpo') && acid(other.tags)) || (other.tags.has('bpo') && acid(tags))) add('tip', `${label}: benzoyl peroxide with an exfoliating acid is drying and irritating. Alternate them.`);
      if ((tags.has('copper') && (other.tags.has('vitc') || acid(other.tags) || other.tags.has('retinoid'))) || (other.tags.has('copper') && (tags.has('vitc') || acid(tags) || tags.has('retinoid')))) add('tip', `${label}: copper peptides work best away from strong actives. Use them at a different time.`);
      if ((tags.has('scrub') && (acid(other.tags) || other.tags.has('retinoid') || other.tags.has('bpo'))) || (other.tags.has('scrub') && (acid(tags) || tags.has('retinoid') || tags.has('bpo')))) add('warn', `${label}: a physical scrub on top of an active is a fast way to over-exfoliate. Drop the scrub or the active.`);
      const azelaicClash = (t) => t.has('retinoid') || t.has('aha') || t.has('bha') || t.has('bpo');
      if ((tags.has('azelaic') && azelaicClash(other.tags)) || (other.tags.has('azelaic') && azelaicClash(tags))) add('warn', `${label}: azelaic acid should not share a night with a retinoid, an exfoliating acid or benzoyl peroxide. Use them on different nights.`);
      if ((tags.has('aha') && other.tags.has('bha')) || (tags.has('bha') && other.tags.has('aha'))) add('tip', `${label}: two exfoliating acids together can over-exfoliate. Watch for stinging or tightness.`);
    }
  }

  const hasSpf = steps.some(s => runsAm(s) && tagsFor(s.name).has('spf'));
  if (steps.length && !hasSpf) add('tip', 'No SPF in your morning routine. Sunscreen is the single most effective anti-ageing and tone-evening step.');
  return out;
}

// ── Daily skin rating ───────────────────────────────────────────────────────
// `lm_daily` rows carry an optional `skinRating` (1 rough … 5 great) next to the
// day's `skin` ticks. Ratings are subjective, so this only reports what the
// numbers show and never claims the routine caused a change.

export const RATING_LABELS = { 1: 'Rough', 2: 'Meh', 3: 'Okay', 4: 'Good', 5: 'Great' };

const DAY_MS = 86400000;
const validRating = (v) => (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 5 ? Number(v) : null);
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Rated days as [{ date, idx, rating, row }], oldest first. */
function rated(rows = []) {
  return rows
    .map(r => ({ date: r?.date, idx: dayIdx(r?.date), rating: validRating(r?.skinRating), row: r }))
    .filter(x => x.idx != null && x.rating != null)
    .sort((a, b) => a.idx - b.idx);
}

/**
 * This week's average rating against the week before. Needs 3+ ratings in the
 * last 7 days to say anything; the change needs 3+ in the week before too.
 */
export function ratingTrend(rows, today) {
  const t = dayIdx(today);
  const all = rated(rows);
  const thisWeek = all.filter(x => x.idx > t - 7 && x.idx <= t).map(x => x.rating);
  if (t == null || thisWeek.length < 3) return { status: 'insufficient', count: thisWeek.length };
  const before = all.filter(x => x.idx > t - 14 && x.idx <= t - 7).map(x => x.rating);
  const avg = +mean(thisWeek).toFixed(1);
  const prevAvg = before.length >= 3 ? +mean(before).toFixed(1) : null;
  return { status: 'ok', avg, count: thisWeek.length, prevAvg, delta: prevAvg == null ? null : +(avg - prevAvg).toFixed(1) };
}

/** Share of the day's scheduled steps that were ticked (both periods), or null when nothing was scheduled. */
export function dayAdherence(steps, row) {
  const idx = dayIdx(row?.date);
  if (idx == null) return null;
  const weekday = new Date(idx * DAY_MS).getUTCDay();
  let done = 0, total = 0;
  for (const period of ['am', 'pm']) {
    const c = completion(steps, row?.skin?.[period] || {}, period, weekday);
    done += c.done; total += c.total;
  }
  return total ? done / total : null;
}

/**
 * Do days you stuck to the routine get better ratings? Compares days with 80%+
 * of steps done against days under 50%, over the last 30 days. Needs 10+ rated
 * days with 4+ in each group; otherwise null. A correlation, not a proof.
 */
export function routineInsight(rows, steps, today, { days = 30 } = {}) {
  const t = dayIdx(today);
  if (t == null || !steps?.length) return null;
  const hi = [], lo = [];
  const window = rated(rows).filter(x => x.idx > t - days && x.idx <= t);
  for (const x of window) {
    const a = dayAdherence(steps, x.row);
    if (a == null) continue;
    if (a >= 0.8) hi.push(x.rating); else if (a < 0.5) lo.push(x.rating);
  }
  if (window.length < 10 || hi.length < 4 || lo.length < 4) return null;
  const high = +mean(hi).toFixed(1), low = +mean(lo).toFixed(1);
  return { high: { avg: high, days: hi.length }, low: { avg: low, days: lo.length }, diff: +(high - low).toFixed(1) };
}

// ── Check a product before you buy or add it ────────────────────────────────

export const TAG_LABELS = { copper: 'a copper peptide', scrub: 'a physical scrub', retinoid: 'a retinoid', aha: 'an AHA', bha: 'a BHA', bpo: 'benzoyl peroxide', vitc: 'vitamin C', spf: 'sunscreen', niacinamide: 'niacinamide' };

/**
 * What a product contains (from its name and ingredient text) and what it would
 * clash with if added to your routine in the morning, at night, or both.
 * Only conflicts that involve the new product are returned. General cosmetic
 * guidance, not medical advice; an ingredient list that isn't complete can only
 * under-report.
 */
export function checkProduct({ name, ingredients = '' }, steps = []) {
  const label = String(name || 'This product').trim() || 'This product';
  const tagText = `${label} ${ingredients}`;
  const tags = [...tagsFor(tagText)];
  const forPeriod = (when) => {
    const virtual = { ...newStep(label, when), name: label, tagText, days: ALL_DAYS };
    const before = new Set(routineWarnings(steps).map(w => w.text));
    return routineWarnings([...steps, virtual]).filter(w => !before.has(w.text) && w.text.includes(label));
  };
  const am = forPeriod('am'), pm = forPeriod('pm');
  const worst = [...am, ...pm].some(w => w.level === 'warn') ? 'warn' : [...am, ...pm].length ? 'tip' : 'ok';
  return { name: label, tags, am, pm, verdict: worst };
}
