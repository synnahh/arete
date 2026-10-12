import { describe, it, expect } from 'vitest';
import { newId, isRetryable, isDuplicate, backoffMs, enqueue, withPending, pendingCount, loadQueue, saveQueue, QUEUE_KEY } from './writeQueue.js';

describe('ids made on the device', () => {
  it('are valid, different UUIDs', () => {
    const a = newId(), b = newId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});

describe('which failures are worth retrying', () => {
  it('retries a dead network and server trouble', () => {
    expect(isRetryable({ status: 0, error: { message: 'x' } })).toBe(true);
    expect(isRetryable({ status: 503, error: { message: 'x' } })).toBe(true);
    expect(isRetryable({ status: 429, error: { message: 'x' } })).toBe(true);
    expect(isRetryable({ error: { message: 'TypeError: Failed to fetch' } })).toBe(true);
  });
  it('does not retry the server saying no', () => {
    expect(isRetryable({ status: 403, error: { message: 'denied' } })).toBe(false);
    expect(isRetryable({ status: 400, error: { message: 'bad' } })).toBe(false);
    expect(isRetryable({ status: 409, error: { code: '23505', message: 'duplicate key' } })).toBe(false);
    expect(isRetryable({ error: { message: 'new row violates row-level security policy' } })).toBe(false);
  });
  it('knows a duplicate-key refusal means an earlier try already got through', () => {
    expect(isDuplicate({ error: { code: '23505' } })).toBe(true);
    expect(isDuplicate({ error: { message: 'duplicate key value violates unique constraint' } })).toBe(true);
    expect(isDuplicate({ error: { message: 'denied' } })).toBe(false);
  });
  it('waits longer each time, never more than five minutes', () => {
    expect(backoffMs(0)).toBe(2000);
    expect(backoffMs(1)).toBe(4000);
    expect(backoffMs(3)).toBe(16000);
    expect(backoffMs(20)).toBe(300000);
  });
});

describe('the queue', () => {
  const add = (id, data) => ({ op: 'add', table: 't', id, userId: 'u', data });
  it('folds an update into a waiting add, and replaces an earlier update', () => {
    let q = enqueue([], add('a', { n: 1 }));
    q = enqueue(q, { op: 'update', table: 't', id: 'a', data: { n: 2 } });
    expect(q).toHaveLength(1);
    expect(q[0].data).toEqual({ n: 2 });
    q = enqueue([], { op: 'update', table: 't', id: 'b', data: { n: 1 } });
    q = enqueue(q, { op: 'update', table: 't', id: 'b', data: { n: 5 } });
    expect(q).toHaveLength(1);
    expect(q[0].data).toEqual({ n: 5 });
  });
  it('a remove cancels a waiting add, and drops waiting updates of a saved row', () => {
    expect(enqueue(enqueue([], add('a', {})), { op: 'remove', table: 't', id: 'a' })).toEqual([]);
    const q = enqueue(enqueue([], { op: 'update', table: 't', id: 'b', data: { n: 1 } }), { op: 'remove', table: 't', id: 'b' });
    expect(q.map(o => o.op)).toEqual(['remove']);
  });
  it('keeps changes to different rows and tables apart, and does not change its input', () => {
    const base = [add('a', {})];
    const q = enqueue(base, { op: 'update', table: 'other', id: 'a', data: { n: 1 } });
    expect(q).toHaveLength(2);
    expect(base).toHaveLength(1);
  });
  it('lays waiting changes over fetched rows without touching other tables', () => {
    const rows = [{ id: 'x', v: 1 }, { id: 'y', v: 1 }];
    const q = [add('n', { v: 9 }), { op: 'update', table: 't', id: 'x', data: { v: 2 } }, { op: 'remove', table: 't', id: 'y' }, { op: 'add', table: 'other', id: 'z', data: {} }];
    expect(withPending('t', rows, q)).toEqual([{ id: 'x', v: 2 }, { id: 'n', v: 9 }]);
    expect(pendingCount(q)).toBe(4);
    expect(pendingCount(q, 't')).toBe(3);
  });
  it('is saved to storage and read back, ignoring junk', () => {
    const mem = {};
    const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
    saveQueue([add('a', { n: 1 })], storage);
    expect(loadQueue(storage)).toHaveLength(1);
    mem[QUEUE_KEY] = '[{"nope":1},{"op":"add","table":"t","id":"q"}]';
    expect(loadQueue(storage).map(o => o.id)).toEqual(['q']);
    mem[QUEUE_KEY] = 'not json';
    expect(loadQueue(storage)).toEqual([]);
  });
});
