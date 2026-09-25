// localDate.js — calendar-day keys in the user's LOCAL timezone.
//
// Why this exists: the app previously derived "today" with
//   new Date().toISOString().split('T')[0]
// which is the UTC date. East of UTC (e.g. Australia, UTC+10/+11) that is
// yesterday's date every morning until 10–11am, and `new Date(y, m, 1)` turned
// into the previous month's last day. Every day-keyed record (logs, streaks,
// reminders, budgets) inherited the error.
//
// Rule: a stored `date` / `YYYY-MM-DD` value always means a LOCAL calendar day.
// Deliberate pure-UTC date arithmetic (Date.UTC + setUTC* + toISOString) is
// still correct and is intentionally left alone where it exists.

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' for the local calendar day of `d` (default: now). */
export function toLocalDateKey(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's local key. */
export const todayLocalKey = () => toLocalDateKey(new Date());

/** Parse 'YYYY-MM-DD' as LOCAL midnight (not UTC, which `new Date(str)` does). */
export function parseLocalDateKey(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Local key `days` away from `key` (or from today). Calendar-safe across DST. */
export function addDaysLocal(key, days) {
  const base = key ? parseLocalDateKey(key) : new Date();
  if (!base) return '';
  base.setDate(base.getDate() + days);
  return toLocalDateKey(base);
}

/**
 * Local day key of a stored value that may be either a day key ('YYYY-MM-DD')
 * or a full timestamp (ISO string / epoch ms). Timestamps are converted to the
 * local day; comparing a timestamp's UTC prefix to a local key is wrong.
 */
export function localDayOf(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return toLocalDateKey(new Date(value));
}

/** True when a stored day key or timestamp falls on local day `key`. */
export const isOnLocalDay = (value, key) => !!value && localDayOf(value) === key;
