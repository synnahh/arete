//  MobileHealth.jsx  Health tab matching desktop overview layout
import { useState, useMemo, useRef } from 'react';
import SwipeRow from '../SwipeRow.jsx';
import { useCollection } from '../../supabase/useCollection.js';
import { useDocument } from '../../supabase/useDocument.js';
import { STORAGE_KEYS }  from '../../utils/storage.js';
import { searchFoods, lookupBarcode, startBarcodeScan } from '../../utils/openFoodFacts.js';
import { scaleMicros } from '../../utils/micronutrients.js';
import { toLocalDateKey } from '../../utils/localDate.js';
import { currentWaterGoal, sleepWindow } from '../../utils/waterGoal.js';
import { waterAdvice } from '../../domain/water.js';
import { weightCoach } from '../../domain/weight.js';
import WeightChart from '../../components/WeightChart.jsx';
import ProgressPhotos from '../../components/ProgressPhotos.jsx';
import ReadinessCard from '../../components/ReadinessCard.jsx';
import MuscleRecovery from '../../components/MuscleRecovery.jsx';
import SleepLogger from '../../components/SleepLogger.jsx';
import GoalEta from '../../components/GoalEta.jsx';
import { withTodaysTargets } from '../../utils/todaysTargets.js';
import MicroCoachCard from '../../components/MicroCoachCard.jsx';
import FoodShortcuts from '../../components/FoodShortcuts.jsx';
import FoodLogger from '../../components/FoodLogger.jsx';
import { roundTotals, yesterdayKey, copyMeals, appendMeals, groupBySection, recentFoods } from '../../domain/foods.js';
import RecipeBuilder from '../../components/RecipeBuilder.jsx';
import CustomFoodForm from '../../components/CustomFoodForm.jsx';
import StarButton from '../../components/StarButton.jsx';
import { useFoodLibrary } from '../../hooks/useFoodLibrary.js';
import { customFoodEntry, favouriteEntry, servingText } from '../../domain/customFoods.js';
import Sheet from '../Sheet.jsx';
import { mealEntry, draftFromSaved, PORTIONS } from '../../domain/recipes.js';
import { storage } from '../../utils/storage.js';
import { weeklyMicros, microCoach } from '../../domain/micros.js';

const nowStr = () => new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });

// ── Shared primitives ──────────────────────────────────────────────────────────
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
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em',
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

// ── Sub-nav ────────────────────────────────────────────────────────────────────
const SUB_TABS = ['Overview', 'Sleep', 'Nutrition', 'Water', 'Body'];

// ── Sleep ring ─────────────────────────────────────────────────────────────────
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
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>QTY</div>
      </div>
    </div>
  );
}

