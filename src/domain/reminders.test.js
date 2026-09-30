import { describe, it, expect } from 'vitest';
import { dueCoachReminder, coachSlots } from './reminders.js';

const moves = [{ id: 'train', title: 'Push today', why: 'Readiness is 80.', tab: 'workout' }, { id: 'water', title: 'Drink', why: 'x', tab: 'fuel' }];

describe('dueCoachReminder', () => {
  it('sends the top move with a count of the rest, once per slot', () => {
    const r = dueCoachReminder({ hour: 8, moves });
    expect(r).toEqual({ slot: 'morning', title: 'Today: Push today', body: 'Readiness is 80. 1 more on your list.', tab: 'workout' });
    expect(dueCoachReminder({ hour: 9, moves, fired: ['morning'] })).toBeNull();
  });

  it('uses the evening slot later in the day', () => {
    expect(dueCoachReminder({ hour: 19, moves, fired: ['morning'] }).slot).toBe('evening');
    expect(dueCoachReminder({ hour: 19, moves, fired: ['morning'] }).title).toMatch(/^Tonight:/);
  });

  it('does not fire a stale slot hours late', () => {
    expect(dueCoachReminder({ hour: 13, moves })).toBeNull();
    expect(dueCoachReminder({ hour: 15, moves })).toBeNull();
  });

  it('stays quiet when disabled, at night, or with nothing to say', () => {
    expect(dueCoachReminder({ hour: 8, moves, cfg: { enabled: false } })).toBeNull();
    expect(dueCoachReminder({ hour: 5, moves, cfg: { morning: 5 } })).toBeNull();
    expect(dueCoachReminder({ hour: 23, moves, cfg: { evening: 23 } })).toBeNull();
    expect(dueCoachReminder({ hour: 8, moves: [] })).toBeNull();
  });

  it('honours custom hours and ignores out-of-range ones', () => {
    expect(dueCoachReminder({ hour: 7, moves, cfg: { morning: 7 } }).slot).toBe('morning');
    expect(coachSlots({ morning: 3, evening: 30 }).map(s => s.hour)).toEqual([8, 19]);
  });

  it('has no body count when there is only one move', () => {
    expect(dueCoachReminder({ hour: 8, moves: [moves[0]] }).body).toBe('Readiness is 80.');
  });
});

import { waitBeforeNudge, SYNCED_WAIT_MS, UNSYNCED_WAIT_MS } from './reminders.js';

describe('waitBeforeNudge', () => {
  it('waits briefly once synced and longer when it has not', () => {
    expect(waitBeforeNudge({ elapsedMs: 0, synced: true })).toBe(SYNCED_WAIT_MS);
    expect(waitBeforeNudge({ elapsedMs: 0, synced: false })).toBe(UNSYNCED_WAIT_MS);
  });

  it('counts time already elapsed and never goes negative', () => {
    expect(waitBeforeNudge({ elapsedMs: 1500, synced: true })).toBe(500);
    expect(waitBeforeNudge({ elapsedMs: 60000, synced: false })).toBe(0);
    expect(waitBeforeNudge({ elapsedMs: -5, synced: true })).toBe(SYNCED_WAIT_MS);
    expect(waitBeforeNudge({ synced: true })).toBe(SYNCED_WAIT_MS);
  });

  it('lets a sync that lands late release a nudge sooner than the offline wait', () => {
    expect(waitBeforeNudge({ elapsedMs: 8000, synced: true })).toBe(0);
    expect(waitBeforeNudge({ elapsedMs: 8000, synced: false })).toBeGreaterThan(0);
  });
});
