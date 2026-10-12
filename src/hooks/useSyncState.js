// useSyncState — is the app online, and how many saved changes (rows and documents) are still
// waiting to reach the server?
import { useEffect, useState } from 'react';
import { pendingWrites } from '../supabase/useCollection.js';
import { pendingDocCount } from '../supabase/docQueue.js';
import { useOnline } from './useOnline.js';

const waiting = () => pendingWrites() + pendingDocCount();

export function useSyncState() {
  const online = useOnline();
  const [pending, setPending] = useState(waiting);
  useEffect(() => {
    const on = () => setPending(waiting());
    window.addEventListener('arete:queue', on);
    return () => window.removeEventListener('arete:queue', on);
  }, []);
  return { online, pending, state: !online ? 'offline' : pending > 0 ? 'syncing' : 'synced' };
}
