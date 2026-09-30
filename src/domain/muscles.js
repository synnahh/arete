// muscles.js — which muscles an exercise trains. One table for the Muscle Ranking
// (tabs/Workout.jsx), the recovery map, and the exercise picker's additions.
// Unknown or custom exercises fall back to their split day's muscle groups.

export const MUSCLE_IDS = ['chest', 'shoulders', 'triceps', 'back', 'biceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'calves'];
export const MUSCLE_LABEL = {
  chest: 'Chest', shoulders: 'Shoulders', triceps: 'Triceps', back: 'Back', biceps: 'Biceps', forearms: 'Forearms',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
};

// Fallback: each split day-type -> muscle groups (custom exercises and old logs).
export const MUSCLE_MAP = {
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps', 'forearms'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
};

// Primary movers per exercise: a logged set credits exactly these muscles.
export const EXERCISE_MUSCLES = {
  'Bench Press':       ['chest', 'triceps', 'shoulders'],
  'Overhead Press':    ['shoulders', 'triceps'],
  'Dips':              ['chest', 'triceps'],
  'Push Press':        ['shoulders', 'triceps'],
  'DB Shoulder Press': ['shoulders', 'triceps'],
  'Deadlift':          ['back', 'hamstrings', 'glutes'],
  'Pull-ups':          ['back', 'biceps'],
  'Barbell Row':       ['back', 'biceps'],
  'Lat Pulldown':      ['back', 'biceps'],
  'Face Pulls':        ['shoulders', 'back'],
  'Barbell Squat':     ['quads', 'glutes'],
  'Romanian Deadlift': ['hamstrings', 'glutes'],
  'Leg Press':         ['quads', 'glutes'],
  'Leg Curl':          ['hamstrings'],
  'Walking Lunges':    ['quads', 'glutes'],
  'Calf Raises':       ['calves'],
  // Added by the exercise picker (domain/exercisePick.js)
  'DB Bench Press':        ['chest', 'triceps', 'shoulders'],
  'Cable Fly':             ['chest'],
  'Lateral Raise':         ['shoulders'],
  'Triceps Pushdown':      ['triceps'],
  'Overhead Triceps Ext.': ['triceps'],
  'Push-ups':              ['chest', 'triceps', 'shoulders'],
  'Pike Push-ups':         ['shoulders', 'triceps'],
  'Bench Dips':            ['triceps'],
  'One-arm DB Row':        ['back', 'biceps'],
  'Seated Cable Row':      ['back', 'biceps'],
  'Rear Delt Fly':         ['shoulders', 'back'],
  'Barbell Curl':          ['biceps', 'forearms'],
  'DB Curl':               ['biceps', 'forearms'],
  'Chin-ups':              ['back', 'biceps'],
  'Inverted Row':          ['back', 'biceps'],
  'Superman Hold':         ['back', 'glutes'],
  'Goblet Squat':          ['quads', 'glutes'],
  'Leg Extension':         ['quads'],
  'Bulgarian Split Squat': ['quads', 'glutes'],
  'Hip Thrust':            ['glutes', 'hamstrings'],
  'Glute Bridge':          ['glutes', 'hamstrings'],
};

/** Muscles for an exercise entry ({ name, day }). */
export const musclesForExercise = (ex) => EXERCISE_MUSCLES[ex?.name] || MUSCLE_MAP[ex?.day] || [];

/** Muscles a single logged set/exercise trained, most specific first. */
export function musclesForLog(log) {
  if (Array.isArray(log?.muscles) && log.muscles.length) return log.muscles;
  if (log?.exerciseName && EXERCISE_MUSCLES[log.exerciseName]) return EXERCISE_MUSCLES[log.exerciseName];
  const split = log?.splitType || log?.day || log?.muscle;
  return MUSCLE_MAP[split] || [];
}
