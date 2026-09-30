// attention.js — computes which sidebar tabs have actionable items due
// today or tomorrow, for Sidebar's Focus Mode button. Pure, read-only over
// the same localStorage collections TodayView.jsx already gathers from.

import { storage, STORAGE_KEYS } from './storage.js';
import { toLocalDateKey } from './localDate.js';
import { forecast, expiringItems } from '../domain/ahead.js';
import { suppliesWithUsage } from './supplies.js';

const arr = (k) => { const v = storage.get(k, []); return Array.isArray(v) ? v : (v?.daily || []); };
const dateStr = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toLocalDateKey(d);
};

// Tabs that always stay visible in Focus Mode regardless of attention data.
export const FOCUS_ALWAYS_VISIBLE = new Set(['dashboard']);

// dayOffset: 0 = today, 1 = tomorrow. Returns { tabs: Set<tabId>, count }.
export function getAttentionTabs(dayOffset = 0) {
  const t = dateStr(dayOffset);
  const tabs = new Set();
  let count = 0;

  const tasksAll = arr(STORAGE_KEYS.TASKS).filter(x => !x.done && !x.completed);
  const dueTasks = tasksAll.filter(x => x.dueDate === t || (dayOffset === 0 && x.dueDate && x.dueDate < t));
  if (dueTasks.length) { tabs.add('tasks'); count += dueTasks.length; }

  const dueEvents = arr(STORAGE_KEYS.EVENTS).filter(e => e.date === t);
  if (dueEvents.length) { tabs.add('calendar'); count += dueEvents.length; }

  // Supplies whose reorder-by date (Ahead engine) is today or earlier / tomorrow.
  const today = dateStr(0);
  const dueRestock = suppliesWithUsage(arr(STORAGE_KEYS.ESSENTIALS), today).filter(it => {
    const f = forecast(it, today);
    if (f.status === 'unknown') return false;
    return dayOffset === 0 ? f.daysToReorder <= 0 : f.daysToReorder === 1;
  });
  if (dueRestock.length) { tabs.add('essentials'); count += dueRestock.length; }

  // Opened products past (or within a week of) their use-by date; today only.
  if (dayOffset === 0) {
    const stale = expiringItems(arr(STORAGE_KEYS.ESSENTIALS), today, { warnDays: 7 });
    if (stale.length) { tabs.add('essentials'); count += stale.length; }
  }

  // Habits only make sense for "today" — can't pre-log tomorrow's habits.
  if (dayOffset === 0) {
    const incompleteHabits = arr(STORAGE_KEYS.HABITS).filter(h => (h.lastCompleted || '').slice(0, 10) !== t);
    if (incompleteHabits.length) { tabs.add('habits'); count += incompleteHabits.length; }
  }

  return { tabs, count };
}
