// ─── sentry.js — Sentry helpers for manual capture ───────────────────────────
// Use these anywhere in the app to report errors or custom events.
// Safe to call even when Sentry isn't configured — all functions are no-ops.

import * as Sentry from '@sentry/react';

/**
 * Capture an unexpected error with optional context tags.
 * Use for caught errors you want reported but that don't crash the UI.
 */
export function captureError(err, context = {}) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.withScope(scope => {
    Object.entries(context).forEach(([k, v]) => scope.setTag(k, String(v)));
    Sentry.captureException(err);
  });
}

/**
 * Capture a named event (non-error analytics).
 * E.g. captureEvent('voice_session_started', { engine: 'claude' })
 */
export function captureEvent(name, data = {}) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.captureMessage(name, { level: 'info', extra: data });
}

/**
 * Set user identity on the Sentry session.
 * Call this once auth resolves so errors are tied to a device ID.
 */
export function setSentryUser(deviceId) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.setUser({ id: deviceId });
}
