// reminders.js — the coach's twice-a-day check-in. Pure: given the ranked
// "Next moves", the hour and what already fired today, say whether to nudge now
// and what to say. One message per slot, never a burst; the message is the top
// move plus how many others are waiting. Delivery (toast, push) is the caller's.
//
// cfg: { enabled, morning, evening } where morning/evening are local hours.

export const DEFAULT_COACH_REMINDERS = { enabled: true, morning: 8, evening: 19 };
const WAKING = [6, 22];        // never before 6 am or from 10 pm
const WINDOW_H = 3;            // a slot only fires within 3 hours of its time (no stale 8 am nudge at 6 pm)

const hourOf = (v, fallback) => (Number.isInteger(Number(v)) && Number(v) >= WAKING[0] && Number(v) < WAKING[1] ? Number(v) : fallback);

export function coachSlots(cfg = {}) {
  const c = { ...DEFAULT_COACH_REMINDERS, ...(cfg || {}) };
  return [
    { id: 'morning', hour: hourOf(c.morning, DEFAULT_COACH_REMINDERS.morning), lead: 'Today' },
    { id: 'evening', hour: hourOf(c.evening, DEFAULT_COACH_REMINDERS.evening), lead: 'Tonight' },
  ];
}

// How long after launch before the first check-in may be built: a couple of seconds once the
// data has synced, or a longer wait when it has not (offline, or a slow connection).
export const SYNCED_WAIT_MS = 2000;
export const UNSYNCED_WAIT_MS = 45000;

/** Milliseconds still to wait before nudging (0 = go ahead). */
export const waitBeforeNudge = ({ elapsedMs, synced }) => Math.max(0, (synced ? SYNCED_WAIT_MS : UNSYNCED_WAIT_MS) - Math.max(0, elapsedMs || 0));

/**
 * { slot, title, body, tab } for the reminder due now, or null.
 * `fired` is the list of slot ids already sent today.
 */
export function dueCoachReminder({ hour, moves = [], cfg = {}, fired = [] }) {
  const c = { ...DEFAULT_COACH_REMINDERS, ...(cfg || {}) };
  if (c.enabled === false || !Number.isFinite(hour) || hour < WAKING[0] || hour >= WAKING[1]) return null;
  if (!moves.length) return null;
  const slot = coachSlots(c).filter(s => hour >= s.hour && hour < s.hour + WINDOW_H && !fired.includes(s.id)).pop();
  if (!slot) return null;
  const [top, ...rest] = moves;
  return {
    slot: slot.id,
    title: `${slot.lead}: ${top.title}`,
    body: rest.length ? `${top.why} ${rest.length} more on your list.` : top.why,
    tab: top.tab,
  };
}
