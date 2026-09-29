// waterGoal.js — the one place non-React code and screens read "today's water
// goal" from. Reads the saved water profile and whether you trained today, so
// the Water screen, Health overview, Home ring, Peak State, reminders and the
// assistant all agree (they used four different formulas before).
import { storage, STORAGE_KEYS } from './storage.js';
import { toLocalDateKey } from './localDate.js';
import { calcWaterGoal, DEFAULT_WATER_PROFILE } from '../domain/water.js';

export function trainedToday() {
  const today = toLocalDateKey(new Date());
  const logs = storage.get(STORAGE_KEYS.WORKOUT_LOGS, []);
  return Array.isArray(logs) && logs.some(l => l?.date === today);
}

/** Wake and bed times from the sleep schedule (defaults apply when unset). */
export function sleepWindow() {
  const s = storage.get(STORAGE_KEYS.SLEEP_SCHEDULE, null);
  return { wake: s?.wakeTime || '07:00', bed: s?.bedtime || '22:00' };
}

/**
 * Today's goal in ml. A saved profile wins; without one, an explicit
 * settings.waterGoal is honoured, else the default profile.
 */
export function currentWaterGoal(settings = null) {
  const profile = storage.get(STORAGE_KEYS.WATER_PROFILE, null);
  if (!profile && Number(settings?.waterGoal) > 0) return Number(settings.waterGoal);
  return calcWaterGoal(profile || DEFAULT_WATER_PROFILE, { trainedToday: trainedToday() });
}
