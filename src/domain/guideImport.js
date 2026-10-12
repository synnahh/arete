// guideImport.js — Rob's "Complete Appearance Fitness and Skin Guide" (25 Sep 2026) as app
// data: two training programs, the two daily bowls and three snacks as saved meals,
// creatine and whey, the skin routine, and one reference note. Pure.
//
// Everything below is copied from the guide. Where the guide gives a choice ("leg press
// or goblet squat") the first option is used and the other is left to Replace in Train.
// Where it gives a range of sets ("1-2") the lower number is used. Macros the guide does
// not state (carbs and fat for the three snacks) are left at 0 and said so in the review.
// buildGuideImport() only works out what is NEW: anything you already have by the same
// name is left alone, so importing twice adds nothing.

import { findExercise, toLibraryEntry } from './exerciseDb.js';
import { freshEntries } from './exercisePick.js';
import { newStep } from './skin.js';

export const GUIDE_ID = 'guide-2026-09-25';
export const GUIDE_TITLE = 'Complete Appearance Fitness and Skin Guide (25 Sep 2026)';

const lc = (s) => String(s || '').trim().toLowerCase();

// ── Training ─────────────────────────────────────────────────────────────────
// [exercise name in the exercise database, sets, repsMin, repsMax]
const REENTRY_A = [
  ['Leg Press', 2, 8, 10], ['Machine Row', 2, 8, 12], ['Chest Press Machine', 2, 8, 10], ['Romanian Deadlift', 2, 8, 10],
  ['Lateral Raise', 2, 12, 20], ['DB Curl', 1, 10, 15], ['Overhead Triceps Extension', 1, 10, 15],
];
const REENTRY_B = [
  ['Hack Squat', 2, 8, 10], ['Close-Grip Lat Pulldown', 2, 8, 12], ['Low-Incline Neutral-Grip DB Press', 2, 8, 10], ['Seated Leg Curl', 2, 10, 15],
  ['Reverse Pec Deck', 2, 12, 20], ['Standing Calf Raise', 2, 10, 15], ['Reverse Crunch', 2, 10, 15],
];
const UPPER_A = [
  ['Low-Incline Neutral-Grip DB Press', 3, 6, 10], ['Close-Grip Lat Pulldown', 3, 8, 12], ['Machine Row', 2, 8, 12], ['Chest Press Machine', 2, 8, 12],
  ['Lateral Raise', 3, 12, 20], ['Reverse Pec Deck', 2, 12, 20], ['Incline DB Curl', 2, 8, 12], ['Triceps Press Machine', 2, 10, 15],
];
const LOWER_A = [
  ['Hack Squat', 3, 6, 10], ['Romanian Deadlift', 3, 6, 10], ['Seated Leg Curl', 2, 10, 15], ['Split Squat', 2, 8, 12],
  ['Standing Calf Raise', 3, 8, 15], ['Reverse Crunch', 2, 10, 15],
];
const UPPER_B = [
  ['Chest Press Machine', 3, 6, 10], ['Low-Incline Neutral-Grip DB Press', 2, 8, 12], ['Close-Grip Lat Pulldown', 2, 8, 12], ['Chest-Supported Row', 2, 10, 15],
  ['Pec Deck', 2, 10, 15], ['Lateral Raise', 4, 12, 20], ['Reverse Pec Deck', 2, 12, 20], ['Overhead Triceps Extension', 2, 10, 15],
];
const LOWER_B = [
  ['Leg Press', 3, 10, 15], ['Hip Thrust', 2, 8, 12], ['Lying Leg Curl', 3, 10, 15], ['Leg Extension', 2, 12, 20],
  ['Seated Calf Raise', 3, 10, 20], ['Hanging Knee Raise', 2, 8, 15],
];
const UPPER_C = [
  ['Close-Grip Lat Pulldown', 3, 8, 12], ['Chest-Supported Row', 3, 8, 12], ['One-arm DB Row', 2, 10, 15], ['Pec Deck', 2, 10, 15],
  ['Lateral Raise', 4, 12, 25], ['Reverse Pec Deck', 2, 12, 20], ['Preacher Curl', 2, 8, 12], ['Triceps Press Machine', 2, 10, 15],
];

