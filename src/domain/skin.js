// skin.js — structured skincare routine: which steps run when, how much of each
// supply that uses per day (feeds the Ahead engine), and ingredient conflicts.
// Pure functions; the UI is src/tabs/SkinRoutine.jsx.
//
// A step: { id, name, when: 'am' | 'pm' | 'both', days: [0..6], supplyId | null }
// `days` are weekdays the step runs (0 = Sunday), so "retinol Mon/Wed/Fri" works.

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
  const tagged = steps.map(s => ({ s, tags: tagsFor(s.name) }));
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
      if ((tags.has('aha') && other.tags.has('bha')) || (tags.has('bha') && other.tags.has('aha'))) add('tip', `${label}: two exfoliating acids together can over-exfoliate. Watch for stinging or tightness.`);
    }
  }

  const hasSpf = steps.some(s => runsAm(s) && tagsFor(s.name).has('spf'));
  if (steps.length && !hasSpf) add('tip', 'No SPF in your morning routine. Sunscreen is the single most effective anti-ageing and tone-evening step.');
  return out;
}
