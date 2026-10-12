import { describe, it, expect } from 'vitest';
import { compareCount, readPing } from './syncCheck.js';

describe('sync check', () => {
  it('compares counts', () => {
    expect(compareCount('Notes', 5, 5).status).toBe('same');
    expect(compareCount('Notes', 6, 5).status).toBe('cloud-ahead');
    expect(compareCount('Notes', 4, 5).status).toBe('device-ahead');
    expect(compareCount('Notes', null, 5).status).toBe('unknown');
  });
  it('reads a ping and knows its own echo', () => {
    const at = '2026-10-12T10:00:00.000Z';
    const p = readPing({ device: 'Phone', deviceId: 'a', at, count: 3 }, 'b', Date.parse(at) + 4000);
    expect(p).toMatchObject({ from: 'Phone', own: false, ageSeconds: 4, count: 3 });
    expect(readPing({ device: 'Phone', deviceId: 'a', at }, 'a', Date.parse(at)).own).toBe(true);
    expect(readPing({ device: 'x' }, 'a', 0)).toBeNull();
    expect(readPing({ device: 'x', at: 'nope' }, 'a', 0)).toBeNull();
    expect(readPing(null, 'a', 0)).toBeNull();
  });
});

describe('health data freshness', () => {
  it('is fresh for today and yesterday, stale after, none when nothing has arrived', async () => {
    const { healthStatus } = await import('./syncCheck.js');
    expect(healthStatus('2026-10-12', '2026-10-12')).toEqual({ state: 'fresh', days: 0 });
    expect(healthStatus('2026-10-11', '2026-10-12').state).toBe('fresh');
    expect(healthStatus('2026-10-09', '2026-10-12')).toEqual({ state: 'stale', days: 3 });
    expect(healthStatus(null, '2026-10-12').state).toBe('none');
  });
});
