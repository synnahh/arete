import { describe, it, expect, beforeEach } from 'vitest';
import { coachSnapshot } from './context.js';
import { buildCoachBrief } from './coachPrompt.js';
import { STORAGE_KEYS } from '../utils/storage.js';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
// The Look collections mirror to a key that already starts with valerie_, so storage.get double-prefixes it.
const put = (key, value) => mem.set('valerie_' + key, JSON.stringify(value));
const NOW = new Date('2026-09-30T10:00:00');

beforeEach(() => mem.clear());

describe('coachSnapshot', () => {
  it('is empty-safe with no data at all', () => {
    const s = coachSnapshot(NOW);
    expect(s.pace).toBeUndefined();
    expect(s.readiness).toBeUndefined();
    expect(s.stalledLifts).toBe(0);
    expect(buildCoachBrief({ message: 'how am I doing', snapshot: s })).toMatch(/PRINCIPLES/);
  });

  it('reads the skin routine and rating trend from the Look mirrors', () => {
    put('valerie_lm_profile', { skinSteps: [{ id: 'a', name: 'Cleanser' }, { id: 'b', name: 'SPF' }] });
    put('valerie_lm_daily', [1, 2, 3].map(i => ({ date: '2026-09-2' + (5 + i), skinRating: 4 })));
    const s = coachSnapshot(NOW);
    expect(s.skin.steps).toBe(2);
    expect(s.skin.trend.status).toBe('ok');
  });

  it('reports the goal, a stale weigh-in, and a skincare routine with no steps', () => {
    put(STORAGE_KEYS.SETTINGS, { coachGoal: { template: 'cut', targets: { weeklyRateKg: -0.6 } } });
    put(STORAGE_KEYS.BODY, [{ date: '2026-09-20', weight: 90 }]);
    put('valerie_lm_profile', { skinSteps: [] });
    const s = coachSnapshot(NOW);
    expect(s.goal).toBe('cut');
    expect(s.daysSinceWeighIn).toBe(10);
    expect(s.skin.steps).toBe(0);
    const brief = buildCoachBrief({ message: 'am I on track', snapshot: s });
    expect(brief).toMatch(/No weigh-in for 10 days/);
    expect(brief).toMatch(/cleanser, moisturiser/);
  });
});
