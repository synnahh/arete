// Phone Notes: a list you can search, pin, edit in a sheet, and swipe to delete
// (with Undo). Same `notes` collection as the desktop Notes tab, so both stay in step.
import { useMemo, useState } from 'react';
import { useCollection } from '../../supabase/useCollection.js';
import { STORAGE_KEYS } from '../../utils/storage.js';
import Sheet from '../Sheet.jsx';
import SwipeRow from '../SwipeRow.jsx';

const field = { width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 12, padding: '0 14px', border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-primary)', fontFamily: 'inherit' };
const toast = (message, undo) => window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type: 'success', undo } }));
const strip = (t = '') => t.replace(/#{1,6}\s/g, '').replace(/\*{1,2}(.+?)\*{1,2}/g, '$1').replace(/_(.+?)_/g, '$1').replace(/\s+/g, ' ').trim();
const when = (ts) => (ts ? new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '');

function Editor({ note, onSave, onClose }) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  return (
    <Sheet title={note ? 'Edit note' : 'New note'} onClose={onClose}>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" aria-label="Title" style={field} />
      <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write something" aria-label="Note" rows={9} style={{ ...field, padding: 14, minHeight: 180, resize: 'vertical', lineHeight: 1.5 }} />
      <button type="button" disabled={!title.trim() && !body.trim()} onClick={() => onSave({ title: title.trim() || 'Untitled', body })}
        style={{ minHeight: 46, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', opacity: title.trim() || body.trim() ? 1 : 0.5 }}>Save</button>
    </Sheet>
  );
}

export default function MobileNotes() {
  const { items: notes = [], add, update, remove } = useCollection('notes', STORAGE_KEYS.NOTES);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(undefined);   // undefined closed, null new, note edit

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const found = needle ? notes.filter(n => `${n.title || ''} ${n.body || ''}`.toLowerCase().includes(needle)) : notes;
    return [...found].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  }, [notes, q]);

  const save = async ({ title, body }) => {
    if (editing) await update(editing.id, { title, body, updatedAt: Date.now() });
    else await add({ title, body, pinned: false, updatedAt: Date.now() });
    setEditing(undefined);
  };

  const drop = async (n) => {
    const { id: _id, ...rest } = n;
    await remove(n.id);
    toast(`Deleted ${n.title || 'note'}`, () => add(rest));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search notes" aria-label="Search notes" style={{ ...field, flex: 1 }} />
        <button type="button" onClick={() => setEditing(null)} style={{ minHeight: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>New</button>
      </div>

      {list.length === 0 ? (
        <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>{q ? 'No note matches.' : 'No notes yet. Tap New to write one.'}</div>
      ) : (
        <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)' }}>
          {list.map((n, i) => (
            <SwipeRow key={n.id} onDelete={() => drop(n)} style={{ borderBottom: i < list.length - 1 ? '0.5px solid var(--card-border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 6px 12px 16px' }}>
                <button type="button" onClick={() => setEditing(n)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || 'Untitled'}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{when(n.updatedAt || n.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{strip(n.body) || 'No text'}</div>
                </button>
                <button type="button" onClick={() => update(n.id, { pinned: !n.pinned })} aria-pressed={!!n.pinned} aria-label={n.pinned ? `Unpin ${n.title}` : `Pin ${n.title}`}
                  style={{ width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: n.pinned ? 'var(--accent)' : 'var(--text-muted)' }}>{n.pinned ? '★' : '☆'}</button>
              </div>
            </SwipeRow>
          ))}
        </div>
      )}

      {editing !== undefined && <Editor note={editing} onSave={save} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
