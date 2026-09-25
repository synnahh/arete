//  VALERIE — Unified streak engine
// Pure, read-only computation over the existing localStorage collections.
// Derives an overall "don't break the chain" streak plus per-domain streaks
// (focus · health · lm · tasks) without requiring any new writes. Mirrors of
// the Supabase collections are kept in localStorage by useCollection, so this
// stays in sync automatically.

import { storage, STORAGE_KEYS } from './storage.js';
import { toLocalDateKey } from './localDate.js';

const isoDay = (d) => toLocalDateKey(d);

// Pull a YYYY-MM-DD from whatever date-ish field a row carries.
function rowDate(x) {
  const d = x?.date || x?.day || x?.completedAt || x?.createdAt || x?.lastCompleted;
  return d ? String(d).slice(0, 10) : null;
}

function datesFrom(key, pred = () => true) {
  const rows = storage.get(key, []);
  if (!Array.isArray(rows)) return [];
  return rows.filter(pred).map(rowDate).filter(Boolean);
}

// Consecutive days ending today (or yesterday — one grace day so the streak
// doesn't read as broken before you've logged anything today).
function currentStreak(dateSet) {
  if (!dateSet.size) return 0;
  const d = new Date();
  if (!dateSet.has(isoDay(d))) {
    d.setDate(d.getDate() - 1);
    if (!dateSet.has(isoDay(d))) return 0;
  }
  let count = 0;
  while (dateSet.has(isoDay(d))) { count++; d.setDate(d.getDate() - 1); }
  return count;
}

// Longest run of consecutive days ever recorded.
function bestStreak(dateSet) {
  const arr = [...dateSet].sort();
  let best = 0, run = 0, prev = null;
  for (const ds of arr) {
    const cur = new Date(ds + 'T00:00:00Z');
    if (prev && (cur - prev) === 86400000) run++;
    else run = 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}

function streakOf(dates) {
  const set = new Set(dates);
  return {
    current: currentStreak(set),
    best:    bestStreak(set),
    active:  set.has(isoDay(new Date())),
  };
}

// Compute the unified streak picture across every domain.
export function computeStreaks() {
  const focus  = datesFrom(STORAGE_KEYS.FOCUS_SESSIONS);
  const tasks  = datesFrom(STORAGE_KEYS.TASKS, t => t.done && t.completedAt);
  const lm     = datesFrom('valerie_lm_daily'); // LM passes the already-prefixed key
  const health = [
    ...datesFrom(STORAGE_KEYS.MACROS),
    ...datesFrom(STORAGE_KEYS.WATER),
    ...datesFrom(STORAGE_KEYS.WORKOUT_LOGS),
    ...datesFrom(STORAGE_KEYS.HABITS, h => h.lastCompleted),
  ];
  const mood   = datesFrom(STORAGE_KEYS.MOOD_LOGS);

  const overall = [...focus, ...tasks, ...lm, ...health, ...mood];

  return {
    overall: streakOf(overall),
    domains: {
      focus:  { ...streakOf(focus),  label: 'Focus',  icon: '⏱️' },
      health: { ...streakOf(health), label: 'Health', icon: '🥗' },
      lm:     { ...streakOf(lm),     label: 'LM',      icon: '🗿' },
      tasks:  { ...streakOf(tasks),  label: 'Tasks',   icon: '✅' },
    },
  };
}
