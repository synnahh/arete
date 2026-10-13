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
