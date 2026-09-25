//  VALERIE  Essentials / Restock Tracker 
import { useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS }  from '../utils/storage.js';
import { insertRow, deleteRow } from '../utils/quickWrite.js';
import { toLocalDateKey } from '../utils/localDate.js';

//  Categories 
const CATEGORIES = [
  { id: 'grooming',    label: 'Grooming',    icon: '🪒' },
  { id: 'health',      label: 'Health',      icon: '💊' },
  { id: 'kitchen',     label: 'Kitchen',     icon: '🍳' },
  { id: 'cleaning',    label: 'Cleaning',    icon: '🧹' },
  { id: 'supplements', label: 'Supplements', icon: '💪' },
  { id: 'other',       label: 'Other',       icon: '📦' },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

//  Status helpers 
function daysLeft(item) {
  if (!item.boughtDate || !item.lifespanDays) return null;
  const bought = new Date(item.boughtDate);
  const expire = new Date(bought.getTime() + item.lifespanDays * 86400000);
  return Math.ceil((expire - new Date()) / 86400000);
}

function getStatus(days) {
  if (days === null) return 'unknown';
  if (days <= 0)  return 'red';
  if (days <= 7)  return 'amber';
  return 'green';
}

const STATUS_COLOUR = { green: '#4caf7d', amber: '#f4a642', red: '#e55a5a', unknown: '#555' };
const STATUS_LABEL  = { green: 'Stocked', amber: 'Low',    red: 'Due now', unknown: '' };

const todayISO = () => toLocalDateKey(new Date());

//  Shared styles 
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

//  Add / Edit Panel 
function ItemForm({ initial, onSave, onCancel }) {
  const [name,     setName]     = useState(initial?.name       || '');
  const [cat,      setCat]      = useState(initial?.category   || 'grooming');
  const [bought,   setBought]   = useState(initial?.boughtDate || todayISO());
  const [days,     setDays]     = useState(initial?.lifespanDays ?? '');
  const [price,    setPrice]    = useState(initial?.price      ?? '');
  const [notes,    setNotes]    = useState(initial?.notes      || '');

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      category: cat,
      boughtDate: bought,
      lifespanDays: parseInt(days) || null,
      price: parseFloat(price) || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 4 }}>
        {initial ? 'EDIT ITEM' : 'NEW ITEM'}
      </div>

      <input placeholder="Item name" value={name} onChange={e => setName(e.target.value)}
        style={INPUT} autoFocus />

      {/* Category */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} style={{
            padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12,
            background: cat === c.id ? 'var(--accent)33' : 'rgba(255,255,255,0.05)',
            color: cat === c.id ? 'var(--accent)' : 'var(--text-secondary)',
            outline: cat === c.id ? '0.5px solid var(--accent)55' : '0.5px solid transparent',
          }}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Bought date</div>
          <input type="date" value={bought} onChange={e => setBought(e.target.value)} style={INPUT} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Lasts (days)</div>
          <input type="number" placeholder="e.g. 21" value={days}
            onChange={e => setDays(e.target.value)} style={INPUT} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Price (£)</div>
          <input type="number" placeholder="Optional" value={price}
            onChange={e => setPrice(e.target.value)} style={INPUT} />
        </div>
      </div>

      <textarea placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)}
        rows={2} style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }} />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button onClick={onCancel} style={BTN_GHOST}>Cancel</button>
        <button onClick={handleSave} style={BTN_ACCENT}>{initial ? 'Save' : 'Add Item'}</button>
      </div>
    </div>
  );
}

