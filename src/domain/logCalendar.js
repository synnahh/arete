// logCalendar.js — a month calendar of the days you logged anything, like the
// training calendar in STANCE. Pure: rows in, a grid out. Weeks start on Monday.
//
// data = { workouts, nutrition, sleep, body, habits } — the same rows the logging
// streak reads (rows carry a local `date` key 'YYYY-MM-DD'; habits carry a history).
// Each cell lists what was logged that day so the UI can show dots and a detail view.

import { habitHistory } from './habits.js';

const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;   // m is 0-11

const parseKey = (k) => {
  const [y, m, d] = String(k).split('-').map(Number);
  return Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d) ? { y, m: m - 1, d } : null;
};

export const KINDS = ['workout', 'food', 'sleep', 'weight', 'habit'];
export const KIND_LABEL = { workout: 'Workout', food: 'Food', sleep: 'Sleep', body: 'Weigh-in', weight: 'Weigh-in', habit: 'Habits' };

/** Everything logged per date: Map<dateKey, { workout: Set(names), food, sleep, weight, habit }>. */
export function loggedByDay({ workouts = [], nutrition = [], sleep = [], body = [], habits = [] } = {}) {
  const days = new Map();
  const at = (k) => {
    if (!parseKey(k)) return null;
    if (!days.has(k)) days.set(k, { workout: new Set(), food: false, sleep: false, weight: false, habit: false });
    return days.get(k);
  };
  for (const r of workouts) { const c = at(r?.date); if (c) c.workout.add(r.exerciseName || r.name || 'Workout'); }
  for (const r of nutrition) if (Number(r?.calories) > 0) { const c = at(r?.date); if (c) c.food = true; }
  for (const r of sleep) if (Number(r?.duration) > 0) { const c = at(r?.date); if (c) c.sleep = true; }
  for (const r of body) if (Number(r?.weight) > 0) { const c = at(r?.date); if (c) c.weight = true; }
  for (const h of habits) for (const k of habitHistory(h)) { const c = at(k); if (c) c.habit = true; }
  return days;
}

/**
 * The grid for one month: { title, weeks: [[cell x7]], summary }.
 * cell = { key, day, inMonth, isToday, isFuture, kinds: [...], workouts: [names], logged }
 * summary = { loggedDays, workoutDays, daysInMonthSoFar }
 */
export function monthGrid(year, month, data, today) {
  const byDay = loggedByDay(data);
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;                       // Monday = 0
  const dim = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weeksCount = Math.ceil((lead + dim) / 7);
  const weeks = [];
  let loggedDays = 0, workoutDays = 0, soFar = 0;

  for (let w = 0; w < weeksCount; w++) {
    const row = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(Date.UTC(year, month, 1 - lead + w * 7 + i));
      const key = dateKey(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate());
      const inMonth = cur.getUTCMonth() === month;
      const rec = byDay.get(key);
      const kinds = rec ? KINDS.filter(k => (k === 'workout' ? rec.workout.size > 0 : rec[k])) : [];
      const isFuture = key > today;
      if (inMonth) {
        if (!isFuture) soFar++;
        if (kinds.length) loggedDays++;
        if (kinds.includes('workout')) workoutDays++;
      }
      row.push({ key, day: cur.getUTCDate(), inMonth, isToday: key === today, isFuture, kinds, workouts: rec ? [...rec.workout] : [], logged: kinds.length > 0 });
    }
    weeks.push(row);
  }
  const title = new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { title, weeks, summary: { loggedDays, workoutDays, daysInMonthSoFar: soFar } };
}

/** Month stepping that stays valid across year ends. */
export function shiftMonth({ year, month }, delta) {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}
