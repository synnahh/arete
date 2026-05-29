// ─── Health Tab ───────────────────────────────────────────────────────────────
// 9 sub-sections: Overview · Habits · Nutrition · Workout · Water · Body · Supplements · Sleep · Stimulant

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useCollection }                  from '../firebase/useCollection.js';
import { storage, STORAGE_KEYS }          from '../utils/storage.js';
import { RingChart, ProgressBar, StageBar, BarChart } from '../components/Charts.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const nowStr   = () => new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });

const Icon = ({ d, size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const TrashIcon  = () => <Icon d="M3 6h18 M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2 M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />;
const PlusIcon   = () => <Icon d="M12 5v14 M5 12h14" />;
const MicIcon    = () => <Icon d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8" />;
const ScanIcon   = () => <Icon d="M3 7V5a2 2 0 012-2h2 M17 3h2a2 2 0 012 2v2 M21 17v2a2 2 0 01-2 2h-2 M7 21H5a2 2 0 01-2-2v-2 M7 12h10" />;

// ── Shared style tokens ────────────────────────────────────────────────────────
const inputSx = {
  width: '100%', background: 'var(--input-bg)', border: '0.5px solid var(--input-border)',
  borderRadius: 7, padding: '7px 10px', fontSize: 12.5, color: 'var(--text-primary)',
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s ease',
};
const btnPrimary = {
  padding: '7px 16px', borderRadius: 8, border: '0.5px solid var(--card-border)',
  background: 'var(--active-bg)', color: 'var(--accent)', cursor: 'pointer',
  fontSize: 12, fontWeight: 500, transition: 'all 0.15s ease',
};
const btnGhost = {
  padding: '6px 14px', borderRadius: 8, border: '0.5px solid var(--card-border)',
  background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
  fontSize: 12, transition: 'all 0.15s ease',
};
const cardSx = {
  background: 'var(--card-fill)', border: '0.5px solid var(--card-border)',
  borderRadius: 12, padding: '14px 16px',
};
const lblSx = {
  display: 'block', fontSize: 10, color: 'var(--text-muted)',
  letterSpacing: '0.06em', marginBottom: 4,
};

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children, action }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '18px 24px 12px', borderBottom: '0.5px solid var(--sidebar-divider)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', margin: 0, flex: 1 }}>{title}</h2>
        {action}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {children}
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, colour = 'var(--accent)', ring, children }) {
  return (
    <div style={{ ...cardSx, display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 130 }}>
      {ring && (
        <RingChart value={ring.value} max={ring.max} size={64} thickness={6}
          colour={colour} label={ring.label} sublabel={ring.sublabel} labelSize={14} />
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
        {value !== undefined && (
          <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>
            {value}<span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 3 }}>{unit}</span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. OVERVIEW — compact stat grid for all sub-sections
// ═══════════════════════════════════════════════════════════════════════════════
function Overview({ habits, waterLogs, nutritionLogs, sleepData, settings, supplements, suppLogs, stimLogs, workoutLogs, bodyMetrics }) {
  const today = todayStr();

  // Water
  const waterGoal  = settings?.waterGoal ?? 2500;
  const todayWater = useMemo(() =>
    (waterLogs || []).filter(l => l.date === today).reduce((s, l) => s + (l.amount || 0), 0),
    [waterLogs, today]);

  // Nutrition
  const todayNutrition = useMemo(() =>
    (nutritionLogs || []).find(l => l.date === today),
    [nutritionLogs, today]);
  const macroGoal = settings?.macroGoal ?? 2500;
  const todayCal  = todayNutrition?.totalCalories ?? 0;

  // Sleep
  const lastSleep = useMemo(() =>
    [...(sleepData || [])].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0],
    [sleepData]);

  // Habits
  const todayHabits = useMemo(() => {
    const total = (habits || []).length;
    const done  = (habits || []).filter(h => h.lastCompleted === today).length;
    return { done, total };
  }, [habits, today]);

  // Supplements
  const todaySupps = useMemo(() => {
    const total = (supplements || []).length;
    const done  = new Set((suppLogs || []).filter(l => l.date === today).map(l => l.suppId)).size;
    return { done, total };
  }, [supplements, suppLogs, today]);

  // Stimulants
  const todayStims = useMemo(() => {
    const logs = (stimLogs || []).filter(l => l.date === today);
    return {
      caffeine: logs.filter(l => l.type === 'caffeine').reduce((s, l) => s + (l.amount || 0), 0),
      nicotine: logs.filter(l => l.type === 'nicotine').reduce((s, l) => s + (l.amount || 0), 0),
    };
  }, [stimLogs, today]);
  const caffLimit = settings?.caffeineLimitMg ?? 400;
  const nicLimit  = settings?.nicotineLimitMg ?? 20;

  // Workout today
  const workedOutToday = useMemo(() =>
    (workoutLogs || []).some(l => l.date === today),
    [workoutLogs, today]);

  // Body — latest weight
  const latestBody = useMemo(() =>
    [...(bodyMetrics || [])].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0],
    [bodyMetrics]);

  // Compact stat tile component
  const Tile = ({ label, value, sublabel, colour = 'var(--accent)', ring: ringProps, navTo, onNav }) => (
    <div
      onClick={onNav}
      style={{
        ...cardSx, flex: '1 1 120px', minWidth: 110, maxWidth: 200,
        cursor: onNav ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => { if (onNav) e.currentTarget.style.borderColor = 'var(--accent)55'; }}
      onMouseLeave={e => { if (onNav) e.currentTarget.style.borderColor = 'var(--card-border)'; }}
    >
      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
      {ringProps ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RingChart
            value={ringProps.value} max={ringProps.max}
            size={44} thickness={4} colour={colour}
            label={null}
          />
          <div>
            <div style={{ fontSize: 16, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
            {sublabel && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sublabel}</div>}
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 18, fontWeight: 300, color: colour, lineHeight: 1 }}>{value}</div>
          {sublabel && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{sublabel}</div>}
        </>
      )}
    </div>
  );

  return (
    <Section title="Overview">
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 14, letterSpacing: '0.02em' }}>
        Today at a glance — tap any card to go to that section
      </div>

      {/* Row 1: core vitals */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <Tile
          label="SLEEP"
          value={lastSleep ? `${lastSleep.efficiency ?? '—'}%` : '—'}
          sublabel={lastSleep ? `${Math.floor((lastSleep.duration ?? 0)/60)}h ${(lastSleep.duration ?? 0)%60}m` : 'no data'}
          colour="var(--accent)"
          ring={lastSleep ? { value: lastSleep.efficiency ?? 0, max: 100 } : undefined}
        />
        <Tile
          label="WATER"
          value={todayWater >= 1000 ? `${(todayWater/1000).toFixed(1)}L` : `${todayWater}ml`}
          sublabel={`of ${waterGoal >= 1000 ? (waterGoal/1000).toFixed(1)+'L' : waterGoal+'ml'}`}
          colour="#4a9eff"
          ring={{ value: todayWater, max: waterGoal }}
        />
        <Tile
          label="CALORIES"
          value={`${todayCal}`}
          sublabel={`of ${macroGoal} kcal`}
          colour="#f4a642"
          ring={{ value: todayCal, max: macroGoal }}
        />
        <Tile
          label="HABITS"
          value={`${todayHabits.done}/${todayHabits.total}`}
          sublabel={todayHabits.total === 0 ? 'none set' : todayHabits.done === todayHabits.total ? '✓ all done' : `${todayHabits.total - todayHabits.done} remaining`}
          colour="#4caf7d"
          ring={todayHabits.total > 0 ? { value: todayHabits.done, max: todayHabits.total } : undefined}
        />
      </div>

      {/* Row 2: supplementary stats */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <Tile
          label="SUPPLEMENTS"
          value={`${todaySupps.done}/${todaySupps.total}`}
          sublabel={todaySupps.total === 0 ? 'none set' : todaySupps.done === todaySupps.total ? '✓ all taken' : 'remaining'}
          colour="#9b5de5"
          ring={todaySupps.total > 0 ? { value: todaySupps.done, max: todaySupps.total } : undefined}
        />
        <Tile
          label="CAFFEINE"
          value={`${todayStims.caffeine}mg`}
          sublabel={`of ${caffLimit}mg`}
          colour={todayStims.caffeine > caffLimit * 0.8 ? '#f4a642' : 'var(--text-secondary)'}
          ring={{ value: todayStims.caffeine, max: caffLimit }}
        />
        {todayStims.nicotine > 0 && (
          <Tile
            label="NICOTINE"
            value={`${todayStims.nicotine}mg`}
            sublabel={`of ${nicLimit}mg`}
            colour={todayStims.nicotine > nicLimit * 0.8 ? '#e55a5a' : '#f4a642'}
            ring={{ value: todayStims.nicotine, max: nicLimit }}
          />
        )}
        <Tile
          label="WORKOUT"
          value={workedOutToday ? 'Done ✓' : 'Not yet'}
          sublabel={workedOutToday ? 'logged today' : 'no session yet'}
          colour={workedOutToday ? '#4caf7d' : 'var(--text-muted)'}
        />
        {latestBody?.weight && (
          <Tile
            label="WEIGHT"
            value={`${latestBody.weight}kg`}
            sublabel={latestBody.date === today ? 'logged today' : `as of ${latestBody.date ?? '—'}`}
            colour="var(--text-secondary)"
          />
        )}
      </div>

      {/* Sleep stage bar if available */}
      {lastSleep?.stages && (
        <div style={{ ...cardSx }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 10 }}>LAST NIGHT — SLEEP STAGES</div>
          <StageBar height={12} stages={[
            { label: 'Deep',  value: lastSleep.stages.deep  ?? 0, colour: '#4a9eff' },
            { label: 'REM',   value: lastSleep.stages.rem   ?? 0, colour: '#9b5de5' },
            { label: 'Core',  value: lastSleep.stages.core  ?? 0, colour: '#4caf7d' },
            { label: 'Awake', value: lastSleep.stages.awake ?? 0, colour: 'rgba(255,255,255,0.15)' },
          ]} />
          <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            {[
              { l:'Deep', c:'#4a9eff', v: lastSleep.stages.deep  },
              { l:'REM',  c:'#9b5de5', v: lastSleep.stages.rem   },
              { l:'Core', c:'#4caf7d', v: lastSleep.stages.core  },
              { l:'Awake',c:'rgba(255,255,255,0.3)', v: lastSleep.stages.awake },
            ].map(s => (
              <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.c }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {s.l}: {Math.floor((s.v ?? 0)/60)}h{(s.v ?? 0)%60}m
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. HABITS
// ═══════════════════════════════════════════════════════════════════════════════
function Habits({ habits, addHabit, updateHabit, removeHabit }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm]     = useState({ name: '', icon: '✅', frequency: 'daily' });
  const today = todayStr();

  const toggle = async (habit) => {
    const done = habit.lastCompleted === today;
    const streak = done ? Math.max((habit.streak || 0) - 1, 0)
                       : (habit.streak || 0) + 1;
    await updateHabit(habit.id, {
      lastCompleted: done ? '' : today,
      streak: done ? streak : streak,
    });
  };

  const ICONS = ['✅','🏃','💧','📚','🧘','💪','🎯','🌙','🥗','🚭','☕','🛌'];

  return (
    <Section title="Habits" action={
      <button onClick={() => setAdding(true)} style={btnPrimary}>+ Add habit</button>
    }>
      {/* Add form */}
      {adding && (
        <div style={{ ...cardSx, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={lblSx}>Habit name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. No caffeine after 2pm" style={inputSx}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
                autoFocus
              />
            </div>
          </div>
          <div>
            <label style={lblSx}>Icon</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setForm(p => ({ ...p, icon: ic }))} style={{
                  width: 32, height: 32, borderRadius: 7, fontSize: 16, cursor: 'pointer',
                  border: `1.5px solid ${form.icon === ic ? 'var(--accent)' : 'var(--card-border)'}`,
                  background: form.icon === ic ? 'var(--active-bg)' : 'transparent',
                  transition: 'all 0.15s ease',
                }}>{ic}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setAdding(false)} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
            <button onClick={async () => {
              if (!form.name.trim()) return;
              await addHabit({ name: form.name.trim(), icon: form.icon, frequency: form.frequency, streak: 0, lastCompleted: '' });
              setForm({ name: '', icon: '✅', frequency: 'daily' });
              setAdding(false);
            }} style={{ ...btnPrimary, flex: 1 }}>Add</button>
          </div>
        </div>
      )}

      {/* Habit list */}
      {habits.length === 0 && !adding ? (
        <div style={{ textAlign: 'center', padding: 40, opacity: 0.4 }}>
          <div style={{ fontSize: 28 }}>🎯</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>No habits yet. Add one to start tracking.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {habits.map(h => {
            const done = h.lastCompleted === today;
            return (
              <div key={h.id} style={{
                ...cardSx, display: 'flex', alignItems: 'center', gap: 12,
                opacity: done ? 0.65 : 1,
                borderColor: done ? 'var(--accent)' : 'var(--card-border)',
                transition: 'all 0.2s ease',
              }}>
                <span style={{ fontSize: 22 }}>{h.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, color: 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none' }}>
                    {h.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    🔥 {h.streak || 0} day streak
                  </div>
                </div>
                <button onClick={() => toggle(h)} style={{
                  width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${done ? 'var(--accent)' : 'var(--card-border)'}`,
                  background: done ? 'var(--active-bg)' : 'transparent',
                  color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, transition: 'all 0.15s ease',
                }}>
                  {done ? '✓' : ''}
                </button>
                <button onClick={() => removeHabit(h.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: 4, borderRadius: 4, display: 'flex',
                }}><TrashIcon /></button>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. NUTRITION
// ═══════════════════════════════════════════════════════════════════════════════
async function searchOpenFoodFacts(query) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?action=process&search_terms=${encodeURIComponent(query)}&json=1&fields=product_name,nutriments&page_size=8&search_simple=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Food search failed');
  const data = await res.json();
  return (data.products || []).filter(p => p.product_name).map(p => ({
    name: p.product_name,
    per100: {
      calories: Math.round(p.nutriments?.['energy-kcal_100g'] ?? 0),
      protein:  Math.round((p.nutriments?.proteins_100g ?? 0) * 10) / 10,
      carbs:    Math.round((p.nutriments?.carbohydrates_100g ?? 0) * 10) / 10,
      fat:      Math.round((p.nutriments?.fat_100g ?? 0) * 10) / 10,
    },
  }));
}

async function lookupBarcode(code) {
  const url = `https://world.openfoodfacts.org/api/v0/product/${code}.json`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 1) throw new Error('Product not found');
  const p = data.product;
  return {
    name: p.product_name ?? 'Unknown product',
    per100: {
      calories: Math.round(p.nutriments?.['energy-kcal_100g'] ?? 0),
      protein:  Math.round((p.nutriments?.proteins_100g ?? 0) * 10) / 10,
      carbs:    Math.round((p.nutriments?.carbohydrates_100g ?? 0) * 10) / 10,
      fat:      Math.round((p.nutriments?.fat_100g ?? 0) * 10) / 10,
    },
  };
}

function Nutrition({ nutritionLogs, addNutritionLog, updateNutritionLog, settings }) {
  const today     = todayStr();
  const goals     = settings?.macros ?? { calories: 2500, protein: 180, carbs: 250, fat: 80 };
  const todayLog  = useMemo(() =>
    (nutritionLogs || []).find(l => l.date === today),
    [nutritionLogs, today]);
  const meals     = todayLog?.meals ?? [];
  const totals    = useMemo(() => meals.reduce((s, m) => ({
    calories: s.calories + (m.calories || 0),
    protein:  s.protein  + (m.protein  || 0),
    carbs:    s.carbs    + (m.carbs    || 0),
    fat:      s.fat      + (m.fat      || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [meals]);

  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch]   = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [qty, setQty]             = useState('100');
  const [unit, setUnit]           = useState('g');
  const [scanning, setScanning]   = useState(false);
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try { setResults(await searchOpenFoodFacts(search)); }
    catch { setResults([]); }
    finally { setSearching(false); }
  };

  const addMeal = async () => {
    if (!selected) return;
    const factor = (parseFloat(qty) || 100) / 100;
    const entry = {
      id: `m_${Date.now()}`,
      name: selected.name,
      calories: Math.round(selected.per100.calories * factor),
      protein:  Math.round(selected.per100.protein  * factor * 10) / 10,
      carbs:    Math.round(selected.per100.carbs    * factor * 10) / 10,
      fat:      Math.round(selected.per100.fat      * factor * 10) / 10,
      qty: parseFloat(qty), unit,
      time: nowStr(),
    };
    const newMeals = [...meals, entry];
    const newTotals = newMeals.reduce((s, m) => ({
      calories: s.calories + m.calories, protein: s.protein + m.protein,
      carbs: s.carbs + m.carbs, fat: s.fat + m.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    if (todayLog?.id) {
      await updateNutritionLog(todayLog.id, { meals: newMeals, ...newTotals });
    } else {
      await addNutritionLog({ date: today, meals: newMeals, ...newTotals });
    }
    setSelected(null); setSearch(''); setResults([]); setShowAdd(false);
  };

  // QR / Barcode scanner using BarcodeDetector API
  const startScan = async () => {
    if (!window.BarcodeDetector) { alert('Barcode scanner not supported in this browser.'); return; }
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const detector = new window.BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128'] });
      const scan = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length) {
            stopScan();
            const food = await lookupBarcode(codes[0].rawValue);
            setSelected(food); setSearch(food.name); setResults([food]);
          } else { requestAnimationFrame(scan); }
        } catch { requestAnimationFrame(scan); }
      };
      requestAnimationFrame(scan);
    } catch (err) { setScanning(false); }
  };
  const stopScan = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  const MACROS = [
    { key: 'calories', label: 'Calories', colour: '#f4a642', unit: 'kcal' },
    { key: 'protein',  label: 'Protein',  colour: '#4a9eff', unit: 'g' },
    { key: 'carbs',    label: 'Carbs',    colour: '#4caf7d', unit: 'g' },
    { key: 'fat',      label: 'Fat',      colour: '#9b5de5', unit: 'g' },
  ];

  return (
    <Section title="Nutrition" action={
      <button onClick={() => setShowAdd(true)} style={btnPrimary}>+ Log food</button>
    }>
      {/* Macro bars */}
      <div style={{ ...cardSx, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em' }}>TODAY'S MACROS</div>
        {MACROS.map(m => (
          <div key={m.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{m.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {totals[m.key]}{m.unit} / {goals[m.key]}{m.unit}
              </span>
            </div>
            <ProgressBar value={totals[m.key]} max={goals[m.key]} colour={m.colour} height={5} />
          </div>
        ))}
      </div>

      {/* Add food modal */}
      {showAdd && (
        <div style={{ ...cardSx, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Add food</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={scanning ? stopScan : startScan} title="Scan barcode"
                style={{ ...btnGhost, padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ScanIcon /> {scanning ? 'Stop scan' : 'Scan'}
              </button>
              <button onClick={() => { setShowAdd(false); stopScan(); }} style={btnGhost}>Cancel</button>
            </div>
          </div>

          {/* Video preview for barcode scan */}
          {scanning && (
            <div style={{ borderRadius: 8, overflow: 'hidden', background: '#000', height: 180 }}>
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search food or scan barcode…" style={{ ...inputSx, flex: 1 }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
            />
            <button onClick={doSearch} style={btnPrimary} disabled={searching}>
              {searching ? '…' : 'Search'}
            </button>
          </div>

          {results.map((r, i) => (
            <div key={i} onClick={() => setSelected(r)} style={{
              padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
              background: selected?.name === r.name ? 'var(--active-bg)' : 'var(--hover-bg)',
              border: `0.5px solid ${selected?.name === r.name ? 'var(--accent)' : 'var(--card-border)'}`,
            }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{r.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {r.per100.calories} kcal · P {r.per100.protein}g · C {r.per100.carbs}g · F {r.per100.fat}g — per 100g
              </div>
            </div>
          ))}

          {selected && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={lblSx}>Quantity</label>
                <input type="number" value={qty} onChange={e => setQty(e.target.value)}
                  style={inputSx} min="1"
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lblSx}>Unit</label>
                <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inputSx, cursor: 'pointer' }}>
                  <option value="g">grams</option>
                  <option value="ml">ml</option>
                  <option value="serving">serving</option>
                </select>
              </div>
              <button onClick={addMeal} style={btnPrimary}>Add</button>
            </div>
          )}
        </div>
      )}

      {/* Meal log */}
      <div style={{ ...cardSx }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 10 }}>TODAY'S LOG</div>
        {meals.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>Nothing logged yet today.</p>
        ) : (
          meals.map((m, i) => (
            <div key={m.id || i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '7px 0', borderBottom: i < meals.length - 1 ? '0.5px solid var(--sidebar-divider)' : 'none',
            }}>
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{m.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {m.time} · {m.qty}{m.unit}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                <div>{m.calories} kcal</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>P{m.protein} C{m.carbs} F{m.fat}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. WORKOUT
// ═══════════════════════════════════════════════════════════════════════════════
const LOCAL_EXERCISES = [
  { id:'bp',   name:'Barbell Bench Press',     muscle:'chest',      secondary:'triceps, shoulders', equipment:'barbell' },
  { id:'sq',   name:'Barbell Back Squat',      muscle:'quads',      secondary:'glutes, hamstrings', equipment:'barbell' },
  { id:'dl',   name:'Conventional Deadlift',   muscle:'back',       secondary:'glutes, hamstrings', equipment:'barbell' },
  { id:'ohp',  name:'Overhead Press',          muscle:'shoulders',  secondary:'triceps',            equipment:'barbell' },
  { id:'row',  name:'Barbell Row',             muscle:'back',       secondary:'biceps',             equipment:'barbell' },
  { id:'pu',   name:'Pull-Ups',               muscle:'back',       secondary:'biceps',             equipment:'bodyweight' },
  { id:'dip',  name:'Dips',                   muscle:'chest',      secondary:'triceps',            equipment:'bodyweight' },
  { id:'pp',   name:'Push-Ups',               muscle:'chest',      secondary:'triceps',            equipment:'bodyweight' },
  { id:'ibp',  name:'Incline Dumbbell Press', muscle:'chest',      secondary:'shoulders',          equipment:'dumbbell' },
  { id:'lpd',  name:'Lat Pulldown',           muscle:'back',       secondary:'biceps',             equipment:'cable' },
  { id:'te',   name:'Tricep Pushdown',        muscle:'triceps',    secondary:null,                 equipment:'cable' },
  { id:'bc',   name:'Barbell Bicep Curl',     muscle:'biceps',     secondary:null,                 equipment:'barbell' },
  { id:'lp',   name:'Leg Press',              muscle:'quads',      secondary:'glutes',             equipment:'machine' },
  { id:'rdl',  name:'Romanian Deadlift',      muscle:'hamstrings', secondary:'glutes',             equipment:'barbell' },
  { id:'fp',   name:'Face Pulls',            muscle:'shoulders',  secondary:'rear delts',         equipment:'cable' },
  { id:'dlr',  name:'Dumbbell Lateral Raise', muscle:'shoulders',  secondary:null,                 equipment:'dumbbell' },
  { id:'pl',   name:'Plank',                 muscle:'core',       secondary:null,                 equipment:'bodyweight' },
  { id:'ht',   name:'Barbell Hip Thrust',    muscle:'glutes',     secondary:'hamstrings',         equipment:'barbell' },
  { id:'cr',   name:'Standing Calf Raise',   muscle:'calves',     secondary:null,                 equipment:'machine' },
  { id:'dbr',  name:'Single Arm DB Row',     muscle:'back',       secondary:'biceps',             equipment:'dumbbell' },
  { id:'lc',   name:'Lying Leg Curl',        muscle:'hamstrings', secondary:null,                 equipment:'machine' },
  { id:'le',   name:'Leg Extension',         muscle:'quads',      secondary:null,                 equipment:'machine' },
  { id:'cf',   name:'Dumbbell Chest Fly',    muscle:'chest',      secondary:null,                 equipment:'dumbbell' },
  { id:'ln',   name:'Walking Lunges',        muscle:'quads',      secondary:'glutes',             equipment:'bodyweight' },
  { id:'hc',   name:'Hammer Curls',          muscle:'biceps',     secondary:'forearms',           equipment:'dumbbell' },
];
const MUSCLES = ['all', 'chest', 'back', 'quads', 'hamstrings', 'shoulders', 'biceps', 'triceps', 'glutes', 'core', 'calves'];

async function fetchExercisesFromDB(apiKey) {
  const res = await fetch('https://exercisedb.p.rapidapi.com/exercises?limit=50&offset=0', {
    headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com' },
  });
  if (!res.ok) throw new Error('ExerciseDB API error');
  const data = await res.json();
  return data.map(e => ({
    id: e.id, name: e.name, muscle: e.bodyPart,
    secondary: e.secondaryMuscles?.join(', ') ?? null,
    equipment: e.equipment, gifUrl: e.gifUrl,
    instructions: e.instructions,
  }));
}

function Workout({ workoutLogs, addWorkoutLog, settings }) {
  const apiKey = settings?.exercisedbKey ?? '';
  const [exercises, setExercises] = useState(LOCAL_EXERCISES);
  const [muscle, setMuscle]       = useState('all');
  const [apiLoaded, setApiLoaded] = useState(false);
  const [logging, setLogging]     = useState(null); // exercise being logged

  useEffect(() => {
    if (!apiKey || apiLoaded) return;
    fetchExercisesFromDB(apiKey)
      .then(data => { setExercises(data); setApiLoaded(true); })
      .catch(err => console.warn('[ExerciseDB]', err.message));
  }, [apiKey]);

  const filtered = useMemo(() =>
    muscle === 'all' ? exercises : exercises.filter(e => e.muscle === muscle),
    [exercises, muscle]);

  return (
    <Section title="Workout">
      {!apiKey && (
        <div style={{
          padding: '8px 14px', borderRadius: 8, marginBottom: 14,
          background: 'rgba(244,166,66,0.08)', border: '0.5px solid rgba(244,166,66,0.25)',
          fontSize: 11.5, color: 'rgba(244,166,66,0.9)',
        }}>
          ⚡ Add your ExerciseDB API key in Settings → AI to unlock animated GIFs and full exercise library.
        </div>
      )}

      {/* Muscle filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {MUSCLES.map(m => (
          <button key={m} onClick={() => setMuscle(m)} style={{
            padding: '4px 11px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
            border: `0.5px solid ${muscle === m ? 'var(--accent)' : 'var(--card-border)'}`,
            background: muscle === m ? 'var(--active-bg)' : 'transparent',
            color: muscle === m ? 'var(--accent)' : 'var(--text-secondary)',
            textTransform: 'capitalize', transition: 'all 0.15s ease',
          }}>{m}</button>
        ))}
      </div>

      {/* Exercise grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {filtered.map(ex => (
          <div key={ex.id} style={{ ...cardSx, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* GIF placeholder */}
            {ex.gifUrl ? (
              <img src={ex.gifUrl} alt={ex.name}
                style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }} />
            ) : (
              <div style={{ height: 80, borderRadius: 8, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 28, opacity: 0.3 }}>💪</span>
              </div>
            )}
            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{ex.name}</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 10, background: 'var(--active-bg)', color: 'var(--accent)', textTransform: 'capitalize' }}>{ex.muscle}</span>
              <span style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{ex.equipment}</span>
            </div>
            <button onClick={() => setLogging(ex)} style={{ ...btnGhost, fontSize: 11, padding: '5px 0', width: '100%' }}>
              + Log set
            </button>
          </div>
        ))}
      </div>

      {/* Log modal */}
      {logging && (
        <LogSetModal exercise={logging} onClose={() => setLogging(null)}
          onSave={async (sets) => {
            await addWorkoutLog({ date: todayStr(), exerciseName: logging.name, muscle: logging.muscle, sets });
            setLogging(null);
          }}
        />
      )}
    </Section>
  );
}

function LogSetModal({ exercise, onClose, onSave }) {
  const [sets, setSets] = useState([{ weight: '', reps: '' }]);
  const addSet = () => setSets(p => [...p, { weight: '', reps: '' }]);
  const upd = (i, k, v) => setSets(p => p.map((s, idx) => idx === i ? { ...s, [k]: v } : s));

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
        borderRadius: 14, padding: '20px 22px', width: 320,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{exercise.name}</div>
        {sets.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 40 }}>Set {i+1}</span>
            <input type="number" placeholder="kg" value={s.weight} onChange={e => upd(i,'weight',e.target.value)}
              style={{ ...inputSx, width: 80 }} onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--input-border)'} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>×</span>
            <input type="number" placeholder="reps" value={s.reps} onChange={e => upd(i,'reps',e.target.value)}
              style={{ ...inputSx, width: 80 }} onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--input-border)'} />
          </div>
        ))}
        <button onClick={addSet} style={{ ...btnGhost, fontSize: 11 }}>+ Add set</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
          <button onClick={() => onSave(sets)} style={{ ...btnPrimary, flex: 1 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. WATER
// ═══════════════════════════════════════════════════════════════════════════════
function Water({ waterLogs, addWaterLog, settings }) {
  const today    = todayStr();
  const goal     = settings?.waterGoal ?? 2500;
  const todayLogs = useMemo(() =>
    [...(waterLogs || []).filter(l => l.date === today)].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    [waterLogs, today]);
  const total = todayLogs.reduce((s, l) => s + (l.amount || 0), 0);
  const pct   = Math.min((total / goal) * 100, 100);

  const QUICK = [250, 500, 750, 1000];
  const [custom, setCustom] = useState('');

  const log = async (ml) => {
    await addWaterLog({ date: today, amount: ml, time: nowStr() });
  };

  const colour = pct >= 100 ? '#4caf7d' : pct >= 60 ? '#4a9eff' : pct >= 30 ? '#f4a642' : '#e55a5a';

  return (
    <Section title="Water">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, gap: 24 }}>
        <RingChart value={total} max={goal} size={140} thickness={11} colour={colour}
          label={total >= 1000 ? `${(total/1000).toFixed(1)}L` : `${total}ml`}
          sublabel={`of ${goal >= 1000 ? (goal/1000).toFixed(1)+'L' : goal+'ml'}`}
          labelSize={18}
        />
      </div>

      {/* Quick log */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, justifyContent: 'center' }}>
        {QUICK.map(ml => (
          <button key={ml} onClick={() => log(ml)} style={{
            ...btnGhost, minWidth: 72, textAlign: 'center',
          }}>{ml < 1000 ? `${ml}ml` : `${ml/1000}L`}</button>
        ))}
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="number" value={custom} onChange={e => setCustom(e.target.value)}
            placeholder="ml" style={{ ...inputSx, width: 80 }}
            onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--input-border)'}
          />
          <button onClick={() => { if (custom) { log(parseInt(custom)); setCustom(''); } }} style={btnPrimary}>Log</button>
        </div>
      </div>

      {/* Today's log */}
      <div style={{ ...cardSx }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 8 }}>TODAY</div>
        {todayLogs.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>No water logged yet today.</p>
        ) : (
          todayLogs.slice(-8).reverse().map((l, i) => (
            <div key={l.id || i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 0', borderBottom: i < Math.min(todayLogs.length, 8) - 1 ? '0.5px solid var(--sidebar-divider)' : 'none',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {l.amount >= 1000 ? `${(l.amount/1000).toFixed(1)}L` : `${l.amount}ml`}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.time}</span>
            </div>
          ))
        )}
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. BODY
// ═══════════════════════════════════════════════════════════════════════════════
function Body({ bodyMetrics, addBodyMetric }) {
  const [form, setForm]  = useState({ weight: '', bodyFat: '', muscle: '', notes: '' });
  const [adding, setAdding] = useState(false);
  const sorted = useMemo(() =>
    [...(bodyMetrics || [])].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [bodyMetrics]);
  const latest = sorted[0];

  const weightData = useMemo(() =>
    sorted.slice(0, 14).reverse().map(m => ({
      value: parseFloat(m.weight) || 0,
      label: m.date ? m.date.slice(5) : '',
    })),
    [sorted]);

  return (
    <Section title="Body" action={<button onClick={() => setAdding(true)} style={btnPrimary}>+ Log metrics</button>}>
      {/* Latest metrics */}
      {latest && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'WEIGHT',   value: latest.weight,   unit: 'kg' },
            { label: 'BODY FAT', value: latest.bodyFat,  unit: '%' },
            { label: 'MUSCLE',   value: latest.muscle,   unit: '%' },
          ].filter(m => m.value).map(m => (
            <div key={m.label} style={{ ...cardSx, flex: 1, minWidth: 100 }}>
              <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 24, fontWeight: 300, color: 'var(--text-primary)' }}>
                {m.value}<span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 2 }}>{m.unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Weight trend chart */}
      {weightData.length > 1 && (
        <div style={{ ...cardSx, marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 12 }}>WEIGHT TREND</div>
          <BarChart data={weightData} maxHeight={80} />
        </div>
      )}

      {/* Eufy note */}
      <div style={{
        padding: '10px 14px', borderRadius: 8,
        background: 'rgba(255,255,255,0.02)', border: '0.5px solid var(--card-border)',
        fontSize: 12, color: 'var(--text-muted)', marginBottom: 14,
      }}>
        🔵 Eufy body metrics sync automatically from Apple Health on iOS. Log manually on desktop until iPhone is set up.
      </div>

      {/* Add metrics form */}
      {adding && (
        <div style={{ ...cardSx, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Log body metrics</div>
          {[['weight','Weight (kg)'],['bodyFat','Body fat (%)'],['muscle','Muscle mass (%)']].map(([k,l]) => (
            <div key={k}>
              <label style={lblSx}>{l}</label>
              <input type="number" value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                placeholder="—" style={inputSx}
                onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--input-border)'}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setAdding(false)} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
            <button onClick={async () => {
              await addBodyMetric({ date: todayStr(), ...form });
              setForm({ weight:'', bodyFat:'', muscle:'', notes:'' }); setAdding(false);
            }} style={{ ...btnPrimary, flex: 1 }}>Save</button>
          </div>
        </div>
      )}

      {/* History */}
      {sorted.length > 0 && (
        <div style={{ ...cardSx }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 8 }}>HISTORY</div>
          {sorted.slice(0, 8).map((m, i) => (
            <div key={m.id || i} style={{
              display: 'flex', justifyContent: 'space-between', padding: '6px 0',
              borderBottom: i < Math.min(sorted.length, 8) - 1 ? '0.5px solid var(--sidebar-divider)' : 'none',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.date}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {m.weight && `${m.weight}kg`} {m.bodyFat && `· ${m.bodyFat}% fat`}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. SUPPLEMENTS
// ═══════════════════════════════════════════════════════════════════════════════
const SUPP_COLOURS = ['#4a9eff','#4caf7d','#f4a642','#9b5de5','#e55a5a','#00c9a7','#f7b731'];

function Supplements({ supplements, suppLogs, addSupplement, removeSupplement, addSuppLog }) {
  const today = todayStr();
  const [adding, setAdding] = useState(false);
  const [form, setForm]     = useState({ name: '', dose: '', frequency: 'daily', colour: SUPP_COLOURS[0] });
  const takenToday = new Set((suppLogs || []).filter(l => l.date === today).map(l => l.suppId));

  const toggleTaken = async (supp) => {
    if (takenToday.has(supp.id)) return; // already taken today
    await addSuppLog({ suppId: supp.id, date: today, time: nowStr() });
  };

  return (
    <Section title="Supplements" action={<button onClick={() => setAdding(true)} style={btnPrimary}>+ Add</button>}>
      {adding && (
        <div style={{ ...cardSx, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[['name','Name','e.g. Creatine'],['dose','Dose','e.g. 5g']].map(([k,l,ph]) => (
            <div key={k}>
              <label style={lblSx}>{l}</label>
              <input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                placeholder={ph} style={inputSx}
                onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--input-border)'}
              />
            </div>
          ))}
          <div>
            <label style={lblSx}>Colour</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {SUPP_COLOURS.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, colour: c }))} style={{
                  width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: `2.5px solid ${form.colour === c ? 'white' : 'transparent'}`,
                }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setAdding(false)} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
            <button onClick={async () => {
              if (!form.name.trim()) return;
              await addSupplement({ name: form.name, dose: form.dose, frequency: form.frequency, colour: form.colour, streak: 0 });
              setForm({ name:'', dose:'', frequency:'daily', colour: SUPP_COLOURS[0] }); setAdding(false);
            }} style={{ ...btnPrimary, flex: 1 }}>Add</button>
          </div>
        </div>
      )}

      {supplements.length === 0 && !adding ? (
        <div style={{ textAlign: 'center', padding: 40, opacity: 0.4 }}>
          <div style={{ fontSize: 28 }}>💊</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>No supplements added yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {supplements.map(s => {
            const taken = takenToday.has(s.id);
            return (
              <div key={s.id} style={{
                ...cardSx, display: 'flex', alignItems: 'center', gap: 12,
                borderLeft: `3px solid ${s.colour ?? 'var(--accent)'}`,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {s.dose} · {s.frequency}
                  </div>
                </div>
                <button onClick={() => toggleTaken(s)} style={{
                  padding: '5px 12px', borderRadius: 7, cursor: taken ? 'default' : 'pointer',
                  border: `0.5px solid ${taken ? 'var(--accent)' : 'var(--card-border)'}`,
                  background: taken ? 'var(--active-bg)' : 'transparent',
                  color: taken ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 11.5, transition: 'all 0.15s ease',
                }}>{taken ? '✓ Taken' : 'Mark taken'}</button>
                <button onClick={() => removeSupplement(s.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4, borderRadius:4, display:'flex' }}>
                  <TrashIcon />
                </button>
              </div>
            );
          })}
          {supplements.length > 0 && (
            <div style={{ ...cardSx, background: 'var(--hover-bg)', border: '0.5px dashed var(--card-border)', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', padding: '10px' }}
              onClick={async () => {
                const pending = supplements.filter(s => !takenToday.has(s.id));
                for (const s of pending) await addSuppLog({ suppId: s.id, date: today, time: nowStr() });
              }}>
              ✓ Mark all as taken
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. SLEEP
// ═══════════════════════════════════════════════════════════════════════════════
function Sleep({ sleepData }) {
  const sorted = useMemo(() =>
    [...(sleepData || [])].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [sleepData]);
  const last14 = sorted.slice(0, 14).reverse();
  const latest = sorted[0];
  const effColour = (eff) => eff >= 85 ? '#4caf7d' : eff >= 75 ? '#f4a642' : '#e55a5a';

  const DEMO = !latest && [
    { date:'2026-05-29', duration:402, efficiency:82, stages:{ deep:62, rem:88, core:198, awake:54 }, bedTime:'22:45', wakeTime:'06:12' },
    { date:'2026-05-28', duration:445, efficiency:89, stages:{ deep:78, rem:95, core:228, awake:44 }, bedTime:'22:30', wakeTime:'07:05' },
  ];
  const display = latest ? sorted : DEMO || [];
  const displayLatest = display[display.length - 1] || display[0];

  const chartData = [...(DEMO || last14)].map(n => ({
    value: Math.round((n.duration || 0) / 60 * 10) / 10,
    label: (n.date ?? '').slice(5),
    colour: n.efficiency >= 85 ? '#4caf7d' : n.efficiency >= 75 ? '#f4a642' : '#e55a5a',
  }));

  return (
    <Section title="Sleep">
      {!latest && (
        <div style={{
          padding: '8px 14px', borderRadius: 8, marginBottom: 14,
          background: 'rgba(74,158,255,0.08)', border: '0.5px solid rgba(74,158,255,0.25)',
          fontSize: 11.5, color: '#4a9eff',
        }}>
          📱 Live sleep data syncs from Apple Health on iPhone. Showing demo data below.
        </div>
      )}

      {displayLatest && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <RingChart
            value={displayLatest.efficiency ?? 0} max={100}
            size={120} thickness={10}
            colour={effColour(displayLatest.efficiency ?? 0)}
            label={`${displayLatest.efficiency ?? '—'}%`}
            sublabel="efficiency"
            labelSize={20}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', minWidth: 140 }}>
            <div style={{ fontSize: 24, fontWeight: 300, color: 'var(--text-primary)' }}>
              {Math.floor((displayLatest.duration ?? 0) / 60)}h{' '}
              <span style={{ fontSize: 16 }}>{(displayLatest.duration ?? 0) % 60}m</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              {displayLatest.bedTime} → {displayLatest.wakeTime}
            </div>
          </div>
        </div>
      )}

      {/* Stage breakdown */}
      {displayLatest?.stages && (
        <div style={{ ...cardSx, marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 10 }}>SLEEP STAGES</div>
          <StageBar height={16} stages={[
            { label:'Deep',  value: displayLatest.stages.deep  ?? 0, colour:'#4a9eff' },
            { label:'REM',   value: displayLatest.stages.rem   ?? 0, colour:'#9b5de5' },
            { label:'Core',  value: displayLatest.stages.core  ?? 0, colour:'#4caf7d' },
            { label:'Awake', value: displayLatest.stages.awake ?? 0, colour:'rgba(255,255,255,0.15)' },
          ]} />
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            {[
              { l:'Deep',  v: displayLatest.stages.deep,  c:'#4a9eff' },
              { l:'REM',   v: displayLatest.stages.rem,   c:'#9b5de5' },
              { l:'Core',  v: displayLatest.stages.core,  c:'#4caf7d' },
              { l:'Awake', v: displayLatest.stages.awake, c:'rgba(255,255,255,0.4)' },
            ].map(s => (
              <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.c }} />
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                  {s.l}: {Math.floor((s.v ?? 0) / 60)}h{(s.v ?? 0) % 60}m
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 14-night trend */}
      {chartData.length > 0 && (
        <div style={{ ...cardSx }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 12 }}>
            14-NIGHT TREND (hours)
          </div>
          <BarChart data={chartData} maxHeight={100} goalLine={8} />
        </div>
      )}
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. STIMULANT TRACKER
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_STIM_PRESETS = [
  { id:'coffee',         name:'Coffee',        type:'caffeine', amount:95,  unit:'mg' },
  { id:'espresso',       name:'Espresso',       type:'caffeine', amount:63,  unit:'mg' },
  { id:'energy_drink',   name:'Energy Drink',   type:'caffeine', amount:160, unit:'mg' },
  { id:'green_tea',      name:'Green Tea',       type:'caffeine', amount:30,  unit:'mg' },
  { id:'cigarette',      name:'Cigarette',      type:'nicotine', amount:12,  unit:'mg' },
  { id:'nicotine_patch', name:'Nicotine Patch', type:'nicotine', amount:21,  unit:'mg' },
  { id:'vape',           name:'Vape',           type:'nicotine', amount:3,   unit:'mg' },
];

function Stimulant({ stimLogs, addStimLog, removeStimLog, settings }) {
  const today     = todayStr();
  const caffLimit = settings?.caffeineLimitMg ?? 400;
  const nicLimit  = settings?.nicotineLimitMg ?? 20;

  // Hidden preset IDs — persisted per user
  const [hiddenPresets, setHiddenPresets] = useState(
    () => JSON.parse(localStorage.getItem('valerie_hidden_stim_presets') || '[]')
  );
  const [custom, setCustom]         = useState({ name:'', type:'caffeine', amount:'', unit:'mg' });
  const [showCustom, setShowCustom] = useState(false);
  const [manageMode, setManageMode] = useState(false);

  const visiblePresets = DEFAULT_STIM_PRESETS.filter(p => !hiddenPresets.includes(p.id));

  const hidePreset = (id) => {
    const next = [...hiddenPresets, id];
    setHiddenPresets(next);
    localStorage.setItem('valerie_hidden_stim_presets', JSON.stringify(next));
  };

  const restorePresets = () => {
    setHiddenPresets([]);
    localStorage.removeItem('valerie_hidden_stim_presets');
  };

  const todayLogs = useMemo(() =>
    [...(stimLogs || []).filter(l => l.date === today)].sort((a, b) => (b.time ?? '').localeCompare(a.time ?? '')),
    [stimLogs, today]);

  const caffTotal = todayLogs.filter(l => l.type === 'caffeine').reduce((s, l) => s + (l.amount || 0), 0);
  const nicTotal  = todayLogs.filter(l => l.type === 'nicotine').reduce((s, l) => s + (l.amount || 0), 0);

  const log = async (preset) => {
    await addStimLog({ ...preset, date: today, time: nowStr() });
  };

  return (
    <Section title="Stimulants">
      {/* Summary rings */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, ...cardSx, flex:1 }}>
          <RingChart value={caffTotal} max={caffLimit} size={72} thickness={6}
            colour={caffTotal > caffLimit * 0.8 ? '#f4a642' : 'var(--accent)'}
            label={`${caffTotal}`} sublabel="mg" labelSize={14} />
          <div>
            <div style={{ fontSize: 10, color:'var(--text-muted)', letterSpacing:'0.06em', marginBottom:2 }}>CAFFEINE</div>
            <div style={{ fontSize: 12, color:'var(--text-secondary)' }}>/ {caffLimit}mg limit</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, ...cardSx, flex:1 }}>
          <RingChart value={nicTotal} max={nicLimit} size={72} thickness={6}
            colour={nicTotal > nicLimit * 0.8 ? '#e55a5a' : '#f4a642'}
            label={`${nicTotal}`} sublabel="mg" labelSize={14} />
          <div>
            <div style={{ fontSize: 10, color:'var(--text-muted)', letterSpacing:'0.06em', marginBottom:2 }}>NICOTINE</div>
            <div style={{ fontSize: 12, color:'var(--text-secondary)' }}>/ {nicLimit}mg limit</div>
          </div>
        </div>
      </div>

      {/* Quick-log presets */}
      <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:6, alignItems:'center' }}>
        {visiblePresets.map(p => (
          <div key={p.id} style={{ position:'relative', display:'inline-flex' }}>
            <button onClick={() => log(p)} style={{
              padding:'6px 12px', borderRadius:20, fontSize:11.5, cursor:'pointer',
              border:'0.5px solid var(--card-border)', background:'var(--hover-bg)',
              color:'var(--text-secondary)', transition:'all 0.15s ease',
              paddingRight: manageMode ? 24 : 12,
            }}
            onMouseEnter={e => { if (!manageMode) e.currentTarget.style.borderColor='var(--accent)'; }}
            onMouseLeave={e => e.currentTarget.style.borderColor='var(--card-border)'}>
              {p.name} <span style={{ opacity:0.6, fontSize:10 }}>{p.amount}{p.unit}</span>
            </button>
            {manageMode && (
              <button
                onClick={() => hidePreset(p.id)}
                title="Remove this preset"
                style={{
                  position:'absolute', right:2, top:'50%', transform:'translateY(-50%)',
                  width:18, height:18, borderRadius:'50%', border:'none', cursor:'pointer',
                  background:'#e55a5a', color:'#fff', fontSize:11, lineHeight:1,
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}
              >×</button>
            )}
          </div>
        ))}
        <button
          onClick={() => setManageMode(p => !p)}
          style={{ ...btnGhost, borderRadius:20, fontSize:11.5, padding:'5px 10px',
            borderColor: manageMode ? 'var(--accent)' : 'var(--card-border)',
            color: manageMode ? 'var(--accent)' : 'var(--text-secondary)',
          }}
          title="Manage presets"
        >⚙</button>
        <button onClick={() => setShowCustom(p => !p)} style={{ ...btnGhost, borderRadius:20, fontSize:11.5 }}>+ Custom</button>
      </div>

      {manageMode && hiddenPresets.length > 0 && (
        <div style={{ marginBottom:10 }}>
          <button onClick={restorePresets} style={{ ...btnGhost, fontSize:11, padding:'4px 10px' }}>
            ↩ Restore all presets ({hiddenPresets.length} hidden)
          </button>
        </div>
      )}

      {/* Custom log form */}
      {showCustom && (
        <div style={{ ...cardSx, marginBottom:14, display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:'1 1 120px' }}>
            <label style={lblSx}>Name</label>
            <input value={custom.name} onChange={e => setCustom(p => ({ ...p, name:e.target.value }))}
              placeholder="e.g. Pre-workout" style={inputSx}
              onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--input-border)'} />
          </div>
          <div style={{ flex:'0 0 80px' }}>
            <label style={lblSx}>Amount (mg)</label>
            <input type="number" value={custom.amount} onChange={e => setCustom(p => ({ ...p, amount: parseInt(e.target.value)||0 }))}
              style={inputSx}
              onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--input-border)'} />
          </div>
          <div style={{ flex:'0 0 100px' }}>
            <label style={lblSx}>Type</label>
            <select value={custom.type} onChange={e => setCustom(p => ({ ...p, type:e.target.value }))} style={{ ...inputSx, cursor:'pointer' }}>
              <option value="caffeine">Caffeine</option>
              <option value="nicotine">Nicotine</option>
            </select>
          </div>
          <button onClick={() => { if (custom.name && custom.amount) { log(custom); setShowCustom(false); setCustom({ name:'', type:'caffeine', amount:'', unit:'mg' }); } }} style={btnPrimary}>Log</button>
        </div>
      )}

      {/* Today's log */}
      <div style={{ ...cardSx }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:'0.07em' }}>TODAY</div>
          {todayLogs.length > 0 && (
            <span style={{ fontSize:10, color:'var(--text-muted)' }}>Tap × to remove an entry</span>
          )}
        </div>
        {todayLogs.length === 0 ? (
          <p style={{ fontSize:12.5, color:'var(--text-muted)', margin:0 }}>Nothing logged today.</p>
        ) : (
          todayLogs.map((l, i) => (
            <div key={l.id || i} style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'7px 0', borderBottom: i < todayLogs.length-1 ? '0.5px solid var(--sidebar-divider)' : 'none',
            }}>
              <div>
                <span style={{ fontSize:12.5, color:'var(--text-primary)' }}>{l.name}</span>
                <span style={{ fontSize:10.5, color:'var(--text-muted)', marginLeft:8 }}>
                  {l.type === 'caffeine' ? '☕' : '🚬'} {l.amount}{l.unit}
                </span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>{l.time}</span>
                {l.id && removeStimLog && (
                  <button
                    onClick={() => removeStimLog(l.id)}
                    title="Remove this entry"
                    style={{
                      width:20, height:20, borderRadius:'50%', border:'none', cursor:'pointer',
                      background:'rgba(229,90,90,0.12)', color:'#e55a5a',
                      fontSize:13, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(229,90,90,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(229,90,90,0.12)'}
                  >×</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HEALTH TAB
// ═══════════════════════════════════════════════════════════════════════════════
const SUB_SECTIONS = [
  { id:'overview',    label:'Overview',    icon:'⬡' },
  { id:'habits',      label:'Habits',      icon:'🔥' },
  { id:'nutrition',   label:'Nutrition',   icon:'🥗' },
  { id:'workout',     label:'Workout',     icon:'💪' },
  { id:'water',       label:'Water',       icon:'💧' },
  { id:'body',        label:'Body',        icon:'⚖' },
  { id:'supplements', label:'Supplements', icon:'💊' },
  { id:'sleep',       label:'Sleep',       icon:'🌙' },
  { id:'stimulant',   label:'Stimulant',   icon:'☕' },
];

export default function Health({ settings }) {
  const [active, setActive] = useState('overview');
  const settings_ = settings ?? storage.get(STORAGE_KEYS.SETTINGS, {});

  const { items: habits,     add: addHabit,     update: updateHabit,     remove: removeHabit }     = useCollection('habits',          STORAGE_KEYS.HABITS);
  const { items: waterLogs,  add: addWaterLog  }                                                    = useCollection('water_logs',      STORAGE_KEYS.WATER);
  const { items: nutritionLogs, add: addNutritionLog, update: updateNutritionLog }                 = useCollection('nutrition_logs',  STORAGE_KEYS.MACROS);
  const { items: workoutLogs, add: addWorkoutLog }                                                  = useCollection('workout_logs',    STORAGE_KEYS.WORKOUT_LOGS);
  const { items: bodyMetrics, add: addBodyMetric }                                                  = useCollection('body_metrics',    STORAGE_KEYS.BODY);
  const { items: supplements, add: addSupplement, remove: removeSupplement }                        = useCollection('supplements',     STORAGE_KEYS.SUPPLEMENTS);
  const { items: suppLogs,   add: addSuppLog }                                                      = useCollection('supplement_logs', STORAGE_KEYS.SUPP_LOGS);
  const { items: sleepData }                                                                         = useCollection('sleep_data',      STORAGE_KEYS.SLEEP);
  const { items: stimLogs,   add: addStimLog,   remove: removeStimLog }                             = useCollection('stimulant_logs',  STORAGE_KEYS.STIMULANTS);

  const renderSection = () => {
    const p = { settings: settings_ };
    switch (active) {
      case 'overview':    return <Overview     {...p} habits={habits} waterLogs={waterLogs} nutritionLogs={nutritionLogs} sleepData={sleepData} supplements={supplements} suppLogs={suppLogs} stimLogs={stimLogs} workoutLogs={workoutLogs} bodyMetrics={bodyMetrics} />;
      case 'habits':      return <Habits       habits={habits} addHabit={addHabit} updateHabit={updateHabit} removeHabit={removeHabit} />;
      case 'nutrition':   return <Nutrition    {...p} nutritionLogs={nutritionLogs} addNutritionLog={addNutritionLog} updateNutritionLog={updateNutritionLog} />;
      case 'workout':     return <Workout      workoutLogs={workoutLogs} addWorkoutLog={addWorkoutLog} settings={settings_} />;
      case 'water':       return <Water        {...p} waterLogs={waterLogs} addWaterLog={addWaterLog} />;
      case 'body':        return <Body         bodyMetrics={bodyMetrics} addBodyMetric={addBodyMetric} />;
      case 'supplements': return <Supplements  supplements={supplements} suppLogs={suppLogs} addSupplement={addSupplement} removeSupplement={removeSupplement} addSuppLog={addSuppLog} />;
      case 'sleep':       return <Sleep        sleepData={sleepData} />;
      case 'stimulant':   return <Stimulant    {...p} stimLogs={stimLogs} addStimLog={addStimLog} removeStimLog={removeStimLog} />;
      default:            return null;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left nav */}
      <div style={{
        width: 150, flexShrink: 0,
        borderRight: '0.5px solid var(--sidebar-divider)',
        display: 'flex', flexDirection: 'column',
        padding: '16px 0', gap: 2, overflowY: 'auto',
      }}>
        {SUB_SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActive(s.id)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', border: 'none', cursor: 'pointer',
            borderLeft: `2px solid ${active === s.id ? 'var(--accent)' : 'transparent'}`,
            color: active === s.id ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: 13, fontWeight: active === s.id ? 500 : 400,
            transition: 'all 0.15s ease', textAlign: 'left',
            background: active === s.id ? 'var(--active-bg)' : 'transparent',
          }}>
            <span style={{ fontSize: 15, opacity: 0.8 }}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {renderSection()}
      </div>
    </div>
  );
}
