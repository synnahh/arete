// ─── Calendar Tab ─────────────────────────────────────────────────────────────
// Agenda view · local events (Firebase) · Google Calendar OAuth integration

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useCollection } from '../firebase/useCollection.js';
import { STORAGE_KEYS, storage } from '../utils/storage.js';

const GCAL_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GCAL_SCOPE     = 'https://www.googleapis.com/auth/calendar';
const GCAL_API       = 'https://www.googleapis.com/calendar/v3';
const GCAL_TOKEN_KEY = 'valerie_gcal_token';

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const TrashIcon = () => <Icon d="M3 6h18 M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2 M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6 M10 11v6 M14 11v6" />;
const EditIcon  = () => <Icon d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" />;
const CloseIcon = () => <Icon d="M18 6L6 18 M6 6l12 12" />;
const MicIcon   = () => <Icon d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8" />;

// ── Colour swatches ───────────────────────────────────────────────────────────
const EVENT_COLOURS = ['#4a9eff', '#4caf7d', '#f4a642', '#e55a5a', '#9b5de5', '#00c9a7', '#f7b731'];

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayStr()    { return new Date().toISOString().slice(0, 10); }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }

function formatEventDate(dateStr) {
  const today    = todayStr();
  const tomorrow = tomorrowStr();
  if (dateStr === today)    return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function groupByDate(events) {
  const map = {};
  events.forEach(ev => {
    const d = ev.date || ev.start?.dateTime?.slice(0, 10) || ev.start?.date || '';
    if (!map[d]) map[d] = [];
    map[d].push(ev);
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => ({
      date,
      label: formatEventDate(date),
      events: events.sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    }));
}

function applyFilter(events, filter) {
  const today = todayStr();
  switch (filter) {
    case 'today':    return events.filter(e => (e.date || e.start?.date || e.start?.dateTime?.slice(0,10)) === today);
    case 'upcoming': return events.filter(e => (e.date || e.start?.date || e.start?.dateTime?.slice(0,10)) >= today);
    default:         return events;
  }
}

// ── Google Calendar token helpers ─────────────────────────────────────────────
function saveGcalToken(token) {
  localStorage.setItem(GCAL_TOKEN_KEY, JSON.stringify({
    access_token: token.access_token,
    expires_at:   Date.now() + (token.expires_in || 3600) * 1000,
  }));
}
function loadGcalToken() {
  try {
    const raw = localStorage.getItem(GCAL_TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw);
    if (Date.now() > t.expires_at - 60_000) return null; // expired
    return t.access_token;
  } catch { return null; }
}
function clearGcalToken() { localStorage.removeItem(GCAL_TOKEN_KEY); }

// ── Google Calendar API helpers ───────────────────────────────────────────────
async function gcalFetch(path, options = {}, token) {
  const res = await fetch(`${GCAL_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `GCal API ${res.status}`);
  }
  return res.json();
}

async function fetchGcalEvents(token) {
  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 1);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 60);

  const params = new URLSearchParams({
    timeMin:      timeMin.toISOString(),
    timeMax:      timeMax.toISOString(),
    maxResults:   '100',
    singleEvents: 'true',
    orderBy:      'startTime',
  });

  const data = await gcalFetch(`/calendars/primary/events?${params}`, {}, token);
  return (data.items || []).map(item => ({
    id:          item.id,
    googleId:    item.id,
    title:       item.summary || '(No title)',
    description: item.description || '',
    date:        item.start?.dateTime?.slice(0, 10) || item.start?.date || '',
    time:        item.start?.dateTime ? item.start.dateTime.slice(11, 16) : '',
    endTime:     item.end?.dateTime   ? item.end.dateTime.slice(11, 16)   : '',
    colour:      '#4a9eff',
    source:      'google',
  }));
}

async function createGcalEvent(token, event) {
  const start = event.time
    ? { dateTime: `${event.date}T${event.time}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    : { date: event.date };
  const end = event.endTime
    ? { dateTime: `${event.date}T${event.endTime}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    : start;

  return gcalFetch('/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify({ summary: event.title, description: event.description || '', start, end }),
  }, token);
}

async function deleteGcalEvent(token, googleId) {
  await fetch(`${GCAL_API}/calendars/primary/events/${googleId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
}

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({ event, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const colour = event.colour || '#4a9eff';
  const isGoogle = event.source === 'google';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '10px 16px', borderRadius: 10,
        background: colour + '0d',
        border: `0.5px solid ${colour}33`,
        transition: 'border-color 0.15s ease',
        borderColor: hovered ? colour + '66' : colour + '33',
        marginBottom: 8,
        position: 'relative',
      }}
    >
      {/* Colour dot */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%', background: colour,
        flexShrink: 0, marginTop: 4,
        boxShadow: `0 0 6px ${colour}80`,
      }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {event.title}
          </span>
          {isGoogle && (
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 10,
              background: 'rgba(66,133,244,0.12)', color: '#4285f4',
              border: '0.5px solid rgba(66,133,244,0.3)', flexShrink: 0,
            }}>
              Google
            </span>
          )}
        </div>
        {event.description && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            {event.description}
          </div>
        )}
      </div>

      {/* Time */}
      {event.time && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
          {event.time}{event.endTime ? ` – ${event.endTime}` : ''}
        </div>
      )}

      {/* Actions on hover */}
      {hovered && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {!isGoogle && (
            <button onClick={() => onEdit(event)} style={tinyBtnStyle} title="Edit">
              <EditIcon />
            </button>
          )}
          <button onClick={() => onDelete(event)} style={tinyBtnStyle} title="Delete">
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  );
}

const tinyBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-muted)', padding: 3, borderRadius: 4,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

// ── Event panel (add/edit) ────────────────────────────────────────────────────
function EventPanel({ event, onSave, onClose }) {
  const isEdit = !!event?.id;
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    date: event?.date || todayStr(),
    time: event?.time || '',
    endTime: event?.endTime || '',
    colour: event?.colour || '#4a9eff',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const inputStyle = {
    width: '100%', background: 'var(--input-bg)', border: '0.5px solid var(--input-border)',
    borderRadius: 7, padding: '7px 10px', fontSize: 12.5, color: 'var(--text-primary)', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.15s ease',
  };
  const focus = e => e.target.style.borderColor = 'var(--accent)';
  const blur  = e => e.target.style.borderColor = 'var(--input-border)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 16px', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em' }}>
          {isEdit ? 'EDIT EVENT' : 'NEW EVENT'}
        </span>
        <button onClick={onClose} style={{ ...tinyBtnStyle, fontSize: 16 }}>×</button>
      </div>

      <div>
        <label style={lblStyle}>Title *</label>
        <input autoFocus value={form.title} onChange={e => set('title', e.target.value)}
          placeholder="Event name" style={inputStyle} onFocus={focus} onBlur={blur} />
      </div>
      <div>
        <label style={lblStyle}>Description</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="Optional…" rows={2}
          style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} onFocus={focus} onBlur={blur} />
      </div>
      <div>
        <label style={lblStyle}>Date</label>
        <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
          style={{ ...inputStyle, colorScheme: 'dark' }} onFocus={focus} onBlur={blur} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={lblStyle}>Start time</label>
          <input type="time" value={form.time} onChange={e => set('time', e.target.value)}
            style={{ ...inputStyle, colorScheme: 'dark' }} onFocus={focus} onBlur={blur} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={lblStyle}>End time</label>
          <input type="time" value={form.endTime} onChange={e => set('endTime', e.target.value)}
            style={{ ...inputStyle, colorScheme: 'dark' }} onFocus={focus} onBlur={blur} />
        </div>
      </div>
      <div>
        <label style={lblStyle}>Colour</label>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {EVENT_COLOURS.map(c => (
            <button key={c} onClick={() => set('colour', c)} style={{
              width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
              border: `2.5px solid ${form.colour === c ? 'var(--text-primary)' : 'transparent'}`,
              transition: 'border-color 0.15s ease',
            }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
        <button onClick={onClose} style={{ flex: 1, ...ghostBtnStyle }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={!form.title.trim()}
          style={{ flex: 1, ...primaryBtnStyle, opacity: form.title.trim() ? 1 : 0.4 }}>
          {isEdit ? 'Save' : 'Add event'}
        </button>
      </div>
    </div>
  );
}

const lblStyle = { display: 'block', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 4 };
const ghostBtnStyle   = { padding: '7px 0', borderRadius: 7, border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 };
const primaryBtnStyle = { padding: '7px 0', borderRadius: 7, border: '0.5px solid var(--card-border)', background: 'var(--active-bg)', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 500 };

// ── Main Calendar component ────────────────────────────────────────────────────
export default function Calendar({ ai }) {
  const { items: localEvents, add, update, remove, synced } = useCollection('events', STORAGE_KEYS.EVENTS);
  const [filter,      setFilter]      = useState('upcoming');
  const [panel,       setPanel]       = useState(null); // null | { mode:'add' } | { mode:'edit', event }
  const [gcalToken,   setGcalToken]   = useState(() => loadGcalToken());
  const [gcalEvents,  setGcalEvents]  = useState([]);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalError,   setGcalError]   = useState(null);
  const [voiceActive, setVoice]       = useState(false);
  const tokenClientRef = useRef(null);

  // ── Google Calendar OAuth (GIS) ────────────────────────────────────────────
  useEffect(() => {
    if (!GCAL_CLIENT_ID || GCAL_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') return;
    if (!window.google?.accounts?.oauth2) return;
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GCAL_CLIENT_ID,
      scope:     GCAL_SCOPE,
      callback:  (resp) => {
        if (resp.error) { setGcalError(resp.error); return; }
        saveGcalToken(resp);
        setGcalToken(resp.access_token);
      },
    });
  }, []);

  const connectGcal = useCallback(() => {
    if (!tokenClientRef.current) {
      setGcalError('Google Client ID not configured. Add VITE_GOOGLE_CLIENT_ID to your .env file.');
      return;
    }
    tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
  }, []);

  const disconnectGcal = useCallback(() => {
    clearGcalToken();
    setGcalToken(null);
    setGcalEvents([]);
  }, []);

  // ── Fetch Google Calendar events when token exists ─────────────────────────
  useEffect(() => {
    if (!gcalToken) return;
    setGcalLoading(true);
    setGcalError(null);
    fetchGcalEvents(gcalToken)
      .then(events => { setGcalEvents(events); setGcalLoading(false); })
      .catch(err => {
        setGcalError(err.message);
        setGcalLoading(false);
        if (err.message.includes('401') || err.message.includes('403')) {
          clearGcalToken(); setGcalToken(null);
        }
      });
  }, [gcalToken]);

  // ── Merge local + Google events ────────────────────────────────────────────
  const allEvents = useMemo(() => {
    const gcalIds = new Set(gcalEvents.map(e => e.googleId));
    // Remove local events that have been synced to Google (have googleId)
    const local = localEvents.filter(e => !e.googleId || !gcalIds.has(e.googleId));
    return [...local, ...gcalEvents];
  }, [localEvents, gcalEvents]);

  const filtered = useMemo(() => applyFilter(allEvents, filter), [allEvents, filter]);
  const grouped  = useMemo(() => groupByDate(filtered), [filtered]);

  // ── Save event ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async (form) => {
    const isEdit = panel?.mode === 'edit';
    const payload = {
      title: form.title.trim(), description: form.description || '',
      date: form.date, time: form.time || '', endTime: form.endTime || '',
      colour: form.colour || '#4a9eff', source: 'local',
    };

    if (isEdit) {
      await update(panel.event.id, payload);
    } else {
      const id = await add(payload);
      // Also push to Google Calendar if connected
      if (gcalToken) {
        try {
          const gcalResp = await createGcalEvent(gcalToken, payload);
          await update(id, { googleId: gcalResp.id });
        } catch (err) {
          console.warn('[Calendar] GCal create failed:', err.message);
        }
      }
    }
    setPanel(null);
  }, [add, update, panel, gcalToken]);

  // ── Delete event ───────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (event) => {
    if (event.source === 'google' || event.googleId) {
      if (gcalToken) {
        try { await deleteGcalEvent(gcalToken, event.googleId || event.id); }
        catch (err) { console.warn('[Calendar] GCal delete failed:', err.message); }
      }
      setGcalEvents(prev => prev.filter(e => e.id !== event.id));
    }
    if (event.id && !event.googleId) {
      await remove(event.id);
    } else if (event.id) {
      await remove(event.id);
    }
  }, [remove, gcalToken]);

  // ── Voice command ──────────────────────────────────────────────────────────
  const handleVoice = useCallback(() => {
    if (!ai?.startListening) return;
    setVoice(true);
    ai.startListening((transcript) => {
      setVoice(false);
      const lower = transcript.toLowerCase();
      if (lower.includes('add event') || lower.includes('new event') || lower.includes('create event') ||
          lower.includes('schedule') || lower.includes('meeting') || lower.includes('appointment')) {
        setPanel({ mode: 'add', prefill: transcript });
      } else {
        setPanel({ mode: 'add', prefill: transcript });
      }
    });
  }, [ai]);

  const clientIdMissing = !GCAL_CLIENT_ID || GCAL_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE';

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* ── Main agenda ───────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transition: 'margin-right 0.22s ease',
        marginRight: panel ? 260 : 0,
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px 12px',
          borderBottom: '0.5px solid var(--sidebar-divider)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
            Calendar
            {synced && <span style={{ fontSize: 9.5, color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>● synced</span>}
          </h2>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 0 }}>
            {['today', 'upcoming', 'all'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 11px', fontSize: 11.5, cursor: 'pointer',
                background: 'none', border: 'none',
                borderBottom: `2px solid ${filter === f ? 'var(--accent)' : 'transparent'}`,
                color: filter === f ? 'var(--accent)' : 'var(--text-muted)',
                textTransform: 'capitalize', transition: 'all 0.15s ease',
              }}>
                {f}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Google Calendar connect / disconnect */}
          {gcalToken ? (
            <button onClick={disconnectGcal} style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
              background: 'rgba(66,133,244,0.1)', border: '0.5px solid rgba(66,133,244,0.3)',
              color: '#4a9eff', transition: 'all 0.15s ease',
            }}>
              {gcalLoading ? 'Syncing…' : '● Google Calendar'}
            </button>
          ) : (
            <button onClick={connectGcal} style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
              background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
              color: 'var(--text-secondary)', transition: 'all 0.15s ease',
            }}
            title={clientIdMissing ? 'Add VITE_GOOGLE_CLIENT_ID to .env to enable' : 'Connect Google Calendar'}>
              {clientIdMissing ? '○ Google Cal (setup needed)' : '+ Connect Google'}
            </button>
          )}

          {/* Voice */}
          <button onClick={handleVoice} disabled={!ai || voiceActive}
            style={{
              background: voiceActive ? 'var(--active-bg)' : 'none', border: 'none',
              cursor: 'pointer', color: voiceActive ? 'var(--accent)' : 'var(--text-muted)',
              padding: 6, borderRadius: 6, display: 'flex',
            }}>
            <MicIcon />
          </button>

          {/* New event */}
          <button onClick={() => setPanel({ mode: 'add' })} style={{
            padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
            background: 'var(--active-bg)', border: '0.5px solid var(--card-border)',
            color: 'var(--accent)', cursor: 'pointer',
          }}>
            + Event
          </button>
        </div>

        {/* Error banner */}
        {gcalError && (
          <div style={{
            padding: '8px 24px', background: 'rgba(229,90,90,0.08)',
            borderBottom: '0.5px solid rgba(229,90,90,0.2)',
            fontSize: 12, color: '#e55a5a', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>⚠</span> {gcalError}
            <button onClick={() => setGcalError(null)} style={{ marginLeft: 'auto', ...tinyBtnStyle }}>
              <CloseIcon />
            </button>
          </div>
        )}

        {/* Agenda */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {grouped.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: 10, opacity: 0.4,
            }}>
              <span style={{ fontSize: 28 }}>📅</span>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                {filter === 'today' ? 'Nothing scheduled today.' : 'No events to show.'}
              </p>
              <button onClick={() => setPanel({ mode: 'add' })}
                style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                + Add an event
              </button>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.date} style={{ marginBottom: 24 }}>
                {/* Date header */}
                <div style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                  letterSpacing: '0.06em', marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{
                    color: group.date === todayStr() ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: group.date === todayStr() ? 12 : 11,
                  }}>
                    {group.label.toUpperCase()}
                  </span>
                  <div style={{ flex: 1, height: '0.5px', background: 'var(--sidebar-divider)' }} />
                </div>
                {/* Event cards */}
                {group.events.map(ev => (
                  <EventCard
                    key={ev.id || ev.googleId}
                    event={ev}
                    onEdit={e => setPanel({ mode: 'edit', event: e })}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Slide-in panel ────────────────────────────────────────────────── */}
      {panel && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 260,
          background: 'var(--bg-panel)',
          borderLeft: '0.5px solid var(--sidebar-divider)',
          animation: 'slideInFromRight 0.22s cubic-bezier(0.4,0,0.2,1)',
          zIndex: 10, overflowY: 'auto',
        }}>
          <EventPanel
            event={panel.mode === 'edit' ? panel.event : null}
            onSave={handleSave}
            onClose={() => setPanel(null)}
          />
        </div>
      )}
    </div>
  );
}
