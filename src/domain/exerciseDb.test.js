import { describe, it, expect } from 'vitest';
import { EXERCISE_DB, DB_MUSCLES, DB_EQUIPMENT, searchExercises, trackedMuscles, findExercise, toLibraryEntry } from './exerciseDb.js';
import { musclesForExercise, musclesForLog } from './muscles.js';

describe('exercise database', () => {
  it('has well-formed rows with unique ids and names', () => {
    expect(EXERCISE_DB.length).toBeGreaterThanOrEqual(110);
    expect(new Set(EXERCISE_DB.map(e => e.id)).size).toBe(EXERCISE_DB.length);
    expect(new Set(EXERCISE_DB.map(e => e.name.toLowerCase())).size).toBe(EXERCISE_DB.length);
    for (const e of EXERCISE_DB) {
      expect(DB_MUSCLES).toContain(e.muscle);
      expect(DB_EQUIPMENT).toContain(e.equipment);
      expect(['compound', 'isolation']).toContain(e.kind);
      expect(['push', 'pull', 'legs']).toContain(e.day);
      expect(e.cue.length).toBeGreaterThan(10);
      e.helpers.forEach(h => expect(DB_MUSCLES).toContain(h));
    }
  });

  it('searches by words in any order and ranks name matches first', () => {
    expect(searchExercises('incline press')[0].name).toMatch(/Incline/);
    expect(searchExercises('press incline').map(e => e.name)).toContain('Incline Bench Press');
    expect(searchExercises('zzzz')).toEqual([]);
    expect(searchExercises('curl')[0].name).toMatch(/Curl/);
  });

  it('filters by muscle (including helpers) and equipment', () => {
    expect(searchExercises('', { muscle: 'hamstrings', limit: 200 }).length).toBeGreaterThan(5);
    expect(searchExercises('', { equipment: 'cable', limit: 200 }).every(e => e.equipment === 'cable')).toBe(true);
    expect(searchExercises('', { muscle: 'chest', equipment: 'dumbbell', limit: 50 }).every(e => e.equipment === 'dumbbell')).toBe(true);
  });

  it('maps to the ten tracked muscles', () => {
    expect(trackedMuscles(findExercise('Barbell Shrug'))).toEqual(['back', 'forearms']);
    expect(trackedMuscles(findExercise('Plank'))).toEqual(['shoulders']);
    expect(trackedMuscles(findExercise('Incline Bench Press'))[0]).toBe('chest');
  });

  it('makes library entries in the shape Train reads', () => {
    expect(toLibraryEntry(findExercise('Pull-ups'))).toMatchObject({ name: 'Pull-ups', day: 'pull', bodyweight: true, startingWeight: 0 });
    const m = toLibraryEntry(findExercise('Leg Extension'));
    expect(m.gym).toBe('commercial');
    expect(m.repsMin).toBeLessThan(m.repsMax);
  });

  it('feeds the muscle map for database-only exercises, keeping curated entries first', () => {
    expect(musclesForExercise({ name: 'Incline Bench Press', day: 'push' })).toContain('chest');
    expect(musclesForLog({ exerciseName: 'Hammer Curl' })).toContain('biceps');
    expect(musclesForExercise({ name: 'Bench Press' })).toEqual(['chest', 'triceps', 'shoulders']);
    expect(musclesForExercise({ name: 'My custom lift', day: 'legs' })).toEqual(['quads', 'hamstrings', 'glutes', 'calves']);
  });
});
