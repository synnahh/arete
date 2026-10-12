// skinTiers.js — starter routines in three tiers (Essential, Complete, Power),
// chosen from the skin profile. Each tier includes the one before it. Steps are
// generic types ("Gentle cleanser"), not brands; the user swaps in products with
// Check a product. Built so routineWarnings() finds no clashes: the retinoid is
// on alternate nights and the acid never shares a night with it.
// Cosmetic guidance, not medical advice.
import { newStep, ALL_DAYS, routineWarnings } from './skin.js';

export const TIERS = ['essential', 'complete', 'power'];
export const TIER_LABEL = { essential: 'Essential', complete: 'Complete', power: 'Power' };
export const TIER_BLURB = {
  essential: 'Three steps. Cleanse, moisturise, protect. Enough for most people.',
  complete: 'Adds a targeted treatment for your main concern.',
  power: 'Adds a weekly exfoliant and a retinoid on alternate nights. Only if your skin is calm.',
};

const MON_WED_FRI = [1, 3, 5];
const TUE_THU_SAT = [2, 4, 6];
const SUNDAY = [0];

// The treatment for the top concern (first listed wins), morning or night.
const TREATMENT = {
  acne:         { name: 'Niacinamide serum', when: 'am' },
  pigmentation: { name: 'Vitamin C serum', when: 'am' },
  redness:      { name: 'Centella serum', when: 'pm' },
  dryness:      { name: 'Hyaluronic acid serum', when: 'pm' },
  aging:        { name: 'Peptide serum', when: 'pm' },
};

/** Steps for a tier as plain objects: { name, when, days }. */
function plan(tier, profile = {}) {
  const sensitive = profile.type === 'sensitive';
  const dry = profile.type === 'dry';
  const steps = [
    { name: sensitive || dry ? 'Gentle hydrating cleanser' : 'Gentle cleanser', when: 'both', days: ALL_DAYS },
    { name: dry ? 'Rich moisturiser' : 'Moisturiser', when: 'both', days: ALL_DAYS },
    { name: 'Sunscreen SPF 30+', when: 'am', days: ALL_DAYS },
  ];
  if (tier === 'essential') return steps;

  const concern = (profile.concerns || []).find(c => TREATMENT[c]) || 'dryness';
  const t = TREATMENT[concern];
  steps.splice(t.when === 'am' ? 1 : 2, 0, { name: t.name, when: t.when, days: ALL_DAYS });
  if (tier === 'complete') return steps;

  // Power: an exfoliant on Sunday, a retinoid on alternate nights (fewer for sensitive skin).
  if (!sensitive) steps.push({ name: 'BHA exfoliant (leave-on)', when: 'pm', days: SUNDAY });
  steps.push({ name: 'Retinol serum', when: 'pm', days: sensitive ? [2, 5] : (profile.concerns || []).includes('acne') ? MON_WED_FRI : TUE_THU_SAT });
  return steps;
}

/**
 * Routine steps for a tier and skin profile, as newStep() objects ready to save,
 * order: cleanse, treat, moisturise, protect. Night steps never contain sunscreen.
 */
export function suggestRoutine(tier, profile = {}) {
  const t = TIERS.includes(tier) ? tier : 'essential';
  const rank = (n) => (/cleanser/i.test(n) ? 0 : /serum|exfoliant/i.test(n) ? 1 : /moistur/i.test(n) ? 2 : 3);
  return plan(t, profile)
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s.name) - rank(b.s.name) || a.i - b.i)
    .map(({ s }) => ({ ...newStep(s.name, s.when), days: [...s.days] }));
}

/** Suggested steps that the routine does not already have (matched by name, ignoring case). */
export function newSteps(suggested, existing = []) {
  const have = new Set(existing.map(s => String(s.name).trim().toLowerCase()));
  return suggested.filter(s => !have.has(s.name.trim().toLowerCase()));
}

/** Clashes the suggested steps would introduce next to the existing routine. */
export function tierWarnings(suggested, existing = []) {
  const before = new Set(routineWarnings(existing).map(w => w.text));
  return routineWarnings([...existing, ...suggested]).filter(w => !before.has(w.text));
}
