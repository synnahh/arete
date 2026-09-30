// exercisePick.js — choose exercises for a push / pull / legs day from the
// equipment you have and your goal. Pure. The result uses the Exercise Library's
// shape, so it can be added to the library and used by Train as it is.
//
// How a day is built (the usual coaching order): a heavy compound first, then a
// second compound or close variation, then isolation work for what is left, so
// every major muscle for that day is hit. Goal changes rep ranges and count:
// strength = fewer exercises, lower reps; muscle = moderate reps and more
// isolation; fat loss / maintain = keep the heavy compounds, moderate volume.
// A starting point to edit, not a prescription.

export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bar', 'bodyweight'];
export const EQUIPMENT_LABEL = { barbell: 'Barbell + rack', dumbbell: 'Dumbbells', machine: 'Machines', cable: 'Cables', bar: 'Pull-up bar', bodyweight: 'Bodyweight' };
export const PRESETS = {
  gym:  { label: 'Full gym', equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bar', 'bodyweight'] },
  home: { label: 'Home weights', equipment: ['barbell', 'dumbbell', 'bar', 'bodyweight'] },
  db:   { label: 'Dumbbells only', equipment: ['dumbbell', 'bodyweight'] },
  body: { label: 'Bodyweight', equipment: ['bodyweight', 'bar'] },
};

// kind: 'compound' | 'isolation'. muscle: what it mainly trains. needs: ANY ONE of these
// equipment tags is enough. start/inc are conservative kg for a novice; bw = bodyweight.
const CATALOGUE = [
  // Push
  { id: 'bp',  name: 'Bench Press',            day: 'push', muscle: 'chest',     kind: 'compound',  needs: ['barbell'],  start: 40, inc: 2.5, reps: [6, 8] },
  { id: 'dbb', name: 'DB Bench Press',         day: 'push', muscle: 'chest',     kind: 'compound',  needs: ['dumbbell'], start: 16, inc: 2,   reps: [8, 12] },
  { id: 'ohp', name: 'Overhead Press',         day: 'push', muscle: 'shoulders', kind: 'compound',  needs: ['barbell'],  start: 30, inc: 2.5, reps: [6, 8] },
  { id: 'dbp', name: 'DB Shoulder Press',      day: 'push', muscle: 'shoulders', kind: 'compound',  needs: ['dumbbell'], start: 12, inc: 2,   reps: [8, 12] },
  { id: 'cfl', name: 'Cable Fly',              day: 'push', muscle: 'chest',     kind: 'isolation', needs: ['cable'],    start: 10, inc: 2.5, reps: [10, 15] },
  { id: 'lat', name: 'Lateral Raise',          day: 'push', muscle: 'shoulders', kind: 'isolation', needs: ['dumbbell', 'cable'], start: 6, inc: 1, reps: [12, 20] },
  { id: 'tpd', name: 'Triceps Pushdown',       day: 'push', muscle: 'triceps',   kind: 'isolation', needs: ['cable'],    start: 20, inc: 2.5, reps: [10, 15] },
  { id: 'ote', name: 'Overhead Triceps Ext.',  day: 'push', muscle: 'triceps',   kind: 'isolation', needs: ['dumbbell'], start: 10, inc: 2,   reps: [10, 15] },
  { id: 'dip', name: 'Dips',                   day: 'push', muscle: 'chest',     kind: 'compound',  needs: ['bar'],      start: 0,  inc: 0,   reps: [6, 10], bw: true },
  { id: 'pup', name: 'Push-ups',               day: 'push', muscle: 'chest',     kind: 'compound',  needs: ['bodyweight'], start: 0, inc: 0,  reps: [10, 20], bw: true },
  { id: 'pkp', name: 'Pike Push-ups',          day: 'push', muscle: 'shoulders', kind: 'compound',  needs: ['bodyweight'], start: 0, inc: 0,  reps: [6, 12], bw: true },
  { id: 'bdp', name: 'Bench Dips',             day: 'push', muscle: 'triceps',   kind: 'isolation', needs: ['bodyweight'], start: 0, inc: 0,  reps: [10, 20], bw: true },
  // Pull
  { id: 'dl',  name: 'Deadlift',               day: 'pull', muscle: 'back',      kind: 'compound',  needs: ['barbell'],  start: 60, inc: 5,   reps: [4, 6] },
  { id: 'br',  name: 'Barbell Row',            day: 'pull', muscle: 'back',      kind: 'compound',  needs: ['barbell'],  start: 40, inc: 2.5, reps: [6, 8] },
  { id: 'dbr', name: 'One-arm DB Row',         day: 'pull', muscle: 'back',      kind: 'compound',  needs: ['dumbbell'], start: 16, inc: 2,   reps: [8, 12] },
  { id: 'pu',  name: 'Pull-ups',               day: 'pull', muscle: 'back',      kind: 'compound',  needs: ['bar'],      start: 0,  inc: 0,   reps: [5, 8], bw: true },
  { id: 'lr',  name: 'Lat Pulldown',           day: 'pull', muscle: 'back',      kind: 'compound',  needs: ['machine', 'cable'], start: 50, inc: 5, reps: [8, 12] },
  { id: 'csr', name: 'Seated Cable Row',       day: 'pull', muscle: 'back',      kind: 'compound',  needs: ['cable', 'machine'], start: 40, inc: 5, reps: [8, 12] },
  { id: 'fc',  name: 'Face Pulls',             day: 'pull', muscle: 'rear delts', kind: 'isolation', needs: ['cable'],   start: 20, inc: 2.5, reps: [12, 15] },
  { id: 'rdf', name: 'Rear Delt Fly',          day: 'pull', muscle: 'rear delts', kind: 'isolation', needs: ['dumbbell'], start: 5, inc: 1,  reps: [12, 20] },
  { id: 'bc',  name: 'Barbell Curl',           day: 'pull', muscle: 'biceps',    kind: 'isolation', needs: ['barbell'],  start: 20, inc: 2.5, reps: [8, 12] },
  { id: 'dbc', name: 'DB Curl',                day: 'pull', muscle: 'biceps',    kind: 'isolation', needs: ['dumbbell'], start: 8,  inc: 1,   reps: [8, 12] },
  { id: 'chu', name: 'Chin-ups',               day: 'pull', muscle: 'biceps',    kind: 'compound',  needs: ['bar'],      start: 0,  inc: 0,   reps: [5, 8], bw: true },
  { id: 'ir',  name: 'Inverted Row',           day: 'pull', muscle: 'back',      kind: 'compound',  needs: ['bodyweight'], start: 0, inc: 0,  reps: [8, 15], bw: true },
  { id: 'sup', name: 'Superman Hold',          day: 'pull', muscle: 'lower back', kind: 'isolation', needs: ['bodyweight'], start: 0, inc: 0, reps: [10, 15], bw: true },
  // Legs
  { id: 'sq',  name: 'Barbell Squat',          day: 'legs', muscle: 'quads',     kind: 'compound',  needs: ['barbell'],  start: 60, inc: 2.5, reps: [5, 8] },
  { id: 'gsq', name: 'Goblet Squat',           day: 'legs', muscle: 'quads',     kind: 'compound',  needs: ['dumbbell'], start: 16, inc: 2,   reps: [8, 12] },
  { id: 'lp',  name: 'Leg Press',              day: 'legs', muscle: 'quads',     kind: 'compound',  needs: ['machine'],  start: 80, inc: 10,  reps: [8, 12] },
  { id: 'rdl', name: 'Romanian Deadlift',      day: 'legs', muscle: 'hamstrings', kind: 'compound', needs: ['barbell', 'dumbbell'], start: 50, inc: 2.5, reps: [8, 10] },
  { id: 'lg',  name: 'Leg Curl',               day: 'legs', muscle: 'hamstrings', kind: 'isolation', needs: ['machine'], start: 40, inc: 5,   reps: [8, 12] },
  { id: 'lu',  name: 'Walking Lunges',         day: 'legs', muscle: 'quads',     kind: 'compound',  needs: ['bodyweight', 'dumbbell'], start: 0, inc: 0, reps: [10, 14], bw: true },
  { id: 'bss', name: 'Bulgarian Split Squat',  day: 'legs', muscle: 'quads',     kind: 'compound',  needs: ['bodyweight', 'dumbbell'], start: 0, inc: 0, reps: [8, 12], bw: true },
  { id: 'lex', name: 'Leg Extension',          day: 'legs', muscle: 'quads',     kind: 'isolation', needs: ['machine'],  start: 30, inc: 5,   reps: [10, 15] },
  { id: 'hth', name: 'Hip Thrust',             day: 'legs', muscle: 'glutes',    kind: 'compound',  needs: ['barbell', 'dumbbell', 'bodyweight'], start: 0, inc: 0, reps: [8, 12], bw: true },
  { id: 'gbr', name: 'Glute Bridge',           day: 'legs', muscle: 'glutes',    kind: 'isolation', needs: ['bodyweight'], start: 0, inc: 0, reps: [12, 20], bw: true },
  { id: 'crf', name: 'Calf Raises',            day: 'legs', muscle: 'calves',    kind: 'isolation', needs: ['bodyweight', 'dumbbell', 'machine'], start: 20, inc: 5, reps: [12, 15] },
];

const GOAL_STYLE = {
  strength: { count: 4, compoundShift: [-1, -2], keepIsolation: 1 },
  muscle:   { count: 6, compoundShift: [0, 0],   keepIsolation: 3 },
  cut:      { count: 5, compoundShift: [0, 0],   keepIsolation: 2 },
  bulk:     { count: 6, compoundShift: [0, 0],   keepIsolation: 3 },
  recomp:   { count: 5, compoundShift: [0, 0],   keepIsolation: 2 },
  maintain: { count: 4, compoundShift: [0, 0],   keepIsolation: 1 },
};
export const GOALS = Object.keys(GOAL_STYLE);

/** A Coach goal template id (cut, bulk, recomp, maintain, ...) to a style, defaulting to muscle. */
export const styleFor = (goal) => (GOAL_STYLE[goal] ? goal : 'muscle');

const has = (ex, eq) => ex.needs.some(n => eq.has(n));

/**
 * Exercises for one split day, in the order to do them. `equipment` is an array of
 * EQUIPMENT ids; returns [] for an empty set or unknown day. Compounds come first
 * (one per muscle before any repeats), then isolation work for uncovered muscles.
 */
export function pickDay(day, equipment = [], goal = 'muscle') {
  const eq = new Set(equipment);
  const style = GOAL_STYLE[styleFor(goal)];
  const pool = CATALOGUE.filter(e => e.day === day && has(e, eq));
  if (!pool.length) return [];

  // Prefer barbell/machine variants over the dumbbell/bodyweight alternative for the same muscle and kind
  // only when the equipment is there, by catalogue order (heavier first).
  const picked = [];
  const covered = new Set();
  const take = (ex) => { picked.push(ex); covered.add(ex.muscle); };

  const compounds = pool.filter(e => e.kind === 'compound');
  const maxCompounds = style.count - style.keepIsolation;
  for (const ex of compounds) { if (picked.length >= maxCompounds) break; if (!covered.has(ex.muscle)) take(ex); }
  // Second compound for a muscle that has room (e.g. a row after a pulldown), then isolation.
  for (const ex of compounds) { if (picked.length >= maxCompounds) break; if (!picked.includes(ex)) take(ex); }
  for (const ex of pool.filter(e => e.kind === 'isolation')) { if (picked.length >= style.count) break; if (!covered.has(ex.muscle)) take(ex); }
  for (const ex of pool.filter(e => e.kind === 'isolation')) { if (picked.length >= style.count) break; if (!picked.includes(ex)) take(ex); }
  return picked;
}

/** A catalogue entry as an Exercise Library entry (goal shifts the rep range of compounds). */
export function toLibraryEntry(ex, goal = 'muscle') {
  const [dMin, dMax] = ex.kind === 'compound' ? GOAL_STYLE[styleFor(goal)].compoundShift : [0, 0];
  const repsMin = Math.max(3, ex.reps[0] + dMin);
  const repsMax = Math.max(repsMin + 1, ex.reps[1] + dMax);
  const machineOnly = ex.needs.every(n => n === 'machine' || n === 'cable');
  return {
    id: ex.id, name: ex.name, day: ex.day, bodyweight: !!ex.bw,
    gym: machineOnly ? 'commercial' : 'both',
    startingWeight: ex.start, repsMin, repsMax, increment: ex.inc,
  };
}

/** { push: [...], pull: [...], legs: [...] } as library entries. */
export function suggestLibrary(equipment, goal = 'muscle') {
  const out = {};
  for (const day of ['push', 'pull', 'legs']) out[day] = pickDay(day, equipment, goal).map(e => toLibraryEntry(e, goal));
  return out;
}

/** Entries whose name is not already in the library (case-insensitive). Ids are made unique too. */
export function freshEntries(entries, library = []) {
  const names = new Set(library.map(e => String(e.name).trim().toLowerCase()));
  const ids = new Set(library.map(e => e.id));
  return entries.filter(e => !names.has(e.name.toLowerCase())).map(e => {
    let id = e.id, n = 2;
    while (ids.has(id)) id = `${e.id}${n++}`;
    ids.add(id);
    return { ...e, id };
  });
}

/** The muscles a day's pick covers, for a one-line summary. */
export const musclesCovered = (entries) => [...new Set(entries.map(e => CATALOGUE.find(c => c.id === e.id.replace(/\d+$/, ''))?.muscle).filter(Boolean))];
