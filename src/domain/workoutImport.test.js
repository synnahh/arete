import { describe, it, expect } from 'vitest';
import { parseWorkoutPlan, matchExercise, buildWorkoutImport, detectKind, buildWorkoutPrompt } from './workoutImport.js';

const TEXT = `Upper / Lower plan
Monday - Upper A
Bench Press 3x8-10
- Lat Pulldown: 3 sets of 8-12
2. Lateral Raise 3 x 12-20
Tuesday: Rest
Wednesday - Lower A
Hack Squat 4x6-8
Romanian Deadlift 3 x 8
Thursday - Mystery Day
Zottman Curl 2x10-12`;

describe('parseWorkoutPlan', () => {
  it('reads weekday headings, rests and set x rep lines', () => {
    const r = parseWorkoutPlan(TEXT);
    expect(r.ok).toBe(true);
    expect(r.name).toBe('Upper / Lower plan');
    const mon = r.days.find(d => d.key === 'mon');
    expect(mon.label).toBe('Upper A');
    expect(mon.exercises).toEqual([
      { name: 'Bench Press', sets: 3, repsMin: 8, repsMax: 10 },
      { name: 'Lat Pulldown', sets: 3, repsMin: 8, repsMax: 12 },
      { name: 'Lateral Raise', sets: 3, repsMin: 12, repsMax: 20 },
    ]);
    expect(r.days.find(d => d.key === 'tue').rest).toBe(true);
    expect(r.days.find(d => d.key === 'wed').exercises[1]).toMatchObject({ name: 'Romanian Deadlift', sets: 3, repsMin: 8, repsMax: 8 });
  });

  it('spreads unnamed days across the week', () => {
    const r = parseWorkoutPlan('Upper A\nBench Press 3x8\nLower A\nHack Squat 3x8\nUpper B\nMachine Row 3x10');
    expect(r.days.map(d => d.key)).toEqual(['mon', 'wed', 'fri']);
    expect(r.days.map(d => d.label)).toEqual(['Upper A', 'Lower A', 'Upper B']);
  });

  it('reads the JSON the prompt asks for', () => {
    const r = parseWorkoutPlan('```json\n' + JSON.stringify({ name: 'P', days: [
      { day: 'Monday', label: 'Push', exercises: [{ name: 'Bench Press', sets: 3, reps: '6-10' }] },
      { day: 'Tuesday', label: 'Rest', exercises: [] },
    ] }) + '\n```');
    expect(r.ok).toBe(true);
    expect(r.name).toBe('P');
    expect(r.days[0]).toMatchObject({ key: 'mon', label: 'Push' });
    expect(r.days[0].exercises[0]).toEqual({ name: 'Bench Press', sets: 3, repsMin: 6, repsMax: 10 });
  });

  it('refuses text with no exercises', () => {
    expect(parseWorkoutPlan('Train hard and eat well').ok).toBe(false);
    expect(parseWorkoutPlan('').ok).toBe(false);
  });
});

describe('matchExercise', () => {
  it('finds exact and re-worded database lifts, and refuses unknown ones', () => {
    expect(matchExercise('Bench Press')).toMatchObject({ exact: true });
    expect(matchExercise('dumbbell bench press').ex?.name).toBe('DB Bench Press');
    expect(matchExercise('Zottman Curl').ex).toBeNull();
  });
});

describe('buildWorkoutImport', () => {
  it('makes a program with targets, adds missing lifts, and flags unknown ones as custom', () => {
    const parsed = parseWorkoutPlan(TEXT);
    const out = buildWorkoutImport(parsed, { library: [], programs: [{ name: 'Imported program' }] });
    expect(out.program.name).toBe('Upper / Lower plan');
    expect(out.custom).toEqual(['Zottman Curl']);
    const mon = out.program.days.mon;
    expect(mon.splitType).toBe('custom');
    expect(mon.exerciseIds).toHaveLength(3);
    expect(mon.targets[mon.exerciseIds[0]]).toEqual({ sets: 3, repsMin: 8, repsMax: 10 });
    expect(out.program.days.tue.splitType).toBe('rest');
    expect(out.exercises.length).toBe(out.program.days.mon.exerciseIds.length + out.program.days.wed.exerciseIds.length + 1);
    expect(out.trainingDays).toBe(3);
  });

  it('reuses library exercises by name and never duplicates a program name', () => {
    const parsed = parseWorkoutPlan('Monday - Push\nBench Press 3x8');
    const lib = [{ id: 'mine', name: 'bench press' }];
    const out = buildWorkoutImport(parsed, { library: lib, programs: [{ name: 'Imported program' }] });
    expect(out.exercises).toEqual([]);
    expect(out.program.days.mon.exerciseIds).toEqual(['mine']);
    expect(out.program.name).toBe('Imported program (2)');
  });
});

describe('detectKind', () => {
  it('tells meals from workouts', () => {
    expect(detectKind('Monday\nBreakfast: Oats 450 kcal 30P')).toBe('meal');
    expect(detectKind(TEXT)).toBe('workout');
    expect(detectKind(JSON.stringify({ plan: [{ day: 'Monday', meals: [{ name: 'A', calories: 100 }] }] }))).toBe('meal');
    expect(detectKind(JSON.stringify({ days: [{ day: 'Monday', exercises: [{ name: 'A', sets: 3 }] }] }))).toBe('workout');
    expect(detectKind('hello')).toBeNull();
  });
  it('builds a prompt with the shape', () => {
    expect(buildWorkoutPrompt({ days: 5 })).toMatch(/Training days per week: 5/);
  });
});
