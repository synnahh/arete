//  useCollection  Supabase realtime collection hook 
// Drop-in replacement for src/firebase/useCollection.js
// Table structure: id (uuid), user_id (text), data (jsonb), created_at (timestamptz)
// Each Firestore collection maps to a Supabase table of the same name.

import { useState, useEffect, useCallback, useRef } from 'react';
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

// Every component that calls useCollection('x') has its own state. A save in one
// (say the sleep logger) used to reach the others (say the readiness card) only
// via the realtime refetch, so offline or before that arrived they showed stale
// data. Instances of the same collection now tell each other about each change.
const peers = new Set();

export function useCollection(collectionName, storageKey) {
  const [items,  setItems]  = useState(() => storage.get(storageKey, []));
  const [synced, setSynced] = useState(false);
  const userIdRef = useRef(null);
  const subRef    = useRef(null);
  // Latest items for update(): the render-time closure missed rows added since
  // the last render, so an update right after an add silently did nothing.
  const itemsRef  = useRef(items);
  itemsRef.current = items;
  const peerRef   = useRef(null);

  // Apply another instance's change to this one (idempotent).
  useEffect(() => {
    const peer = {
      name: collectionName,
      apply(op) {
        const next = op.type === 'add'
          ? (itemsRef.current.some(i => i.id === op.item.id) ? itemsRef.current : [...itemsRef.current, op.item])
          : op.type === 'update'
            ? itemsRef.current.map(i => (i.id === op.item.id ? op.item : i))
            : itemsRef.current.filter(i => i.id !== op.id);
        itemsRef.current = next;
        setItems(next);
        storage.set(storageKey, next);
      },
    };
    peerRef.current = peer;
    peers.add(peer);
    return () => { peers.delete(peer); };
  }, [collectionName, storageKey]);

  const tellPeers = useCallback((op) => {
    for (const p of peers) if (p !== peerRef.current && p.name === collectionName) p.apply(op);
  }, [collectionName]);

  //  Helpers 
  function rowToItem(row) {
    return { id: row.id, ...row.data };
  }

  function itemToRow(item, userId) {
    const { id, ...data } = item;
    return { id: id || undefined, user_id: userId, data };
  }

  //  Load + subscribe 
  useEffect(() => {
    let alive = true;

    async function init() {
      const userId = await getUserId();
      if (!alive) return;
      userIdRef.current = userId;

      // Not signed in yet — keep the localStorage mirror on screen and wait.
      // (The sign-in gate renders before the app, so this is just a safety net.)
      if (!userId) { setSynced(false); return; }

      // Initial fetch
      const { data, error } = await supabase
        .from(collectionName)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (!alive) return;

      if (error) {
        console.warn(`[useCollection/${collectionName}] fetch error:`, error.message);
      } else {
        const mapped = (data || []).map(rowToItem);
        setItems(mapped);
        storage.set(storageKey, mapped);
      }
      setSynced(true);

      // Realtime subscription
      subRef.current = supabase
        .channel(`${collectionName}:${userId}`)
        .on('postgres_changes', {
          event:  '*',
          schema: 'public',
          table:  collectionName,
          filter: `user_id=eq.${userId}`,
        }, async () => {
          // Re-fetch on any change
          const { data: fresh, error: freshError } = await supabase
            .from(collectionName)
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });
          if (!alive) return;
          // A failed refetch must not blank the list and its local mirror.
          if (freshError || !Array.isArray(fresh)) return;
          const mapped = fresh.map(rowToItem);
          setItems(mapped);
          storage.set(storageKey, mapped);
        })
        .subscribe();
    }

    init();
    return () => {
      alive = false;
      if (subRef.current) supabase.removeChannel(subRef.current);
    };
  }, [collectionName, storageKey]);

  //  CRUD 
  const add = useCallback(async (item) => {
    const userId = userIdRef.current || await getUserId();
    if (!userId) { reportDataError(collectionName, 'add', 'Not signed in — cannot save.'); return null; }
    const { id: _skip, ...data } = item;
    const { data: rows, error } = await supabase
      .from(collectionName)
      .insert({ user_id: userId, data })
      .select()
      .single();

    if (error) { reportDataError(collectionName, 'add', error.message); return null; }
    const newItem = rowToItem(rows);
    itemsRef.current = [...itemsRef.current, newItem];
    setItems(prev => {
      const next = [...prev, newItem];
      storage.set(storageKey, next);
      return next;
    });
    tellPeers({ type: 'add', item: newItem });
    return newItem.id;
  }, [collectionName, storageKey, tellPeers]);

  const update = useCallback(async (id, patch) => {
    // Merge patch into existing data
    const existing = itemsRef.current.find(i => i.id === id);
    if (!existing) return false;
    const { id: _skip, ...existingData } = existing;
    const merged = { ...existingData, ...patch };

    const { error } = await supabase
      .from(collectionName)
      .update({ data: merged })
      .eq('id', id);

    if (error) { reportDataError(collectionName, 'update', error.message); return false; }
    itemsRef.current = itemsRef.current.map(i => i.id === id ? { id, ...merged } : i);
    setItems(prev => {
      const next = prev.map(i => i.id === id ? { id, ...merged } : i);
      storage.set(storageKey, next);
      return next;
    });
    tellPeers({ type: 'update', item: { id, ...merged } });
    return true;
  }, [collectionName, storageKey, tellPeers]);

  const remove = useCallback(async (id) => {
    const { error } = await supabase
      .from(collectionName)
      .delete()
      .eq('id', id);

    if (error) { reportDataError(collectionName, 'remove', error.message); return false; }
    itemsRef.current = itemsRef.current.filter(i => i.id !== id);
    setItems(prev => {
      const next = prev.filter(i => i.id !== id);
      storage.set(storageKey, next);
      return next;
    });
    tellPeers({ type: 'remove', id });
    return true;
  }, [collectionName, storageKey, tellPeers]);

  return { items, add, update, remove, synced };
}
