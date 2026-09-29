// Progress photos: pure logic (no React, no network). The upload/signing side
// lives in src/utils/photoStore.js, the UI in src/components/ProgressPhotos.jsx.
//
// A photo row is metadata only: { date: 'YYYY-MM-DD', pose, path, thumbPath, w, h, bytes, note }.
// The image itself sits in the private `progress-photos` Storage bucket.

export const POSES = [
  { id: 'front', label: 'Front' },
  { id: 'side',  label: 'Side' },
  { id: 'back',  label: 'Back' },
  { id: 'face',  label: 'Face' },
];
// Body screens show the first three; the Look section shows Face on its own.
export const BODY_POSES = ['front', 'side', 'back'];
const POSE_IDS = new Set(POSES.map(p => p.id));

export const normalisePose = (pose) => (POSE_IDS.has(pose) ? pose : 'front');

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whole-day index of a local 'YYYY-MM-DD' key, or NaN. Timezone- and DST-proof. */
export function dayIndex(key) {
  const m = KEY.exec(String(key || ''));
  if (!m) return NaN;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  // Reject impossible dates such as 2026-02-31, which Date.UTC silently rolls over.
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return NaN;
  return Math.round(t / 86400000);
}

export function daysBetween(a, b) {
  const d = dayIndex(b) - dayIndex(a);
  return Number.isFinite(d) ? d : null;
}

/** Scale (w, h) down to fit inside a max x max box. Never upscales. */
export function fitWithin(w, h, max) {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/**
 * Storage object path. The first folder MUST be the user id: the bucket's
 * policies only let a user touch objects under their own folder.
 */
export function photoPath(userId, { date, pose, nonce, thumb = false }) {
  const safeNonce = String(nonce || '').replace(/[^a-z0-9]/gi, '').slice(0, 12) || '0';
  return `${userId}/${date}-${normalisePose(pose)}-${safeNonce}${thumb ? '-thumb' : ''}.jpg`;
}

/** Photos of one pose, oldest first (date, then creation order as a tiebreak). */
export function byPose(photos = [], pose) {
  return photos
    .filter(p => p && p.path && normalisePose(p.pose) === pose && Number.isFinite(dayIndex(p.date)))
    .sort((a, b) => dayIndex(a.date) - dayIndex(b.date) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
}

/** Weigh-in closest to `date` within `maxGapDays`, as a number, or null. */
export function nearestWeight(bodyMetrics = [], date, maxGapDays = 7) {
  const target = dayIndex(date);
  if (!Number.isFinite(target)) return null;
  let best = null, bestGap = Infinity;
  for (const m of bodyMetrics) {
    const w = parseFloat(m?.weight);
    const d = dayIndex(m?.date);
    if (!Number.isFinite(w) || !Number.isFinite(d)) continue;
    const gap = Math.abs(d - target);
    if (gap <= maxGapDays && gap < bestGap) { best = w; bestGap = gap; }
  }
  return best;
}

/**
 * Before/after summary for two photos: days apart and the weight change between
 * the weigh-ins nearest each date (null when either is missing, never guessed).
 */
export function comparison(before, after, bodyMetrics = []) {
  if (!before || !after) return null;
  const days = daysBetween(before.date, after.date);
  const wb = nearestWeight(bodyMetrics, before.date);
  const wa = nearestWeight(bodyMetrics, after.date);
  const weightDeltaKg = wb != null && wa != null ? Math.round((wa - wb) * 10) / 10 : null;
  return { days, weightBefore: wb, weightAfter: wa, weightDeltaKg };
}

/** Default comparison for a pose: the first photo against the latest. */
export function defaultPair(list) {
  return list.length >= 2 ? { before: list[0], after: list[list.length - 1] } : null;
}

/** Short label such as "29 Sep" from a day key. */
export function formatDay(key) {
  const m = KEY.exec(String(key || ''));
  if (!m || !Number.isFinite(dayIndex(key))) return String(key || '');
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
