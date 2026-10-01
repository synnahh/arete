// plan.js — the Plan screen's picture of a day and a week. Pure; UI is tabs/PlanToday.jsx.
//
// One day is a single ordered list of what is on it:
//   event    calendar events (date + optional time)
//   routine  routines whose reminder days include that weekday (shown at the first step's time)
//   train    the active program's session for that weekday, done when a workout is logged that date
//   task     tasks due that date (undated open tasks count as "today" only)
// Timed items come first by clock time; untimed tasks follow by priority; done items sink.
import { dayIndex, keyOfDay } from '../utils/dayIndex.js';

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const PRIORITY_RANK = { high: 0, med: 1, low: 2 };
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const weekdayKey = (date) => {
  const i = dayIndex(date);
  return i == null ? null : WEEKDAYS[new Date(i * 86400000).getUTCDay()];
};

const eventDate = (e) => e?.date || e?.start?.date || e?.start?.dateTime?.slice(0, 10) || '';
const eventTime = (e) => (TIME_RE.test(e?.time || '') ? e.time : e?.start?.dateTime ? e.start.dateTime.slice(11, 16) : '');
const cleanTime = (t) => (TIME_RE.test(t || '') ? t : '');

/** Monday on or before `date`. */
export function weekStart(date) {
  const i = dayIndex(date);
  if (i == null) return null;
  const dow = (new Date(i * 86400000).getUTCDay() + 6) % 7; // 0 = Monday
  return keyOfDay(i - dow);
}

export function addDays(date, n) {
  const i = dayIndex(date);
  return i == null ? null : keyOfDay(i + n);
}

/** Everything on `date`, ordered. */
export function buildDay({ date, today, tasks = [], events = [], routines = [], program = null, workouts = [] }) {
  if (dayIndex(date) == null) return [];
  const out = [];

  for (const e of events) {
    if (eventDate(e) !== date || !e?.title) continue;
    out.push({ kind: 'event', id: e.id ?? `e:${e.title}:${eventTime(e)}`, title: e.title, time: eventTime(e), end: cleanTime(e.endTime), done: false, ref: e });
  }

  const wk = weekdayKey(date);
  for (const r of routines) {
    if (!r || r.active === false || !r.name) continue;
    if (!(r.reminder?.days || []).includes(wk)) continue;
    const steps = Array.isArray(r.steps) ? r.steps.filter(s => s?.label) : [];
    const first = steps.map(s => cleanTime(s.time)).filter(Boolean).sort()[0] || cleanTime(r.reminder?.time) || '';
    out.push({ kind: 'routine', id: `r:${r.id ?? r.name}`, title: r.name, time: first, steps: steps.length, done: false, ref: r });
  }

  const day = program?.days?.[wk];
  if (day?.splitType && day.splitType !== 'rest') {
    out.push({ kind: 'train', id: `t:${date}`, title: `Train · ${day.label || day.splitType}`, time: '', done: workouts.some(w => w?.date === date), ref: day });
  }

  for (const t of tasks) {
    if (!t?.text) continue;
    const due = t.dueDate || '';
    const here = due === date || (!due && !t.done && date === today);
    if (!here) continue;
    out.push({ kind: 'task', id: t.id, title: t.text, time: '', priority: t.priority || 'med', done: !!t.done, repeat: t.repeat && t.repeat !== 'none' ? t.repeat : null, ref: t });
  }

  const rank = (x) => (x.done ? 3 : x.time ? 0 : x.kind === 'train' ? 1 : 2);
  return out.sort((a, b) =>
    rank(a) - rank(b)
    || (a.time && b.time ? a.time.localeCompare(b.time) : 0)
    || (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1)
    || String(a.title).localeCompare(String(b.title)));
}

/** { done, total, pct } for the things you can complete (tasks and the training session). */
export function daySummary(items) {
  const doable = items.filter(i => i.kind === 'task' || i.kind === 'train');
  const done = doable.filter(i => i.done).length;
  return { done, total: doable.length, pct: doable.length ? Math.round((done / doable.length) * 100) : 0 };
}

/** Open tasks due before `today`, oldest first. */
export function overdue(tasks = [], today) {
  const t = dayIndex(today);
  return tasks
    .filter(x => x?.text && !x.done && dayIndex(x.dueDate) != null && dayIndex(x.dueDate) < t)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** The 7 days of the week containing `anchor`, each with how much is on it. */
export function weekStrip({ anchor, today, selected, tasks = [], events = [], routines = [], program = null, workouts = [] }) {
  const start = weekStart(anchor);
  if (!start) return [];
  return Array.from({ length: 7 }, (_, n) => {
    const date = addDays(start, n);
    const items = buildDay({ date, today, tasks, events, routines, program, workouts });
    const open = items.filter(i => i.kind === 'task' && !i.done).length;
    return {
      date,
      weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][n],
      day: Number(date.slice(8, 10)),
      isToday: date === today,
      isSelected: date === selected,
      open,
      events: items.filter(i => i.kind === 'event').length,
      train: items.some(i => i.kind === 'train'),
      total: items.length,
    };
  });
}

/** What is coming in the `days` after `today`: tasks and events grouped by date, soonest first. */
export function upcoming({ today, days = 7, tasks = [], events = [] }) {
  const out = [];
  for (let n = 1; n <= days; n++) {
    const date = addDays(today, n);
    const items = [];
    for (const e of events) if (eventDate(e) === date && e?.title) items.push({ kind: 'event', title: e.title, time: eventTime(e) });
    for (const t of tasks) if (t?.text && !t.done && t.dueDate === date) items.push({ kind: 'task', title: t.text, time: '', priority: t.priority || 'med' });
    if (items.length) out.push({ date, items: items.sort((a, b) => (a.time || '99').localeCompare(b.time || '99')) });
  }
  return out;
}
