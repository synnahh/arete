// skinScore.js — how well a product suits YOUR skin, from its ingredient list.
// Pure and rule-based so every point of the score has a stated reason (no black
// box). Cosmetic guidance from widely used ingredient-to-concern pairings, not
// medical advice; a missing or partial ingredient list can only under-report.
//
// skinProfile: { type: 'oily'|'dry'|'combination'|'normal'|'sensitive'|null,
//                concerns: ['acne','aging','pigmentation','redness','dryness'],
//                avoid: 'free text, comma separated (e.g. "fragrance, coconut")' }

import { checkProduct } from './skin.js';

export const SKIN_TYPES = ['oily', 'dry', 'combination', 'normal', 'sensitive'];
export const SKIN_CONCERNS = ['acne', 'aging', 'pigmentation', 'redness', 'dryness'];
export const CONCERN_LABEL = { acne: 'Acne', aging: 'Fine lines', pigmentation: 'Dark spots', redness: 'Redness', dryness: 'Dryness' };

// Ingredients that help each concern.
const HELPS = {
  acne:         [['salicylic acid', /salicylic|betaine salicylate/i], ['benzoyl peroxide', /benzoyl\s*peroxide/i], ['adapalene', /adapalene/i], ['azelaic acid', /azelaic/i], ['niacinamide', /niacinamide/i], ['zinc', /\bzinc (pca|gluconate)\b/i]],
  aging:        [['a retinoid', /retinol|retinal|retinaldehyde|tretinoin|adapalene|retinyl|hydroxypinacolone/i], ['peptides', /peptide/i], ['vitamin C', /ascorbic|ascorbyl|vitamin\s*c\b/i], ['sunscreen filters', /zinc oxide|titanium dioxide|avobenzone|octocrylene|tinosorb|uvinul|homosalate/i]],
  pigmentation: [['vitamin C', /ascorbic|ascorbyl|vitamin\s*c\b/i], ['niacinamide', /niacinamide/i], ['azelaic acid', /azelaic/i], ['tranexamic acid', /tranexamic/i], ['alpha arbutin', /arbutin/i], ['kojic acid', /kojic/i], ['an AHA', /glycolic|lactic acid|mandelic/i], ['sunscreen filters', /zinc oxide|titanium dioxide|avobenzone|tinosorb|uvinul/i]],
  redness:      [['azelaic acid', /azelaic/i], ['centella', /centella|cica|madecassoside/i], ['niacinamide', /niacinamide/i], ['allantoin', /allantoin/i], ['panthenol', /panthenol/i]],
  dryness:      [['hyaluronic acid', /hyaluron/i], ['glycerin', /glycerin/i], ['ceramides', /ceramide/i], ['squalane', /squalane/i], ['urea', /\burea\b/i], ['panthenol', /panthenol/i], ['shea butter', /shea/i]],
};

// Ingredients that suit a skin type.
const TYPE_HELPS = {
  oily:        [['niacinamide', /niacinamide/i], ['salicylic acid', /salicylic/i], ['zinc', /\bzinc (pca|gluconate)\b/i], ['clay', /kaolin|bentonite/i]],
  dry:         [['hyaluronic acid', /hyaluron/i], ['ceramides', /ceramide/i], ['glycerin', /glycerin/i], ['squalane', /squalane/i]],
  combination: [['niacinamide', /niacinamide/i], ['hyaluronic acid', /hyaluron/i]],
  normal:      [],
  sensitive:   [['ceramides', /ceramide/i], ['centella', /centella|cica|madecassoside/i], ['panthenol', /panthenol/i], ['allantoin', /allantoin/i]],
};

const FRAGRANCE = /\b(fragrance|parfum|perfume|linalool|limonene|citronellol|geraniol|citral|eugenol|coumarin|essential oil)\b/i;
const DRYING_ALCOHOL = /\b(alcohol denat|denatured alcohol|sd alcohol|isopropyl alcohol|ethanol)\b/i;
const CLOGGERS = [['coconut oil', /coconut oil|cocos nucifera/i], ['isopropyl myristate', /isopropyl (myristate|palmitate|isostearate)/i], ['cocoa butter', /theobroma cacao|cocoa butter/i], ['wheat germ oil', /wheat germ/i], ['algae extract', /algae extract|laminaria/i]];
const IRRITANTS = [['a retinoid', /retinol|retinal|tretinoin|adapalene/i], ['an exfoliating acid', /glycolic|salicylic|lactic acid|mandelic|\baha\b|\bbha\b/i], ['benzoyl peroxide', /benzoyl\s*peroxide/i]];

const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const avoidList = (avoid) => clean(avoid).split(/[,;\n]/).map(s => s.trim().toLowerCase()).filter(s => s.length >= 3);

