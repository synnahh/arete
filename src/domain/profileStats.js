// profileStats.js — the numbers on the Profile screen. Pure.
import { loggedByDay } from './logCalendar.js';

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Monday to Sunday of the week containing `today`, each flagged when anything was logged that day. */
export function weekStrip(data, today) {
  const logged = loggedByDay(data);
  const [y, m, d] = today.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const back = (base.getUTCDay() + 6) % 7;
  return DOW.map((label, i) => {
    const day = new Date(Date.UTC(y, m - 1, d - back + i));
    const k = key(day);
    return { key: k, label, logged: logged.has(k), isToday: k === today, isFuture: k > today };
  });
}

/** How many different days you trained, how many sessions, and goals the coach marked reached. */
export function profileStats({ workouts = [], coachLog = [] } = {}) {
  const days = new Set(workouts.map(w => w?.date).filter(Boolean));
  const goalsAchieved = (Array.isArray(coachLog) ? coachLog : []).filter(e => e?.key === 'goal-reached' && e.status === 'applied').length;
  return { workoutDays: days.size, goalsAchieved };
}

/** Days since the goal began, 1 on the day it was set. */
export function goalDay(goal, today) {
  if (!goal?.startedOn) return null;
  const ms = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const n = Math.round((ms(today) - ms(goal.startedOn)) / 86400000) + 1;
  return n >= 1 ? n : null;
}
