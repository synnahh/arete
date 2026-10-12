// intake.js — the coach's first questions, and the plan they produce. Pure.
//
// The coach asks what it needs to set you up: your goal and pace, your body, how you
// train and what with, and (for the Look side) your skin. From the answers it works
// out maintenance calories (Mifflin-St Jeor times an activity factor), the goal and
// daily targets, which training split fits your days, and a starting skin profile.
// Nothing here is a fixed demo: every number comes from your answers, and anything it
// cannot work out is reported, not guessed.

import { makeGoal, GOAL_TEMPLATES, PACES, TEMPLATE_IDS, CUSTOM_PRESETS, CUSTOM_LIMITS } from './goals.js';
import { TEMPLATES } from './splits.js';

export const ACTIVITY = {
  not:      { label: 'Not active',        factor: 1.2,   hint: 'Desk day, little exercise, under 2,000 steps' },
  light:    { label: 'Lightly active',    factor: 1.375, hint: '1-2 workouts a week, 2,000-4,000 steps a day' },
  moderate: { label: 'Moderately active', factor: 1.55,  hint: '3-4 workouts a week, 4,000-7,000 steps a day' },
  very:     { label: 'Very active',       factor: 1.725, hint: '5+ workouts a week or a physical job, 7,000+ steps' },
};

export const EXPERIENCE = {
  beginner:     { label: 'Beginner',     hint: 'Under 1 year of lifting' },
  intermediate: { label: 'Intermediate', hint: '1 to 2 years' },
  advanced:     { label: 'Advanced',     hint: '2+ years' },
};

// preset = the equipment set in domain/exercisePick.js; gym = the Train gym toggle.
export const EQUIPMENT_CHOICES = {
  body:   { label: 'Bodyweight only',  hint: 'No equipment needed', preset: 'body', gym: 'home' },
  little: { label: 'Little equipment', hint: 'Dumbbells, bands, a bar', preset: 'db',   gym: 'home' },
  home:   { label: 'Home gym',         hint: 'Rack, barbell, plates', preset: 'home', gym: 'home' },
  gym:    { label: 'Commercial gym',   hint: 'Full gym access',       preset: 'gym',  gym: 'commercial' },
};

export const SKIN_TYPES = ['oily', 'dry', 'combination', 'normal', 'sensitive'];

// ── Body maths ────────────────────────────────────────────────────────────────

/** Whole years between a birth date and today ('YYYY-MM-DD'), or null. */
export function ageFrom(birthDate, today) {
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate || ''));
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(today || ''));
  if (!b || !t) return null;
  let age = +t[1] - +b[1];
  if (+t[2] < +b[2] || (+t[2] === +b[2] && +t[3] < +b[3])) age -= 1;
  return age >= 10 && age <= 100 ? age : null;
}

/** Mifflin-St Jeor resting energy, kcal a day. */
export function bmr({ weightKg, heightCm, age, sex }) {
  if (!(weightKg > 0) || !(heightCm > 0) || !(age > 0)) return null;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'female' ? -161 : 5);
}

/** Maintenance kcal from the formula and an activity level, to the nearest 10. */
export function maintenanceFrom({ weightKg, heightCm, age, sex }, activity) {
  const r = bmr({ weightKg, heightCm, age, sex });
  const f = ACTIVITY[activity]?.factor;
  return r && f ? Math.round((r * f) / 10) * 10 : null;
}

// ── Training week ─────────────────────────────────────────────────────────────

/** Which template fits the days you can train. 5 days is a body-part split for experienced lifters. */
export function splitFor(days, experience = 'beginner') {
  const n = Math.round(Number(days));
  if (!(n >= 2 && n <= 6)) return null;
  if (n <= 3) return 'fullBody';
  if (n === 4) return 'upperLower';
  if (n === 5) return experience === 'beginner' ? 'ppl' : 'bro';
  return 'ppl';
}

/** A week with at most n training days: extras become rest days, the kept ones spread across the week. */
export function fitDays(days, n) {
  const keys = Object.keys(days).filter(k => days[k] && days[k].splitType !== 'rest');
  if (keys.length <= n) return days;
  const keep = new Set(Array.from({ length: n }, (_, i) => keys[Math.round((i * (keys.length - 1)) / Math.max(1, n - 1))]));
  return Object.fromEntries(Object.entries(days).map(([k, d]) => [k, keep.has(k) || d.splitType === 'rest' ? d : { splitType: 'rest', label: 'Rest' }]));
}

// ── Validation and the plan ───────────────────────────────────────────────────

const REQUIRED = [
  ['goal', 'a goal'], ['birthDate', 'your birth date'], ['sex', 'your sex'], ['heightCm', 'your height'], ['weightKg', 'your current weight'],
  ['activity', 'your activity level'], ['experience', 'your experience'], ['days', 'how many days you can train'], ['equipment', 'what you train with'],
];

