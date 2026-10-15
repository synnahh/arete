// pushNotifications.js — Web Push permission, this device's subscription, and test/status calls to the
// push-send function. Standard Web Push with VAPID; no Firebase. Works in the iPhone app once it is on the
// Home Screen (iOS 16.4+), and in Chrome, Edge and Firefox.
//
// This device's subscription is saved in user_meta 'push_subs' ({ subs: [...] }), one entry per device,
// which the push-send function reads. Schedule rules: supabase/functions/_shared/pushSchedule.js.

import { supabase, getUserId } from '../supabase/supabase.js';
import { captureError } from './sentry.js';

// The public half of the VAPID key pair. Public by design, so it is fine as a VITE_ variable.
// (VITE_FIREBASE_VAPID_KEY is the older name and still works.)
const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || import.meta.env.VITE_FIREBASE_VAPID_KEY;
const KEY_NAME = 'push_subs';
const MAX_DEVICES = 5;

export const pushConfigured = () => !!VAPID_KEY;

/** 'granted' | 'denied' | 'default' | 'unavailable', without prompting. */
export function pushPermissionStatus() {
  if (typeof Notification === 'undefined') return 'unavailable';
  return Notification.permission;
}

/** Can this browser do push at all? On iPhone it needs the app added to the Home Screen first. */
export function pushSupport() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const ios = /iPhone|iPad|iPod/.test(ua);
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: ios && !standalone ? 'On iPhone, push only works from the Home Screen app. Open Arete from its Home Screen icon (Share > Add to Home Screen first).' : 'This browser does not support push notifications.' };
  }
  return { ok: true };
}

const urlBase64ToUint8 = (base64) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

async function swReady() {
  return Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('The app is still starting. Try again in a moment.')), 6000))]);
}

async function readSubs(userId) {
  const { data } = await supabase.from('user_meta').select('value').eq('user_id', userId).eq('key', KEY_NAME).maybeSingle();
  return Array.isArray(data?.value?.subs) ? data.value.subs : [];
}
async function writeSubs(userId, subs) {
  const { error } = await supabase.from('user_meta').upsert({ user_id: userId, key: KEY_NAME, value: { subs } }, { onConflict: 'user_id,key' });
  if (error) throw new Error(error.message);
}

/**
 * Ask permission (must be called from a tap) and subscribe this device.
 * Resolves to 'granted' | 'denied' | 'unavailable' | 'no-vapid-key' (or throws a readable Error).
 */
export async function requestPushPermission() {
  const support = pushSupport();
  if (!support.ok) return 'unavailable';
  if (!VAPID_KEY) return 'no-vapid-key';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  await registerFCMToken({ strict: true });
  return 'granted';
}

/** Subscribe this device (idempotent) and save it. Returns the subscription or null. */
export async function registerFCMToken({ strict = false } = {}) {
  if (!VAPID_KEY || pushPermissionStatus() !== 'granted' || !pushSupport().ok) return null;
  try {
    const reg = await swReady();
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8(VAPID_KEY) });
    const json = sub.toJSON();
    const userId = await getUserId();
    if (!userId) throw new Error('Sign in first so this device can be saved.');
    const device = /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'Computer';
    const entry = { endpoint: json.endpoint, keys: json.keys, device, addedAt: Date.now() };
    const others = (await readSubs(userId)).filter((s) => s.endpoint !== entry.endpoint);
    await writeSubs(userId, [entry, ...others].slice(0, MAX_DEVICES));
    return sub;
  } catch (err) {
    captureError(err, { source: 'push_register' });
    if (strict) throw err;
    return null;
  }
}

/** Is this device currently subscribed? */
export async function isSubscribed() {
  if (!pushSupport().ok || pushPermissionStatus() !== 'granted') return false;
  try { return !!(await (await swReady()).pushManager.getSubscription()); } catch { return false; }
}

/** Turn push off on this device and forget it on the server. */
export async function unsubscribePush() {
  try {
    const reg = await swReady();
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    const userId = await getUserId();
    if (userId) await writeSubs(userId, (await readSubs(userId)).filter((s) => s.endpoint !== endpoint));
  } catch (err) { captureError(err, { source: 'push_unsubscribe' }); }
}

async function callPush(body) {
  const { data, error } = await supabase.functions.invoke('push-send', { body });
  if (error) {
    let detail = '';
    try { detail = (await error.context?.json?.())?.error || ''; } catch { /* no body */ }
    throw new Error(detail || error.message || 'Could not reach the push service');
  }
  return data;
}

/** Is the server side set up (VAPID keys and owner secret present)? false when the function is not deployed. */
export async function pushServerReady() {
  try { return (await callPush({ mode: 'status' }))?.configured === true; } catch { return false; }
}

/** Send one test notification to every saved device. Resolves { sent, failed, removed }. */
export async function sendTestPush() {
  return callPush({ mode: 'test' });
}

/** A notification straight from this device (no server): used for in-app reminders. */
export async function showLocalNotification(title, body, { tag, url } = {}) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg) return;
  reg.showNotification(title, { body, icon: '/assets/icon-192.png', badge: '/assets/icon-192.png', tag: tag || title, renotify: false, data: { url } });
}
