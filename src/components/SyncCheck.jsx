// SyncCheck — proves that this device and your other devices see the same data, live.
//  1. Send a test ping here; open Profile on the other device: it shows the ping arrive without
//     a refresh, with how long it took.
//  2. Compare: how many rows the cloud holds against this device, per kind of data.
// Rules: domain/syncCheck.js. Documents and collections follow changes live (supabase realtime).
import { useEffect, useRef, useState } from 'react';
import { supabase, getUserId } from '../supabase/supabase.js';
import { useDocument } from '../supabase/useDocument.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { isTauri, isMobile } from '../utils/platform.js';
import { label } from './ui.js';
import { CHECKED, compareCount, readPing } from '../domain/syncCheck.js';

const KEY_OF = {
  workout_logs: STORAGE_KEYS.WORKOUT_LOGS, nutrition_logs: STORAGE_KEYS.MACROS, body_metrics: STORAGE_KEYS.BODY, water_logs: STORAGE_KEYS.WATER,
  sleep_data: STORAGE_KEYS.SLEEP, habits: STORAGE_KEYS.HABITS, saved_meals: STORAGE_KEYS.SAVED_MEALS, programs: STORAGE_KEYS.PROGRAMS, notes: STORAGE_KEYS.NOTES,
  tasks: STORAGE_KEYS.TASKS, supplements: STORAGE_KEYS.SUPPLEMENTS,
};

const card = { padding: 16, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 };
const btn = { minHeight: 44, padding: '0 16px', borderRadius: 12, border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
const small = { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 };
const COLOUR = { same: '#4caf7d', 'cloud-ahead': '#e8a13a', 'device-ahead': '#e8a13a', unknown: 'var(--text-secondary)' };
const TEXT = { same: 'same', 'cloud-ahead': 'cloud has more', 'device-ahead': 'this device has more', unknown: 'unknown' };

function readDeviceId() {
  try {
    let id = localStorage.getItem('arete_device_id');
    if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem('arete_device_id', id); }
    return id;
  } catch { return 'unknown'; }
}
const deviceName = () => (isTauri() ? 'Desktop app' : isMobile() ? 'Phone' : 'Browser');

export default function SyncCheck() {
  const ping = useDocument('sync_ping', 'valerie_sync_ping', null);
  const me = useRef(readDeviceId());
  const [now, setNow] = useState(Date.now());
  const [arrival, setArrival] = useState(null);       // { from, ms } when another device's ping lands here
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState(null);
  const lastSeen = useRef(null);

  useEffect(() => { getUserId().then(id => setAccount(id ? String(id).slice(-6) : null)); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const p = readPing(ping.data, me.current, now);
  useEffect(() => {
    const raw = ping.data;
    if (!raw?.at || raw.deviceId === me.current || lastSeen.current === raw.at) return;
    lastSeen.current = raw.at;
    const ms = Date.now() - Date.parse(raw.at);
    if (Number.isFinite(ms)) setArrival({ from: raw.device, ms: Math.max(0, ms) });
  }, [ping.data]);

  const send = async () => {
    const count = (Number(ping.data?.count) || 0) + 1;
    await ping.save({ device: deviceName(), deviceId: me.current, at: new Date().toISOString(), count });
  };

  const compare = async () => {
    setBusy(true);
    try {
      const uid = await getUserId();
      const out = [];
      for (const { table, label: name } of CHECKED) {
        let cloud = null;
        if (uid) {
          const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', uid);
          if (!error && Number.isFinite(count)) cloud = count;
        }
        const mirror = storage.get(KEY_OF[table], []);
        out.push(compareCount(name, cloud, Array.isArray(mirror) ? mirror.length : 0));
      }
      setRows(out);
    } finally { setBusy(false); }
  };

  return (
    <section aria-label="Sync check" style={card}>
      <div style={label}>Sync check</div>
      <div style={small}>This device: {deviceName()}{account ? ` · account …${account}` : ' · not signed in'}. Every device must use the same sign-in.</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={send} style={btn}>Send test ping</button>
        <button type="button" onClick={compare} disabled={busy} style={btn}>{busy ? 'Comparing…' : 'Compare with the cloud'}</button>
      </div>

      {p && (
        <div role="status" style={{ ...small, color: 'var(--text-primary)' }}>
          {p.own ? `You sent ping #${p.count} from this device ${p.ageSeconds} s ago.` : `Ping #${p.count} from ${p.from}, ${p.ageSeconds} s ago.`}
        </div>
      )}
      {arrival && (
        <div role="status" style={{ fontSize: 14, color: '#4caf7d', fontWeight: 600 }}>
          Arrived from {arrival.from} without a refresh, {arrival.ms < 1000 ? `${arrival.ms} ms` : `${(arrival.ms / 1000).toFixed(1)} s`} after it was sent.
        </div>
      )}
      {!p && <div style={small}>Press Send on one device, then watch this screen on the other. It should appear by itself within a second or two.</div>}

      {rows && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map(r => (
            <li key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
              <span style={{ color: 'var(--text-primary)' }}>{r.label}</span>
              <span className="val-num" style={{ color: COLOUR[r.status] }}>{r.cloud ?? '?'} cloud · {r.local} here · {TEXT[r.status]}</span>
            </li>
          ))}
        </ul>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Timing uses both devices' clocks, so a few hundred milliseconds either way is normal.</div>
    </section>
  );
}