export const GUIDE_PROGRAMS = [
  {
    name: 'Guide: Re-entry, 3 full-body days (weeks 1-2)',
    note: 'Monday A, Wednesday B, Friday A; the next week B, A, B. About 3-4 reps in reserve. First session back: one or two sets each.',
    days: { mon: ['Full body A', REENTRY_A], wed: ['Full body B', REENTRY_B], fri: ['Full body A', REENTRY_A] },
  },
  {
    name: 'Guide: Frame-priority 5 day (weeks 3-12)',
    note: 'Sets shown are the full weekly target. In weeks 3-4 do 2 sets on the upper days; add sets from week 5 only when soreness clears in 1-2 days and the shoulder feels good.',
    days: { mon: ['Upper A', UPPER_A], tue: ['Lower A', LOWER_A], thu: ['Upper B', UPPER_B], fri: ['Lower B', LOWER_B], sat: ['Upper C', UPPER_C] },
  },
];

/** Every exercise name the guide's programs use, in order of first appearance. */
export function guideExerciseNames() {
  const out = [];
  for (const p of GUIDE_PROGRAMS) for (const [, rows] of Object.values(p.days)) for (const [name] of rows) if (!out.includes(name)) out.push(name);
  return out;
}

// ── Food ─────────────────────────────────────────────────────────────────────
const meal = (name, calories, protein, carbs, fat, ingredients, note) => ({ name, calories, protein, carbs, fat, micros: {}, ingredients, servings: 1, source: GUIDE_ID, note });
export const GUIDE_MEALS = [
  meal('Beef bowl', 675, 39, 63, 26, [
    { name: 'Lean beef mince', qty: 130, unit: 'g' }, { name: 'White rice', qty: 50, unit: 'g' }, { name: 'Black beans', qty: 80, unit: 'g' },
    { name: 'Green beans', qty: 150, unit: 'g' }, { name: 'Avocado', qty: 50, unit: 'g' }, { name: 'Passata', qty: 100, unit: 'g' },
    { name: 'Onion', qty: 50, unit: 'g' }, { name: 'Olive oil', qty: 5, unit: 'g' },
  ], 'Raw mince, dry rice, drained beans. Garlic, cumin, smoked paprika, lemon. About 16 g fibre.'),
  meal('Korean chicken bowl', 650, 43, 78, 17, [
    { name: 'Chicken breast', qty: 140, unit: 'g' }, { name: 'White rice', qty: 65, unit: 'g' }, { name: 'Mixed vegetables', qty: 250, unit: 'g' },
    { name: 'Gochujang', qty: 10, unit: 'g' }, { name: 'Salt-reduced soy sauce', qty: 3, unit: 'ml' }, { name: 'Rice vinegar', qty: 15, unit: 'ml' },
    { name: 'Sesame oil', qty: 5, unit: 'g' }, { name: 'Olive oil', qty: 5, unit: 'g' }, { name: 'Sesame seeds', qty: 5, unit: 'g' },
  ], 'Raw chicken, dry rice. Start gochujang at 5 g: it is spicy and can flare rosacea.'),
  meal('Egg toast', 410, 21, 0, 0, [{ name: 'Sourdough', qty: 80, unit: 'g' }, { name: 'Avocado', qty: 50, unit: 'g' }], '2 eggs, 80 g sourdough, 50 g avocado. The guide gives no carbs or fat for this one.'),
  meal('Whey shake', 280, 34, 0, 0, [{ name: 'Whey protein', qty: 25, unit: 'g' }, { name: 'Reduced-fat milk', qty: 400, unit: 'ml' }], '25 g whey in 400 mL reduced-fat milk. Check the label: 25 g of powder is not always 25 g of protein. The guide gives no carbs or fat.'),
  meal('Yoghurt and fruit', 280, 21, 0, 0, [{ name: 'Greek yoghurt', qty: 200, unit: 'g' }], '200 g Chobani Natural Light, 1 banana, 1 orange. The guide gives no carbs or fat.'),
];

