// metrics.js — turn everything the body and the phone report into a list of metric tiles. Pure.
//
// Sources: health_sync rows (one per day: steps, heart rate, HRV ... plus `more`, every other
// metric Health Auto Export sends, so a new reading from the Fitbit or the scale shows up with no
// code change), body_metrics (weight, body fat, muscle) and sleep_data. Only metrics that have at
// least one reading come back, so the card grows by itself as data starts to arrive.

const num = (v) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);

// better: which direction is good news ('up', 'down'), or null when neither is (just show the change).
export const KNOWN = [
  { id: 'steps',            label: 'Steps',              unit: '',     digits: 0, group: 'Activity',  better: 'up',   health: 'steps' },
  { id: 'activeEnergy',     label: 'Active energy',      unit: 'kcal', digits: 0, group: 'Activity',  better: 'up',   health: 'activeEnergy' },
  { id: 'restingHeartRate', label: 'Resting heart rate', unit: 'bpm',  digits: 0, group: 'Heart',     better: 'down', health: 'restingHeartRate' },
  { id: 'heartRate',        label: 'Heart rate',         unit: 'bpm',  digits: 0, group: 'Heart',     better: null,   health: (d) => d.heartRate?.avg ?? (typeof d.heartRate === 'number' ? d.heartRate : null) },
  { id: 'hrv',              label: 'HRV',                unit: 'ms',   digits: 0, group: 'Heart',     better: 'up',   health: 'hrv' },
  { id: 'bloodOxygen',      label: 'Blood oxygen',       unit: '%',    digits: 1, group: 'Heart',     better: 'up',   health: 'bloodOxygen' },
  { id: 'respiratoryRate',  label: 'Breathing rate',     unit: '/min', digits: 1, group: 'Heart',     better: null,   health: 'respiratoryRate' },
  { id: 'weight',           label: 'Weight',             unit: 'kg',   digits: 1, group: 'Body',      better: null,   body: 'weight' },
  { id: 'bodyFat',          label: 'Body fat',           unit: '%',    digits: 1, group: 'Body',      better: 'down', body: 'bodyFat' },
  { id: 'muscle',           label: 'Muscle mass',        unit: 'kg',   digits: 1, group: 'Body',      better: 'up',   body: 'muscle' },
  { id: 'sleepHours',       label: 'Sleep',              unit: 'h',    digits: 1, group: 'Recovery',  better: 'up',   sleep: (r) => (num(r.duration) != null ? num(r.duration) / 60 : null) },
  { id: 'sleepEfficiency',  label: 'Sleep efficiency',   unit: '%',    digits: 0, group: 'Recovery',  better: 'up',   sleep: (r) => num(r.efficiency) },
];

export const GROUP_ORDER = ['Activity', 'Heart', 'Recovery', 'Body', 'Other'];

/** "walking_running_distance" or "walkingRunningDistance" -> "Walking running distance". */
export function prettyName(key) {
  const spaced = String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const round = (v, d) => { const f = 10 ** d; return Math.round(v * f) / f; };
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** One reading per day from a list of { date, value }: several on a day are averaged. */
function perDay(points) {
  const by = new Map();
  for (const p of points) {
    if (!p.date || p.value == null) continue;
    (by.get(p.date) || by.set(p.date, []).get(p.date)).push(p.value);
  }
  return [...by.entries()].map(([date, xs]) => ({ date, v: mean(xs) })).sort((a, b) => a.date.localeCompare(b.date));
}

const dayDiff = (a, b) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000);

function shape(def, points, today) {
  const series = perDay(points).slice(-14);
  if (!series.length) return null;
  const last = series[series.length - 1];
  const before = series.slice(0, -1).slice(-7);
  const base = before.length ? mean(before.map(p => p.v)) : null;
  const change = base != null ? last.v - base : null;
  const tiny = change != null && Math.abs(change) < Math.max(Math.abs(base) * 0.01, 10 ** -def.digits / 2);
  let tone = 'flat';
  if (change != null && !tiny && def.better) tone = (change > 0) === (def.better === 'up') ? 'good' : 'warn';
  return {
    id: def.id, label: def.label, unit: def.unit, group: def.group, digits: def.digits,
    value: round(last.v, def.digits), date: last.date,
    daysAgo: today ? Math.max(0, dayDiff(today, last.date)) : 0,
    change: change == null || tiny ? 0 : round(change, def.digits === 0 ? 0 : def.digits),
    hasChange: change != null,
    tone, series: series.map(p => ({ date: p.date, v: round(p.v, Math.max(def.digits, 1)) })),
  };
}