// ── Sleep stage bar ────────────────────────────────────────────────────────────
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
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
              {s.label}: {s.hours >= 1 ? `${Math.floor(s.hours)}h${Math.round((s.hours%1)*60)}m` : `${Math.round(s.hours*60)}m`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Vital stat mini-card ───────────────────────────────────────────────────────
function VitalCard({ label, value, unit, sub, color = 'var(--text-primary)', barValue, barMax, barColor }) {
  return (
    <div style={{ background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 22, fontWeight: 200, color, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
      {barMax !== undefined && (
        <ProgressBar value={barValue || 0} max={barMax} color={barColor || color} />
      )}
    </div>
  );
}

// ── Overview tab ───────────────────────────────────────────────────────────────
function OverviewTab({ settings, today }) {
  const { items: waterLogs     = [] } = useCollection('water_logs',      'valerie_water_logs');
  const { items: nutritionLogs = [] } = useCollection('nutrition_logs',  'valerie_nutrition_logs');
  const { items: sleepData     = [] } = useCollection('sleep_data',      STORAGE_KEYS.SLEEP);
  const { items: supplements   = [] } = useCollection('supplements',     'valerie_supplements');
  const { items: habits        = [] } = useCollection('habits',          STORAGE_KEYS.HABITS);
  const { items: bodyMetrics   = [] } = useCollection('body_metrics',    STORAGE_KEYS.BODY);
  const { items: workoutLogs   = [] } = useCollection('workout_logs',    STORAGE_KEYS.WORKOUT_LOGS);
  const { items: stimLogs      = [] } = useCollection('stimulant_logs',  STORAGE_KEYS.STIMULANTS);

  // ── Sleep ──────────────────────────────────────────────────────────────────
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
  const todays     = withTodaysTargets(settings);
  const calGoal    = todays?.macroGoal ?? 2500;
  const protGoal   = todays?.proteinGoal ?? 160;
  const carbGoal   = todays?.macros?.carbs ?? 250;
  const fatGoal    = todays?.macros?.fat ?? 80;
  const todayLog   = useMemo(() => nutritionLogs.find(l => l.date === today), [nutritionLogs, today]);
  const todayMeals = todayLog?.meals ?? [];
  const totCal  = Math.round(todayMeals.reduce((s, m) => s + (m.calories || 0), 0) * 10) / 10;
  const totProt = Math.round(todayMeals.reduce((s, m) => s + (m.protein || 0), 0) * 10) / 10;
  const totCarb = Math.round(todayMeals.reduce((s, m) => s + (m.carbs || 0), 0) * 10) / 10;
  const totFat  = Math.round(todayMeals.reduce((s, m) => s + (m.fat || 0), 0) * 10) / 10;

  // ── Supplements ────────────────────────────────────────────────────────────
  const suppTaken    = supplements.filter(s => s.takenDates?.includes(today)).length;
  const suppRemaining = supplements.length - suppTaken;

  // ── Habits ─────────────────────────────────────────────────────────────────
  const habitsDone = habits.filter(h => h.completedDates?.includes(today)).length;

  // ── Workout ────────────────────────────────────────────────────────────────
  const todayWorkout = workoutLogs.find(w => w.date === today);

  //  Caffeine
  const caffLimit = settings?.caffeineLimitMg ?? 400;
  const caffToday = useMemo(() =>
    stimLogs.filter(l => l.date === today).reduce((s, l) => s + (l.caffeineMg || 0), 0),
  [stimLogs, today]);

  // ── Body ───────────────────────────────────────────────────────────────────
  const latestBody = useMemo(() =>
    [...bodyMetrics].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0],
  [bodyMetrics]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Sleep Quality ── */}
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

      {/* ── Vitals ── */}
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

      {/* ── Secondary vitals ── */}
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

      {/* ── Body ── */}
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

      {/* ── Today's Meals ── */}
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
                <div style={{ display: 'flex', gap: 10, flexShrink: 0, fontSize: 11, color: 'var(--text-muted)' }}>
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

// ── Sleep tab ──────────────────────────────────────────────────────────────────
function SleepTab({ today }) {
  const { items: sleepData = [] } = useCollection('sleep_data', STORAGE_KEYS.SLEEP);
  const sorted = useMemo(() =>
    [...sleepData].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 7),
  [sleepData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ReadinessCard compact />
      <MuscleRecovery compact />
      <SleepLogger />
      {sorted.length === 0 ? (
        <MCard>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No sleep logged yet. Log it above, or sync via Health Auto Export.
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
            {score > 0 && <SleepRing pct={score} size={60} thickness={6} />}
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
//  Nutrition tab
function NutritionTab({ settings, today }) {
  const { items: nutritionLogs = [], add: addNutritionLog, update: updateNutritionLog } = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);
  const todays   = withTodaysTargets(settings);
  const calGoal  = todays?.macros?.calories ?? todays?.macroGoal ?? 2500;
  const protGoal = todays?.macros?.protein  ?? todays?.proteinGoal ?? 160;
  const carbGoal = todays?.macros?.carbs    ?? 250;
  const fatGoal  = todays?.macros?.fat      ?? 80;
  const [showAdd, setShowAdd] = useState(false);
  const { items: savedMeals = [], add: addSavedMeal, update: updateSavedMeal, remove: removeSavedMeal } = useCollection('saved_meals', STORAGE_KEYS.SAVED_MEALS);
  const [recipeDraft, setRecipeDraft] = useState(null); // null | { initial }
  const [portions, setPortions] = useState({});
  const lib = useFoodLibrary();
  const [foodDraft, setFoodDraft] = useState(null); // null | { initial }
  const { items: supplements = [] } = useCollection('supplements', STORAGE_KEYS.SUPPLEMENTS);
  const { items: suppLogs = [] } = useCollection('supplement_logs', STORAGE_KEYS.SUPP_LOGS);
  const microAdvice = useMemo(
    () => microCoach(weeklyMicros({ nutritionLogs, supplements, suppLogs, today })),
    [nutritionLogs, supplements, suppLogs, today]
  );

  const todayLog = useMemo(() => nutritionLogs.find(l => l.date === today), [nutritionLogs, today]);
  const meals    = todayLog?.meals ?? [];

  const totCal  = Math.round(meals.reduce((s, m) => s + (m.calories || 0), 0) * 10) / 10;
  const totProt = Math.round(meals.reduce((s, m) => s + (m.protein || 0), 0) * 10) / 10;
  const totCarb = Math.round(meals.reduce((s, m) => s + (m.carbs || 0), 0) * 10) / 10;
  const totFat  = Math.round(meals.reduce((s, m) => s + (m.fat || 0), 0) * 10) / 10;

  async function addMealEntry(entry) {
    const newMeals = [...meals, entry];
    const newTotals = roundTotals(newMeals.reduce((s, m) => ({
      calories: s.calories + (m.calories || 0), protein: s.protein + (m.protein || 0),
      carbs: s.carbs + (m.carbs || 0), fat: s.fat + (m.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 }));
    if (todayLog?.id) await updateNutritionLog(todayLog.id, { meals: newMeals, ...newTotals });
    else await addNutritionLog({ date: today, meals: newMeals, ...newTotals });
    setShowAdd(false);
  }

  // Copy yesterday / quick-add, with an Undo toast (the toast host now runs on the phone too).
  const yesterdayMeals = useMemo(() => copyMeals(nutritionLogs.find(l => l.date === yesterdayKey(today))), [nutritionLogs, today]);
  async function appendEntries(entries, message) {
    const prev = { meals, calories: totCal, protein: totProt, carbs: totCarb, fat: totFat };
    const row = appendMeals(todayLog, entries, today);
    const fields = { meals: row.meals, calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat };
    if (todayLog?.id) await updateNutritionLog(todayLog.id, fields);
    else await addNutritionLog({ date: today, ...fields });
    window.dispatchEvent(new CustomEvent('valerie:toast', { detail: {
      message, type: 'success',
      undo: async () => {
        const saved = storage.get(STORAGE_KEYS.MACROS, []).find(l => l.date === today && !String(l.id).startsWith('local_'));
        if (saved) await updateNutritionLog(saved.id, prev);
      },
    } }));
  }

  const frequent = useMemo(() => recentFoods(nutritionLogs, { today, limit: 8 }), [nutritionLogs, today]);
  const logMyMeal = (m) => { const p = portions[m.id] ?? 1; const e = mealEntry(m, p); e.time = nowStr(); return appendEntries([e], `Logged ${m.name}${p === 1 ? '' : ` ×${p}`}`); };

  // Swipe-delete a saved meal; Undo puts the same recipe back.
  async function dropSavedMeal(m) {
    const { id: _id, ...rest } = m;
    await removeSavedMeal(m.id);
    window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: 'Deleted ' + m.name, type: 'success', undo: () => addSavedMeal(rest) } }));
  }

  async function removeMealEntry(id) {
    if (!todayLog?.id) return;
    const totalsOf = (list) => roundTotals(list.reduce((s, m) => ({
      calories: s.calories + (m.calories || 0), protein: s.protein + (m.protein || 0),
      carbs: s.carbs + (m.carbs || 0), fat: s.fat + (m.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 }));
    const before = meals;
    const removed = before.find(m => m.id === id);
    const newMeals = before.filter(m => m.id !== id);
    const logId = todayLog.id;
    await updateNutritionLog(logId, { meals: newMeals, ...totalsOf(newMeals) });
    window.dispatchEvent(new CustomEvent('valerie:toast', { detail: {
      message: `Removed ${removed?.name || 'entry'}`, type: 'success',
      undo: () => updateNutritionLog(logId, { meals: before, ...totalsOf(before) }),
    } }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {todays?.todayTargetKind && (
        <div role="status" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
          {todays.todayTargetKind === 'training' ? 'Training day' : 'Rest day'}: {todays.todayTargetDelta > 0 ? '+' : ''}{todays.todayTargetDelta} kcal today, all in carbs.
        </div>
      )}
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

      <FoodShortcuts
        yesterday={yesterdayMeals.length ? { count: yesterdayMeals.length, kcal: Math.round(yesterdayMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0)) } : null}
        onCopy={() => appendEntries(yesterdayMeals, `Copied ${yesterdayMeals.length} item${yesterdayMeals.length === 1 ? '' : 's'} from yesterday`)}
        onQuickAdd={(entry) => appendEntries([entry], `Added ${entry.calories} kcal`)} />

      {/* The front door: tap to search, scan or pick a favourite */}
      <button onClick={() => setShowAdd(true)} aria-label="Log food: search, scan or pick a favourite" style={{
        minHeight: 52, padding: '0 16px', borderRadius: 14, border: '0.5px solid var(--accent)', background: 'var(--bg-panel)',
        color: 'var(--text-secondary)', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 10, WebkitTapHighlightColor: 'transparent',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <span style={{ flex: 1 }}>Search or scan food</span>
        <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 22, lineHeight: 1 }}>+</span>
      </button>

      {/* Favourites: starred foods, one tap to log exactly as starred */}
      {lib.favourites.length > 0 && (
        <MCard>
          <SectionLabel>Favourites</SectionLabel>
          {lib.favourites.map(f => (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderTop: '0.5px solid var(--card-border)' }}>
              <button onClick={() => appendEntries([favouriteEntry(f)], `Logged ${f.name} · ${f.calories} kcal`)} aria-label={`Log ${f.name}, ${f.calories} kilocalories`}
                style={{ flex: 1, minWidth: 0, minHeight: 44, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                <span style={{ fontSize: 14, color: 'var(--text-primary)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{f.calories} kcal · P{f.protein} · tap to log</span>
              </button>
              <StarButton on name={f.name} size={44} onClick={() => lib.toggleFav(f)} />
            </div>
          ))}
        </MCard>
      )}

      {/* My foods: your own foods, numbers for one serving */}
      <MCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <SectionLabel>My foods</SectionLabel>
          <button onClick={() => setFoodDraft({ initial: null })} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44, padding: '0 6px' }}>New food</button>
        </div>
        {lib.customFoods.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Add foods that are not in the search, like a label you typed in or something homemade.</div>}
        {lib.customFoods.map(food => {
          const full = food.brand ? `${food.name} (${food.brand})` : food.name;
          return (
            <div key={food.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 0', borderTop: '0.5px solid var(--card-border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{full}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{food.calories} kcal · P{food.protein} C{food.carbs} F{food.fat} · per {servingText(food)}</div>
              </div>
              <StarButton on={lib.isFav(full)} name={food.name} size={40} onClick={() => lib.toggleFav(customFoodEntry(food, 1))} />
              <button onClick={() => setFoodDraft({ initial: food })} aria-label={`Edit ${food.name}`} style={{ minHeight: 40, padding: '0 10px', borderRadius: 10, border: '0.5px solid var(--card-border)', background: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Edit</button>
              <button onClick={() => appendEntries([customFoodEntry(food, 1)], `Logged ${food.name}`)} style={{ minHeight: 40, padding: '0 14px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: 'var(--bg-base)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Log</button>
            </div>
          );
        })}
      </MCard>

      {/* My meals: saved meals and recipes, one tap to log */}
      <MCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <SectionLabel>My meals</SectionLabel>
          <button onClick={() => setRecipeDraft({ initial: null })} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44, padding: '0 6px' }}>Build a recipe</button>
        </div>
        {savedMeals.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>No saved meals yet. Build a recipe from ingredients and log it in one tap.</div>}
        {savedMeals.map(m => (
          <SwipeRow key={m.id} onDelete={() => dropSavedMeal(m)} style={{ borderTop: '0.5px solid var(--card-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{m.calories} kcal · P{m.protein} C{m.carbs} F{m.fat}{m.servings > 1 ? ` · per serving of ${m.servings}` : ''}</div>
            </div>
            <select aria-label={`Portions of ${m.name}`} value={portions[m.id] ?? 1} onChange={e => setPortions(p => ({ ...p, [m.id]: Number(e.target.value) }))} style={{ width: 62, minHeight: 40, padding: '0 6px', fontSize: 13 }}>
              {PORTIONS.map(x => <option key={x} value={x}>{`×${x}`}</option>)}
            </select>
            <button onClick={() => logMyMeal(m)} style={{ minHeight: 40, padding: '0 14px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: 'var(--bg-base)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Log</button>
            <button onClick={() => setRecipeDraft({ initial: { ...draftFromSaved(m), id: m.id } })} aria-label={`Edit ${m.name}`} style={{ minHeight: 40, padding: '0 10px', borderRadius: 10, border: '0.5px solid var(--card-border)', background: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Edit</button>
          </div>
          </SwipeRow>
        ))}
      </MCard>

      {/* Meal list */}
      <MCard style={{ padding: 0 }}>
        {meals.length === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-muted)' }}>Nothing logged today</div>
        ) : groupBySection(meals).map(sec => (
          <div key={sec.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px 4px', fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              <span>{sec.label}</span><span>{sec.kcal} kcal</span>
            </div>
            {sec.meals.map((m, i) => (
              <SwipeRow key={m.id || i} onDelete={() => removeMealEntry(m.id)} style={{ borderBottom: '0.5px solid var(--card-border)' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 4px 8px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {m.photo && <img src={m.photo} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />}
                <div style={{ minWidth: 0 }}>
                  {m.time && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{m.time}</div>}
                  <div style={{ fontSize: 13, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}
                  </div>
                </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, fontSize: 11 }}>
                  <span style={{ color: '#f59e0b' }}>{m.calories}kcal</span>
                  <span style={{ color: '#e879a0' }}>{m.protein}p</span>
                  <span style={{ color: '#a78bfa' }}>{m.carbs}c</span>
                  <span style={{ color: '#4caf7d' }}>{m.fat}f</span>
                  <StarButton on={lib.isFav(m.name)} name={m.name} size={36} onClick={() => lib.toggleFav(m)} />
                  <button onClick={() => removeMealEntry(m.id)} aria-label={`Remove ${m.name}`} style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18,
                    cursor: 'pointer', width: 44, height: 44, WebkitTapHighlightColor: 'transparent' }}>×</button>
                </div>
              </div>
              </SwipeRow>
            ))}
          </div>
        ))}
      </MCard>

      {microAdvice.status !== 'no-data' && (
        <MCard><MicroCoachCard advice={microAdvice} /></MCard>
      )}

      {showAdd && (
        <Sheet title="Log food" onClose={() => setShowAdd(false)}>
          <FoodLogger onLog={(entry) => appendEntries([entry], `Logged ${entry.name} · ${entry.calories} kcal`)} onClose={() => setShowAdd(false)} />
        </Sheet>
      )}
      {foodDraft && (
        <Sheet title={foodDraft.initial?.id ? 'Edit food' : 'New food'} onClose={() => setFoodDraft(null)}>
          <CustomFoodForm key={foodDraft.initial?.id || 'new'} initial={foodDraft.initial}
            onCancel={() => setFoodDraft(null)}
            onDelete={async (id) => { await lib.removeCustomFood(id); setFoodDraft(null); }}
            onSave={async (row, id) => {
              const ok = id ? await lib.updateCustomFood(id, row) : await lib.addCustomFood(row);
              if (ok) { setFoodDraft(null); window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: id ? 'Food updated' : 'Food saved to My foods', type: 'success' } })); }
            }} />
        </Sheet>
      )}
      {recipeDraft && (
        <Sheet title={recipeDraft.initial?.id ? 'Edit recipe' : 'Build a recipe'} onClose={() => setRecipeDraft(null)}>
          <RecipeBuilder compact key={recipeDraft.initial?.id || 'new'} initial={recipeDraft.initial} recent={frequent} foods={lib.customFoods}
            onCancel={() => setRecipeDraft(null)}
            onDelete={async (id) => { await removeSavedMeal(id); setRecipeDraft(null); }}
            onSave={async (row, id) => {
              const ok = id ? await updateSavedMeal(id, row) : await addSavedMeal(row);
              if (ok) { setRecipeDraft(null); window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: id ? 'Recipe updated' : 'Recipe saved to My meals', type: 'success' } })); }
            }} />
        </Sheet>
      )}
    </div>
  );
}

// ── Water tab ──────────────────────────────────────────────────────────────────
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
  // Remove a drink, with an Undo that puts the same entry back.
  const dropWater = async (l) => {
    await removeWaterLog(l.id);
    window.dispatchEvent(new CustomEvent('valerie:toast', { detail: {
      message: 'Removed ' + (l.amount >= 1000 ? (l.amount / 1000) + 'L' : l.amount + 'ml'), type: 'success',
      undo: () => addWaterLog({ date: l.date, amount: l.amount, time: l.time }),
    } }));
  };

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
            <SwipeRow key={l.id || i} onDelete={() => dropWater(l)} style={{ borderBottom: i < arr.length - 1 ? '0.5px solid var(--card-border)' : 'none' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '11px 16px',
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
            </SwipeRow>
          ))
        )}
      </MCard>
    </div>
  );
}

// ── Body tab ───────────────────────────────────────────────────────────────────
// Tape-measure readings (the same `measurements` document as the desktop Body screen). Each box saves when you leave it.
const MEASURE_FIELDS = [
  { key: 'waist', label: 'Waist' }, { key: 'chest', label: 'Chest' }, { key: 'hips', label: 'Hips' },
  { key: 'arms', label: 'Arms' }, { key: 'thighs', label: 'Thighs' }, { key: 'neck', label: 'Neck' },
];
function MeasurementsPanel({ boxStyle }) {
  const { data, save } = useDocument('measurements', STORAGE_KEYS.MEASUREMENTS, {});
  const [draft, setDraft] = useState({});
  const [saved, setSaved] = useState('');
  const stored = data && typeof data === 'object' ? data : {};
  const value = (k) => (k in draft ? draft[k] : (stored[k] ?? ''));
  const clearDraft = (k) => setDraft(d => { const rest = { ...d }; delete rest[k]; return rest; });

  async function commit(k) {
    if (!(k in draft)) return;
    const clean = String(draft[k]).trim();
    if (clean === String(stored[k] ?? '')) { clearDraft(k); return; }
    const ok = await save({ ...stored, [k]: clean });
    clearDraft(k);
    if (ok !== false) { setSaved(MEASURE_FIELDS.find(f => f.key === k).label); setTimeout(() => setSaved(''), 1800); }
  }

  return (
    <MCard style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Measurements (cm)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {MEASURE_FIELDS.map(f => (
          <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{f.label}</span>
            <input type="text" inputMode="decimal" value={value(f.key)} placeholder="cm" aria-label={`${f.label} in centimetres`} style={boxStyle}
              onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value.replace(/[^0-9.]/g, '').slice(0, 6) }))}
              onBlur={() => commit(f.key)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
          </label>
        ))}
      </div>
      <div role="status" style={{ fontSize: 12, color: saved ? 'var(--accent)' : 'var(--text-muted)' }}>{saved ? `${saved} saved` : 'Measure in the same spot each time. Each box saves when you leave it.'}</div>
    </MCard>
  );
}

