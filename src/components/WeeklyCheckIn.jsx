// WeeklyCheckIn — progress at a glance and the weekly check-in in one place: kg lost
// and gained since you started, then this week's weight, date and front, side and
// back photos saved together. The weight goes into the same weigh-in log the rest of
// the app reads (marked as a check-in); photos go to your private photo storage.
// Rules: src/domain/checkin.js.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { uploadPhoto, removePhotoFiles } from '../utils/photoStore.js';
import { POSES, BODY_POSES } from '../domain/photos.js';
import { averageOfTwo } from '../domain/waist.js';
import { progressTiles, checkInStatus, previousCheckIn, checkInRow } from '../domain/checkin.js';
import { label } from './ui.js';

const card = { padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 14 };
const field = { width: '100%', boxSizing: 'border-box', minHeight: 46, borderRadius: 12, padding: '0 14px', border: '0.5px solid var(--card-border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 16 };
const toast = (message, type = 'success') => window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type } }));

function Tile({ name, value, unit = 'kg', tone }) {
  return (
    <div style={{ padding: '14px 12px', borderRadius: 14, background: 'var(--hover-bg)', textAlign: 'center' }}>
      <div style={{ ...label, fontSize: 10 }}>{name}</div>
      <div className="val-num" style={{ fontSize: 28, fontWeight: 800, color: tone || 'var(--text-primary)', marginTop: 4 }}>{value}<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}> {unit}</span></div>
    </div>
  );
}

export default function WeeklyCheckIn({ goal }) {
  const today = toLocalDateKey(new Date());
  const body = useCollection('body_metrics', STORAGE_KEYS.BODY);
  const photos = useCollection('progress_photos', 'progress_photos');
  const items = body.items || [];
  const tiles = useMemo(() => progressTiles(items, goal, today), [items, goal, today]);
  const status = useMemo(() => checkInStatus(items, today), [items, today]);

  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState('');
  const [waist1, setWaist1] = useState('');
  const [waist2, setWaist2] = useState('');
  const [files, setFiles] = useState({});          // pose -> File
  const [previews, setPreviews] = useState({});    // pose -> object url
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const refs = useRef({});

  useEffect(() => { if (!weight && tiles?.currentKg) setWeight(String(tiles.currentKg)); }, [tiles?.currentKg]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => Object.values(previews).forEach(u => URL.revokeObjectURL(u)), []);   // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (pose, file) => {
    if (!file) return;
    if (previews[pose]) URL.revokeObjectURL(previews[pose]);
    setFiles(f => ({ ...f, [pose]: file }));
    setPreviews(p => ({ ...p, [pose]: URL.createObjectURL(file) }));
  };

  async function save() {
    const row = checkInRow({ date, weight, waist: averageOfTwo(waist1, waist2) ?? (waist1 || waist2 || null) });
    if (!row || busy) { if (!row) toast('Enter your weight in kg and a valid date.', 'error'); return; }
    setBusy(true); setDone('');
    const before = previousCheckIn(items, date);
    let saved = 0, failed = 0;
    try {
      await body.add(row);
      for (const pose of BODY_POSES) {
        const file = files[pose];
        if (!file) continue;
        let stored;
        try {
          stored = await uploadPhoto(file, { date, pose });
          const id = await photos.add({ date, pose, ...stored, note: '' });
          if (!id) { await removePhotoFiles([stored.path, stored.thumbPath]); failed += 1; } else saved += 1;
        } catch (e) {
          if (stored) await removePhotoFiles([stored.path, stored.thumbPath]);
          failed += 1;
          toast(`⚠️ ${e.message || 'A photo did not save'}`, 'error');
        }
      }
      const delta = before ? Math.round((row.weight - Number(before.weight)) * 10) / 10 : null;
      setDone(`Check-in saved: ${row.weight} kg${delta != null ? ` (${delta > 0 ? '+' : ''}${delta} kg since ${before.date})` : ''}${row.waist ? `, waist ${row.waist} cm` : ''}${saved ? `, ${saved} photo${saved === 1 ? '' : 's'}` : ''}${failed ? `, ${failed} photo${failed === 1 ? '' : 's'} not saved` : ''}.`);
      setWaist1(''); setWaist2(''); setFiles({}); Object.values(previews).forEach(u => URL.revokeObjectURL(u)); setPreviews({});
    } finally { setBusy(false); }
  }

  return (
    <section aria-label="Progress and weekly check-in" style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={label}>Progress{tiles?.week ? ` · week ${tiles.week}` : ''}</div>
        {tiles && <span className="val-num" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{tiles.startKg} kg to {tiles.currentKg} kg{tiles.toGoalKg != null ? ` · ${Math.abs(tiles.toGoalKg)} kg ${tiles.toGoalKg < 0 ? 'to lose' : 'to gain'}` : ''}</span>}
      </div>

      {tiles ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Tile name="Kg lost" value={tiles.lostKg.toFixed(1)} tone={tiles.lostKg > 0 ? '#4caf7d' : undefined} />
          <Tile name="Kg gained" value={tiles.gainedKg.toFixed(1)} tone={tiles.gainedKg > 0 ? '#e8a13a' : undefined} />
        </div>
      ) : <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Weigh in and the tiles fill in from your starting weight.</div>}

      <div style={{ height: 1, background: 'var(--card-border)' }} />

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={label}>Weekly check-in</div>
        <span style={{ fontSize: 12.5, color: status.due ? 'var(--accent)' : 'var(--text-secondary)' }}>
          {status.last == null ? 'No check-in yet' : status.due ? `Due: last was ${status.daysSince} days ago` : `Done ${status.daysSince === 0 ? 'today' : `${status.daysSince} day${status.daysSince === 1 ? '' : 's'} ago`}`}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={label}>Weight (kg)</span><input type="number" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} style={field} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={label}>Waist 1 (cm, optional)</span><input type="number" inputMode="decimal" value={waist1} onChange={e => setWaist1(e.target.value)} style={field} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={label}>Waist 2 (cm)</span><input type="number" inputMode="decimal" value={waist2} onChange={e => setWaist2(e.target.value)} style={field} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={label}>Date</span><input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} style={field} /></label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {BODY_POSES.map(id => {
          const name = POSES.find(p => p.id === id)?.label ?? id;
          return (
            <div key={id}>
              <input ref={el => { refs.current[id] = el; }} type="file" accept="image/*" capture="environment" aria-label={`${name} photo`} style={{ display: 'none' }}
                onChange={e => { pick(id, e.target.files?.[0]); e.target.value = ''; }} />
              <button type="button" onClick={() => refs.current[id]?.click()} aria-label={`${previews[id] ? 'Change' : 'Add'} ${name.toLowerCase()} photo`}
                style={{ width: '100%', aspectRatio: '3 / 4', borderRadius: 14, border: `1.5px ${previews[id] ? 'solid var(--accent)' : 'dashed var(--card-border)'}`, background: previews[id] ? `center / cover no-repeat url(${previews[id]})` : 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: 12.5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {!previews[id] && (<>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg>
                  <span>Upload</span>
                </>)}
              </button>
              <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 6 }}>{name}</div>
            </div>
          );
        })}
      </div>

      {done && <div role="status" style={{ fontSize: 13.5, color: 'var(--accent)', lineHeight: 1.5 }}>{done}</div>}
      <button type="button" onClick={save} disabled={busy} style={{ minHeight: 48, borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--bg-base)', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Save check-in'}</button>
    </section>
  );
}
