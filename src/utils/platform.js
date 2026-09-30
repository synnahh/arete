// ─── platform.js — Runtime environment detection ──────────────────────────────
// Used throughout the app to switch between Tauri (desktop) and PWA (mobile/web)
// behaviour without duplicating component logic.

/**
 * Returns true when running inside a Tauri window.
 * The __TAURI_INTERNALS__ global is injected by Tauri at runtime.
 */
export function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Returns true when the app should render the mobile (iOS) shell.
 *
 * PWA / Netlify builds: ALWAYS return true — this is the iOS app.
 * Tauri builds: detect based on viewport + user agent so the desktop
 *               shell still works during local development.
 */
export function isMobile() {
  if (typeof window === 'undefined') return false;

  // Tauri desktop app  ALWAYS desktop shell regardless of any env var or screen size
  if (isTauri()) return false;

  // PWA build (Netlify)  VITE_FORCE_MOBILE baked in at build time
  if (import.meta.env.VITE_FORCE_MOBILE === 'true') return true;

  // Allow explicit overrides via URL param during dev/testing
  const params = new URLSearchParams(window.location.search);
  if (params.has('desktop')) return false;
  if (params.has('mobile'))  return true;

  // Plain browser  detect naturally by screen size / user agent
  return (
    window.innerWidth < 768 ||
    /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)
  );
}

/**
 * Returns true when the app is running as an installed PWA
 * (added to home screen — no browser chrome).
 */
export function isInstalledPWA() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

/**
 * Safe fetch — uses Tauri's HTTP plugin on desktop (bypasses CORS),
 * falls back to standard browser fetch on web/PWA.
 */
export async function platformFetch(url, options = {}) {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    return tauriFetch(url, options);
  }
  return fetch(url, options);
}

/**
 * Safe invoke — calls a Tauri backend command on desktop.
 * Returns null silently on web (where Tauri commands don't exist).
 */
export async function platformInvoke(command, args = {}) {
  if (!isTauri()) return null;
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(command, args);
}
