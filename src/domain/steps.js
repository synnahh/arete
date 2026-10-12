// steps.js — daily steps typed in by hand (until Apple Health sync is deployed), the
// 7-day average, and the guide's ramp: find your real average first, then add about
// 1,000 a day every 1-2 weeks towards a stable 8-10k. Pure.
// Stored as one document: { 'YYYY-MM-DD': count }.

import { dayIndex } from '../utils/dayIndex.js';

export const STEP_LIMITS = { min: 2000, max: 10000, ramp: 1000 };
export const RAMP_EVERY_DAYS = 7;
const MAX_DAYS = 120;

export function cleanLog(log) {
  const out = {};
  for (const [d, n] of Object.entries(log && typeof log === 'object' ? log : {})) {
    const v = Math.round(Number(n));
    if (dayIndex(d) != null && v >= 0 && v <= 100000) out[d] = v;
  }
  const keep = Object.keys(out).sort().slice(-MAX_DAYS);
  return Object.fromEntries(keep.map(k => [k, out[k]]));
}

export function setSteps(log, date, count) {
  const v = Math.round(Number(count));
  const next = { ...cleanLog(log) };
  if (dayIndex(date) == null || !(v >= 0 && v <= 100000)) return next;
  next[date] = v;
  return cleanLog(next);
}

/** Mean of logged days in the 7 days up to and including `today`; needs 3+ logged days. */
export function weekAverage(log, today) {
  const t = dayIndex(today);
  if (t == null) return null;
  const days = Object.entries(cleanLog(log)).filter(([d]) => { const k = t - dayIndex(d); return k >= 0 && k < 7; }).map(([, n]) => n);
  if (days.length < 3) return null;
  return Math.round(days.reduce((s, n) => s + n, 0) / days.length);
}

/**
 * The next goal: when you have averaged at least 90% of the current goal over a week, and the
 * goal has stood for 7 days (when known), step up by 1,000 (to the nearest 500), never past
 * 10,000. Null when it is not time yet.
 */
export function rampedGoal(average, goal, daysSinceSet = null) {
  const g = Number(goal) || 0;
  if (!(average > 0) || !(g > 0) || g >= STEP_LIMITS.max) return null;
  if (daysSinceSet != null && daysSinceSet < RAMP_EVERY_DAYS) return null;   // the guide: every 1-2 weeks, not sooner
  if (average < g * 0.9) return null;
  return Math.min(STEP_LIMITS.max, Math.round((g + STEP_LIMITS.ramp) / 500) * 500);
}

/** The first goal when none was set: your real average, to the nearest 500, within limits. */
export function startingGoal(average) {
  if (!(average > 0)) return null;
  return Math.max(STEP_LIMITS.min, Math.min(STEP_LIMITS.max, Math.round(average / 500) * 500));
}
