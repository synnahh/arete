// muscleScore.js — Muscle Ranking v2: a 0-100 score per muscle from four things, the way the
// strength apps do it (Symmetric Strength and Strength Level grade a lift against bodyweight
// standards; Fitbod's muscle strength uses your best recent sets and your trend; Hevy and the
// guide count weekly hard sets). Each part is 0-100:
//
//   Strength     40%  best estimated 1RM in the last 120 days on a lift with a known standard,
//                     divided by your bodyweight, graded against approximate adult-male
//                     standards (beginner 20, novice 40, intermediate 60, advanced 80, elite 100).
//                     Helper muscles get 75% of a lift's grade.
//   Volume       25%  hard sets per week over the last 4 weeks (main muscle 1 set, helper 0.5)
//                     against the guide's weekly target for that muscle (splitCoach TARGETS).
//   Progression  15%  best estimated 1RM in the last 6 weeks against the 18 weeks before:
//                     no change = 50, +10% or more = 100, -10% or worse = 0.
//   Consistency  20%  weeks of the last 8 that trained the muscle (2+ days in a week = full).
//
// A part with no data (no bodyweight logged, no lift with a standard, no older sessions to
// compare) is left out and the others are re-weighted, and the screen says so. Your rank can
// not run ahead of your training history: under 8 days on a muscle it tops out at Developing,
// under 20 at Intermediate, under 40 at Advanced. Stopping lowers the score by itself, because
// volume and consistency look at recent weeks and strength older than 120 days counts at 85%.
import { e1rm, setsOf } from './training.js';
import { musclesForLog } from './muscles.js';
import { TARGETS } from './splitCoach.js';

export const WEIGHTS = { strength: 0.40, volume: 0.25, progression: 0.15, consistency: 0.20 };

export const RANKS = [
  { id: 'untrained',    label: 'Untrained',    min: -1, color: '#5a6072' },
  { id: 'beginner',     label: 'Beginner',     min: 0,  color: '#3b5bdb' },
  { id: 'developing',   label: 'Developing',   min: 20, color: '#4a9eff' },
  { id: 'intermediate', label: 'Intermediate', min: 40, color: '#4caf7d' },
  { id: 'advanced',     label: 'Advanced',     min: 60, color: '#f4a642' },
  { id: 'elite',        label: 'Elite',        min: 80, color: '#e25d7a' },
];
// Training days on a muscle needed before a rank opens up.
export const RANK_GATES = { advanced: 20, elite: 40, intermediate: 8 };

