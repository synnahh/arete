import { describe, it, expect } from 'vitest';
import { loadDraft, saveDraft, markStarted, clearDraft, applyDraft } from './sessionDraft.js';

const mk = () => { const mem = {}; return { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } }; };

describe('session draft', () => {
  it('keeps typed values for today only', () => {
    const s = mk();
    saveDraft('2026-10-13', { a: [{ weight: '82.5', reps: '8', done: false, prev: { weight: 80 } }] }, 123, s);
    expect(loadDraft('2026-10-13', s)).toEqual({ date: '2026-10-13', startedAt: 123, rows: { a: [{ weight: '82.5', reps: '8', done: false }] } });
    expect(loadDraft('2026-10-14', s).rows).toEqual({});
  });

  it('remembers when the session started, once', () => {
    const s = mk();
    expect(markStarted('2026-10-13', 500, s)).toBe(500);
    expect(markStarted('2026-10-13', 900, s)).toBe(500);
    clearDraft(s);
    expect(loadDraft('2026-10-13', s).startedAt).toBeNull();
  });

  it('puts typed values back on sets not yet logged and keeps logged ones', () => {
    const planned = [
      { weight: 80, reps: 8, done: true, prev: null },
      { weight: 80, reps: 8, done: false, prev: { weight: 77.5, reps: 8 } },
      { weight: 80, reps: 8, done: false, prev: null },
    ];
    const out = applyDraft(planned, [{ weight: 99, reps: 1 }, { weight: 82.5, reps: 6 }, { weight: 85, reps: 5 }, { weight: 85, reps: 4 }]);
    expect(out[0]).toMatchObject({ weight: 80, reps: 8, done: true });
    expect(out[1]).toMatchObject({ weight: 82.5, reps: 6, done: false, prev: { weight: 77.5, reps: 8 } });
    expect(out).toHaveLength(4);          // the extra set you added comes back
    expect(out[3]).toMatchObject({ weight: 85, reps: 4, done: false, prev: null });
  });

  it('keeps a removed set removed', () => {
    const planned = [{ weight: 80, reps: 8, done: false }, { weight: 80, reps: 8, done: false }, { weight: 80, reps: 8, done: false }];
    expect(applyDraft(planned, [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }])).toHaveLength(2);
    expect(applyDraft(planned, [])).toBe(planned);
  });
});
