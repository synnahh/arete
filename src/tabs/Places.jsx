// Places Tab — Alone Time / Places to Go
// Save, tag, and rediscover places for solo time

import { Icon as LineIcon } from '../components/icons.jsx';
import { useState, useMemo } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS }  from '../utils/storage.js';

const PLACE_TYPES = [
  { id: 'park',    label: 'Park',       icon: '🌿', color: '#4caf7d' },
  { id: 'cafe',    label: 'Cafe',       icon: '☕', color: '#f4a642' },
  { id: 'drive',   label: 'Drive',      icon: '🚗', color: '#5b9cf6' },
  { id: 'hike',    label: 'Hike',       icon: '🥾', color: '#a78bfa' },
  { id: 'beach',   label: 'Beach',      icon: '🏖', color: '#00c9a7' },
  { id: 'gym',     label: 'Gym',        icon: '🏋️', color: '#e25d7a' },
  { id: 'library', label: 'Library',    icon: '📚', color: '#9b5de5' },
  { id: 'view',    label: 'Viewpoint',  icon: '🌅', color: '#f97316' },
  { id: 'other',   label: 'Other',      icon: '📍', color: '#888'    },
];

const MOODS = ['Any', 'Peaceful', 'Active', 'Social', 'Creative', 'Adventurous'];

const BLANK = { name: '', type: 'park', address: '', notes: '', mood: 'Peaceful', visited: false };

function getType(id) { return PLACE_TYPES.find(t => t.id === id) || PLACE_TYPES[PLACE_TYPES.length - 1]; }

function PlaceCard({ place, onEdit, onRemove, onToggleVisited }) {
  const type = getType(place.type);
  return (
    <div style={{
      background: 'var(--hover-bg)', borderRadius: 14,
      border: '0.5px solid var(--card-border)',
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 8,
      opacity: place.visited ? 0.6 : 1,
      transition: 'opacity 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${type.color}20`, border: `0.5px solid ${type.color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          {type.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
            {place.name}
            {place.visited && <span style={{ marginLeft: 6, fontSize: 11, color: '#4caf7d', fontWeight: 400 }}>✓ visited</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: type.color, background: `${type.color}15`, padding: '2px 7px', borderRadius: 20 }}>{type.label}</span>
            {place.mood && <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 20 }}>{place.mood}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onToggleVisited(place)} title="Mark visited" style={{
            background: place.visited ? 'rgba(76,175,125,0.15)' : 'rgba(255,255,255,0.04)',
            border: `0.5px solid ${place.visited ? 'rgba(76,175,125,0.3)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 7, padding: '4px 8px', cursor: 'pointer', fontSize: 11,
            color: place.visited ? '#4caf7d' : 'var(--text-muted)',
          }}>✓</button>
          <button onClick={() => onEdit(place)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 6px', fontSize: 13 }}>✎</button>
          <button onClick={() => onRemove(place.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 6px', fontSize: 13 }}>✕</button>
        </div>
      </div>

      {place.address && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{place.address}</span>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(place.address)}`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', marginLeft: 'auto', flexShrink: 0 }}
          >
            Maps ↗
          </a>
        </div>
      )}

      {place.notes && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, paddingTop: 2, borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
          {place.notes}
        </div>
      )}
    </div>
  );
}

function PlaceForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || BLANK);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 13,
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{
      background: 'var(--bg-panel)', borderRadius: 16,
      border: '0.5px solid var(--card-border)', padding: '20px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
        {initial?.id ? 'Edit Place' : 'Add Place'}
      </div>

      <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Place name" style={inputStyle} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <select value={form.type} onChange={e => set('type', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          {PLACE_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
        </select>
        <select value={form.mood} onChange={e => set('mood', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          {MOODS.filter(m => m !== 'Any').map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Address or area (optional)" style={inputStyle} />
      <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notes..." rows={2}
        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '7px 16px', borderRadius: 8, border: '0.5px solid var(--card-border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
        <button
          onClick={() => form.name.trim() && onSave(form)}
          disabled={!form.name.trim()}
          style={{ padding: '7px 18px', borderRadius: 8, border: '0.5px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.1)', color: 'rgba(167,139,250,0.9)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default function Places() {
  const { items, add, update, remove } = useCollection('places', STORAGE_KEYS.PLACES);
  const [showForm, setShowForm]     = useState(false);
  const [editing,  setEditing]      = useState(null);
  const [filter,   setFilter]       = useState('All');
  const [moodFilter, setMoodFilter] = useState('Any');
  const [search,   setSearch]       = useState('');

  const filtered = useMemo(() => {
    return items.filter(p => {
      const typeMatch = filter === 'All' || p.type === filter;
      const moodMatch = moodFilter === 'Any' || p.mood === moodFilter;
      const searchMatch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.address?.toLowerCase().includes(search.toLowerCase());
      return typeMatch && moodMatch && searchMatch;
    });
  }, [items, filter, moodFilter, search]);

  const unvisited = filtered.filter(p => !p.visited);
  const visited   = filtered.filter(p => p.visited);

  async function handleSave(form) {
    if (editing?.id) { await update(editing.id, form); setEditing(null); }
    else { await add(form); setShowForm(false); }
  }

  function handleEdit(place) { setEditing(place); setShowForm(false); }
  function handleToggleVisited(place) { update(place.id, { ...place, visited: !place.visited }); }

  // Pick a random unvisited place
  const [suggestion, setSuggestion] = useState(null);
  function randomPlace() {
    const pool = items.filter(p => !p.visited);
    if (!pool.length) return;
    setSuggestion(pool[Math.floor(Math.random() * pool.length)]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '18px 24px 12px', borderBottom: '0.5px solid var(--sidebar-divider)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Places</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Your personal alone-time destinations</div>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={randomPlace} title="Suggest a random place" style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 12,
            background: 'rgba(167,139,250,0.08)', border: '0.5px solid rgba(167,139,250,0.25)',
            color: 'rgba(167,139,250,0.8)', cursor: 'pointer',
          }}>✦ Surprise me</button>
          <button onClick={() => { setShowForm(true); setEditing(null); }} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            background: 'var(--active-bg)', border: '0.5px solid var(--card-border)',
            color: 'var(--accent)', cursor: 'pointer',
          }}>+ Add Place</button>
        </div>

        {/* Search + filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '5px 10px', color: 'var(--text-primary)', fontSize: 12, outline: 'none', width: 140 }}
          />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['All', ...PLACE_TYPES.map(t => t.id)].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: 'none',
                background: filter === f ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                color: filter === f ? '#000' : 'var(--text-muted)',
                fontWeight: filter === f ? 600 : 400,
              }}>
                {f === 'All' ? 'All' : `${getType(f).icon} ${getType(f).label}`}
              </button>
            ))}
          </div>
          <select value={moodFilter} onChange={e => setMoodFilter(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '5px 10px', color: 'var(--text-primary)', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
            {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Suggestion banner */}
        {suggestion && (
          <div style={{
            background: 'rgba(167,139,250,0.08)', border: '0.5px solid rgba(167,139,250,0.25)',
            borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>{getType(suggestion.type).icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'rgba(167,139,250,0.7)', marginBottom: 2 }}>How about...</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{suggestion.name}</div>
              {suggestion.address && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{suggestion.address}</div>}
            </div>
            <button onClick={() => setSuggestion(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* Add / Edit form */}
        {showForm && <PlaceForm onSave={handleSave} onCancel={() => setShowForm(false)} />}
        {editing  && <PlaceForm initial={editing} onSave={handleSave} onCancel={() => setEditing(null)} />}

        {/* Places list */}
        {filtered.length === 0 && !showForm && !editing && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, opacity: 0.4 }}>
            <span style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><LineIcon name="places" size={30} strokeWidth={1.5} /></span>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              {items.length === 0 ? 'Add your first place to explore.' : 'No places match your filters.'}
            </div>
          </div>
        )}

        {unvisited.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 10 }}>
              TO EXPLORE · {unvisited.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {unvisited.map(p => <PlaceCard key={p.id} place={p} onEdit={handleEdit} onRemove={remove} onToggleVisited={handleToggleVisited} />)}
            </div>
          </div>
        )}

        {visited.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 10 }}>
              VISITED · {visited.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visited.map(p => <PlaceCard key={p.id} place={p} onEdit={handleEdit} onRemove={remove} onToggleVisited={handleToggleVisited} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
