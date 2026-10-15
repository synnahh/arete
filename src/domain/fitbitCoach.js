// fitbitCoach.js — reads what the Fitbit Air (via Google Health > Apple Health > Health Auto Export)
// and the Eufy scale report, and turns it into advice and proposed changes. No AI: fixed rules on
// the numbers, each with the evidence in plain words. Pure.
//
//   fitbitRead()     "what I can see": days of data, baselines, trends, and what is missing.
//   fitbitUpdates()  proposals in the same shape as coachEngine.coachUpdates, so they flow through the
//                    existing Coach updates card (Apply / Not now / Undo, cooldowns, the log):
//     recovery          resting HR up, HRV down or short sleep for days  -> go lighter today (advice)
//     sleep-debt        a week of short sleep                            -> advice
//     fitbit-maintenance real activity says your calories are off        -> new calorie targets (goal)
//     hr-trend          resting HR climbing across weeks on a 5+ day plan -> one fewer training day (split)
//
// Rules of thumb are conservative on purpose: a proposal needs several days of readings, never one
// odd night, and anything that changes your targets or split asks first.

import { dayIndex } from '../utils/dayIndex.js';
import { bmr, ageFrom } from './intake.js';
import { makeGoal } from './goals.js';
import { weightCoach } from './weight.js';
import { plannedDays } from './coachEngine.js';

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const r0 = (n) => Math.round(n);
const r1 = (n) => Math.round(n * 10) / 10;
const num = (v) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);

