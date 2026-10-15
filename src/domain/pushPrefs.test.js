import { describe, it, expect } from 'vitest';
import { cleanPush, dueItems, markSent, inQuiet, localParts, payloadFor, DEFAULT_PUSH, validTime } from './pushPrefs.js';

const sched = (over = {}) => cleanPush({ ...DEFAULT_PUSH, enabled: true, tz: 'Australia/Sydney', ...over });
// 2026-10-15 is a Thursday. Sydney is UTC+11 in October (daylight time).
const at = (hhmm) => new Date(`2026-10-15T${hhmm}:00+11:00`);

describe('localParts', () => {
  it('reads weekday, time and date in the zone', () => {
    expect(localParts(new Date('2026-10-15T02:30:00Z'), 'Australia/Sydney')).toEqual({ dow: 4, hhmm: '13:30', date: '2026-10-15' });
  });
  it('falls back to UTC for an unknown zone', () => {
    expect(localParts(new Date('2026-10-15T02:30:00Z'), 'Nowhere/Land').hhmm).toBe('02:30');
  });
});

describe('cleanPush', () => {
  it('starts from the standard set, off', () => {
    const p = cleanPush(undefined);
    expect(p.enabled).toBe(false);
    expect(p.items.map(i => i.id)).toContain('food');
  });
  it('drops bad times and empty reminders, fixes days, keeps ids unique', () => {
    const p = cleanPush({ enabled: true, items: [
      { id: 'a', time: '25:00', title: 'x' },
      { id: 'b', time: '08:00', title: '', body: '' },
      { id: 'c', time: '08:00', title: 'Hi', days: [9, 'x'] },
      { id: 'c', time: '09:00', title: 'Again', days: [1] },
    ] });
    expect(p.items.map(i => i.title)).toEqual(['Hi', 'Again']);
    expect(p.items[0].days).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(new Set(p.items.map(i => i.id)).size).toBe(2);
  });
  it('validates times', () => { expect(validTime('07:30')).toBe(true); expect(validTime('7:30')).toBe(false); });
});

describe('quiet hours', () => {
  const q = { on: true, from: '22:00', to: '06:30' };
  it('wraps midnight', () => {
    expect(inQuiet(q, '23:15')).toBe(true);
    expect(inQuiet(q, '03:00')).toBe(true);
    expect(inQuiet(q, '06:30')).toBe(false);
    expect(inQuiet(q, '12:00')).toBe(false);
    expect(inQuiet({ ...q, on: false }, '23:15')).toBe(false);
  });
});

describe('dueItems', () => {
  it('fires within 10 minutes after the time, once', () => {
    const p = sched();
    expect(dueItems(p, at('07:30')).map(i => i.id)).toContain('plan');
    expect(dueItems(p, at('07:39')).map(i => i.id)).toContain('plan');
    expect(dueItems(p, at('07:40')).map(i => i.id)).not.toContain('plan');
    expect(dueItems(p, at('07:29')).map(i => i.id)).not.toContain('plan');
  });
  it('never sends the same reminder twice in a day, and resets next day', () => {
    const p = sched();
    const due = dueItems(p, at('07:32'));
    const sent = markSent(p, at('07:32'), null, due);
    expect(dueItems(p, at('07:36'), sent).map(i => i.id)).not.toContain('plan');
    const next = new Date('2026-10-16T07:31:00+11:00');
    expect(dueItems(p, next, sent).map(i => i.id)).toContain('plan');
  });
  it('respects days, off switches and the master switch', () => {
    const p = sched();
    expect(dueItems(p, at('07:00')).map(i => i.id)).not.toContain('weigh'); // Monday only; this is Thursday
    expect(dueItems(sched({ items: p.items.map(i => ({ ...i, on: false })) }), at('07:30'))).toEqual([]);
    expect(dueItems({ ...p, enabled: false }, at('07:30'))).toEqual([]);
    const monday = new Date('2026-10-12T07:01:00+11:00');
    expect(dueItems(p, monday).map(i => i.id)).toContain('weigh');
  });
  it('holds back reminders that fall in quiet hours', () => {
    const p = sched({ items: [{ id: 'late', time: '22:30', title: 'Late', body: 'x' }] });
    expect(dueItems(p, at('22:31'))).toEqual([]);
    expect(dueItems({ ...p, quiet: { ...p.quiet, on: false } }, at('22:31')).map(i => i.id)).toEqual(['late']);
  });
  it('builds a payload that opens the right screen', () => {
    expect(payloadFor({ id: 'food', title: 'T', body: 'B', tab: 'fuel' })).toEqual({ title: 'T', body: 'B', tag: 'arete-food', url: '/?go=fuel' });
  });
});
