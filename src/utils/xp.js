// ─── VALERIE XP & Rank System ─────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { supabase, getUserId, getUserIdSync } from '../supabase/supabase.js';
import { storage, STORAGE_KEYS } from './storage.js';
import { computeStreaks } from './streaks.js';

const XP_KEY = 'valerie_xp';

// XP syncs constantly in the background (every task/habit/workout completion),
// so failures are logged loudly but don't toast — a toast per completion would
// be noise. Real data-loss risks (tasks, transactions, settings) DO toast; see
// useCollection/useDocument.
async function syncXPToSupabase(xpData) {
  const userId = await getUserId();
  if (!userId) { console.error('[XP sync] not signed in'); return; }
  supabase.from('user_meta')
    .upsert({ user_id: userId, key: 'xp', value: xpData }, { onConflict: 'user_id,key' })
    .then(({ error }) => { if (error) console.error('[XP sync]', error.message); });
}

// Hook for components that need real-time XP (cross-device sync)
export function useXP() {
  const [xp, setXp] = useState(() => getXP());

  useEffect(() => {
    let sub;
    getUserId().then(userId => {
      // Initial fetch
      supabase.from('user_meta').select('value')
        .eq('user_id', userId).eq('key', 'xp').maybeSingle()
        .then(({ data }) => {
          if (data?.value) { localStorage.setItem(XP_KEY, JSON.stringify(data.value)); setXp(data.value); }
        });

      // Realtime
      sub = supabase.channel(`xp:${userId}:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_meta', filter: `user_id=eq.${userId}` },
          async () => {
            const { data } = await supabase.from('user_meta').select('value').eq('user_id', userId).eq('key', 'xp').maybeSingle();
            if (data?.value) { localStorage.setItem(XP_KEY, JSON.stringify(data.value)); setXp(data.value); }
          })
        .subscribe();
    });
    return () => { if (sub) supabase.removeChannel(sub); };
  }, []);

  return xp;
}

// ─── Tier thresholds (total XP to enter each tier) ───────────────────────────
export const TIER_THRESHOLDS = [0, 600, 1800, 4000, 8000, 14000, 22000, 38000];

export const TIER_CONFIG = [
  { tier: 1, name: 'Hex',       color: '#7c3aed', shape: 'hexagon'  },
  { tier: 2, name: 'Shard',     color: '#94a3b8', shape: 'shard'    },
  { tier: 3, name: 'Void',      color: '#3b82f6', shape: 'cross'    },
  { tier: 4, name: 'Raze',      color: '#14b8a6', shape: 'sixstar'  },
  { tier: 5, name: 'Fang',      color: '#d97706', shape: 'fang'     },
  { tier: 6, name: 'Crown',     color: '#fbbf24', shape: 'crown'    },
  { tier: 7, name: 'Spectre',   color: '#dc2626', shape: 'spectre'  },
  { tier: 8, name: 'Ascendant', color: '#ffffff', shape: 'ascendant'},
];

// ─── XP sources ───────────────────────────────────────────────────────────────
export const XP_SOURCES = {
  TASK_COMPLETED:     { amount: 10,  label: 'Task completed'           },
  HABIT_DAILY:        { amount: 25,  label: 'Habit maintained'         },
  WORKOUT_LOGGED:     { amount: 20,  label: 'Workout logged'           },
  GOAL_MILESTONE:     { amount: 50,  label: 'Goal milestone reached'   },
  FOCUS_SESSION:      { amount: 15,  label: 'Focus session completed'  },
  MACROS_HIT:         { amount: 20,  label: 'Daily macros hit'         },
  UNDER_BUDGET:       { amount: 30,  label: 'Under budget this week'   },
  STREAK_7:           { amount: 100, label: '7-day streak milestone'   },
  STREAK_30:          { amount: 100, label: '30-day streak milestone'  },
  STREAK_100:         { amount: 100, label: '100-day streak milestone' },
  MOOD_LOGGED:        { amount: 5,   label: 'Mood logged'              },
  WATER_GOAL:         { amount: 10,  label: 'Water goal hit'           },
};

// ─── Read XP from localStorage ────────────────────────────────────────────────
export function getXP() {
  try {
    const raw = localStorage.getItem(XP_KEY);
    return raw ? JSON.parse(raw) : { total: 0, log: [] };
  } catch { return { total: 0, log: [] }; }
}

// ─── Add XP ───────────────────────────────────────────────────────────────────
export function addXP(sourceKey, overrideLabel) {
  const src = XP_SOURCES[sourceKey];
  if (!src) return;
  const xp  = getXP();
  xp.total  = (xp.total || 0) + src.amount;
  xp.log    = [{
    source: sourceKey,
    amount: src.amount,
    label:  overrideLabel || src.label,
    date:   new Date().toISOString(),
  }, ...(xp.log || [])].slice(0, 300);
  localStorage.setItem(XP_KEY, JSON.stringify(xp));
  syncXPToSupabase(xp);
  return xp.total;
}

//  Unified XP sweep — award XP for cross-domain activity, idempotently.
// Each award is keyed by the entity/day it represents and recorded in an
// `awarded` ledger, so this is safe to call on every app load and can never
// double-count. Covers the domains that previously never fed XP (tasks,
// workouts, habits) plus overall streak milestones. Focus & mood keep their
// own inline awards, so they're intentionally excluded here.
export function awardActivityXP() {
  const xp = getXP();
  if (!xp.awarded) xp.awarded = {};
  let changed = false;

  const award = (ledgerKey, sourceKey, label) => {
    if (xp.awarded[ledgerKey]) return;
    const src = XP_SOURCES[sourceKey];
    if (!src) return;
    xp.awarded[ledgerKey] = true;
    xp.total = (xp.total || 0) + src.amount;
    xp.log = [{ source: sourceKey, amount: src.amount, label: label || src.label, date: new Date().toISOString() },
      ...(xp.log || [])].slice(0, 300);
    changed = true;
  };

  const arr = (k) => { const v = storage.get(k, []); return Array.isArray(v) ? v : []; };

  arr(STORAGE_KEYS.TASKS).forEach(t => { if (t.done && t.id) award(`TASK:${t.id}`, 'TASK_COMPLETED'); });
  arr(STORAGE_KEYS.WORKOUT_LOGS).forEach(w => { if (w.id) award(`WORKOUT:${w.id}`, 'WORKOUT_LOGGED'); });
  arr(STORAGE_KEYS.HABITS).forEach(h => { if (h.id && h.lastCompleted) award(`HABIT:${h.id}:${h.lastCompleted}`, 'HABIT_DAILY'); });

  try {
    const best = computeStreaks().overall.best;
    if (best >= 7)   award('STREAK:overall:7',   'STREAK_7');
    if (best >= 30)  award('STREAK:overall:30',  'STREAK_30');
    if (best >= 100) award('STREAK:overall:100', 'STREAK_100');
  } catch { /* streak compute is best-effort */ }

  if (changed) {
    localStorage.setItem(XP_KEY, JSON.stringify(xp));
    syncXPToSupabase(xp);
  }
  return xp;
}

//  Compute rank from total XP
export function getRank(totalXP = 0) {
  let tier = 1;
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (totalXP >= TIER_THRESHOLDS[i]) tier = i + 1;
  }
  tier = Math.min(tier, 8);
  const cfg = TIER_CONFIG[tier - 1];

  if (tier === 8) {
    return { tier: 8, subRank: 1, config: cfg, tierProgress: 1, xpToNext: 0 };
  }

  const tierStart = TIER_THRESHOLDS[tier - 1];
  const tierEnd   = TIER_THRESHOLDS[tier];
  const tierRange = tierEnd - tierStart;
  const tierProgress = (totalXP - tierStart) / tierRange;

  let subRank = 1;
  if (tierProgress >= 2 / 3) subRank = 3;
  else if (tierProgress >= 1 / 3) subRank = 2;

  const nextSubThresh = subRank === 3 ? tierEnd : tierStart + Math.ceil(tierRange * (subRank / 3));
  const xpToNext = nextSubThresh - totalXP;

  return { tier, subRank, config: cfg, tierProgress, xpToNext };
}

