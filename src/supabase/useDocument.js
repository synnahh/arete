// useDocument — Supabase single-document hook
// Stores one JSON document per user, identified by docId.
// Uses the existing user_meta table: (user_id text, key text, value jsonb)
// Falls back to localStorage when Supabase is unavailable.

import { useState, useEffect, useCallback } from 'react';
import { supabase, getUserId } from './supabase.js';
import { storage } from '../utils/storage.js';

export function useDocument(docId, storageKey, defaultValue = null) {
  const [data,   setData]   = useState(() => storage.get(storageKey, defaultValue));
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let alive = true;
    async function init() {
      const userId = await getUserId();
      if (!alive) return;

      const { data: rows, error } = await supabase
        .from('user_meta')
        .select('value')
        .eq('user_id', userId)
        .eq('key', docId)
        .maybeSingle();

      if (!alive) return;
      if (!error && rows?.value) {
        setData(rows.value);
        storage.set(storageKey, rows.value);
      }
      setSynced(true);
    }
    init();
    return () => { alive = false; };
  }, [docId, storageKey]);

  const save = useCallback(async (newData) => {
    setData(newData);
    storage.set(storageKey, newData);

    const userId = await getUserId();
    if (!userId) {
      // Not signed in — the local copy above is still saved, but nothing
      // synced. Surface it instead of failing silently.
      console.error(`[VALERIE data] save failed on "${docId}": not signed in`);
      window.dispatchEvent(new CustomEvent('valerie:toast', {
        detail: { message: `⚠️ Not signed in — "${docId}" saved on this device only`, type: 'error' },
      }));
      return;
    }

    const { error } = await supabase
      .from('user_meta')
      .upsert({ user_id: userId, key: docId, value: newData }, { onConflict: 'user_id,key' });

    if (error) {
      console.error(`[VALERIE data] save failed on "${docId}":`, error.message);
      window.dispatchEvent(new CustomEvent('valerie:toast', {
        detail: { message: `⚠️ Couldn't sync "${docId}" — ${error.message}`, type: 'error' },
      }));
    }
  }, [docId, storageKey]);

  return { data, save, synced };
}
