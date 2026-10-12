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

  // 4 — Hydration low in the afternoon
  try {
    const goalMl = currentWaterGoal(storage.get(STORAGE_KEYS.SETTINGS, {})); // the one shared goal
    const todayMl = arr(STORAGE_KEYS.WATER).filter(w => w.date === t).reduce((s, w) => s + (w.amount || 0), 0);
    if (hour >= 14 && todayMl < goalMl * 0.4) out.push({ id: 'water', icon: '💧', text: 'Hydration low today', tab: 'fuel', section: 'water', severity: 'warn' });
  } catch {}

  return out.slice(0, 4);
}