// Estimated 1RM as a multiple of bodyweight: [beginner, novice, intermediate, advanced, elite].
// Approximate adult-male standards in the range Strength Level and Symmetric Strength publish;
// dumbbell lifts are per hand. `total: true` means bodyweight plus added weight (pull-ups, dips).
// Order matters: the first pattern that matches wins.
export const STANDARDS = [
  { id: 'db-shoulder', re: /(db|dumbbell).*(shoulder|overhead)|seated (db|dumbbell) press/i,   t: [0.15, 0.25, 0.35, 0.5, 0.65] },
  { id: 'db-bench',    re: /(db|dumbbell).*(bench|press)|incline (db|dumbbell)/i,              t: [0.2, 0.3, 0.4, 0.6, 0.8] },
  { id: 'db-row',      re: /(db|dumbbell).*row/i,                                              t: [0.2, 0.35, 0.5, 0.75, 0.95] },
  { id: 'db-curl',     re: /(db|dumbbell|hammer).*curl/i,                                      t: [0.1, 0.15, 0.25, 0.4, 0.55] },
  { id: 'lateral',     re: /lateral raise/i,                                                   t: [0.05, 0.1, 0.15, 0.25, 0.35] },
  { id: 'bench',       re: /bench press|incline press|close.grip bench/i,                     t: [0.5, 0.75, 1.0, 1.5, 2.0] },
  { id: 'front-squat', re: /front squat/i,                                                     t: [0.6, 1.0, 1.25, 1.75, 2.25] },
  { id: 'squat',       re: /(back |barbell |^)squat$|^squat|barbell squat|high.bar|low.bar/i,  t: [0.75, 1.25, 1.5, 2.25, 2.75] },
  { id: 'rdl',         re: /romanian|rdl|stiff.leg/i,                                          t: [0.75, 1.0, 1.5, 2.0, 2.5] },
  { id: 'deadlift',    re: /deadlift/i,                                                        t: [1.0, 1.5, 2.0, 2.5, 3.0] },
  { id: 'ohp',         re: /overhead press|military press|push press|^ohp$/i,                  t: [0.35, 0.55, 0.75, 1.0, 1.4] },
  { id: 'row',         re: /barbell row|bent.over row|pendlay|t.bar row|seated cable row|cable row/i, t: [0.5, 0.75, 1.0, 1.5, 1.75] },
  { id: 'pulldown',    re: /pulldown|pull.down/i,                                              t: [0.5, 0.75, 1.0, 1.3, 1.6] },
  { id: 'pullup',      re: /pull.?ups?|chin.?ups?/i, total: true,                              t: [1.0, 1.17, 1.33, 1.5, 1.75] },
  { id: 'dips',        re: /^dips?$|weighted dip|parallel.bar dip/i, total: true,              t: [1.0, 1.2, 1.4, 1.7, 2.0] },
  { id: 'hip-thrust',  re: /hip thrust/i,                                                      t: [0.5, 1.0, 1.5, 2.25, 3.0] },
  { id: 'leg-press',   re: /leg press/i,                                                       t: [1.0, 2.0, 2.75, 3.75, 4.75] },
  { id: 'curl',        re: /barbell curl|ez.?bar curl|^curl$/i,                                t: [0.2, 0.4, 0.6, 0.85, 1.15] },
  { id: 'pushdown',    re: /pushdown|push.down/i,                                              t: [0.25, 0.5, 0.75, 1.0, 1.25] },
  { id: 'leg-curl',    re: /leg curl|hamstring curl/i,                                         t: [0.3, 0.5, 0.75, 1.0, 1.3] },
  { id: 'leg-ext',     re: /leg extension/i,                                                   t: [0.5, 0.75, 1.0, 1.5, 2.0] },
  { id: 'calf',        re: /calf raise/i,                                                      t: [0.5, 1.0, 1.5, 2.25, 3.0] },
];
const LEVEL_NAMES = ['beginner', 'novice', 'intermediate', 'advanced', 'elite'];

export const standardFor = (name) => STANDARDS.find(s => s.re.test(String(name || '').trim())) || null;

/** Bodyweight ratio -> 0-100 against a lift's thresholds (20 per level, straight lines between). */
export function gradeRatio(ratio, t) {
  if (!(ratio > 0)) return 0;
  if (ratio < t[0]) return (20 * ratio) / t[0];
  for (let i = 1; i < t.length; i++) if (ratio < t[i]) return 20 * i + (20 * (ratio - t[i - 1])) / (t[i] - t[i - 1]);
  return 100;
}

/** Plain-words level for a ratio: "between intermediate and advanced". */
export function levelWords(ratio, t) {
  if (ratio < t[0]) return 'below beginner';
  if (ratio >= t[4]) return 'elite';
  for (let i = 1; i < t.length; i++) if (ratio < t[i]) return `between ${LEVEL_NAMES[i - 1]} and ${LEVEL_NAMES[i]}`;
  return 'elite';
}

const DAY = 86400000;
const dayNum = (key) => { const [y, m, d] = String(key).split('-').map(Number); return Date.UTC(y, (m || 1) - 1, d || 1) / DAY; };
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round = (x) => Math.round(x);

/** Best estimated 1RM in a set of logs (pull-ups and dips add bodyweight). */
function bestE1rm(logs, std, bw) {
  let best = 0;
  for (const l of logs) for (const s of setsOf(l)) {
    const reps = Math.min(Number(s.reps) || 0, 12);   // past 12 reps the estimate stops meaning much
    const load = (Number(s.weight) || 0) + (std?.total ? (bw || 0) : 0);
    if (reps > 0 && load > 0) best = Math.max(best, e1rm(load, reps));
  }
  return best;
}

