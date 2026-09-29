import { describe, it, expect } from 'vitest';
import { computeTargets, estimateMaintenance, adaptiveMaintenance, makeGoal, settingsForGoal, dayScore, TEMPLATE_IDS } from './goals.js';

describe('computeTargets', () => {
  it('cut: 20% deficit, 2.2 g/kg protein, energy adds up', () => {
    const t = computeTargets('cut', { weightKg: 80, maintenanceKcal: 2800 });
    expect(t.kcal).toBe(2240);
    expect(t.protein).toBe(175); // 176 rounded to 5
    expect(t.fat).toBe(65);      // max(64, 49.8) → 65
    const energy = t.protein * 4 + t.fat * 9 + t.carbs * 4;
    expect(Math.abs(energy - t.kcal)).toBeLessThanOrEqual(20);
    expect(t.weeklyRateKg).toBe(-0.6);
  });

  it('bulk sits above maintenance, recomp at it', () => {
    expect(computeTargets('bulk',   { weightKg: 70, maintenanceKcal: 2500 }).kcal).toBe(2750);
    expect(computeTargets('recomp', { weightKg: 70, maintenanceKcal: 2500 }).kcal).toBe(2500);
  });

  it('never returns negative carbs', () => {
    const t = computeTargets('cut', { weightKg: 120, maintenanceKcal: 1500 });
    expect(t.carbs).toBeGreaterThanOrEqual(0);
  });

  it('rejects missing inputs and unknown templates', () => {
    expect(computeTargets('cut', { weightKg: 0, maintenanceKcal: 2500 })).toBeNull();
    expect(computeTargets('nope', { weightKg: 80, maintenanceKcal: 2500 })).toBeNull();
  });

  it('every template produces targets', () => {
    for (const id of TEMPLATE_IDS) expect(computeTargets(id, { weightKg: 75, maintenanceKcal: 2600 })).not.toBeNull();
  });
});

describe('estimateMaintenance', () => {
  it('is bodyweight × 32, rounded', () => {
    expect(estimateMaintenance(80)).toBe(2560);
    expect(estimateMaintenance(null)).toBeNull();
  });
});

// Build 28 days: weight falls 0.5 kg/week, 2500 kcal eaten daily.
const series = (days, startKg, kgPerWeek, kcal, logEvery = 1) => {
  const weights = [], intakes = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
    weights.push({ date: d, weight: startKg + (kgPerWeek / 7) * i });
    if (i % logEvery === 0) intakes.push({ date: d, calories: kcal });
  }
  return { weights, intakes };
};

describe('adaptiveMaintenance', () => {
  it('recovers maintenance from trend and intake', () => {
    const { weights, intakes } = series(28, 80, -0.5, 2500);
    const r = adaptiveMaintenance(weights, intakes);
    // losing 0.5 kg/week on 2500 kcal → maintenance ≈ 2500 + 0.5*7700/7 = 3050
    expect(r.kcal).toBe(3050);
    expect(r.slopeKgPerWeek).toBe(-0.5);
  });

  it('sums several logs on the same day', () => {
    const { weights } = series(21, 80, 0, 0);
    const intakes = weights.flatMap(w => [{ date: w.date, calories: 1000 }, { date: w.date, calories: 1500 }]);
    expect(adaptiveMaintenance(weights, intakes).kcal).toBe(2500);
  });

  it('refuses when the window is too short or intake too sparse', () => {
    const short = series(10, 80, -0.5, 2500);
    expect(adaptiveMaintenance(short.weights, short.intakes)).toBeNull();
    const sparse = series(28, 80, -0.5, 2500, 2); // half the days logged
    expect(adaptiveMaintenance(sparse.weights, sparse.intakes)).toBeNull();
  });
});

describe('goal records', () => {
  it('makeGoal + settingsForGoal feed the keys the app already reads', () => {
    const goal = makeGoal({ template: 'cut', weightKg: 80, maintenanceKcal: 2800, startedOn: '2026-09-29' });
    const s = settingsForGoal(goal, { fibre: 30 });
    expect(s.macroGoal).toBe(2240);
    expect(s.proteinGoal).toBe(175);
    expect(s.macros).toMatchObject({ calories: 2240, protein: 175, fibre: 30 });
    expect(s.coachGoal.template).toBe('cut');
  });
});

