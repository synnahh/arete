import { describe, it, expect, vi, beforeEach } from 'vitest';

// A tiny in-memory Supabase: one table's rows, a fetch counter, switches to make calls fail,
// and the realtime handler the store registers so tests can fire a change.
const db = { rows: [], fetches: 0, failFetch: false, failWrite: false, offline: false, handler: null, channels: [], removed: 0, userId: 'u1' };

vi.mock('./supabase.js', () => {
  const builder = (table) => {
    const st = { op: 'select', id: null, payload: null };
    const b = {
      select: () => b, order: () => b, eq: (k, v) => { if (k === 'id') st.id = v; return b; }, single: () => b,
      insert: (p) => { st.op = 'insert'; st.payload = p; return b; },
      update: (p) => { st.op = 'update'; st.payload = p; return b; },
      delete: () => { st.op = 'delete'; return b; },
      then: (res, rej) => {
        let r;
        if (st.op === 'select') {
          db.fetches += 1;
          r = db.failFetch ? { data: null, error: { message: 'offline' } } : { data: db.rows.map(x => ({ ...x })), error: null };
        } else if (db.offline) r = { data: null, error: { message: 'TypeError: Failed to fetch' }, status: 0 };
        else if (db.failWrite) r = { data: null, error: { message: 'denied' }, status: 403 };
        else if (st.op === 'insert' && db.rows.some(x => x.id === st.payload.id)) r = { data: null, error: { code: '23505', message: 'duplicate key value' }, status: 409 };
        else if (st.op === 'insert') { const row = { id: st.payload.id ?? `r${db.rows.length + 1}`, user_id: st.payload.user_id, data: st.payload.data }; db.rows.push(row); r = { data: row, error: null }; }
        else if (st.op === 'update') { const row = db.rows.find(x => x.id === st.id); if (row) row.data = st.payload.data; r = { data: null, error: null }; }
        else { db.rows = db.rows.filter(x => x.id !== st.id); r = { data: null, error: null }; }
        return Promise.resolve(r).then(res, rej);
      },
    };
    return b;
  };
  return {
    supabase: {
      from: builder,
      channel: (topic) => { const ch = { topic, on(_e, _o, cb) { db.handler = cb; return ch; }, subscribe() { return ch; } }; db.channels.push(topic); return ch; },
      removeChannel: () => { db.removed += 1; },
    },
    getUserId: async () => db.userId,
  };
});

const { __store } = await import('./useCollection.js');

const mem = {};
vi.stubGlobal('localStorage', { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } });
const mirror = (key) => JSON.parse(mem['valerie_' + key] ?? 'null');
const row = (id, data) => ({ id, user_id: 'u1', data });
const flush = () => new Promise(r => setTimeout(r, 0));

let n = 0;
// A fresh store per test (unique table name), with one subscriber like a mounted component.
function mount(keys = ['k']) {
  const s = __store.storeFor(`t${++n}`);
  keys.forEach(k => s.keys.add(k));
  const calls = { n: 0 };
  s.listeners.add(() => { calls.n += 1; });
  s.refs = 1;
  return { s, calls };
}

