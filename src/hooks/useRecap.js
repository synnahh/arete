// useRecap — the data behind the weekly recap, the logging streak and the Insights
// screen (domain/recap.js, domain/insights.js), read from the synced collections.
import { useEffect, useMemo, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { updateSettings } from '../utils/settingsStore.js';
import { todaysTargets } from '../utils/todaysTargets.js';
import { weeklyRecap, loggingStreak, recapKey } from '../domain/recap.js';

/** The raw rows plus the few settings the pure functions need. */
export function useTrackedData() {
  const { items: workouts = [] } = useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS);
  const { items: nutrition = [] } = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);
  const { items: sleep = [] } = useCollection('sleep_data', STORAGE_KEYS.SLEEP);
  const { items: habits = [] } = useCollection('habits', STORAGE_KEYS.HABITS);
  const { items: body = [] } = useCollection('body_metrics', STORAGE_KEYS.BODY);

  // Targets and the plan are read from storage, so recompute when settings change.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(n => n + 1);
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
    return {
      today, workouts, nutrition, sleep, habits, body,
      targetKcal: hasTargets ? todaysTargets(settings, new Date()).kcal : null,
      need: settings.sleepNeedHours || undefined,
      sessionsPerWeek: planned || 3,
      recapSeen: settings.recapSeen || null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, nutrition, sleep, habits, body, today, tick]);
}

export function useRecap() {
  const data = useTrackedData();
  const recap = useMemo(() => weeklyRecap(data, data.today), [data]);
  const streak = useMemo(() => loggingStreak(data, data.today), [data]);
  // Home shows the recap on Monday and Tuesday until it is dismissed; Insights always shows it.
  const day = new Date().getDay();
  const dueOnHome = !!recap && (day === 1 || day === 2) && data.recapSeen !== recapKey(recap);
  const dismiss = () => { if (recap) updateSettings({ recapSeen: recapKey(recap) }); };
  return { recap, streak, dueOnHome, dismiss, data };
}
