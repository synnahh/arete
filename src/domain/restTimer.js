// restTimer.js — the rest timer as plain data, so it survives a refresh, a closed app and a phone
// in a pocket. Nothing counts down in the background: the timer stores when the rest ends
// (`until`, epoch ms) and the screen works out what is left from the clock each time it draws.
// So the time shown is right after the app was backgrounded or reopened, on every platform.
//
// state: { until, total, pausedLeft, startedAt } or null when no rest is running.
//   until       epoch ms when the rest ends (null while paused)
//   total       planned length in seconds (for the ring)
//   pausedLeft  ms that were left when paused (null while running)

export const REST_KEY = 'arete_rest_timer';
export const LOW_SECONDS = 10;

export const start = (seconds, now = Date.now()) => ({ until: now + seconds * 1000, total: seconds, pausedLeft: null, startedAt: now });

/** Milliseconds left (0 when done); a paused timer keeps what it had. */
export function remainingMs(s, now = Date.now()) {
  if (!s) return 0;
  if (s.pausedLeft != null) return Math.max(0, s.pausedLeft);
  return Math.max(0, (s.until ?? 0) - now);
}
export const remaining = (s, now) => Math.ceil(remainingMs(s, now) / 1000);
export const isPaused = (s) => !!s && s.pausedLeft != null;
export const isDone = (s, now) => !!s && !isPaused(s) && remainingMs(s, now) <= 0;
export const isLow = (s, now) => !!s && !isDone(s, now) && remaining(s, now) <= LOW_SECONDS;
/** Share of the rest still to go, 0..1 (drives the ring). */
export const fraction = (s, now) => (s && s.total ? Math.max(0, Math.min(1, remainingMs(s, now) / (s.total * 1000))) : 0);

export function pause(s, now = Date.now()) {
  if (!s || isPaused(s)) return s;
  return { ...s, pausedLeft: remainingMs(s, now), until: null };
}
export function resume(s, now = Date.now()) {
  if (!isPaused(s)) return s;
  return { ...s, until: now + s.pausedLeft, pausedLeft: null };
}
/** Add (or take away) seconds; never below one second left. The ring's total grows with it. */
export function add(s, seconds, now = Date.now()) {
  if (!s) return s;
  const left = Math.max(1000, remainingMs(s, now) + seconds * 1000);
  const total = Math.max(1, Math.round(Math.max(s.total + seconds, left / 1000)));
  return isPaused(s) ? { ...s, pausedLeft: left, total } : { ...s, until: now + left, total };
}
/** Start the same rest again from the top. */
export const reset = (s, now = Date.now()) => (s ? start(s.total, now) : s);

export function load(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage?.getItem(REST_KEY) || 'null');
    if (!v || typeof v.total !== 'number') return null;
    // A rest that ended more than ten minutes ago is history, not a timer.
    if (v.pausedLeft == null && Date.now() - v.until > 10 * 60 * 1000) return null;
    return v;
  } catch { return null; }
}
export function save(s, storage = globalThis.localStorage) {
  try { if (s) storage?.setItem(REST_KEY, JSON.stringify(s)); else storage?.removeItem(REST_KEY); } catch { /* storage blocked */ }
}

/** "1:05" */
export const fmt = (sec) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`;