beforeEach(() => {
  Object.assign(db, { rows: [], fetches: 0, failFetch: false, failWrite: false, offline: false, handler: null, channels: [], removed: 0, userId: 'u1' });
  __store.resetQueue();
  for (const k of Object.keys(mem)) delete mem[k];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('shared collection store', () => {
  it('loads once, mirrors to storage, and opens one channel', async () => {
    db.rows = [row('a', { x: 1 })];
    const { s, calls } = mount(['k']);
    await __store.start(s);
    expect(s.items).toEqual([{ id: 'a', x: 1 }]);
    expect(mirror('k')).toEqual([{ id: 'a', x: 1 }]);
    expect(s.synced).toBe(true);
    expect(db.fetches).toBe(1);
    expect(db.channels).toHaveLength(1);
    expect(calls.n).toBeGreaterThan(0);
  });

  it('shows the local mirror first and keeps it if the fetch fails', async () => {
    mem.valerie_k = JSON.stringify([{ id: 'old', x: 9 }]);
    db.failFetch = true;
    const { s } = mount(['k']);
    await __store.start(s);
    expect(s.items).toEqual([{ id: 'old', x: 9 }]);
    expect(mirror('k')).toEqual([{ id: 'old', x: 9 }]); // never blanked
    expect(s.synced).toBe(true);
  });

  it('waits without touching the mirror when nobody is signed in', async () => {
    mem.valerie_k = JSON.stringify([{ id: 'old' }]);
    db.userId = null;
    const { s } = mount(['k']);
    await __store.start(s);
    expect(s.items).toEqual([{ id: 'old' }]);
    expect(s.synced).toBe(false);
    expect(db.fetches).toBe(0);
    expect(db.channels).toHaveLength(0);
  });

  it('add, update and remove change the list for every subscriber and every mirror key', async () => {
    const { s } = mount(['k1', 'k2']);
    await __store.start(s);
    const id = await __store.addTo(s, { name: 'one' });
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(s.items).toEqual([{ id, name: 'one' }]);
    expect(db.rows[0].id).toBe(id);
    expect(mirror('k1')).toEqual(mirror('k2'));

    expect(await __store.updateIn(s, id, { name: 'two', extra: true })).toBe(true);
    expect(s.items[0]).toEqual({ id, name: 'two', extra: true });
    expect(db.rows[0].data).toEqual({ name: 'two', extra: true });

    expect(await __store.removeFrom(s, id)).toBe(true);
    expect(s.items).toEqual([]);
    expect(mirror('k2')).toEqual([]);
  });

  it('an update straight after an add works (no stale closure)', async () => {
    const { s } = mount();
    await __store.start(s);
    const id = await __store.addTo(s, { n: 1 });
    expect(await __store.updateIn(s, id, { n: 2 })).toBe(true);
    expect(s.items[0].n).toBe(2);
  });

  it('a failed write leaves the list alone and says so', async () => {
    const { s } = mount();
    await __store.start(s);
    const id = await __store.addTo(s, { n: 1 });
    db.failWrite = true;
    expect(await __store.addTo(s, { n: 2 })).toBeNull();
    expect(await __store.updateIn(s, id, { n: 3 })).toBe(false);
    expect(await __store.removeFrom(s, id)).toBe(false);
    expect(s.items).toEqual([{ id, n: 1 }]);
  });

  it('updating something that is not there is a no-op', async () => {
    const { s } = mount();
    await __store.start(s);
    expect(await __store.updateIn(s, 'ghost', { a: 1 })).toBe(false);
  });

  it('a realtime change refetches and replaces the list; a failed refetch keeps it', async () => {
    db.rows = [row('a', { v: 1 })];
    const { s } = mount(['k']);
    await __store.start(s);
    db.rows = [row('a', { v: 2 }), row('b', { v: 3 })];
    await db.handler(); await flush();
    expect(s.items.map(i => i.v)).toEqual([2, 3]);
    db.failFetch = true;
    await db.handler(); await flush();
    expect(s.items.map(i => i.v)).toEqual([2, 3]);
  });

  it('a stop while the first load is in flight makes that load do nothing', async () => {
    db.rows = [row('a', {})];
    const { s } = mount(['k']);
    const loading = __store.start(s);
    __store.stop(s);
    await loading;
    expect(db.channels).toHaveLength(0);
    expect(s.items).toEqual([]);
  });

  it('stopping removes the channel and a restart opens a new, differently named one', async () => {
    const { s } = mount();
    await __store.start(s);
    __store.stop(s);
    expect(db.removed).toBe(1);
    await __store.start(s);
    expect(db.channels).toHaveLength(2);
    expect(new Set(db.channels).size).toBe(2);
  });

  it('a row that realtime delivers back is not shown twice', async () => {
    const { s } = mount();
    await __store.start(s);
    const id = await __store.addTo(s, { n: 1 });
    await db.handler(); await flush();               // the realtime echo: a refetch that contains our row
    expect(s.items.filter(i => i.id === id)).toHaveLength(1);
  });
});

describe('offline-safe saving', () => {
  it('a change made offline shows at once, survives a refresh, and reaches the server when back online', async () => {
    const { s } = mount(['k']);
    await __store.start(s);
    db.offline = true;
    const id = await __store.addTo(s, { food: 'rice' });
    expect(id).toBeTruthy();
    expect(s.items).toEqual([{ id, food: 'rice' }]);
    expect(mirror('k')).toEqual([{ id, food: 'rice' }]);
    expect(db.rows).toHaveLength(0);
    expect(__store.queue()).toHaveLength(1);
    expect(JSON.parse(mem.arete_write_queue)).toHaveLength(1);       // saved on the device, not only in memory

    db.offline = false;
    await __store.flushQueue();
    expect(db.rows.map(r => r.id)).toEqual([id]);
    expect(db.rows[0].data).toEqual({ food: 'rice' });
    expect(__store.queue()).toHaveLength(0);
  });

  it('a refresh while changes are waiting does not make them vanish', async () => {
    const { s } = mount(['k']);
    await __store.start(s);
    db.offline = true;
    const id = await __store.addTo(s, { n: 1 });
    db.offline = false;
    await db.handler(); await flush();                              // a refetch that has not seen the queued add
    expect(s.items.map(i => i.id)).toContain(id);
  });

  it('editing something still waiting to be sent changes the waiting add, not a second row', async () => {
    const { s } = mount();
    await __store.start(s);
    db.offline = true;
    const id = await __store.addTo(s, { n: 1 });
    await __store.updateIn(s, id, { n: 2 });
    expect(__store.queue()).toHaveLength(1);
    expect(__store.queue()[0].data).toEqual({ n: 2 });
    db.offline = false;
    await __store.flushQueue();
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].data).toEqual({ n: 2 });
  });

  it('deleting something that never reached the server cancels it out', async () => {
    const { s } = mount();
    await __store.start(s);
    db.offline = true;
    const id = await __store.addTo(s, { n: 1 });
    expect(await __store.removeFrom(s, id)).toBe(true);
    expect(__store.queue()).toHaveLength(0);
    expect(s.items).toEqual([]);
    db.offline = false;
    await __store.flushQueue();
    expect(db.rows).toHaveLength(0);
  });

  it('edits and deletes of saved rows are queued while offline and sent in order', async () => {
    db.rows = [row('a', { v: 1 }), row('b', { v: 1 })];
    const { s } = mount();
    await __store.start(s);
    db.offline = true;
    expect(await __store.updateIn(s, 'a', { v: 2 })).toBe(true);
    expect(await __store.removeFrom(s, 'b')).toBe(true);
    expect(s.items).toEqual([{ id: 'a', v: 2 }]);
    expect(__store.queue().map(o => o.op)).toEqual(['update', 'remove']);
    db.offline = false;
    await __store.flushQueue();
    expect(db.rows.map(r => [r.id, r.data.v])).toEqual([['a', 2]]);
  });

  it('sending the same add twice never makes two rows', async () => {
    const { s } = mount();
    await __store.start(s);
    db.offline = true;
    const id = await __store.addTo(s, { n: 1 });
    db.rows.push({ id, user_id: 'u1', data: { n: 1 } });             // an earlier try had actually got through
    db.offline = false;
    await __store.flushQueue();
    expect(db.rows).toHaveLength(1);
    expect(__store.queue()).toHaveLength(0);
  });

  it('a change the server refuses for good is dropped and the screen goes back', async () => {
    const { s } = mount();
    await __store.start(s);
    db.offline = true;
    const id = await __store.addTo(s, { n: 1 });
    db.offline = false; db.failWrite = true;
    await __store.flushQueue();
    expect(__store.queue()).toHaveLength(0);                         // not retried forever
    expect(s.items.find(i => i.id === id)).toBeUndefined();
    expect(db.rows).toHaveLength(0);
  });

  it('keeps waiting changes while the network is still down', async () => {
    const { s } = mount();
    await __store.start(s);
    db.offline = true;
    await __store.addTo(s, { n: 1 });
    await __store.flushQueue();
    expect(__store.queue()).toHaveLength(1);
  });
});
