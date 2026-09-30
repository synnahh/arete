// Progress photos: capture by pose, a before/after slider, and a dated grid.
// Used by desktop Coach > Body > Photos and the phone Body tab.
// Files live in a private Storage bucket (src/utils/photoStore.js); rows are
// metadata only (src/domain/photos.js). Photos saved by the old version of this
// screen sit in localStorage and are moved to the cloud only when asked, one at
// a time, and removed locally only after the upload and the row both succeeded.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { uploadPhoto, removePhotoFiles, signedUrls } from '../utils/photoStore.js';
import { POSES, BODY_POSES, byPose, defaultPair, comparison, formatDay, normalisePose } from '../domain/photos.js';
import { label } from './ui.js';

const LEGACY_KEY = 'valerie_photos';

const card = { padding: 14, borderRadius: 14, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 };
const pill = (on) => ({
  minHeight: 36, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
  border: `0.5px solid ${on ? 'var(--tab-accent)' : 'var(--card-border)'}`,
  background: on ? 'color-mix(in srgb, var(--tab-accent) 14%, transparent)' : 'transparent',
  color: on ? 'var(--tab-accent)' : 'var(--text-secondary)', fontWeight: on ? 600 : 500,
});
const primaryBtn = { minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, background: 'var(--tab-accent)', color: 'var(--on-tab-accent)', WebkitTapHighlightColor: 'transparent' };
const ghostBtn = { minHeight: 36, padding: '0 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, background: 'transparent', border: '0.5px solid var(--card-border)', color: 'var(--text-secondary)' };
const select = { flex: 1, minWidth: 0, height: 36, padding: '0 8px', borderRadius: 10, background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 12.5 };

const toast = (message, type = 'error') => {
  try { window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type } })); } catch { /* no toaster mounted */ }
};

function readLegacy() {
  try { const v = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]'); return Array.isArray(v) ? v.filter(p => p && p.src) : []; }
  catch { return []; }
}
function writeLegacy(list) {
  try { localStorage.setItem(LEGACY_KEY, JSON.stringify(list)); } catch { /* quota: the entry simply stays */ }
}

