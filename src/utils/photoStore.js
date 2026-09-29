// Progress photo storage: shrink on the device, upload to the private
// `progress-photos` bucket, hand back short-lived signed URLs to display.
// Schema and policies: supabase/progress_photos.sql. Pure helpers: domain/photos.js.
import { supabase, getUserId } from '../supabase/supabase.js';
import { fitWithin, photoPath } from '../domain/photos.js';

const BUCKET = 'progress-photos';
const FULL = { max: 1600, quality: 0.82 };
const THUMB = { max: 420, quality: 0.75 };
const URL_TTL_S = 3600;
const URL_CACHE_MS = 50 * 60 * 1000; // refresh well before the signed URL lapses

export const SETUP_HINT = 'Photo storage isn’t set up yet. Run supabase/progress_photos.sql in the Supabase SQL editor.';

async function decode(file) {
  // imageOrientation applies the EXIF rotation, so phone photos aren't sideways.
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}

function toBlob(canvas, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode the photo'))), 'image/jpeg', quality));
}

/** Resize to fit `max` and re-encode as JPEG. Returns { blob, w, h }. */
async function shrink(source, { max, quality }) {
  const sw = source.width || source.naturalWidth, sh = source.height || source.naturalHeight;
  const { w, h } = fitWithin(sw, sh, max);
  if (!w || !h) throw new Error('That file isn’t a readable image');
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(source, 0, 0, w, h);
  return { blob: await toBlob(canvas, quality), w, h };
}

async function put(path, blob) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) {
    const msg = String(error.message || error);
    throw new Error(/bucket not found/i.test(msg) ? SETUP_HINT : msg);
  }
}

/**
 * Compress and upload one image (a File/Blob or a data: URL from the old
 * device-only store). Resolves to the metadata to save; if the row can't be
 * saved the caller should call removePhotoFiles() so no orphan is left.
 */
export async function uploadPhoto(input, { date, pose }) {
  const userId = await getUserId();
  if (!userId) throw new Error('Sign in on this device to save progress photos');
  const file = typeof input === 'string' ? await (await fetch(input)).blob() : input;
  const source = await decode(file);
  const full = await shrink(source, FULL);
  const thumb = await shrink(source, THUMB);
  source.close?.();

  const nonce = Math.random().toString(36).slice(2, 10);
  const path = photoPath(userId, { date, pose, nonce });
  const thumbPath = photoPath(userId, { date, pose, nonce, thumb: true });
  await put(path, full.blob);
  try { await put(thumbPath, thumb.blob); }
  catch (e) { await removePhotoFiles([path]); throw e; }
  return { path, thumbPath, w: full.w, h: full.h, bytes: full.blob.size };
}

/** Best-effort delete of storage objects. Returns true when the call succeeded. */
export async function removePhotoFiles(paths) {
  const list = paths.filter(Boolean);
  if (!list.length) return true;
  const { error } = await supabase.storage.from(BUCKET).remove(list);
  if (error) console.warn('[photos] could not delete files:', error.message);
  return !error;
}

const cache = new Map(); // path -> { url, at }

/** Signed URLs for many paths in one request, cached. Missing files map to nothing. */
export async function signedUrls(paths) {
  const now = Date.now();
  const need = [...new Set(paths.filter(Boolean))].filter(p => !(cache.get(p) && now - cache.get(p).at < URL_CACHE_MS));
  if (need.length) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(need, URL_TTL_S);
    if (error) console.warn('[photos] could not sign urls:', error.message);
    for (const row of data || []) if (row.signedUrl && row.path) cache.set(row.path, { url: row.signedUrl, at: now });
  }
  const out = {};
  for (const p of paths) if (cache.get(p)) out[p] = cache.get(p).url;
  return out;
}