//  Detail Panel 
function DetailPanel({ item, onRestock, onEdit, onDelete }) {
  const days   = daysLeft(item);
  const status = getStatus(days);
  const cat    = CAT_MAP[item.category] || { icon: '📦', label: 'Other' };

  const expire = item.boughtDate && item.lifespanDays
    ? new Date(new Date(item.boughtDate).getTime() + item.lifespanDays * 86400000)
        .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: STATUS_COLOUR[status] + '22',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>{cat.icon}</div>
        <div>
          <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 400 }}>{item.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cat.label}</div>
        </div>
      </div>

      {/* Status badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: 20,
        background: STATUS_COLOUR[status] + '22',
        border: `0.5px solid ${STATUS_COLOUR[status]}44`,
        alignSelf: 'flex-start',
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOUR[status] }} />
        <span style={{ fontSize: 12, color: STATUS_COLOUR[status] }}>
          {status === 'red' ? 'Overdue for restock'
            : status === 'amber' ? `${days} day${days !== 1 ? 's' : ''} left`
            : days !== null ? `${days} days left`
            : 'No lifespan set'}
        </span>
      </div>

      {/* Info rows */}
      {[
        ['Bought',    item.boughtDate ? new Date(item.boughtDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''],
        ['Lifespan',  item.lifespanDays ? `${item.lifespanDays} days` : ''],
        ['Runs out',  expire],
        ['Price',     item.price ? `£${item.price.toFixed(2)}` : ''],
      ].map(([label, val]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '0.5px solid var(--card-border)', paddingBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
          <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{val}</span>
        </div>
      ))}

      {item.notes && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
          {item.notes}
        </div>
      )}

      {/* Actions */}
      <button onClick={onRestock} style={{
        ...BTN_ACCENT, width: '100%',
        background: '#4caf7d',
        padding: '10px 16px',
      }}>
        S Mark as Restocked
      </button>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onEdit} style={{ ...BTN_GHOST, flex: 1 }}>Edit</button>
        <button onClick={onDelete} style={{ ...BTN_GHOST, flex: 1, color: '#e55a5a' }}>Delete</button>
      </div>
    </div>
  );
}

