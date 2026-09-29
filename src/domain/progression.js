// progression.js — what to lift next, and when a lift has stalled.
// Pure functions over `workout_logs`; the UI is TrainSession / Workout.
//
// Method: double progression judged on ALL working sets (not just the top set).
//   - Every working set reaches the top of the rep range  → add weight.
//   - Otherwise hold the weight and aim one more rep on every set.
//   - One session with missed reps is normal: try the same weight again.
//   - Two sessions in a row with missed reps at that weight → drop ~10%.
//   - No new estimated best in 4+ sessions over 2+ weeks → plateau; deload 10%.
//   - Weeks away → restart lighter (5% / 10% / 20% at 3 / 6 / 12 weeks).
// Suggestions only: nothing is written, and the lifter can always override.

import { e1rm, setsOf } from './training.js';

const DAY = 86400000;
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayIndex = (key) => {
  if (!KEY_RE.test(String(key))) return null;
  const [y, m, d] = key.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  return new Date(t).getUTCDate() === d ? t / DAY : null;
};

export const PLATEAU_MIN_SESSIONS = 4; // sessions since the best before we call it a stall
export const PLATEAU_MIN_DAYS = 14;
const DELOAD = 0.9;
const WORK_SET_FLOOR = 0.9; // sets under 90% of the day's heaviest are back-off/warm-up sets

const roundTo = (x, step) => +(Math.round(x / step) * step).toFixed(2);
const num = (v) => Number(v) || 0;