// ── Supplements (the guide's "simple evidence-led stack") ─────────────────────
export const GUIDE_SUPPLEMENTS = [
  { name: 'Creatine monohydrate', dose: '3-5 g', timeOfDay: 'anytime', colour: '#4a9eff', notes: '3-5 g daily, any time. Drink normally. Ask a clinician first if you have kidney disease or take medication.', micros: {}, streak: 0 },
  { name: 'Whey protein', dose: '25 g', timeOfDay: 'anytime', colour: '#4caf7d', notes: '25 g in the whey shake. Counted in the protein target, not extra.', micros: {}, streak: 0 },
];

// ── Skin (rosacea-prone cheeks: barrier first) ────────────────────────────────
export const GUIDE_SKIN = [
  ['CeraVe Hydrating Cleanser', 'pm'],
  ['CeraVe Moisturising Lotion', 'both'],
  ['Sunscreen SPF 50+ (check the bottle says SPF)', 'am'],
  ['Lip balm SPF 50+ (Dermal Therapy)', 'am'],
];
export const GUIDE_SKIN_PROFILE = { type: 'sensitive', concerns: ['redness'], avoid: 'fragrance, retinal, salicylic acid' };

// ── Daily habits the guide asks for (sections 4 and 12) ──────────────────────
export const GUIDE_HABITS = [
  { name: 'Weigh in (morning, before food)', icon: '⚖️' },
  { name: "Log last night's sleep (1 minute)", icon: '😴' },
  { name: 'Interdental clean (floss or brush)', icon: '🦷' },
  { name: 'Brush your tongue gently', icon: '🪥' },
].map(h => ({ ...h, frequency: 'daily', streak: 0, lastCompleted: '', history: [], best: 0, source: GUIDE_ID }));

