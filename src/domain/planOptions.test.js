import { describe, it, expect } from 'vitest';
import { extractTargets, compareTargets, appliable, makeOption, addOption, removeOption } from './planOptions.js';

const BRIEF = `ARETE — Personal Body Recomposition Coach
ROLE AND OBJECTIVE
If insufficient data exists, establish a provisional starting point:

* Calories: approximately 2,500 kcal/day
* Protein: 150 g/day
* Carbohydrates: approximately 318 g/day
* Fat: 70 g/day
* Fibre: at least 30 g/day, increasing gradually as tolerated

These provisional macros provide approximately 2,500 kcal/day.
* A provisional step goal around 8,000/day, adjusted to my current baseline and recovery.
Target approximately 1.6–2.2 g/kg/day`;

describe('extractTargets', () => {
  it('reads the provisional targets from a coaching brief', () => {
    const t = extractTargets(BRIEF);
    expect(t).toMatchObject({ kcal: 2500, protein: 150, carbs: 318, fat: 70, fibre: 30, steps: 8000 });
    expect(t.notes).toEqual([]);
  });
  it('flags macros that do not match the calories', () => {
    const t = extractTargets('* Calories: 2,000 kcal/day\n* Protein: 150 g\n* Carbohydrates: 300 g\n* Fat: 70 g');
    expect(t.notes[0]).toMatch(/add up to about 2430/);
  });
  it('needs calories and protein, and a believable calorie figure', () => {
    expect(extractTargets('Eat well and sleep.')).toBeNull();
    expect(extractTargets('Calories: 500 kcal\nProtein: 100 g')).toBeNull();
    expect(extractTargets('Protein: 150 g')).toBeNull();
  });
  it('notes when carbs or fat are missing', () => {
    expect(extractTargets('Calories: 2,300 kcal\nProtein: 160 g').notes[0]).toMatch(/not stated/);
  });
});

describe('options list', () => {
  it('compares against current targets', () => {
    const rows = compareTargets({ kcal: 2300, protein: 150, carbs: 250, fat: 70 }, { kcal: 2500, protein: 150, carbs: 318, fat: 70 });
    expect(rows.map(r => [r.key, r.delta])).toEqual([['kcal', 200], ['protein', 0], ['carbs', 68], ['fat', 0]]);
  });
  it('is appliable only with all four numbers', () => {
    expect(appliable({ kcal: 2500, protein: 150, carbs: 318, fat: 70 })).toBe(true);
    expect(appliable({ kcal: 2500, protein: 150, carbs: null, fat: 70 })).toBe(false);
    expect(appliable(null)).toBe(false);
  });
  it('builds an option, adds without touching existing ones, and removes only by id', () => {
    const a = makeOption({ name: '', text: BRIEF, savedOn: '2026-10-16', id: 'a' });
    expect(a.name).toBe('ARETE — Personal Body Recomposition Coach');
    expect(a.targets.kcal).toBe(2500);
    const before = [{ id: 'old', name: 'Old', text: 'x', targets: null }];
    const list = addOption(before, a);
    expect(list.map(o => o.id)).toEqual(['a', 'old']);
    expect(before).toHaveLength(1);
    expect(removeOption(list, 'a').map(o => o.id)).toEqual(['old']);
    expect(makeOption({ text: '   ' })).toBeNull();
  });
});
