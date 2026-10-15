// pushSchedule.js — the reminder schedule shared by the app (editing it) and the push-send
// edge function (deciding what is due). Pure JavaScript with no Deno or browser APIs so both can
// import it. Times are wall-clock times in the user's own time zone (`tz`).
//
// A schedule: { enabled, tz, quiet: { on, from, to }, items: [{ id, label, time, days, on, title, body, tab }] }
//   time  "HH:MM" 24 h        days  [0..6] with 0 = Sunday     tab  screen opened when tapped
//   quiet hours hold back anything whose time falls inside them (they can wrap midnight).

export const MAX_ITEMS = 20;
export const WINDOW_MIN = 10; // an item is still due this many minutes after its time (a missed cron run is caught up)
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export const DEFAULT_PUSH = {
  enabled: false,
  tz: 'Australia/Sydney',
  quiet: { on: true, from: '22:00', to: '06:30' },
  items: [
    { id: 'plan',   label: 'Morning plan',   time: '07:30', days: ALL_DAYS,       on: true,  title: 'Today',          body: "Check today's session, calories and water.", tab: 'dashboard' },
    { id: 'water',  label: 'Water',          time: '12:30', days: ALL_DAYS,       on: true,  title: 'Water',          body: 'Halfway through the day. Log your water.',   tab: 'fuel' },
    { id: 'train',  label: 'Training',       time: '17:00', days: [1, 2, 3, 4, 5], on: false, title: 'Training',       body: 'Session time. Open Train.',                 tab: 'workout' },
    { id: 'food',   label: 'Log your food',  time: '19:30', days: ALL_DAYS,       on: true,  title: 'Log your food',  body: 'Log dinner and any snacks.',                tab: 'fuel' },
    { id: 'sleep',  label: 'Wind down',      time: '21:30', days: ALL_DAYS,       on: true,  title: 'Wind down',      body: 'Screens off soon. Aim for bed by 22:30.',   tab: 'recover' },
    { id: 'weigh',  label: 'Weekly check-in', time: '07:00', days: [1],           on: true,  title: 'Weekly check-in', body: 'Weigh in and take your photos.',           tab: 'body' },
  ],
};

export const validTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
const minutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

const cleanDays = (d) => {
  const out = [...new Set((Array.isArray(d) ? d : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
  return out.length ? out : ALL_DAYS;
};
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

/** A schedule that is always safe to use: bad times dropped, text trimmed, ids unique, at most MAX_ITEMS. */
export function cleanPush(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const seen = new Set();
  const items = (Array.isArray(r.items) ? r.items : DEFAULT_PUSH.items).slice(0, MAX_ITEMS).map((it, i) => {
    if (!it || !validTime(it.time)) return null;
    let id = slug(it.id) || `r${i + 1}`;
    while (seen.has(id)) id = `${id}-${i}`;
    seen.add(id);
    const title = String(it.title ?? '').trim().slice(0, 60);
    const body = String(it.body ?? '').trim().slice(0, 160);
    if (!title && !body) return null;
    return { id, label: String(it.label || title || id).trim().slice(0, 40), time: it.time, days: cleanDays(it.days), on: it.on !== false, title: title || 'Arete', body, tab: String(it.tab || 'dashboard').slice(0, 24) };
  }).filter(Boolean);
  const q = r.quiet && typeof r.quiet === 'object' ? r.quiet : {};
  return {
    enabled: r.enabled === true,
    tz: typeof r.tz === 'string' && r.tz.length < 60 ? r.tz : DEFAULT_PUSH.tz,
    quiet: { on: q.on !== false, from: validTime(q.from) ? q.from : DEFAULT_PUSH.quiet.from, to: validTime(q.to) ? q.to : DEFAULT_PUSH.quiet.to },
    items,
  };
}

/** Is `hhmm` inside quiet hours? Handles a window that wraps midnight (22:00 to 06:30). */
export function inQuiet(quiet, hhmm) {
  if (!quiet?.on || !validTime(hhmm)) return false;
  const a = minutes(quiet.from), b = minutes(quiet.to), t = minutes(hhmm);
  if (a === b) return false;
  return a < b ? t >= a && t < b : t >= a || t < b;
}

/** Local weekday, "HH:MM" and "YYYY-MM-DD" for an instant in a time zone. Falls back to UTC for an unknown zone. */
export function localParts(instant, tz) {
  const d = instant instanceof Date ? instant : new Date(instant);
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d);
  } catch {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d);
  }
  const get = (t) => parts.find(p => p.type === t)?.value || '';
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { dow, hhmm: `${get('hour')}:${get('minute')}`, date: `${get('year')}-${get('month')}-${get('day')}` };
}

/**
 * Items due right now. `sent` is { date, ids } for the local day already served, so a reminder is never
 * sent twice in a day. Returns the items to send (not yet marked as sent).
 */
export function dueItems(push, now, sent = null) {
  const p = cleanPush(push);
  if (!p.enabled) return [];
  const { dow, hhmm, date } = localParts(now, p.tz);
  const nowMin = minutes(hhmm);
  const done = sent && sent.date === date && Array.isArray(sent.ids) ? sent.ids : [];
  return p.items.filter(it => {
    if (!it.on || !it.days.includes(dow) || done.includes(it.id)) return false;
    const late = nowMin - minutes(it.time);
    if (late < 0 || late >= WINDOW_MIN) return false;
    return !inQuiet(p.quiet, it.time);
  });
}

/** The sent-today record after sending `items` (resets on a new local day). */
export function markSent(push, now, sent, items) {
  const { date } = localParts(now, cleanPush(push).tz);
  const ids = sent && sent.date === date && Array.isArray(sent.ids) ? sent.ids : [];
  return { date, ids: [...new Set([...ids, ...items.map(i => i.id)])] };
}

/** The notification payload the service worker shows (sw-push.js: title, body, tag, url). */
export function payloadFor(item) {
  return { title: item.title, body: item.body, tag: `arete-${item.id}`, url: `/?go=${encodeURIComponent(item.tab || 'dashboard')}` };
}
