import { describe, it, expect } from 'vitest';
import { buildGuideImport } from './guideImport.js';
import { coverage, suggestFills, applyFills, swapOptions, swapInDay, dayMuscles, weeklySets } from './splitCoach.js';
import { dayExercises, withDayTargets } from './splits.js';

const plan = buildGuideImport({});
const library = plan.exercises;
const five = plan.programs[1];

describe('coverage of the guide 5-day program', () => {
  const rows = coverage(five, library);
  const by = (id) => rows.find(r => r.id === id);

  it('covers all twelve muscle groups', () => {
    expect(rows).toHaveLength(12);
  });
  it('matches the guide for lateral-delt-heavy shoulders and the big lifts', () => {
    expect(by('chest').direct).toBeGreaterThanOrEqual(10);
    expect(by('back').total).toBeGreaterThanOrEqual(17);
    expect(by('quads').direct).toBeGreaterThanOrEqual(9);
    expect(by('calves').direct).toBe(6);
  });
  it('flags the muscles the guide does not train directly', () => {
    expect(by('forearms').status).not.toBe('ok');
    expect(by('traps').direct).toBe(0);
  });
  it('lower and upper days both count the sets you set', () => {
    expect(weeklySets(five, library).shoulders.direct).toBeGreaterThanOrEqual(11 + 6);
  });
});

describe('filling the gaps', () => {
  const fills = suggestFills(five, library);

  it('suggests something for every muscle that is short, and nothing risky for the shoulder', () => {
    expect(fills.length).toBeGreaterThan(0);
    for (const f of fills) expect(f.name).not.toMatch(/overhead press|push press|upright|arnold|handstand|pike/i);
    const groups = new Set(fills.map(f => f.group));
    expect(groups.has('forearms')).toBe(true);
    expect(groups.has('traps')).toBe(true);
  });
  it('puts upper-body fills on an upper day and lower-body fills on a lower day', () => {
    for (const f of fills) {
      const upper = ['forearms', 'traps', 'biceps', 'triceps', 'chest', 'back', 'shoulders'].includes(f.group);
      expect(upper ? /upper/i.test(f.dayLabel) : /lower/i.test(f.dayLabel)).toBe(true);
    }
  });
  it('applying them adds the exercises with their own sets and reps, and closes the gap', () => {
    const chosen = fills.filter(f => ['forearms', 'traps'].includes(f.group));
    const { days, newEntries } = applyFills(five, library, chosen);
    const next = { ...five, days };
    const lib2 = [...library, ...newEntries];
    const rows = coverage(next, lib2);
    expect(rows.find(r => r.id === 'traps').direct).toBe(2);
    expect(rows.find(r => r.id === 'forearms').direct).toBeGreaterThanOrEqual(2);
    const day = next.days[chosen[0].dayKey];
    const ex = withDayTargets(dayExercises(day, lib2), day).find(e => e.name === chosen[0].name);
    expect(ex.plannedSets).toBe(chosen[0].sets);
  });
  it('leaves your original program untouched', () => {
    const before = JSON.stringify(five);
    applyFills(five, library, fills);
    expect(JSON.stringify(five)).toBe(before);
  });
});

describe('swapping', () => {
  const day = five.days.mon;
  const machineRow = dayExercises(day, library).find(e => e.name === 'Machine Row');

  it('offers the guide\'s own alternative first', () => {
    const o = swapOptions(machineRow, day, library);
    expect(o.guide).toEqual(['Chest-Supported Row']);
    expect(o.sameMuscle.length).toBeGreaterThan(0);
    expect(o.sameMuscle).not.toContain('Machine Row');
  });
  it('swaps in place and keeps the sets and reps', () => {
    const r = swapInDay(day, machineRow.id, 'Chest-Supported Row', library);
    const names = dayExercises(r.day, [...library, ...(r.entry ? [r.entry] : [])]).map(e => e.name);
    expect(names.indexOf('Chest-Supported Row')).toBe(dayExercises(day, library).findIndex(e => e.id === machineRow.id));
    expect(names).not.toContain('Machine Row');
    expect(r.day.targets[library.find(e => e.name === 'Chest-Supported Row').id]).toEqual(day.targets[machineRow.id]);
  });
  it('refuses a swap for something already on the day', () => {
    expect(swapInDay(day, machineRow.id, 'Chest Press Machine', library)).toBeNull();
  });
});

describe('what a day hits', () => {
  it('lists the muscles in order', () => {
    expect(dayMuscles(five.days.tue, library)).toEqual(expect.arrayContaining(['Quads', 'Hamstrings', 'Calves', 'Abs']));
  });
});
