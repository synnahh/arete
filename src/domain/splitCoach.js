// splitCoach.js — checks a training program against every muscle, fills the gaps, and swaps
// exercises. Pure. The weekly targets for the big muscles come from Rob's 25 Sep guide
// (section 9, "Weekly muscle coverage"); forearms, traps and abs are not in the guide's
// table, so they carry a modest target of Arete's own, marked "added". Additions are never
// made silently: they are suggestions you tick.
//
// Counting: a set counts fully for the exercise's main muscle (direct) and half for each
// helper muscle (indirect). A set count comes from the day's own target, else 3.

import { EXERCISE_DB, findExercise, toLibraryEntry } from './exerciseDb.js';
import { musclesForExercise } from './muscles.js';
import { WEEK, isRest, dayExercises, withDayTargets, materialize, setDayTarget } from './splits.js';

export const GROUPS = [
  ['chest', 'Chest'], ['back', 'Back and lats'], ['shoulders', 'Shoulders'], ['traps', 'Traps'],
  ['biceps', 'Biceps'], ['triceps', 'Triceps'], ['forearms', 'Forearms'], ['abs', 'Abs'],
  ['quads', 'Quads'], ['hamstrings', 'Hamstrings'], ['glutes', 'Glutes'], ['calves', 'Calves'],
].map(([id, label]) => ({ id, label }));

// Weekly sets wanted (low end), and where the number comes from.
export const TARGETS = {
  chest: { min: 12, from: 'guide' }, back: { min: 17, from: 'guide' }, shoulders: { min: 17, from: 'guide' },
  quads: { min: 10, from: 'guide' }, hamstrings: { min: 8, from: 'guide' }, glutes: { min: 8, from: 'guide' },
  biceps: { min: 4, from: 'guide' }, triceps: { min: 4, from: 'guide' }, calves: { min: 6, from: 'guide' },
  traps: { min: 4, from: 'added' }, forearms: { min: 4, from: 'added' }, abs: { min: 4, from: 'added' },
};

// Never suggested: heavy vertical or behind-the-neck pressing, upright rows (your right shoulder).
const SHOULDER_RISK = /overhead press|push press|upright row|arnold|handstand|pike|behind/i;

const mainAndHelpers = (ex) => {
  const db = findExercise(ex.name);
  if (db) return { main: db.muscle, helpers: db.helpers };
  const m = musclesForExercise(ex);
  return { main: m[0] ?? null, helpers: m.slice(1) };
};

/** Weekly sets per muscle group: { [id]: { direct, indirect } }. */
export function weeklySets(program, library = []) {
  const out = Object.fromEntries(GROUPS.map(g => [g.id, { direct: 0, indirect: 0 }]));
  for (const key of WEEK) {
    const day = program?.days?.[key];
    if (isRest(day)) continue;
    for (const ex of withDayTargets(dayExercises(day, library), day)) {
      const n = ex.plannedSets ?? 3;
      const { main, helpers } = mainAndHelpers(ex);
      if (main && out[main]) out[main].direct += n;
      for (const h of helpers || []) if (out[h]) out[h].indirect += n / 2;
    }
  }
  return out;
}

/** One row per muscle group: counts, target and a status of none / low / ok. */
export function coverage(program, library = []) {
  const sets = weeklySets(program, library);
  return GROUPS.map(g => {
    const { direct, indirect } = sets[g.id];
    const total = direct + indirect;
    const t = TARGETS[g.id];
    const status = total === 0 ? 'none' : total < t.min ? 'low' : 'ok';
    return { id: g.id, label: g.label, direct: Math.round(direct * 10) / 10, indirect: Math.round(indirect * 10) / 10, total: Math.round(total * 10) / 10, target: t.min, from: t.from, status };
  });
}

