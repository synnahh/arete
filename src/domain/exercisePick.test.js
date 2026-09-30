import { describe, it, expect } from 'vitest';
import { pickDay, suggestLibrary, freshEntries, toLibraryEntry, PRESETS, styleFor, EQUIPMENT } from './exercisePick.js';

const names = (list) => list.map(e => e.name);

describe('pickDay', () => {
  it('builds a full-gym push day with compounds first', () => {
    const d = pickDay('push', PRESETS.gym.equipment, 'muscle');
    expect(d[0].kind).toBe('compound');
    expect(d.length).toBe(6);
    const firstIso = d.findIndex(e => e.kind === 'isolation');
    expect(d.slice(firstIso).every(e => e.kind === 'isolation')).toBe(true);
  });

  it('only ever picks what the equipment allows', () => {
    for (const p of Object.values(PRESETS)) for (const day of ['push', 'pull', 'legs']) {
      const eq = new Set(p.equipment);
      pickDay(day, p.equipment, 'muscle').forEach(e => expect(e.needs.some(n => eq.has(n)), `${p.label} ${day} ${e.name}`).toBe(true));
    }
  });

  it('gives a bodyweight-only person something for every day', () => {
    for (const day of ['push', 'pull', 'legs']) expect(pickDay(day, PRESETS.body.equipment).length).toBeGreaterThanOrEqual(3);
    expect(names(pickDay('push', PRESETS.body.equipment))).toContain('Push-ups');
  });

  it('uses dumbbell alternatives when there is no barbell or machine', () => {
    const n = names(pickDay('legs', PRESETS.db.equipment));
    expect(n).toContain('Goblet Squat');
    expect(n).not.toContain('Leg Press');
    expect(n).not.toContain('Barbell Squat');
  });

  it('strength goals mean fewer, heavier exercises than muscle goals', () => {
    expect(pickDay('pull', PRESETS.gym.equipment, 'strength').length).toBeLessThan(pickDay('pull', PRESETS.gym.equipment, 'muscle').length);
  });

  it('does not repeat an exercise and returns nothing for no equipment or an unknown day', () => {
    const d = pickDay('legs', PRESETS.gym.equipment, 'bulk');
    expect(new Set(d.map(e => e.id)).size).toBe(d.length);
    expect(pickDay('legs', [])).toEqual([]);
    expect(pickDay('arms', PRESETS.gym.equipment)).toEqual([]);
  });

  it('hits several muscles rather than one', () => {
    expect(new Set(pickDay('push', PRESETS.gym.equipment).map(e => e.muscle)).size).toBeGreaterThanOrEqual(3);
  });
});

describe('library entries', () => {
  it('matches the Exercise Library shape', () => {
    const e = suggestLibrary(PRESETS.gym.equipment, 'muscle').push[0];
    expect(e).toMatchObject({ id: expect.any(String), name: expect.any(String), day: 'push', bodyweight: false, gym: expect.stringMatching(/^(both|commercial|home)$/) });
    expect(e.repsMax).toBeGreaterThan(e.repsMin);
  });

  it('lowers compound rep ranges for strength but leaves isolation alone', () => {
    const bench = { id: 'bp', name: 'Bench Press', day: 'push', kind: 'compound', needs: ['barbell'], start: 40, inc: 2.5, reps: [6, 8] };
    expect(toLibraryEntry(bench, 'strength')).toMatchObject({ repsMin: 5, repsMax: 6 });
    expect(toLibraryEntry(bench, 'muscle')).toMatchObject({ repsMin: 6, repsMax: 8 });
    const iso = { id: 'x', name: 'Curl', day: 'pull', kind: 'isolation', needs: ['dumbbell'], start: 8, inc: 1, reps: [8, 12] };
    expect(toLibraryEntry(iso, 'strength')).toMatchObject({ repsMin: 8, repsMax: 12 });
  });

  it('marks machine-only work as commercial', () => {
    const lp = suggestLibrary(PRESETS.gym.equipment, 'muscle').legs.find(e => e.name === 'Leg Press');
    if (lp) expect(lp.gym).toBe('commercial');
  });

  it('skips names already in the library and keeps ids unique', () => {
    const lib = [{ id: 'bp', name: 'bench press' }, { id: 'dbb', name: 'Something else' }];
    const fresh = freshEntries([{ id: 'bp', name: 'Bench Press' }, { id: 'dbb', name: 'DB Bench Press' }], lib);
    expect(fresh.map(e => e.name)).toEqual(['DB Bench Press']);
    expect(fresh[0].id).toBe('dbb2');
  });

  it('maps goal ids to a style with a safe default', () => {
    expect(styleFor('cut')).toBe('cut');
    expect(styleFor('nonsense')).toBe('muscle');
    expect(EQUIPMENT).toContain('bodyweight');
  });
});
