// Pure mapping from a Health Auto Export REST payload to what Arete stores.
// Plain JS (no Deno or Node APIs) so the edge function and the unit tests share it.
//
// Payload: { data: { metrics: [ { name, units, data: [ { date, qty, source, ... } ] } ] } }
// `date` looks like "2026-10-02 07:15:00 +1000": its first ten characters are the
// phone's own local day, which is the day the app files things under.

const LB_TO_KG = 0.45359237;
const ST_TO_KG = 6.35029318;

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};

const dayOf = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
const timeOf = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}[ T](\d{2}:\d{2})/.exec(s)?.[1]) || null;
const round = (n, d = 1) => (n == null ? null : +n.toFixed(d));

export function toKg(qty, units) {
  const q = num(qty);
  if (q == null) return null;
  const u = String(units || 'kg').toLowerCase();
  if (u === 'lb' || u === 'lbs') return q * LB_TO_KG;
  if (u === 'st') return q * ST_TO_KG;
  if (u === 'g') return q / 1000;
  return q;
}

// Health Auto Export sends percentages as 0-100 for most metrics but as a 0-1
// fraction for some versions/sources. Anything at or below 1 is a fraction.
const percent = (q) => {
  const n = num(q);
  if (n == null) return null;
  return n > 0 && n <= 1 ? n * 100 : n;
};

const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

function perDay(samples, pick) {
  const out = {};
  for (const s of samples || []) {
    const day = dayOf(s?.date);
    const v = pick(s);
    if (!day || v == null) continue;
    (out[day] ||= []).push(v);
  }
  return out;
}

/**
 * @returns {{ days: Record<string, object>, weights: object[], sleep: object[] }}
 *   days     per local day: steps, activeEnergy, heartRate{avg,min,max}, restingHeartRate,
 *            hrv, respiratoryRate, bloodOxygen (only the keys present)
 *   weights  one entry per weigh-in: { key, date, time, weight(kg), bodyFat? }
 *   sleep    one entry per night: { date, duration(min), efficiency?, bedTime?, wakeTime?, stages }
 */
