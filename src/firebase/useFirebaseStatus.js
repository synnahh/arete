// ─── useFirebaseStatus — lightweight Firestore connectivity check ─────────────
// Tries an onSnapshot to a sentinel document.
// If Firestore responds from the server (not cache), firebase is "synced".

import { useState, useEffect } from 'react';
import { doc, onSnapshot }     from 'firebase/firestore';
import { db, getDeviceId }      from './firebase.js';

export function useFirebaseStatus() {
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const userId   = getDeviceId();
    const sentinel = doc(db, 'users', userId, '_meta', 'status');

    const unsub = onSnapshot(
      sentinel,
      { includeMetadataChanges: true },
      (snap) => {
        // fromCache = false → data came from Firestore server → genuinely synced
        setSynced(!snap.metadata.fromCache);
      },
      () => {
        setSynced(false);
      },
    );
    return () => unsub();
  }, []);

  return synced;
}
