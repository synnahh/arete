// splits.js — what a training week is made of, and how it depends on your data.
// Pure. Programs live in the `programs` collection:
//   { id, name, isActive, days: { mon: { splitType, label, exerciseIds? }, ... } }
//
// A day owns its exercises through `exerciseIds` (ids from your Exercise Library, in
// the order you do them). Older programs have no exerciseIds: their push / pull / legs
// days read the library by that tag, exactly as before, until you edit the day.
// A day is a rest day when splitType is 'rest'. Nothing here is a fixed template:
// starters are built from the exercises you actually have.

import { musclesForExercise, MUSCLE_IDS, MUSCLE_LABEL } from './muscles.js';
import { findExercise } from './exerciseDb.js';

export const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEK_LABEL = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const LEGACY = ['push', 'pull', 'legs'];

export const isRest = (day) => !day || day.splitType === 'rest';

/** The library exercises for a day, in order. Missing ids are skipped (an exercise you deleted). */
export function dayExercises(day, library = []) {
  if (isRest(day)) return [];
  if (Array.isArray(day.exerciseIds)) {
    const byId = new Map(library.map(e => [e.id, e]));
    return day.exerciseIds.map(id => byId.get(id)).filter(Boolean);
  }
  return LEGACY.includes(day.splitType) ? library.filter(e => e.day === day.splitType) : [];
}

/**
 * The exercises of a day with the day's own targets laid over them. A program day may carry
 * `targets: { [exerciseId]: { sets, repsMin, repsMax } }` (the same lift can be 3 x 8-12 on
 * one day and 2 x 10-15 on another). Days without it come back unchanged.
 */
export function withDayTargets(exercises, day) {
  const t = day?.targets;
  if (!t || typeof t !== 'object') return exercises;
  return exercises.map(e => {
    const x = t[e.id];
    if (!x) return e;
    const out = { ...e };
    if (Number(x.repsMin) > 0) out.repsMin = Number(x.repsMin);
    if (Number(x.repsMax) > 0) out.repsMax = Number(x.repsMax);
    if (Number(x.sets) > 0) out.plannedSets = Math.round(Number(x.sets));
    return out;
  });
}

/** One exercise's targets on a day: { sets, repsMin, repsMax } with only the fields you set. */
export function dayTarget(day, id) { return (day?.targets && day.targets[id]) || {}; }

/**
 * A day with one exercise's sets and rep range changed. A blank or invalid value clears that
 * field; when nothing is left for an exercise its entry is removed. Sets 1-8, reps 1-100, min <= max.
 */
export function setDayTarget(day, id, patch) {
  const cur = { ...dayTarget(day, id) };
  const num = (v, lo, hi) => { const n = Math.round(Number(v)); return v !== '' && v != null && n >= lo && n <= hi ? n : null; };
  if ('sets' in patch) { const n = num(patch.sets, 1, 8); if (n == null) delete cur.sets; else cur.sets = n; }
  if ('repsMin' in patch) { const n = num(patch.repsMin, 1, 100); if (n == null) delete cur.repsMin; else cur.repsMin = n; }
  if ('repsMax' in patch) { const n = num(patch.repsMax, 1, 100); if (n == null) delete cur.repsMax; else cur.repsMax = n; }
  if (cur.repsMin && cur.repsMax && cur.repsMin > cur.repsMax) { if ('repsMin' in patch) cur.repsMax = cur.repsMin; else cur.repsMin = cur.repsMax; }
  const targets = { ...(day?.targets || {}) };
  if (Object.keys(cur).length) targets[id] = cur; else delete targets[id];
  const out = { ...day, targets };
  if (!Object.keys(targets).length) delete out.targets;
  return out;
}

const clone = (d) => JSON.parse(JSON.stringify(d));
const REST = { splitType: 'rest', label: 'Rest' };

/** Move a day to another weekday. The two days swap places, so nothing is lost (a rest day just moves the other way). */
export function moveDay(days, from, to) {
  if (!WEEK.includes(from) || !WEEK.includes(to) || from === to) return days;
  const out = { ...days };
  out[to] = clone(days[from] ?? REST);
  out[from] = clone(days[to] ?? REST);
  return out;
}

/** Copy a day onto another weekday, replacing whatever was there. */
export function copyDay(days, from, to) {
  if (!WEEK.includes(from) || !WEEK.includes(to) || from === to) return days;
  return { ...days, [to]: clone(days[from] ?? REST) };
}

/** How many days a week the program trains. */
export const trainingDays = (program) => WEEK.filter(k => !isRest(program?.days?.[k])).length;

/** A day with its exercise list written out, so it can be edited by id. */
export function materialize(day, library = []) {
  return { ...day, exerciseIds: dayExercises(day, library).map(e => e.id) };
}

