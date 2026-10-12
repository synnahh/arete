//  useCollection  Supabase realtime collection hook
// Drop-in replacement for src/firebase/useCollection.js
// Table structure: id (uuid), user_id (text), data (jsonb), created_at (timestamptz)
// Each Firestore collection maps to a Supabase table of the same name.
//
// One shared store per table. However many components call useCollection('x'),
// there is one fetch and one realtime channel for it, and a change made through
// any of them shows in all of them straight away. (Before, every component kept
// its own copy, fetched and subscribed on its own: Home and Fuel and Train each
// opened their own channel for the same table, and a save in one reached the
// others only when realtime got round to it.)

import { useCallback, useEffect, useReducer } from 'react';
import { supabase, getUserId } from './supabase.js';
import { storage } from '../utils/storage.js';
import { newId, isRetryable, isDuplicate, backoffMs, loadQueue, saveQueue, enqueue, withPending } from './writeQueue.js';

// A failed write used to just log a warning and return, so the row silently
// vanished from the UI (e.g. "add subscription" doing nothing). Now it shouts:
// console.error + App's existing toast system (valerie:toast, type: 'error').
const OP_LABEL = { add: 'save', update: 'update', remove: 'delete' };
function reportDataError(collection, op, message) {
  console.error(`[VALERIE data] ${op} failed on "${collection}": ${message}`);
  try {
    window.dispatchEvent(new CustomEvent('valerie:toast', {
      detail: { message: `⚠️ Couldn't ${OP_LABEL[op] || op} — ${message}`, type: 'error' },
    }));
  } catch {}
}

const rowToItem = (row) => ({ id: row.id, ...row.data });

// ── Offline-safe writes ──────────────────────────────────────────────────────
// A change shows on screen at once. If the server cannot be reached it is kept in a queue (saved on
// the device, so it survives a refresh) and sent in order when the connection is back. Rows get
// their id on the device, so a resend can never make a duplicate. Rules: ./writeQueue.js.
let queue = loadQueue();
let flushing = false;
let attempt = 0;
let retryTimer = null;
let toldQueued = 0;

const emitQueue = () => { try { window.dispatchEvent(new CustomEvent('arete:queue', { detail: { pending: queue.length } })); } catch { /* no window */ } };
const persistQueue = () => { saveQueue(queue); emitQueue(); };
export const pendingWrites = () => queue.length;

async function run(call) {
  try { return await call; } catch (e) { return { error: { message: String(e?.message || e) }, status: 0 }; }
}

function toldOnce() {
  if (Date.now() - toldQueued < 60000) return;
  toldQueued = Date.now();
  try { window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: 'Saved on this phone. It will sync when you are back online.', type: 'info' } })); } catch { /* no window */ }
}

function scheduleFlush(delay = 0) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { retryTimer = null; flushQueue(); }, delay);
}

function queueChange(op) {
  queue = enqueue(queue, { ...op, at: Date.now() });
  persistQueue();
  toldOnce();
  scheduleFlush(op.immediate ? 0 : backoffMs(attempt));
}

/** Send what is waiting, oldest first, stopping at the first network failure. Safe to call any time. */
async function flushQueue() {
  if (flushing || !queue.length) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { scheduleFlush(backoffMs(attempt)); return; }
  flushing = true;
  try {
    while (queue.length) {
      const o = queue[0];
      const table = supabase.from(o.table);
      let res;
      if (o.op === 'add') res = await run(table.insert({ id: o.id, user_id: o.userId, data: o.data }));
      else if (o.op === 'update') res = await run(table.update({ data: o.data }).eq('id', o.id));
      else res = await run(table.delete().eq('id', o.id));
      if (!res.error || (o.op === 'add' && isDuplicate(res))) { queue = queue.slice(1); persistQueue(); attempt = 0; continue; }
      if (isRetryable(res)) { attempt += 1; scheduleFlush(backoffMs(attempt)); return; }
      // The server refused this change for good. Drop it, say so, and put the screen back.
      queue = queue.slice(1); persistQueue(); attempt = 0;
      reportDataError(o.table, o.op, res.error.message);
      const st = stores.get(o.table);
      if (st && o.op === 'add') setItems(st, st.items.filter(i => i.id !== o.id));
    }
  } finally { flushing = false; }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { attempt = 0; flushQueue(); });
  document.addEventListener?.('visibilitychange', () => { if (document.visibilityState === 'visible') flushQueue(); });
}

//  The store
const stores = new Map(); // collection name -> store

function storeFor(name) {
  let s = stores.get(name);
  if (!s) {
    s = { name, keys: new Set(), items: [], synced: false, listeners: new Set(), refs: 0, session: 0, channel: null, userId: null, running: false, stopTimer: null };
    stores.set(name, s);
  }
  return s;
}

const notify = (s) => s.listeners.forEach(fn => fn());

function mirrorOf(s) {
  for (const k of s.keys) {
    const v = storage.get(k, []);
    if (Array.isArray(v)) return v;
  }
  return [];
}

// Set the list, keep every local mirror of this table in step, tell the components.
function setItems(s, next) {
  s.items = next;
  for (const k of s.keys) storage.set(k, next);
  notify(s);
}

async function fetchAll(s, userId) {
  return supabase.from(s.name).select('*').eq('user_id', userId).order('created_at', { ascending: true });
}

