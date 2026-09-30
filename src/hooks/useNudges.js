// useNudges — proactive, client-side "heads up" signals computed from local data.
// Pure + cheap; no network. Surfaced ambiently by NudgeStack. Each nudge:
//   { id, icon, text, tab, severity }  severity: 'info' | 'warn' | 'alert'

import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { currentWaterGoal } from '../utils/waterGoal.js';

const dayKey = (d) => toLocalDateKey(d);
const today  = () => dayKey(new Date());
const arr    = (k) => { const v = storage.get(k, []); return Array.isArray(v) ? v : (v?.daily || []); };

export function computeNudges() {
  const out = [];
  const now = new Date();
  const t   = today();
  const hour = now.getHours();

  // 1 — Sleep not logged recently (sleep_data: { date, duration })
  try {
    const sleep = arr(STORAGE_KEYS.SLEEP);
    const last  = [...sleep].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
    if (sleep.length) {
      const days = Math.floor((now - new Date(last.date)) / 86400000);
      if (days >= 2) out.push({ id: 'sleep', icon: '😴', text: `No sleep logged in ${days} days`, tab: 'recover', section: 'sleep', severity: 'warn' });
    }
  } catch {}

  // 2 — Overdue / due-today high-priority tasks
  try {
    const tasks = arr(STORAGE_KEYS.TASKS).filter(x => !x.done && !x.completed);
    const overdue = tasks.filter(x => x.dueDate && x.dueDate < t);
    const dueToday = tasks.filter(x => x.dueDate === t);
    if (overdue.length) out.push({ id: 'tasks-overdue', icon: '⏰', text: `${overdue.length} task${overdue.length > 1 ? 's' : ''} overdue`, tab: 'tasks', severity: 'alert' });
    else if (dueToday.length) out.push({ id: 'tasks-today', icon: '📋', text: `${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today`, tab: 'tasks', severity: 'info' });
  } catch {}

  // 3 — Events today
  try {
    const events = arr(STORAGE_KEYS.EVENTS).filter(e => e.date === t);
    if (events.length) out.push({ id: 'events', icon: '📅', text: `${events.length} event${events.length > 1 ? 's' : ''} today — ${events.map(e => e.title).filter(Boolean).slice(0, 2).join(', ')}`, tab: 'calendar', severity: 'info' });
  } catch {}

  // 4 — Hydration low in the afternoon
  try {
    const goalMl = currentWaterGoal(storage.get(STORAGE_KEYS.SETTINGS, {})); // the one shared goal
    const todayMl = arr(STORAGE_KEYS.WATER).filter(w => w.date === t).reduce((s, w) => s + (w.amount || 0), 0);
    if (hour >= 14 && todayMl < goalMl * 0.4) out.push({ id: 'water', icon: '💧', text: 'Hydration low today', tab: 'fuel', section: 'water', severity: 'warn' });
  } catch {}

  // 5 — Spending up vs last week
  try {
    const txns = arr(STORAGE_KEYS.TRANSACTIONS).filter(x => x.type === 'expense');
    const wk = (offset) => {
      const start = new Date(now); start.setDate(start.getDate() - 7 * (offset + 1));
      const end   = new Date(now); end.setDate(end.getDate() - 7 * offset);
      return txns.filter(x => { const d = new Date(x.date); return d >= start && d < end; }).reduce((s, x) => s + (x.amount || 0), 0);
    };
    const thisWk = wk(0), lastWk = wk(1);
    if (lastWk > 0 && thisWk > lastWk * 1.3) out.push({ id: 'spend', icon: '📈', text: `Spending up ${Math.round((thisWk / lastWk - 1) * 100)}% vs last week`, tab: 'finance', severity: 'warn' });
  } catch {}

  return out.slice(0, 4);
}
