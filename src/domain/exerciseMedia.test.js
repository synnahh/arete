import { describe, it, expect } from 'vitest';
import { MEDIA_IDS, mediaFor, MEDIA_BASE } from './exerciseMedia.js';
import { EXERCISE_DB } from './exerciseDb.js';
import steps from '../data/exerciseSteps.json';

describe('exercise media', () => {
  it('only maps exercises that exist in the exercise database', () => {
    const names = new Set(EXERCISE_DB.map(e => e.name));
    expect(Object.keys(MEDIA_IDS).filter(n => !names.has(n))).toEqual([]);
  });
  it('has written steps for nearly every mapped exercise (a few entries in the source have none)', () => {
    const none = Object.keys(MEDIA_IDS).filter(n => !Array.isArray(steps[n]) || !steps[n].length);
    expect(none.length).toBeLessThan(Object.keys(MEDIA_IDS).length * 0.1);
  });
  it('builds two photo urls, case-insensitively, and null for no match', () => {
    const m = mediaFor('leg press');
    expect(m.images).toEqual([`${MEDIA_BASE}/${MEDIA_IDS['Leg Press']}/0.jpg`, `${MEDIA_BASE}/${MEDIA_IDS['Leg Press']}/1.jpg`]);
    expect(mediaFor('Wall Sit')).toBeNull();
    expect(mediaFor('')).toBeNull();
  });
  it('covers most of the database', () => {
    expect(Object.keys(MEDIA_IDS).length).toBeGreaterThan(100);
  });
});
