// recap.js — the weekly recap and the logging streak. Pure; the UI is
// components/WeeklyRecapCard.jsx and hooks/useRecap.js.
//
// The recap covers the seven days ending yesterday and sets them beside the seven
// before. A part with no record at all on or before the end of the week is left out
// (not scored as zero); a gap after tracking began is scored as the low result it is.
// It never says what a week "means" beyond what the numbers show.
//
// The streak is a LOGGING streak, deliberately simple: a day counts if you logged
// anything (a workout, food, sleep, a weigh-in or a habit tick). It is about showing
// up, not about hitting targets. Today does not break it until the day is over.
import { dayIndex, keyOfDay } from '../utils/dayIndex.js';
import { volume, setsOf } from './training.js';
import { recentNights, DEFAULT_SLEEP_NEED_H } from './recovery.js';
import { habitHistory } from './habits.js';

export const RECAP_DAYS = 7;
export const MILESTONES = [7, 14, 30, 60, 100, 200, 365];
const ON_TARGET = 0.15; // within 15% of the calorie target counts as on target

const round1 = (n) => Math.round(n * 10) / 10;
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const inWeek = (i, end) => i != null && i <= end && i > end - RECAP_DAYS;
const startedBy = (rows, end) => rows.some(r => { const i = dayIndex(r?.date); return i != null && i <= end; });

function oneWeek({ workouts = [], nutrition = [], sleep = [], habits = [], body = [], targetKcal = null, need = DEFAULT_SLEEP_NEED_H }, end) {
  const trainDays = new Set();
  let vol = 0;
  for (const w of workouts) {
    const i = dayIndex(w?.date);
    if (!inWeek(i, end)) continue;
    trainDays.add(i);
    vol += volume(setsOf(w));
  }

  const fed = new Map();
  for (const n of nutrition) {
    const i = dayIndex(n?.date), kcal = Number(n?.calories);
    if (inWeek(i, end) && kcal > 0) fed.set(i, (fed.get(i) || 0) + kcal);
  }
  const kcals = [...fed.values()];
  const onTarget = targetKcal > 0 ? kcals.filter(k => Math.abs(k - targetKcal) / targetKcal <= ON_TARGET).length : null;

  const nights = recentNights(sleep, keyOfDay(end), RECAP_DAYS);

  let habitPct = null;
  const sets = habits.map(h => new Set(habitHistory(h)));
  if (sets.length && sets.some(s => [...s].some(k => dayIndex(k) != null && dayIndex(k) <= end))) {
    let sum = 0;
    for (let d = end - RECAP_DAYS + 1; d <= end; d++) sum += sets.filter(s => s.has(keyOfDay(d))).length / sets.length;
    habitPct = Math.round((sum / RECAP_DAYS) * 100);
  }

  const weights = body.filter(b => inWeek(dayIndex(b?.date), end) && Number(b?.weight) > 20 && Number(b?.weight) < 400).map(b => Number(b.weight));

  return {
    sessions: trainDays.size,
    volume: vol,
    foodDays: kcals.length,
    avgKcal: kcals.length ? Math.round(kcals.reduce((s, k) => s + k, 0) / kcals.length) : null,
    onTarget,
    nights: nights.length,
    avgSleep: nights.length ? round1(nights.reduce((s, n) => s + n.hours, 0) / nights.length) : null,
    habitPct,
    weighIns: weights.length,
    avgWeight: weights.length ? round1(weights.reduce((s, w) => s + w, 0) / weights.length) : null,
    need,
  };
}

const PILLAR_TEXT = {
  training: {
    win: (w) => `You trained ${w.sessions} day${w.sessions === 1 ? '' : 's'}.`,
    fix: (w, ctx) => `Only ${w.sessions} training day${w.sessions === 1 ? '' : 's'} against ${ctx.planned} planned.`,
  },
  fuel: {
    win: (w) => (w.onTarget != null ? `${w.onTarget} of 7 days landed near your calorie target.` : `Food logged on ${w.foodDays} of 7 days.`),
    fix: (w) => (w.onTarget != null ? `Only ${w.onTarget} of 7 days landed near your calorie target.` : `Food logged on only ${w.foodDays} of 7 days.`),
  },
  sleep: {
    win: (w) => `Sleep averaged ${w.avgSleep} h across ${w.nights} logged nights.`,
    fix: (w) => `Sleep averaged ${w.avgSleep} h against your ${w.need} h need.`,
  },
  habits: {
    win: (w) => `You ticked ${w.habitPct}% of your habits on an average day.`,
    fix: (w) => `Habits were ticked on only ${w.habitPct}% of an average day.`,
  },
};