export const scoreBand = (score) => (score == null ? 'unknown' : score >= 75 ? 'great' : score >= 55 ? 'decent' : score >= 35 ? 'mixed' : 'poor');
export const BAND_LABEL = { great: 'Great fit', decent: 'Decent fit', mixed: 'Mixed fit', poor: 'Poor fit', unknown: 'Not enough to score' };

/**
 * Score a product 0-100 against a skin profile (and, when given, the clashes
 * with the current routine). Returns { score, band, reasons: [{ kind: 'good'|'bad'|'note', text }] }.
 * score is null when there is no ingredient list or no profile to judge against.
 */
export function scoreProduct({ name, ingredients = '' }, skinProfile = {}, steps = []) {
  const list = clean(ingredients);
  const type = SKIN_TYPES.includes(skinProfile?.type) ? skinProfile.type : null;
  const concerns = (skinProfile?.concerns || []).filter(c => SKIN_CONCERNS.includes(c));
  const avoid = avoidList(skinProfile?.avoid);

  if (!type && !concerns.length && !avoid.length) return { score: null, band: 'unknown', reasons: [{ kind: 'note', text: 'Set your skin type and concerns to see how well this suits you.' }] };
  if (!list) return { score: null, band: 'unknown', reasons: [{ kind: 'note', text: 'Add the ingredient list to score this product.' }] };

  let score = 55;
  const reasons = [];
  const good = (pts, text) => { score += pts; reasons.push({ kind: 'good', text }); };
  const bad = (pts, text) => { score -= pts; reasons.push({ kind: 'bad', text }); };
  const seen = new Set();

  // Concern matches: +12 for the first ingredient that helps, +5 for each further one, capped per concern.
  for (const c of concerns) {
    const hits = HELPS[c].filter(([, re]) => re.test(list)).map(([n]) => n);
    if (!hits.length) { reasons.push({ kind: 'note', text: `Nothing here specifically targets ${CONCERN_LABEL[c].toLowerCase()}.` }); continue; }
    good(Math.min(12 + (hits.length - 1) * 5, 22), `Helps with ${CONCERN_LABEL[c].toLowerCase()}: ${hits.join(', ')}.`);
    hits.forEach(h => seen.add(h));
  }

  // Skin-type fit, counting only ingredients not already credited above.
  if (type) {
    const hits = TYPE_HELPS[type].filter(([n, re]) => re.test(list) && !seen.has(n)).map(([n]) => n);
    if (hits.length) good(Math.min(4 + hits.length * 2, 10), `Suits ${type} skin: ${hits.join(', ')}.`);
    if ((type === 'oily' || type === 'combination' || concerns.includes('acne'))) {
      const clog = CLOGGERS.filter(([, re]) => re.test(list)).map(([n]) => n);
      if (clog.length) bad(Math.min(10 * clog.length, 25), `Can clog pores on ${concerns.includes('acne') ? 'acne-prone' : type} skin: ${clog.join(', ')}.`);
    }
    if ((type === 'dry' || type === 'sensitive') && DRYING_ALCOHOL.test(list)) bad(12, 'Contains drying alcohol, which can strip dry or sensitive skin.');
    if (type === 'sensitive') {
      if (FRAGRANCE.test(list)) bad(15, 'Contains fragrance or fragrance allergens, a common trigger for sensitive skin.');
      const irr = IRRITANTS.filter(([, re]) => re.test(list)).map(([n]) => n);
      if (irr.length) bad(Math.min(8 * irr.length, 16), `Active enough to irritate sensitive skin: ${irr.join(', ')}. Introduce slowly.`);
    }
  }

  // The user's own avoid list is absolute.
  for (const a of avoid) {
    if (list.toLowerCase().includes(a)) bad(25, `Contains "${a}", which is on your avoid list.`);
  }

  // Clashes with the current routine.
  if (steps?.length) {
    const check = checkProduct({ name, ingredients: list }, steps);
    const clashes = [...check.am, ...check.pm];
    const warns = new Set(clashes.filter(w => w.level === 'warn').map(w => w.text));
    const tips = new Set(clashes.filter(w => w.level === 'tip').map(w => w.text));
    if (warns.size) bad(Math.min(18 * warns.size, 30), 'Would clash with part of your current routine (see the warnings above).');
    else if (tips.size) bad(6, 'Overlaps with something in your routine. Worth checking.');
  }

  // Ingredient lists are ordered by amount; a very short one usually means an incomplete label.
  if (list.split(',').length < 4) reasons.push({ kind: 'note', text: 'That is a very short ingredient list. Check it is complete, or the score may be off.' });

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, band: scoreBand(score), reasons };
}
