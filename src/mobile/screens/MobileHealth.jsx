//  MobileHealth.jsx  Health tab matching desktop overview layout
import { useState, useMemo, useRef } from 'react';
import { useCollection } from '../../supabase/useCollection.js';
import { STORAGE_KEYS }  from '../../utils/storage.js';
import { searchOpenFoodFacts, lookupBarcode, startBarcodeScan } from '../../utils/openFoodFacts.js';
import { scaleMicros } from '../../utils/micronutrients.js';
import { toLocalDateKey } from '../../utils/localDate.js';
import { currentWaterGoal, sleepWindow } from '../../utils/waterGoal.js';
import { waterAdvice } from '../../domain/water.js';
import { weightCoach } from '../../domain/weight.js';
import WeightChart from '../../components/WeightChart.jsx';

const nowStr = () => new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });

//  Shared primitives 
function MCard({ children, style = {} }) {
  return (
    <div style={{ background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{ width: 14, height: 1, background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(255,255,255,0.08),transparent)' }} />
    </div>
  );
}

function ProgressBar({ value, max, color = 'var(--accent)' }) {
  const pct = max > 0 ? Math.min(100, value / max * 100) : 0;
  return (
    <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, marginTop: 8 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color,
        borderRadius: 2, transition: 'width 0.5s ease' }} />
    </div>
  );
}

//  Sub-nav 
const SUB_TABS = ['Overview', 'Sleep', 'Nutrition', 'Water', 'Body'];

