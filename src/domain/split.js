// split.js — suggest a weekly training schedule from "how many days can I train".
// Pure. The Split Planner (tabs/Workout.jsx) turns the result into a program.
//
// Programs store days as { mon: { splitType: 'push' | 'pull' | 'legs' | 'rest', label }, ... }.
// Only those three split types have exercises behind them, so the suggestion is
// a push / pull / legs rotation with the training days spread so hard days are
// not back to back when there is room. It is a starting point to edit.

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SHORT = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

// Training weekdays (0 = Monday) for each number of days a week.
const PATTERNS = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};
// The rotation each week follows, in order of the training days.
const ROTATION = {
  2: ['push', 'legs'],
  3: ['push', 'pull', 'legs'],
  4: ['push', 'pull', 'legs', 'push'],
  5: ['push', 'pull', 'legs', 'push', 'pull'],
  6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
};

export const isSupportedDays = (n) => Number.isInteger(n) && n >= 2 && n <= 6;

/**
 * The week as { mon: { splitType, label }, ... } for `daysPerWeek` (2-6), or
 * null for anything else. `names` maps split types to your own labels.
 */
export function suggestWeek(daysPerWeek, names = {}) {
  if (!isSupportedDays(daysPerWeek)) return null;
  const label = (t) => (t === 'rest' ? 'Rest' : names[t] || t[0].toUpperCase() + t.slice(1));
  const days = {};
  WEEKDAYS.forEach(k => { days[k] = { splitType: 'rest', label: label('rest') }; });
  PATTERNS[daysPerWeek].forEach((wd, i) => {
    const type = ROTATION[daysPerWeek][i];
    days[WEEKDAYS[wd]] = { splitType: type, label: label(type) };
  });
  return days;
}

/** "Mon Push · Wed Pull · Fri Legs" for a preview line (rest days left out). */
export function describeWeek(days) {
  if (!days) return '';
  return WEEKDAYS.filter(k => days[k] && days[k].splitType !== 'rest').map(k => `${SHORT[k]} ${days[k].label}`).join(' · ');
}