// ── Gap fills ────────────────────────────────────────────────────────────────
// Chosen by hand, not at random: safe for the shoulder, a full gym, and few enough to read.
const FILLS = {
  forearms: [['Wrist Curl', 2, 12, 20, 'upper'], ['Hammer Curl', 2, 8, 12, 'upper']],
  traps: [['DB Shrug', 2, 10, 15, 'upper']],
  abs: [['Cable Crunch', 2, 10, 15, 'lower'], ['Hanging Leg Raise', 2, 8, 15, 'lower']],
  calves: [['Seated Calf Raise', 2, 10, 20, 'lower']],
  glutes: [['Hip Thrust', 2, 8, 12, 'lower']],
  hamstrings: [['Lying Leg Curl', 2, 10, 15, 'lower']],
  quads: [['Leg Extension', 2, 12, 20, 'lower']],
  biceps: [['Incline DB Curl', 2, 8, 12, 'upper']],
  triceps: [['Overhead Triceps Extension', 2, 10, 15, 'upper']],
  chest: [['Pec Deck', 2, 10, 15, 'upper']],
  back: [['One-arm DB Row', 2, 10, 15, 'upper']],
  shoulders: [['Lateral Raise', 2, 12, 20, 'upper']],
};

const isUpper = (d) => /upper|push|pull|chest|back|shoulder|arm/i.test(d?.label || '');
const isLower = (d) => /lower|leg|glute|quad|ham/i.test(d?.label || '');

/** The day a fill should go on: the matching kind of day with the fewest exercises (ties: earliest). */
function dayFor(program, library, kind, extra = {}) {
  let best = null;
  for (const key of WEEK) {
    const d = program?.days?.[key];
    if (isRest(d)) continue;
    const ok = kind === 'lower' ? isLower(d) : isUpper(d);
    if (!ok) continue;
    const n = dayExercises(d, library).length + (extra[key] || 0);
    if (!best || n < best.n) best = { key, n };
  }
  return best?.key ?? null;
}

/**
 * Suggested additions for every muscle that is none or low. Each: { id, group, label, name, sets,
 * repsMin, repsMax, dayKey, dayLabel, already }. Exercises already on that day are left out, as are
 * exercises that would stress the shoulder.
 */
export function suggestFills(program, library = []) {
  const out = [];
  const extra = {};   // fills already placed in this pass, so they spread across days instead of piling on one
  for (const row of coverage(program, library)) {
    if (row.status === 'ok') continue;
    for (const [name, sets, repsMin, repsMax, kind] of FILLS[row.id] || []) {
      if (SHOULDER_RISK.test(name) || !findExercise(name)) continue;
      const dayKey = dayFor(program, library, kind, extra);
      if (!dayKey) continue;
      const day = program.days[dayKey];
      if (dayExercises(day, library).some(e => e.name.toLowerCase() === name.toLowerCase())) continue;
      extra[dayKey] = (extra[dayKey] || 0) + 1;
      out.push({ id: `${row.id}:${name}`, group: row.id, label: row.label, name, sets, repsMin, repsMax, dayKey, dayLabel: day.label || dayKey });
    }
  }
  return out;
}

const idFor = (name, library) => {
  const mine = library.find(e => String(e.name).trim().toLowerCase() === name.toLowerCase());
  return mine ? { id: mine.id, entry: null } : (() => { const db = findExercise(name); return db ? { id: db.id, entry: toLibraryEntry(db) } : null; })();
};

/**
 * Apply the chosen fills. Returns { days, newEntries }: the program's days with the exercises added
 * (with their own sets and reps) and any library entries that did not exist yet.
 */
export function applyFills(program, library, fills) {
  const days = { ...(program?.days || {}) };
  const newEntries = [];
  for (const f of fills) {
    const found = idFor(f.name, [...library, ...newEntries]);
    if (!found || !days[f.dayKey]) continue;
    if (found.entry && !newEntries.some(e => e.id === found.entry.id)) newEntries.push(found.entry);
    let day = materialize(days[f.dayKey], [...library, ...newEntries]);
    if (!day.exerciseIds.includes(found.id)) day = { ...day, exerciseIds: [...day.exerciseIds, found.id] };
    day = setDayTarget(day, found.id, { sets: f.sets, repsMin: f.repsMin, repsMax: f.repsMax });
    days[f.dayKey] = day;
  }
  return { days, newEntries };
}

