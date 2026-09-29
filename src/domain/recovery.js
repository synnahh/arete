// recovery.js — sleep debt and a readiness score. Pure functions over
// `sleep_data` and `workout_logs`; the UI is components/ReadinessCard.jsx.
//
// Sleep rows: { date, duration (minutes), ... }, dated by the morning you woke.
// A missing night is unknown, never zero: a night nobody logged is skipped.
//
// Readiness is advice, not a verdict. It is a transparent blend of three parts
// and it says which one is pulling it down. It never changes a plan by itself:
// the only automatic effect is that Train holds a weight instead of adding one
// on a low-readiness day (see applyReadiness in progression.js).

import { setsOf, volume } from './training.js';

export const DEFAULT_SLEEP_NEED_H = 8;
export const DEBT_WINDOW_DAYS = 14;
const MIN_NIGHTS_FOR_DEBT = 4;
const MAX_REPAY_PER_NIGHT_H = 1; // an extra hour of sleep repays at most an hour

const DAY = 86400000;
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayIndex = (key) => {
  if (!KEY_RE.test(String(key))) return null;
  const [y, m, d] = key.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  return new Date(t).getUTCDate() === d ? t / DAY : null;
};
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const hoursOf = (row) => (Number(row?.duration) > 0 ? Number(row.duration) / 60 : null);

