// rosacea.js — the guide's barrier-first plan for rosacea-prone cheeks: a weekly redness score
// (0-10, noted weekly; stored on the lm_daily row as `redness`) and a gated introduction of
// azelaic acid. Pure. Cosmetic guidance from the guide, not medical advice.
//
// The guide, section 11: first 2 weeks cleanser + moisturiser + SPF only, no new active.
// Weeks 3-4, if calm: azelaic acid 10% on two non-consecutive nights a week. Weeks 5-6: 3 nights
// or alternate nights, only if redness and burning are no worse. Weeks 7-8: hold the tolerated
// schedule. "Calm" is the user's judgement (no sustained stinging, burning or worse redness),
// so the app asks rather than guessing it from a number.

import { dayIndex } from '../utils/dayIndex.js';

export const BASE_DAYS = 14;
export const AZELAIC_NAME = 'Azelaic acid 10% (thin layer on dry skin, then moisturiser)';
export const AZELAIC_NIGHTS = { start: [1, 4], build: [1, 3, 5], };   // Mon + Thu; then Mon, Wed, Fri

export const validRedness = (v) => (v !== '' && v != null && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10 ? Math.round(Number(v) * 2) / 2 : null);

/** Redness readings as [{ date, idx, score }], oldest first. */
export function rednessReadings(rows = []) {
  return rows.map(r => ({ date: r?.date, idx: dayIndex(r?.date), score: validRedness(r?.redness) }))
    .filter(x => x.idx != null && x.score != null).sort((a, b) => a.idx - b.idx);
}

/** Average of the last 14 days against the 14 before, or null with fewer than 2 readings in the recent window. */
export function rednessTrend(rows, today) {
  const t = dayIndex(today);
  const all = rednessReadings(rows);
  if (t == null) return null;
  const recent = all.filter(x => x.idx > t - 14 && x.idx <= t).map(x => x.score);
  if (recent.length < 2) return null;
  const before = all.filter(x => x.idx > t - 28 && x.idx <= t - 14).map(x => x.score);
  const mean = (a) => Math.round((a.reduce((s, n) => s + n, 0) / a.length) * 10) / 10;
  const avg = mean(recent);
  const prev = before.length >= 2 ? mean(before) : null;
  return { avg, previous: prev, delta: prev == null ? null : Math.round((avg - prev) * 10) / 10, readings: recent.length };
}

/**
 * Where the azelaic plan is. `routineStart` = the day the base routine began.
 * `azelaicStart` = the day azelaic acid was added (null if not yet).
 * Returns { phase: 'base' | 'ready' | 'intro' | 'build' | 'hold', daysOnBase, week, nights, message }.
 */
export function azelaicPlan({ routineStart, azelaicStart = null, today }) {
  const t = dayIndex(today);
  const base = dayIndex(routineStart);
  if (t == null || base == null) return { phase: 'unknown', daysOnBase: null, week: null, nights: 0, message: 'Tick your routine for a few days and this shows when azelaic acid can start.' };
  const daysOnBase = t - base;
  const a = dayIndex(azelaicStart);
  if (a == null) {
    return daysOnBase >= BASE_DAYS
      ? { phase: 'ready', daysOnBase, week: null, nights: 0, message: 'You have had 14 days on the base routine. If your skin has been calm, azelaic acid can start on two non-consecutive nights a week.' }
      : { phase: 'base', daysOnBase, week: null, nights: 0, message: `Day ${Math.max(0, daysOnBase)} of 14 on the base routine (cleanser, moisturiser, SPF). Add nothing new yet.` };
  }
  const week = Math.floor((t - a) / 7) + 1;
  if (week <= 2) return { phase: 'intro', daysOnBase, week, nights: 2, message: `Azelaic acid week ${week}: two non-consecutive nights. Do not increase yet.` };
  if (week <= 4) return { phase: 'build', daysOnBase, week, nights: 3, message: `Azelaic acid week ${week}: you can go to 3 nights, or alternate nights, only if redness and burning are no worse. Otherwise stay at two.` };
  return { phase: 'hold', daysOnBase, week, nights: 3, message: `Azelaic acid week ${week}: hold the schedule you tolerate. Only then consider anything else, one new product at a time.` };
}