export function setDayExercises(day, ids) { return { ...day, exerciseIds: [...new Set(ids)] }; }
export function addToDay(day, library, id) { return setDayExercises(materialize(day, library), [...materialize(day, library).exerciseIds, id]); }
export function removeFromDay(day, library, id) { return setDayExercises(materialize(day, library), materialize(day, library).exerciseIds.filter(x => x !== id)); }
export function moveInDay(day, library, id, delta) {
  const ids = [...materialize(day, library).exerciseIds];
  const i = ids.indexOf(id), j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return day.exerciseIds ? day : materialize(day, library);
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return setDayExercises(day, ids);
}

/** A day as the program stores it: renaming a rest day to a workout (or back) keeps the rest consistent. */
export function setDayKind(day, workout, label) {
  if (!workout) return { splitType: 'rest', label: 'Rest' };
  return { splitType: day?.splitType && day.splitType !== 'rest' ? day.splitType : 'custom', label: label || day?.label || 'Workout', exerciseIds: day?.exerciseIds || [] };
}

/** The week as a list, Monday first. */
export function weekPlan(program, library = []) {
  return WEEK.map(key => {
    const day = program?.days?.[key] ?? { splitType: 'rest', label: 'Rest' };
    return { key, label: day.label || (isRest(day) ? 'Rest' : 'Workout'), rest: isRest(day), exercises: withDayTargets(dayExercises(day, library), day) };
  });
}

// ── Volume: what the plan trains each week, and what you really did ────────────
const SETS_DEFAULT = 3;
export const SETS_BAND = { low: 10, high: 20 };      // working sets per muscle per week

/** Planned working sets per muscle per week. The first muscle an exercise trains counts fully, helpers half. */
export function plannedSets(program, library = [], setsPerExercise = SETS_DEFAULT) {
  const sets = Object.fromEntries(MUSCLE_IDS.map(m => [m, 0]));
  for (const { exercises } of weekPlan(program, library)) {
    for (const ex of exercises) {
      musclesForExercise(ex).forEach((m, i) => { if (m in sets) { const n = ex.plannedSets ?? setsPerExercise; sets[m] += i === 0 ? n : n / 2; } });
    }
  }
  return sets;
}

/** Sets actually logged in the last `days` days, per muscle (a log's sets array, or one set when absent). */
export function doneSets(logs = [], today, days = 7, musclesOf = musclesForExercise) {
  const out = Object.fromEntries(MUSCLE_IDS.map(m => [m, 0]));
  const t = Date.parse(`${today}T12:00:00`);
  for (const l of logs) {
    const d = Date.parse(`${l?.date}T12:00:00`);
    if (!Number.isFinite(d) || t - d < 0 || t - d >= days * 86400000) continue;
    const n = Array.isArray(l.sets) && l.sets.length ? l.sets.length : 1;
    musclesOf({ name: l.exerciseName, day: l.splitType || l.day }).forEach((m, i) => { if (m in out) out[m] += i === 0 ? n : n / 2; });
  }
  return out;
}

/** 'none' | 'low' | 'ok' | 'high' for a weekly set count. */
export function volumeStatus(n) {
  if (!(n > 0)) return 'none';
  if (n < SETS_BAND.low) return 'low';
  return n > SETS_BAND.high ? 'high' : 'ok';
}

/** Rows for the volume panel, most under-trained first. Muscles with no plan and no logs are left out. */
export function volumeRows(planned, done = {}) {
  return MUSCLE_IDS
    .map(m => ({ id: m, label: MUSCLE_LABEL[m], planned: Math.round(planned[m] * 10) / 10, done: Math.round((done[m] || 0) * 10) / 10, status: volumeStatus(planned[m]) }))
    .sort((a, b) => ({ none: 0, low: 1, ok: 2, high: 3 }[a.status] - { none: 0, low: 1, ok: 2, high: 3 }[b.status]));
}

