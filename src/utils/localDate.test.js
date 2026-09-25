import { describe, it, expect, afterEach, vi } from 'vitest';
import { toLocalDateKey, todayLocalKey, parseLocalDateKey, addDaysLocal, localDayOf, isOnLocalDay } from './localDate.js';

// Test script pins TZ=Australia/Sydney (UTC+10 in Sept, UTC+11 from first Sunday of Oct).
afterEach(() => vi.useRealTimers());

describe('timezone precondition', () => {
  it('runs in Australia/Sydney', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Australia/Sydney');
  });
});

describe('toLocalDateKey / todayLocalKey', () => {
  it('returns the LOCAL day at 8am Sydney, where the old UTC idiom returned yesterday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T22:00:00Z')); // 08:00 on 25 Sep in Sydney
    expect(new Date().toISOString().split('T')[0]).toBe('2026-09-24'); // the bug
    expect(todayLocalKey()).toBe('2026-09-25');                        // the fix
  });

  it('month start stays in the same month (old idiom returned previous month end)', () => {
    const monthStart = new Date(2026, 8, 1); // local 1 Sep
    expect(monthStart.toISOString().split('T')[0]).toBe('2026-08-31');
    expect(toLocalDateKey(monthStart)).toBe('2026-09-01');
  });

  it('handles invalid input without throwing', () => {
    expect(toLocalDateKey(new Date('nope'))).toBe('');
  });
});

describe('parseLocalDateKey', () => {
  it('parses as local midnight and round-trips', () => {
    const d = parseLocalDateKey('2026-10-04');
    expect(d.getHours()).toBe(0);
    expect(toLocalDateKey(d)).toBe('2026-10-04');
  });
  it('rejects malformed keys', () => {
    expect(parseLocalDateKey('2026-9-4')).toBeNull();
    expect(parseLocalDateKey('')).toBeNull();
  });
});

describe('addDaysLocal', () => {
  it('crosses the Sydney DST start (4 Oct 2026) without skipping or repeating a day', () => {
    expect(addDaysLocal('2026-10-03', 1)).toBe('2026-10-04');
    expect(addDaysLocal('2026-10-04', 1)).toBe('2026-10-05');
  });
  it('crosses month and year boundaries', () => {
    expect(addDaysLocal('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysLocal('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('localDayOf / isOnLocalDay', () => {
  it('keeps day keys as-is', () => {
    expect(localDayOf('2026-09-25')).toBe('2026-09-25');
  });
  it('maps a UTC timestamp to its Sydney day (the prefix is the wrong day)', () => {
    const ts = '2026-09-24T22:30:00.000Z'; // 08:30 on 25 Sep Sydney
    expect(ts.startsWith('2026-09-25')).toBe(false); // old comparison missed it
    expect(isOnLocalDay(ts, '2026-09-25')).toBe(true);
  });
  it('accepts epoch ms and rejects empties', () => {
    expect(localDayOf(Date.parse('2026-09-24T22:30:00Z'))).toBe('2026-09-25');
    expect(isOnLocalDay('', '2026-09-25')).toBe(false);
    expect(isOnLocalDay(undefined, '2026-09-25')).toBe(false);
  });
});
