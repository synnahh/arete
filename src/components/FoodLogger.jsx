// FoodLogger — the add-food flow. One search box finds your favourites, what you eat
// often, your own foods and meals, and the food database together. A + on a row logs
// it at the amount you used last time in one tap; tapping the row lets you change the
// amount first. Scan a barcode or add a food by hand from the same place.
// Rules: src/domain/foodLogger.js. Used in a sheet on the phone and a dialog on desktop.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument } from '../supabase/useDocument.js';
import { useFoodLibrary } from '../hooks/useFoodLibrary.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { searchFoods, lookupBarcode, startBarcodeScan, canScanBarcodes, decodeBarcodeFromFile } from '../utils/openFoodFacts.js';
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
  const [scanMsg, setScanMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loggedCount, setLoggedCount] = useState(0);
  const videoRef = useRef(null);
  const stopRef = useRef(null);
  const inputRef = useRef(null);
  const photoRef = useRef(null);

  const owned = useMemo(() => localFoods({
    favourites: lib.favourites,
    recents: recentFoods(nutritionLogs, { today, limit: 40 }),
    customFoods: lib.customFoods,
    savedMeals,
  }), [lib.favourites, lib.customFoods, nutritionLogs, savedMeals, today]);

  const local = useMemo(() => searchLocal(query, owned, query.trim() ? 8 : 10), [query, owned]);
  const rows = useMemo(() => (query.trim() ? mergeResults(local, remote) : local), [query, local, remote]);

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

  useEffect(() => () => stopRef.current?.(), []);
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

  const startScan = () => {
    setScanMsg(''); setStep('scan');
    // wait a tick so the <video> exists
    setTimeout(() => {
      stopRef.current = startBarcodeScan(videoRef.current, {
        onDetect: async (code) => {
          stopRef.current = null;
          try { pick(remoteFood(await lookupBarcode(code))); }
          catch { setScanMsg(`No product found for ${code}. Try searching by name, or add it by hand.`); }
        },
        onError: (e) => setScanMsg(e?.name === 'NotAllowedError' ? 'The camera is blocked for this app. Use Take a photo below, or type the name.' : (e?.message || 'Could not open the camera. Use Take a photo below, or type the name.')),
      });
    }, 50);
  };
  const stopScan = () => { stopRef.current?.(); stopRef.current = null; };

  // A photo of the barcode from the phone's own camera sheet: no web camera permission.
  const onBarcodePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    stopScan();
    setScanMsg('Reading the barcode…');
    try { pick(remoteFood(await lookupBarcode(await decodeBarcodeFromFile(file)))); }
    catch { setScanMsg('Could not read a barcode from that photo, or the product is not in the database. Try again closer, or search by name.'); }
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
  if (step === 'scan') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => { stopScan(); setStep('search'); }} aria-label="Back to search" style={{ ...ghost, minHeight: 44, minWidth: 44, padding: 0 }}>‹</button>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Scan a barcode</div>
        </div>
        <div style={{ borderRadius: 14, overflow: 'hidden', background: '#000', position: 'relative' }}>
          <video ref={videoRef} muted playsInline aria-label="Camera preview" style={{ width: '100%', height: 260, objectFit: 'cover', display: 'block' }} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: '32% 12%', border: '2px solid rgba(255,255,255,0.7)', borderRadius: 12 }} />
        </div>
        <div role="status" style={{ fontSize: 13.5, color: scanMsg ? '#e8a13a' : 'var(--text-secondary)', textAlign: 'center' }}>{scanMsg || 'Hold the barcode inside the box, steady and well lit.'}</div>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" onChange={onBarcodePhoto} aria-label="Barcode photo" style={{ display: 'none' }} />
        <button type="button" onClick={() => photoRef.current?.click()} style={{ ...ghost, minHeight: 44, fontSize: 14 }}>Take a photo instead (no camera permission)</button>
      </div>
    );
  }

  // ── Search (the front door) ──
  const empty = query.trim().length > 0 && !searching && rows.length === 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input ref={inputRef} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search foods, or type what you ate" aria-label="Search foods" style={{ ...input, flex: 1 }} />
        {canScanBarcodes() && <button type="button" onClick={startScan} aria-label="Scan a barcode" style={{ ...ghost, minWidth: 52, padding: 0 }}>
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

      {searching && <div role="status" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Searching the food database…</div>}
      {offline && <div role="status" style={{ fontSize: 13, color: '#e8a13a' }}>Could not reach the food database. Your own foods still work.</div>}
      {empty && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Nothing found for "{query.trim()}".</div>}

      <button type="button" onClick={() => { setQuick(q => ({ ...q, name: query.trim() })); setStep('quick'); }} style={{ ...ghost, minHeight: 44, fontSize: 14 }}>
        {query.trim() ? `Add "${query.trim()}" by hand` : 'Add by hand'}
      </button>
    </div>
  );
}
