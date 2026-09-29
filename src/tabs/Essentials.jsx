//  Plan · Supplies  the Ahead engine: every supply's run-out and reorder
//  date from its pack size and how you use it, learned from real restocks,
//  plus this week's cart (due supplies + the meal plan's shopping list).
//  Logic: src/domain/ahead.js. Nothing is ever bought from here: the cart
//  opens in the store for you to review and check out.
import { useMemo, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument }   from '../supabase/useDocument.js';
import { STORAGE_KEYS }  from '../utils/storage.js';
import { insertRow, deleteRow } from '../utils/quickWrite.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { readCurrency, formatMoney, currencySymbol } from '../utils/currency.js';
import { forecast, restock, dueItems, cartLinks, shoppingList, parseAsin, applyUsage, expiry, DEFAULT_LEAD_DAYS } from '../domain/ahead.js';

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

// Which Amazon store to open, from the app currency.
const STORE_BY_CURRENCY = { AUD: 'amazon.com.au', NZD: 'amazon.com.au', GBP: 'amazon.co.uk', USD: 'amazon.com', CAD: 'amazon.ca', EUR: 'amazon.de' };

//  Status
const STATUS_COLOUR = { out: '#e55a5a', order: '#e55a5a', soon: '#f4a642', ok: '#4caf7d', unknown: 'var(--text-secondary)' };
const STATUS_LABEL  = { out: 'Out', order: 'Order now', soon: 'Soon', ok: 'Stocked', unknown: 'Set usage' };
const SOURCE_LABEL  = { schedule: 'your usage schedule', learned: 'your real restocks', usage: 'what your food log says is left', manual: 'the days you entered' };

