// liftXp.js — which logged lifts earn XP for a personal best. Pure.
// A log row is a PR when its best estimated one-rep max beats every earlier session of the
// same lift. The first time you log a lift is a baseline, not a PR. Each PR is keyed by the
// log row id, so awarding is idempotent however often the app loads.

import { e1rm, setsOf } from './training.js';

const bestOf = (log) => Math.max(0, ...setsOf(log).map(s => e1rm(s?.weight, s?.reps)));

/** [{ key, name, date, e1rm }] oldest first, one per PR. */
export function liftPRs(logs = []) {
  const byLift = new Map();
  for (const l of logs) {
    if (!l?.id || !l.exerciseName || !l.date) continue;
    const k = String(l.exerciseName).trim().toLowerCase();
    if (!byLift.has(k)) byLift.set(k, []);
    byLift.get(k).push(l);
  }
  const out = [];
  for (const rows of byLift.values()) {
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let best = 0, seen = false;
    for (const l of rows) {
      const b = bestOf(l);
      if (b <= 0) continue;
      if (seen && b > best) out.push({ key: `LIFTPR:${l.id}`, name: l.exerciseName, date: l.date, e1rm: b });
      if (b > best) best = b;
      seen = true;
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}