export function rankFor(score, days, gates = RANK_GATES) {
  if (!days) return RANKS[0];
  let r = RANKS[1];
  for (const k of RANKS) if (k.min >= 0 && score >= k.min) r = k;
  const capAt = (id) => RANKS.findIndex(k => k.id === id);
  let idx = RANKS.indexOf(r);
  if (days < gates.intermediate) idx = Math.min(idx, capAt('developing'));
  else if (days < gates.advanced) idx = Math.min(idx, capAt('intermediate'));
  else if (days < gates.elite) idx = Math.min(idx, capAt('advanced'));
  return RANKS[idx];
}

/**
 * Score every muscle.
 * @param logs workout_logs rows ({ date, exerciseName, sets|topSet, muscles })
 * @param opts { today: 'YYYY-MM-DD', bodyweight: kg|null, muscles: [ids] }
 * @returns { [muscleId]: { score, rank, capped, days, parts: { strength, volume, progression, consistency }, tip } }
 */
export function scoreMuscles(logs = [], { today, bodyweight = null, muscles }) {
  const now = dayNum(today);
  const valid = (logs || []).filter(l => l?.date && dayNum(l.date) <= now);
  const first = valid.reduce((m, l) => Math.min(m, dayNum(l.date)), Infinity);
  const weeksKnown = Number.isFinite(first) ? clamp((now - first + 1) / 7, 1, 8) : 1;
  const bw = Number(bodyweight) > 0 ? Number(bodyweight) : null;

  // Group logs by muscle with the credit each one gives (main 1, helper 0.5).
  const byMuscle = Object.fromEntries(muscles.map(m => [m, []]));
  for (const l of valid) {
    const ms = musclesForLog(l);
    ms.forEach((m, i) => { if (byMuscle[m]) byMuscle[m].push({ log: l, main: i === 0 }); });
  }

  const out = {};
  for (const m of muscles) {
    const entries = byMuscle[m];
    const days = new Set(entries.map(e => e.log.date)).size;
    const parts = {};

    // Strength: the best-graded lift for this muscle.
    let strength = null;
    if (bw) {
      const byLift = {};
      for (const e of entries) { const std = standardFor(e.log.exerciseName); if (std) (byLift[e.log.exerciseName] ||= { std, main: false, logs: [] }).logs.push(e.log), byLift[e.log.exerciseName].main ||= e.main; }
      for (const [name, x] of Object.entries(byLift)) {
        const recent = x.logs.filter(l => now - dayNum(l.date) <= 120);
        let best = bestE1rm(recent, x.std, bw), stale = false;
        if (!best) { best = bestE1rm(x.logs, x.std, bw) * 0.85; stale = best > 0; }
        if (!best) continue;
        const ratio = best / bw;
        const grade = gradeRatio(ratio, x.std.t) * (x.main ? 1 : 0.75);
        if (!strength || grade > strength.score) {
          strength = { score: round(grade), lift: name, e1rm: Math.round(best), ratio: +ratio.toFixed(2),
            detail: `${name}: est. 1RM ${Math.round(best)} kg = ${ratio.toFixed(2)}× bodyweight, ${levelWords(ratio, x.std.t)}${x.main ? '' : ' (helper, 75%)'}${stale ? ' (over 120 days old, 85%)' : ''}` };
        }
      }
    }
    parts.strength = strength ?? { score: null, detail: !bw ? 'Log your bodyweight to grade strength' : 'No lift with a strength standard yet' };

    // Volume: hard sets per week over the last 4 weeks.
    const target = TARGETS[m]?.min ?? 8;
    let sets = 0;
    for (const e of entries) if (now - dayNum(e.log.date) < 28) sets += setsOf(e.log).length * (e.main ? 1 : 0.5);
    const perWeek = sets / Math.min(4, weeksKnown);
    parts.volume = entries.length
      ? { score: round(clamp(perWeek / target, 0, 1) * 100), perWeek: +perWeek.toFixed(1), target, detail: `${+perWeek.toFixed(1)} hard sets a week (target ${target})` }
      : { score: null, detail: 'No sets yet' };

    // Progression: last 6 weeks against the 18 weeks before, per lift, weighted by recent sets.
    let wsum = 0, psum = 0, changes = [];
    const lifts = {};
    for (const e of entries) (lifts[e.log.exerciseName || '?'] ||= []).push(e.log);
    for (const [name, ls] of Object.entries(lifts)) {
      const std = standardFor(name);
      const recent = ls.filter(l => now - dayNum(l.date) < 42);
      const prior = ls.filter(l => { const a = now - dayNum(l.date); return a >= 42 && a < 168; });
      const r = bestE1rm(recent, std, bw), p = bestE1rm(prior, std, bw);
      if (!r || !p) continue;
      const change = r / p - 1;
      const w = recent.reduce((s, l) => s + setsOf(l).length, 0) || 1;
      wsum += w; psum += clamp(50 + change * 500, 0, 100) * w;
      changes.push({ name, change });
    }
    if (wsum) {
      const avg = changes.reduce((s, c) => s + c.change, 0) / changes.length;
      parts.progression = { score: round(psum / wsum), change: +(avg * 100).toFixed(1), detail: `${avg >= 0 ? '+' : ''}${(avg * 100).toFixed(1)}% est. 1RM vs the 18 weeks before (${changes.length} lift${changes.length > 1 ? 's' : ''})` };
    } else parts.progression = { score: null, detail: 'Needs sessions more than 6 weeks apart to compare' };

    // Consistency: weeks of the last 8 that hit the muscle; two days in a week is a full week.
    const nWeeks = clamp(Math.ceil(weeksKnown), 1, 8);   // the oldest week holds your first log, so it is never empty
    let weekSum = 0, weeksHit = 0;
    for (let w = 0; w < nWeeks; w++) {
      const d = new Set(entries.filter(e => { const a = now - dayNum(e.log.date); return a >= w * 7 && a < (w + 1) * 7; }).map(e => e.log.date)).size;
      weekSum += Math.min(d, 2) / 2; if (d) weeksHit++;
    }
    parts.consistency = entries.length
      ? { score: round((weekSum / nWeeks) * 100), weeksHit, weeks: nWeeks, detail: `Trained ${weeksHit} of the last ${nWeeks} week${nWeeks > 1 ? 's' : ''}` }
      : { score: null, detail: 'No sessions yet' };

    // Weighted total over the parts that have data.
    let tw = 0, ts = 0;
    for (const [k, w] of Object.entries(WEIGHTS)) if (parts[k].score != null) { tw += w; ts += parts[k].score * w; }
    const score = tw ? round(ts / tw) : 0;
    const raw = rankFor(score, days, { intermediate: 0, advanced: 0, elite: 0 });
    const rank = rankFor(score, days);

    // One concrete thing that would raise it most: the weakest weighted part.
    let tip = null;
    const weakest = Object.keys(WEIGHTS).filter(k => parts[k].score != null).sort((a, b) => parts[a].score * WEIGHTS[a] - parts[b].score * WEIGHTS[b] || parts[a].score - parts[b].score)[0];
    if (days === 0) tip = 'Log a set that trains it to start ranking.';
    else if (raw !== rank) tip = `Score says ${raw.label}; ${rank === RANKS[2] ? RANK_GATES.intermediate : rank === RANKS[3] ? RANK_GATES.advanced : RANK_GATES.elite} training days unlock the next rank (${days} so far).`;
    else if (weakest === 'volume') tip = `Add sets: ${parts.volume.perWeek} of ${target} a week.`;
    else if (weakest === 'consistency') tip = 'Train it twice a week, every week.';
    else if (weakest === 'progression') tip = 'Beat your recent best: add a rep or 2.5 kg.';
    else if (weakest === 'strength') tip = `Get stronger on ${parts.strength.lift}.`;

    out[m] = { score, rank, capped: raw !== rank, days, parts, tip };
  }
  return out;
}
