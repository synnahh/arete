// writeQueue.js — the pure parts of offline-safe saving. No network, no React.
//
// Every row gets its id on the device (a UUID), so sending the same add twice can never make two
// rows: the second one is refused as a duplicate and counts as done. A change that could not reach
// the server because the network is down is kept in a queue (saved in localStorage so it survives a
// refresh or a closed app) and sent in order when the connection returns. A change the server
// refuses for a real reason (not allowed, bad data) is not retried forever: it is dropped and
// reported, and the screen goes back to how it was.

export const QUEUE_KEY = 'arete_write_queue';
const MAX_QUEUE = 500;

/** A new row id, made on the device. */
export function newId() {
  const c = typeof crypto !== 'undefined' ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  const b = c?.getRandomValues ? c.getRandomValues(new Uint8Array(16)) : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Was this a failure worth retrying later? Network down or a server hiccup: yes. The server saying
 * no (permissions, bad data, row missing): no.
 */
export function isRetryable(result) {
  const status = result?.status;
  const msg = String(result?.error?.message || '');
  if (status === 0) return true;
  if (typeof status === 'number' && status > 0) return status === 408 || status === 429 || status >= 500;
  return /failed to fetch|network|load failed|timeout|offline/i.test(msg);       // no status at all: judge by the message
}

/** A duplicate-key refusal on an add means an earlier try already got there: that is success. */
export const isDuplicate = (result) => result?.error?.code === '23505' || /duplicate key/i.test(String(result?.error?.message || ''));

/** Milliseconds to wait before the next try: 2 s, 4 s, 8 s ... up to 5 minutes. */
export const backoffMs = (attempt) => Math.min(5 * 60 * 1000, 2000 * 2 ** Math.max(0, attempt));

export function loadQueue(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try {
    const raw = storage?.getItem(QUEUE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(o => o && o.table && o.id && ['add', 'update', 'remove'].includes(o.op)) : [];
  } catch { return []; }
}

export function saveQueue(queue, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { storage?.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE))); } catch { /* storage full or blocked */ }
}

/**
 * Add a change to the queue, folding it into earlier ones where that is safe:
 *  - an update after an add becomes part of the add, and an update after an update replaces it
 *  - a remove of something that was never sent cancels it out (nothing ever reaches the server)
 *  - a remove of something already on the server drops its pending updates
 * Returns the new queue (the input is not changed).
 */
export function enqueue(queue, op) {
  const q = queue.map(o => ({ ...o }));
  const same = (o) => o.table === op.table && o.id === op.id;
  if (op.op === 'update') {
    const add = q.find(o => same(o) && o.op === 'add');
    if (add) { add.data = op.data; return q; }
    const upd = q.find(o => same(o) && o.op === 'update');
    if (upd) { upd.data = op.data; return q; }
    return [...q, op];
  }
  if (op.op === 'remove') {
    if (q.some(o => same(o) && o.op === 'add')) return q.filter(o => !same(o));
    return [...q.filter(o => !(same(o) && o.op === 'update')), op];
  }
  return [...q.filter(o => !same(o) || o.op !== 'add'), op];
}

/**
 * Lay the changes still waiting on top of rows fetched from the server, so a refresh that happens
 * while you are offline (or mid-sync) does not make your own changes disappear and reappear.
 * rows: [{ id, ...data }] for one table. Returns the list to show.
 */
export function withPending(table, rows, queue) {
  let out = rows.map(r => ({ ...r }));
  for (const o of queue) {
    if (o.table !== table) continue;
    if (o.op === 'add') { if (!out.some(r => r.id === o.id)) out.push({ id: o.id, ...o.data }); }
    else if (o.op === 'update') out = out.map(r => (r.id === o.id ? { id: o.id, ...o.data } : r));
    else if (o.op === 'remove') out = out.filter(r => r.id !== o.id);
  }
  return out;
}

/** How many changes are waiting, overall or for one table. */
export const pendingCount = (queue, table = null) => queue.filter(o => !table || o.table === table).length;
