// attention.js — computes which sidebar tabs have actionable items due
// today or tomorrow, for Sidebar's Focus Mode button. Pure, read-only over
// the same localStorage collections TodayView.jsx already gathers from.

import { storage, STORAGE_KEYS } from './storage.js';
import { toLocalDateKey } from './localDate.js';

const arr = (k) => { const v = storage.get(k, []); return Array.isArray(v) ? v : (v?.daily || []); };
const dateStr = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toLocalDateKey(d);
};

// Tabs that always stay visible in Focus Mode regardless of attention data.
export const FOCUS_ALWAYS_VISIBLE = new Set(['dashboard', 'assistant']);

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

  const dueRestock = arr(STORAGE_KEYS.ESSENTIALS).filter(it => {
    if (!it.boughtDate || !it.lifespanDays) return false;
    const days = Math.ceil((new Date(it.boughtDate).getTime() + it.lifespanDays * 86400000 - Date.now()) / 86400000);
    return dayOffset === 0 ? days <= 7 : days > 7 && days <= 8;
  });
  if (dueRestock.length) { tabs.add('essentials'); count += dueRestock.length; }

  // Habits only make sense for "today" — can't pre-log tomorrow's habits.
  if (dayOffset === 0) {
    const incompleteHabits = arr(STORAGE_KEYS.HABITS).filter(h => (h.lastCompleted || '').slice(0, 10) !== t);
    if (incompleteHabits.length) { tabs.add('health'); count += incompleteHabits.length; }
  }

  return { tabs, count };
}