//  Sleep ring 
function SleepRing({ pct, size = 76, thickness = 7 }) {
  const r    = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const p    = Math.min(1, pct / 100);
  const color = pct >= 80 ? '#4caf7d' : pct >= 60 ? '#f59e0b' : '#e05555';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={`${p * circ} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color, lineHeight: 1 }}>{pct}%</div>
        <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>QTY</div>
      </div>
    </div>
  );
}

//  Sleep stage bar 
function SleepStageBar({ sleep }) {
  const stages = [
    { key: 'deep',  label: 'Deep',  color: '#5b9cf6', hours: sleep?.deepSleep  || 0 },
    { key: 'rem',   label: 'REM',   color: '#e879a0', hours: sleep?.remSleep   || 0 },
    { key: 'core',  label: 'Core',  color: '#a78bfa', hours: sleep?.coreSleep  || 0 },
    { key: 'awake', label: 'Awake', color: '#4caf7d', hours: sleep?.awakeTime  || 0 },
  ];
  const total = stages.reduce((s, st) => s + st.hours, 0);
  if (total === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
        {stages.filter(s => s.hours > 0).map(s => (
          <div key={s.key} style={{
            flex: s.hours / total, background: s.color,
            transition: 'flex 0.5s ease',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
        {stages.filter(s => s.hours > 0).map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              {s.label}: {s.hours >= 1 ? `${Math.floor(s.hours)}h${Math.round((s.hours%1)*60)}m` : `${Math.round(s.hours*60)}m`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

//  Vital stat mini-card 
function VitalCard({ label, value, unit, sub, color = 'var(--text-primary)', barValue, barMax, barColor }) {
  return (
    <div style={{ background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 22, fontWeight: 200, color, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
      {barMax !== undefined && (
        <ProgressBar value={barValue || 0} max={barMax} color={barColor || color} />
      )}
    </div>
  );
}

//  Overview tab 
function OverviewTab({ settings, today }) {
  const { items: waterLogs     = [] } = useCollection('water_logs',      'valerie_water_logs');
  const { items: nutritionLogs = [] } = useCollection('nutrition_logs',  'valerie_nutrition_logs');
  const { items: sleepData     = [] } = useCollection('sleep_data',      STORAGE_KEYS.SLEEP);
  const { items: supplements   = [] } = useCollection('supplements',     'valerie_supplements');
  const { items: habits        = [] } = useCollection('habits',          STORAGE_KEYS.HABITS);
  const { items: bodyMetrics   = [] } = useCollection('body_metrics',    STORAGE_KEYS.BODY);
  const { items: workoutLogs   = [] } = useCollection('workout_logs',    STORAGE_KEYS.WORKOUT_LOGS);
  const { items: stimLogs      = [] } = useCollection('stimulant_logs',  STORAGE_KEYS.STIMULANTS);

  //  Sleep 
  const lastSleep = useMemo(() =>
    [...sleepData].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0],
  [sleepData]);
  const sleepHours = (lastSleep?.duration || 0) / 60; // sleep_data stores minutes
  const sleepH     = Math.floor(sleepHours);
  const sleepM     = Math.round((sleepHours % 1) * 60);
  const sleepQ     = Number(lastSleep?.efficiency ?? lastSleep?.quality) || 0;

  //  Water
  const waterGoal  = currentWaterGoal(settings);
  const todayWater = useMemo(() =>
    waterLogs.filter(l => l.date === today).reduce((s, l) => s + (l.amount || 0), 0),
  [waterLogs, today]);

  //  Nutrition  one row per DAY (todayLog.meals[]), same schema as desktop
  const calGoal    = settings?.macroGoal ?? 2500;
  const protGoal   = settings?.proteinGoal ?? 160;
  const carbGoal   = settings?.macros?.carbs ?? 250;
  const fatGoal    = settings?.macros?.fat ?? 80;
  const todayLog   = useMemo(() => nutritionLogs.find(l => l.date === today), [nutritionLogs, today]);
  const todayMeals = todayLog?.meals ?? [];
  const totCal  = todayMeals.reduce((s, m) => s + (m.calories || 0), 0);
  const totProt = todayMeals.reduce((s, m) => s + (m.protein  || 0), 0);
  const totCarb = todayMeals.reduce((s, m) => s + (m.carbs    || 0), 0);
  const totFat  = todayMeals.reduce((s, m) => s + (m.fat      || 0), 0);

  //  Supplements 
  const suppTaken    = supplements.filter(s => s.takenDates?.includes(today)).length;
  const suppRemaining = supplements.length - suppTaken;

  //  Habits 
  const habitsDone = habits.filter(h => h.completedDates?.includes(today)).length;

  //  Workout 
  const todayWorkout = workoutLogs.find(w => w.date === today);

  //  Caffeine
  const caffLimit = settings?.caffeineLimitMg ?? 400;
  const caffToday = useMemo(() =>
    stimLogs.filter(l => l.date === today).reduce((s, l) => s + (l.caffeineMg || 0), 0),
  [stimLogs, today]);

  //  Body 
  const latestBody = useMemo(() =>
    [...bodyMetrics].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0],
  [bodyMetrics]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/*  Sleep Quality  */}
      <div>
        <SectionLabel>Sleep Quality</SectionLabel>
        <MCard style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <SleepRing pct={sleepQ} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 200, color: 'var(--text-primary)', lineHeight: 1 }}>
                {sleepH}h
              </span>
              <span style={{ fontSize: 18, fontWeight: 200, color: 'var(--text-secondary)' }}>
                {sleepM}m
              </span>
              {lastSleep?.bedtime && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                  {lastSleep.bedtime}   {lastSleep.wakeTime}
                </span>
              )}
            </div>
            <SleepStageBar sleep={lastSleep} />
            {!lastSleep && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>No sleep logged yet</div>
            )}
          </div>
        </MCard>
      </div>

      {/*  Vitals  */}
      <div>
        <SectionLabel>Vitals</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <VitalCard label="Water" value={(todayWater/1000).toFixed(1)} unit="L"
            sub={`of ${(waterGoal/1000).toFixed(1)}L`} color="#4a9eff"
            barValue={todayWater} barMax={waterGoal} barColor="#4a9eff" />
          <VitalCard label="Calories" value={totCal} unit="kcal"
            sub={`of ${calGoal}`} color="#f59e0b"
            barValue={totCal} barMax={calGoal} barColor="#f59e0b" />
          <VitalCard label="Protein" value={`${totProt}g`}
            sub={`of ${protGoal}g`} color="#e879a0"
            barValue={totProt} barMax={protGoal} barColor="#e879a0" />
          <VitalCard label="Carbs" value={`${totCarb}g`}
            sub={`of ${carbGoal}g`} color="#a78bfa"
            barValue={totCarb} barMax={carbGoal} barColor="#a78bfa" />
          <VitalCard label="Fat" value={`${totFat}g`}
            sub={`of ${fatGoal}g`} color="#4caf7d"
            barValue={totFat} barMax={fatGoal} barColor="#4caf7d" />
          <VitalCard label="Caffeine" value={caffToday} unit="mg"
            sub={`/ ${caffLimit}mg`} color="#f97316"
            barValue={caffToday} barMax={caffLimit} barColor="#f97316" />
        </div>
      </div>

      {/*  Secondary vitals  */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <VitalCard label="Habits" value={`${habitsDone}/${habits.length}`}
          sub={habits.length > 0 ? `${habits.length - habitsDone} left` : 'None set up'}
          color="var(--accent)" />
        <VitalCard label="Supplements" value={`${suppTaken}/${supplements.length}`}
          sub={`${suppRemaining} remaining`} color="#a78bfa" />
        <VitalCard label="Workout"
          value={todayWorkout ? 'Done' : 'Not yet'}
          sub={todayWorkout ? `${todayWorkout.exercises?.length || 0} exercises` : 'no session'}
          color={todayWorkout ? '#4caf7d' : 'var(--text-muted)'} />
        <VitalCard label="Water Goal"
          value={`${Math.round(todayWater / waterGoal * 100)}%`}
          sub={`${(todayWater/1000).toFixed(1)}L of ${(waterGoal/1000).toFixed(1)}L`}
          color="#4a9eff"
          barValue={todayWater} barMax={waterGoal} barColor="#4a9eff" />
      </div>

      {/*  Body  */}
      {latestBody && (
        <div>
          <SectionLabel>Body</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {latestBody.weight && (
              <VitalCard label="Weight" value={latestBody.weight} unit="kg" color="var(--text-primary)" />
            )}
            {latestBody.bodyFat && (
              <VitalCard label="Body Fat" value={latestBody.bodyFat} unit="%" color="#f59e0b" />
            )}
            {latestBody.muscle && (
              <VitalCard label="Muscle" value={latestBody.muscle} unit="%" color="#4caf7d" />
            )}
          </div>
        </div>
      )}

      {/*  Today's Meals  */}
      {todayMeals.length > 0 && (
        <div>
          <SectionLabel>Today's Meals</SectionLabel>
          <MCard style={{ padding: 0 }}>
            {[...todayMeals].sort((a, b) => (a.time || '').localeCompare(b.time || '')).map((m, i) => (
              <div key={m.id || i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 16px',
                borderBottom: i < todayMeals.length - 1 ? '0.5px solid var(--card-border)' : 'none',
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                  {m.time && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, width: 38 }}>{m.time}</span>
                  )}
                  <span style={{ fontSize: 13, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexShrink: 0, fontSize: 10, color: 'var(--text-muted)' }}>
                  <span style={{ color: '#f59e0b' }}>{m.calories}kcal</span>
                  {m.protein > 0 && <span style={{ color: '#e879a0' }}>{m.protein}p</span>}
                  {m.carbs  > 0 && <span style={{ color: '#a78bfa' }}>{m.carbs}c</span>}
                  {m.fat    > 0 && <span style={{ color: '#4caf7d' }}>{m.fat}f</span>}
                </div>
              </div>
            ))}
          </MCard>
        </div>
      )}
    </div>
  );
}

//  Sleep tab 
function SleepTab({ today }) {
  const { items: sleepData = [] } = useCollection('sleep_data', STORAGE_KEYS.SLEEP);
  const sorted = useMemo(() =>
    [...sleepData].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 7),
  [sleepData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sorted.length === 0 ? (
        <MCard>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No sleep logged yet. Log from desktop or sync via Health Auto Export.
          </div>
        </MCard>
      ) : sorted.map((s, i) => {
        const mins  = s.duration || 0; // minutes
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        const score = Number(s.efficiency ?? s.quality) || 0;
        const color = score >= 80 ? '#4caf7d' : score >= 60 ? '#f59e0b' : '#e05555';
        return (
          <MCard key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <SleepRing pct={score} size={60} thickness={6} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.date}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {s.bedtime}   {s.wakeTime}
                </span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 200, color: 'var(--text-primary)', lineHeight: 1 }}>
                {h}h {m}m
              </div>
              <SleepStageBar sleep={s} />
            </div>
          </MCard>
        );
      })}
    </div>
  );
}

//  Add Food sheet  search (OpenFoodFacts) + barcode scan, same schema as desktop
function AddFoodSheet({ onAdd, onClose }) {
  const [mode, setMode]       = useState('search'); // 'search' | 'scan'
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [qty, setQty]         = useState('100');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const videoRef  = useRef(null);
  const stopRef   = useRef(null);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try { setResults(await searchOpenFoodFacts(query)); }
    catch { setResults([]); }
    finally { setSearching(false); }
  };

  const startScan = () => {
    setScanError(''); setScanning(true);
    stopRef.current = startBarcodeScan(videoRef.current, {
      onDetect: async (code) => {
        stopScan();
        try {
          const food = await lookupBarcode(code);
          setSelected(food); setMode('search'); setQuery(food.name); setResults([food]);
        } catch { setScanError('Product not found for that barcode.'); }
      },
      onError: (err) => { setScanError(err.message); setScanning(false); },
    });
  };
  const stopScan = () => { stopRef.current?.(); stopRef.current = null; setScanning(false); };

  const confirmAdd = () => {
    if (!selected) return;
    const factor = (parseFloat(qty) || 100) / 100;
    onAdd({
      id: `m_${Date.now()}`,
      name: selected.name,
      calories: Math.round(selected.per100.calories * factor),
      protein:  Math.round(selected.per100.protein  * factor * 10) / 10,
      carbs:    Math.round(selected.per100.carbs    * factor * 10) / 10,
      fat:      Math.round(selected.per100.fat      * factor * 10) / 10,
      micros:   scaleMicros(selected.per100.micros, factor),
      qty: parseFloat(qty), unit: 'g',
      time: nowStr(),
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-end' }} onClick={() => { stopScan(); onClose(); }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxHeight: '82vh', overflowY: 'auto',
        background: 'var(--bg-panel)', borderRadius: '20px 20px 0 0', padding: 18,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Log food</span>
          <button onClick={() => { stopScan(); onClose(); }} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { stopScan(); setMode('search'); }} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: mode === 'search' ? '1px solid var(--accent)' : '0.5px solid var(--card-border)',
            background: mode === 'search' ? 'var(--active-bg)' : 'none',
            color: mode === 'search' ? 'var(--accent)' : 'var(--text-secondary)',
          }}>🔍 Search</button>
          <button onClick={() => { setMode('scan'); startScan(); }} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: mode === 'scan' ? '1px solid var(--accent)' : '0.5px solid var(--card-border)',
            background: mode === 'scan' ? 'var(--active-bg)' : 'none',
            color: mode === 'scan' ? 'var(--accent)' : 'var(--text-secondary)',
          }}>📷 Scan barcode</button>
        </div>

        {mode === 'scan' && (
          <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', position: 'relative' }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', height: 220, objectFit: 'cover', display: scanning ? 'block' : 'none' }} />
            {!scanning && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {scanError || 'Starting camera…'}
              </div>
            )}
            {scanning && (
              <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: '#fff' }}>
                Point at a barcode
              </div>
            )}
          </div>
        )}

        {mode === 'search' && !selected && (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="Search food (e.g. chicken breast)" style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, border: '0.5px solid var(--card-border)',
                background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 14, outline: 'none',
              }} />
              <button onClick={doSearch} style={{
                padding: '0 16px', borderRadius: 10, border: 'none', background: 'var(--accent)',
                color: 'var(--bg-base)', fontWeight: 600, cursor: 'pointer' }}>
                {searching ? '…' : 'Go'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {results.map((r, i) => (
                <button key={i} onClick={() => setSelected(r)} style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 10,
                  border: '0.5px solid var(--card-border)', background: 'var(--bg-base)', cursor: 'pointer',
                }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {r.per100.calories}kcal · P{r.per100.protein}g · C{r.per100.carbs}g · F{r.per100.fat}g / 100g
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{selected.name}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" value={qty} onChange={e => setQty(e.target.value)} style={{
                width: 90, padding: '9px 10px', borderRadius: 10, border: '0.5px solid var(--card-border)',
                background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 14, outline: 'none',
              }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>grams</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              ≈ {Math.round(selected.per100.calories * (parseFloat(qty) || 0) / 100)}kcal ·
              {' '}P{Math.round(selected.per100.protein * (parseFloat(qty) || 0) / 100 * 10) / 10}g ·
              {' '}C{Math.round(selected.per100.carbs * (parseFloat(qty) || 0) / 100 * 10) / 10}g ·
              {' '}F{Math.round(selected.per100.fat * (parseFloat(qty) || 0) / 100 * 10) / 10}g
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSelected(null)} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: '0.5px solid var(--card-border)',
                background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Back</button>
              <button onClick={confirmAdd} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                background: 'var(--accent)', color: 'var(--bg-base)', fontWeight: 600, cursor: 'pointer' }}>
                Log it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

//  Nutrition tab
function NutritionTab({ settings, today }) {
  const { items: nutritionLogs = [], add: addNutritionLog, update: updateNutritionLog } = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);
  const calGoal  = settings?.macros?.calories ?? settings?.macroGoal ?? 2500;
  const protGoal = settings?.macros?.protein  ?? settings?.proteinGoal ?? 160;
  const carbGoal = settings?.macros?.carbs    ?? 250;
  const fatGoal  = settings?.macros?.fat      ?? 80;
  const [showAdd, setShowAdd] = useState(false);

  const todayLog = useMemo(() => nutritionLogs.find(l => l.date === today), [nutritionLogs, today]);
  const meals    = todayLog?.meals ?? [];

  const totCal  = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const totProt = meals.reduce((s, m) => s + (m.protein  || 0), 0);
  const totCarb = meals.reduce((s, m) => s + (m.carbs    || 0), 0);
  const totFat  = meals.reduce((s, m) => s + (m.fat      || 0), 0);

  async function addMealEntry(entry) {
    const newMeals = [...meals, entry];
    const newTotals = newMeals.reduce((s, m) => ({
      calories: s.calories + (m.calories || 0), protein: s.protein + (m.protein || 0),
      carbs: s.carbs + (m.carbs || 0), fat: s.fat + (m.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    if (todayLog?.id) await updateNutritionLog(todayLog.id, { meals: newMeals, ...newTotals });
    else await addNutritionLog({ date: today, meals: newMeals, ...newTotals });
    setShowAdd(false);
  }

  async function removeMealEntry(id) {
    if (!todayLog?.id) return;
    const newMeals = meals.filter(m => m.id !== id);
    const newTotals = newMeals.reduce((s, m) => ({
      calories: s.calories + (m.calories || 0), protein: s.protein + (m.protein || 0),
      carbs: s.carbs + (m.carbs || 0), fat: s.fat + (m.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    await updateNutritionLog(todayLog.id, { meals: newMeals, ...newTotals });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Macro summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <VitalCard label="Calories" value={totCal} unit="kcal" sub={`of ${calGoal}`}
          color="#f59e0b" barValue={totCal} barMax={calGoal} barColor="#f59e0b" />
        <VitalCard label="Protein"  value={`${totProt}g`} sub={`of ${protGoal}g`}
          color="#e879a0" barValue={totProt} barMax={protGoal} barColor="#e879a0" />
        <VitalCard label="Carbs"    value={`${totCarb}g`} sub={`of ${carbGoal}g`}
          color="#a78bfa" barValue={totCarb} barMax={carbGoal} barColor="#a78bfa" />
        <VitalCard label="Fat"      value={`${totFat}g`} sub={`of ${fatGoal}g`}
          color="#4caf7d" barValue={totFat} barMax={fatGoal} barColor="#4caf7d" />
      </div>

      {/* Log food button */}
      <button onClick={() => setShowAdd(true)} style={{
        padding: '12px 0', borderRadius: 12, border: 'none', background: 'var(--accent)',
        color: 'var(--bg-base)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}>+ Log food</button>

      {/* Meal list */}
      <MCard style={{ padding: 0 }}>
        {meals.length === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-muted)' }}>Nothing logged today</div>
        ) : [...meals].sort((a, b) => (a.time || '').localeCompare(b.time || '')).map((m, i) => (
          <div key={m.id || i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px',
            borderBottom: i < meals.length - 1 ? '0.5px solid var(--card-border)' : 'none',
          }}>
            <div style={{ minWidth: 0 }}>
              {m.time && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{m.time}</div>}
              <div style={{ fontSize: 13, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.name}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, fontSize: 11 }}>
              <span style={{ color: '#f59e0b' }}>{m.calories}kcal</span>
              <span style={{ color: '#e879a0' }}>{m.protein}p</span>
              <span style={{ color: '#a78bfa' }}>{m.carbs}c</span>
              <span style={{ color: '#4caf7d' }}>{m.fat}f</span>
              <button onClick={() => removeMealEntry(m.id)} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 15,
                cursor: 'pointer', padding: '2px 4px', WebkitTapHighlightColor: 'transparent' }}>×</button>
            </div>
          </div>
        ))}
      </MCard>

      {showAdd && <AddFoodSheet onAdd={addMealEntry} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

//  Water tab 
function WaterTab({ settings, today }) {
  const { items: waterLogs = [], add: addWaterLog, remove: removeWaterLog } = useCollection('water_logs', STORAGE_KEYS.WATER);
  const goalMl     = currentWaterGoal(settings);
  const todayWater = useMemo(() =>
    waterLogs.filter(l => l.date === today).reduce((s, l) => s + (l.amount || 0), 0),
  [waterLogs, today]);
  const pct = Math.min(100, Math.round(todayWater / goalMl * 100));
  const advice = waterAdvice({ totalMl: todayWater, goalMl, now: new Date(), ...sleepWindow() });
  const [custom, setCustom] = useState('');

  const log = (ml) => addWaterLog({ date: today, amount: ml, time: nowStr() });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <MCard style={{ textAlign: 'center', padding: '28px 16px' }}>
        <div style={{ fontSize: 52, fontWeight: 200, color: '#4a9eff', lineHeight: 1 }}>
          {(todayWater/1000).toFixed(1)}L
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
          of {(goalMl/1000).toFixed(1)}L goal · {pct}%
        </div>
        <ProgressBar value={todayWater} max={goalMl} color="#4a9eff" />
        {advice && (
          <div role="status" style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.45, color: advice.status === 'behind' ? '#e8a13a' : advice.status === 'done' || advice.status === 'ahead' ? '#4caf7d' : 'var(--text-secondary)' }}>{advice.message}</div>
        )}
        {advice?.sipMl > 0 && (
          <button onClick={() => log(advice.sipMl)} style={{ marginTop: 10, minHeight: 44, padding: '0 20px', borderRadius: 12, border: 'none', background: '#4a9eff', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>Log {advice.sipMl} ml</button>
        )}
      </MCard>

      {/* Quick-log buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[250, 500, 750].map(ml => (
          <button key={ml} onClick={() => log(ml)} style={{
            flex: 1, padding: '12px 0', borderRadius: 12, border: '0.5px solid var(--card-border)',
            background: 'var(--bg-panel)', color: '#4a9eff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}>+{ml}ml</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="number" value={custom} onChange={e => setCustom(e.target.value)}
          placeholder="Custom amount (ml)" style={{
          flex: 1, padding: '10px 12px', borderRadius: 10, border: '0.5px solid var(--card-border)',
          background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: 14, outline: 'none',
        }} />
        <button onClick={() => { const n = parseFloat(custom); if (n > 0) { log(n); setCustom(''); } }} style={{
          padding: '0 18px', borderRadius: 10, border: 'none', background: 'var(--accent)',
          color: 'var(--bg-base)', fontWeight: 600, cursor: 'pointer' }}>Log</button>
      </div>

      <MCard style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--card-border)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Today's intake</span>
        </div>
        {waterLogs.filter(l => l.date === today).length === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-muted)' }}>Nothing logged yet</div>
        ) : (
          [...waterLogs.filter(l => l.date === today)].reverse().map((l, i, arr) => (
            <div key={l.id || i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '11px 16px',
              borderBottom: i < arr.length - 1 ? '0.5px solid var(--card-border)' : 'none',
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {l.amount >= 1000 ? `${l.amount/1000}L` : `${l.amount}ml`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.time}</span>
                <button onClick={() => removeWaterLog(l.id)} style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 15,
                  cursor: 'pointer', padding: '2px 4px', WebkitTapHighlightColor: 'transparent' }}>×</button>
              </div>
            </div>
          ))
        )}
      </MCard>
    </div>
  );
}

//  Body tab 
function BodyTab({ today, settings }) {
  const { items: bodyMetrics = [], add: addBodyMetric } = useCollection('body_metrics', STORAGE_KEYS.BODY);
  const sorted = useMemo(() =>
    [...bodyMetrics].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
  [bodyMetrics]);
  const latest = sorted[0];
  // Weight coach: smoothed trend, weekly rate, pace vs the Coach goal
  const coach = useMemo(() => weightCoach(bodyMetrics, settings?.coachGoal?.targets?.weeklyRateKg ?? null), [bodyMetrics, settings?.coachGoal]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ weight: '', bodyFat: '', muscle: '' });

  async function save() {
    if (!form.weight) return;
    await addBodyMetric({
      date: today,
      weight:  form.weight  ? parseFloat(form.weight)  : undefined,
      bodyFat: form.bodyFat ? parseFloat(form.bodyFat) : undefined,
      muscle:  form.muscle  ? parseFloat(form.muscle)  : undefined,
    });
    setForm({ weight: '', bodyFat: '', muscle: '' });
    setShowAdd(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button onClick={() => setShowAdd(v => !v)} style={{
        padding: '12px 0', borderRadius: 12, border: 'none', background: 'var(--accent)',
        color: 'var(--bg-base)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}>{showAdd ? 'Cancel' : '+ Log today’s metrics'}</button>

      {showAdd && (
        <MCard style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[['weight', 'Weight', 'kg'], ['bodyFat', 'Body Fat', '%'], ['muscle', 'Muscle', '%']].map(([k, label, unit]) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label} ({unit})</div>
              <input type="number" value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                placeholder={k === 'weight' ? 'e.g. 80' : k === 'bodyFat' ? 'e.g. 15' : 'e.g. 40'} style={{
                width: '100%', padding: '9px 12px', borderRadius: 10, border: '0.5px solid var(--card-border)',
                background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }} />
            </div>
          ))}
          <button onClick={save} disabled={!form.weight} style={{
            padding: '11px 0', borderRadius: 10, border: 'none', background: 'var(--accent)',
            color: 'var(--bg-base)', fontWeight: 600, cursor: 'pointer', opacity: form.weight ? 1 : 0.4,
          }}>Save</button>
        </MCard>
      )}

      {!latest ? (
        <MCard>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No body metrics logged yet.
          </div>
        </MCard>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {latest.weight     && <VitalCard label="Weight"   value={latest.weight}     unit="kg" color="var(--text-primary)" />}
            {latest.bodyFat    && <VitalCard label="Body Fat" value={latest.bodyFat}    unit="%"  color="#f59e0b" />}
            {latest.muscle && <VitalCard label="Muscle"   value={latest.muscle} unit="%" color="#4caf7d" />}
          </div>

          {coach && coach.series.length > 1 && (
            <MCard style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 22, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 4 }}>TREND WEIGHT</div>
                  <div className="val-num" style={{ fontSize: 30, fontWeight: 500, color: 'var(--tab-accent)', lineHeight: 1 }}>{coach.trend}<span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 3 }}>kg</span></div>
                </div>
                <div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 4 }}>RATE</div>
                  <div className="val-num" style={{ fontSize: 20, color: 'var(--text-primary)', lineHeight: 1.1 }}>{coach.rate == null ? '—' : (coach.rate > 0 ? '+' : '') + coach.rate}<span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 3 }}>kg/week</span></div>
                </div>
              </div>
              {coach.pace && <div role="status" style={{ fontSize: 13, lineHeight: 1.45, color: coach.pace.status === 'on-track' ? '#4caf7d' : '#e8a13a' }}>{coach.pace.message}</div>}
              {coach.rate == null && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Log weight on a few days over a week or more to see your rate.</div>}
              <WeightChart series={coach.series} />
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Dots are weigh-ins; the line is your trend. Judge progress by the line.</div>
            </MCard>
          )}

          <MCard style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--card-border)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>History</span>
            </div>
            {sorted.slice(0, 10).map((m, i) => (
              <div key={m.id || i} style={{
                display: 'flex', justifyContent: 'space-between', padding: '10px 16px',
                borderBottom: i < Math.min(sorted.length, 10) - 1 ? '0.5px solid var(--card-border)' : 'none',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.date}</span>
                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  {m.weight     && <span style={{ color: 'var(--text-secondary)' }}>{m.weight}kg</span>}
                  {m.bodyFat    && <span style={{ color: '#f59e0b' }}>{m.bodyFat}%</span>}
                  {m.muscle && <span style={{ color: '#4caf7d' }}>{m.muscle}%</span>}
                </div>
              </div>
            ))}
          </MCard>
        </>
      )}
    </div>
  );
}

//  Main 
// Coach screens on the phone show a subset of these tabs (MobileShell).
export default function MobileHealth({ settings, tabs = SUB_TABS, title = 'Health' }) {
  const [sub, setSub] = useState(tabs[0]);
  const today = toLocalDateKey(new Date());

  return (
    <div style={{ padding: '16px', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>

      {title && <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', marginBottom: 14 }}>{title}</div>}

      {/* Sub-nav */}
      {tabs.length > 1 && <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 14,
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setSub(t)} style={{
            flexShrink: 0, padding: '6px 16px', borderRadius: 20,
            fontSize: 13, fontWeight: sub === t ? 600 : 400, cursor: 'pointer',
            border: sub === t ? '1px solid var(--accent)' : '0.5px solid var(--card-border)',
            background: sub === t ? 'var(--active-bg)' : 'none',
            color: sub === t ? 'var(--accent)' : 'var(--text-secondary)',
            WebkitTapHighlightColor: 'transparent',
          }}>{t}</button>
        ))}
      </div>}

      {sub === 'Overview'   && <OverviewTab   settings={settings} today={today} />}
      {sub === 'Sleep'      && <SleepTab      today={today} />}
      {sub === 'Nutrition'  && <NutritionTab  settings={settings} today={today} />}
      {sub === 'Water'      && <WaterTab      settings={settings} today={today} />}
      {sub === 'Body'       && <BodyTab today={today} settings={settings} />}
    </div>
  );
}


