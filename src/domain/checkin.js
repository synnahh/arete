// checkin.js — progress numbers and the weekly check-in. Pure.
//
// A check-in is one weigh-in saved with source 'check-in' (plus up to three photos).
// Progress tiles compare your starting weight with now. Both read the same
// body_metrics rows the rest of the app uses, so a scale reading from Apple Health
// counts as a weigh-in but only a check-in resets the weekly reminder.

const DAY = 86400000;
const dayMs = (key) => { const [y, m, d] = String(key).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const weightOf = (r) => { const w = Number(r?.weight); return w > 20 && w < 400 ? w : null; };
const r1 = (n) => Math.round(n * 10) / 10;

/** The weigh-ins by date, one value per day (the average when there are several), oldest first. */
export function dailyWeights(body = []) {
  const by = new Map();
  for (const r of body) {
    const w = weightOf(r);
    if (w == null || !/^\d{4}-\d{2}-\d{2}$/.test(String(r?.date))) continue;
    const c = by.get(r.date) || { sum: 0, n: 0 };
    c.sum += w; c.n += 1; by.set(r.date, c);
  }
  return [...by.entries()].map(([date, c]) => ({ date, weight: r1(c.sum / c.n) })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Start, now, lost, gained and the week number.
 * Start = the goal's starting weight when set, else the first weigh-in. The week number
 * counts from the goal's start date (or the first weigh-in), week 1 being the first 7 days.
 */
export function progressTiles(body = [], goal = null, today) {
  const days = dailyWeights(body);
  if (!days.length) return null;
  const first = days[0], last = days[days.length - 1];
  const startKg = Number(goal?.startWeightKg) > 0 ? Number(goal.startWeightKg) : first.weight;
  const startDate = goal?.startedOn || first.date;
  const diff = r1(last.weight - startKg);
  const week = today ? Math.max(1, Math.floor((dayMs(today) - dayMs(startDate)) / (7 * DAY)) + 1) : null;
  return {
    startKg: r1(startKg), currentKg: last.weight, lastDate: last.date,
    lostKg: diff < 0 ? -diff : 0, gainedKg: diff > 0 ? diff : 0, changeKg: diff, week,
    toGoalKg: Number(goal?.targetWeightKg) > 0 ? r1(Number(goal.targetWeightKg) - last.weight) : null,
  };
}

/** When the last check-in was, how long ago, and whether another is due (7 days, or none yet). */
export function checkInStatus(body = [], today) {
  const dates = body.filter(r => r?.source === 'check-in' && /^\d{4}-\d{2}-\d{2}$/.test(String(r.date))).map(r => r.date).sort();
  const last = dates[dates.length - 1] ?? null;
  const since = last ? Math.round((dayMs(today) - dayMs(last)) / DAY) : null;
  return { last, daysSince: since, due: last == null || since >= 7, count: new Set(dates).size };
}

/** The weigh-in a check-in on `date` should be compared with: the most recent earlier check-in, else the earlier weigh-in. */
export function previousCheckIn(body = [], date) {
  const earlier = body.filter(r => weightOf(r) != null && String(r.date) < date);
  const pick = (rows) => rows.sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  return pick(earlier.filter(r => r.source === 'check-in')) || pick(earlier);
}

/** A body_metrics row for a check-in, or null when the weight is not a plausible number. */
export function checkInRow({ date, weight, waist = null }) {
  const w = Number(weight);
  if (!(w > 20 && w < 400) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return null;
  const row = { date, weight: r1(w), source: 'check-in' };
  const c = Number(waist);
  if (waist !== '' && waist != null && c >= 40 && c <= 200) row.waist = r1(c);   // cm, optional
  return row;
}
