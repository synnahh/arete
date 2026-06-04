// ─── pushNotifications.js — Web Push / FCM token management ──────────────────
// Handles permission requests, FCM token registration, and token storage.
// Only active on the PWA build — desktop Tauri uses native OS notifications.

import { db, getDeviceId }                     from '../firebase/firebase.js';
import { doc, setDoc }                          from 'firebase/firestore';
import { captureError }                         from './sentry.js';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/**
 * Request notification permission and register the FCM token.
 * Returns 'granted' | 'denied' | 'unavailable' | 'no-vapid-key'
 */
export async function requestPushPermission() {
  // Push not supported in Tauri or old browsers
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unavailable';
  }

  if (!VAPID_KEY) {
    console.warn('[Push] VITE_FIREBASE_VAPID_KEY not set — push notifications disabled');
    return 'no-vapid-key';
  }

  // iOS Safari requires the request to come from a user gesture — this
  // function should be called from a button click handler.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  await registerFCMToken();
  return 'granted';
}

/**
 * Register (or refresh) the FCM token and persist it to Firestore.
 * Called automatically after permission is granted, and on every app launch
 * when permission is already granted (token can rotate).
 */
export async function registerFCMToken() {
  if (!VAPID_KEY || Notification.permission !== 'granted') return null;

  try {
    // Dynamically import so firebase/messaging doesn't bloat the Tauri bundle
    const { getMessaging, getToken } = await import('firebase/messaging');
    const { getApp }                 = await import('firebase/app');

    const messaging = getMessaging(getApp());
    const swReg     = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey:            VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (token) {
      // Store token in Firestore so server-side or VALERIE-desktop can send pushes
      const userId = getDeviceId();
      await setDoc(
        doc(db, 'users', userId, 'meta', 'push_token'),
        { token, updatedAt: Date.now(), platform: 'pwa' },
      ).catch(() => {});
    }

    return token;
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
 * Use for in-app triggered alerts when the app is in the foreground.
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
