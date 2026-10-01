// coachToday.js — the numbers behind the Coach front page. Pure; UI is tabs/CoachToday.jsx.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round = (n) => Math.round(n);

/** Today's eaten totals from nutrition rows dated `today`. */
export function eatenToday(nutrition = [], today) {
  const sum = (k) => round(nutrition.filter(n => n?.date === today).reduce((s, n) => s + num(n?.[k]), 0));
  return { calories: sum('calories'), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat') };
}

/**
 * One bar per macro: have, want, left, pct (0-100, capped), and state:
 *   'under' (below 90% of target), 'on' (90-110%), 'over' (above 110%).
 * Macros with no target are left out. Calories and protein come first.
 */
export function macroBars(targets, eaten) {
  const rows = [['calories', 'Calories', 'kcal'], ['protein', 'Protein', 'g'], ['carbs', 'Carbs', 'g'], ['fat', 'Fat', 'g']];
  const keyOf = { calories: 'kcal', protein: 'protein', carbs: 'carbs', fat: 'fat' };
  return rows
    .map(([id, label, unit]) => {
      const want = num(targets?.[keyOf[id]]);
      const have = num(eaten?.[id]);
      if (!(want > 0)) return null;
      const ratio = have / want;
      return { id, label, unit, have, want, left: Math.max(0, round(want - have)), over: Math.max(0, round(have - want)), pct: Math.min(100, round(ratio * 100)), state: ratio > 1.1 ? 'over' : ratio >= 0.9 ? 'on' : 'under' };
    })
    .filter(Boolean);
}

/** Water: have, goal, pct and ml left (never negative). */
export function waterBar(totalMl, goalMl) {
  const have = round(num(totalMl)), want = round(num(goalMl));
  if (!(want > 0)) return null;
  return { have, want, left: Math.max(0, want - have), pct: Math.min(100, round((have / want) * 100)) };
}

/** Which week of the goal this is (week 1 = the first 7 days). Null without a valid start date. */
export function goalWeek(startedOn, today) {
  const a = Date.parse(`${startedOn}T00:00:00Z`), b = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.floor((b - a) / (7 * 86400000)) + 1;
}

/** Today's training state from the active program and the workout log. */
export function sessionToday({ program, weekdayKey, workouts = [], today }) {
  const day = program?.days?.[weekdayKey];
  const planned = !!(day?.splitType && day.splitType !== 'rest');
  const logged = workouts.filter(w => w?.date === today);
  return {
    hasProgram: !!program,
    planned,
    label: planned ? (day.label || day.splitType) : null,
    done: logged.length > 0,
    exercises: logged.length,
  };
}
