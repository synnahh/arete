// avatar.js — turn a picked photo into a small square profile picture (a JPEG data URL of about
// 15-30 KB) that can live in settings and follow you between devices. Centre-cropped, EXIF-rotated.
export const AVATAR_PX = 256;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Largest centred square inside w x h: { sx, sy, side }. Pure, for tests. */
export function squareCrop(w, h) {
  const side = Math.min(w, h);
  return { sx: Math.round((w - side) / 2), sy: Math.round((h - side) / 2), side };
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall back */ }
  }
  const url = URL.createObjectURL(file);
  try { const img = new Image(); img.src = url; await img.decode(); return img; } finally { URL.revokeObjectURL(url); }
}

export async function avatarFromFile(file, px = AVATAR_PX) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('Pick a photo (JPEG, PNG or HEIC from your camera roll).');
  if (file.size > MAX_FILE_BYTES) throw new Error('That photo is too large. Pick one under 25 MB.');
  const src = await decode(file);
  const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
  if (!w || !h) throw new Error('That file isn’t a readable image.');
  const { sx, sy, side } = squareCrop(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, px, px);
  ctx.drawImage(src, sx, sy, side, side, 0, 0, px, px);
  return canvas.toDataURL('image/jpeg', 0.85);
}
