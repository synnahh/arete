// Day arithmetic on local 'YYYY-MM-DD' keys, free of time zones and DST: a key
// maps to a whole number of days since 1970-01-01 (UTC midnight of that date)
// and back. Bad or impossible dates (2026-02-31, 2026-13-05, "soon") give null,
// so callers can skip the row instead of computing with garbage.

const DAY = 86400000;
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Whole days since the epoch for a 'YYYY-MM-DD' key, or null if it is not a real date. */
export function dayIndex(key) {
  if (!KEY_RE.test(String(key))) return null;
  const [y, m, d] = String(key).split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  // Date.UTC rolls impossible dates over (Feb 31 -> Mar 3, month 13 -> next January): read it back.
  return new Date(t).toISOString().slice(0, 10) === key ? t / DAY : null;
}

/** The 'YYYY-MM-DD' key for a day index. */
export function keyOfDay(idx) {
  return Number.isFinite(idx) ? new Date(idx * DAY).toISOString().slice(0, 10) : null;
}
