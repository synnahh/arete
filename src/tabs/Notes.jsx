// ─── Notes Tab ────────────────────────────────────────────────────────────────
// Masonry grid · pinned row at top · slide-in panel editor · Firebase synced

import { Icon as LineIcon } from '../components/icons.jsx';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS }  from '../utils/storage.js';

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const PinIcon    = () => <Icon d="M12 2l2 7h7l-5.6 4.1 2.1 7L12 17l-5.5 3.1 2.1-7L3 9h7z" size={13} />;
const TrashIcon  = () => <Icon d="M3 6h18 M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2 M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6 M10 11v6 M14 11v6" size={13} />;
const BoldIcon   = () => <Icon d="M6 4h8a4 4 0 010 8H6z M6 12h9a4 4 0 010 8H6z" size={13} />;
const ItalicIcon = () => <Icon d="M19 4h-9 M14 20H5 M15 4L9 20" size={13} />;
const MicIcon    = () => <Icon d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8" size={13} />;
const CloseIcon  = () => <Icon d="M18 6L6 18 M6 6l12 12" size={14} />;

// ── Relative time ──────────────────────────────────────────────────────────────
function relativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ── Preview snippet ────────────────────────────────────────────────────────────
function stripMarkdown(text = '') {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*{1,2}(.+?)\*{1,2}/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/^[-*]\s/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
}

