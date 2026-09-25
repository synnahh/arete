//  pushNotifications.js  Web Push permission + token management 
// Uses standard Web Push API with VAPID  no Firebase Messaging dependency.
// Works on iOS Safari PWA (16.4+), Chrome, Firefox, Edge.

import { supabase, getUserId } from '../supabase/supabase.js';
import { captureError }        from './sentry.js';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/**
 * Request notification permission.
 * Returns 'granted' | 'denied' | 'unavailable' | 'no-vapid-key'
 */
export async function requestPushPermission() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unavailable';
  if (!VAPID_KEY) {
    console.warn('[Push] VITE_FIREBASE_VAPID_KEY not set  push notifications disabled');
    return 'no-vapid-key';
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  await registerFCMToken();
  return 'granted';
}

/**
 * Register (or refresh) the push subscription and save to Supabase.
 */
export async function registerFCMToken() {
  if (!VAPID_KEY || Notification.permission !== 'granted') return null;

  try {
    const swReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 5000)),
    ]);

    // Convert VAPID key to Uint8Array
    const urlBase64ToUint8 = (base64) => {
      const padding = '='.repeat((4 - base64.length % 4) % 4);
      const base64Fixed = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
      const raw = atob(base64Fixed);
      return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
    };

    const subscription = await swReg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8(VAPID_KEY),
    });

    if (subscription) {
      // Store subscription in Supabase
      const userId = await getUserId();
      await supabase.from('user_meta').upsert({
        user_id: userId,
        key:     'push_token',
        value:   { subscription: subscription.toJSON(), updatedAt: Date.now(), platform: 'pwa' },
      }, { onConflict: 'user_id,key' });
    }

    return subscription;
  } catch (err) {
    captureError(err, { source: 'push_token_register' });
    return null;
  }
}

/**
 * Check current permission state without triggering a prompt.
 */
export function pushPermissionStatus() {
  if (!('Notification' in window)) return 'unavailable';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/**
 * Send a local notification immediately (no server required).
 */
export async function showLocalNotification(title, body, { tag, url } = {}) {
  if (Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg) return;
  reg.showNotification(title, {
    body,
    icon:     '/assets/icon-192.png',
    badge:    '/assets/icon-192.png',
    tag:      tag || title,
    renotify: false,
    data:     { url },
  });
}
