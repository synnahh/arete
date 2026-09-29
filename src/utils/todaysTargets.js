// Today's macro targets, after the optional training-day / rest-day split
// (settings.dayCycle, rules in domain/goals.js cycleTargets). The stored base
// targets (macroGoal, proteinGoal, macros) never change; readers that show
// "today's goal" go through here. With the split off this returns the base.
//
// "Training day" = a workout is logged today, or the active program schedules
// one. Deciding from the schedule as well as the log keeps the target from
// jumping up after you train.
import { storage, STORAGE_KEYS } from './storage.js';
import { toLocalDateKey } from './localDate.js';
import { cycleTargets } from '../domain/goals.js';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function activeProgramDays() {
  const programs = storage.get(STORAGE_KEYS.PROGRAMS, []);
  const active = Array.isArray(programs) ? programs.find(p => p?.isActive) : null;
  return active?.days && typeof active.days === 'object' ? active.days : null;
}

/** Training days per week from the active program (rest days excluded), else null. */
export function scheduledTrainingDaysPerWeek() {
  const days = activeProgramDays();
  if (!days) return null;
  const n = DAY_KEYS.filter(k => days[k] && days[k].splitType && days[k].splitType !== 'rest').length;
  return n >= 1 && n <= 6 ? n : null;
}

export function isTrainingDay(now = new Date()) {
  const key = toLocalDateKey(now);
  const logs = storage.get(STORAGE_KEYS.WORKOUT_LOGS, []);
  if (Array.isArray(logs) && logs.some(l => l?.date === key)) return true;
  const day = activeProgramDays()?.[DAY_KEYS[now.getDay()]];
  return !!(day && day.splitType && day.splitType !== 'rest');
}

/** The stored targets, in the shape cycleTargets works on. */
export function baseTargets(settings) {
  return {
    kcal: Number(settings?.macros?.calories ?? settings?.macroGoal) || 2500,
    protein: Number(settings?.macros?.protein ?? settings?.proteinGoal) || 160,
    carbs: Number(settings?.macros?.carbs) || 250,
    fat: Number(settings?.macros?.fat) || 80,
  };
}

export function cycleFor(settings) {
  const bonus = Number(settings?.dayCycle?.trainingBonusKcal) || 0;
  if (bonus <= 0) return null;
  return { trainingBonusKcal: bonus, trainingDaysPerWeek: Number(settings?.dayCycle?.trainingDaysPerWeek) || scheduledTrainingDaysPerWeek() || 4 };
}

/** { kcal, protein, carbs, fat, kind: 'training'|'rest'|null, delta } for today. */
export function todaysTargets(settings, now = new Date()) {
  return cycleTargets(baseTargets(settings), cycleFor(settings), isTrainingDay(now));
}

/**
 * `settings` with macroGoal / proteinGoal / macros swapped for today's targets,
 * for screens that read those keys. Returns the same object when the split is off.
 */
export function withTodaysTargets(settings, now = new Date()) {
  if (!cycleFor(settings)) return settings;
  const t = todaysTargets(settings, now);
  return { ...settings, macroGoal: t.kcal, proteinGoal: t.protein, macros: { ...(settings?.macros || {}), calories: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat }, todayTargetKind: t.kind, todayTargetDelta: t.delta };
}