describe('dayScore', () => {
  const targets = { kcal: 2000, protein: 160 };
  it('is 100 when every factor is on target', () => {
    expect(dayScore({ targets, calories: 2000, protein: 160, waterMl: 2500, sleepHours: 8, trained: true }).score).toBe(100);
  });
  it('counts over- and under-eating the same and caps the rest', () => {
    const over  = dayScore({ targets, calories: 2400, protein: 400, waterMl: 9000, sleepHours: 12, trained: true });
    const under = dayScore({ targets, calories: 1600, protein: 400, waterMl: 9000, sleepHours: 12, trained: true });
    expect(over.score).toBe(under.score);
    expect(over.factors.find(f => f.id === 'calories').pct).toBeCloseTo(0.8);
  });
  it('starts the day at 0', () => {
    expect(dayScore({ targets }).score).toBe(0);
  });
});

describe('cycleTargets', () => {
  const base = { kcal: 2500, protein: 180, carbs: 250, fat: 70 };
  it('is a no-op when off', async () => {
    const { cycleTargets } = await import('./goals.js');
    expect(cycleTargets(base, null, true)).toMatchObject({ ...base, kind: null, delta: 0 });
    expect(cycleTargets(base, { trainingBonusKcal: 0, trainingDaysPerWeek: 4 }, false).kcal).toBe(2500);
  });
  it('adds the bonus in carbs on training days and keeps protein and fat', async () => {
    const { cycleTargets } = await import('./goals.js');
    const t = cycleTargets(base, { trainingBonusKcal: 250, trainingDaysPerWeek: 4 }, true);
    expect(t).toMatchObject({ kcal: 2752, carbs: 313, protein: 180, fat: 70, kind: 'training' });
  });
  it('rest days give it back so the weekly average holds', async () => {
    const { cycleTargets } = await import('./goals.js');
    const cycle = { trainingBonusKcal: 300, trainingDaysPerWeek: 4 };
    const train = cycleTargets(base, cycle, true), rest = cycleTargets(base, cycle, false);
    expect(rest.kind).toBe('rest');
    expect(Math.abs((train.kcal * 4 + rest.kcal * 3) / 7 - 2500)).toBeLessThan(8); // carbs round to whole grams
  });
  it('never drives carbs negative and ignores silly day counts', async () => {
    const { cycleTargets } = await import('./goals.js');
    expect(cycleTargets({ ...base, carbs: 20 }, { trainingBonusKcal: 900, trainingDaysPerWeek: 5 }, false).carbs).toBeGreaterThanOrEqual(10);
    expect(cycleTargets(base, { trainingBonusKcal: 250, trainingDaysPerWeek: 7 }, true).kind).toBeNull();
  });
  it('caps the bonus so rest days keep at least half their carbs, and still balances the week', async () => {
    const { cycleTargets } = await import('./goals.js');
    const cycle = { trainingBonusKcal: 250, trainingDaysPerWeek: 5 };
    const b = { kcal: 2150, protein: 185, carbs: 205, fat: 65 };
    const rest = cycleTargets(b, cycle, false), train = cycleTargets(b, cycle, true);
    expect(rest.capped).toBe(true);
    expect(rest.carbs).toBeGreaterThanOrEqual(102);
    expect(train.delta).toBeLessThan(250);
    expect(Math.abs((train.kcal * 5 + rest.kcal * 2) / 7 - 2150)).toBeLessThan(8);
  });
  it('is off when the cap leaves nothing worth moving', async () => {
    const { cycleTargets } = await import('./goals.js');
    expect(cycleTargets({ kcal: 1800, protein: 150, carbs: 10, fat: 60 }, { trainingBonusKcal: 250, trainingDaysPerWeek: 4 }, true).kind).toBeNull();
  });
  it('makeGoal keeps an optional goal weight', async () => {
    const { makeGoal } = await import('./goals.js');
    expect(makeGoal({ template: 'cut', weightKg: 85, maintenanceKcal: 2800, startedOn: '2026-09-30', targetWeightKg: 78 }).targetWeightKg).toBe(78);
    expect(makeGoal({ template: 'cut', weightKg: 85, maintenanceKcal: 2800, startedOn: '2026-09-30' })).not.toHaveProperty('targetWeightKg');
  });
});
