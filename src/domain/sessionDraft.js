// sessionDraft.js — what you typed but have not logged yet, kept on the device so a refresh, an
// accidental close or the phone killing the app mid-workout loses nothing. Logged sets are already
// saved as workout_logs rows (the source of truth); this only keeps the weights and reps of sets
// still to do, the number of sets, and when the session started. One draft per day: an old one is
// ignored. Pure apart from the storage passed in.

export const DRAFT_KEY = 'arete_session_draft';

const ls = () => (typeof localStorage !== 'undefined' ? localStorage : null);
const read = (storage) => { try { const v = JSON.parse(storage?.getItem(DRAFT_KEY) || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; } };
const write = (storage, v) => { try { storage?.setItem(DRAFT_KEY, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

/** Today's draft ({ date, startedAt, rows: { exId: [{ weight, reps, done }] } }) or an empty one. */
export function loadDraft(date, storage = ls()) {
  const d = read(storage);
  return d && d.date === date ? { date, startedAt: d.startedAt ?? null, rows: d.rows && typeof d.rows === 'object' ? d.rows : {} } : { date, startedAt: null, rows: {} };
}

/** Save the rows of every exercise in `plan` (exId -> rows). Only the fields a refresh needs. */
export function saveDraft(date, plan, startedAt = null, storage = ls()) {
  const rows = {};
  for (const [id, rs] of Object.entries(plan || {})) {
    if (!Array.isArray(rs)) continue;
    rows[id] = rs.map(r => ({ weight: r.weight ?? '', reps: r.reps ?? '', done: !!r.done }));
  }
  write(storage, { date, startedAt, rows });
}

export function markStarted(date, at = Date.now(), storage = ls()) {
  const d = loadDraft(date, storage);
  if (d.startedAt) return d.startedAt;
  write(storage, { ...d, startedAt: at });
  return at;
}

export function clearDraft(storage = ls()) { try { storage?.removeItem(DRAFT_KEY); } catch { /* blocked */ } }

/**
 * Lay a draft over freshly planned rows. Sets that are logged (done) keep the saved values; for
 * the rest the typed weight and reps come back, and extra sets you added come back too. Sets you
 * removed stay removed as long as none of them was logged.
 */
export function applyDraft(rows, draftRows) {
  if (!Array.isArray(draftRows) || !draftRows.length) return rows;
  const out = rows.slice(0, Math.max(rows.filter(r => r.done).length, draftRows.length));
  draftRows.forEach((d, i) => {
    if (out[i]?.done) return;
    const base = out[i] ?? { ...(out[out.length - 1] ?? {}), prev: null, done: false, rpe: '' };
    out[i] = { ...base, weight: d.weight, reps: d.reps, done: false };
  });
  return out;
}

// ── Warm-up sets ─────────────────────────────────────────────────────────────
// Warm-ups are kept apart from working sets: they are never written to workout_logs, so they do
// not count towards volume, PRs or progression. They live on the device for today only.
export const WARM_KEY = 'arete_session_warmups';

/** Today's warm-up rows per exercise: { exId: [{ weight, reps, done }] }. */
export function loadWarmups(date, storage = ls()) {
  try {
    const v = JSON.parse(storage?.getItem(WARM_KEY) || 'null');
    return v && v.date === date && v.rows && typeof v.rows === 'object' ? v.rows : {};
  } catch { return {}; }
}

export function saveWarmups(date, rows, storage = ls()) {
  const clean = {};
  for (const [id, rs] of Object.entries(rows || {})) {
    if (!Array.isArray(rs) || !rs.length) continue;
    clean[id] = rs.map(r => ({ weight: r.weight ?? '', reps: r.reps ?? '', done: !!r.done }));
  }
  try { storage?.setItem(WARM_KEY, JSON.stringify({ date, rows: clean })); } catch { /* blocked */ }
}

export function clearWarmups(storage = ls()) { try { storage?.removeItem(WARM_KEY); } catch { /* blocked */ } }

/**
 * After a working set is logged, the sets still to do take its weight and reps, unless you already
 * typed something into them. `touched` marks a row you edited. Returns new rows.
 */
export function carryForward(rows, i) {
  const src = rows[i];
  if (!src) return rows;
  return rows.map((r, j) => (j > i && !r.done && !r.touched ? { ...r, weight: src.weight, reps: src.reps } : r));
}