// ── Swaps ────────────────────────────────────────────────────────────────────
// Where the guide itself offers "X or Y" for a slot.
export const GUIDE_SWAPS = {
  'Leg Press': ['Goblet Squat'], 'Goblet Squat': ['Leg Press'],
  'Machine Row': ['Chest-Supported Row'], 'Chest-Supported Row': ['Machine Row'],
  'Close-Grip Lat Pulldown': ['Assisted Pull-ups'], 'Assisted Pull-ups': ['Close-Grip Lat Pulldown'],
  'Hack Squat': ['Split Squat', 'Leg Press'], 'Split Squat': ['Hack Squat'],
  'Reverse Pec Deck': ['Rear Delt Fly'], 'Rear Delt Fly': ['Reverse Pec Deck'],
  'Triceps Press Machine': ['Skull Crushers'], 'Skull Crushers': ['Triceps Press Machine'],
  'Overhead Triceps Extension': ['Triceps Press Machine'],
  'Hip Thrust': ['Back Extension'], 'Back Extension': ['Hip Thrust'],
  'Hanging Knee Raise': ['Reverse Crunch'], 'Reverse Crunch': ['Hanging Knee Raise'],
  'Preacher Curl': ['DB Curl'], 'DB Curl': ['Preacher Curl'],
  'Pec Deck': ['Chest Press Machine'], 'Chest Press Machine': ['Pec Deck'],
  'Low-Incline Neutral-Grip DB Press': ['Chest Press Machine'],
};

/**
 * Options to swap `ex` for: { guide: [name], sameMuscle: [name] }. Guide options come first;
 * "same muscle" lists other exercises with the same main muscle, from your library then the
 * database, without anything already on the day and without shoulder-risk moves.
 */
export function swapOptions(ex, day, library = []) {
  const here = new Set(dayExercises(day, library).map(e => e.name.toLowerCase()));
  const ok = (n) => !here.has(n.toLowerCase()) && n.toLowerCase() !== ex.name.toLowerCase() && !SHOULDER_RISK.test(n);
  const guide = (GUIDE_SWAPS[ex.name] || []).filter(ok);
  const main = mainAndHelpers(ex).main;
  const pool = [...library.map(e => e.name), ...EXERCISE_DB.map(e => e.name)];
  const me = findExercise(ex.name);
  const heavy = /deadlift|rack pull|good morning/i;             // a heavy hinge is not a like-for-like swap for a row or curl
  const rank = (n) => { const d = findExercise(n); return (d?.kind === me?.kind ? 0 : 2) + (d?.equipment === me?.equipment ? 0 : 1); };
  const sameMuscle = [...new Set(pool)]
    .filter(n => ok(n) && !guide.includes(n) && findExercise(n)?.muscle === main && (heavy.test(ex.name) || !heavy.test(n)))
    .sort((x, y) => rank(x) - rank(y))
    .slice(0, 12);
  return { guide, sameMuscle };
}

/**
 * Replace `oldId` with the exercise named `newName` in place, keeping its position and its sets and
 * reps. Returns { day, entry } where entry is a new library entry if the exercise was not in yours.
 */
export function swapInDay(day, oldId, newName, library = []) {
  const found = idFor(newName, library);
  if (!found) return null;
  const base = materialize(day, library);
  if (!base.exerciseIds.includes(oldId) || base.exerciseIds.includes(found.id)) return null;
  const targets = { ...(base.targets || {}) };
  if (targets[oldId]) { targets[found.id] = targets[oldId]; delete targets[oldId]; }
  const out = { ...base, exerciseIds: base.exerciseIds.map(i => (i === oldId ? found.id : i)) };
  if (Object.keys(targets).length) out.targets = targets; else delete out.targets;
  return { day: out, entry: found.entry };
}

/** The muscle groups a day hits (main muscles, in the order of its exercises). */
export function dayMuscles(day, library = []) {
  const seen = [];
  for (const ex of dayExercises(day, library)) {
    const { main } = mainAndHelpers(ex);
    const g = GROUPS.find(x => x.id === main);
    if (g && !seen.includes(g.label)) seen.push(g.label);
  }
  return seen;
}
