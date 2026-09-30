// ─── useCollection — generic real-time Firestore collection hook ──────────────
// Pattern: localStorage for instant load   Firestore for real-time sync
// Falls back to localStorage-only if Firestore is unavailable

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, doc,
  addDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy,
} from 'firebase/firestore';
import { db, getUserIdSync } from './firebase.js';
import { storage } from '../utils/storage.js';

/**
 * @param {string} collectionName  — e.g. 'tasks', 'notes', 'events'
 * @param {string} storageKey      — STORAGE_KEYS value for localStorage backup
 * @returns {{ items, add, update, remove, synced, error }}
 */
export function useCollection(collectionName, storageKey) {
  const userId  = getUserIdSync();
  const colRef  = collection(db, 'users', userId, collectionName);

  // Load from localStorage immediately — zero-lag initial render
  const [items, setItems]   = useState(() => storage.get(storageKey, []));
  const [synced, setSynced] = useState(false);
  const [error, setError]   = useState(null);

  // Keep a stable ref to items so callbacks always have the latest value
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // ── Real-time Firestore subscription ──────────────────────────────────────
  // userId and collectionName are stable for the life of the app (single user,
  // fixed collection names), so [] is intentional — but listed here for clarity.
  useEffect(() => {
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setItems(data);
        storage.set(storageKey, data);
        setSynced(true);
        setError(null);
      },
      (err) => {
        console.warn(`[Firestore/${collectionName}]`, err.message);
        setError(err.message);
        setSynced(false);
        // Keep using localStorage data — don't clear it
      },
    );
    return () => unsub();
  }, [userId, collectionName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const add = useCallback(async (data) => {
    const payload = { ...data, createdAt: Date.now(), updatedAt: Date.now() };
    try {
      const ref = await addDoc(colRef, payload);
      return ref.id;
    } catch (err) {
      // Offline: optimistic insert with temp ID; Firestore will sync on reconnect
      const tempId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const item   = { id: tempId, ...payload };
      const next   = [item, ...itemsRef.current];
      setItems(next);
      storage.set(storageKey, next);
      return tempId;
    }
  }, [collectionName, storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback(async (id, updates) => {
    const payload = { ...updates, updatedAt: Date.now() };
    // Optimistic update first — feels instant
    const next = itemsRef.current.map(i => i.id === id ? { ...i, ...payload } : i);
    setItems(next);
    storage.set(storageKey, next);
    try {
      await updateDoc(doc(db, 'users', userId, collectionName, id), payload);
    } catch (err) {
      console.warn(`[Firestore/${collectionName}/update]`, err.message);
      // Already updated locally — will sync when back online
    }
  }, [userId, collectionName, storageKey]);

  const remove = useCallback(async (id) => {
    // Optimistic remove
    const next = itemsRef.current.filter(i => i.id !== id);
    setItems(next);
    storage.set(storageKey, next);
    try {
      await deleteDoc(doc(db, 'users', userId, collectionName, id));
    } catch (err) {
      console.warn(`[Firestore/${collectionName}/remove]`, err.message);
    }
  }, [userId, collectionName, storageKey]);

  return { items, add, update, remove, synced, error };
}

