// ─── haptics.js — Vibration feedback for iOS PWA ─────────────────────────────
// navigator.vibrate is supported on Android; iOS PWA has no haptics API.
// We call it anyway — it silently no-ops on iOS, works on Android PWA.

export const haptics = {
  tap:     () => navigator.vibrate?.([8]),
  light:   () => navigator.vibrate?.([4]),
  success: () => navigator.vibrate?.([10, 40, 10]),
  error:   () => navigator.vibrate?.([30, 20, 30]),
  heavy:   () => navigator.vibrate?.([20]),
};
