// training.js — pure logic for the Train session logger (src/tabs/TrainSession.jsx).
//
// Storage stays compatible with every existing reader of workout_logs:
// one row per exercise per day, { date, exerciseName, muscle, muscles, topSet },
// now with the full list of completed sets in `sets`. Rows logged before
// this change have only `topSet`; setsOf() treats that as a single set.

/** Estimated one-rep max (Epley). */
export function e1rm(weight, reps) {
  const w = Number(weight) || 0, r = Number(reps) || 0;
  if (r <= 0) return 0;
  if (r === 1) return w;
  return +(w * (1 + r / 30)).toFixed(1);
}

/** All completed sets of a log row (legacy rows: their top set). */
export function setsOf(log) {
  if (Array.isArray(log?.sets) && log.sets.length) return log.sets;
  return log?.topSet ? [log.topSet] : [];
}

/** Heaviest set, most reps breaking ties: what progression reads. */
export function topSetOf(sets = []) {
  let top = null;
  for (const s of sets) {
    const candidate = { weight: Number(s?.weight) || 0, reps: Number(s?.reps) || 0 };
    if (!top || candidate.weight > top.weight || (candidate.weight === top.weight && candidate.reps > top.reps)) top = candidate;
  }
  return top;
}

const forExercise = (logs, name) => (logs || []).filter(l => l.exerciseName === name);

/** Sets from the most recent session of this exercise before `date`. */
export function previousSets(logs, name, date) {
  const prior = forExercise(logs, name)
    .filter(l => (l.date ?? '') < date)
    .sort((a, b) => b.date.localeCompare(a.date));
  return prior.length ? setsOf(prior[0]) : [];
}

/** Today's existing row for this exercise, if any (to continue, not duplicate). */
export function todaysLog(logs, name, date) {
  return forExercise(logs, name).find(l => l.date === date) ?? null;
}

/** Best e1RM and heaviest weight ever, optionally excluding one day. */
export function bests(logs, name, { excludeDate = null } = {}) {
  let bestE1rm = 0, bestWeight = 0, count = 0;
  for (const l of forExercise(logs, name)) {
    if (excludeDate && l.date === excludeDate) continue;
    for (const s of setsOf(l)) {
      count++;
      bestE1rm = Math.max(bestE1rm, e1rm(s.weight, s.reps));
      bestWeight = Math.max(bestWeight, Number(s.weight) || 0);
    }
  }
  return { bestE1rm, bestWeight, count };
}

/**
 * Is this set a personal record? Compared with all earlier days plus the
 * sets already done today. The very first set of an exercise is not a PR,
 * so a new exercise doesn't celebrate every set.
 */
export function detectPR(set, { history, todaySets = [] }) {
  const priorCount = history.count + todaySets.length;
  if (!priorCount) return null;
  let bestE = history.bestE1rm, bestW = history.bestWeight;
  for (const s of todaySets) {
    bestE = Math.max(bestE, e1rm(s.weight, s.reps));
    bestW = Math.max(bestW, Number(s.weight) || 0);
  }
  const est = e1rm(set.weight, set.reps);
  const kinds = [];
  if (set.weight > 0 && set.weight > bestW) kinds.push('weight');
  if (est > bestE) kinds.push('e1rm');
  return kinds.length ? { kinds, e1rm: est } : null;
}

/** Rest between sets from the exercise's rep range: heavier work, longer rest. */
export function restSeconds(ex) {
  const max = Number(ex?.repsMax) || 10;
  if (max <= 6) return 180;
  if (max <= 10) return 120;
  return 90;
}

/**
 * Pre-filled rows for today: target weight from progression, reps aimed one
 * above last time while holding (double progression), else the bottom of the
 * range. `prev` supplies the "previous" ghost for each row.
 */
export function plannedRows(ex, prog, prev = [], count = 3) {
  const n = Math.max(count, prev.length);
  const weight = ex.bodyweight ? 0 : prog.nextWeight;
  const lastTopReps = topSetOf(prev)?.reps ?? null;
  const reps = prog.action === 'HOLD' && lastTopReps !== null
    ? Math.min(ex.repsMax, lastTopReps + 1)
    : ex.repsMin;
  return Array.from({ length: n }, (_, i) => ({ weight, reps, prev: prev[i] ?? null, done: false }));
}

/** Total volume in kg (weight × reps over completed sets). */
export function volume(sets = []) {
  return Math.round(sets.reduce((s, x) => s + (Number(x.weight) || 0) * (Number(x.reps) || 0), 0));
}
