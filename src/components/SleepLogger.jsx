// Log last night's sleep by hand: bed and wake times (or just "about N hours").
// Writes the same `sleep_data` row the assistant and imports write (rows are
// dated by the morning you woke; see domain/dayLogs.js sleepRow). Logging the
// same date again updates that row instead of adding a second one.
import { useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { sleepWindow } from '../utils/waterGoal.js';
import { sleepRow } from '../domain/dayLogs.js';
import { sleepHoursBetween } from '../domain/recovery.js';

const label = { fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)' };
const field = { height: 44, boxSizing: 'border-box', padding: '0 10px', borderRadius: 10, fontFamily: 'inherit', fontSize: 15, background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', color: 'var(--text-primary)' };
const chip = (on) => ({
  minHeight: 40, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5,
  border: `0.5px solid ${on ? 'var(--tab-accent)' : 'var(--card-border)'}`,
  background: on ? 'color-mix(in srgb, var(--tab-accent) 14%, transparent)' : 'transparent',
  color: on ? 'var(--tab-accent)' : 'var(--text-secondary)', fontWeight: on ? 600 : 500, WebkitTapHighlightColor: 'transparent',
});

const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return toLocalDateKey(d); };

export default function SleepLogger() {
  const { items: rows = [], add, update } = useCollection('sleep_data', STORAGE_KEYS.SLEEP);
  const win = sleepWindow();
  const [bed, setBed] = useState(win.bed);
  const [wake, setWake] = useState(win.wake);
  const [about, setAbout] = useState(null); // hours picked from the chips; overrides the times
  const [date, setDate] = useState(() => toLocalDateKey(new Date()));
  const [busy, setBusy] = useState(false);

  const hours = about ?? sleepHoursBetween(bed, wake);
  const existing = rows.find(r => r.date === date && !String(r.id).startsWith('local_'));

  async function save() {
    if (busy || !hours) return;
    setBusy(true);
    try {
      const built = sleepRow({ date, hours, existing });
      if (!built) return;
      const times = about == null ? { bedTime: bed, bedtime: bed, wakeTime: wake } : {};
      const { id: _drop, ...fields } = { ...built, ...times, source: existing?.source ?? 'manual' };
      const ok = existing ? await update(existing.id, fields) : await add(fields);
      if (ok) window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: `Logged ${hours} h of sleep`, type: 'success' } }));
    } finally { setBusy(false); }
  }

  return (
    <section aria-label="Log sleep" style={{ padding: 16, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={label}>Log sleep</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" aria-pressed={date === toLocalDateKey(new Date())} onClick={() => setDate(toLocalDateKey(new Date()))} style={chip(date === toLocalDateKey(new Date()))}>Last night</button>
        <button type="button" aria-pressed={date === yesterdayKey()} onClick={() => setDate(yesterdayKey())} style={chip(date === yesterdayKey())}>The night before</button>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Bed</span>
          <input type="time" value={bed} onChange={e => { setBed(e.target.value); setAbout(null); }} style={field} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Woke</span>
          <input type="time" value={wake} onChange={e => { setWake(e.target.value); setAbout(null); }} style={field} />
        </label>
        <div className="val-num" style={{ fontSize: 22, fontWeight: 500, color: hours ? 'var(--text-primary)' : 'var(--text-secondary)', paddingBottom: 8 }}>
          {hours ? `${hours} h` : '—'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>or about</span>
        {[5, 6, 7, 8, 9].map(h => <button key={h} type="button" aria-pressed={about === h} onClick={() => setAbout(about === h ? null : h)} style={chip(about === h)}>{h} h</button>)}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={save} disabled={!hours || busy} style={{
          minHeight: 44, padding: '0 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
          background: 'var(--tab-accent)', color: 'var(--on-tab-accent)', opacity: hours && !busy ? 1 : 0.45,
        }}>{existing ? 'Update' : 'Save'}</button>
        {existing && <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Already logged {Math.round((existing.duration || 0) / 6) / 10} h for this night. Saving replaces it.</span>}
      </div>
    </section>
  );
}