/** Signed URLs for a set of paths, refreshed when the set changes. */
function useUrls(paths) {
  const [urls, setUrls] = useState({});
  const key = paths.join('|');
  useEffect(() => {
    let live = true;
    if (!paths.length) { setUrls({}); return undefined; }
    signedUrls(paths).then(u => { if (live) setUrls(u); }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

function Compare({ before, after, urls, summary }) {
  const [pos, setPos] = useState(50);
  const src = (p) => urls[p.path];
  const ready = src(before) && src(after);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 420, margin: '0 auto', aspectRatio: '3 / 4', borderRadius: 12, overflow: 'hidden', background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)' }}>
        {ready ? (
          <>
            <img src={src(after)} alt={`After, ${formatDay(after.date)}`} draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <img src={src(before)} alt={`Before, ${formatDay(before.date)}`} draggable={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
            <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos}%`, width: 2, marginLeft: -1, background: 'var(--tab-accent)' }} />
            <span style={{ position: 'absolute', top: 8, left: 8, ...label, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '3px 7px', borderRadius: 6 }}>Before · {formatDay(before.date)}</span>
            <span style={{ position: 'absolute', top: 8, right: 8, ...label, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '3px 7px', borderRadius: 6 }}>After · {formatDay(after.date)}</span>
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Loading photos…</div>
        )}
      </div>
      <input type="range" min="0" max="100" value={pos} onChange={e => setPos(+e.target.value)} aria-label="Compare before and after"
        style={{ width: '100%', maxWidth: 420, margin: '0 auto', accentColor: 'var(--tab-accent)' }} />
      {summary && (
        <div className="val-num" style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          {summary.days} day{summary.days === 1 ? '' : 's'}
          {summary.weightDeltaKg != null && <> · <span style={{ color: 'var(--text-primary)' }}>{summary.weightDeltaKg > 0 ? '+' : ''}{summary.weightDeltaKg} kg</span></>}
        </div>
      )}
    </div>
  );
}

// `poses`: which poses this screen offers (body poses by default, ['face'] in Look).
// `legacy`: offer to move the old device-only body photos (not for Face).
export default function ProgressPhotos({ bodyMetrics = [], poses = BODY_POSES, legacy: allowLegacy = true }) {
  const photos = useCollection('progress_photos', 'progress_photos');
  const poseList = POSES.filter(p => poses.includes(p.id));
  const [pose, setPose] = useState(poseList[0]?.id ?? 'front');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const [beforeId, setBeforeId] = useState('');
  const [afterId, setAfterId] = useState('');
  const [legacy, setLegacy] = useState(readLegacy);
  const [moving, setMoving] = useState(false);
  const fileRef = useRef(null);

  const list = useMemo(() => byPose(photos.items, pose), [photos.items, pose]);
  const dflt = useMemo(() => defaultPair(list), [list]);
  const before = list.find(p => p.id === beforeId) || dflt?.before || null;
  const after  = list.find(p => p.id === afterId)  || dflt?.after  || null;
  const summary = useMemo(() => (before && after && before.id !== after.id ? comparison(before, after, bodyMetrics) : null), [before, after, bodyMetrics]);

  const urls = useUrls(useMemo(() => [
    ...list.map(p => p.thumbPath || p.path),
    ...(before && after ? [before.path, after.path] : []),
    ...(open ? [open.path] : []),
  ], [list, before, after, open]));

  // Switching pose resets any manual before/after pick.
  useEffect(() => { setBeforeId(''); setAfterId(''); }, [pose]);

  async function addFile(file, { date = toLocalDateKey(new Date()), forPose = pose } = {}) {
    let stored;
    try {
      stored = await uploadPhoto(file, { date, pose: forPose });
      const id = await photos.add({ date, pose: forPose, ...stored, note: '' });
      if (!id) { await removePhotoFiles([stored.path, stored.thumbPath]); return false; }
      return true;
    } catch (e) {
      if (stored) await removePhotoFiles([stored.path, stored.thumbPath]);
      toast(`⚠️ ${e.message || 'Could not save the photo'}`);
      return false;
    }
  }

  async function onPick(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    let ok = 0;
    for (const f of files) if (await addFile(f)) ok += 1;
    setBusy(false);
    if (ok) toast(`${ok} photo${ok === 1 ? '' : 's'} saved`, 'success');
  }

  async function moveLegacy() {
    setMoving(true);
    let remaining = readLegacy(), moved = 0;
    for (const p of readLegacy()) {
      if (await addFile(p.src, { date: p.date || toLocalDateKey(new Date()), forPose: normalisePose('front') })) {
        remaining = remaining.filter(x => x.id !== p.id);
        writeLegacy(remaining);
        moved += 1;
      } else break; // stop at the first failure; nothing unmoved is ever deleted
    }
    setLegacy(remaining);
    setMoving(false);
    if (moved) toast(`${moved} old photo${moved === 1 ? '' : 's'} moved to the cloud`, 'success');
  }

  async function remove(p) {
    if (!window.confirm(`Delete the ${formatDay(p.date)} photo? This can't be undone.`)) return;
    if (await photos.remove(p.id)) {
      await removePhotoFiles([p.path, p.thumbPath]);
      setOpen(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onPick} />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {poseList.length > 1 && poseList.map(p => (
          <button key={p.id} type="button" aria-pressed={pose === p.id} onClick={() => setPose(p.id)} style={pill(pose === p.id)}>{p.label}</button>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} style={{ ...primaryBtn, marginLeft: 'auto', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Saving…' : `+ ${poseList.find(p => p.id === pose)?.label ?? 'New'} photo`}
        </button>
      </div>

      {list.length === 0 && (
        <div style={{ ...card, alignItems: 'center', textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>No {pose} photos yet.</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 300, lineHeight: 1.5 }}>
            Same spot, same light, same time of day. Take one every week or two and compare.
          </div>
        </div>
      )}

      {list.length === 1 && (
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>One photo so far. Add another later to unlock the before/after slider.</div>
      )}

      {before && after && before.id !== after.id && (
        <div style={card}>
          <div style={label}>Before / after</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select aria-label="Before photo" value={before.id} onChange={e => setBeforeId(e.target.value)} style={select}>
              {list.map(p => <option key={p.id} value={p.id}>{formatDay(p.date)}</option>)}
            </select>
            <select aria-label="After photo" value={after.id} onChange={e => setAfterId(e.target.value)} style={select}>
              {list.map(p => <option key={p.id} value={p.id}>{formatDay(p.date)}</option>)}
            </select>
          </div>
          <Compare before={before} after={after} urls={urls} summary={summary} />
        </div>
      )}

      {list.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8 }}>
          {[...list].reverse().map(p => {
            const u = urls[p.thumbPath || p.path];
            return (
              <button key={p.id} type="button" onClick={() => setOpen(p)} aria-label={`${pose} photo, ${formatDay(p.date)}`}
                style={{ position: 'relative', padding: 0, aspectRatio: '3 / 4', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)' }}>
                {u && <img src={u} alt="" loading="lazy" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                <span className="val-num" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '4px 6px', fontSize: 10.5, color: '#fff', background: 'rgba(0,0,0,0.6)', textAlign: 'left' }}>{formatDay(p.date)}</span>
              </button>
            );
          })}
        </div>
      )}

      {allowLegacy && legacy.length > 0 && (
        <div style={card}>
          <div style={label}>On this device only</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {legacy.length} photo{legacy.length === 1 ? ' is' : 's are'} saved only in this browser, so other devices can't see {legacy.length === 1 ? 'it' : 'them'}. Moving uploads each one, and removes the local copy only after it's safely saved.
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {legacy.slice(0, 8).map(p => <img key={p.id} src={p.src} alt={p.date || ''} style={{ width: 52, height: 68, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />)}
          </div>
          <button type="button" onClick={moveLegacy} disabled={moving} style={{ ...ghostBtn, alignSelf: 'flex-start', opacity: moving ? 0.6 : 1 }}>{moving ? 'Moving…' : 'Move to cloud'}</button>
        </div>
      )}

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Photo" onClick={() => setOpen(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 }}>
          {urls[open.path]
            ? <img src={urls[open.path]} alt={`${open.pose} photo, ${formatDay(open.date)}`} style={{ maxWidth: '100%', maxHeight: '78vh', borderRadius: 12, objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
            : <div style={{ color: '#fff', fontSize: 13 }}>Loading…</div>}
          <div className="val-num" style={{ color: '#fff', fontSize: 13 }} onClick={e => e.stopPropagation()}>
            {formatDay(open.date)}{nearestLabel(open, bodyMetrics)}
          </div>
          <div style={{ display: 'flex', gap: 10 }} onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => { setBeforeId(open.id); setOpen(null); }} style={ghostBtn}>Use as before</button>
            <button type="button" onClick={() => { setAfterId(open.id); setOpen(null); }} style={ghostBtn}>Use as after</button>
            <button type="button" onClick={() => remove(open)} style={{ ...ghostBtn, color: '#e55a5a', borderColor: '#e55a5a' }}>Delete</button>
            <button type="button" onClick={() => setOpen(null)} style={ghostBtn}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function nearestLabel(photo, bodyMetrics) {
  const c = comparison(photo, photo, bodyMetrics);
  return c?.weightBefore != null ? ` · ${c.weightBefore} kg` : '';
}
