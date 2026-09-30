// muscleRecovery.js — which muscles are fresh and which are still recovering,
// from what you logged. Pure. Workout logs carry a date, not a time, so this
// works in whole days.
//
// Rule of thumb used by most coaches: a muscle needs about 48 to 72 hours after a
// hard session before it is worth training hard again, longer after a lot of sets.
//   worked      trained today
//   recovering  trained yesterday, or 2 days ago with 8+ hard sets
//   fresh       3+ days since, or never in the last 14 days
// Weekly sets (last 7 days) are compared with the usual 10-20 hard sets per muscle. Helper muscles
// (triceps in a bench press) count half a set per set, the usual way of counting volume.
// A guide, not a measurement: it cannot see how hard the sets were.
import { MUSCLE_IDS, musclesForLog } from './muscles.js';
import { setsOf } from './training.js';
import { dayIndex } from '../utils/dayIndex.js';

export const HEAVY_SETS = 8;
export const WEEK_TARGET = { min: 10, max: 20 };

const countSets = (log) => Math.max(1, setsOf(log).length);

/** Volume verdict for a week's sets: 'none' | 'low' | 'on-target' | 'high'. */
export const volumeBand = (sets) => (sets <= 0 ? 'none' : sets < WEEK_TARGET.min ? 'low' : sets <= WEEK_TARGET.max ? 'on-target' : 'high');

/**
 * { [muscle]: { status, daysSince, lastDate, sets7d, sessionSets, volume } } for every muscle.
 * `sessionSets` is the sets on the most recent day the muscle was trained.
 */
export function muscleRecovery(logs = [], today) {
  const t = dayIndex(today);
  const out = Object.fromEntries(MUSCLE_IDS.map(id => [id, { status: 'fresh', daysSince: null, lastDate: null, sets7d: 0, sessionSets: 0, volume: 'none' }]));
  if (t == null) return out;

  const byMuscleDay = new Map(); // "muscle|idx" -> sets
  for (const log of Array.isArray(logs) ? logs : []) {
    const idx = dayIndex(log?.date);
    if (idx == null || idx > t || t - idx > 14) continue;
    const sets = countSets(log);
    // The first muscle listed is the prime mover and gets the full sets; the others help, so half.
    musclesForLog(log).forEach((m, n) => {
      if (!out[m]) return;
      const k = `${m}|${idx}`;
      byMuscleDay.set(k, (byMuscleDay.get(k) || 0) + sets * (n === 0 ? 1 : 0.5));
    });
  }

  for (const [k, sets] of byMuscleDay) {
    const [m, idxText] = k.split('|');
    const idx = Number(idxText);
    const row = out[m];
    if (t - idx < 7) row.sets7d += sets;
    if (row.daysSince == null || t - idx < row.daysSince) {
      row.daysSince = t - idx;
      row.sessionSets = sets;
      row.lastDate = new Date(idx * 86400000).toISOString().slice(0, 10);
    }
  }

  for (const row of Object.values(out)) {
    const d = row.daysSince;
    row.status = d == null ? 'fresh' : d === 0 ? 'worked' : d === 1 ? 'recovering' : d === 2 && row.sessionSets >= HEAVY_SETS ? 'recovering' : 'fresh';
    row.volume = volumeBand(row.sets7d);
    row.sets7d = Math.round(row.sets7d);
    row.sessionSets = Math.round(row.sessionSets);
  }
  return out;
}

/** Muscle ids grouped for a summary line: what is ready to train hard, and what to leave alone today. */
export function summary(map) {
  const ids = Object.keys(map);
  return {
    ready: ids.filter(m => map[m].status === 'fresh'),
    rest: ids.filter(m => map[m].status !== 'fresh'),
    lacking: ids.filter(m => map[m].volume === 'low' || map[m].volume === 'none'),
  };
}

/**
 * Which split day suits today: the one whose muscles are the freshest. Returns
 * { day, freshShare } or null when nothing has been logged (no basis to choose).
 */
export function suggestSplitDay(map, splits = { push: ['chest', 'shoulders', 'triceps'], pull: ['back', 'biceps', 'forearms'], legs: ['quads', 'hamstrings', 'glutes', 'calves'] }) {
  if (Object.values(map).every(r => r.daysSince == null)) return null;
  let best = null;
  for (const [day, muscles] of Object.entries(splits)) {
    const fresh = muscles.filter(m => map[m]?.status === 'fresh').length / muscles.length;
    // On a tie prefer the day trained longest ago.
    const ago = Math.min(...muscles.map(m => map[m]?.daysSince ?? 99));
    if (!best || fresh > best.freshShare || (fresh === best.freshShare && ago > best.ago)) best = { day, freshShare: +fresh.toFixed(2), ago };
  }
  return best && { day: best.day, freshShare: best.freshShare };
}
