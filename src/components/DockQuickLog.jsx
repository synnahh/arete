// DockQuickLog — the "+" in the dock: log water, a weigh-in or calories without leaving the page.
// Writes the same rows the Fuel, Water and Body screens write, with an Undo toast.
import { useEffect, useRef, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { quickEntry, appendMeals } from '../domain/foods.js';

const toast = (detail) => window.dispatchEvent(new CustomEvent('valerie:toast', { detail }));
const clock = () => { const n = new Date(); return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; };

const field = { height: 38, padding: '0 10px', borderRadius: 9, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-mono)', minWidth: 0 };
const btn = { height: 38, padding: '0 14px', borderRadius: 9, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const go = { ...btn, background: 'var(--tab-accent)', color: 'var(--on-tab-accent)', border: 'none' };
const cap = { fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6 };

export default function DockQuickLog() {
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState('');
  const [kcal, setKcal] = useState('');
  const [error, setError] = useState('');
  const box = useRef(null);
  const water = useCollection('water_logs', STORAGE_KEYS.WATER);
  const body = useCollection('body_metrics', STORAGE_KEYS.BODY);
  const food = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);
  const today = toLocalDateKey(new Date());

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  async function logWater(ml) {
    const id = await water.add({ date: today, amount: ml, time: clock() });
    if (!id) { setError('Could not save. Are you signed in?'); return; }
    setError('');
    toast({ message: `Logged ${ml} ml of water`, type: 'success', undo: () => water.remove(id) });
  }

  async function logWeight() {
    const w = Number(weight);
    if (!(w > 20 && w < 400)) { setError('Enter a weight between 20 and 400 kg.'); return; }
    const id = await body.add({ date: today, weight: w });
    if (!id) { setError('Could not save. Are you signed in?'); return; }
    setError(''); setWeight('');
    toast({ message: `Logged ${w} kg`, type: 'success', undo: () => body.remove(id) });
  }

  async function logFood() {
    const entry = quickEntry({ calories: kcal });
    if (!entry) { setError('Enter calories between 1 and 10,000.'); return; }
    const existing = (food.items || []).find(l => l.date === today);
    const prev = existing ? { meals: existing.meals || [], calories: existing.calories || 0, protein: existing.protein || 0, carbs: existing.carbs || 0, fat: existing.fat || 0 } : null;
    const row = appendMeals(existing, [entry], today);
    const fields = { meals: row.meals, calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat };
    const id = existing ? ((await food.update(existing.id, fields)) ? existing.id : null) : await food.add({ date: today, ...fields });
    if (!id) { setError('Could not save. Are you signed in?'); return; }
    setError(''); setKcal('');
    toast({ message: `Added ${entry.calories} kcal`, type: 'success', undo: () => (existing ? food.update(existing.id, prev) : food.remove(id)) });
  }

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button type="button" className={`dock-item dock-plus${open ? ' is-active' : ''}`} data-tint="home" aria-label="Quick log" aria-expanded={open} onClick={() => { setOpen(o => !o); setError(''); }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        {!open && <span className="dock-tip" role="tooltip"><strong>Quick log</strong><em>Water, weight or calories</em></span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Quick log" className="dock-pop">
          <div>
            <div style={cap}>Water</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[250, 500, 750].map(ml => <button key={ml} type="button" style={btn} onClick={() => logWater(ml)}>+{ml} ml</button>)}
            </div>
          </div>
          <div>
            <div style={cap}>Weigh-in</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input aria-label="Weight in kilograms" inputMode="decimal" placeholder="kg" value={weight} onChange={e => setWeight(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') logWeight(); }} style={{ ...field, flex: 1 }} />
              <button type="button" style={go} onClick={logWeight}>Log</button>
            </div>
          </div>
          <div>
            <div style={cap}>Calories</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input aria-label="Calories" inputMode="numeric" placeholder="kcal" value={kcal} onChange={e => setKcal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') logFood(); }} style={{ ...field, flex: 1 }} />
              <button type="button" style={go} onClick={logFood}>Add</button>
            </div>
          </div>
          {error && <div role="alert" style={{ fontSize: 12.5, color: '#e55a5a' }}>{error}</div>}
        </div>
      )}
    </div>
  );
}
