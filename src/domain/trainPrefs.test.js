import { describe, it, expect } from 'vitest';
import { cleanTrainPrefs, TRAIN_DEFAULTS, effortOptions, effortLabel, ownRest } from './trainPrefs.js';
import { recommendedSets, restSeconds } from './training.js';
import { demoUrl } from './exerciseDb.js';

describe('train preferences', () => {
  it('an empty setting means the old behaviour', () => {
    expect(cleanTrainPrefs(undefined)).toEqual(TRAIN_DEFAULTS);
    expect(cleanTrainPrefs({ effort: 'bogus', defaultSets: 99 })).toEqual(TRAIN_DEFAULTS);
  });
  it('keeps valid choices', () => {
    expect(cleanTrainPrefs({ effort: 'rir', warmups: false, plates: false, autoRest: false, defaultSets: 4 }))
      .toEqual({ effort: 'rir', warmups: false, plates: false, autoRest: false, defaultSets: 4 });
  });
  it('the same stored value shows as reps left in RIR mode', () => {
    expect(effortOptions('rpe').map(o => o.text)).toEqual(['6', '7', '8', '9', '10']);
    expect(effortOptions('rir').map(o => [o.rpe, o.text])).toEqual([[6, '4'], [7, '3'], [8, '2'], [9, '1'], [10, '0']]);
    expect(effortOptions('off')).toEqual([]);
    expect(effortLabel('rir')).toBe('Reps left?');
  });
  it('an exercise\'s own rest and the default sets are honoured', () => {
    expect(ownRest({ restSeconds: 45 })).toBe(45);
    expect(ownRest({ restSeconds: 5 })).toBeNull();
    expect(restSeconds({ repsMax: 8, restSeconds: 45 })).toBe(45);
    expect(restSeconds({ repsMax: 8, restSeconds: 45 }, 90)).toBe(45);
    expect(restSeconds({ repsMax: 8 }, 90)).toBe(90);
    expect(recommendedSets({ name: 'Bench Press', repsMin: 6, repsMax: 8 }, { defaultSets: 4 }).sets).toBe(4);
    expect(recommendedSets({ name: 'Bench Press', repsMin: 6, repsMax: 8, plannedSets: 2 }, { defaultSets: 4 }).sets).toBe(2);
  });
  it('builds a demo search link for an exercise name', () => {
    const u = demoUrl('Low-Incline Neutral-Grip DB Press');
    expect(u.startsWith('https://www.youtube.com/results?search_query=')).toBe(true);
    expect(decodeURIComponent(u)).toContain('Low-Incline Neutral-Grip DB Press');
    expect(demoUrl('')).toBeNull();
  });
});