function BodyTab({ today, settings }) {
  const { items: bodyMetrics = [], add: addBodyMetric } = useCollection('body_metrics', STORAGE_KEYS.BODY);
  const sorted = useMemo(() =>
    [...bodyMetrics].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
  [bodyMetrics]);
  const latest = sorted[0];
  // Weight coach: smoothed trend, weekly rate, pace vs the Coach goal
  const coach = useMemo(() => weightCoach(bodyMetrics, settings?.coachGoal?.targets?.weeklyRateKg ?? null, settings?.coachGoal?.targetWeightKg ?? null, today), [bodyMetrics, settings?.coachGoal]);
  const [seg, setSeg] = useState('weight'); // weight | measurements | photos: the same three as the desktop Body screen
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
  }

  const boxStyle = { width: '100%', minHeight: 48, padding: '0 12px', borderRadius: 10, border: '0.5px solid var(--card-border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div role="tablist" aria-label="Body" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)' }}>
        {[['weight', 'Weight'], ['measurements', 'Measurements'], ['photos', 'Photos']].map(([id, text]) => (
          <button key={id} role="tab" aria-selected={seg === id} onClick={() => setSeg(id)} style={{
            flex: 1, minHeight: 44, borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5,
            fontWeight: seg === id ? 700 : 500, background: seg === id ? 'var(--active-bg)' : 'transparent',
            color: seg === id ? 'var(--accent)' : 'var(--text-secondary)', WebkitTapHighlightColor: 'transparent',
          }}>{text}</button>
        ))}
      </div>

      {seg === 'weight' && (
        <MCard style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Log today</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8 }}>
            {[['weight', 'Weight kg', 'e.g. 71.2'], ['bodyFat', 'Body fat %', 'optional'], ['muscle', 'Muscle %', 'optional']].map(([k, text, ph]) => (
              <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{text}</span>
                <input type="text" inputMode="decimal" value={form[k]} placeholder={ph} aria-label={text} style={boxStyle}
                  onChange={e => setForm(p => ({ ...p, [k]: e.target.value.replace(/[^0-9.]/g, '').slice(0, 6) }))} />
              </label>
            ))}
          </div>
          <button onClick={save} disabled={!form.weight} style={{ minHeight: 48, borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--bg-base)', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: form.weight ? 1 : 0.4 }}>Save weigh-in</button>
        </MCard>
      )}

      {seg === 'measurements' && <MeasurementsPanel boxStyle={boxStyle} />}
      {seg === 'photos' && (
        <MCard style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ProgressPhotos bodyMetrics={bodyMetrics} />
        </MCard>
      )}

      {seg !== 'weight' ? null : !latest ? (
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
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 4 }}>TREND WEIGHT</div>
                  <div className="val-num" style={{ fontSize: 30, fontWeight: 500, color: 'var(--tab-accent)', lineHeight: 1 }}>{coach.trend}<span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 3 }}>kg</span></div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 4 }}>RATE</div>
                  <div className="val-num" style={{ fontSize: 20, color: 'var(--text-primary)', lineHeight: 1.1 }}>{coach.rate == null ? '—' : (coach.rate > 0 ? '+' : '') + coach.rate}<span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 3 }}>kg/week</span></div>
                </div>
              </div>
              {coach.pace && <div role="status" style={{ fontSize: 13, lineHeight: 1.45, color: coach.pace.status === 'on-track' ? '#4caf7d' : '#e8a13a' }}>{coach.pace.message}</div>}
              {coach.eta && <GoalEta eta={coach.eta} targetKg={settings?.coachGoal?.targetWeightKg} />}
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

// ── Main ───────────────────────────────────────────────────────────────────────
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


