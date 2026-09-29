// water.js — the water coach: one daily goal, and whether you're on pace for it
// at this hour. Pure functions. utils/waterGoal.js reads the saved profile.
//
// profile: { weight, weightUnit: 'kg' | 'lb', sex, activityHours, caffeineMg }

export const DEFAULT_WATER_PROFILE = { weight: 75, age: 25, sex: 'male', activityHours: 5, caffeineMg: 200, unit: 'ml' };
export const TRAINING_DAY_BONUS_ML = 500;

const round50 = (ml) => Math.round(ml / 50) * 50;
const LB_TO_KG = 0.45359237;

export function profileKg(profile) {
  const w = Number(profile?.weight) || DEFAULT_WATER_PROFILE.weight;
  return profile?.weightUnit === 'lb' ? w * LB_TO_KG : w;
}

/**
 * Daily goal in ml: 35 ml/kg (31 for women), plus the weekly training average,
 * plus caffeine above 200 mg, plus a training-day bonus when you trained today.
 * The weight unit is honoured (the old formula treated pounds as kilograms).
 */
export function calcWaterGoal(profile = DEFAULT_WATER_PROFILE, { trainedToday = false } = {}) {
  const kg = profileKg(profile);
  const base = kg * (profile.sex === 'female' ? 31 : 35);
  const activity = ((Number(profile.activityHours) || 0) / 7) * 500;
  const caffeine = Math.max(0, ((Number(profile.caffeineMg) || 0) - 200) * 1.5);
  return round50(base + activity + caffeine + (trainedToday ? TRAINING_DAY_BONUS_ML : 0));
}

const hoursOf = (hhmm, fallback) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? Number(m[1]) + Number(m[2]) / 60 : fallback;
};

/** Share of the day's water you should have had by `now`, over your waking hours. */
export function expectedFraction(now = new Date(), { wake = '07:00', bed = '22:00' } = {}) {
  const w = hoursOf(wake, 7);
  let b = hoursOf(bed, 22);
  if (b <= w) b = 22;            // a bedtime after midnight would otherwise invert the day
  const h = now.getHours() + now.getMinutes() / 60;
  if (h <= w) return 0;
  if (h >= b) return 1;
  return (h - w) / (b - w);
}

/**
 * Coaching line for the moment. status: 'done' | 'behind' | 'on-pace' | 'ahead'
 * | 'early'. `sipMl` is a sensible next amount when you're behind.
 */
export function waterAdvice({ totalMl, goalMl, now = new Date(), wake, bed }) {
  if (!(goalMl > 0)) return null;
  if (totalMl >= goalMl) return { status: 'done', message: 'Goal reached. Sip to thirst from here.', expectedMl: goalMl, sipMl: 0 };
  const fraction = expectedFraction(now, { wake, bed });
  const expectedMl = Math.round(goalMl * fraction);
  const behind = expectedMl - totalMl;
  if (fraction === 0) return { status: 'early', message: `${goalMl - totalMl} ml to go today. A glass with breakfast is a good start.`, expectedMl, sipMl: 0 };
  if (behind >= 250) {
    const sipMl = Math.min(750, Math.max(250, round50(behind)));
    return { status: 'behind', message: `${round50(behind)} ml behind pace. Have ${sipMl} ml now.`, expectedMl, sipMl };
  }
  if (behind <= -300) return { status: 'ahead', message: `Ahead of pace by ${round50(-behind)} ml. Nice.`, expectedMl, sipMl: 0 };
  return { status: 'on-pace', message: `On pace: ${totalMl} of about ${expectedMl} ml expected by now.`, expectedMl, sipMl: 0 };
}
