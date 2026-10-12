// useDocument — Supabase single-document hook
// Stores one JSON document per user, identified by docId.
// Uses the user_meta table: (user_id text, key text, value jsonb), defined in
// supabase/user_meta.sql. Falls back to localStorage when Supabase is
// unavailable or the user is signed out.

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, getUserId } from './supabase.js';
import { storage } from '../utils/storage.js';
import { queueDoc, hasPendingDoc, flushDocs } from './docQueue.js';
import { isRetryable } from './writeQueue.js';

const toast = (message) => {
  try {
    window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type: 'error' } }));
  } catch {}
};

export function useDocument(docId, storageKey, defaultValue = null) {
  const [data,   setData]   = useState(() => storage.get(storageKey, defaultValue));
  const [synced, setSynced] = useState(false);
  const latest = useRef(data);
  latest.current = data;

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
      } else if (hasPendingDoc(docId)) {
        flushDocs();                       // an edit made offline is newer than the server copy: send it, do not overwrite it
      } else if (rows?.value) {
        setData(rows.value);
        storage.set(storageKey, rows.value);
      }
      setSynced(!error);

      // Live: a change to this document on another device arrives here at once. The topic is
      // unique per hook (supabase.channel returns the existing channel for a repeated topic).
      if (!alive) return;
      channel = supabase
        .channel(`doc:${docId}:${userId}:${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_meta', filter: `user_id=eq.${userId}` }, (payload) => {
          const row = payload?.new;
          if (!alive || !row || row.key !== docId || row.value == null) return;
          if (JSON.stringify(row.value) === JSON.stringify(latest.current)) return;   // our own write coming back
          latest.current = row.value;
          setData(row.value);
          storage.set(storageKey, row.value);
        })
        .subscribe();
    }
    let channel = null;
    init();
    return () => { alive = false; if (channel) supabase.removeChannel(channel); };
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

    let res;
    try {
      res = await supabase.from('user_meta').upsert({ user_id: userId, key: docId, value: newData }, { onConflict: 'user_id,key' });
    } catch (e) { res = { error: { message: String(e?.message || e) }, status: 0 }; }

    if (res?.error) {
      // No signal: keep the newest value and send it when the connection is back, rather than lose it.
      if (isRetryable(res)) {
        queueDoc(docId, newData);
        window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: 'Saved on this phone. It will sync when you are back online.', type: 'info' } }));
        return true;
      }
      console.error(`[VALERIE data] save failed on "${docId}":`, res.error.message);
      toast(`⚠️ Couldn't sync "${docId}" — ${res.error.message}`);
      return false;
    }
    return true;
  }, [docId, storageKey]);

  return { data, save, synced };
}