// ── Starters, built from what you have ────────────────────────────────────────
// muscles: what each day should cover. The exercises come from YOUR library.
export const TEMPLATES = {
  blank: { label: 'Blank week', note: 'Every day is a rest day. You build it.', trainDays: 0, levels: ['beginner', 'intermediate', 'advanced'], days: {} },
  ppl: { label: 'Push / Pull / Legs', note: '6 days: push, pull, legs, twice.', trainDays: 6, levels: ['intermediate', 'advanced'], days: {
    mon: { label: 'Push', muscles: ['chest', 'shoulders', 'triceps'] },
    tue: { label: 'Pull', muscles: ['back', 'biceps', 'forearms'] },
    wed: { label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
    thu: { label: 'Push', muscles: ['chest', 'shoulders', 'triceps'] },
    fri: { label: 'Pull', muscles: ['back', 'biceps', 'forearms'] },
    sat: { label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  } },
  upperLower: { label: 'Upper / Lower', note: '4 days: upper and lower, twice.', trainDays: 4, levels: ['beginner', 'intermediate'], days: {
    mon: { label: 'Upper', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
    tue: { label: 'Lower', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
    thu: { label: 'Upper', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
    fri: { label: 'Lower', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  } },
  fullBody: { label: 'Full body', note: '3 days: everything each time.', trainDays: 3, levels: ['beginner', 'intermediate'], days: {
    mon: { label: 'Full body A', muscles: ['chest', 'back', 'quads', 'shoulders', 'hamstrings'] },
    wed: { label: 'Full body B', muscles: ['back', 'chest', 'glutes', 'shoulders', 'biceps', 'triceps'] },
    fri: { label: 'Full body C', muscles: ['quads', 'back', 'chest', 'hamstrings', 'calves'] },
  } },
  upperFrame: { label: 'Upper-priority 5 day', note: '5 days: upper, lower, upper, lower, upper. Upper body three times, legs twice.', trainDays: 5, levels: ['beginner', 'intermediate', 'advanced'], days: {
    mon: { label: 'Upper A', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
    tue: { label: 'Lower A', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
    thu: { label: 'Upper B', muscles: ['chest', 'shoulders', 'back', 'triceps'] },
    fri: { label: 'Lower B', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
    sat: { label: 'Upper C', muscles: ['back', 'shoulders', 'chest', 'biceps', 'triceps'] },
  } },
  bro: { label: 'Body-part split', note: '5 days: one area per day.', trainDays: 5, levels: ['intermediate', 'advanced'], days: {
    mon: { label: 'Chest', muscles: ['chest', 'triceps'] },
    tue: { label: 'Back', muscles: ['back', 'biceps'] },
    wed: { label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
    thu: { label: 'Shoulders', muscles: ['shoulders', 'forearms'] },
    fri: { label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
  } },
  fullBody2: { label: 'Full body (2 days)', note: '2 days: the whole body each time. The minimum that still works.', trainDays: 2, levels: ['beginner', 'intermediate'], days: {
    mon: { label: 'Full body A', muscles: ['quads', 'chest', 'back', 'shoulders', 'hamstrings'] },
    thu: { label: 'Full body B', muscles: ['glutes', 'back', 'chest', 'biceps', 'triceps'] },
  } },
  ulFull3: { label: 'Upper / Lower / Full', note: '3 days: upper, lower, then everything. A good fit for a busy week.', trainDays: 3, levels: ['beginner', 'intermediate'], days: {
    mon: { label: 'Upper', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
    wed: { label: 'Lower', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
    fri: { label: 'Full body', muscles: ['chest', 'back', 'quads', 'shoulders', 'hamstrings'] },
  } },
  ppl3: { label: 'Push / Pull / Legs (3 days)', note: '3 days: push, pull and legs once each.', trainDays: 3, levels: ['beginner', 'intermediate', 'advanced'], days: {
    mon: { label: 'Push', muscles: ['chest', 'shoulders', 'triceps'] },
    wed: { label: 'Pull', muscles: ['back', 'biceps', 'forearms'] },
    fri: { label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  } },
  strengthAB: { label: 'Strength A / B', note: '3 days: two alternating full-body sessions built on the big lifts.', trainDays: 3, levels: ['beginner', 'intermediate'], days: {
    mon: { label: 'Strength A', muscles: ['quads', 'chest', 'back', 'triceps'] },
    wed: { label: 'Strength B', muscles: ['hamstrings', 'shoulders', 'back', 'biceps'] },
    fri: { label: 'Strength A', muscles: ['quads', 'chest', 'back', 'triceps'] },
  } },
  fullBody4: { label: 'Full body (4 days)', note: '4 days: whole body each time, lighter sessions, more often.', trainDays: 4, levels: ['beginner', 'intermediate'], days: {
    mon: { label: 'Full body A', muscles: ['quads', 'chest', 'back', 'shoulders'] },
    tue: { label: 'Full body B', muscles: ['hamstrings', 'back', 'chest', 'biceps', 'triceps'] },
    thu: { label: 'Full body C', muscles: ['glutes', 'chest', 'back', 'shoulders', 'calves'] },
    fri: { label: 'Full body D', muscles: ['quads', 'back', 'chest', 'biceps', 'triceps'] },
  } },
  torsoLimbs: { label: 'Torso / Limbs', note: '4 days: chest, back and shoulders one day; arms and legs the next.', trainDays: 4, levels: ['intermediate', 'advanced'], days: {
    mon: { label: 'Torso', muscles: ['chest', 'back', 'shoulders'] },
    tue: { label: 'Limbs', muscles: ['quads', 'hamstrings', 'biceps', 'triceps', 'calves'] },
    thu: { label: 'Torso', muscles: ['back', 'chest', 'shoulders'] },
    fri: { label: 'Limbs', muscles: ['hamstrings', 'quads', 'triceps', 'biceps', 'calves'] },
  } },
  phul: { label: 'Power / Hypertrophy (PHUL)', note: '4 days: heavy upper and lower, then lighter higher-rep upper and lower.', trainDays: 4, levels: ['intermediate', 'advanced'], days: {
    mon: { label: 'Upper power', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
    tue: { label: 'Lower power', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
    thu: { label: 'Upper hypertrophy', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
    fri: { label: 'Lower hypertrophy', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  } },
  ppul: { label: 'Push / Pull / Legs / Upper / Lower', note: '5 days: PPL, then an upper and a lower day. Each muscle about twice a week.', trainDays: 5, levels: ['intermediate', 'advanced'], days: {
    mon: { label: 'Push', muscles: ['chest', 'shoulders', 'triceps'] },
    tue: { label: 'Pull', muscles: ['back', 'biceps', 'forearms'] },
    wed: { label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
    fri: { label: 'Upper', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
    sat: { label: 'Lower', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  } },
  arnold: { label: 'Arnold split', note: '6 days: chest and back, shoulders and arms, legs, twice. High volume for experienced lifters.', trainDays: 6, levels: ['advanced'], days: {
    mon: { label: 'Chest and back', muscles: ['chest', 'back'] },
    tue: { label: 'Shoulders and arms', muscles: ['shoulders', 'biceps', 'triceps'] },
    wed: { label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
    thu: { label: 'Chest and back', muscles: ['chest', 'back'] },
    fri: { label: 'Shoulders and arms', muscles: ['shoulders', 'biceps', 'triceps'] },
    sat: { label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  } },
};

/**
 * Template ids for a filter. Blank always shows; the rest must suit the experience
 * level and not need more training days than you have. Best fit (most days you can use) first.
 */
export function templatesFor({ experience = null, days = null } = {}) {
  const ids = Object.keys(TEMPLATES).filter(id => {
    const t = TEMPLATES[id];
    if (id === 'blank') return true;
    if (experience && !t.levels.includes(experience)) return false;
    if (days && t.trainDays > days) return false;
    return true;
  });
  return ids.sort((a, b) => (a === 'blank') - (b === 'blank') || TEMPLATES[b].trainDays - TEMPLATES[a].trainDays);
}

const primary = (ex) => musclesForExercise(ex)[0];
const isCompound = (ex) => (findExercise(ex.name)?.kind ?? 'compound') === 'compound';

/**
 * A week from a template, filled from the exercises in `library`. Returns
 * { days, missing } where missing lists the muscles the template wants that your
 * library has nothing for, so the screen can say what to add rather than pretend.
 */
export function buildFromTemplate(templateId, library = []) {
  const t = TEMPLATES[templateId] ?? TEMPLATES.blank;
  const days = {};
  const missing = new Set();
  for (const key of WEEK) {
    const spec = t.days[key];
    if (!spec) { days[key] = { splitType: 'rest', label: 'Rest' }; continue; }
    const ids = [];
    const each = spec.muscles.length <= 3 ? 2 : 1;
    for (const m of spec.muscles) {
      const pool = library.filter(e => primary(e) === m && !ids.includes(e.id)).sort((a, b) => Number(isCompound(b)) - Number(isCompound(a)));
      if (!pool.length) { missing.add(m); continue; }
      ids.push(...pool.slice(0, each).map(e => e.id));
    }
    days[key] = { splitType: 'custom', label: spec.label, exerciseIds: ids };
  }
  return { days, missing: [...missing].map(m => MUSCLE_LABEL[m] || m) };
}

/** Which week day is "today's session" for a program: today if it is a workout, else the next workout day, else null. */
export function sessionDayKey(program, todayKey) {
  if (!program?.days) return null;
  const order = [...WEEK.slice(WEEK.indexOf(todayKey)), ...WEEK.slice(0, WEEK.indexOf(todayKey))];
  return order.find(k => !isRest(program.days[k])) ?? null;
}
export const dayKeyFromDate = (d = new Date()) => WEEK[(d.getDay() + 6) % 7];

/** The distinct workout days of a program as session choices (a day repeated twice shows once, first day wins). */
export function sessionChoices(program, library = []) {
  const seen = new Set();
  const out = [];
  for (const k of WEEK) {
    const day = program?.days?.[k];
    if (isRest(day)) continue;
    const exs = dayExercises(day, library);
    const sig = `${day.label}|${exs.map(e => e.id).join(',')}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ key: k, label: day.label || 'Workout', count: exs.length });
  }
  return out;
}
