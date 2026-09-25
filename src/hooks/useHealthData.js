// useHealthData — shared, realtime read of VALERIE's canonical health layer.
// Lets other tabs (e.g. LM / Looksmaxxing) correspond instantly with the Health
// tab's data instead of re-logging it. Read-only: this never writes Health data.
//
// Canonical sources (same tables Health + Peak State use, auto-fed by Apple Health):
//   body_metrics   → { date, weight(kg), bodyFat(%), muscle, notes }
//   sleep_data     → { date, duration(min), efficiency(%), ... }
//   nutrition_logs → { date, calories, protein, carbs, fat, ... }
//   water_logs     → { date, amount(ml), ... }

import { useMemo } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS } from '../utils/storage.js';

const todayStr = () => new Date().toISOString().slice(0, 10);
const byDateDesc = (a, b) => (b.date ?? '').localeCompare(a.date ?? '');

export function useHealthData() {
  const body      = useCollection('body_metrics',   STORAGE_KEYS.BODY);
  const sleep     = useCollection('sleep_data',     STORAGE_KEYS.SLEEP);
  const nutrition = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);
  const water     = useCollection('water_logs',     STORAGE_KEYS.WATER);

  return useMemo(() => {
    const today = todayStr();

    const latestBody = [...(body.items || [])].sort(byDateDesc)[0] || null;

    const sleepSorted = [...(sleep.items || [])].sort(byDateDesc);
    const lastSleep   = sleepSorted[0] || null;
    const sleep7      = sleepSorted.slice(0, 7);
    const avgSleepHours = sleep7.length
      ? +(sleep7.reduce((s, d) => s + ((d.duration || 0) / 60), 0) / sleep7.length).toFixed(1)
      : null;
    const lastSleepHours = lastSleep?.duration != null ? +(lastSleep.duration / 60).toFixed(1) : null;

    const todayNut = (nutrition.items || []).filter(n => n.date === today);
    const todayCalories = todayNut.reduce((s, n) => s + (n.calories || 0), 0) || null;
    const todayProtein  = todayNut.reduce((s, n) => s + (n.protein  || 0), 0) || null;

    const todayWaterMl = (water.items || [])
      .filter(w => w.date === today)
      .reduce((s, w) => s + (w.amount || 0), 0) || null;

    return {
      // raw collections (realtime)
      body, sleep, nutrition, water,
      // derived, ready to display / feed the AI
      latestWeight:   latestBody?.weight  ?? null,
      latestBodyFat:  latestBody?.bodyFat ?? null,
      latestMuscle:   latestBody?.muscle  ?? null,
      latestBodyDate: latestBody?.date    ?? null,
      avgSleepHours,
      lastSleepHours,
      lastSleepEfficiency: lastSleep?.efficiency ?? null,
      todayCalories,
      todayProtein,
      todayWaterMl,
      hasHealthData: !!(latestBody || lastSleep || todayNut.length),
    };
  }, [body.items, sleep.items, nutrition.items, water.items]); // eslint-disable-line react-hooks/exhaustive-deps
}
