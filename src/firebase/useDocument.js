// ─── useDocument — single-document Firestore sync hook ───────────────────────
// Pattern: localStorage for instant load → Firestore for real-time sync
// Stores docs under users/{deviceId}/meta/{metaKey}

import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, getDeviceId } from './firebase.js';
import { storage } from '../utils/storage.js';

/**
 * @param {string} metaKey    — Firestore doc name under users/{uid}/meta/
 * @param {string} storageKey — STORAGE_KEYS value (without valerie_ prefix) for localStorage cache
 * @param {*}      defaultValue
 * @returns {{ data, save, synced }}
 */
export function useDocument(metaKey, storageKey, defaultValue = null) {
  const userId = getDeviceId();
  const docRef = doc(db, 'users', userId, 'meta', metaKey);

  const [data, setData]     = useState(() => storage.get(storageKey, defaultValue));
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      docRef,
      snap => {
        if (snap.exists()) {
          const d = snap.data();
          setData(d);
          storage.set(storageKey, d);
        }
        setSynced(true);
      },
      err => {
        console.warn(`[Firestore/meta/${metaKey}]`, err.message);
        setSynced(false);
      },
    );
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (newData) => {
    setData(newData);
    storage.set(storageKey, newData);
    try {
      await setDoc(docRef, newData);
    } catch (err) {
      console.warn(`[Firestore/meta/${metaKey}/save]`, err.message);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, save, synced };
}
