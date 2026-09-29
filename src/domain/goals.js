// goals.js — Coach goal model: one locked goal, a target set derived from it,
// and an adaptive maintenance estimate from real weight trend and intake.
// Pure functions only; Goal HQ (src/tabs/GoalHQ.jsx) does the UI and saving.

export const GOAL_TEMPLATES = {
  cut: {
    label: 'Cut', blurb: 'Lose fat, keep your strength',
    energyDelta: -0.20, proteinPerKg: 2.2, fatPerKg: 0.8, weeklyRatePct: -0.75,
    training: 'Keep the heavy compounds, trim volume only if recovery drops',
  },
  bulk: {
    label: 'Bulk', blurb: 'Build muscle with a lean surplus',
    energyDelta: 0.10, proteinPerKg: 1.8, fatPerKg: 1.0, weeklyRatePct: 0.35,
    training: 'Volume-focused hypertrophy with progressive overload',
  },
  recomp: {
    label: 'Recomp', blurb: 'Lose fat and gain muscle at maintenance',
    energyDelta: 0, proteinPerKg: 2.2, fatPerKg: 0.9, weeklyRatePct: 0,
    training: 'Progressive overload is the priority; the scale barely moves',
  },
  glowup: {
    label: 'Glow-up', blurb: 'Look sharper: leaner, better skin, posture, style',
    energyDelta: -0.10, proteinPerKg: 2.0, fatPerKg: 0.9, weeklyRatePct: -0.4,
    training: 'Physique and posture work; Look section leads',
  },
};

export const TEMPLATE_IDS = Object.keys(GOAL_TEMPLATES);

// kcal per kg of body-mass change, the standard working figure.
export const KCAL_PER_KG = 7700;

const round = (n, step) => Math.round(n / step) * step;

/**
 * Rough maintenance when nothing better is known: bodyweight × 32 kcal
 * (moderately active). Always labelled an estimate in the UI.
 */
export function estimateMaintenance(weightKg) {
  if (!(weightKg > 0)) return null;
  return round(weightKg * 32, 10);
}

/** Daily targets for a template at a bodyweight and maintenance. */
export function computeTargets(templateId, { weightKg, maintenanceKcal } = {}) {
  const t = GOAL_TEMPLATES[templateId];
  if (!t || !(weightKg > 0) || !(maintenanceKcal > 0)) return null;
  const kcal    = round(maintenanceKcal * (1 + t.energyDelta), 10);
  const protein = round(weightKg * t.proteinPerKg, 5);
  // Fat floor: at least 20% of energy, whichever is higher.
  const fat     = round(Math.max(weightKg * t.fatPerKg, (kcal * 0.2) / 9), 5);
  const carbs   = Math.max(0, round((kcal - protein * 4 - fat * 9) / 4, 5));
  return {
    kcal, protein, fat, carbs,
    weeklyRatePct: t.weeklyRatePct,
    weeklyRateKg: +((weightKg * t.weeklyRatePct) / 100).toFixed(2),
  };
}

const dayIndex = (dateKey) => {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

/**
 * Maintenance from what actually happened: average logged intake minus the
 * energy in the weight trend (least-squares slope over the window).
 * Needs at least `minDays` between first and last weigh-in, 4+ weigh-ins, and
 * intake logged on at least 70% of the days in the window; otherwise null.
 *
 * weights: [{ date: 'YYYY-MM-DD', weight: kg }]
 * intakes: [{ date: 'YYYY-MM-DD', calories }]  (several entries per day are summed)
 */
export function adaptiveMaintenance(weights = [], intakes = [], { minDays = 14, windowDays = 28, today = null } = {}) {
  const valid = weights.filter(w => w?.date && Number(w.weight) > 0);
  if (!valid.length) return null;
  const end   = today ? dayIndex(today) : Math.max(...valid.map(w => dayIndex(w.date)));
  const start = end - windowDays + 1;

  const pts = valid
    .map(w => ({ x: dayIndex(w.date), y: Number(w.weight) }))
    .filter(p => p.x >= start && p.x <= end);
  if (pts.length < 4) return null;
  const span = Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x));
  if (span < minDays - 1) return null;

  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const slope = sxx ? pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx : 0; // kg/day

  const firstX = Math.min(...pts.map(p => p.x));
  const perDay = new Map();
  for (const i of intakes) {
    if (!i?.date || !(Number(i.calories) > 0)) continue;
    const x = dayIndex(i.date);
    if (x < firstX || x > end) continue;
    perDay.set(x, (perDay.get(x) || 0) + Number(i.calories));
  }
  const windowLen = end - firstX + 1;
  if (perDay.size < Math.ceil(windowLen * 0.7)) return null;
  const avgIntake = [...perDay.values()].reduce((s, v) => s + v, 0) / perDay.size;

  return {
    kcal: round(avgIntake - slope * KCAL_PER_KG, 10),
    avgIntake: Math.round(avgIntake),
    slopeKgPerWeek: +(slope * 7).toFixed(2),
    days: windowLen,
    loggedDays: perDay.size,
  };
}

