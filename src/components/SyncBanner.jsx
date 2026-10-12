// SyncBanner — a thin strip at the top of the phone app, only when it matters: you are offline
// (your changes are being kept on the phone), or saved changes are still on their way to the cloud.
// Silent when everything is synced. Rules: hooks/useSyncState.js, supabase/writeQueue.js.
import { useSyncState } from '../hooks/useSyncState.js';

export default function SyncBanner() {
  const { state, pending } = useSyncState();
  if (state === 'synced') return null;
  const offline = state === 'offline';
  return (
    <div role="status" aria-live="polite" style={{ flexShrink: 0, padding: '6px 14px', fontSize: 12.5, lineHeight: 1.35, textAlign: 'center', color: offline ? '#e8a13a' : 'var(--text-secondary)', background: offline ? 'rgba(232,161,58,0.10)' : 'var(--hover-bg)', borderBottom: '0.5px solid var(--card-border)' }}>
      {offline
        ? `You are offline. Changes are saved on this phone${pending ? ` (${pending} waiting)` : ''} and will sync when you are back.`
        : `Syncing ${pending} change${pending === 1 ? '' : 's'}…`}
    </div>
  );
}
