// ─── VALERIE XP & Rank System ─────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, getDeviceId } from '../firebase/firebase.js';

const XP_KEY = 'valerie_xp';

function syncXPToFirestore(xpData) {
  const userId = getDeviceId();
  setDoc(doc(db, 'users', userId, 'meta', 'xp'), xpData)
    .catch(err => console.warn('[XP sync]', err.message));
}

// Hook for components that need real-time XP (cross-device sync)
export function useXP() {
  const [xp, setXp] = useState(() => getXP());
  useEffect(() => {
    const userId = getDeviceId();
    const unsub = onSnapshot(
      doc(db, 'users', userId, 'meta', 'xp'),
      snap => {
        if (snap.exists()) {
          const d = snap.data();
          localStorage.setItem(XP_KEY, JSON.stringify(d));
          setXp(d);
        }
      },
      err => console.warn('[XP onSnapshot]', err.message),
    );
    return () => unsub();
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
  syncXPToFirestore(xp);
  return xp.total;
}

// ─── Compute rank from total XP ───────────────────────────────────────────────
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