// ── Reference note ───────────────────────────────────────────────────────────
export const GUIDE_NOTE = {
  title: `Guide: ${GUIDE_TITLE}`,
  body: [
    'Source: Complete Appearance Fitness and Skin Guide, prepared 25 September 2026. Copied from the guide; it is an appearance plan, not medical advice.',
    '',
    '## Targets',
    '- Trial intake about 2,300 kcal for 3 weeks (not a measured maintenance). Protein 145-160 g, fat 65-75 g, carbs about 245-265 g, fibre 30-40 g.',
    '- Calories: if weight and waist both rise for 3 weeks, take off 100-150 kcal; if strength and weight fall quickly, add 100-150.',
    '- Steps: find your real 7-day average, then add about 1,000 a day every 1-2 weeks towards 8-10k.',
    '- Sodium: about 2,000 mg a day is a reference, not a race to the bottom.',
    '',
    '## Tracking',
    '- Weight daily, 7 mornings a week, after the toilet and before food. Compare the 7-day mean only.',
    '- Waist weekly at the navel, relaxed after an exhale, two readings averaged. If the waist trend is flat for 3 weeks with good compliance, cut 100-150 kcal or add about 1,000 steps a day.',
    '- Photos monthly: front, side, back, same room, light, distance (1.5-2 m), no wide-angle close selfies.',
    '- Training log every session: load, reps, sets, RIR, any pain or popping.',
    '- Skin weekly: redness 0-10. Remove the newest active if it burns, swells or flares.',
    '- Sleep: 1 minute a day (bed, wake, rested 1-5, caffeine).',
    '',
    '## Training rules',
    '- Weeks 1-2: 3 full-body days, 2 sets, 3-4 RIR. Weeks 3-12: five-day Upper/Lower/Upper/Lower/Upper split. Four-day fallback: Upper A, Lower A, Upper B, Lower B.',
    '- Add reps before load. When every work set hits the top of the range twice, add the smallest weight.',
    '- After the re-entry block use 1-3 RIR on compounds. Rest 2-3 min on compounds, 60-120 s on raises and curls.',
    '- Stalled 2-3 sessions: check sleep, food, technique and rest first. Deload (halve sets, 3-4 RIR) if performance and recovery fall.',
    '- Right shoulder: no heavy vertical pressing. Painful popping, instability, weakness, numbness or pain after exercise needs assessment.',
    '- Cardio: 2 easy Zone 2 sessions of 25-35 min from week 3. StairMaster 10-15 min after two of the three sessions in weeks 1-2, 15-20 min after upper days in weeks 3-6, 20-25 min in weeks 7-12.',
    '',
    '## Skin',
    '- First 2 weeks: cleanser as needed, moisturiser, verified SPF 50+. No new active.',
    '- Weeks 3-4, if calm: azelaic acid 10% on 2 non-consecutive nights a week, on fully dry skin, then moisturiser. Weeks 5-6: 3 nights or alternate nights. Weeks 7-8: hold; the eye retinal only if stable, once a week around the orbital bone.',
    '- Never on the same night: azelaic acid with retinal, exfoliating acids, benzoyl peroxide or Effaclar Duo+M. Not on broken skin or straight after shaving.',
    '- Leave out Effaclar Duo+M unless a clinician recommends it. Niacinamide is optional; do not start it with azelaic acid.',
    '- Sun: sun protection when the UV Index is 3 or above; reapply every 2 hours outdoors. A tan is UV injury.',
    '',
    '## Hair, shaving, oral',
    '- Medium textured fringe / mod cut, low taper, weight removed internally. Barber every 5-8 weeks. Wash every 3-4 days; blot dry; pea-sized BASED wax.',
    '- Pluck only central monobrow hairs weekly. Fragrance-free shaving gel, patch test first; trim rather than close-shave if bumps appear.',
    '- Brush twice a day, add interdental cleaning daily, brush the tongue gently once a day.',
    '',
    '## See a GP or dentist',
    '- Constant white tongue coating that does not scrape off (non-urgent; earlier for pain, bleeding, ulcers, red or smooth patches, a lump or trouble swallowing).',
    '- Waking unrefreshed after 7-9 hours; bring sleep timing, mouth taping, nasal strips, vaping, caffeine, snoring or gasping, morning headaches, blocked nose, dry mouth, libido changes, medication and supplements.',
    '- Cheek redness never formally diagnosed as rosacea.',
    '- Do not add vitamin D, iron, B12 or magnesium blindly; ask what tests fit your history.',
    '',
    '## Skip',
    '- Pre-workout, fat burners and "test boosters". Espresso in the morning is enough.',
  ].join('\n'),
};

// ── What is new ──────────────────────────────────────────────────────────────

/**
 * What importing would add, given what you already have. Nothing is written here.
 * Returns { exercises, programs, meals, supplements, skinSteps, skinProfile, note, kept, problems }.
 *  - exercises: new library entries only (your existing ones are reused by name)
 *  - programs: complete rows for the `programs` collection, with exercise ids resolved
 *  - kept: what was left alone because you already have it, as plain phrases
 *  - problems: guide exercises that are not in the exercise database (nothing is guessed)
 */