/**
 * The recap for the 7 days ending yesterday. Null when fewer than two parts have any data.
 * `sessionsPerWeek` is how many training days the active plan has.
 */
export function weeklyRecap(data, today) {
  const t = dayIndex(today);
  if (t == null) return null;
  const end = t - 1;
  const prevEnd = end - RECAP_DAYS;
  const w = oneWeek(data, end);
  const p = oneWeek(data, prevEnd);
  const planned = data.sessionsPerWeek > 0 ? data.sessionsPerWeek : 3;

  const ratios = {};
  if (startedBy(data.workouts || [], end)) ratios.training = clamp01(w.sessions / planned);
  if (startedBy(data.nutrition || [], end)) ratios.fuel = clamp01((w.onTarget ?? w.foodDays) / 7);
  if (w.nights >= 3) ratios.sleep = clamp01(w.avgSleep / w.need);
  if (w.habitPct != null) ratios.habits = clamp01(w.habitPct / 100);

  const keys = Object.keys(ratios);
  if (keys.length < 2) return null;
  const ordered = keys.slice().sort((a, b) => ratios[b] - ratios[a]);
  const best = ordered[0], worst = ordered[ordered.length - 1];
  const ctx = { planned };
  const win = ratios[best] >= 0.5 ? { part: best, text: PILLAR_TEXT[best].win(w, ctx) } : null;
  const fix = worst !== best && ratios[worst] < 0.85 ? { part: worst, text: PILLAR_TEXT[worst].fix(w, ctx) } : null;

  const weightChange = w.avgWeight != null && p.avgWeight != null ? round1(w.avgWeight - p.avgWeight) : null;
  return {
    from: keyOfDay(end - RECAP_DAYS + 1),
    to: keyOfDay(end),
    week: w,
    prev: p,
    planned,
    weightChange,
    win,
    fix,
    ratios,
  };
}

/** The Monday-style key for "this recap" so it can be shown once and dismissed. */
export const recapKey = (recap) => recap?.to ?? null;

/**
 * Logging streak. `data` = { workouts, nutrition, sleep, body, habits } (rows with `date`; habits with history).
 * Returns { current, best, milestone (largest reached, or null), justReached (current is exactly a milestone),
 *   next (the next milestone), active (logged today) }.
 */
export function loggingStreak({ workouts = [], nutrition = [], sleep = [], body = [], habits = [] } = {}, today) {
  const t = dayIndex(today);
  if (t == null) return { current: 0, best: 0, milestone: null, justReached: false, next: MILESTONES[0], active: false };
  const days = new Set();
  const add = (k) => { const i = dayIndex(k); if (i != null && i <= t) days.add(i); };
  for (const r of workouts) add(r?.date);
  for (const r of nutrition) if (Number(r?.calories) > 0) add(r?.date);
  for (const r of sleep) if (Number(r?.duration) > 0) add(r?.date);
  for (const r of body) if (Number(r?.weight) > 0) add(r?.date);
  for (const h of habits) for (const k of habitHistory(h)) add(k);

  const active = days.has(t);
  let cur = 0;
  for (let d = active ? t : t - 1; days.has(d); d--) cur++;

  let best = 0, run = 0, prev = null;
  for (const d of [...days].sort((a, b) => a - b)) {
    run = prev != null && d === prev + 1 ? run + 1 : 1;
    prev = d;
    if (run > best) best = run;
  }
  const reached = MILESTONES.filter(m => m <= cur);
  return {
    current: cur,
    best,
    milestone: reached.length ? reached[reached.length - 1] : null,
    justReached: MILESTONES.includes(cur) && active,
    next: MILESTONES.find(m => m > cur) ?? null,
    active,
  };
}
