import { describe, it, expect } from 'vitest';
import { buildGuideImport, guideExerciseNames, GUIDE_PROGRAMS, GUIDE_MEALS, summarise, isEmpty } from './guideImport.js';
import { dayExercises, withDayTargets, weekPlan, plannedSets } from './splits.js';
import { recommendedSets } from './training.js';
import { tagsFor } from './skin.js';

describe('guide import', () => {
  const fresh = buildGuideImport({});

  it('finds every exercise in the database (nothing is invented)', () => {
    expect(fresh.problems).toEqual([]);
    expect(fresh.exercises.map(e => e.name).sort()).toEqual([...guideExerciseNames()].sort());
    expect(new Set(fresh.exercises.map(e => e.id)).size).toBe(fresh.exercises.length);
  });

  it('builds the two programs with the guide week shapes', () => {
    const [reentry, five] = fresh.programs;
    expect(reentry.isActive).toBe(true);
    expect(five.isActive).toBe(false);
    const work = (p) => Object.entries(p.days).filter(([, d]) => d.splitType !== 'rest').map(([k, d]) => `${k}:${d.label}`);
    expect(work(reentry)).toEqual(['mon:Full body A', 'wed:Full body B', 'fri:Full body A']);
    expect(work(five)).toEqual(['mon:Upper A', 'tue:Lower A', 'thu:Upper B', 'fri:Lower B', 'sat:Upper C']);
    expect(five.days.wed.splitType).toBe('rest');
    expect(five.days.sun.splitType).toBe('rest');
  });

  it('keeps each day\'s own sets and reps', () => {
    const lib = fresh.exercises;
    const five = fresh.programs[1];
    const upperB = withDayTargets(dayExercises(five.days.thu, lib), five.days.thu);
    const upperA = withDayTargets(dayExercises(five.days.mon, lib), five.days.mon);
    const lat = (xs) => xs.find(e => e.name === 'Lateral Raise');
    expect(lat(upperA).plannedSets).toBe(3);
    expect(lat(upperB).plannedSets).toBe(4);
    expect(recommendedSets(lat(upperB)).sets).toBe(4);
    expect(lat(upperB).repsMin).toBe(12);
    const sat = withDayTargets(dayExercises(five.days.sat, lib), five.days.sat);
    expect(lat(sat).repsMax).toBe(25);
  });

  it('the plan matches the guide weekly sets for lateral delts (3 + 4 + 4 = 11)', () => {
    const lib = fresh.exercises;
    let n = 0;
    for (const d of weekPlan(fresh.programs[1], lib)) for (const e of d.exercises) if (e.name === 'Lateral Raise') n += e.plannedSets;
    expect(n).toBe(11);
    expect(plannedSets(fresh.programs[1], lib).shoulders).toBeGreaterThanOrEqual(11);
  });

  it('meal macros add up to the guide day (about 2,290-2,330 kcal, 155-160 g protein)', () => {
    const kcal = GUIDE_MEALS.reduce((s, m) => s + m.calories, 0);
    const protein = GUIDE_MEALS.reduce((s, m) => s + m.protein, 0);
    expect(kcal).toBeGreaterThanOrEqual(2290); expect(kcal).toBeLessThanOrEqual(2330);
    expect(protein).toBeGreaterThanOrEqual(155); expect(protein).toBeLessThanOrEqual(160);
  });

  it('skin steps carry the sunscreen tag and no active', () => {
    const names = fresh.skinSteps.map(s => s.name);
    expect(names.some(n => /sunscreen/i.test(n) && tagsFor(n).has('spf'))).toBe(true);
    expect(names.some(n => /azelaic|retin|acid/i.test(n))).toBe(false);
  });

  it('importing again adds nothing', () => {
    const second = buildGuideImport({
      library: fresh.exercises,
      programs: fresh.programs,
      savedMeals: fresh.meals,
      supplements: fresh.supplements,
      skinSteps: fresh.skinSteps,
      skinProfile: fresh.skinProfile,
      notes: [fresh.note],
    });
    expect(summarise(second)).toEqual([]);
    expect(isEmpty(second)).toBe(true);
    expect(second.kept.length).toBeGreaterThan(0);
  });

  it('reuses your own library entry by name and never touches it', () => {
    const mine = [{ id: 'mine-1', name: 'lateral raise', repsMin: 15, repsMax: 30 }];
    const plan = buildGuideImport({ library: mine });
    expect(plan.exercises.some(e => e.name.toLowerCase() === 'lateral raise')).toBe(false);
    const day = plan.programs[1].days.mon;
    expect(day.exerciseIds).toContain('mine-1');
    expect(mine[0].repsMax).toBe(30);
  });

  it('leaves an existing skin profile alone', () => {
    expect(buildGuideImport({ skinProfile: { type: 'oily', concerns: [], avoid: '' } }).skinProfile).toBeNull();
  });

  it('both programs exist as named', () => {
    expect(GUIDE_PROGRAMS).toHaveLength(2);
  });
});
