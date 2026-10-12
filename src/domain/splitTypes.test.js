import { describe, it, expect } from 'vitest';
import { TEMPLATES, WEEK, templatesFor, buildFromTemplate } from './splits.js';
import { MUSCLE_IDS } from './muscles.js';
import { EXERCISE_DB, toLibraryEntry } from './exerciseDb.js';

describe('split types to choose from', () => {
  it('offers a good range, from 2 to 6 days', () => {
    const days = Object.entries(TEMPLATES).filter(([id]) => id !== 'blank').map(([, t]) => t.trainDays);
    expect(Object.keys(TEMPLATES).length).toBeGreaterThanOrEqual(14);
    for (const d of [2, 3, 4, 5, 6]) expect(days).toContain(d);
  });

  it('every template has as many workout days as it says, only real weekdays and real muscles', () => {
    for (const [id, t] of Object.entries(TEMPLATES)) {
      expect(Object.keys(t.days).length, id).toBe(t.trainDays);
      for (const k of Object.keys(t.days)) expect(WEEK, id).toContain(k);
      for (const d of Object.values(t.days)) for (const m of d.muscles) expect(MUSCLE_IDS, `${id}: ${m}`).toContain(m);
      expect(t.levels.length, id).toBeGreaterThan(0);
      expect(t.note.length, id).toBeGreaterThan(10);
    }
  });

  it('the filters pick sensible ones', () => {
    expect(templatesFor({ experience: 'beginner', days: 3 })).not.toContain('arnold');
    expect(templatesFor({ experience: 'advanced', days: 6 })).toContain('arnold');
    expect(templatesFor({ days: 2 })).toEqual(expect.arrayContaining(['fullBody2', 'blank']));
    expect(templatesFor({ days: 4 })).toEqual(expect.arrayContaining(['upperLower', 'torsoLimbs', 'phul', 'fullBody4']));
  });

  it('building from any template fills every workout day from your library', () => {
    const lib = EXERCISE_DB.map(toLibraryEntry);
    for (const id of Object.keys(TEMPLATES)) {
      const r = buildFromTemplate(id, lib);
      const work = Object.values(r.days).filter(d => d.splitType !== 'rest');
      expect(work.length, id).toBe(TEMPLATES[id].trainDays);
      for (const d of work) expect(d.exerciseIds.length, `${id} ${d.label}`).toBeGreaterThan(0);
    }
  });
});
