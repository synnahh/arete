// Phone Style: outfit ideas (Discover) and the saved board (Wishlist /
// Purchased / Pass). Same `style_board` collection as desktop; shared rules in
// src/domain/style.js. The desktop-only Google image search is left out: it
// needs a search key in the client.
import { useMemo, useState } from 'react';
import { useCollection } from '../../supabase/useCollection.js';
import { STORAGE_KEYS } from '../../utils/storage.js';
import { haptics } from '../utils/haptics.js';
import Sheet from '../Sheet.jsx';
import {
  OCCASIONS, CATEGORIES, STATUS_CONFIG, STATUSES, getCurrSymbol, buildResults, boardSummary, filterBoard,
} from '../../domain/style.js';
import { label } from '../../components/ui.js';

const card = { background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', borderRadius: 14 };
const input = { width: '100%', boxSizing: 'border-box', height: 44, padding: '0 12px', borderRadius: 10, background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 15 };
const primary = { minHeight: 48, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, background: 'var(--tab-accent)', color: 'var(--on-tab-accent)', WebkitTapHighlightColor: 'transparent' };
const ghost = { minHeight: 44, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, background: 'transparent', border: '0.5px solid var(--card-border)', color: 'var(--text-secondary)', WebkitTapHighlightColor: 'transparent' };
const pill = (on, color) => ({
  minHeight: 40, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0,
  border: `0.5px solid ${on ? (color || 'var(--tab-accent)') : 'var(--card-border)'}`,
  background: on ? `color-mix(in srgb, ${color || 'var(--tab-accent)'} 16%, transparent)` : 'transparent',
  color: on ? (color || 'var(--tab-accent)') : 'var(--text-secondary)', fontWeight: on ? 600 : 500, WebkitTapHighlightColor: 'transparent',
});

function Photo({ src, alt }) {
  const [bad, setBad] = useState(false);
  return src && !bad
    ? <img src={src} alt={alt} loading="lazy" draggable={false} onError={() => setBad(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    : <div aria-hidden="true" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{src ? 'Image unavailable' : 'No image'}</div>;
}

function StatusPills({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {STATUSES.map(s => (
        <button key={s} type="button" aria-pressed={value === s} onClick={() => onChange(s)} style={{ ...pill(value === s, STATUS_CONFIG[s].color), flex: 1 }}>{STATUS_CONFIG[s].label}</button>
      ))}
    </div>
  );
}

//  Add or edit one board item
function ItemSheet({ item, sym, onSave, onDelete, onClose }) {
  const [f, setF] = useState({
    title: item?.title || '', brand: item?.brand || '', category: item?.category || CATEGORIES[0], status: item?.status || 'wishlist',
    price: item?.price != null ? String(item.price) : '', url: item?.url || '', imageUrl: item?.imageUrl || '', notes: item?.notes || '',
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.title.trim()) return;
    const price = f.price.trim() === '' ? null : Number(f.price);
    onSave({ ...f, title: f.title.trim(), price: Number.isFinite(price) ? price : null });
  };
  const link = /^https?:\/\//i.test(f.url.trim()) ? f.url.trim() : null;

  return (
    <Sheet title={item ? 'Edit item' : 'Add to board'} onClose={onClose}>
      {f.imageUrl && <div style={{ aspectRatio: '4 / 3', borderRadius: 12, overflow: 'hidden', background: 'var(--hover-bg)' }}><Photo src={f.imageUrl} alt={f.title} /></div>}
      <input aria-label="Title" placeholder="e.g. Black slim-fit trousers" value={f.title} onChange={e => set('title', e.target.value)} style={input} autoFocus={!item} />
      <div style={{ display: 'flex', gap: 8 }}>
        <input aria-label="Brand" placeholder="Brand" value={f.brand} onChange={e => set('brand', e.target.value)} style={input} />
        <input aria-label={`Price (${sym})`} placeholder={`Price (${sym})`} inputMode="decimal" value={f.price} onChange={e => set('price', e.target.value)} style={input} />
      </div>
      <StatusPills value={f.status} onChange={v => set('status', v)} />
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {CATEGORIES.map(c => <button key={c} type="button" aria-pressed={f.category === c} onClick={() => set('category', c)} style={pill(f.category === c)}>{c}</button>)}
      </div>
      <input aria-label="Product link" placeholder="Product link (optional)" inputMode="url" value={f.url} onChange={e => set('url', e.target.value)} style={input} />
      <input aria-label="Image link" placeholder="Image link (optional)" inputMode="url" value={f.imageUrl} onChange={e => set('imageUrl', e.target.value)} style={input} />
      <textarea aria-label="Notes" placeholder="Notes (size, colour, where…)" rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} style={{ ...input, height: 'auto', padding: 12, resize: 'vertical' }} />
      <button type="button" onClick={save} disabled={!f.title.trim()} style={{ ...primary, opacity: f.title.trim() ? 1 : 0.5 }}>{item ? 'Save' : 'Add'}</button>
      {link && <a href={link} target="_blank" rel="noopener noreferrer" style={{ ...ghost, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Open link</a>}
      {item && <button type="button" onClick={onDelete} style={{ ...ghost, color: '#e55a5a', borderColor: '#e55a5a' }}>Remove from board</button>}
    </Sheet>
  );
}

function Board({ items, sym, onAdd, onUpdate, onRemove }) {
  const [filter, setFilter] = useState('all');
  const [sheet, setSheet] = useState(null); // null | 'new' | item
  const sum = useMemo(() => boardSummary(items), [items]);
  const shown = useMemo(() => filterBoard(items, filter), [items, filter]);
  const money = (n) => `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  async function save(fields) {
    if (sheet && sheet !== 'new') await onUpdate(sheet.id, fields);
    else await onAdd({ ...fields, occasion: '' });
    setSheet(null);
  }
  async function del() {
    if (!window.confirm(`Remove "${sheet.title}" from your board?`)) return;
    await onRemove(sheet.id);
    setSheet(null);
  }
  async function quickStatus(it, status) {
    haptics.tap();
    await onUpdate(it.id, { status });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...card, padding: 14, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={label}>Wishlist</div>
          <div className="val-num" style={{ fontSize: 24, color: 'var(--text-primary)' }}>{money(sum.wishlistTotal)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{sum.counts.wishlist} item{sum.counts.wishlist === 1 ? '' : 's'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={label}>Bought</div>
          <div className="val-num" style={{ fontSize: 24, color: 'var(--text-primary)' }}>{money(sum.purchasedTotal)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{sum.counts.purchased} item{sum.counts.purchased === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')} style={pill(filter === 'all')}>All {items.length}</button>
        {STATUSES.map(s => <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)} style={pill(filter === s, STATUS_CONFIG[s].color)}>{STATUS_CONFIG[s].label} {sum.counts[s]}</button>)}
      </div>

      {shown.length === 0 && (
        <div style={{ ...card, padding: 28, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.5 }}>
          {items.length === 0 ? 'Nothing saved yet. Save outfit ideas from Discover, or add a piece you want.' : 'Nothing in this list.'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {shown.map(it => {
          const cfg = STATUS_CONFIG[it.status] || STATUS_CONFIG.wishlist;
          return (
            <div key={it.id} style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <button type="button" onClick={() => setSheet(it)} aria-label={`Edit ${it.title}`} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent' }}>
                <div style={{ position: 'relative', aspectRatio: '4 / 5', background: 'var(--hover-bg)' }}>
                  <Photo src={it.imageUrl} alt="" />
                  <span style={{ position: 'absolute', top: 8, right: 8, background: `${cfg.color}ee`, color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{cfg.label}</span>
                </div>
                <div style={{ padding: '9px 11px 6px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                  <div className="val-num" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{it.category}{it.price != null ? ` · ${sym}${Number(it.price).toFixed(2)}` : ''}</div>
                </div>
              </button>
              {it.status !== 'purchased' && (
                <button type="button" onClick={() => quickStatus(it, 'purchased')} style={{ ...ghost, minHeight: 40, margin: '0 10px 10px', fontSize: 12.5 }}>Mark bought</button>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" onClick={() => setSheet('new')} style={primary}>+ Add item</button>
      {sheet && <ItemSheet item={sheet === 'new' ? null : sheet} sym={sym} onSave={save} onDelete={del} onClose={() => setSheet(null)} />}
    </div>
  );
}

function Discover({ onSave }) {
  const [occasion, setOccasion] = useState(OCCASIONS[0]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [saved, setSaved] = useState({});

  const generate = () => { haptics.tap(); setResults(buildResults(occasion, query.trim())); setSaved({}); };
  async function save(r) {
    await onSave({ title: r.title, brand: '', category: 'Outfits', status: 'wishlist', price: null, imageUrl: r.imageUrl, notes: '', url: '', occasion: r.occasion || '' });
    haptics.success();
    setSaved(s => ({ ...s, [r.id]: true }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {OCCASIONS.map(o => <button key={o} type="button" aria-pressed={occasion === o} onClick={() => setOccasion(o)} style={pill(occasion === o)}>{o}</button>)}
      </div>
      <input aria-label="Style search" placeholder="Add a detail (linen, all black, summer…)" value={query} onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') generate(); }} style={input} />
      <button type="button" onClick={generate} style={primary}>{results.length ? 'Show new ideas' : 'Show ideas'}</button>
      {results.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Ideas are AI-generated pictures for the occasion you pick. Only your search words are sent to the image service.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {results.map(r => (
          <div key={r.id} style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ aspectRatio: '4 / 5', background: 'var(--hover-bg)' }}><Photo src={r.imageUrl} alt={r.title} /></div>
            <button type="button" disabled={saved[r.id]} onClick={() => save(r)} style={{ ...ghost, minHeight: 44, margin: 8, fontSize: 13, color: saved[r.id] ? 'var(--tab-accent)' : 'var(--text-primary)' }}>{saved[r.id] ? 'Saved to board' : 'Save'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MobileStyle({ settings }) {
  const { items = [], add, update, remove } = useCollection('style_board', STORAGE_KEYS.STYLE_BOARD);
  const [view, setView] = useState('board');
  const sym = getCurrSymbol(settings?.currency || 'AUD');

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" aria-pressed={view === 'board'} onClick={() => setView('board')} style={{ ...pill(view === 'board'), flex: 1 }}>My board{items.length ? ` ${items.length}` : ''}</button>
        <button type="button" aria-pressed={view === 'discover'} onClick={() => setView('discover')} style={{ ...pill(view === 'discover'), flex: 1 }}>Discover</button>
      </div>
      {view === 'board'
        ? <Board items={items} sym={sym} onAdd={add} onUpdate={update} onRemove={remove} />
        : <Discover onSave={add} />}
    </div>
  );
}
