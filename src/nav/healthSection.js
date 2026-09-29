// healthSection.js — "open Coach at this Health section" (e.g. Water on Fuel).
// The request is queued here and read by Health.jsx when the Coach screen
// that owns the section mounts. Kept tiny so nudges and the command palette
// can use it without importing the Health bundle.
import { SCREEN_FOR_HEALTH_SECTION } from './groups.js';

let pending = null;

export function requestHealthSection(id) { pending = id; }
export function peekHealthSection() { return pending; }
export function clearHealthSection() { pending = null; }

/** Queue the section and return the Coach screen to navigate to. */
export function screenForHealthSection(id) {
  const screen = SCREEN_FOR_HEALTH_SECTION[id] ?? null;
  if (screen) pending = id;
  return screen;
}