/** [{ date, v }] oldest first from health rows ({ date, data }) using `pick(data)`. */
export function healthSeries(rows = [], pick) {
  const out = [];
  for (const r of rows) {
    const v = num(pick(r.data || {}));
    if (v != null && v > 0 && r.date) out.push({ date: r.date, v });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export const picks = {
  steps: (d) => d.steps,
  activeEnergy: (d) => d.activeEnergy,
  rhr: (d) => d.restingHeartRate,
  hrv: (d) => d.hrv,
};

/** Nights of sleep as [{ date, v hours }] from sleep_data items (duration is minutes). */
export function sleepSeries(sleep = []) {
  const by = new Map();
  for (const s of sleep) {
    const m = num(s?.duration);
    const date = String(s?.date || '').slice(0, 10);
    if (m == null || m < 60 || !date) continue;
    by.set(date, Math.max(by.get(date) || 0, m / 60));
  }
  return [...by.entries()].map(([date, v]) => ({ date, v })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Recent readings against the days before them: { recent, base, delta, ratio, nRecent, nBase } or null.
 * recent = mean of the last `recentDays` days up to today; base = mean of the `baseDays` days before that.
 */
export function compare(series, today, { recentDays = 3, baseDays = 14, minBase = 5 } = {}) {
  const t = dayIndex(today);
  if (t == null) return null;
  const recent = series.filter(p => { const i = dayIndex(p.date); return i != null && i <= t && i > t - recentDays; });
  const base = series.filter(p => { const i = dayIndex(p.date); return i != null && i <= t - recentDays && i > t - recentDays - baseDays; });
  if (!recent.length || base.length < minBase) return null;
  const a = mean(recent.map(p => p.v)), b = mean(base.map(p => p.v));
  return { recent: a, base: b, delta: a - b, ratio: a / b, nRecent: recent.length, nBase: base.length };
}

const lastDays = (series, today, n) => { const t = dayIndex(today); return series.filter(p => { const i = dayIndex(p.date); return i != null && i <= t && i > t - n; }); };

// ── What is being read ───────────────────────────────────────────────────────

/**
 * A plain summary of what Arete can see from the Fitbit/phone/scale data and what it means.
 * Returns { days, lines: [{ id, label, text, tone }], missing: [string] }. tone: good | warn | flat.
 */
export function fitbitRead({ health = [], sleep = [], today } = {}) {
  const lines = [], missing = [];
  const days = new Set(health.filter(r => Object.keys(r.data || {}).length).map(r => r.date)).size;

  const steps = lastDays(healthSeries(health, picks.steps), today, 7);
  if (steps.length >= 3) lines.push({ id: 'steps', label: 'Steps', text: `${r0(mean(steps.map(p => p.v))).toLocaleString('en-AU')} a day over the last ${steps.length} days`, tone: 'flat' });
  else missing.push('steps (needs 3 days)');

  const act = lastDays(healthSeries(health, picks.activeEnergy), today, 7);
  if (act.length >= 3) lines.push({ id: 'active', label: 'Active energy', text: `about ${r0(mean(act.map(p => p.v)))} kcal a day above resting`, tone: 'flat' });

  const rhr = compare(healthSeries(health, picks.rhr), today);
  if (rhr) lines.push({ id: 'rhr', label: 'Resting heart rate', text: `${r0(rhr.recent)} bpm lately vs ${r0(rhr.base)} before (${rhr.delta >= 0 ? '+' : ''}${r1(rhr.delta)})`, tone: rhr.delta >= 4 ? 'warn' : rhr.delta <= -2 ? 'good' : 'flat' });
  else missing.push('resting heart rate (needs about a week)');

  const hrv = compare(healthSeries(health, picks.hrv), today);
  if (hrv) lines.push({ id: 'hrv', label: 'HRV', text: `${r0(hrv.recent)} ms lately vs ${r0(hrv.base)} before`, tone: hrv.ratio <= 0.85 ? 'warn' : hrv.ratio >= 1.1 ? 'good' : 'flat' });

  const nights = lastDays(sleepSeries(sleep), today, 7);
  if (nights.length >= 3) {
    const avg = mean(nights.map(p => p.v));
    lines.push({ id: 'sleep', label: 'Sleep', text: `${r1(avg)} h a night over ${nights.length} nights`, tone: avg < 6.5 ? 'warn' : avg >= 7.5 ? 'good' : 'flat' });
  } else missing.push('sleep (needs 3 nights)');

  return { days, lines, missing };
}

// ── What to change ───────────────────────────────────────────────────────────

/**
 * Proposals from the Fitbit/phone readings. `data`:
 *   { goal, profile (settings.profile), health: [{date,data}], sleep: sleep_data items,
 *     weights: [{date,weight}], program, log, today, cooling: (log,key,today)=>bool }
 * Same shape as coachEngine.coachUpdates: { key, mode, title, why, apply, applyLabel? }.
 */
export function fitbitUpdates(data = {}) {
  const { goal, profile = {}, health = [], sleep = [], weights = [], program = null, log = [], today, cooling = () => false } = data;
  const out = [];
  if (dayIndex(today) == null || !health.length && !sleep.length) return out;

  // 1. Recovery: two of three signals, or a big jump in resting heart rate.
  if (!cooling(log, 'recovery', today)) {
    const rhr = compare(healthSeries(health, picks.rhr), today);
    const hrv = compare(healthSeries(health, picks.hrv), today);
    const nights = lastDays(sleepSeries(sleep), today, 3);
    const sleepAvg = nights.length >= 2 ? mean(nights.map(p => p.v)) : null;
    const reasons = [];
    if (rhr && rhr.delta >= 5) reasons.push(`resting heart rate ${r0(rhr.recent)} bpm, ${r0(rhr.delta)} above your usual ${r0(rhr.base)}`);
    if (hrv && hrv.ratio <= 0.8) reasons.push(`HRV ${r0(hrv.recent)} ms, down ${r0((1 - hrv.ratio) * 100)}% from your usual ${r0(hrv.base)}`);
    if (sleepAvg != null && sleepAvg < 6) reasons.push(`only ${r1(sleepAvg)} h of sleep a night for the last ${nights.length} nights`);
    if (reasons.length >= 2 || (rhr && rhr.delta >= 7)) {
      out.push({
        key: 'recovery', mode: 'ask', applyLabel: 'Got it',
        title: 'Go lighter today',
        doneTitle: 'Took a lighter day',
        why: `Your Fitbit shows ${reasons.join(' and ')}. That pattern usually means you are not recovered. Today: keep the first sets of your main lifts, drop the last set of each exercise, stop 3 reps short of failure, and skip any new personal-best attempt. Normal training can resume when these numbers settle.`,
        apply: { type: 'advice' },
      });
    }
  }

  // 2. A week of short sleep.
  const week = lastDays(sleepSeries(sleep), today, 7);
  if (week.length >= 5 && !cooling(log, 'sleep-debt', today)) {
    const avg = mean(week.map(p => p.v));
    if (avg < 6.3) {
      out.push({
        key: 'sleep-debt', mode: 'ask', applyLabel: 'Got it',
        title: `Sleep is short: ${r1(avg)} h a night`,
        doneTitle: 'Noted the short sleep',
        why: `Over the last ${week.length} nights you averaged ${r1(avg)} h. Under about 7 h, strength and muscle gain suffer and hunger runs higher. The most useful fix is a fixed bedtime that gives you 7.5 h in bed, before anything else in the plan changes. Until the average is back above 7 h, treat hard sets as optional on days after a short night.`,
        apply: { type: 'advice' },
      });
    }
  }

  // 3. Real activity says your maintenance calories are off.
  const p = profile || {};
  const age = ageFrom(p.birthDate, today);
  const trend = weightCoach(weights, goal?.targets?.weeklyRateKg ?? null, goal?.targetWeightKg ?? null, today)?.trend ?? null;
  if (goal?.targets && goal.maintenanceSource !== 'adaptive' && trend && age != null && p.heightCm && p.sex && !cooling(log, 'fitbit-maintenance', today)) {
    const act = lastDays(healthSeries(health, picks.activeEnergy), today, 14);
    if (act.length >= 7) {
      const active = mean(act.map(x => x.v));
      const base = bmr({ weightKg: trend, heightCm: Number(p.heightCm), age, sex: p.sex });
      const tdee = base != null ? Math.round((base + active * 0.85) / 5) * 5 : null; // 0.85: watch active-energy runs a little high
      if (tdee && Math.abs(tdee - goal.maintenanceKcal) >= 150) {
        const next = makeGoal({
          template: goal.template, customText: goal.customText || '', startedOn: goal.startedOn, weightKg: trend,
          maintenanceKcal: tdee, maintenanceSource: 'fitbit', targetWeightKg: goal.targetWeightKg, pace: goal.pace, custom: goal.custom,
        });
        if (next && next.targets.kcal !== goal.targets.kcal) {
          out.push({
            key: 'fitbit-maintenance', mode: 'ask',
            title: `Calories ${next.targets.kcal > goal.targets.kcal ? 'up' : 'down'} to ${next.targets.kcal} kcal`,
            doneTitle: `Calories set to ${next.targets.kcal} kcal from your Fitbit activity`,
            why: `Your Fitbit shows about ${r0(active)} kcal of active energy a day over ${act.length} days. With your resting burn (${r0(base)} kcal) that puts your maintenance near ${tdee} kcal, not ${goal.maintenanceKcal}. Targets rebuilt from that. This is an estimate from the watch; once you have two weeks of weigh-ins and food logs the coach replaces it with your measured maintenance.`,
            apply: { type: 'goal', goal: { ...next, targetsWeightKg: r1(trend) } },
          });
        }
      }
    }
  }

  // 4. Resting heart rate climbing for weeks on a heavy plan.
  const planned = plannedDays(program);
  if (planned >= 5 && !cooling(log, 'hr-trend', today)) {
    const s = healthSeries(health, picks.rhr);
    const recent = lastDays(s, today, 14), before = s.filter(x => { const i = dayIndex(x.date), t = dayIndex(today); return i <= t - 14 && i > t - 28; });
    if (recent.length >= 7 && before.length >= 7) {
      const d = mean(recent.map(x => x.v)) - mean(before.map(x => x.v));
      if (d >= 3) {
        out.push({
          key: 'hr-trend', mode: 'ask',
          title: `Switch to a ${planned - 1}-day split?`,
          doneTitle: `Switched to a ${planned - 1}-day split`,
          why: `Your resting heart rate has crept up ${r1(d)} bpm over the last two weeks while you plan ${planned} training days. A steady rise like that is an early sign of too much load for your current sleep and food. A ${planned - 1}-day week keeps the work and gives you the extra rest day.`,
          apply: { type: 'split', days: planned - 1 },
        });
      }
    }
  }

  return out;
}
