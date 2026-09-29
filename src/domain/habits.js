// Habits: pure streak logic shared by the desktop and phone screens.
//
// A habit row: { name, icon, frequency, streak, lastCompleted, history, best }.
// `history` (sorted 'YYYY-MM-DD' keys the habit was done) is the source of
// truth. `streak` and `lastCompleted` are still written on every change because
// other screens (Today, Progress, notifications, XP) read them directly.
//
// Before this module the streak only ever counted up: a habit missed for a
// month kept its old streak. Now a streak is the run of consecutive days ending
// today (or yesterday, so it isn't shown as broken before you've had the day).

const DAY = 86400000;
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HISTORY_CAP = 180;

const dayIndex = (key) => {
  if (!KEY_RE.test(String(key))) return null;
  const [y, m, d] = key.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  return new Date(t).getUTCDate() === d ? t / DAY : null;
};
const keyOf = (idx) => new Date(idx * DAY).toISOString().slice(0, 10);

/**
 * Sorted, de-duplicated completion days. Habits saved before `history` existed
 * are backfilled from `lastCompleted` + `streak` (a run ending on that day).
 */
export function habitHistory(habit) {
  if (Array.isArray(habit?.history)) {
    return [...new Set(habit.history.filter(k => dayIndex(k) != null))].sort();
  }
  const end = dayIndex(habit?.lastCompleted);
  if (end == null) return [];
  const n = Math.min(Math.max(1, Math.floor(Number(habit.streak) || 1)), HISTORY_CAP);
  return Array.from({ length: n }, (_, i) => keyOf(end - (n - 1 - i)));
}

export function isDone(habit, today) {
  return habitHistory(habit).includes(today);
}

/** Consecutive days ending today, or ending yesterday if today isn't done yet. */
export function currentStreak(habit, today) {
  const days = new Set(habitHistory(habit).map(dayIndex));
  const t = dayIndex(today);
  if (t == null) return 0;
  let i = days.has(t) ? t : t - 1;
  let n = 0;
  while (days.has(i)) { n += 1; i -= 1; }
  return n;
}

export function bestStreak(habit) {
  const idx = habitHistory(habit).map(dayIndex);
  let best = 0, run = 0, prev = null;
  for (const d of idx) {
    run = prev != null && d === prev + 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return Math.max(best, Number(habit?.best) || 0);
}

/**
 * Fields to save when today is ticked or unticked. Ticking a done habit again
 * unticks it. Old history beyond ~6 months is dropped; `best` keeps the record.
 */
export function toggleDay(habit, today) {
  const had = habitHistory(habit);
  const next = (had.includes(today) ? had.filter(k => k !== today) : [...had, today].sort()).slice(-HISTORY_CAP);
  const removing = had.includes(today);
  // Unticking undoes a record that tick set (best was only as high as the run
  // we're cutting), but never lowers a record from an earlier, longer run.
  const setByThisRun = removing && (Number(habit?.best) || 0) <= currentStreak(habit, today);
  const after = { ...habit, history: next, best: setByThisRun ? 0 : habit?.best };
  return {
    history: next,
    lastCompleted: next.length ? next[next.length - 1] : '',
    streak: currentStreak(after, today),
    best: bestStreak(after),
  };
}

/** The last `n` days, oldest first, for the week strip. */
export function weekDots(habit, today, n = 7) {
  const t = dayIndex(today);
  if (t == null) return [];
  const done = new Set(habitHistory(habit));
  return Array.from({ length: n }, (_, i) => {
    const date = keyOf(t - (n - 1 - i));
    return { date, done: done.has(date), isToday: date === today };
  });
}

/** Share of the last `days` days done, counted from the habit's first day. */
export function completionRate(habit, today, days = 30) {
  const hist = habitHistory(habit);
  const t = dayIndex(today);
  if (!hist.length || t == null) return null;
  const span = Math.min(days, t - dayIndex(hist[0]) + 1);
  if (span <= 0) return null;
  const inWindow = hist.filter(k => dayIndex(k) > t - span).length;
  return Math.round((inWindow / span) * 100);
}

export function todayProgress(habits = [], today) {
  const done = habits.filter(h => isDone(h, today)).length;
  return { done, total: habits.length };
}

/**
 * Habits with `streak` replaced by the live streak, for screens that show a
 * stored streak (which goes stale once a habit is missed).
 */
export function withLiveStreaks(habits = [], today) {
  return habits.map(h => ({ ...h, streak: currentStreak(h, today) }));
}
