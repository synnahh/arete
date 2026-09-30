import { describe, it, expect, vi, beforeEach } from 'vitest';

// A tiny in-memory Supabase: one table's rows, a fetch counter, switches to make calls fail,
// and the realtime handler the store registers so tests can fire a change.
const db = { rows: [], fetches: 0, failFetch: false, failWrite: false, handler: null, channels: [], removed: 0, userId: 'u1' };

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
        } else if (db.failWrite) r = { data: null, error: { message: 'denied' } };
        else if (st.op === 'insert') { const row = { id: `r${db.rows.length + 1}`, user_id: st.payload.user_id, data: st.payload.data }; db.rows.push(row); r = { data: row, error: null }; }
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
  Object.assign(db, { rows: [], fetches: 0, failFetch: false, failWrite: false, handler: null, channels: [], removed: 0, userId: 'u1' });
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
    expect(id).toBe('r1');
    expect(s.items).toEqual([{ id: 'r1', name: 'one' }]);
    expect(mirror('k1')).toEqual(mirror('k2'));

    expect(await __store.updateIn(s, id, { name: 'two', extra: true })).toBe(true);
    expect(s.items[0]).toEqual({ id: 'r1', name: 'two', extra: true });
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

  it('a row that realtime already delivered is not added twice by add()', async () => {
    const { s } = mount();
    await __store.start(s);
    const origInsert = db.rows.length;
    // Simulate realtime winning the race: the row is in the list before addTo appends it.
    const p = __store.addTo(s, { n: 1 });
    __store.setItems(s, [{ id: `r${origInsert + 1}`, n: 1 }]);
    await p;
    expect(s.items.filter(i => i.id === `r${origInsert + 1}`)).toHaveLength(1);
  });
});
