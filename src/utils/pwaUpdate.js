// pwaUpdate.js — service worker registration with a prompt instead of a silent swap.
// A new version is downloaded in the background and waits. The UpdatePrompt banner tells you and
// reloads only when you tap Reload, so an update never lands in the middle of a workout or while
// you are typing. The worker is also checked for updates every 30 minutes and when the app
// returns to the foreground, so an installed phone app does not stay on an old version for days.
import { registerSW } from 'virtual:pwa-register';

let applyUpdate = null;
const fire = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

export function startPwaUpdates() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() { fire('arete:update-ready'); },
    onOfflineReady() { fire('arete:offline-ready'); },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => registration.update().catch(() => {});
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    },
  });
}

/** Activate the waiting version and reload. Call only when the user has asked to. */
export async function applyPwaUpdate() {
  if (applyUpdate) await applyUpdate(true);
  else window.location.reload();
}
