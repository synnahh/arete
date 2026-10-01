// insights.js — time-range series for the Insights screen, plus one honest correlation.
// Pure. UI: tabs/Insights.jsx.
//
//   week  = last 7 days, one point per day
//   month = last 30 days, one point per day
//   year  = last 52 weeks, one point per week (averages, or totals for volume)
//
// A day with no record gives no point (a gap, never a zero). The correlation (sleep
// against that day's training volume) is only reported with 3+ weeks of sleep logs and
// at least 4 trained days on each side, and only when the gap is 8% or more.
import { dayIndex, keyOfDay } from '../utils/dayIndex.js';
import { volume, setsOf } from './training.js';
import { recentNights, DEFAULT_SLEEP_NEED_H } from './recovery.js';

export const RANGES = {
  week:  { id: 'week',  label: 'Week',  days: 7,   bucket: 1 },
  month: { id: 'month', label: 'Month', days: 30,  bucket: 1 },
  year:  { id: 'year',  label: 'Year',  days: 364, bucket: 7 },
};

const round1 = (n) => Math.round(n * 10) / 10;
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;

/** Group `[{ i (day index), v }]` into buckets ending at `end`; `reduce` turns a bucket's values into a point. */
function bucketed(rows, end, range, reduce) {
  const { days, bucket } = RANGES[range];
  const start = end - days + 1;
  const by = new Map();
  for (const r of rows) {
    if (r.i < start || r.i > end) continue;
    const b = Math.floor((r.i - start) / bucket);
    (by.get(b) || by.set(b, []).get(b)).push(r.v);
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([b, vs]) => ({ date: keyOfDay(start + b * bucket), value: reduce(vs) }));
}

function summarise(points) {
  if (!points.length) return null;
  const values = points.map(p => p.value);
  return {
    n: points.length,
    avg: round1(avg(values)),
    min: Math.min(...values),
    max: Math.max(...values),
    first: values[0],
    latest: values[values.length - 1],
    change: round1(values[values.length - 1] - values[0]),
  };
}

/**
 * `data` = { body, nutrition, sleep, workouts, targetKcal, need }. Returns
 * { range, from, to, weight, calories, sleep, volume } where each is { points, summary } or null (no data).
 */
export function insightSeries(data, range, today) {
  const t = dayIndex(today);
  if (t == null || !RANGES[range]) return null;
  const { body = [], nutrition = [], sleep = [], workouts = [] } = data;

  const weightRows = body.map(b => ({ i: dayIndex(b?.date), v: Number(b?.weight) })).filter(r => r.i != null && r.v > 20 && r.v < 400);

  const dayKcal = new Map();
  for (const n of nutrition) {
    const i = dayIndex(n?.date), k = Number(n?.calories);
    if (i != null && k > 0) dayKcal.set(i, (dayKcal.get(i) || 0) + k);
  }
  const kcalRows = [...dayKcal.entries()].map(([i, v]) => ({ i, v }));

  const sleepRows = recentNights(sleep, today, RANGES[range].days).map(n => ({ i: dayIndex(n.date), v: n.hours }));

  const dayVol = new Map();
  for (const w of workouts) {
    const i = dayIndex(w?.date), v = volume(setsOf(w));
    if (i != null && v > 0) dayVol.set(i, (dayVol.get(i) || 0) + v);
  }
  const volRows = [...dayVol.entries()].map(([i, v]) => ({ i, v }));

  const make = (rows, reduce) => {
    const points = bucketed(rows, t, range, reduce);
    return points.length ? { points, summary: summarise(points) } : null;
  };
  return {
    range,
    from: keyOfDay(t - RANGES[range].days + 1),
    to: today,
    weight:   make(weightRows, (vs) => round1(avg(vs))),
    calories: make(kcalRows,   (vs) => Math.round(avg(vs))),
    sleep:    make(sleepRows,  (vs) => round1(avg(vs))),
    volume:   make(volRows,    (vs) => Math.round(range === 'year' ? vs.reduce((s, x) => s + x, 0) : avg(vs))),
    targetKcal: data.targetKcal > 0 ? data.targetKcal : null,
  };
}

/**
 * Do you lift less on days you slept little? Compares training volume on days with
 * sleep under `need - 1` h against days at or above it, over the last 90 days.
 * Returns null unless there is enough to say anything.
 */
export function sleepTrainingLink({ sleep = [], workouts = [], need = DEFAULT_SLEEP_NEED_H } = {}, today) {
  const t = dayIndex(today);
  if (t == null) return null;
  const nights = recentNights(sleep, today, 90);
  if (nights.length < 10) return null;
  const first = dayIndex(nights[0].date), last = dayIndex(nights[nights.length - 1].date);
  if (last - first < 21) return null;

  const dayVol = new Map();
  for (const w of workouts) {
    const i = dayIndex(w?.date), v = volume(setsOf(w));
    if (i != null && v > 0) dayVol.set(i, (dayVol.get(i) || 0) + v);
  }
  const cut = need - 1;
  const low = [], ok = [];
  for (const n of nights) {
    const v = dayVol.get(dayIndex(n.date));
    if (v == null) continue;
    (n.hours < cut ? low : ok).push(v);
  }
  if (low.length < 4 || ok.length < 4) return null;
  const lowAvg = avg(low), okAvg = avg(ok);
  const pct = Math.round(((lowAvg - okAvg) / okAvg) * 100);
  if (Math.abs(pct) < 8) return null;
  const cutText = `${round1(cut)} h`;
  return {
    pct,
    lowDays: low.length,
    okDays: ok.length,
    text: pct < 0
      ? `On days after nights under ${cutText}, your training volume ran about ${Math.abs(pct)}% lower (${low.length} short-sleep sessions against ${ok.length} others).`
      : `On days after nights under ${cutText}, your training volume ran about ${pct}% higher (${low.length} short-sleep sessions against ${ok.length} others). Sleep may not be what limits you.`,
    caution: 'A pattern in your own logs, not proof of cause.',
  };
}
