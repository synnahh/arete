// ─── VALERIE — Lists Tab (Books · Shows · Films · Podcasts · Articles) ─────────
import { useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS }  from '../utils/storage.js';

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'books',    label: 'Books',    icon: '📚', placeholder: 'author',   meta: 'Author' },
  { id: 'shows',    label: 'Shows',    icon: '📺', placeholder: 'creator',  meta: 'Creator' },
  { id: 'films',    label: 'Films',    icon: '🎬', placeholder: 'director', meta: 'Director' },
  { id: 'podcasts', label: 'Podcasts', icon: '🎙️', placeholder: 'host',     meta: 'Host' },
  { id: 'articles', label: 'Articles', icon: '📰', placeholder: 'source',   meta: 'Source' },
];

// ─── Status config ────────────────────────────────────────────────────────────
const STATUSES = [
  { id: 'up_next',     label: 'Up Next',     colour: '#5b9cf6' },
  { id: 'in_progress', label: 'In Progress', colour: '#f4a642' },
  { id: 'done',        label: 'Done',        colour: '#4caf7d' },
];
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.id, s]));

// ─── Shared styles ────────────────────────────────────────────────────────────
const INPUT = {
  flex: 1, padding: '8px 12px', borderRadius: 8,
  background: 'rgba(255,255,255,0.06)', border: '0.5px solid var(--card-border)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
};
const BTN_ACCENT = {
  padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 500,
};
const BTN_GHOST = {
  padding: '7px 13px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontSize: 13,
};

// ─── Star rating ──────────────────────────────────────────────────────────────
function StarRating({ value = 0, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={() => onChange(n === value ? 0 : n)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 18, padding: 0, color: n <= value ? '#fbbf24' : 'rgba(255,255,255,0.15)',
        }}>&</button>
      ))}
    </div>
  );
}

// ─── Add Item Panel ───────────────────────────────────────────────────────────
function AddPanel({ category, onAdd, onCancel }) {
  const cat = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];
  const [title,  setTitle]  = useState('');
  const [meta,   setMeta]   = useState('');
  const [genre,  setGenre]  = useState('');
  const [status, setStatus] = useState('up_next');
  const [notes,  setNotes]  = useState('');
  const [url,    setUrl]    = useState('');

  function handleAdd() {
    if (!title.trim()) return;
    onAdd({
      category,
      title:  title.trim(),
      meta:   meta.trim() || null,
      genre:  genre.trim() || null,
      status,
      notes:  notes.trim() || null,
      url:    url.trim() || null,
      rating: 0,
      createdAt: new Date().toISOString(),
    });
    setTitle(''); setMeta(''); setGenre(''); setNotes(''); setUrl('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 2 }}>
        ADD {cat.label.toUpperCase()}
      </div>
      <input placeholder={`Title *`} value={title}
        onChange={e => setTitle(e.target.value)} style={INPUT} autoFocus />
      <input placeholder={`${cat.meta} (optional)`} value={meta}
        onChange={e => setMeta(e.target.value)} style={INPUT} />
      <input placeholder="Genre (optional)" value={genre}
        onChange={e => setGenre(e.target.value)} style={INPUT} />

      {/* URL for articles */}
      {category === 'articles' && (
        <input placeholder="URL (optional)" value={url}
          onChange={e => setUrl(e.target.value)} style={INPUT} />
      )}

      {/* Status */}
      <div style={{ display: 'flex', gap: 6 }}>
        {STATUSES.map(s => (
          <button key={s.id} onClick={() => setStatus(s.id)} style={{
            flex: 1, padding: '5px 8px', borderRadius: 7, border: 'none',
            cursor: 'pointer', fontSize: 11,
            background: status === s.id ? s.colour + '33' : 'rgba(255,255,255,0.05)',
            color: status === s.id ? s.colour : 'var(--text-secondary)',
            outline: status === s.id ? `0.5px solid ${s.colour}55` : '0.5px solid transparent',
          }}>{s.label}</button>
        ))}
      </div>

      <textarea placeholder="Notes (optional)" value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2} style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }} />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={BTN_GHOST}>Cancel</button>
        <button onClick={handleAdd} style={BTN_ACCENT}>Add</button>
      </div>
    </div>
  );
}

