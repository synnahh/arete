// plates.js — barbell maths for the Train cards: which plates go on each side,
// and a warm-up ramp toward the working weight. Pure; suggestions only.

export const DEFAULT_BAR_KG = 20;
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

const r2 = (n) => Math.round(n * 100) / 100;

/** Does this exercise name look like a barbell lift (so a plate breakdown makes sense)? */
export function isBarbell(name) {
  const n = String(name || '');
  if (/\b(db|dumbbell|machine|cable|smith|kettlebell|band|pulldown|pull-?up|dip|push-?up)\b/i.test(n)) return false;
  return /\b(barbell|bench press|squat|deadlift|overhead press|ohp|push press|row|rdl|romanian)\b/i.test(n);
}

/**
 * Plates for each side to reach `target` kg on a bar of `bar` kg, greedy from
 * the biggest plate. Returns { perSide: [25, 10, 2.5], total, short } where
 * `short` is what the available plates cannot make up (0 when exact), and
 * null when the target is below the bar or not a number.
 */
export function platesFor(target, { bar = DEFAULT_BAR_KG, plates = DEFAULT_PLATES_KG } = {}) {
  const t = Number(target), b = Number(bar);
  if (!(t >= b) || !(b > 0)) return null;
  let left = r2((t - b) / 2);
  const perSide = [];
  for (const p of [...plates].sort((x, y) => y - x)) {
    while (left >= p - 1e-9) { perSide.push(p); left = r2(left - p); }
  }
  return { perSide, total: r2(b + perSide.reduce((s, p) => s + p, 0) * 2), short: r2(left * 2) };
}

/**
 * A warm-up ramp toward the working weight: the empty bar, then about 40%,
 * 60% and 80% of it, with fewer reps as it gets heavier. Weights round to the
 * smallest jump the plates allow. Empty when the working weight is barely
 * above the bar (nothing to warm up to).
 */
export function warmupSets(workWeight, { bar = DEFAULT_BAR_KG, step = 2.5 } = {}) {
  const w = Number(workWeight);
  if (!(w > bar * 1.5)) return [];
  const round = (x) => Math.max(bar, Math.round(x / step) * step);
  const ramp = [{ weight: bar, reps: 10 }, { weight: round(w * 0.4), reps: 5 }, { weight: round(w * 0.6), reps: 3 }, { weight: round(w * 0.8), reps: 2 }];
  // Drop steps that collapse onto the previous one or reach the working weight.
  return ramp.filter((s, i) => s.weight < w && (i === 0 || s.weight > ramp[i - 1].weight));
}

/**
 * Plates typed as "25, 20, 15, 10, 5, 2.5, 1.25" (commas, spaces or semicolons)
 * into a clean list: positive numbers up to 50 kg, no duplicates, biggest
 * first, at most 12. Null when nothing usable was typed.
 */
export function parsePlates(text) {
  const nums = String(text ?? '').split(/[\s,;]+/).map(Number).filter(n => Number.isFinite(n) && n > 0 && n <= 50);
  const list = [...new Set(nums.map(n => Math.round(n * 100) / 100))].sort((a, b) => b - a).slice(0, 12);
  return list.length ? list : null;
}

/** Bar weight from a setting: 5-30 kg, else the default. */
export function barFrom(value) {
  const n = Number(value);
  return n >= 5 && n <= 30 ? n : DEFAULT_BAR_KG;
}
