// coachEngine.js — the coach as a data engine. Pure: your logs in, updates out.
// There is no assistant to talk to; the coach keeps the plan in step with what
// the data shows. Routine updates apply on their own (and can be undone); bigger
// ones wait for a tap. The hook that runs this is hooks/useCoachEngine.js, the
// feed that shows it is components/CoachUpdates.jsx.
//
// Rules (each has a cooldown so it never flip-flops):
//   maintenance  auto  Your real maintenance (intake vs weight trend, 70%+ of days
//                      logged over up to 4 weeks) differs from the plan's by 100+ kcal
//                      -> targets rebuilt from it at your current trend weight.
//   macros       auto  Trend weight has moved 3+ kg since targets were set
//                      -> protein and fat re-set for your weight, same maintenance.
//   water        auto  Your saved water profile is 2+ kg off your trend weight
//                      -> profile weight follows it, so the daily water goal does too.
//   goal-reached ask   Trend is within 0.5 kg of your goal weight -> switch to Recomp.
//   split        ask   You train at least 1.5 days a week fewer than your plan, three
//                      weeks running -> a split that fits the days you actually train.
//
// Update shape: { key, mode: 'auto' | 'ask', title, doneTitle?, why, apply }
//   apply: { type: 'goal', goal }  or  { type: 'split', days }  or  { type: 'water', profile }
// Log entry (settings.coachLog): { id, key, status: 'applied' | 'undone' | 'dismissed',
//   at, title, why, before, after }

import { adaptiveMaintenance, makeGoal, GOAL_TEMPLATES } from './goals.js';
import { weightCoach } from './weight.js';
import { calcWaterGoal, profileKg } from './water.js';
import { dayIndex } from '../utils/dayIndex.js';

export const COOLDOWN_DAYS = { maintenance: 14, macros: 14, 'goal-reached': 30, split: 28, water: 21 };
export const LOG_LIMIT = 30;
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const round1 = (n) => +Number(n).toFixed(1);

/** Days since the last log entry for `key` (any status), or null if none. */
function daysSinceLast(log = [], key, today) {
  const t = dayIndex(today);
  const last = log.filter(e => e?.key === key && e.at).map(e => dayIndex(String(e.at).slice(0, 10))).filter(x => x != null).sort((a, b) => b - a)[0];
  return last == null || t == null ? null : t - last;
}
const coolingDown = (log, key, today) => { const d = daysSinceLast(log, key, today); return d != null && d < COOLDOWN_DAYS[key]; };

/** Keep what the user set by hand when rebuilding a goal. */
function rebuilt(goal, { weightKg, maintenanceKcal, maintenanceSource }) {
  const next = makeGoal({
    template: goal.template, customText: goal.customText || '', startedOn: goal.startedOn,
    weightKg, maintenanceKcal, maintenanceSource, targetWeightKg: goal.targetWeightKg,
  });
  if (!next) return null;
  return { ...next, startWeightKg: goal.startWeightKg, targetsWeightKg: round1(weightKg) };
}

/** Scheduled training days per week in a program, or 0. */
export const plannedDays = (program) => DAYS.filter(d => program?.days?.[d]?.splitType && program.days[d].splitType !== 'rest').length;

/**
 * Updates the data supports today. `data`:
 *   { goal, weights: [{date, weight}], nutrition: [{date, calories}], workouts: [{date}],
 *     program (the active one or null), log: settings.coachLog, today }
 */