// ─── Item Detail Panel ────────────────────────────────────────────────────────
function DetailPanel({ item, onUpdate, onDelete, onClose }) {
  const cat    = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[0];
  const status = STATUS_MAP[item.status] || STATUSES[0];
  const [editing, setEditing] = useState(false);
  const [notes,   setNotes]   = useState(item.notes || '');
  const [editUrl, setEditUrl] = useState(item.url || '');

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 2 }}>NOTES</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          rows={4} style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }} autoFocus />
        {item.category === 'articles' && (
          <input placeholder="URL" value={editUrl}
            onChange={e => setEditUrl(e.target.value)} style={INPUT} />
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setEditing(false)} style={BTN_GHOST}>Cancel</button>
          <button onClick={() => {
            onUpdate(item.id, { notes: notes.trim() || null, url: editUrl.trim() || null });
            setEditing(false);
          }} style={BTN_ACCENT}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Cover placeholder + title */}
      <div style={{
        width: '100%', height: 120, borderRadius: 10,
        background: `linear-gradient(135deg, ${status.colour}22, ${status.colour}08)`,
        border: `0.5px solid ${status.colour}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 40,
      }}>
        {cat.icon}
      </div>

      <div>
        <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 400, lineHeight: 1.3 }}>
          {item.title}
        </div>
        {item.meta && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{item.meta}</div>
        )}
        {item.genre && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.genre}</div>
        )}
      </div>

      {/* Status selector */}
      <div style={{ display: 'flex', gap: 5 }}>
        {STATUSES.map(s => (
          <button key={s.id} onClick={() => onUpdate(item.id, { status: s.id })} style={{
            flex: 1, padding: '5px 0', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11,
            background: item.status === s.id ? s.colour + '33' : 'rgba(255,255,255,0.05)',
            color: item.status === s.id ? s.colour : 'var(--text-secondary)',
          }}>{s.label}</button>
        ))}
      </div>

      {/* Rating (shown when Done) */}
      {item.status === 'done' && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>RATING</div>
          <StarRating value={item.rating || 0}
            onChange={r => onUpdate(item.id, { rating: r })} />
        </div>
      )}

      {/* Notes */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>NOTES</div>
        {item.notes ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.notes}</div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No notes</div>
        )}
      </div>

      {/* URL link for articles */}
      {item.url && (
        <a href={item.url} target="_blank" rel="noreferrer" style={{
          fontSize: 12, color: 'var(--accent)',
          textDecoration: 'none', wordBreak: 'break-all',
        }}>
          x Open link
        </a>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => setEditing(true)} style={{ ...BTN_GHOST, flex: 1 }}>Edit notes</button>
        <button onClick={() => { onDelete(item.id); onClose(); }}
          style={{ ...BTN_GHOST, flex: 1, color: '#e55a5a' }}>Delete</button>
      </div>
    </div>
  );
}

// ─── Item card ────────────────────────────────────────────────────────────────
function ItemCard({ item, onClick }) {
  const status = STATUS_MAP[item.status] || STATUSES[0];
  return (
    <div onClick={onClick} style={{
      background: 'var(--bg-panel)',
      border: '0.5px solid var(--card-border)',
      borderRadius: 10, padding: '12px 14px',
      cursor: 'pointer', transition: 'border-color 0.15s',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 27%, transparent)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--card-border)'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3, flex: 1 }}>
          {item.title}
        </div>
        <div style={{
          fontSize: 10.5, fontWeight: 600, color: status.colour,
          background: status.colour + '18', padding: '2px 7px',
          borderRadius: 20, flexShrink: 0, letterSpacing: '0.03em',
        }}>
          {status.label.toUpperCase()}
        </div>
      </div>
      {item.meta && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.meta}</div>
      )}
      {item.status === 'done' && item.rating > 0 && (
        <div style={{ fontSize: 12, color: '#fbbf24' }}>{'&'.repeat(item.rating)}{' '.repeat(5 - item.rating)}</div>
      )}
    </div>
  );
}

// ─── Main Lists Tab ───────────────────────────────────────────────────────────
export default function Lists() {
  const { items, add, update, remove } = useCollection('watch_list', STORAGE_KEYS.LISTS);

  const [activeCat, setActiveCat] = useState('books');
  const [filter,    setFilter]    = useState('all'); // all | up_next | in_progress | done
  const [selected,  setSelected]  = useState(null);
  const [adding,    setAdding]    = useState(false);

  const catItems = items.filter(it => it.category === activeCat);

  const filtered = catItems.filter(it => {
    if (filter === 'all') return true;
    return it.status === filter;
  });

  // Count per category
  const counts = Object.fromEntries(
    CATEGORIES.map(c => [c.id, items.filter(it => it.category === c.id).length])
  );

  const selectedItem = items.find(it => it.id === selected);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Category nav ─────────────────────────────────────────────────── */}
      <nav style={{
        width: 160, flexShrink: 0,
        borderRight: '0.5px solid var(--card-border)',
        padding: '16px 8px',
        display: 'flex', flexDirection: 'column', gap: 4,
        overflowY: 'auto',
      }}>
        {CATEGORIES.map(c => {
          const active = activeCat === c.id;
          return (
            <button key={c.id} onClick={() => { setActiveCat(c.id); setSelected(null); setAdding(false); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? 'var(--active-bg)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                fontSize: 13, width: '100%', transition: 'all 0.15s ease',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </div>
              {counts[c.id] > 0 && (
                <span style={{
                  fontSize: 11, background: 'rgba(255,255,255,0.1)',
                  padding: '1px 6px', borderRadius: 20, color: 'var(--text-muted)',
                }}>
                  {counts[c.id]}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{
          padding: '12px 16px', borderBottom: '0.5px solid var(--card-border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            {[['all','All'], ['up_next','Up Next'], ['in_progress','In Progress'], ['done','Done']].map(([v,l]) => (
              <button key={v} onClick={() => setFilter(v)} style={{
                padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                background: filter === v ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: filter === v ? '#fff' : 'var(--text-secondary)',
              }}>{l}</button>
            ))}
          </div>
          <button onClick={() => { setAdding(true); setSelected(null); }} style={BTN_ACCENT}>
            + Add
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Item grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {adding && (
              <div style={{
                background: 'var(--bg-panel)',
                border: '0.5px solid var(--card-border)',
                borderRadius: 12, padding: '16px',
                marginBottom: 16,
              }}>
                <AddPanel
                  category={activeCat}
                  onAdd={data => { add(data); setAdding(false); }}
                  onCancel={() => setAdding(false)}
                />
              </div>
            )}

            {filtered.length === 0 && !adding ? (
              <div style={{ textAlign: 'center', paddingTop: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>
                  {CATEGORIES.find(c => c.id === activeCat)?.icon}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {catItems.length === 0
                    ? `No ${activeCat} yet. Add your first one.`
                    : 'Nothing in this filter.'}
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 10,
              }}>
                {filtered.map(it => (
                  <ItemCard key={it.id} item={it}
                    onClick={() => { setSelected(it.id); setAdding(false); }} />
                ))}
              </div>
            )}
          </div>

          {/* Slide-in detail panel */}
          {selectedItem && (
            <div style={{
              width: 260, flexShrink: 0,
              borderLeft: '0.5px solid var(--card-border)',
              padding: '20px 16px',
              overflowY: 'auto',
              background: 'var(--bg-panel)',
            }}>
              <DetailPanel
                item={selectedItem}
                onUpdate={update}
                onDelete={remove}
                onClose={() => setSelected(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

