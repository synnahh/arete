// useOverall — the long-run rating (domain/overall.js) from the synced collections.
import { useEffect, useMemo, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { overallRating } from '../domain/overall.js';
import { todaysTargets } from '../utils/todaysTargets.js';

export function useOverall() {
  const { items: workouts = [] } = useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS);
  const { items: nutrition = [] } = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);
  const { items: sleep = [] } = useCollection('sleep_data', STORAGE_KEYS.SLEEP);
  const { items: habits = [] } = useCollection('habits', STORAGE_KEYS.HABITS);
  const { items: body = [] } = useCollection('body_metrics', STORAGE_KEYS.BODY);

  // Targets and the training plan are read from storage, so recompute when settings change.
  const [settingsTick, setSettingsTick] = useState(0);
  useEffect(() => {
    const bump = () => setSettingsTick(n => n + 1);
    window.addEventListener('valerie:settings-changed', bump);
    return () => window.removeEventListener('valerie:settings-changed', bump);
  }, []);

  const today = toLocalDateKey(new Date());
  return useMemo(() => {
    const settings = storage.get(STORAGE_KEYS.SETTINGS, {}) || {};
    const hasTargets = !!(settings.coachGoal || settings.macroGoal || settings.macros);
    const programs = storage.get(STORAGE_KEYS.PROGRAMS, []);
    const active = Array.isArray(programs) ? programs.find(p => p?.isActive) : null;
    const planned = active?.days ? Object.values(active.days).filter(d => d && d.splitType && d.splitType !== 'rest').length : 0;
    return overallRating({
      workouts, nutrition, sleep, habits, body,
      targets: hasTargets ? { kcal: todaysTargets(settings, new Date()).kcal } : null,
      need: settings.sleepNeedHours,
      sessionsPerWeek: planned || 3,
    }, today);
  }, [workouts, nutrition, sleep, habits, body, today, settingsTick]);
}
