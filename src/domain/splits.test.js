import { describe, it, expect } from 'vitest';
import {
  dayExercises, materialize, addToDay, removeFromDay, moveInDay, setDayKind, weekPlan,
  plannedSets, doneSets, volumeStatus, volumeRows, buildFromTemplate, sessionDayKey, sessionChoices, dayKeyFromDate, TEMPLATES,
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