/** Hours slept per date within the window ending `today`, one entry per night. */
export function recentNights(rows = [], today, days = DEBT_WINDOW_DAYS) {
  const end = dayIndex(today);
  if (end == null) return [];
  const byDate = new Map();
  for (const r of rows) {
    const d = dayIndex(r?.date), h = hoursOf(r);
    if (d == null || h == null || h > 24 || d > end || d <= end - days) continue;
    // One row per date is the rule (the logger updates in place). If a re-import left two,
    // take the longer rather than adding them and reporting a night of double length.
    byDate.set(r.date, Math.max(byDate.get(r.date) || 0, h));
  }
  return [...byDate.entries()].map(([date, hours]) => ({ date, hours })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Sleep debt: how far you are under your need across the last 14 nights,
 * counting only nights that were logged. Sleeping over your need pays debt
 * back, by at most an hour a night. Needs 4+ logged nights to say anything.
 */
export function sleepDebt(rows, today, { need = DEFAULT_SLEEP_NEED_H, days = DEBT_WINDOW_DAYS } = {}) {
  const nights = recentNights(rows, today, days);
  if (nights.length < MIN_NIGHTS_FOR_DEBT) return { status: 'insufficient', nights: nights.length, need };
  let debt = 0;
  for (const n of nights) {
    const gap = need - n.hours;
    debt += gap > 0 ? gap : Math.max(gap, -MAX_REPAY_PER_NIGHT_H);
  }
  debt = Math.max(0, debt);
  const avg = nights.reduce((s, n) => s + n.hours, 0) / nights.length;
  return {
    status: debt < 2 ? 'low' : debt < 6 ? 'moderate' : 'high',
    debtHours: +debt.toFixed(1), nights: nights.length, avgHours: +avg.toFixed(1), need,
  };
}

/** The night just gone: today's row, else yesterday's. Older is treated as unknown. */
export function lastNight(rows, today) {
  const t = dayIndex(today);
  if (t == null) return null;
  const nights = recentNights(rows, today, 2); // today and yesterday
  const n = nights[nights.length - 1];
  return n ? { date: n.date, hours: +n.hours.toFixed(1) } : null;
}

/**
 * Training load of the last 48 hours against your usual: volume on the two
 * days before `today` (not today itself) over twice your average day across
 * the 28 days before that. Null with under 3 training days on record.
 */
export function trainingLoad(logs = [], today) {
  const t = dayIndex(today);
  if (t == null) return null;
  const perDay = new Map();
  for (const l of logs) {
    const d = dayIndex(l?.date);
    if (d == null || d >= t || d < t - 30) continue;
    perDay.set(d, (perDay.get(d) || 0) + volume(setsOf(l)));
  }
  const trained = [...perDay.entries()].filter(([, v]) => v > 0);
  if (trained.length < 3) return null;
  const recent = trained.filter(([d]) => d >= t - 2).reduce((s, [, v]) => s + v, 0);
  const base = trained.filter(([d]) => d < t - 2).reduce((s, [, v]) => s + v, 0) / 28;
  if (!(base > 0)) return null;
  return { recentVolume: Math.round(recent), ratio: +(recent / (base * 2)).toFixed(2) };
}

const BANDS = [
  { min: 75, id: 'push',    label: 'Good to push',  advice: 'Recovered. A good day to go for a heavy set or a PR.' },
  { min: 50, id: 'normal',  label: 'Normal day',    advice: 'Train as planned.' },
  { min: 0,  id: 'go-easy', label: 'Go easier',     advice: 'Keep the weights where they are (no increases), drop a set or two if it feels heavy, and protect tonight’s sleep.' },
];

/**
 * Readiness 0–100 from up to three parts, renormalised over the ones we have:
 *   last night's sleep (40%), sleep debt (30%), training load (30%).
 * Returns { status: 'no-data' } unless there is at least a night or a debt.
 */
export function readiness({ sleepRows = [], workoutLogs = [], today, need = DEFAULT_SLEEP_NEED_H }) {
  const night = lastNight(sleepRows, today);
  const debt = sleepDebt(sleepRows, today, { need });
  const load = trainingLoad(workoutLogs, today);

  const parts = [];
  if (night) {
    const pct = night.hours >= need ? 1 : clamp01((night.hours - 3) / (need - 3));
    parts.push({ key: 'sleep', label: 'Last night', weight: 0.4, pct, note: `${night.hours} h slept, you need ${need} h` });
  }
  if (debt.status !== 'insufficient') {
    parts.push({ key: 'debt', label: 'Sleep debt', weight: 0.3, pct: clamp01(1 - debt.debtHours / 10), note: `${debt.debtHours} h behind over ${debt.nights} logged nights` });
  }
  if (!parts.length) return { status: 'no-data', night, debt, load };
  if (load) {
    const pct = load.ratio <= 1.2 ? 1 : load.ratio >= 2 ? 0.4 : 1 - ((load.ratio - 1.2) / 0.8) * 0.6;
    parts.push({ key: 'load', label: 'Training load', weight: 0.3, pct, note: load.ratio <= 1.2 ? 'Normal load over the last 2 days' : `Last 2 days were ${Math.round(load.ratio * 100)}% of your usual load` });
  }

  const total = parts.reduce((s, p) => s + p.weight, 0);
  const score = Math.round((parts.reduce((s, p) => s + p.weight * p.pct, 0) / total) * 100);
  const band = BANDS.find(b => score >= b.min);
  const drag = [...parts].sort((a, b) => a.pct - b.pct)[0];
  return {
    status: 'ok', score, band: band.id, label: band.label, advice: band.advice,
    factors: parts.map(p => ({ key: p.key, label: p.label, pct: Math.round(p.pct * 100), note: p.note })),
    drag: drag.pct < 0.75 ? drag.key : null,
    night, debt, load,
  };
}

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const minutesOf = (hhmm) => { const m = TIME_RE.exec(String(hhmm || '').trim()); return m ? +m[1] * 60 + +m[2] : null; };

/**
 * Hours between going to bed and waking ('HH:MM' each), across midnight when
 * the wake time is earlier. Rounded to a quarter hour. Null for invalid times,
 * identical times, or more than 16 hours (almost certainly a typo).
 */
export function sleepHoursBetween(bed, wake) {
  const b = minutesOf(bed), w = minutesOf(wake);
  if (b == null || w == null || b === w) return null;
  const mins = w > b ? w - b : w + 24 * 60 - b;
  const hours = Math.round((mins / 60) * 4) / 4;
  return hours > 0 && hours <= 16 ? hours : null;
}