export function buildGuideImport({ library = [], programs = [], savedMeals = [], supplements = [], skinSteps = [], skinProfile = null, notes = [], habits = [] } = {}) {
  const kept = [];
  const problems = [];

  const byName = new Map(library.map(e => [lc(e.name), e]));
  const wanted = [];
  for (const name of guideExerciseNames()) {
    if (byName.has(lc(name))) continue;
    const db = findExercise(name);
    if (!db) { problems.push(`"${name}" is not in the exercise database`); continue; }
    wanted.push(toLibraryEntry(db));
  }
  const exercises = freshEntries(wanted, library);
  const idByName = new Map(library.map(e => [lc(e.name), e.id]));
  for (const e of exercises) idByName.set(lc(e.name), e.id);
  const reused = guideExerciseNames().filter(n => byName.has(lc(n))).length;
  if (reused) kept.push(`${reused} exercises already in your library are reused as they are`);

  const have = new Set(programs.map(p => lc(p.name)));
  const newPrograms = [];
  GUIDE_PROGRAMS.forEach((p, i) => {
    if (have.has(lc(p.name))) { kept.push(`Program "${p.name}" already exists`); return; }
    const days = {};
    for (const key of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
      const d = p.days[key];
      if (!d) { days[key] = { splitType: 'rest', label: 'Rest' }; continue; }
      const [label, rows] = d;
      const usable = rows.filter(([n]) => idByName.has(lc(n)));
      days[key] = {
        splitType: 'custom', label,
        exerciseIds: usable.map(([n]) => idByName.get(lc(n))),
        targets: Object.fromEntries(usable.map(([n, sets, repsMin, repsMax]) => [idByName.get(lc(n)), { sets, repsMin, repsMax }])),
      };
    }
    // The guide starts with the re-entry block, so that is the one made active.
    newPrograms.push({ name: p.name, isActive: i === 0, days, pinnedExercises: {}, note: p.note, source: GUIDE_ID });
  });

  const haveMeal = new Set(savedMeals.map(m => lc(m.name)));
  const meals = GUIDE_MEALS.filter(m => { if (haveMeal.has(lc(m.name))) { kept.push(`Meal "${m.name}" already saved`); return false; } return true; });

  const haveSupp = new Set(supplements.map(s => lc(s.name)));
  const supps = GUIDE_SUPPLEMENTS.filter(s => { if (haveSupp.has(lc(s.name))) { kept.push(`Supplement "${s.name}" already there`); return false; } return true; });

  const haveHabit = new Set(habits.map(h => lc(h.name)));
  const newHabits = GUIDE_HABITS.filter(h => { if (haveHabit.has(lc(h.name))) { kept.push(`Habit "${h.name}" already there`); return false; } return true; });

  const haveStep = new Set(skinSteps.map(s => lc(s.name)));
  const steps = GUIDE_SKIN.filter(([n]) => { if (haveStep.has(lc(n))) { kept.push(`Skin step "${n}" already there`); return false; } return true; }).map(([n, when]) => newStep(n, when));

  const hasProfile = skinProfile && (skinProfile.type || (skinProfile.concerns || []).length || skinProfile.avoid);
  if (hasProfile) kept.push('Your skin profile is left as it is');

  const note = notes.some(n => lc(n.title) === lc(GUIDE_NOTE.title)) ? null : GUIDE_NOTE;
  if (!note) kept.push('The guide reference note already exists');

  return { exercises, programs: newPrograms, meals, supplements: supps, skinSteps: steps, habits: newHabits, skinProfile: hasProfile ? null : GUIDE_SKIN_PROFILE, note, kept, problems };
}

/** One-line counts for the review panel. */
export function summarise(plan) {
  const out = [];
  if (plan.exercises.length) out.push(`${plan.exercises.length} new exercises`);
  if (plan.programs.length) out.push(`${plan.programs.length} training program${plan.programs.length === 1 ? '' : 's'}`);
  if (plan.meals.length) out.push(`${plan.meals.length} saved meals`);
  if (plan.supplements.length) out.push(`${plan.supplements.length} supplements`);
  if (plan.skinSteps.length) out.push(`${plan.skinSteps.length} skin steps`);
  if (plan.habits?.length) out.push(`${plan.habits.length} daily habits`);
  if (plan.note) out.push('1 reference note');
  return out;
}

export const isEmpty = (plan) => !summarise(plan).length && !plan.skinProfile;
