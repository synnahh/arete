import { describe, it, expect } from 'vitest';
import {
  dayExercises, materialize, addToDay, removeFromDay, moveInDay, setDayKind, weekPlan,
  plannedSets, doneSets, volumeStatus, volumeRows, buildFromTemplate, sessionDayKey, sessionChoices, dayKeyFromDate, TEMPLATES, templatesFor,
} from './splits.js';

const lib = [
  { id: 'bp', name: 'Bench Press', day: 'push' },
  { id: 'ohp', name: 'Overhead Press', day: 'push' },
  { id: 'pu', name: 'Pull-ups', day: 'pull' },
  { id: 'sq', name: 'Barbell Squat', day: 'legs' },
  { id: 'cur', name: 'DB Curl', day: 'pull' },
];

describe('dayExercises', () => {
  it('reads explicit ids in order and skips deleted exercises', () => {
    expect(dayExercises({ splitType: 'custom', exerciseIds: ['sq', 'gone', 'bp'] }, lib).map(e => e.id)).toEqual(['sq', 'bp']);
  });
  it('keeps old push/pull/legs days working from the library tag', () => {
    expect(dayExercises({ splitType: 'push', label: 'Push' }, lib).map(e => e.id)).toEqual(['bp', 'ohp']);
    expect(dayExercises({ splitType: 'custom', label: 'x' }, lib)).toEqual([]);
  });
  it('rest days and missing days have nothing', () => {
    expect(dayExercises({ splitType: 'rest' }, lib)).toEqual([]);
    expect(dayExercises(undefined, lib)).toEqual([]);
  });
});

describe('editing a day', () => {
  const legacy = { splitType: 'push', label: 'Push' };
  it('writes a legacy day out before changing it', () => {
    expect(materialize(legacy, lib).exerciseIds).toEqual(['bp', 'ohp']);
    expect(addToDay(legacy, lib, 'cur').exerciseIds).toEqual(['bp', 'ohp', 'cur']);
    expect(removeFromDay(legacy, lib, 'bp').exerciseIds).toEqual(['ohp']);
  });
  it('never duplicates an exercise in a day', () => {
    expect(addToDay({ splitType: 'custom', exerciseIds: ['bp'] }, lib, 'bp').exerciseIds).toEqual(['bp']);
  });
  it('reorders and ignores moves off the ends', () => {
    const d = { splitType: 'custom', exerciseIds: ['bp', 'ohp', 'sq'] };
    expect(moveInDay(d, lib, 'sq', -1).exerciseIds).toEqual(['bp', 'sq', 'ohp']);
    expect(moveInDay(d, lib, 'bp', -1).exerciseIds).toEqual(['bp', 'ohp', 'sq']);
    expect(moveInDay(d, lib, 'sq', 1).exerciseIds).toEqual(['bp', 'ohp', 'sq']);
  });
  it('turns a day into rest and back without losing the label rule', () => {
    expect(setDayKind({ splitType: 'push', label: 'Push', exerciseIds: ['bp'] }, false)).toEqual({ splitType: 'rest', label: 'Rest' });
    expect(setDayKind({ splitType: 'rest', label: 'Rest' }, true, 'Arms')).toMatchObject({ splitType: 'custom', label: 'Arms', exerciseIds: [] });
  });
});

describe('volume', () => {
  const program = { days: { mon: { splitType: 'custom', label: 'A', exerciseIds: ['bp', 'ohp'] }, thu: { splitType: 'custom', label: 'B', exerciseIds: ['bp'] } } };
  it('counts planned sets per muscle, helpers at half', () => {
    const s = plannedSets(program, lib, 3);
    expect(s.chest).toBe(6);                   // bench twice, 3 sets each
    expect(s.shoulders).toBe(3 + 1.5 + 1.5);   // overhead press primary + bench helper twice
    expect(s.calves).toBe(0);
  });
  it('classifies weekly sets', () => {
    expect([0, 4, 12, 25].map(volumeStatus)).toEqual(['none', 'low', 'ok', 'high']);
  });
  it('counts the sets actually logged in the last week', () => {
    const logs = [
      { date: '2026-10-10', exerciseName: 'Bench Press', sets: [{}, {}, {}] },
      { date: '2026-10-09', exerciseName: 'Bench Press' },
      { date: '2026-09-20', exerciseName: 'Bench Press', sets: [{}, {}, {}] },
    ];
    expect(doneSets(logs, '2026-10-11').chest).toBe(4);
  });
  it('lists the least trained muscles first', () => {
    const rows = volumeRows(plannedSets(program, lib, 3));
    expect(rows[0].status).toBe('none');
    expect(rows.find(r => r.id === 'chest').status).toBe('low');
  });
});

describe('templates', () => {
  it('fills days from your own library and reports what you lack', () => {
    const { days, missing } = buildFromTemplate('ppl', lib);
    expect(days.mon.exerciseIds).toEqual(expect.arrayContaining(['bp', 'ohp']));
    expect(days.tue.exerciseIds).toContain('pu');
    expect(days.sun).toEqual({ splitType: 'rest', label: 'Rest' });
    expect(missing).toEqual(expect.arrayContaining(['Triceps', 'Hamstrings', 'Calves']));
  });
  it('a blank week is all rest', () => {
    const { days, missing } = buildFromTemplate('blank', lib);
    expect(Object.values(days).every(d => d.splitType === 'rest')).toBe(true);
    expect(missing).toEqual([]);
  });
  it('builds nothing from an empty library without crashing', () => {
    const { days } = buildFromTemplate('upperLower', []);
    expect(days.mon.exerciseIds).toEqual([]);
    expect(Object.keys(TEMPLATES)).toContain('bro');
  });
});

