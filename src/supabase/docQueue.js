// docQueue.js — keeps edits to documents (settings, exercise library, steps, skin routine ...) that
// could not reach the server yet, and sends them when the connection is back.
//
// Without this an offline edit was saved on the device but never uploaded, and the next launch could
// fetch the OLDER server copy over your newer local one. Now the newest value for each document is
// remembered here (saved in localStorage), the launch fetch must not overwrite a document that has
// one waiting, and a resend replaces the server copy with yours. The last write wins, per document.
import { supabase, getUserId } from './supabase.js';
import { isRetryable } from './writeQueue.js';

export const DOC_QUEUE_KEY = 'arete_doc_queue';

const read = (storage) => { try { const v = JSON.parse(storage.getItem(DOC_QUEUE_KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } };
const write = (storage, q) => { try { storage.setItem(DOC_QUEUE_KEY, JSON.stringify(q)); } catch { /* storage full or blocked */ } };
const ls = () => (typeof localStorage !== 'undefined' ? localStorage : null);

/** Remember the newest value for a document that still has to be uploaded. */
export function queueDoc(docId, value, storage = ls()) {
  if (!storage) return;
  write(storage, { ...read(storage), [docId]: value });
  try { window.dispatchEvent(new CustomEvent('arete:queue', { detail: { pending: pendingDocCount(storage) } })); } catch { /* no window */ }
}

export const pendingDoc = (docId, storage = ls()) => (storage && docId in read(storage) ? read(storage)[docId] : undefined);
export const hasPendingDoc = (docId, storage = ls()) => !!storage && docId in read(storage);
export const pendingDocCount = (storage = ls()) => (storage ? Object.keys(read(storage)).length : 0);

let flushing = false;

/**
 * Upload every waiting document. A network failure leaves them for next time; a document the server
 * refuses for good is dropped (and reported) so it cannot block the rest.
 * Returns { sent, left }.
 */
export async function flushDocs({ client = supabase, userIdOf = getUserId, storage = ls(), report = () => {} } = {}) {
  if (flushing || !storage) return { sent: 0, left: pendingDocCount(storage) };
  const waiting = read(storage);
  const ids = Object.keys(waiting);
  if (!ids.length) return { sent: 0, left: 0 };
  const userId = await userIdOf();
  if (!userId) return { sent: 0, left: ids.length };
  flushing = true;
  let sent = 0;
  try {
    for (const docId of ids) {
      let res;
      try { res = await client.from('user_meta').upsert({ user_id: userId, key: docId, value: waiting[docId] }, { onConflict: 'user_id,key' }); }
      catch (e) { res = { error: { message: String(e?.message || e) }, status: 0 }; }
      if (!res?.error) { sent += 1; const q = read(storage); if (JSON.stringify(q[docId]) === JSON.stringify(waiting[docId])) delete q[docId]; write(storage, q); continue; }
      if (isRetryable(res)) break;
      const q = read(storage); delete q[docId]; write(storage, q);
      report(docId, res.error.message);
    }
  } finally {
    flushing = false;
    try { window.dispatchEvent(new CustomEvent('arete:queue', { detail: { pending: pendingDocCount(storage) } })); } catch { /* no window */ }
  }
  return { sent, left: pendingDocCount(storage) };
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushDocs(); });
  document.addEventListener?.('visibilitychange', () => { if (document.visibilityState === 'visible') flushDocs(); });
}