/**
 * @param {object} src
 * @param {Array<{date:string,data:object}>} src.health  health_sync rows ({ date, data })
 * @param {object[]} src.body   body_metrics items
 * @param {object[]} src.sleep  sleep_data items
 * @param {string}   src.today  local day key
 * @returns {object[]} tiles, grouped order, each { id, label, unit, group, value, date, daysAgo, change, tone, series }
 */
export function buildMetrics({ health = [], body = [], sleep = [], today = null } = {}) {
  const tiles = [];
  const knownHealthKeys = new Set();

  for (const def of KNOWN) {
    let pts = [];
    if (def.health) {
      const pick = typeof def.health === 'function' ? def.health : (d) => d[def.health];
      if (typeof def.health === 'string') knownHealthKeys.add(def.health);
      pts = health.map(r => ({ date: r.date, value: num(pick(r.data || {})) }));
    } else if (def.body) {
      pts = body.map(r => ({ date: r.date, value: num(r[def.body]) }));
    } else if (def.sleep) {
      pts = sleep.map(r => ({ date: r.date, value: def.sleep(r) }));
    }
    // A weight of 0 or a blank is "not measured", not a reading.
    if (def.id === 'weight' || def.id === 'bodyFat' || def.id === 'muscle') pts = pts.filter(p => p.value > 0);
    const t = shape(def, pts, today);
    if (t) tiles.push(t);
  }
  knownHealthKeys.add('heartRate');

  // Everything else the phone sent: data.more = { name: { v, u } }, plus any stray numeric top-level key.
  const extras = new Map();
  for (const r of health) {
    const d = r.data || {};
    for (const [name, m] of Object.entries(d.more || {})) {
      const v = num(m?.v);
      if (v == null) continue;
      const e = extras.get(name) || { unit: m?.u || '', pts: [] };
      e.pts.push({ date: r.date, value: v });
      extras.set(name, e);
    }
    for (const [name, raw] of Object.entries(d)) {
      if (knownHealthKeys.has(name) || name === 'more' || name.startsWith('_')) continue;
      const v = typeof raw === 'number' ? raw : null;
      if (v == null) continue;
      const e = extras.get(name) || { unit: '', pts: [] };
      e.pts.push({ date: r.date, value: v });
      extras.set(name, e);
    }
  }
  for (const [name, e] of extras) {
    const digits = e.pts.every(p => Number.isInteger(p.value)) ? 0 : 1;
    const t = shape({ id: `x:${name}`, label: prettyName(name), unit: e.unit, digits, group: 'Other', better: null }, e.pts, today);
    if (t) tiles.push(t);
  }

  return tiles.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
}

/** Format a tile's number for display: thousands separators for big whole numbers. */
export function formatMetric(t) {
  if (t == null || t.value == null) return '';
  return t.digits === 0 ? Math.round(t.value).toLocaleString('en-AU') : t.value.toFixed(t.digits);
}

/** "today", "yesterday", "3 days ago" for how old a tile's last reading is. */
export function freshness(daysAgo) {
  if (!(daysAgo > 0)) return 'today';
  if (daysAgo === 1) return 'yesterday';
  return `${daysAgo} days ago`;
}

// ── Which metrics to show ────────────────────────────────────────────────────
// settings.home.metrics is an ordered list of metric ids. Until you choose, Home shows the first
// few of DEFAULT_METRICS that have a reading, so it is never a wall of tiles.

export const DEFAULT_METRICS = ['steps', 'sleepHours', 'weight', 'restingHeartRate', 'hrv', 'activeEnergy'];

/** The saved list (no repeats, strings only) or null when you have not chosen yet. */
export function cleanMetricChoice(raw) {
  if (!Array.isArray(raw)) return null;
  return [...new Set(raw.filter(id => typeof id === 'string' && id))];
}

/** Tiles to display, in your order. Ids with no reading yet are skipped, not shown empty. */
export function pickTiles(tiles, chosen) {
  const by = new Map(tiles.map(t => [t.id, t]));
  const ids = chosen ?? DEFAULT_METRICS;
  return ids.map(id => by.get(id)).filter(Boolean);
}

/** Add (at the end) or remove one metric. Starting from the default list when nothing was chosen yet. */
export function toggleMetric(chosen, id, on) {
  const cur = chosen ?? DEFAULT_METRICS;
  if (on) return cur.includes(id) ? cur : [...cur, id];
  return cur.filter(x => x !== id);
}

/** Move a chosen metric up (-1) or down (+1). */
export function moveMetric(chosen, id, delta) {
  const cur = chosen ?? DEFAULT_METRICS;
  const i = cur.indexOf(id), j = i + delta;
  if (i < 0 || j < 0 || j >= cur.length) return cur;
  const out = [...cur];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
