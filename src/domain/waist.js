// waist.js — the weekly waist measurement and the guide's rule for it. Pure.
// Source: the 25 Sep guide, section 4: waist weekly at the navel, relaxed after an exhale,
// two readings averaged. "If the waist trend is unchanged for 3 weeks and compliance is
// good, reduce 100-150 kcal or add about 1,000 steps a day." The guide does not say how
// small a change counts as "unchanged"; WAIST_FLAT_CM is that assumption, kept in one place.

import { dayIndex } from '../utils/dayIndex.js';

export const WAIST_FLAT_CM = 0.5;
export const FLAT_WINDOW_DAYS = 21;
const r1 = (n) => Math.round(n * 10) / 10;

/** Plausible waist readings (cm) from body_metrics rows, oldest first. */
export function waistReadings(rows = []) {
  return rows
    .map(r => ({ date: r?.date, cm: Number(r?.waist) }))
    .filter(r => dayIndex(r.date) != null && r.cm >= 40 && r.cm <= 200)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Average of two readings taken together, for the check-in form. Null unless both are plausible. */
export function averageOfTwo(a, b) {
  const x = Number(a), y = Number(b);
  if (![x, y].every(v => v >= 40 && v <= 200)) return null;
  return r1((x + y) / 2);
}

/**
 * { latest, first, changeCm, readings, flat, daysSpan }.
 * flat = three or more readings spread over at least 14 days inside the last 21 days,
 * and the newest differs from the oldest by less than WAIST_FLAT_CM.
 */
export function waistTrend(rows, today) {
  const all = waistReadings(rows);
  const t = dayIndex(today);
  if (!all.length || t == null) return null;
  const recent = all.filter(r => t - dayIndex(r.date) >= 0 && t - dayIndex(r.date) < FLAT_WINDOW_DAYS + 1);
  const latest = all[all.length - 1];
  const first = all[0];
  const out = { latest: latest.cm, latestDate: latest.date, first: first.cm, changeCm: r1(latest.cm - first.cm), readings: all.length, flat: false, daysSpan: 0 };
  if (recent.length >= 3) {
    out.daysSpan = dayIndex(recent[recent.length - 1].date) - dayIndex(recent[0].date);
    out.flat = out.daysSpan >= 14 && Math.abs(recent[recent.length - 1].cm - recent[0].cm) < WAIST_FLAT_CM;
  }
  return out;
}
