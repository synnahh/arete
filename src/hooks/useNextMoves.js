// useNextMoves — gathers today's picture from the shared collections and asks
// domain/nextMoves.js what to do next. Re-evaluates every minute so time-of-day
// rules (protein pace, evening habits) move on without a refresh.
import { useEffect, useMemo, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument } from '../supabase/useDocument.js';
import { completion } from '../domain/skin.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { useRecovery } from './useRecovery.js';
import { nextMoves } from '../domain/nextMoves.js';
import { applyUsage, dueItems, expiringItems } from '../domain/ahead.js';
import { waterAdvice } from '../domain/water.js';
import { todayProgress } from '../domain/habits.js';
import { fastProgress } from '../domain/fasting.js';
import { todaysTargets, isTrainingDay } from '../utils/todaysTargets.js';
import { currentWaterGoal, sleepWindow } from '../utils/waterGoal.js';
import { dayIndex } from '../utils/dayIndex.js';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function useNextMoves() {
  const { items: nutrition = [] } = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);
  const { items: water = [] } = useCollection('water_logs', STORAGE_KEYS.WATER);
  const { items: workouts = [] } = useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS);
  const { items: body = [] } = useCollection('body_metrics', STORAGE_KEYS.BODY);
  const { items: habits = [] } = useCollection('habits', STORAGE_KEYS.HABITS);
  const { items: supplies = [] } = useCollection('essentials', STORAGE_KEYS.ESSENTIALS);
  const { items: lmDaily = [] } = useCollection('lm_daily', 'valerie_lm_daily');
  const lmProfile = useDocument('lm_profile', 'valerie_lm_profile', {}).data;
  const recovery = useRecovery();

  const [tick, setTick] = useState(0);
  const [settings, setSettings] = useState(() => storage.get(STORAGE_KEYS.SETTINGS, {}) || {});
  useEffect(() => {
    const onChange = (e) => setSettings(e.detail || storage.get(STORAGE_KEYS.SETTINGS, {}) || {});
    window.addEventListener('valerie:settings-changed', onChange);
    const t = setInterval(() => setTick(n => n + 1), 60000);
    return () => { window.removeEventListener('valerie:settings-changed', onChange); clearInterval(t); };
  }, []);

  return useMemo(() => {
    const now = new Date();
    const today = toLocalDateKey(now);
    const hasTargets = !!(settings.coachGoal || settings.macroGoal || settings.macros);
    const tt = hasTargets ? todaysTargets(settings, now) : null;
    const todayNutrition = nutrition.find(l => l.date === today);
    const totalMl = water.filter(l => l.date === today).reduce((s, l) => s + (Number(l.amount) || 0), 0);

    const programs = storage.get(STORAGE_KEYS.PROGRAMS, []);
    const activeDay = (Array.isArray(programs) ? programs.find(p => p?.isActive) : null)?.days?.[DAY_KEYS[now.getDay()]];
    const scheduled = !!(activeDay && activeDay.splitType && activeDay.splitType !== 'rest');

    const live = applyUsage(supplies, nutrition, today);
    const skinSteps = Array.isArray(lmProfile?.skinSteps) ? lmProfile.skinSteps : [];
    const skinTicks = lmDaily.find(d => d.date === today)?.skin ?? {};
    const am = completion(skinSteps, skinTicks, 'am', now.getDay());
    const pm = completion(skinSteps, skinTicks, 'pm', now.getDay());
    const lastWeigh = body.map(b => b.date).filter(d => dayIndex(d) != null).sort().pop();

    return nextMoves({
      hour: now.getHours(),
      targets: tt ? { kcal: tt.kcal, protein: tt.protein } : null,
      eaten: { calories: Number(todayNutrition?.calories) || 0, protein: Number(todayNutrition?.protein) || 0 },
      water: { advice: waterAdvice({ totalMl, goalMl: currentWaterGoal(settings), now, ...sleepWindow() }) },
      training: {
        isTrainingDay: scheduled || isTrainingDay(now),
        trainedToday: workouts.some(l => l.date === today),
        label: activeDay?.label || null,
        readiness: recovery.status === 'ok' ? recovery : null,
      },
      supplies: {
        due: dueItems(live, today, 0).map(({ item, f }) => ({ name: item.name, daysToReorder: f.daysToReorder, status: f.status })),
        expiring: expiringItems(supplies, today, { warnDays: 7 }).map(({ item, e }) => ({ name: item.name, daysLeft: e.daysLeft })),
      },
      habits: habits.length ? todayProgress(habits, today) : null,
      weight: { hasGoal: !!settings.coachGoal, daysSinceWeighIn: lastWeigh ? dayIndex(today) - dayIndex(lastWeigh) : null },
      sleep: recovery.debt && recovery.debt.status !== 'insufficient' ? { status: recovery.debt.status, debtHours: recovery.debt.debtHours, bedtime: sleepWindow().bed } : null,
      skin: am.total || pm.total ? { amDone: am.done, amTotal: am.total, pmDone: pm.done, pmTotal: pm.total } : null,
      fast: settings.fast ? fastProgress(settings.fast, now.getTime()) : null,
    });
  // tick re-runs the clock-dependent rules once a minute
  }, [nutrition, water, workouts, body, habits, supplies, lmDaily, lmProfile, recovery, settings, tick]);
}
