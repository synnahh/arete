// strength.js — one Strength Score from your main lifts, judged against
// bodyweight. Pure functions; the card is components/StrengthCard.jsx.
//
// Levels are ROUGH adult-male estimated-1RM-to-bodyweight ratios, in the range
// commonly published by strength-standards sites. They are a yardstick for
// tracking your own progress and spotting your weakest lift, not a verdict:
// they ignore sex, age, height and training history, and each source differs.

import { liftHistory } from './progression.js';
import { dayIndex } from '../utils/dayIndex.js';

// bodyweight multiples for: beginner, novice, intermediate, advanced, elite
export const LIFTS = {
  bench:    { label: 'Bench press',    levels: [0.50, 0.75, 1.25, 1.75, 2.00], match: /\bbench press\b/i,                         not: /\b(db|dumbbell|incline|decline|close.?grip|machine|smith)\b/i },
  squat:    { label: 'Squat',          levels: [0.75, 1.25, 1.75, 2.25, 2.75], match: /\bsquat\b/i,                               not: /\b(db|dumbbell|split|goblet|hack|bulgarian|machine|smith|belt|pistol|jump)\b/i },
  deadlift: { label: 'Deadlift',       levels: [1.00, 1.50, 2.00, 2.50, 3.00], match: /\bdeadlift\b/i,                            not: /\b(db|dumbbell|romanian|rdl|stiff|single|straight)\b/i },
  ohp:      { label: 'Overhead press', levels: [0.35, 0.55, 0.80, 1.05, 1.30], match: /\b(overhead press|military press|ohp|barbell shoulder press)\b/i, not: /\b(db|dumbbell|machine|smith|push press|seated)\b/i },
  row:      { label: 'Barbell row',    levels: [0.50, 0.75, 1.00, 1.40, 1.75], match: /\b(barbell row|bent.?over row)\b/i,        not: /\b(db|dumbbell|machine|cable|t.?bar|seal)\b/i },
};
export const LEVEL_NAMES = ['Untrained', 'Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'];

/** Which main lift an exercise name is, or null. */
export function liftKey(name) {
  const n = String(name || '');
  for (const [key, l] of Object.entries(LIFTS)) if (l.match.test(n) && !l.not.test(n)) return key;
  return null;
}

/**
 * Where a ratio (estimated 1RM / bodyweight) sits: a 0-100 score, interpolated
 * between the level thresholds (untrained 0 → beginner 20 → … → elite 100),
 * and the name of the level reached.
 */
export function scoreFor(key, ratio) {
  const t = LIFTS[key]?.levels;
  if (!t || !(ratio > 0)) return { score: 0, level: LEVEL_NAMES[0], levelIndex: 0 };
  const marks = [0, ...t];
  let i = marks.length - 1;
  while (i > 0 && ratio < marks[i]) i--;
  const levelIndex = i;
  if (i >= marks.length - 1) return { score: 100, level: LEVEL_NAMES[levelIndex], levelIndex };
  const score = (i + (ratio - marks[i]) / (marks[i + 1] - marks[i])) * 20;
  return { score: Math.round(score), level: LEVEL_NAMES[levelIndex], levelIndex };
}

/**
 * The Strength Score: the mean of the lifts you have data for, using your best
 * estimated 1RM in the last `windowDays` (default 180) against bodyweight.
 * Returns null without a bodyweight or any main-lift data. `weakest` is only
 * named when there are 3+ lifts and it trails the average by 10+ points.
 */
export function strengthScore(logs = [], bodyweightKg, today, { windowDays = 180 } = {}) {
  const bw = Number(bodyweightKg);
  const t = dayIndex(today);
  if (!(bw > 20) || t == null) return null;

  const names = new Map(); // exercise name -> lift key
  for (const l of logs) if (l?.exerciseName && !names.has(l.exerciseName)) names.set(l.exerciseName, liftKey(l.exerciseName));

  const best = {}; // key -> { e1rm, date, name }
  for (const [name, key] of names) {
    if (!key) continue;
    for (const h of liftHistory(logs, name)) {
      const d = dayIndex(h.date);
      if (d == null || d > t || d <= t - windowDays) continue;
      if (!best[key] || h.e1rm > best[key].e1rm) best[key] = { e1rm: h.e1rm, date: h.date, name };
    }
  }

  const lifts = Object.entries(best).map(([key, b]) => {
    const ratio = +(b.e1rm / bw).toFixed(2);
    return { key, label: LIFTS[key].label, e1rm: b.e1rm, date: b.date, ratio, ...scoreFor(key, ratio) };
  }).sort((a, b) => b.score - a.score);
  if (!lifts.length) return null;

  const score = Math.round(lifts.reduce((s, l) => s + l.score, 0) / lifts.length);
  const levelIndex = Math.min(5, Math.max(0, Math.floor(score / 20)));
  const low = lifts[lifts.length - 1];
  const weakest = lifts.length >= 3 && score - low.score >= 10 ? low : null;
  return { score, level: LEVEL_NAMES[levelIndex], lifts, weakest, bodyweightKg: bw };
}
