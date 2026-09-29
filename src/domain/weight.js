// weight.js — the weight coach: a smoothed trend (daily weigh-ins bounce ±1 kg
// with water and food, the trend doesn't), the weekly rate of change, and
// whether that pace matches the Coach goal. Pure functions.
//
// body_metrics rows: { date: 'YYYY-MM-DD', weight } — weight may be a string
// (it comes from a form input), so everything coerces.

const DAY = 86400000;
const dayIndex = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
};

/**
 * Ascending series with an exponentially smoothed trend. The smoothing is
 * corrected for gaps: after a week without a weigh-in the new reading counts
 * for more than after a day. Several readings on one day are averaged.
 */
export function trendSeries(entries = [], { alpha = 0.1 } = {}) {
  const byDay = new Map();
  for (const e of entries) {
    const w = Number(e?.weight);
    if (!e?.date || !(w > 20 && w < 400)) continue; // ignore blanks and typos like 8 or 800
    const cur = byDay.get(e.date) || { sum: 0, n: 0 };
    cur.sum += w; cur.n += 1;
    byDay.set(e.date, cur);
  }
  const days = [...byDay.entries()]
    .map(([date, { sum, n }]) => ({ date, weight: +(sum / n).toFixed(2) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let trend = null, prevDay = null;
  return days.map(d => {
    const idx = dayIndex(d.date);
    if (trend === null) trend = d.weight;
    else trend += (1 - Math.pow(1 - alpha, Math.max(1, idx - prevDay))) * (d.weight - trend);
    prevDay = idx;
    return { ...d, trend: +trend.toFixed(2) };
  });
}

/**
 * Change in the trend in kg per week over the last `windowDays`, by least
 * squares. Needs 3+ readings spanning at least a week, otherwise null.
 */
export function weeklyRate(series, { windowDays = 21 } = {}) {
  if (!series.length) return null;
  const end = dayIndex(series[series.length - 1].date);
  const pts = series.map(p => ({ x: dayIndex(p.date), y: p.trend })).filter(p => p.x > end - windowDays);
  if (pts.length < 3) return null;
  const span = pts[pts.length - 1].x - pts[0].x;
  if (span < 7) return null;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (!sxx) return null;
  const slope = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx; // kg/day
  return +(slope * 7).toFixed(2);
}

/**
 * Is the pace right for the goal? `target` is the goal's weekly change in kg
 * (negative for a cut, 0 for recomp). Returns { status, message } or null
 * when the rate is unknown.
 */
export function paceVsGoal(rate, target) {
  if (rate == null || target == null) return null;
  const fmt = (n) => `${n > 0 ? '+' : ''}${n} kg/week`;
  if (Math.abs(target) < 0.05) {
    return Math.abs(rate) <= 0.15
      ? { status: 'on-track', message: `Holding steady (${fmt(rate)}), as planned.` }
      : { status: 'too-fast', message: `Trending ${fmt(rate)} while aiming to hold weight. Check intake against your target.` };
  }
  const ratio = rate / target;
  if (ratio <= 0) return { status: 'wrong-way', message: `Trending ${fmt(rate)} but the goal is ${fmt(target)}. Intake is likely off target.` };
  if (ratio < 0.6) return { status: 'too-slow', message: `${fmt(rate)} against a goal of ${fmt(target)}. Progress is slower than planned.` };
  if (ratio > 1.5) return { status: 'too-fast', message: `${fmt(rate)} against a goal of ${fmt(target)}. That's faster than planned${target < 0 ? ' and can cost muscle' : ''}.` };
  return { status: 'on-track', message: `${fmt(rate)} against a goal of ${fmt(target)}. On track.` };
}

const MAX_ETA_WEEKS = 104;
const keyOfDay = (idx) => new Date(idx * DAY).toISOString().slice(0, 10);

/**
 * When will the trend reach the goal weight at the current rate?
 * status: 'reached' (within 0.3 kg), 'on-course' (with weeks and date),
 * 'too-slow' (more than two years out), 'off-course' (flat or moving the
 * wrong way), or 'unknown' (no rate yet). Never a promise: the rate changes.
 */
export function goalEta(trend, rate, targetKg, today) {
  const target = Number(targetKg);
  if (!(target > 0) || !Number.isFinite(trend)) return null;
  const toGo = +(target - trend).toFixed(1);
  if (Math.abs(toGo) < 0.3) return { status: 'reached', toGo: 0 };
  if (rate == null) return { status: 'unknown', toGo };
  if (Math.abs(rate) < 0.05 || rate * toGo < 0) return { status: 'off-course', toGo };
  const weeks = Math.abs(toGo / rate);
  if (weeks > MAX_ETA_WEEKS) return { status: 'too-slow', toGo, weeks: Math.round(weeks) };
  return { status: 'on-course', toGo, weeks: Math.max(1, Math.round(weeks)), date: keyOfDay(Math.round(dayIndex(today) + weeks * 7)) };
}

/** Everything the UI needs in one call. */
export function weightCoach(entries, goalTargetKgPerWeek = null, targetWeightKg = null, today = null) {
  const series = trendSeries(entries);
  if (!series.length) return null;
  const last = series[series.length - 1];
  const rate = weeklyRate(series);
  return {
    series, latest: last.weight, trend: last.trend, rate, pace: paceVsGoal(rate, goalTargetKgPerWeek),
    eta: targetWeightKg && today ? goalEta(last.trend, rate, targetWeightKg, today) : null,
  };
}