describe('session days', () => {
  const program = { days: { mon: { splitType: 'custom', label: 'Push', exerciseIds: ['bp'] }, tue: { splitType: 'rest' }, thu: { splitType: 'custom', label: 'Push', exerciseIds: ['bp'] }, fri: { splitType: 'custom', label: 'Legs', exerciseIds: ['sq'] } } };
  it('finds today, or the next workout day', () => {
    expect(sessionDayKey(program, 'mon')).toBe('mon');
    expect(sessionDayKey(program, 'tue')).toBe('thu');
    expect(sessionDayKey(program, 'sat')).toBe('mon');
    expect(sessionDayKey({ days: { mon: { splitType: 'rest' } } }, 'mon')).toBeNull();
  });
  it('lists each distinct workout once', () => {
    expect(sessionChoices(program, lib)).toEqual([{ key: 'mon', label: 'Push', count: 1 }, { key: 'fri', label: 'Legs', count: 1 }]);
  });
  it('maps JS weekdays to Monday-first keys', () => {
    expect(dayKeyFromDate(new Date(2026, 9, 11))).toBe('sun');
    expect(dayKeyFromDate(new Date(2026, 9, 12))).toBe('mon');
  });
  it('weekPlan always has seven days', () => {
    expect(weekPlan(program, lib)).toHaveLength(7);
    expect(weekPlan(null, lib).every(d => d.rest)).toBe(true);
  });
});

describe('template filter', () => {
  it('shows what suits your level and days, blank always last', () => {
    const all = templatesFor({});
    expect(all[all.length - 1]).toBe('blank');
    expect(all.length).toBeGreaterThanOrEqual(15);
    const beginner = templatesFor({ experience: 'beginner' });
    expect(beginner).toEqual(expect.arrayContaining(['upperLower', 'fullBody', 'blank']));
    expect(beginner).not.toContain('arnold');
    expect(beginner).not.toContain('bro');
    const four = templatesFor({ days: 4 });
    for (const id of four) if (id !== 'blank') expect(TEMPLATES[id].trainDays).toBeLessThanOrEqual(4);
    expect(templatesFor({ experience: 'advanced', days: 5 })).toEqual(expect.arrayContaining(['upperFrame', 'bro', 'ppul', 'blank']));
    expect(templatesFor({ experience: 'advanced', days: 5 })).not.toContain('arnold');
  });
});

describe('day targets', () => {
  const day = { splitType: 'custom', label: 'Upper', exerciseIds: ['a', 'b'] };
  it('sets and clears sets and reps for one exercise', async () => {
    const { setDayTarget, dayTarget } = await import('./splits.js');
    let d = setDayTarget(day, 'a', { sets: '4', repsMin: '8', repsMax: '12' });
    expect(dayTarget(d, 'a')).toEqual({ sets: 4, repsMin: 8, repsMax: 12 });
    d = setDayTarget(d, 'a', { sets: '' });
    expect(dayTarget(d, 'a')).toEqual({ repsMin: 8, repsMax: 12 });
    d = setDayTarget(d, 'a', { repsMin: '', repsMax: '' });
    expect(d.targets).toBeUndefined();
  });
  it('keeps min below max and rejects nonsense', async () => {
    const { setDayTarget, dayTarget } = await import('./splits.js');
    let d = setDayTarget(day, 'a', { repsMin: 10, repsMax: 12 });
    d = setDayTarget(d, 'a', { repsMin: 15 });
    expect(dayTarget(d, 'a')).toEqual({ repsMin: 15, repsMax: 15 });
    expect(dayTarget(setDayTarget(day, 'a', { sets: 99 }), 'a')).toEqual({});
  });
});

describe('moving and copying days', () => {
  const days = {
    mon: { splitType: 'custom', label: 'Upper A', exerciseIds: ['a'], targets: { a: { sets: 3 } } },
    tue: { splitType: 'rest', label: 'Rest' },
    wed: { splitType: 'custom', label: 'Lower', exerciseIds: ['b'] },
  };
  it('moving swaps the two days and loses nothing', async () => {
    const { moveDay } = await import('./splits.js');
    const r = moveDay(days, 'mon', 'tue');
    expect(r.tue.label).toBe('Upper A');
    expect(r.tue.targets.a.sets).toBe(3);
    expect(r.mon.splitType).toBe('rest');
    const r2 = moveDay(days, 'mon', 'wed');
    expect(r2.mon.label).toBe('Lower');
    expect(r2.wed.label).toBe('Upper A');
  });
  it('copying replaces the target with an independent copy', async () => {
    const { copyDay } = await import('./splits.js');
    const r = copyDay(days, 'mon', 'wed');
    expect(r.wed.label).toBe('Upper A');
    r.wed.exerciseIds.push('z');
    expect(days.mon.exerciseIds).toEqual(['a']);
    expect(r.mon.label).toBe('Upper A');
  });
  it('ignores nonsense weekdays', async () => {
    const { moveDay, copyDay, trainingDays } = await import('./splits.js');
    expect(moveDay(days, 'mon', 'xyz')).toBe(days);
    expect(copyDay(days, 'mon', 'mon')).toBe(days);
    expect(trainingDays({ days })).toBe(2);
  });
});
