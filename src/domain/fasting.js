// fasting.js — an intermittent-fasting timer. Pure functions; the card is
// components/FastingCard.jsx and the state lives in settings (so it syncs):
//   settings.fast    = { startedAt: ISO string, targetHours }   (only while fasting)
//   settings.fastLog = [{ start, end, hours, targetHours, completed }]   (newest last, capped)
// It only measures time you chose to fast. It gives no medical advice; the
// card carries a short "not for everyone" line.

export const PROTOCOLS = [
  { hours: 14, label: '14:10' },
  { hours: 16, label: '16:8' },
  { hours: 18, label: '18:6' },
  { hours: 20, label: '20:4' },
];
export const MIN_TARGET_H = 4;
export const MAX_TARGET_H = 48;
const LOG_CAP = 60;
const HOUR = 3600000;

const validDate = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? t : null; };

/** A fast that starts at `now` (ms since epoch or Date), target clamped to 4-48 h. */
export function startFast(targetHours, now = Date.now()) {
  const target = Math.min(MAX_TARGET_H, Math.max(MIN_TARGET_H, Math.round(Number(targetHours) || 16)));
  return { startedAt: new Date(now).toISOString(), targetHours: target };
}

/** Where the current fast stands, or null when not fasting / the state is corrupt. */
export function fastProgress(fast, now = Date.now()) {
  const start = validDate(fast?.startedAt);
  const target = Number(fast?.targetHours);
  if (start == null || !(target > 0)) return null;
  const elapsedMs = Math.max(0, now - start);
  const elapsedH = elapsedMs / HOUR;
  const pct = Math.min(1, elapsedH / target);
  return {
    elapsedH: +elapsedH.toFixed(2), targetHours: target, pct,
    remainingH: +Math.max(0, target - elapsedH).toFixed(2),
    done: elapsedH >= target,
    overH: +Math.max(0, elapsedH - target).toFixed(2),
    endsAt: new Date(start + target * HOUR).toISOString(),
  };
}

/** Close a fast into a log entry. Fasts under 15 minutes are treated as a mis-tap and not logged. */
export function endFast(fast, now = Date.now()) {
  const start = validDate(fast?.startedAt);
  if (start == null) return null;
  const hours = +((now - start) / HOUR).toFixed(2);
  if (hours < 0.25) return null;
  const target = Number(fast.targetHours) || 16;
  return { start: new Date(start).toISOString(), end: new Date(now).toISOString(), hours, targetHours: target, completed: hours >= target };
}

/** Append to the log, newest last, keeping the last 60. */
export function addToLog(log = [], entry) {
  if (!entry) return log;
  return [...log, entry].slice(-LOG_CAP);
}

/** Summary of the log: fasts completed of those started in the last `days`, the average length, and the current run of completed fasts. */
export function fastStats(log = [], now = Date.now(), days = 30) {
  const since = now - days * 24 * HOUR;
  const recent = log.filter(f => (validDate(f?.end) ?? 0) >= since);
  const completed = recent.filter(f => f.completed).length;
  let run = 0;
  for (let i = log.length - 1; i >= 0 && log[i]?.completed; i--) run += 1;
  return {
    count: recent.length, completed,
    avgHours: recent.length ? +(recent.reduce((s, f) => s + (Number(f.hours) || 0), 0) / recent.length).toFixed(1) : null,
    run,
  };
}

/** "13h 05m" for a duration in hours. */
export function formatHours(h) {
  const total = Math.max(0, Math.round(Number(h) * 60));
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
}