const todayISO = () => toLocalDateKey(new Date());
const fmtDate = (key) => key ? new Date(`${key}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—';
const whenText = (f) => {
  if (f.status === 'unknown') return 'Add pack size and usage';
  if (f.status === 'out') return 'Run out';
  if (f.status === 'order') return `Order now · runs out ${fmtDate(f.runOut)}`;
  return `${f.daysLeft} days left · order by ${fmtDate(f.reorderBy)}`;
};

//  Shared styles
const INPUT = {
  width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8,
  background: 'var(--input-bg)', border: '0.5px solid var(--input-border)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
};
const BTN_ACCENT = {
  padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'var(--tab-accent)', color: 'var(--on-tab-accent)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
};
const BTN_GHOST = {
  padding: '7px 13px', borderRadius: 8, border: '0.5px solid var(--card-border)', cursor: 'pointer',
  background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'inherit',
};
const LABEL = { fontSize: 10.5, color: 'var(--text-secondary)', marginBottom: 3, letterSpacing: '0.04em' };

function Field({ label, children, flex = 1 }) {
  return (
    <label style={{ flex, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <span style={LABEL}>{label}</span>
      {children}
    </label>
  );
}

//  Add / Edit form
function ItemForm({ initial, onSave, onCancel, currency }) {
  const [name,    setName]    = useState(initial?.name ?? '');
  const [cat,     setCat]     = useState(initial?.category ?? 'grooming');
  const [bought,  setBought]  = useState(initial?.boughtDate ?? todayISO());
  const [packQty, setPackQty] = useState(initial?.packQty ?? '');
  const [unit,    setUnit]    = useState(initial?.unit ?? '');
  const [dose,    setDose]    = useState(initial?.dosePerUse ?? '');
  const [uses,    setUses]    = useState(initial?.usesPerDay ?? '');
  const [packs,   setPacks]   = useState(initial?.packsOnHand ?? 1);
  const [lead,    setLead]    = useState(initial?.leadDays ?? '');
  const [days,    setDays]    = useState(initial?.lifespanDays ?? '');
  const [link,    setLink]    = useState(initial?.storeUrl ?? initial?.asin ?? '');
  const [price,   setPrice]   = useState(initial?.price ?? '');
  const [notes,   setNotes]   = useState(initial?.notes ?? '');
  const [pao,     setPao]     = useState(initial?.paoMonths ?? '');
  const [subtract, setSubtract] = useState(initial?.autoSubtract !== false);

  const num = (v) => (v === '' || v == null ? null : Number(v));
  const draft = {
    boughtDate: bought, packQty: num(packQty), dosePerUse: num(dose), usesPerDay: num(uses),
    packsOnHand: num(packs) || 1, leadDays: num(lead), lifespanDays: num(days),
    learnedDaysPerPack: initial?.learnedDaysPerPack, learnCycles: initial?.learnCycles,
  };
  // Food-log usage (derived) so the preview matches the list; never saved with the form.
  const preview = forecast({ ...draft, usageDaysLeft: initial?.usageDaysLeft, usageDaysPerPack: initial?.usageDaysPerPack }, todayISO());

  function handleSave() {
    if (!name.trim()) return;
    const asin = parseAsin(link);
    onSave({
      name: name.trim(), category: cat, ...draft,
      unit: unit.trim() || null,
      asin: asin || null,
      storeUrl: !asin && link.trim().startsWith('http') ? link.trim() : null,
      price: num(price),
      notes: notes.trim() || null,
      paoMonths: num(pao) >= 1 ? num(pao) : null,
      autoSubtract: cat === 'kitchen' ? subtract : null,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>{initial ? 'EDIT SUPPLY' : 'NEW SUPPLY'}</div>
      <input aria-label="Name" placeholder="e.g. Niacinamide serum" value={name} onChange={e => setName(e.target.value)} style={INPUT} autoFocus />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {CATEGORIES.map(c => (
          <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)} style={{
            padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
            border: `0.5px solid ${cat === c.id ? 'var(--tab-accent)' : 'transparent'}`,
            background: cat === c.id ? 'color-mix(in srgb, var(--tab-accent) 16%, transparent)' : 'var(--hover-bg)',
            color: cat === c.id ? 'var(--tab-accent)' : 'var(--text-secondary)',
          }}>{c.icon} {c.label}</button>
        ))}
      </div>

      <div style={{ ...LABEL, marginTop: 6 }}>HOW YOU USE IT</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Pack size"><input inputMode="decimal" placeholder="50" value={packQty} onChange={e => setPackQty(e.target.value)} style={INPUT} /></Field>
        <Field label="Unit"><input placeholder="ml" value={unit} onChange={e => setUnit(e.target.value)} style={INPUT} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Per use"><input inputMode="decimal" placeholder="1" value={dose} onChange={e => setDose(e.target.value)} style={INPUT} /></Field>
        <Field label="Uses / day"><input inputMode="decimal" placeholder="2" value={uses} onChange={e => setUses(e.target.value)} style={INPUT} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Opened / bought"><input type="date" value={bought} onChange={e => setBought(e.target.value)} style={INPUT} /></Field>
        <Field label="Packs on hand"><input inputMode="numeric" value={packs} onChange={e => setPacks(e.target.value)} style={INPUT} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label={`Delivery days (default ${DEFAULT_LEAD_DAYS})`}><input inputMode="numeric" placeholder={String(DEFAULT_LEAD_DAYS)} value={lead} onChange={e => setLead(e.target.value)} style={INPUT} /></Field>
        <Field label="Or: lasts (days)"><input inputMode="numeric" placeholder="—" value={days} onChange={e => setDays(e.target.value)} style={INPUT} /></Field>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        {preview.status === 'unknown'
          ? 'Add pack size, amount per use and uses a day (or how many days it lasts) to predict the run-out date.'
          : <>Lasts <strong className="val-num">{preview.daysPerPack}</strong> days a pack · runs out <strong>{fmtDate(preview.runOut)}</strong> · order by <strong>{fmtDate(preview.reorderBy)}</strong></>}
      </div>

      {cat === 'kitchen' && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, cursor: 'pointer' }}>
          <input type="checkbox" checked={subtract} onChange={e => setSubtract(e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--tab-accent)' }} />
          <span>Subtract food I log. Entries in g or ml whose name contains “{name.trim() || 'this supply'}” use up this pack (needs a pack size in g, kg, ml or l).</span>
        </label>
      )}

      <Field label="Use within (months after opening, the jar symbol)"><input inputMode="numeric" placeholder="e.g. 6" value={pao} onChange={e => setPao(e.target.value)} style={INPUT} /></Field>

      <div style={{ ...LABEL, marginTop: 6 }}>BUYING</div>
      <Field label="Amazon link or ASIN (optional)"><input placeholder="https://www.amazon.com.au/…/dp/B0…" value={link} onChange={e => setLink(e.target.value)} style={INPUT} /></Field>
      <Field label={`Price (${currencySymbol(currency)})`}><input inputMode="decimal" placeholder="Optional" value={price} onChange={e => setPrice(e.target.value)} style={INPUT} /></Field>
      <textarea aria-label="Notes" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...INPUT, resize: 'vertical' }} />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" onClick={onCancel} style={BTN_GHOST}>Cancel</button>
        <button type="button" onClick={handleSave} style={BTN_ACCENT}>{initial ? 'Save' : 'Add supply'}</button>
      </div>
    </div>
  );
}

//  Detail panel
function DetailPanel({ item, f, currency, onRestock, onEdit, onDelete }) {
  const [packs, setPacks] = useState(1);
  const cat = CAT_MAP[item.category] || CAT_MAP.other;
  const sc  = STATUS_COLOUR[f.status];
  const rows = [
    ['Runs out',  f.runOut ? fmtDate(f.runOut) : '—'],
    ['Order by',  f.reorderBy ? fmtDate(f.reorderBy) : '—'],
    ['Per pack',  f.daysPerPack ? `${f.daysPerPack} days` : '—'],
    ['Pack',      item.packQty ? `${item.packQty} ${item.unit || ''} · ${item.dosePerUse ?? '?'} × ${item.usesPerDay ?? '?'} a day` : '—'],
    ...(item.stockLeft != null ? [['Left (from food log)', `≈ ${item.stockLeft} ${item.stockUnit || ''}`]] : []),
    ['On hand',   `${item.packsOnHand || 1} pack${(item.packsOnHand || 1) > 1 ? 's' : ''}`],
    ['Opened',    fmtDate(item.boughtDate)],
    ...(expiry(item, todayISO()).useBy ? [['Use by', fmtDate(expiry(item, todayISO()).useBy)]] : []),
    ['Price',     item.price ? formatMoney(item.price, currency) : '—'],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--hover-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{cat.icon}</div>
        <div>
          <div style={{ fontSize: 15, color: 'var(--text-primary)' }}>{item.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{cat.label}</div>
        </div>
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, alignSelf: 'flex-start', border: `0.5px solid ${sc}` }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc }} />
        <span style={{ fontSize: 12, color: sc }}>{whenText(f)}</span>
      </div>

      {f.source && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          Based on {SOURCE_LABEL[f.source]}{item.learnCycles ? ` · ${item.learnCycles} restock${item.learnCycles > 1 ? 's' : ''} learned` : ''}.
        </div>
      )}

      {rows.map(([l, v]) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderBottom: '0.5px solid var(--card-border)', paddingBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l}</span>
          <span className="val-num" style={{ fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}>{v}</span>
        </div>
      ))}

      {item.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>{item.notes}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Bought</span>
        {[1, 2, 3].map(n => (
          <button key={n} type="button" aria-pressed={packs === n} onClick={() => setPacks(n)} style={{
            ...BTN_GHOST, padding: '4px 10px',
            borderColor: packs === n ? 'var(--tab-accent)' : 'var(--card-border)', color: packs === n ? 'var(--tab-accent)' : 'var(--text-secondary)',
          }}>{n}</button>
        ))}
      </div>
      <button type="button" onClick={() => onRestock(packs)} style={{ ...BTN_ACCENT, width: '100%', padding: '10px 16px' }}>Mark as restocked</button>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onEdit} style={{ ...BTN_GHOST, flex: 1 }}>Edit</button>
        <button type="button" onClick={onDelete} style={{ ...BTN_GHOST, flex: 1, color: '#e55a5a' }}>Delete</button>
      </div>
    </div>
  );
}

//  This week's cart
function WeekCart({ due, groceries, store }) {
  const [open, setOpen] = useState(true);
  if (!due.length && !groceries.length) return null;
  const links = cartLinks(due.map(({ item }) => ({ name: item.name, asin: item.asin, storeUrl: item.storeUrl, qty: 1 })), { domain: store });

  return (
    <section aria-label="This week's cart" style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--tab-accent)' }}>This week's cart</span>
        <span className="val-num" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{due.length} supplies · {groceries.length} groceries</span>
      </button>
      {open && (
        <>
          {due.map(({ item, f }) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
              <span style={{ color: 'var(--text-primary)' }}>{item.name}</span>
              <span className="val-num" style={{ color: STATUS_COLOUR[f.status], whiteSpace: 'nowrap' }}>{f.status === 'out' ? 'out' : f.daysToReorder <= 0 ? 'order now' : `order by ${fmtDate(f.reorderBy)}`}</span>
            </div>
          ))}
          {groceries.length > 0 && (
            <details>
              <summary style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Meal plan groceries ({groceries.length})</summary>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {groceries.map(g => (
                  <li key={`${g.name}|${g.unit}`} style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {g.name} <span className="val-num" style={{ color: 'var(--text-secondary)' }}>{g.qty ? `${g.qty}${g.unit ? ` ${g.unit}` : ''}` : ''}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {links.cart && (
              <a href={links.cart} target="_blank" rel="noopener noreferrer" style={{ ...BTN_ACCENT, textDecoration: 'none' }}>Open Amazon cart</a>
            )}
            {links.searches.map(s => (
              <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" style={{ ...BTN_GHOST, textDecoration: 'none' }}>Find {s.name}</a>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Opens the store for you to review. Nothing is bought until you check out.</div>
        </>
      )}
    </section>
  );
}

//  Main Supplies tab
export default function Essentials() {
  const { items, add, update, remove } = useCollection('essentials', STORAGE_KEYS.ESSENTIALS);
  const { items: nutritionLogs = [] } = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);
  const { data: mealPlanDoc } = useDocument('meal_plan', STORAGE_KEYS.MEAL_PLANS, null);
  const currency = readCurrency();
  const store = STORE_BY_CURRENCY[currency] ?? 'amazon.com.au';
  const today = todayISO();

  const [filter,    setFilter]    = useState('all');  // all | due | stocked | category
  const [catFilter, setCatFilter] = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [mode,      setMode]      = useState('view'); // view | add | edit

  // Kitchen stock follows the food log (derived on read, never saved).
  const live = useMemo(() => applyUsage(items, nutritionLogs, today), [items, nutritionLogs, today]);
  const withF = useMemo(() => live.map(it => ({ ...it, _f: forecast(it, today), _e: expiry(it, today) })), [live, today]);
  const due = useMemo(() => dueItems(live, today), [live, today]);
  const groceries = useMemo(
    () => shoppingList(mealPlanDoc?.plan, live.filter(i => i.category === 'kitchen'), today),
    [mealPlanDoc, live, today]
  );

  const order = { out: 0, order: 1, soon: 2, ok: 3, unknown: 4 };
  const filtered = withF.filter(it => {
    if (filter === 'due') return ['out', 'order', 'soon'].includes(it._f.status);
    if (filter === 'stocked') return it._f.status === 'ok';
    if (filter === 'category' && catFilter) return it.category === catFilter;
    return true;
  }).sort((a, b) => (order[a._f.status] - order[b._f.status]) || ((a._f.daysToReorder ?? 9999) - (b._f.daysToReorder ?? 9999)));

  const selectedItem = withF.find(it => it.id === selected);

  function handleAdd(data) { add({ ...data, createdAt: new Date().toISOString() }); setMode('view'); }
  function handleUpdate(data) { update(selected, data); setMode('view'); }

  function handleRestock(id, packs) {
    const item = items.find(it => it.id === id);
    if (!item) return;
    update(id, restock(item, today, packs));
    // Restocking with a known price logs an expense in Finance, with Undo.
    if (item.price) {
      const amount = +(item.price * packs).toFixed(2);
      const payload = {
        type: 'expense', amount, category: 'Essentials',
        description: `Restocked ${item.name}${packs > 1 ? ` ×${packs}` : ''}`, date: today,
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      insertRow('transactions', STORAGE_KEYS.TRANSACTIONS, payload).then(txnId => {
        window.dispatchEvent(new CustomEvent('valerie:toast', {
          detail: {
            message: `Logged ${formatMoney(amount, currency)} ${item.name} restock to Finance`,
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

  function handleDelete(id) { remove(id); setSelected(null); setMode('view'); }

  const dueCount  = withF.filter(it => ['out', 'order'].includes(it._f.status)).length;
  const soonCount = withF.filter(it => it._f.status === 'soon').length;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '0.5px solid var(--card-border)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flex: 1 }}>
            {dueCount > 0 && <span style={{ fontSize: 11.5, color: STATUS_COLOUR.order, border: `0.5px solid ${STATUS_COLOUR.order}`, padding: '3px 9px', borderRadius: 20 }}>{dueCount} to order</span>}
            {soonCount > 0 && <span style={{ fontSize: 11.5, color: STATUS_COLOUR.soon, border: `0.5px solid ${STATUS_COLOUR.soon}`, padding: '3px 9px', borderRadius: 20 }}>{soonCount} soon</span>}
            {dueCount === 0 && soonCount === 0 && items.length > 0 && <span style={{ fontSize: 11.5, color: STATUS_COLOUR.ok }}>All stocked</span>}
          </div>
          <button type="button" onClick={() => { setMode('add'); setSelected(null); }} style={BTN_ACCENT}>+ Add</button>
        </div>

        <WeekCart due={due} groceries={groceries} store={store} />

        <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--card-border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['all', 'All'], ['due', 'Due soon'], ['stocked', 'Stocked']].map(([v, l]) => {
            const on = filter === v && !catFilter;
            return (
              <button key={v} type="button" aria-pressed={on} onClick={() => { setFilter(v); setCatFilter(null); }} style={{
                padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit',
                border: `0.5px solid ${on ? 'var(--tab-accent)' : 'var(--card-border)'}`, background: 'transparent',
                color: on ? 'var(--tab-accent)' : 'var(--text-secondary)',
              }}>{l}</button>
            );
          })}
          {CATEGORIES.map(c => {
            const on = filter === 'category' && catFilter === c.id;
            return (
              <button key={c.id} type="button" aria-pressed={on} onClick={() => { setFilter('category'); setCatFilter(c.id); }} style={{
                padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit',
                border: `0.5px solid ${on ? 'var(--tab-accent)' : 'var(--card-border)'}`, background: 'transparent',
                color: on ? 'var(--tab-accent)' : 'var(--text-secondary)',
              }}>{c.icon} {c.label}</button>
            );
          })}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
              {items.length === 0
                ? 'No supplies yet. Add one with its pack size and how much you use, and Arete will tell you when to reorder.'
                : 'No supplies match this filter.'}
            </div>
          ) : filtered.map(it => {
            const sc = STATUS_COLOUR[it._f.status];
            const cat = CAT_MAP[it.category] || CAT_MAP.other;
            return (
              <button key={it.id} type="button" onClick={() => { setSelected(it.id); setMode('view'); }}
                aria-current={it.id === selected ? 'true' : undefined}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', textAlign: 'left',
                  border: 'none', borderBottom: '0.5px solid var(--card-border)', cursor: 'pointer', fontFamily: 'inherit',
                  background: it.id === selected ? 'var(--active-bg)' : 'transparent',
                }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: sc, flexShrink: 0 }} />
                <span aria-hidden="true" style={{ fontSize: 16, flexShrink: 0 }}>{cat.icon}</span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{whenText(it._f)}{it.stockLeft != null ? ` · ≈ ${it.stockLeft} ${it.stockUnit || ''} left` : ''}{it._e?.status === 'expired' ? ' · past use-by' : it._e?.status === 'soon' ? ` · use within ${it._e.daysLeft} days` : ''}</span>
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: sc, flexShrink: 0 }}>{STATUS_LABEL[it._f.status]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ width: 280, flexShrink: 0, padding: '20px 16px', overflowY: 'auto', background: 'var(--bg-panel)' }}>
        {mode === 'add' && <ItemForm currency={currency} onSave={handleAdd} onCancel={() => setMode('view')} />}
        {mode === 'edit' && selectedItem && <ItemForm currency={currency} initial={selectedItem} onSave={handleUpdate} onCancel={() => setMode('view')} />}
        {mode === 'view' && selectedItem && (
          <DetailPanel key={selectedItem.id} item={selectedItem} f={selectedItem._f} currency={currency}
            onRestock={(packs) => handleRestock(selectedItem.id, packs)}
            onEdit={() => setMode('edit')} onDelete={() => handleDelete(selectedItem.id)} />
        )}
        {mode === 'view' && !selectedItem && (
          <div style={{ textAlign: 'center', paddingTop: 40, fontSize: 12, color: 'var(--text-secondary)' }}>Select a supply to see its forecast</div>
        )}
      </div>
    </div>
  );
}
