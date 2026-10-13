// FoodLogger — the add-food flow. One search box finds your favourites, what you eat
// often, your own foods and meals, and the food database together. A + on a row logs
// it at the amount you used last time in one tap; tapping the row lets you change the
// amount first. Scan a barcode or add a food by hand from the same place.
// Rules: src/domain/foodLogger.js. Used in a sheet on the phone and a dialog on desktop.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument } from '../supabase/useDocument.js';
import { useFoodLibrary } from '../hooks/useFoodLibrary.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { useFoodDb } from '../hooks/useFoodDb.js';
import { portionChips } from '../domain/foodDb.js';
import { searchFoods, lookupBarcode, canScanBarcodes } from '../utils/openFoodFacts.js';
import BarcodeScanner from './BarcodeScanner.jsx';
import { recentFoods, SECTIONS } from '../domain/foods.js';
import {
  localFoods, remoteFood, searchLocal, mergeResults, macrosFor, amountChips, startAmount, entryFor, quickFoodEntry, remember, defaultSection,
} from '../domain/foodLogger.js';
import StarButton from './StarButton.jsx';

const KIND_TAG = { favourite: '★', custom: 'Mine', meal: 'Meal', recent: '', db: '' };
const input = { width: '100%', boxSizing: 'border-box', minHeight: 46, borderRadius: 12, padding: '0 14px', border: '0.5px solid var(--card-border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 16 };
const chip = (on) => ({ minHeight: 38, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: on ? 700 : 500, border: `0.5px solid ${on ? 'var(--accent)' : 'var(--card-border)'}`, background: on ? 'var(--active-bg)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-secondary)' });
const primary = { minHeight: 48, borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--bg-base)', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' };
const ghost = { minHeight: 48, borderRadius: 12, border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' };
const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

export default function FoodLogger({ onLog, onClose }) {
  const today = toLocalDateKey(new Date());
  const { items: nutritionLogs = [] } = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);
  const { items: savedMeals = [] } = useCollection('saved_meals', STORAGE_KEYS.SAVED_MEALS);
  const lib = useFoodLibrary();
  const memoryDoc = useDocument('food_portions', 'valerie_food_portions', { map: {} });
  const memory = memoryDoc.data?.map ?? {};

  const [step, setStep] = useState('search');          // search | amount | quick | scan
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState([]);
  const [searching, setSearching] = useState(false);
  const [offline, setOffline] = useState(false);
  const [food, setFood] = useState(null);
  const [amount, setAmount] = useState('');
  const [section, setSection] = useState(() => defaultSection());
  const [quick, setQuick] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  const [busy, setBusy] = useState(false);
  const [loggedCount, setLoggedCount] = useState(0);
  const inputRef = useRef(null);

  const owned = useMemo(() => localFoods({
    favourites: lib.favourites,
    recents: recentFoods(nutritionLogs, { today, limit: 40 }),
    customFoods: lib.customFoods,
    savedMeals,
  }), [lib.favourites, lib.customFoods, nutritionLogs, savedMeals, today]);

  // The box updates at once; the results list catches up a moment later and never blocks a keystroke
  // (searching ~19,000 foods and redrawing rows on every key made typing laggy on a phone).
  const dq = useDeferredValue(query);
  const local = useMemo(() => searchLocal(dq, owned, dq.trim() ? 8 : 10), [dq, owned]);
  const db = useFoodDb(step === 'search');
  // The bundled database answers at once, with no network: branded products first, then everyday foods.
  const bundled = useMemo(() => (dq.trim().length >= 2 ? db.search(dq, 10).map(f => ({ ...f })) : []), [db, dq]);
  const rows = useMemo(() => (dq.trim() ? mergeResults(mergeResults(local, bundled, 16), remote, 18) : local), [dq, local, bundled, remote]);

  // Database search, a moment after you stop typing. Your own foods show instantly.
  useEffect(() => {
    const q = query.trim();
    setOffline(false);
    if (q.length < 2) { setRemote([]); setSearching(false); return undefined; }
    setSearching(true);
    let alive = true;
    const t = setTimeout(async () => {
      try { const r = await searchFoods(q); if (alive) setRemote(r.map(remoteFood)); }
      catch { if (alive) { setRemote([]); setOffline(true); } }
      finally { if (alive) setSearching(false); }
    }, 380);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  useEffect(() => { if (step === 'search') inputRef.current?.focus(); }, [step]);

  const pick = (f) => { setFood(f); setAmount(String(startAmount(f, memory))); setStep('amount'); };

  const save = async (entry, f, amt, again) => {
    if (!entry || busy) return;
    setBusy(true);
    try {
      const ok = await onLog(entry);
      if (ok === false) return;
      if (f) memoryDoc.save({ map: remember(memory, f, amt) });
      setLoggedCount(n => n + 1);
      if (again) { setFood(null); setQuery(''); setRemote([]); setStep('search'); }
      else onClose();
    } finally { setBusy(false); }
  };

  const quickLog = (f) => save(entryFor(f, startAmount(f, memory), { section }), f, startAmount(f, memory), true);

  // The scanner is its own full-screen view; a found product goes straight to the amount step.
  const scanCode = async (code) => {
    try { pick(remoteFood(await lookupBarcode(code))); }
    catch { return `No product found for ${code}. Try another angle, type the number, or search by name.`; }
    return undefined;
  };

  const amt = parseFloat(amount);
  const macros = food && amt > 0 ? macrosFor(food, amt) : null;
  const unitLabel = food ? (food.amountKind === 'grams' ? 'g' : food.unit === 'serving' ? (amt === 1 ? 'serving' : 'servings') : `× ${food.unit}`) : '';

  // ── Amount step ──
  if (step === 'amount' && food) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => setStep('search')} aria-label="Back to search" style={{ ...ghost, minHeight: 44, minWidth: 44, padding: 0 }}>‹</button>
          <div style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>{food.name}</div>
          {macros && <StarButton on={lib.isFav(food.name)} name={food.name} size={44} onClick={() => lib.toggleFav({ ...entryFor(food, amt, { section }) })} />}
        </div>

        <div style={{ textAlign: 'center', padding: '4px 0' }}>
          <div className="val-num" style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, color: 'var(--text-primary)' }}>{macros ? macros.calories : '–'}<span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}> kcal</span></div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8, fontSize: 14 }}>
            <span style={{ color: '#e879a0' }}>P {macros ? fmt(macros.protein) : '–'}g</span>
            <span style={{ color: '#a78bfa' }}>C {macros ? fmt(macros.carbs) : '–'}g</span>
            <span style={{ color: '#4caf7d' }}>F {macros ? fmt(macros.fat) : '–'}g</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="number" inputMode="decimal" min="0" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Amount" style={{ ...input, flex: 1, fontSize: 20, fontWeight: 700, textAlign: 'center' }} />
          <span style={{ minWidth: 70, fontSize: 15, color: 'var(--text-secondary)' }}>{unitLabel}</span>
        </div>
        {portionChips(food).length > 0 && (
          <div role="group" aria-label="Portions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {portionChips(food).map(p => (
              <button key={p.label} type="button" aria-pressed={amt === p.grams} onClick={() => setAmount(String(p.grams))} style={chip(amt === p.grams)}>{p.label} · {fmt(p.grams)} g</button>
            ))}
          </div>
        )}
        <div role="group" aria-label="Quick amounts" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {amountChips(food, memory[food.name.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()]).map(c => (
            <button key={c} type="button" aria-pressed={amt === c} onClick={() => setAmount(String(c))} style={chip(amt === c)}>{fmt(c)}{food.amountKind === 'grams' ? ' g' : ''}</button>
          ))}
        </div>

        <div role="group" aria-label="Meal" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SECTIONS.map(s => <button key={s.id} type="button" aria-pressed={section === s.id} onClick={() => setSection(s.id)} style={chip(section === s.id)}>{s.label}</button>)}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" disabled={!macros || busy} onClick={() => save(entryFor(food, amt, { section }), food, amt, true)} style={{ ...ghost, flex: 1, opacity: macros ? 1 : 0.5 }}>Log + add another</button>
          <button type="button" disabled={!macros || busy} onClick={() => save(entryFor(food, amt, { section }), food, amt, false)} style={{ ...primary, flex: 1, opacity: macros ? 1 : 0.5 }}>Log</button>
        </div>
      </div>
    );
  }

  // ── Quick add by hand ──
  if (step === 'quick') {
    const e = quickFoodEntry(quick, { section });
    const field = (k, ph, mode = 'decimal') => <input value={quick[k]} onChange={ev => setQuick(q => ({ ...q, [k]: ev.target.value }))} inputMode={mode} placeholder={ph} aria-label={ph} style={input} />;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => setStep('search')} aria-label="Back to search" style={{ ...ghost, minHeight: 44, minWidth: 44, padding: 0 }}>‹</button>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Add by hand</div>
        </div>
        <input value={quick.name} onChange={ev => setQuick(q => ({ ...q, name: ev.target.value }))} placeholder="Name (optional)" aria-label="Name" style={input} />
        {field('calories', 'Calories')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>{field('protein', 'Protein g')}{field('carbs', 'Carbs g')}{field('fat', 'Fat g')}</div>
        <div role="group" aria-label="Meal" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SECTIONS.map(s => <button key={s.id} type="button" aria-pressed={section === s.id} onClick={() => setSection(s.id)} style={chip(section === s.id)}>{s.label}</button>)}
        </div>
        <button type="button" disabled={!e || busy} onClick={() => save(e, null, 0, false)} style={{ ...primary, opacity: e ? 1 : 0.5 }}>Log</button>
      </div>
    );
  }

  // ── Scan ──
  if (step === 'scan') return <BarcodeScanner title="Scan Barcode" onClose={() => setStep('search')} onCode={scanCode} />;

  // ── Search (the front door) ──
  const empty = query.trim().length > 0 && !searching && db.ready && rows.length === 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input ref={inputRef} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search foods, or type what you ate" aria-label="Search foods" style={{ ...input, flex: 1 }} />
        {canScanBarcodes() && <button type="button" onClick={() => setStep('scan')} aria-label="Scan a barcode" style={{ ...ghost, minWidth: 52, padding: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v8M17 8v8" /></svg>
        </button>}
      </div>

      <div role="group" aria-label="Meal" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SECTIONS.map(s => <button key={s.id} type="button" aria-pressed={section === s.id} onClick={() => setSection(s.id)} style={chip(section === s.id)}>{s.label}</button>)}
      </div>

      {loggedCount > 0 && <div role="status" style={{ fontSize: 13, color: 'var(--accent)' }}>{loggedCount} logged. Add another, or close when you are done.</div>}
      {!query.trim() && rows.length > 0 && <div style={{ fontSize: 12, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Favourites and what you eat most. Tap + to log at your usual amount.</div>}
      {!query.trim() && rows.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Search a food, scan a barcode, or add one by hand. The foods you log most will show up here.</div>}

      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
        {rows.map(f => {
          const a = startAmount(f, memory);
          return (
            <li key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '0.5px solid var(--card-border)' }}>
              <button type="button" onClick={() => pick(f)} style={{ flex: 1, minWidth: 0, minHeight: 56, textAlign: 'left', background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer', fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ minWidth: 0, fontSize: 15, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  {KIND_TAG[f.kind] && <span style={{ fontSize: 11, color: 'var(--accent)' }}>{KIND_TAG[f.kind]}</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{f.kind === 'db' ? f.sub : `${Math.round(macrosFor(f, a).calories)} kcal · ${fmt(a)}${f.amountKind === 'grams' ? ' g' : f.unit === 'serving' ? '' : ` × ${f.unit}`}${f.kind === 'recent' && f.uses > 1 ? ` · eaten ${f.uses}×` : ''}`}</div>
              </button>
              <button type="button" disabled={busy} onClick={() => quickLog(f)} aria-label={`Log ${f.name} now, ${fmt(a)}${f.amountKind === 'grams' ? ' grams' : ''}`}
                style={{ width: 46, height: 46, borderRadius: 12, border: '0.5px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontSize: 24, lineHeight: 1, cursor: 'pointer' }}>+</button>
            </li>
          );
        })}
      </ul>

      {query.trim().length >= 2 && db.ready && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{db.count.toLocaleString('en-AU')} foods on this device{db.branded ? `, ${db.branded.toLocaleString('en-AU')} of them branded (Open Food Facts, ODbL)` : ''}{searching ? ' · checking online for more…' : ''}</div>}
      {searching && !db.ready && <div role="status" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Searching the food database…</div>}
      {offline && bundled.length === 0 && <div role="status" style={{ fontSize: 13, color: '#e8a13a' }}>Could not reach the food database. Your own foods still work.</div>}
      {empty && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Nothing found for "{query.trim()}".</div>}

      <button type="button" onClick={() => { setQuick(q => ({ ...q, name: query.trim() })); setStep('quick'); }} style={{ ...ghost, minHeight: 44, fontSize: 14 }}>
        {query.trim() ? `Add "${query.trim()}" by hand` : 'Add by hand'}
      </button>
    </div>
  );
}