/** The questions still unanswered that the plan needs, as plain phrases. */
export function missingAnswers(a = {}) {
  const out = REQUIRED.filter(([k]) => a[k] == null || a[k] === '' || Number.isNaN(a[k])).map(([, label]) => label);
  if (a.goal === 'custom' && (a.customDeltaPct === '' || a.customDeltaPct == null || !Number.isFinite(Number(a.customDeltaPct)))) out.push('your calorie target for the custom goal');
  return out;
}

/** The closest template for a custom goal's direction: it supplies the label, the numbers are yours. */
export const baseTemplateFor = (deltaPct) => (deltaPct < -2 ? 'cut' : deltaPct > 2 ? 'bulk' : 'recomp');

/**
 * The whole plan from the answers, or { missing } when something it needs is absent.
 * { goal, maintenance, split, equipment, skinProfile, profile, sleepNeedHours, notes }
 */
export function planFromAnswers(a = {}, today) {
  const missing = missingAnswers(a);
  if (missing.length) return { missing };
  const isCustom = a.goal === 'custom';
  if (!isCustom && !TEMPLATE_IDS.includes(a.goal)) return { missing: ['a goal'] };
  const age = ageFrom(a.birthDate, today);
  if (age == null) return { missing: ['a valid birth date'] };

  const weightKg = Number(a.weightKg);
  const maintenanceKcal = maintenanceFrom({ weightKg, heightCm: Number(a.heightCm), age, sex: a.sex }, a.activity);
  if (!maintenanceKcal) return { missing: ['your height and weight'] };

  const deltaPct = Number(a.customDeltaPct);
  const goal = makeGoal({
    template: isCustom ? baseTemplateFor(deltaPct) : a.goal, weightKg, maintenanceKcal, maintenanceSource: 'formula', startedOn: today,
    targetWeightKg: Number(a.targetWeightKg) || null, pace: isCustom || a.goal === 'recomp' ? 'normal' : (a.pace || 'normal'),
    customText: isCustom ? String(a.customText || '') : '',
    custom: isCustom ? { deltaPct, proteinPerKg: Number(a.customProtein) || 2.2, fatPerKg: Number(a.customFat) || 0.9 } : null,
  });
  if (!goal) return { missing: ['a goal'] };

  const templateId = TEMPLATES[a.splitTemplate] && a.splitTemplate !== 'blank' ? a.splitTemplate : splitFor(a.days, a.experience);
  const eq = EQUIPMENT_CHOICES[a.equipment];
  const notes = [];
  const target = Number(a.targetWeightKg);
  if (target > 0 && a.goal === 'cut' && target >= weightKg) notes.push('Your goal weight is not below your current weight, so a cut has nothing to aim at. Check it.');
  if (target > 0 && a.goal === 'bulk' && target <= weightKg) notes.push('Your goal weight is not above your current weight, so a bulk has nothing to aim at. Check it.');
  if (isCustom) {
    const [lo, hi] = CUSTOM_LIMITS.deltaPct;
    if (deltaPct < lo || deltaPct > hi) notes.push(`A change of ${deltaPct}% is outside what the app allows (${lo}% to +${hi}%), so it was held at the limit.`);
    if (deltaPct < -20) notes.push('A deficit this big slows muscle gain and is hard to hold. A smaller one is usually faster for muscle.');
    if (deltaPct < 0 && (Number(a.customProtein) || 2.2) < 1.8) notes.push('In a deficit, protein under about 1.8 g per kg makes it hard to keep or build muscle.');
  }
  if (goal.targets.kcal <= 1300) notes.push('Targets are held at the 1,300 kcal floor. A slower pace is safer.');
  if (String(a.limitations || '').trim()) notes.push(`Limitations noted: ${String(a.limitations).trim().replace(/[.s]+$/, '')}. Pick exercises that work around them.`);

  return {
    goal, maintenance: { kcal: maintenanceKcal, age, source: 'formula' },
    split: { templateId, label: TEMPLATES[templateId]?.label, days: Math.round(Number(a.days)) },
    equipment: { id: a.equipment, ...eq },
    skinProfile: { type: a.skinType || null, concerns: Array.isArray(a.skinConcerns) ? a.skinConcerns : [], avoid: String(a.skinAvoid || '').trim() },
    profile: { birthDate: a.birthDate, sex: a.sex, heightCm: Number(a.heightCm) },
    sleepNeedHours: Number(a.sleepHours) >= 5 && Number(a.sleepHours) <= 11 ? Number(a.sleepHours) : null,
    notes,
  };
}

export { GOAL_TEMPLATES, PACES };
