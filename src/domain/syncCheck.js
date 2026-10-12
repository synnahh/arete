// syncCheck.js — the pure parts of the Sync check: comparing what the cloud holds with what this
// device holds, and reading a ping that came from another device. Pure.

/** The collections worth comparing: { table, label }. */
export const CHECKED = [
  ['workout_logs', 'Workout logs'], ['nutrition_logs', 'Food logs'], ['body_metrics', 'Weigh-ins and check-ins'],
  ['water_logs', 'Water logs'], ['sleep_data', 'Sleep'], ['habits', 'Habits'], ['saved_meals', 'Saved meals'],
  ['programs', 'Programs'], ['notes', 'Notes'], ['tasks', 'Tasks'], ['supplements', 'Supplements'],
].map(([table, label]) => ({ table, label }));

/** One row of the comparison: same when the cloud and this device hold the same number. */
export function compareCount(label, cloud, local) {
  if (!Number.isFinite(cloud)) return { label, cloud: null, local, status: 'unknown' };
  if (cloud === local) return { label, cloud, local, status: 'same' };
  return { label, cloud, local, status: cloud > local ? 'cloud-ahead' : 'device-ahead' };
}

/**
 * What a ping document says to this device. A ping from this same device is only the echo of
 * our own button press, so it says nothing about the other device.
 */
export function readPing(ping, deviceId, nowMs) {
  if (!ping || typeof ping !== 'object' || !ping.at || !ping.device) return null;
  const sent = Date.parse(ping.at);
  if (!Number.isFinite(sent)) return null;
  return { from: String(ping.device), own: ping.deviceId === deviceId, ageSeconds: Math.max(0, Math.round((nowMs - sent) / 1000)), sentMs: sent, count: Number(ping.count) || 1 };
}

/**
 * Has Apple Health data (Eufy scale, Fitbit Air, iPhone) reached the app lately?
 * lastSync is the newest day a health row exists for, as 'YYYY-MM-DD'.
 */
export function healthStatus(lastSync, today) {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(lastSync || ''));
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(today || ''));
  if (!a || !b) return { state: 'none', days: null };
  const day = (m) => Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000;
  const days = Math.max(0, Math.round(day(b) - day(a)));
  return { state: days <= 1 ? 'fresh' : 'stale', days };
}
