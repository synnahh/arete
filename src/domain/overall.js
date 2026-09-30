// overall.js — one long-run rating (0-99) that rises with what you actually do,
// like a card's OVR. Pure. It looks at the last 28 days across five pillars and
// compares with the 28 days before, so it moves slowly and cannot be gamed by
// one good day. A pillar with no data is left out (its weight goes to the rest)
// rather than counted as zero; with fewer than two pillars there is no rating.
//
//   training  distinct training days against `sessionsPerWeek` (default 3)
//   fuel      days with food logged; a day within 15% of the calorie target counts fully
//   sleep     nights logged x how close the average is to your sleep need
//   habits    average share of your habits ticked per day
//   body      weeks (of 4) with at least one weigh-in
// A guide to consistency, not a measure of health or physique.
import { dayIndex } from '../utils/dayIndex.js';
import { recentNights, DEFAULT_SLEEP_NEED_H } from './recovery.js';
import { habitHistory } from './habits.js';

export const WINDOW_DAYS = 28;
export const WEIGHTS = { training: 0.30, fuel: 0.25, sleep: 0.20, habits: 0.15, body: 0.10 };
export const TIERS = [
  { min: 80, id: 'elite', label: 'Elite' },
  { min: 65, id: 'gold', label: 'Gold' },
  { min: 50, id: 'silver', label: 'Silver' },
  { min: 0, id: 'bronze', label: 'Bronze' },
];
export const tierOf = (ovr) => TIERS.find(t => ovr >= t.min);

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const inWindow = (idx, end, days = WINDOW_DAYS) => idx != null && idx <= end && idx > end - days;
// A pillar counts as "tracked" once the user has any record on or before the end of the window. A
// month with no records at all before that point is left out, not scored as zero; a lapse after
// tracking has started is scored as the low result it is.
const startedBy = (rows, end) => rows.some(r => { const i = dayIndex(r?.date); return i != null && i <= end; });

function pillars({ workouts, nutrition, sleep, habits, body, targets, need, sessionsPerWeek }, endIdx) {
  const out = {};

  const trainDays = new Set();
  for (const w of workouts) { const i = dayIndex(w?.date); if (inWindow(i, endIdx)) trainDays.add(i); }
  if (startedBy(workouts, endIdx)) out.training = clamp01(trainDays.size / (sessionsPerWeek * (WINDOW_DAYS / 7)));

  const fed = new Map();
  for (const n of nutrition) {
    const i = dayIndex(n?.date), kcal = Number(n?.calories);
    if (inWindow(i, endIdx) && kcal > 0) fed.set(i, (fed.get(i) || 0) + kcal);
  }
  if (startedBy(nutrition, endIdx)) {
    let credit = 0;
    for (const kcal of fed.values()) // With no calorie target there is nothing to miss, so a logged day counts fully.
      credit += !(targets?.kcal > 0) || Math.abs(kcal - targets.kcal) / targets.kcal <= 0.15 ? 1 : 0.7;
    out.fuel = clamp01(credit / WINDOW_DAYS);
  }

  const nights = recentNights(sleep, new Date(endIdx * 86400000).toISOString().slice(0, 10), WINDOW_DAYS);
  if (nights.length >= 3) {
    const avg = nights.reduce((s, n) => s + n.hours, 0) / nights.length;
    out.sleep = clamp01((nights.length / WINDOW_DAYS) * 0.4 + clamp01(avg / need) * 0.6);
  }

  const sets = habits.map(h => new Set(habitHistory(h)));
  if (sets.some(st => [...st].some(k => dayIndex(k) <= endIdx))) {
    let sum = 0;
    for (let d = endIdx - WINDOW_DAYS + 1; d <= endIdx; d++) {
      const key = new Date(d * 86400000).toISOString().slice(0, 10);
      sum += sets.filter(s => s.has(key)).length / habits.length;
    }
    out.habits = clamp01(sum / WINDOW_DAYS);
  }

  const weighed = new Set();
  for (const b of body) { const i = dayIndex(b?.date); if (inWindow(i, endIdx) && Number(b?.weight) > 0) weighed.add(Math.floor((endIdx - i) / 7)); }
  if (startedBy(body, endIdx)) out.body = clamp01(weighed.size / 4);

  return out;
}

function score(p) {
  const keys = Object.keys(p);
  if (keys.length < 2) return null;
  const total = keys.reduce((s, k) => s + WEIGHTS[k], 0);
  return Math.round((keys.reduce((s, k) => s + p[k] * WEIGHTS[k], 0) / total) * 99);
}

/**
 * { ovr, tier, pillars: { training, fuel, sleep, habits, body } (0-1, only those with data),
 *   previous, delta } or null when there is too little data.
 * data: { workouts, nutrition, sleep, habits, body, targets: { kcal }, need, sessionsPerWeek }
 */
export function overallRating(data = {}, today) {
  const end = dayIndex(today);
  if (end == null) return null;
  const d = {
    workouts: data.workouts || [], nutrition: data.nutrition || [], sleep: data.sleep || [],
    habits: data.habits || [], body: data.body || [], targets: data.targets || null,
    need: Number(data.need) >= 5 ? Number(data.need) : DEFAULT_SLEEP_NEED_H,
    sessionsPerWeek: Number(data.sessionsPerWeek) > 0 ? Number(data.sessionsPerWeek) : 3,
  };
  const now = pillars(d, end);
  const ovr = score(now);
  if (ovr == null) return null;
  const prev = score(pillars(d, end - WINDOW_DAYS));
  return { ovr, tier: tierOf(ovr), pillars: now, previous: prev, delta: prev == null ? null : ovr - prev };
}