/** A goal record ready to store in settings.coachGoal. */
export function makeGoal({ template, customText = '', weightKg, maintenanceKcal, maintenanceSource = 'estimate', startedOn, targetWeightKg = null }) {
  const targets = computeTargets(template, { weightKg, maintenanceKcal });
  if (!targets) return null;
  return {
    template, customText: customText.trim(), startedOn,
    startWeightKg: weightKg, maintenanceKcal, maintenanceSource, targets,
    ...(Number(targetWeightKg) > 0 ? { targetWeightKg: Number(targetWeightKg) } : {}),
  };
}

/**
 * Training-day / rest-day targets ("carb cycling" without the jargon).
 * `cycle` = { trainingBonusKcal, trainingDaysPerWeek }. Training days get the
 * bonus, in carbs; rest days give up enough that the WEEKLY average stays on
 * the base target. Protein and fat never move. Rest days never lose more than
 * half of the base carbs: if the asked-for bonus would do that, the bonus is
 * scaled down (`capped`) so the weekly total still balances. Off (base
 * unchanged) when the bonus is 0 or there is no training/rest split.
 */
export function cycleTargets(base, cycle, trained) {
  const asked = Number(cycle?.trainingBonusKcal) || 0;
  const days = Math.round(Number(cycle?.trainingDaysPerWeek) || 4);
  if (!base || asked <= 0 || days < 1 || days > 6) return { ...base, kind: null, delta: 0 };
  const maxRestCut = (base.carbs || 0) * 4 * 0.5;
  const bonus = Math.min(asked, (maxRestCut * (7 - days)) / days);
  if (bonus < 25) return { ...base, kind: null, delta: 0 };
  const capped = bonus < asked;
  const rest = -Math.round((bonus * days) / (7 - days));
  const delta = trained ? bonus : rest;
  const carbs = Math.max(0, Math.round((base.carbs || 0) + delta / 4));
  const applied = Math.round((carbs - (base.carbs || 0)) * 4);
  return { ...base, carbs, kcal: base.kcal + applied, kind: trained ? 'training' : 'rest', delta: applied, capped };
}

/**
 * Settings keys the rest of the app already reads (Fuel, meal planner,
 * Peak State, notifications, phone Health), kept in step with the goal.
 */
export function settingsForGoal(goal, currentMacros = {}) {
  const { kcal, protein, carbs, fat } = goal.targets;
  return {
    coachGoal: goal,
    macroGoal: kcal,
    proteinGoal: protein,
    macros: { ...currentMacros, calories: kcal, protein, carbs, fat },
  };
}

/**
 * Today's score against the goal (Home goal ring): the average of how far
 * each factor is toward its target, 0–100. Calories count as on-target when
 * close to the goal in either direction; everything else caps at 100%.
 * Missing data counts as 0 so the ring fills as the day is logged.
 */
export function dayScore({ targets, calories = 0, protein = 0, waterMl = 0, waterGoalMl = 2500, sleepHours = 0, trained = false }) {
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const factors = [
    { id: 'training', label: 'Training', pct: trained ? 1 : 0, value: trained ? 'Done' : 'Not yet' },
    { id: 'protein',  label: 'Protein',  pct: clamp(protein / targets.protein), value: `${Math.round(protein)}/${targets.protein} g` },
    { id: 'calories', label: 'Calories', pct: calories ? clamp(1 - Math.abs(calories - targets.kcal) / targets.kcal) : 0, value: `${Math.round(calories)}/${targets.kcal}` },
    { id: 'water',    label: 'Water',    pct: clamp(waterMl / waterGoalMl), value: `${(waterMl / 1000).toFixed(1)}/${(waterGoalMl / 1000).toFixed(1)} L` },
    { id: 'sleep',    label: 'Sleep',    pct: clamp(sleepHours / 8), value: sleepHours ? `${Math.floor(sleepHours)}h ${Math.round((sleepHours % 1) * 60)}m` : '—' },
  ];
  const score = Math.round((factors.reduce((s, f) => s + f.pct, 0) / factors.length) * 100);
  return { score, factors };
}