// ── Note card ─────────────────────────────────────────────────────────────────
function NoteCard({ note, onClick, onPin, onDelete, pinned = false }) {
  const [hovered, setHovered] = useState(false);
  const preview = stripMarkdown(note.body).slice(0, 120);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--card-fill)',
        border: `0.5px solid ${hovered ? 'var(--card-hover-border)' : 'var(--card-border)'}`,
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease',
        position: 'relative',
        breakInside: 'avoid',
        marginBottom: 12,
      }}
    >
      {/* Title */}
      <div style={{
        fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
        marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {note.title || 'Untitled'}
      </div>

      {/* Preview */}
      {preview && (
        <div style={{
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {preview}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
          {relativeTime(note.updatedAt || note.createdAt)}
        </span>

        {/* Action buttons — show on hover */}
        {hovered && (
          <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => onPin(note)} title={note.pinned ? 'Unpin' : 'Pin'}
              style={{ ...tinyBtnStyle, color: note.pinned ? 'var(--accent)' : 'var(--text-muted)' }}>
              <PinIcon />
            </button>
            <button onClick={() => onDelete(note.id)} title="Delete" style={tinyBtnStyle}>
              <TrashIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const tinyBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-muted)', padding: 3, borderRadius: 4,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'color 0.15s ease',
};

// ── Simple Markdown-aware textarea editor ─────────────────────────────────────
function NoteEditor({ note, onSave, onClose, onDelete }) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody]   = useState(note?.body  ?? '');
  const textareaRef       = useRef(null);
  const isNew = !note?.id;

  // Auto-save every 1.5s after last change
  const saveTimer = useRef(null);
  const triggerSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (title.trim() || body.trim()) {
        onSave({ id: note?.id, title: title || 'Untitled', body });
      }
    }, 1500);
  }, [title, body, note?.id, onSave]);

  useEffect(() => { triggerSave(); return () => clearTimeout(saveTimer.current); }, [title, body]);
  useEffect(() => { textareaRef.current?.focus(); }, []);

  // Bold / Italic helpers
  const wrapSelection = (tag) => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = body.slice(s, e);
    const wrapped  = tag === '**' ? `**${selected}**` : `_${selected}_`;
    const next = body.slice(0, s) + wrapped + body.slice(e);
    setBody(next);
    setTimeout(() => { el.focus(); el.setSelectionRange(s + tag.length, e + tag.length); }, 0);
  };

  const insertBullet = () => {
    const el = textareaRef.current;
    if (!el) return;
    const lines = body.split('\n');
    const cursorLine = body.slice(0, el.selectionStart).split('\n').length - 1;
    lines[cursorLine] = '- ' + lines[cursorLine];
    setBody(lines.join('\n'));
  };

  // Render light Markdown preview in textarea (just visual syntax hints — no live render)
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-panel)',
      borderLeft: '0.5px solid var(--sidebar-divider)',
    }}>
      {/* Editor header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px', borderBottom: '0.5px solid var(--sidebar-divider)',
        flexShrink: 0,
      }}>
        {/* Formatting toolbar */}
        <button onClick={() => wrapSelection('**')} title="Bold" style={tinyBtnStyle}><BoldIcon /></button>
        <button onClick={() => wrapSelection('_')}  title="Italic" style={tinyBtnStyle}><ItalicIcon /></button>
        <button onClick={insertBullet} title="Bullet" style={{ ...tinyBtnStyle, fontSize: 12 }}>⬢</button>

        <div style={{ flex: 1 }} />

        {/* Auto-save indicator */}
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>auto-saving</span>

        {note?.id && (
          <button onClick={() => onDelete(note.id)} style={{ ...tinyBtnStyle, color: 'var(--text-muted)' }} title="Delete">
            <TrashIcon />
          </button>
        )}
        <button onClick={() => { onSave({ id: note?.id, title: title || 'Untitled', body }); onClose(); }}
          style={{ ...tinyBtnStyle }} title="Close">
          <CloseIcon />
        </button>
      </div>

      {/* Title */}
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Note title"
        style={{
          background: 'none', border: 'none', outline: 'none',
          padding: '16px 20px 8px',
          fontSize: 18, fontWeight: 500, color: 'var(--text-primary)',
          width: '100%', boxSizing: 'border-box',
          flexShrink: 0,
        }}
      />

      {/* Body */}
      <textarea
        ref={textareaRef}
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Start writing… (supports **bold**, _italic_, - bullets)"
        style={{
          flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none',
          padding: '8px 20px 20px',
          fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.75,
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

// ── Main Notes component ───────────────────────────────────────────────────────
export default function Notes({ ai }) {
  const { items: notes, add, update, remove, synced } = useCollection('notes', STORAGE_KEYS.NOTES);
  const [search,     setSearch]     = useState('');
  const [activeNote, setActiveNote] = useState(null); // null | note object
  const [panelOpen,  setPanelOpen]  = useState(false);
  const [voiceActive, setVoice]     = useState(false);

  // Filter + sort: pinned first then by updatedAt
  const displayed = useMemo(() => {
    let list = notes;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }, [notes, search]);

  const pinned   = displayed.filter(n => n.pinned);
  const unpinned = displayed.filter(n => !n.pinned);

  const openNote = (note) => { setActiveNote(note); setPanelOpen(true); };
  const newNote  = ()     => { setActiveNote(null);  setPanelOpen(true); };
  const closePanel = ()   => { setActiveNote(null);  setPanelOpen(false); };

  const handleSave = useCallback(async ({ id, title, body }) => {
    if (id) {
      await update(id, { title, body });
      setActiveNote(prev => prev ? { ...prev, title, body } : prev);
    } else {
      const newId = await add({ title, body, pinned: false });
      setActiveNote(prev => prev ?? { id: newId, title, body, pinned: false });
    }
  }, [add, update]);

  const handlePin    = useCallback(async (note) => { await update(note.id, { pinned: !note.pinned }); }, [update]);
  const handleDelete = useCallback(async (id)   => { await remove(id); closePanel(); }, [remove]);

  // Voice: "add note [title]" or "new note"
  const handleVoice = useCallback(() => {
    if (!ai?.startListening) return;
    setVoice(true);
    ai.startListening((transcript) => {
      setVoice(false);
      const lower = transcript.toLowerCase();
      if (lower.startsWith('add note') || lower.startsWith('new note') || lower.startsWith('create note')) {
        const title = transcript.replace(/^(add|new|create)\s+note\s*/i, '').trim();
        setActiveNote(title ? { title, body: '', pinned: false } : null);
        setPanelOpen(true);
      } else {
        // Treat as new note with transcript as body
        setActiveNote({ title: '', body: transcript.trim(), pinned: false });
        setPanelOpen(true);
      }
    });
  }, [ai]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* ── Main notes grid ──────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transition: 'margin-right 0.22s ease',
        marginRight: panelOpen ? 380 : 0,
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px 12px',
          borderBottom: '0.5px solid var(--sidebar-divider)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
            Notes
            {synced && <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}> synced</span>}
          </h2>
          {/* Search */}
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search notes…"
            style={{
              flex: 1, maxWidth: 280,
              background: 'var(--input-bg)', border: '0.5px solid var(--input-border)',
              borderRadius: 8, padding: '6px 12px', fontSize: 12.5,
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
          <div style={{ flex: 1 }} />
          {/* Voice */}
          <button onClick={handleVoice} disabled={!ai || voiceActive} title="Voice note"
            style={{
              background: voiceActive ? 'var(--active-bg)' : 'none', border: 'none', cursor: 'pointer',
              color: voiceActive ? 'var(--accent)' : 'var(--text-muted)', padding: 6, borderRadius: 6,
              display: 'flex',
            }}>
            <MicIcon />
          </button>
          {/* New note */}
          <button onClick={newNote} style={{
            padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
            background: 'var(--active-bg)', border: '0.5px solid var(--card-border)',
            color: 'var(--accent)', cursor: 'pointer',
          }}>
            + New
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {notes.length === 0 && !search ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: 10, opacity: 0.4,
            }}>
              <span style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><LineIcon name="notes" size={26} strokeWidth={1.5} /></span>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                No notes yet. Click <strong style={{ color: 'var(--accent)' }}>+ New</strong> to start.
              </p>
            </div>
          ) : (
            <>
              {/* Pinned */}
              {pinned.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em',
                    marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{ color: 'var(--accent)', fontSize: 11 }}>&</span> PINNED
                  </div>
                  {/* Pinned notes: full-width row */}
                  {pinned.map(n => (
                    <NoteCard key={n.id} note={n} pinned
                      onClick={() => openNote(n)}
                      onPin={handlePin}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}

              {/* All other notes — CSS columns masonry */}
              {unpinned.length > 0 && (
                <div style={{ columns: '220px', columnGap: 12 }}>
                  {unpinned.map(n => (
                    <NoteCard key={n.id} note={n}
                      onClick={() => openNote(n)}
                      onPin={handlePin}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}

              {/* Empty search */}
              {search && displayed.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
                  No notes match "{search}"
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Slide-in editor panel ─────────────────────────────────────────────── */}
      {panelOpen && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 380,
          display: 'flex', flexDirection: 'column',
          animation: 'slideInFromRight 0.22s cubic-bezier(0.4,0,0.2,1)',
          zIndex: 10,
        }}>
          <NoteEditor
            note={activeNote}
            onSave={handleSave}
            onClose={closePanel}
            onDelete={handleDelete}
          />
        </div>
      )}
    </div>
  );
}

