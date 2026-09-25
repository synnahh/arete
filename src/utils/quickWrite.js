// quickWrite — insert/delete a single collection row and get its id back, so
// automated/cross-tab writes can offer Undo. Mirrors useCollection's Supabase +
// localStorage-fallback behaviour. Mounted collections pick up changes via realtime.

import { supabase, getUserId } from '../supabase/supabase.js';
import { storage } from './storage.js';

function reportQuickWriteError(table, op, message) {
  console.error(`[VALERIE data] ${op} failed on "${table}": ${message}`);
  try {
    window.dispatchEvent(new CustomEvent('valerie:toast', {
      detail: { message: `⚠️ Couldn't sync — ${message}. Saved on this device only.`, type: 'error' },
    }));
  } catch {}
}

export async function insertRow(table, storageKey, payload) {
  const userId = await getUserId();
  if (userId) {
    const { data, error } = await supabase.from(table).insert({ user_id: userId, data: payload }).select().single();
    if (!error) {
      // keep local mirror in sync for instant reads
      const local = storage.get(storageKey, []);
      storage.set(storageKey, [{ id: data.id, ...payload }, ...(Array.isArray(local) ? local : [])]);
      return data.id;
    }
    reportQuickWriteError(table, 'save', error.message);
  } else {
    reportQuickWriteError(table, 'save', 'not signed in');
  }
  // Fallback: local-only id so the UI still works, but the user now knows why.
  const id = `local_${Date.now()}`;
  const local = storage.get(storageKey, []);
  storage.set(storageKey, [{ id, ...payload }, ...(Array.isArray(local) ? local : [])]);
  return id;
}

export async function deleteRow(table, storageKey, id) {
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) reportQuickWriteError(table, 'delete', error.message);
  } catch (err) {
    reportQuickWriteError(table, 'delete', err?.message || 'unknown error');
  }
  const local = storage.get(storageKey, []);
  if (Array.isArray(local)) storage.set(storageKey, local.filter(x => x.id !== id));
}
