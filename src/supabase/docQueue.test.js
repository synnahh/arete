import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./supabase.js', () => ({ supabase: {}, getUserId: async () => 'u1' }));
const { queueDoc, pendingDoc, hasPendingDoc, pendingDocCount, flushDocs, DOC_QUEUE_KEY } = await import('./docQueue.js');

const mem = {};
const storage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
const server = { rows: {}, mode: 'ok' };
const client = {
  from: () => ({
    upsert: async (p) => {
      if (server.mode === 'offline') return { error: { message: 'TypeError: Failed to fetch' }, status: 0 };
      if (server.mode === 'denied') return { error: { message: 'denied' }, status: 403 };
      server.rows[p.key] = p.value;
      return { error: null, status: 201 };
    },
  }),
};
const opts = (extra = {}) => ({ client, userIdOf: async () => 'u1', storage, ...extra });

beforeEach(() => { for (const k of Object.keys(mem)) delete mem[k]; server.rows = {}; server.mode = 'ok'; });

describe('document queue', () => {
  it('remembers only the newest value of a document, saved on the device', () => {
    queueDoc('lib', [1], storage);
    queueDoc('lib', [1, 2], storage);
    expect(pendingDoc('lib', storage)).toEqual([1, 2]);
    expect(hasPendingDoc('lib', storage)).toBe(true);
    expect(pendingDocCount(storage)).toBe(1);
    expect(JSON.parse(mem[DOC_QUEUE_KEY])).toEqual({ lib: [1, 2] });
  });

  it('sends waiting documents when the connection is back and then forgets them', async () => {
    queueDoc('lib', [1, 2], storage); queueDoc('settings', { a: 1 }, storage);
    const r = await flushDocs(opts());
    expect(r).toEqual({ sent: 2, left: 0 });
    expect(server.rows).toEqual({ lib: [1, 2], settings: { a: 1 } });
    expect(pendingDocCount(storage)).toBe(0);
  });

  it('keeps everything while the network is still down', async () => {
    queueDoc('lib', [1], storage);
    server.mode = 'offline';
    const r = await flushDocs(opts());
    expect(r).toEqual({ sent: 0, left: 1 });
    expect(pendingDoc('lib', storage)).toEqual([1]);
  });

  it('drops a document the server refuses for good, says so, and carries on', async () => {
    queueDoc('lib', [1], storage);
    server.mode = 'denied';
    const report = vi.fn();
    await flushDocs(opts({ report }));
    expect(report).toHaveBeenCalledWith('lib', 'denied');
    expect(pendingDocCount(storage)).toBe(0);
  });

  it('does not delete a newer value that was queued while the older one was uploading', async () => {
    queueDoc('lib', [1], storage);
    const slow = { from: () => ({ upsert: async (p) => { queueDoc('lib', [1, 2, 3], storage); server.rows[p.key] = p.value; return { error: null, status: 201 }; } }) };
    await flushDocs(opts({ client: slow }));
    expect(pendingDoc('lib', storage)).toEqual([1, 2, 3]);
  });

  it('does nothing when nobody is signed in', async () => {
    queueDoc('lib', [1], storage);
    const r = await flushDocs(opts({ userIdOf: async () => null }));
    expect(r).toEqual({ sent: 0, left: 1 });
  });
});
