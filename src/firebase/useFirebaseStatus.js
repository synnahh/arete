//  useSupabaseStatus  lightweight Firestore connectivity check 
// Tries an onSnapshot to a sentinel document.
// If Firestore responds from the server (not cache), firebase is "synced".

import { useState, useEffect } from 'react';
import { doc, onSnapshot }     from 'firebase/firestore';
import { db, getUserIdSync }      from './firebase.js';

export function useSupabaseStatus() {
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const userId   = getUserIdSync();
    const sentinel = doc(db, 'users', userId, '_meta', 'status');

    const unsub = onSnapshot(
      sentinel,
      { includeMetadataChanges: true },
      (snap) => {
        // fromCache = false   data came from Firestore server   genuinely synced
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

