// useDocument — Supabase single-document hook
// Stores one JSON document per user, identified by docId.
// Uses the user_meta table: (user_id text, key text, value jsonb), defined in
// supabase/user_meta.sql. Falls back to localStorage when Supabase is
// unavailable or the user is signed out.

import { useState, useEffect, useCallback } from 'react';
import { supabase, getUserId } from './supabase.js';
import { storage } from '../utils/storage.js';

const toast = (message) => {
  try {
    window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type: 'error' } }));
  } catch {}
};

export function useDocument(docId, storageKey, defaultValue = null) {
  const [data,   setData]   = useState(() => storage.get(storageKey, defaultValue));
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let alive = true;
    async function init() {
      const userId = await getUserId();
      if (!alive) return;

      // Signed out (or mounted before sign-in): keep the local copy and skip
      // the query. Previously this queried with a null user id.
      if (!userId) { setSynced(false); return; }

      const { data: rows, error } = await supabase
        .from('user_meta')
        .select('value')
        .eq('user_id', userId)
        .eq('key', docId)
        .maybeSingle();

      if (!alive) return;
      if (error) {
        console.warn(`[useDocument/${docId}] fetch failed:`, error.message);
      } else if (rows?.value) {
        setData(rows.value);
        storage.set(storageKey, rows.value);
      }
      setSynced(!error);
    }
    init();
    return () => { alive = false; };
  }, [docId, storageKey]);

  /** Save locally and to Supabase. Resolves true only when the sync succeeded. */
  const save = useCallback(async (newData) => {
    setData(newData);
    storage.set(storageKey, newData);

    const userId = await getUserId();
    if (!userId) {
      // Not signed in — the local copy above is still saved, but nothing
      // synced. Surface it instead of failing silently.
      console.error(`[VALERIE data] save failed on "${docId}": not signed in`);
      toast(`⚠️ Not signed in — "${docId}" saved on this device only`);
      return false;
    }

    const { error } = await supabase
      .from('user_meta')
      .upsert({ user_id: userId, key: docId, value: newData }, { onConflict: 'user_id,key' });

    if (error) {
      console.error(`[VALERIE data] save failed on "${docId}":`, error.message);
      toast(`⚠️ Couldn't sync "${docId}" — ${error.message}`);
      return false;
    }
    return true;
  }, [docId, storageKey]);

  return { data, save, synced };
}