// Load, then keep live. `session` guards every await: if the last component
// unmounted (or the store restarted) meanwhile, the stale run does nothing.
async function start(s) {
  const session = ++s.session;
  s.items = mirrorOf(s); // show the local copy at once; the fetch below replaces it
  notify(s);

  const userId = await getUserId();
  if (s.session !== session) return;
  s.userId = userId;

  // Not signed in yet: keep the local mirror on screen and wait.
  // (The sign-in gate renders before the app, so this is just a safety net.)
  if (!userId) { s.synced = false; notify(s); return; }

  const { data, error } = await fetchAll(s, userId);
  if (s.session !== session) return;
  // A failed fetch must never blank the list or its local mirror.
  if (error) console.warn(`[useCollection/${s.name}] fetch error:`, error.message);
  else setItems(s, withPending(s.name, (data || []).map(rowToItem), queue));
  s.synced = true;
  notify(s);
  flushQueue();                                   // anything saved while offline goes up now

  // The topic includes the session so a quick unmount/remount never reuses a channel
  // that is still being removed (supabase.channel returns the existing one for a topic).
  s.channel = supabase
    .channel(`${s.name}:${userId}:${session}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: s.name, filter: `user_id=eq.${userId}` }, async () => {
      const { data: fresh, error: freshError } = await fetchAll(s, userId);
      if (s.session !== session) return;
      if (freshError || !Array.isArray(fresh)) return;
      setItems(s, withPending(s.name, fresh.map(rowToItem), queue));
    })
    .subscribe();
}

// Navigating between screens unmounts the old one before the new one mounts, so
// the count briefly hits zero. Wait a moment before tearing the store down so a
// screen change does not refetch and reopen the channel every time.
const STOP_GRACE_MS = 8000;

function stop(s) {
  s.running = false;
  s.session++;
  if (s.channel) { supabase.removeChannel(s.channel); s.channel = null; }
}

//  Store-level CRUD (always against the latest list, so an update right after an add works).
// Each shows on screen at once; the server is then told, or the change is queued for later.
async function addTo(s, item) {
  const userId = s.userId || await getUserId();
  if (!userId) { reportDataError(s.name, 'add', 'Not signed in — cannot save.'); return null; }
  const { id: _skip, ...data } = item;
  const id = newId();
  setItems(s, [...s.items, { id, ...data }]);
  const res = await run(supabase.from(s.name).insert({ id, user_id: userId, data }));
  if (!res.error || isDuplicate(res)) return id;
  if (isRetryable(res)) { queueChange({ op: 'add', table: s.name, id, userId, data }); return id; }
  setItems(s, s.items.filter(i => i.id !== id));        // the server said no: take it back off the screen
  reportDataError(s.name, 'add', res.error.message);
  return null;
}

async function updateIn(s, id, patch) {
  const existing = s.items.find(i => i.id === id);
  if (!existing) return false;
  const { id: _skip, ...existingData } = existing;
  const merged = { ...existingData, ...patch };
  setItems(s, s.items.map(i => (i.id === id ? { id, ...merged } : i)));
  // Still waiting to be sent (or already has a change waiting): fold this one in, keep the order.
  if (queue.some(o => o.table === s.name && o.id === id)) { queueChange({ op: 'update', table: s.name, id, data: merged, immediate: true }); return true; }
  const res = await run(supabase.from(s.name).update({ data: merged }).eq('id', id));
  if (!res.error) return true;
  if (isRetryable(res)) { queueChange({ op: 'update', table: s.name, id, data: merged }); return true; }
  setItems(s, s.items.map(i => (i.id === id ? existing : i)));   // refused: back to how it was
  reportDataError(s.name, 'update', res.error.message);
  return false;
}

async function removeFrom(s, id) {
  const existing = s.items.find(i => i.id === id);
  setItems(s, s.items.filter(i => i.id !== id));
  if (queue.some(o => o.table === s.name && o.id === id && o.op === 'add')) { queueChange({ op: 'remove', table: s.name, id, immediate: true }); return true; }  // never reached the server
  const res = await run(supabase.from(s.name).delete().eq('id', id));
  if (!res.error) return true;
  if (isRetryable(res)) { queueChange({ op: 'remove', table: s.name, id }); return true; }
  if (existing) setItems(s, [...s.items, existing]);              // refused: put it back
  reportDataError(s.name, 'remove', res.error.message);
  return false;
}

// Exposed for tests only: the store without React.
export const __store = {
  storeFor, start, stop, setItems, addTo, updateIn, removeFrom, STOP_GRACE_MS, flushQueue,
  queue: () => queue, resetQueue: () => { queue = []; attempt = 0; flushing = false; if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; } toldQueued = 0; },
};

//  The hook
export function useCollection(collectionName, storageKey) {
  const s = storeFor(collectionName);
  const firstUse = s.keys.size === 0;
  s.keys.add(storageKey);
  // Before the first load, show what this device last saved.
  if (firstUse && s.items.length === 0) s.items = mirrorOf(s);

  const [, bump] = useReducer(n => n + 1, 0);
  useEffect(() => {
    s.listeners.add(bump);
    s.refs += 1;
    if (s.stopTimer) { clearTimeout(s.stopTimer); s.stopTimer = null; }
    if (!s.running) { s.running = true; start(s); }
    return () => {
      s.listeners.delete(bump);
      s.refs -= 1;
      if (s.refs === 0) s.stopTimer = setTimeout(() => { s.stopTimer = null; if (s.refs === 0) stop(s); }, STOP_GRACE_MS);
    };
  }, [s]);

  const add = useCallback((item) => addTo(s, item), [s]);
  const update = useCallback((id, patch) => updateIn(s, id, patch), [s]);
  const remove = useCallback((id) => removeFrom(s, id), [s]);

  return { items: s.items, add, update, remove, synced: s.synced };
}
