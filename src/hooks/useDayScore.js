// useDayScore — today's score against the Coach goal (domain/goals.js dayScore), shared by
// Home's GoalRing and the dock's ring. Null when no goal is set.
import { useMemo } from 'react';
import { useHealthData } from './useHealthData.js';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { dayScore } from '../domain/goals.js';
import { currentWaterGoal } from '../utils/waterGoal.js';
import { todaysTargets } from '../utils/todaysTargets.js';

export function useDayScore(settings) {
  const goal = settings?.coachGoal;
  const health = useHealthData();
  const { items: workoutLogs = [] } = useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS);
  const today = toLocalDateKey(new Date());

  return useMemo(() => goal && dayScore({
    targets: { ...goal.targets, ...todaysTargets(settings) },
    calories: health.todayCalories ?? 0,
    protein: health.todayProtein ?? 0,
    waterMl: health.todayWaterMl ?? 0,
    waterGoalMl: currentWaterGoal(settings),
    sleepHours: health.lastSleepHours ?? 0,
    trained: workoutLogs.some(l => l.date === today),
  }), [goal, health, settings?.waterGoal, settings?.dayCycle, settings?.macros, workoutLogs, today]); // eslint-disable-line react-hooks/exhaustive-deps
}