/** One entry per training day for an exercise, oldest first. */
export function sessionsOf(logs = [], name) {
  const byDate = new Map();
  for (const l of logs) {
    if (l?.exerciseName !== name || dayIndex(l.date) == null) continue;
    const sets = setsOf(l).map(s => ({ weight: num(s.weight), reps: num(s.reps) })).filter(s => s.reps > 0);
    if (!sets.length) continue;
    const cur = byDate.get(l.date) || { date: l.date, sets: [], row: l };
    cur.sets.push(...sets);
    cur.row = l;
    byDate.set(l.date, cur);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map(summarise);
}

function summarise(s) {
  const topWeight = Math.max(...s.sets.map(x => x.weight));
  const work = topWeight > 0 ? s.sets.filter(x => x.weight >= topWeight * WORK_SET_FLOOR) : s.sets;
  // e1RM is only trustworthy for moderate reps; fall back to whatever exists.
  const pool = work.filter(x => x.reps <= 12);
  const est = Math.max(0, ...(pool.length ? pool : work).map(x => e1rm(x.weight, x.reps)));
  return { ...s, topWeight, work, minReps: Math.min(...work.map(x => x.reps)), e1rm: est };
}

/**
 * Has this lift stalled? Looks at how many sessions ago the best estimated 1RM
 * was set (ties within 0.5% count as the best). Needs 4+ sessions and 2+ weeks
 * since then. 'regressing' when the last two sessions sit 5% under the best.
 */
export function detectPlateau(sessions) {
  const n = sessions.length;
  if (n < PLATEAU_MIN_SESSIONS + 1) return { status: 'none' };
  const best = Math.max(...sessions.map(s => s.e1rm));
  if (!(best > 0)) return { status: 'none' };
  let idx = 0;
  sessions.forEach((s, i) => { if (s.e1rm >= best * 0.995) idx = i; });
  const since = n - 1 - idx;
  const days = dayIndex(sessions[n - 1].date) - dayIndex(sessions[idx].date);
  if (since < PLATEAU_MIN_SESSIONS || days < PLATEAU_MIN_DAYS) return { status: 'none' };
  const lastTwo = sessions.slice(-2).reduce((a, s) => a + s.e1rm, 0) / 2;
  return {
    status: lastTwo < best * 0.95 ? 'regressing' : 'plateau',
    sessions: since, days, best: +best.toFixed(1), bestDate: sessions[idx].date,
  };
}

// Did we just deload? A session at least 7% lighter than the one before it.
function recentlyDeloaded(sessions) {
  return sessions.slice(-2).some((s, i, arr) => {
    const at = sessions.length - arr.length + i;
    return at > 0 && sessions[at - 1].topWeight > 0 && s.topWeight <= sessions[at - 1].topWeight * 0.93;
  });
}

const missed = (s, repsMin) => s.work.some(x => x.reps < repsMin);

function layoffPct(days) {
  if (days >= 84) return 0.2;
  if (days >= 42) return 0.1;
  if (days >= 21) return 0.05;
  return 0;
}

const lighter = (weight, pct, inc) => {
  const w = roundTo(weight * (1 - pct), inc);
  return Math.max(0, w >= weight ? weight - inc : w);
};

/**
 * The next session's target for one exercise.
 * `ex`: { name, repsMin, repsMax, increment, startingWeight, bodyweight }.
 * Returns { action, nextWeight, targetReps, hint, plateau, last, currentWeight, sessions }.
 * `action` is one of FIRST SET, ADD WEIGHT, HOLD, DROP WEIGHT, DELOAD.
 */
export function suggestNext(ex, logs, today) {
  const inc = num(ex.increment) > 0 ? num(ex.increment) : 2.5;
  const repsMin = num(ex.repsMin) || 8;
  const repsMax = num(ex.repsMax) || Math.max(repsMin, 12);
  const sessions = sessionsOf(logs, ex.name);

  if (!sessions.length) {
    const start = num(ex.startingWeight);
    return {
      action: 'FIRST SET', nextWeight: start, currentWeight: start, targetReps: repsMin, last: null, sessions: 0, plateau: { status: 'none' },
      hint: `Start at ${ex.bodyweight ? 'bodyweight' : `${start}kg`}. Target ${repsMin}–${repsMax} reps.`,
    };
  }

  const last = sessions[sessions.length - 1];
  const prev = sessions[sessions.length - 2];
  const cur = last.topWeight;
  const plateau = detectPlateau(sessions);
  const away = dayIndex(today) != null ? Math.max(0, dayIndex(today) - dayIndex(last.date)) : 0;
  const base = { currentWeight: cur, last: last.row, sessions: sessions.length, plateau };
  const out = (action, nextWeight, targetReps, hint) => ({ ...base, action, nextWeight, targetReps, hint });

  // Weeks off: ease back in.
  const pct = layoffPct(away);
  if (pct && !ex.bodyweight && cur > 0) {
    const w = lighter(cur, pct, inc);
    return out('DROP WEIGHT', w, repsMin, `${Math.round(away / 7)} weeks since you last did this. Restart at ${w}kg and rebuild.`);
  }

  // Two sessions in a row with missed reps around this weight: back off.
  if (!ex.bodyweight && cur > 0 && prev && missed(last, repsMin) && missed(prev, repsMin) && prev.topWeight >= cur * 0.95) {
    const w = lighter(cur, 0.1, inc);
    return out('DROP WEIGHT', w, repsMin, `Missed reps two sessions running at ${cur}kg. Drop to ${w}kg and rebuild.`);
  }

  // Every working set at the top of the range: earn more weight.
  if (last.work.every(x => x.reps >= repsMax)) {
    if (ex.bodyweight || cur === 0) return out('HOLD', cur, repsMax, `All sets at ${repsMax} reps. Add load or a harder variation.`);
    const w = roundTo(cur + inc, 0.01);
    return out('ADD WEIGHT', w, repsMin, `Every set hit ${repsMax}. Add ${inc}kg: ${w}kg for ${repsMin}+ reps.`);
  }

  // Stalled: a planned deload beats grinding at the same weight.
  if (plateau.status !== 'none' && !ex.bodyweight && cur > 0 && !recentlyDeloaded(sessions)) {
    const w = lighter(cur, 1 - DELOAD, inc);
    return out('DELOAD', w, repsMax, `No new best in ${plateau.sessions} sessions (about ${plateau.best}kg estimated max, ${plateau.bestDate}). Deload to ${w}kg for one session, then rebuild.`);
  }

  if (missed(last, repsMin)) {
    return out('HOLD', cur, repsMin, `Missed reps at ${cur}kg. One off session happens: same weight again, aim for ${repsMin}+ on every set.`);
  }

  const target = Math.min(repsMax, last.minReps + 1);
  return out('HOLD', cur, target, `Stay at ${cur}kg and aim for ${target} reps on every set.`);
}

/**
 * Lifts that have stalled, worst first, with what to do about each.
 * `exercises`: the exercise list; only exercises with enough history appear.
 */
export function plateaus(exercises = [], logs = [], today) {
  const out = [];
  for (const ex of exercises) {
    const p = suggestNext(ex, logs, today);
    if (p.plateau.status === 'none') continue;
    out.push({ name: ex.name, status: p.plateau.status, sessions: p.plateau.sessions, best: p.plateau.best, bestDate: p.plateau.bestDate, action: p.action, nextWeight: p.nextWeight });
  }
  return out.sort((a, b) => (a.status === b.status ? b.sessions - a.sessions : a.status === 'regressing' ? -1 : 1));
}

/**
 * On a low-readiness day, hold the weight instead of adding some. Only ever
 * softens an ADD WEIGHT suggestion; it never lowers a weight or blocks logging.
 * `r` is the result of readiness() in recovery.js.
 */
export function applyReadiness(prog, r) {
  if (!r || r.status !== 'ok' || r.band !== 'go-easy' || prog.action !== 'ADD WEIGHT') return prog;
  return {
    ...prog,
    action: 'HOLD', nextWeight: prog.currentWeight, targetReps: null, heldByReadiness: true,
    hint: `Readiness is ${r.score} today, so hold ${prog.currentWeight}kg rather than adding weight. Take the increase next session.`,
  };
}

/** One point per training day for the lift chart: estimated 1RM and top weight. */
export function liftHistory(logs, name) {
  return sessionsOf(logs, name).map(s => ({ date: s.date, e1rm: +s.e1rm.toFixed(1), topWeight: s.topWeight }));
}