export function mapHealthExport(payload) {
  const metrics = Array.isArray(payload?.data?.metrics) ? payload.data.metrics : [];
  const byName = {};
  for (const m of metrics) if (m?.name) byName[m.name] = m;

  const days = {};
  const set = (day, key, value) => {
    if (value == null) return;
    (days[day] ||= {})[key] = value;
  };

  const sumMetric = (name, key, digits = 0) => {
    const m = byName[name];
    if (!m) return;
    const sums = perDay(m.data, (s) => num(s.qty));
    for (const [day, xs] of Object.entries(sums)) set(day, key, round(xs.reduce((a, b) => a + b, 0), digits));
  };
  const avgMetric = (name, key, digits = 0, pick = (s) => num(s.qty), transform = (v) => v) => {
    const m = byName[name];
    if (!m) return;
    const vals = perDay(m.data, (s) => { const v = pick(s); return v == null ? null : transform(v); });
    for (const [day, xs] of Object.entries(vals)) set(day, key, round(avg(xs), digits));
  };

  sumMetric('step_count', 'steps');
  sumMetric('active_energy', 'activeEnergy');
  avgMetric('resting_heart_rate', 'restingHeartRate');
  avgMetric('heart_rate_variability', 'hrv');
  avgMetric('respiratory_rate', 'respiratoryRate', 1);
  avgMetric('blood_oxygen_saturation', 'bloodOxygen', 1, (s) => num(s.qty), percent);

  // Every other numeric metric (distance, flights, exercise minutes, VO2 max, wrist temperature,
  // anything the Fitbit or the scale adds later) is kept per day under `more`, so the Home metrics
  // card shows it without a code change. Totals that add up through a day are summed, the rest averaged.
  const HANDLED = new Set(['step_count', 'active_energy', 'resting_heart_rate', 'heart_rate_variability', 'respiratory_rate',
    'blood_oxygen_saturation', 'heart_rate', 'weight_body_mass', 'body_mass', 'body_fat_percentage', 'sleep_analysis']);
  const CUMULATIVE = /distance|flights|exercise_time|stand_time|basal_energy|daylight|move_time|swimming_stroke|calories_burned/;
  for (const [name, m] of Object.entries(byName)) {
    if (HANDLED.has(name) || !/^[a-z0-9_]{1,60}$/i.test(name)) continue;
    const vals = perDay(m.data, (s) => num(s.qty ?? s.Avg ?? s.avg));
    for (const [day, xs] of Object.entries(vals)) {
      const v = CUMULATIVE.test(name) ? xs.reduce((a, b) => a + b, 0) : avg(xs);
      ((days[day] ||= {}).more ||= {})[name] = { v: round(v, 2), u: typeof m.units === 'string' ? m.units.slice(0, 16) : '' };
    }
  }

  const hr = byName.heart_rate;
  if (hr) {
    const rows = {};
    for (const s of hr.data || []) {
      const day = dayOf(s?.date);
      if (!day) continue;
      const a = num(s.Avg ?? s.avg ?? s.qty);
      const lo = num(s.Min ?? s.min ?? s.qty);
      const hi = num(s.Max ?? s.max ?? s.qty);
      if (a == null && lo == null && hi == null) continue;
      const r = (rows[day] ||= { avg: [], min: [], max: [] });
      if (a != null) r.avg.push(a);
      if (lo != null) r.min.push(lo);
      if (hi != null) r.max.push(hi);
    }
    for (const [day, r] of Object.entries(rows)) {
      set(day, 'heartRate', {
        avg: round(avg(r.avg)),
        min: r.min.length ? Math.round(Math.min(...r.min)) : null,
        max: r.max.length ? Math.round(Math.max(...r.max)) : null,
      });
    }
  }

  // Weigh-ins: every reading is kept (the app averages several on one day).
  // Body fat is attached to the weigh-in taken at the same minute, which is how
  // a smart scale writes them (same timestamp).
  const weights = [];
  const wm = byName.weight_body_mass || byName.body_mass;
  const fatByStamp = new Map();
  const fm = byName.body_fat_percentage;
  for (const s of fm?.data || []) {
    const p = percent(s.qty);
    if (p != null && s.date) fatByStamp.set(String(s.date).slice(0, 16), +p.toFixed(1));
  }
  for (const s of wm?.data || []) {
    const day = dayOf(s.date);
    const kg = toKg(s.qty, wm.units);
    if (!day || kg == null || !(kg > 20 && kg < 400)) continue;
    const stamp = String(s.date).slice(0, 16);
    const w = { key: `ah:${String(s.date).slice(0, 19)}`, date: day, time: timeOf(s.date), weight: +kg.toFixed(2) };
    if (fatByStamp.has(stamp)) w.bodyFat = fatByStamp.get(stamp);
    weights.push(w);
  }

  const sleep = [];
  const sm = byName.sleep_analysis;
  for (const s of sm?.data || []) {
    const day = dayOf(s.date) || dayOf(s.sleepEnd);
    if (!day) continue;
    const stagesH = {
      deep: num(s.deep), rem: num(s.rem), core: num(s.core), awake: num(s.awake),
    };
    const staged = (stagesH.deep || 0) + (stagesH.rem || 0) + (stagesH.core || 0);
    const asleepH = num(s.asleep) ?? num(s.totalSleep) ?? (staged > 0 ? staged : null);
    if (!(asleepH > 0)) continue;
    const inBedH = num(s.inBed);
    const toMin = (h) => (h == null ? null : Math.round(h * 60));
    sleep.push({
      date: day,
      duration: Math.round(asleepH * 60),
      efficiency: inBedH > 0 ? Math.min(100, Math.round((asleepH / inBedH) * 100)) : null,
      bedTime: timeOf(s.sleepStart),
      wakeTime: timeOf(s.sleepEnd),
      stages: { deep: toMin(stagesH.deep), rem: toMin(stagesH.rem), core: toMin(stagesH.core), awake: toMin(stagesH.awake) },
    });
  }

  return { days, weights, sleep };
}

// Constant-time string compare, so the shared secret cannot be guessed byte by byte.
export function safeEqual(a, b) {
  const x = String(a ?? ''), y = String(b ?? '');
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}
