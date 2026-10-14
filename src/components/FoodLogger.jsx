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
import { useFoodDb, barcodeFood } from '../hooks/useFoodDb.js';
import { searchFoods, lookupBarcode, canScanBarcodes } from '../utils/openFoodFacts.js';
import BarcodeScanner from './BarcodeScanner.jsx';
import { recentFoods, SECTIONS } from '../domain/foods.js';
import {
  localFoods, remoteFood, searchLocal, mergeResults, macrosFor, startAmount, servingOptions, pickServing, entryFor, quickFoodEntry, remember, defaultSection,
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
  const [optIdx, setOptIdx] = useState(0);       // which serving size
  const [servings, setServings] = useState('1'); // how many of it
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

  const pick = (f) => {
    const start = startAmount(f, memory);
    const { index, servings: n } = pickServing(f, start);
    setFood(f); setAmount(String(start)); setOptIdx(index); setServings(String(n)); setStep('amount');
  };

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
  // The bundled Australian pack is checked first (instant, works offline), then Open Food Facts online.
  const scanCode = async (code) => {
    try {
      const local = await barcodeFood(code);
      pick(local || remoteFood(await lookupBarcode(code)));
    } catch { return `No product found for ${code}. Try another angle, type the number, or search by name.`; }
    return undefined;
  };

  const options = food ? servingOptions(food) : [];
  const opt = options[Math.min(optIdx, Math.max(0, options.length - 1))];
  const n = parseFloat(servings);
  const amt = opt && n > 0 ? Math.round(opt.mult * n * 100) / 100 : parseFloat(amount);
  const macros = food && amt > 0 ? macrosFor(food, amt) : null;
  const sectionLabel = SECTIONS.find(x => x.id === section)?.label ?? 'diary';

  // ── Amount step (MyFitnessPal style: serving size, number of servings, meal, then Add) ──
  if (step === 'amount' && food) {
    const kc = macros ? (macros.protein * 4 + macros.carbs * 4 + macros.fat * 9) || 1 : 1;
    const pct = (g, k) => (macros ? Math.round((g * k * 100) / kc) : 0);
    const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 54, borderTop: '0.5px solid var(--card-border)' };
    const ctl = { ...input, width: 'auto', minWidth: 0, maxWidth: '62%', minHeight: 40, textAlign: 'right', fontWeight: 600, color: 'var(--accent)', background: 'transparent', border: 'none', padding: '0 4px' };
    const add = (again) => save(entryFor(food, amt, { section }), food, amt, again);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => setStep('search')} aria-label="Back to search" style={{ ...ghost, minHeight: 44, minWidth: 44, padding: 0 }}>‹</button>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>Add food</div>
          <button type="button" disabled={!macros || busy} onClick={() => add(false)} aria-label={`Add to ${sectionLabel}`} style={{ ...primary, minHeight: 44, padding: '0 18px', opacity: macros ? 1 : 0.5 }}>✓ Add</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{food.name}</div>
            {food.sub && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{food.sub}</div>}
          </div>
          {macros && <StarButton on={lib.isFav(food.name)} name={food.name} size={44} onClick={() => lib.toggleFav({ ...entryFor(food, amt, { section }) })} />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={row}>
            <span style={{ fontSize: 15, color: 'var(--text-primary)' }}>Serving size</span>
            <select value={optIdx} onChange={e => setOptIdx(Number(e.target.value))} aria-label="Serving size" style={ctl}>
              {options.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}
            </select>
          </label>
          <label style={row}>
            <span style={{ fontSize: 15, color: 'var(--text-primary)' }}>Number of servings</span>
            <input type="text" inputMode="decimal" value={servings} onFocus={e => e.target.select()} onChange={e => setServings(e.target.value.replace(/[^0-9.]/g, '').slice(0, 6))} aria-label="Number of servings" style={{ ...ctl, width: 90 }} />
          </label>
          <label style={{ ...row, borderBottom: '0.5px solid var(--card-border)' }}>
            <span style={{ fontSize: 15, color: 'var(--text-primary)' }}>Meal</span>
            <select value={section} onChange={e => setSection(e.target.value)} aria-label="Meal" style={ctl}>
              {SECTIONS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
        </div>

        {/* Nutrition for what you are adding: calories, then where they come from */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, textAlign: 'center', padding: '6px 0' }}>
          <div><div className="val-num" style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{macros ? macros.calories : '–'}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>kcal{food.amountKind === 'grams' && amt > 0 ? ` · ${fmt(amt)} g` : ''}</div></div>
          {[['Carbs', 'carbs', 4, '#a78bfa'], ['Fat', 'fat', 9, '#4caf7d'], ['Protein', 'protein', 4, '#e879a0']].map(([l, k, f, c]) => (
            <div key={k}><div style={{ fontSize: 12, fontWeight: 700, color: c }}>{pct(macros?.[k] ?? 0, f)}%</div><div className="val-num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{macros ? fmt(macros[k]) : '–'} g</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{l}</div></div>
          ))}
        </div>

        <div style={{ position: 'sticky', bottom: 0, display: 'flex', gap: 10, paddingTop: 8, background: 'var(--bg-panel, var(--surface-1))' }}>
          <button type="button" disabled={!macros || busy} onClick={() => add(true)} style={{ ...ghost, flex: 1, opacity: macros ? 1 : 0.5 }}>Add + another</button>
          <button type="button" disabled={!macros || busy} onClick={() => add(false)} style={{ ...primary, flex: 1.4, opacity: macros ? 1 : 0.5 }}>Add to {sectionLabel}</button>
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
        {canScanBarcodes() && <button type="button" onClick={() => setStep('scan')} aria-label="Scan a barcode" style={{ ...ghost, display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', color: 'var(--accent)', borderColor: 'var(--accent)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v8M17 8v8" /></svg>
          <span style={{ fontSize: 14 }}>Scan</span>
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
