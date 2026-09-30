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
  else setItems(s, (data || []).map(rowToItem));
  s.synced = true;
  notify(s);

  // The topic includes the session so a quick unmount/remount never reuses a channel
  // that is still being removed (supabase.channel returns the existing one for a topic).
  s.channel = supabase
    .channel(`${s.name}:${userId}:${session}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: s.name, filter: `user_id=eq.${userId}` }, async () => {
      const { data: fresh, error: freshError } = await fetchAll(s, userId);
      if (s.session !== session) return;
      if (freshError || !Array.isArray(fresh)) return;
      setItems(s, fresh.map(rowToItem));
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

//  Store-level CRUD (always against the latest list, so an update right after an add works)
async function addTo(s, item) {
  const userId = s.userId || await getUserId();
  if (!userId) { reportDataError(s.name, 'add', 'Not signed in — cannot save.'); return null; }
  const { id: _skip, ...data } = item;
  const { data: row, error } = await supabase
    .from(s.name)
    .insert({ user_id: userId, data })
    .select()
    .single();

  if (error) { reportDataError(s.name, 'add', error.message); return null; }
  const newItem = rowToItem(row);
  if (!s.items.some(i => i.id === newItem.id)) setItems(s, [...s.items, newItem]); // realtime may have got there first
  return newItem.id;
}

async function updateIn(s, id, patch) {
  const existing = s.items.find(i => i.id === id);
  if (!existing) return false;
  const { id: _skip, ...existingData } = existing;
  const merged = { ...existingData, ...patch };

  const { error } = await supabase.from(s.name).update({ data: merged }).eq('id', id);
  if (error) { reportDataError(s.name, 'update', error.message); return false; }
  setItems(s, s.items.map(i => (i.id === id ? { id, ...merged } : i)));
  return true;
}

async function removeFrom(s, id) {
  const { error } = await supabase.from(s.name).delete().eq('id', id);
  if (error) { reportDataError(s.name, 'remove', error.message); return false; }
  setItems(s, s.items.filter(i => i.id !== id));
  return true;
}

// Exposed for tests only: the store without React.
export const __store = { storeFor, start, stop, setItems, addTo, updateIn, removeFrom, STOP_GRACE_MS };

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