export function coachUpdates(data = {}) {
  const { goal, weights = [], nutrition = [], workouts = [], program = null, waterProfile = null, log = [], today } = data;
  const t = dayIndex(today);
  const out = [];
  if (t == null) return out;

  if (goal?.targets && GOAL_TEMPLATES[goal.template]) {
    const coach = weightCoach(weights, goal.targets.weeklyRateKg ?? null, goal.targetWeightKg ?? null, today);
    const trend = coach?.trend ?? null;
    const goalAge = dayIndex(goal.startedOn) != null ? t - dayIndex(goal.startedOn) : 0;

    // Real maintenance: only after two weeks on the goal, so the first estimate gets a fair run.
    const adaptive = goalAge >= 14 && trend ? adaptiveMaintenance(weights, nutrition, { today }) : null;
    const drift = adaptive ? adaptive.kcal - goal.maintenanceKcal : 0;
    if (adaptive && Math.abs(drift) >= 100 && !coolingDown(log, 'maintenance', today)) {
      const next = rebuilt(goal, { weightKg: trend, maintenanceKcal: adaptive.kcal, maintenanceSource: 'adaptive' });
      if (next && next.targets.kcal !== goal.targets.kcal) {
        const change = next.targets.kcal - goal.targets.kcal;
        out.push({
          key: 'maintenance', mode: 'auto',
          title: `Calories ${change > 0 ? 'up' : 'down'} to ${next.targets.kcal} kcal`,
          why: `Over the last ${adaptive.days} days you averaged ${adaptive.avgIntake} kcal and your weight moved ${adaptive.slopeKgPerWeek > 0 ? '+' : ''}${adaptive.slopeKgPerWeek} kg a week, so your real maintenance is about ${adaptive.kcal} kcal, not ${goal.maintenanceKcal}. Targets rebuilt from that.`,
          apply: { type: 'goal', goal: next },
        });
      }
    }

    // Weight moved a lot: protein and fat follow bodyweight.
    const basis = Number(goal.targetsWeightKg ?? goal.startWeightKg);
    if (trend && basis > 0 && Math.abs(trend - basis) >= 3 && !out.some(u => u.apply.type === 'goal') && !coolingDown(log, 'macros', today)) {
      const next = rebuilt(goal, { weightKg: trend, maintenanceKcal: goal.maintenanceKcal, maintenanceSource: goal.maintenanceSource });
      if (next && (next.targets.protein !== goal.targets.protein || next.targets.fat !== goal.targets.fat)) {
        out.push({
          key: 'macros', mode: 'auto',
          title: `Protein now ${next.targets.protein} g, fat ${next.targets.fat} g`,
          why: `Your trend weight is ${round1(trend)} kg, ${round1(Math.abs(trend - basis))} kg ${trend < basis ? 'down' : 'up'} from when targets were set, so protein and fat were re-set for your current weight.`,
          apply: { type: 'goal', goal: next },
        });
      }
    }

    // Goal weight reached: holding it is a different plan, so ask.
    const target = Number(goal.targetWeightKg);
    if (trend && target > 0 && goal.template !== 'recomp' && Math.abs(trend - target) <= 0.5 && !coolingDown(log, 'goal-reached', today)) {
      const next = makeGoal({ template: 'recomp', weightKg: trend, maintenanceKcal: goal.maintenanceKcal, maintenanceSource: goal.maintenanceSource, startedOn: today });
      if (next) {
        out.push({
          key: 'goal-reached', mode: 'ask',
          title: `You've reached ${target} kg. Switch to holding it?`,
          doneTitle: `Switched to Recomp to hold ${target} kg`,
          why: `Your trend is ${round1(trend)} kg. Recomp eats at maintenance (${next.targets.kcal} kcal) with high protein, so you keep the weight and keep building muscle.`,
          apply: { type: 'goal', goal: { ...next, targetsWeightKg: round1(trend) } },
        });
      }
    }
  }

  // Water goal follows bodyweight. Only touches a profile you saved, and only while the
  // weight has real data behind it (goal or not).
  if (waterProfile && Number(waterProfile.weight) > 0 && !coolingDown(log, 'water', today)) {
    const trend = weightCoach(weights, null, null, today)?.trend ?? null;
    const lb = waterProfile.weightUnit === 'lb';
    const kg = profileKg(waterProfile);
    if (trend && Math.abs(trend - kg) >= 2) {
      const weight = round1(lb ? trend / 0.45359237 : trend);
      const profile = { ...waterProfile, weight };
      const from = calcWaterGoal(waterProfile), to = calcWaterGoal(profile);
      if (from !== to) {
        out.push({
          key: 'water', mode: 'auto',
          title: `Water goal ${to > from ? 'up' : 'down'} to ${(to / 1000).toFixed(2).replace(/0$/, '')} L`,
          why: `Your water profile said ${round1(lb ? kg / 0.45359237 : kg)} ${lb ? 'lb' : 'kg'} but your trend weight is ${weight} ${lb ? 'lb' : 'kg'}, so the daily goal moved from ${from} to ${to} ml.`,
          apply: { type: 'water', profile },
        });
      }
    }
  }

  // Training fewer days than planned, three weeks running.
  const planned = plannedDays(program);
  if (planned >= 3 && !coolingDown(log, 'split', today)) {
    const weekly = [0, 1, 2].map(w => new Set(workouts.map(x => dayIndex(x?.date)).filter(i => i != null && i <= t - w * 7 && i > t - (w + 1) * 7)).size);
    const avg = weekly.reduce((s, n) => s + n, 0) / 3;
    const everyWeekShort = weekly.every(n => n <= planned - 1);
    const suggested = Math.max(2, Math.min(6, Math.round(avg)));
    if (everyWeekShort && avg > 0 && planned - avg >= 1.5 && suggested < planned) {
      out.push({
        key: 'split', mode: 'ask',
        title: `Switch to a ${suggested}-day split?`,
        doneTitle: `Switched to a ${suggested}-day split`,
        why: `Your plan has ${planned} training days, but you've trained ${weekly.slice().reverse().join(', ')} days in the last three weeks. A ${suggested}-day plan fits the weeks you actually have, so each session covers more.`,
        apply: { type: 'split', days: suggested },
      });
    }
  }
  return out;
}

/** A log entry for an update that was applied, undone or dismissed. */
export function logEntry(update, status, { before = null, after = null, at = new Date().toISOString(), id } = {}) {
  // An applied question reads as what was done ("Switched to ..."), not as the question.
  const title = status === 'applied' && update.doneTitle ? update.doneTitle : update.title;
  return { id: id ?? `cu_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, key: update.key, status, at, title, why: update.why, before, after };
}

/** Add an entry, newest first, capped. */
export const pushLog = (log = [], entry) => [entry, ...(Array.isArray(log) ? log : [])].slice(0, LOG_LIMIT);

/**
 * Can this applied goal change still be undone? Only the newest applied goal change,
 * and only while the goal is still exactly what it set (so undo never overwrites a
 * change made since, by hand or by the coach).
 */
export function canUndo(entry, log = [], currentGoal) {
  if (entry?.status !== 'applied' || !entry.before || !entry.after?.goal) return false;
  const newestGoalChange = log.find(e => e.status === 'applied' && e.after?.goal);
  if (newestGoalChange?.id !== entry.id) return false;
  return JSON.stringify(currentGoal ?? null) === JSON.stringify(entry.after.goal);
}