//  Main Essentials Tab 
export default function Essentials() {
  const { items, add, update, remove } = useCollection('essentials', STORAGE_KEYS.ESSENTIALS);

  const [filter,    setFilter]    = useState('all');  // all | due_soon | stocked | category
  const [catFilter, setCatFilter] = useState(null);
  const [selected,  setSelected]  = useState(null);   // id of selected item
  const [mode,      setMode]      = useState('view'); // view | add | edit

  // Compute status for all items
  const withStatus = items.map(it => ({
    ...it,
    _days:   daysLeft(it),
    _status: getStatus(daysLeft(it)),
  }));

  // Apply filter
  const filtered = withStatus.filter(it => {
    if (filter === 'due_soon') return it._status === 'amber' || it._status === 'red';
    if (filter === 'stocked')  return it._status === 'green';
    if (filter === 'category' && catFilter) return it.category === catFilter;
    return true;
  }).sort((a, b) => (a._days ?? 9999) - (b._days ?? 9999));

  const selectedItem = withStatus.find(it => it.id === selected);

  function handleAdd(data) {
    add({ ...data, createdAt: new Date().toISOString() });
    setMode('view');
  }

  function handleUpdate(data) {
    update(selected, data);
    setMode('view');
  }

  function handleRestock(id) {
    const item = items.find(it => it.id === id);
    update(id, { boughtDate: todayISO() });
    // Restocking with a known price logs an expense in Finance (instant correspondence),
    // with an Undo that removes it if it was a mistake.
    if (item?.price) {
      const payload = {
        type: 'expense', amount: item.price, category: 'Essentials',
        description: `Restocked ${item.name}`, date: todayISO(),
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      insertRow('transactions', STORAGE_KEYS.TRANSACTIONS, payload).then(txnId => {
        window.dispatchEvent(new CustomEvent('valerie:toast', {
          detail: {
            message: `Logged $${item.price} ${item.name} restock to Finance`,
            type: 'success',
            undo: () => {
              deleteRow('transactions', STORAGE_KEYS.TRANSACTIONS, txnId);
              window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: 'Expense removed', type: 'info' } }));
            },
          },
        }));
      });
    }
  }

  function handleDelete(id) {
    remove(id);
    setSelected(null);
    setMode('view');
  }

  // Summary counts
  const redCount   = withStatus.filter(it => it._status === 'red').length;
  const amberCount = withStatus.filter(it => it._status === 'amber').length;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/*  Left  list  */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        borderRight: '0.5px solid var(--card-border)',
        overflow: 'hidden',
      }}>
        {/* Toolbar */}
        <div style={{
          padding: '14px 16px', borderBottom: '0.5px solid var(--card-border)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          {/* Status summary */}
          <div style={{ display: 'flex', gap: 8, flex: 1 }}>
            {redCount > 0 && (
              <span style={{ fontSize: 11, color: '#e55a5a', background: '#e55a5a22',
                padding: '3px 8px', borderRadius: 20 }}>
                {redCount} due now
              </span>
            )}
            {amberCount > 0 && (
              <span style={{ fontSize: 11, color: '#f4a642', background: '#f4a64222',
                padding: '3px 8px', borderRadius: 20 }}>
                {amberCount} running low
              </span>
            )}
            {redCount === 0 && amberCount === 0 && items.length > 0 && (
              <span style={{ fontSize: 11, color: '#4caf7d' }}>All stocked S</span>
            )}
          </div>
          <button onClick={() => { setMode('add'); setSelected(null); }} style={BTN_ACCENT}>
            + Add
          </button>
        </div>

        {/* Filter pills */}
        <div style={{
          padding: '10px 16px', borderBottom: '0.5px solid var(--card-border)',
          display: 'flex', gap: 6, flexWrap: 'wrap',
        }}>
          {[['all','All'],['due_soon','Due Soon'],['stocked','Stocked']].map(([v,l]) => (
            <button key={v} onClick={() => { setFilter(v); setCatFilter(null); }} style={{
              padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
              background: filter === v && !catFilter ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: filter === v && !catFilter ? '#fff' : 'var(--text-secondary)',
            }}>{l}</button>
          ))}
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => { setFilter('category'); setCatFilter(c.id); }} style={{
              padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
              background: filter === 'category' && catFilter === c.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: filter === 'category' && catFilter === c.id ? '#fff' : 'var(--text-secondary)',
            }}>{c.icon} {c.label}</button>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {items.length === 0
                  ? 'No essentials tracked yet. Add your first item.'
                  : 'No items match this filter.'}
              </div>
            </div>
          ) : filtered.map(it => {
            const isSelected = it.id === selected;
            const sc = STATUS_COLOUR[it._status];
            const cat = CAT_MAP[it.category] || { icon: '📦' };

            return (
              <div key={it.id}
                onClick={() => { setSelected(it.id); setMode('view'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 16px',
                  borderBottom: '0.5px solid var(--card-border)',
                  background: isSelected ? 'var(--active-bg)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  borderLeft: `3px solid ${sc}`,
                }}
              >
                {/* Status dot */}
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc,
                  flexShrink: 0, boxShadow: `0 0 5px ${sc}66` }} />

                <div style={{ fontSize: 16, flexShrink: 0 }}>{cat.icon}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {it.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {CAT_MAP[it.category]?.label || 'Other'}
                    {it._days !== null && ` · ${it._days <= 0 ? 'Overdue' : `${it._days}d left`}`}
                  </div>
                </div>

                <div style={{
                  fontSize: 10, fontWeight: 500, color: sc,
                  padding: '2px 7px', borderRadius: 20,
                  background: sc + '18',
                  flexShrink: 0,
                }}>
                  {STATUS_LABEL[it._status]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/*  Right  detail / form panel  */}
      <div style={{
        width: 260, flexShrink: 0,
        padding: '20px 16px',
        overflowY: 'auto',
        background: 'var(--bg-panel)',
      }}>
        {mode === 'add' && (
          <ItemForm
            onSave={handleAdd}
            onCancel={() => setMode('view')}
          />
        )}
        {mode === 'edit' && selectedItem && (
          <ItemForm
            initial={selectedItem}
            onSave={handleUpdate}
            onCancel={() => setMode('view')}
          />
        )}
        {mode === 'view' && selectedItem && (
          <DetailPanel
            item={selectedItem}
            onRestock={() => handleRestock(selectedItem.id)}
            onEdit={() => setMode('edit')}
            onDelete={() => handleDelete(selectedItem.id)}
          />
        )}
        {mode === 'view' && !selectedItem && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>✅</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Select an item to view details
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

