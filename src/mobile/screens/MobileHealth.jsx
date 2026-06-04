// ─── MobileHealth.jsx — Health tab matching desktop overview layout ───────────
import { useState, useMemo } from 'react';
import { useCollection } from '../../firebase/useCollection.js';
import { STORAGE_KEYS }  from '../../utils/storage.js';

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
        <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>QTY</div>
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
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
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

// ── Overview tab ───────────────────────────────────────────────────────────────
function OverviewTab({ settings, today }) {
  const { items: waterLogs     = [] } = useCollection('water_logs',      'valerie_water_logs');
  const { items: nutritionLogs = [] } = useCollection('nutrition_logs',  'valerie_nutrition_logs');
  const { items: sleepData     = [] } = useCollection('sleep_logs',      'valerie_sleep_logs');
  const { items: supplements   = [] } = useCollection('supplements',     'valerie_supplements');
  const { items: habits        = [] } = useCollection('habits',          STORAGE_KEYS.HABITS);
  const { items: bodyMetrics   = [] } = useCollection('body_metrics',    STORAGE_KEYS.BODY);
  const { items: workoutLogs   = [] } = useCollection('workout_logs',    STORAGE_KEYS.WORKOUT_LOGS);
  const { items: stimLogs      = [] } = useCollection('stimulant_logs',  STORAGE_KEYS.STIMULANTS);

  // ── Sleep ──────────────────────────────────────────────────────────────────
  const lastSleep = useMemo(() =>
    [...sleepData].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0],
  [sleepData]);
  const sleepHours = lastSleep?.duration || 0;
  const sleepH     = Math.floor(sleepHours);
  const sleepM     = Math.round((sleepHours % 1) * 60);
  const sleepQ     = lastSleep?.quality || 0;

  // ── Water ──────────────────────────────────────────────────────────────────
  const waterGoal  = settings?.waterGoalMl || 2800;
  const todayWater = useMemo(() =>
    waterLogs.filter(l => l.date === today).reduce((s, l) => s + (l.amount || 0), 0),
  [waterLogs, today]);

  // ── Nutrition ──────────────────────────────────────────────────────────────
  const calGoal    = settings?.calorieGoal || 2500;
  const protGoal   = settings?.proteinGoal || 160;
  const carbGoal   = settings?.carbGoal    || 250;
  const fatGoal    = settings?.fatGoal     || 80;
  const todayNutr  = useMemo(() =>
    nutritionLogs.filter(l => l.date === today),
  [nutritionLogs, today]);
  const totCal  = todayNutr.reduce((s, l) => s + (l.calories || 0), 0);
  const totProt = todayNutr.reduce((s, l) => s + (l.protein  || 0), 0);
  const totCarb = todayNutr.reduce((s, l) => s + (l.carbs    || 0), 0);
  const totFat  = todayNutr.reduce((s, l) => s + (l.fat      || 0), 0);

  // ── Supplements ────────────────────────────────────────────────────────────
  const suppTaken    = supplements.filter(s => s.takenDates?.includes(today)).length;
  const suppRemaining = supplements.length - suppTaken;

  // ── Habits ─────────────────────────────────────────────────────────────────
  const habitsDone = habits.filter(h => h.completedDates?.includes(today)).length;

  // ── Workout ────────────────────────────────────────────────────────────────
  const todayWorkout = workoutLogs.find(w => w.date === today);

  // ── Caffeine ───────────────────────────────────────────────────────────────
  const caffLimit = settings?.caffeineLimit || 400;
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
                  {lastSleep.bedtime} → {lastSleep.wakeTime}
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
            {latestBody.muscleMass && (
              <VitalCard label="Muscle" value={latestBody.muscleMass} unit="kg" color="#4caf7d" />
            )}
          </div>
        </div>
      )}

      {/* ── Today's Meals ── */}
      {todayNutr.length > 0 && (
        <div>
          <SectionLabel>Today's Meals</SectionLabel>
          <MCard style={{ padding: 0 }}>
            {[...todayNutr].sort((a, b) => (a.time || '').localeCompare(b.time || '')).map((l, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 16px',
                borderBottom: i < todayNutr.length - 1 ? '0.5px solid var(--card-border)' : 'none',
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                  {l.time && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, width: 38 }}>{l.time}</span>
                  )}
                  <span style={{ fontSize: 13, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.name || l.meal}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexShrink: 0, fontSize: 10, color: 'var(--text-muted)' }}>
                  <span style={{ color: '#f59e0b' }}>{l.calories}kcal</span>
                  {l.protein > 0 && <span style={{ color: '#e879a0' }}>{l.protein}p</span>}
                  {l.carbs  > 0 && <span style={{ color: '#a78bfa' }}>{l.carbs}c</span>}
                  {l.fat    > 0 && <span style={{ color: '#4caf7d' }}>{l.fat}f</span>}
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
  const { items: sleepData = [] } = useCollection('sleep_logs', 'valerie_sleep_logs');
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
        const h = Math.floor(s.duration || 0);
        const m = Math.round(((s.duration || 0) % 1) * 60);
        const color = (s.quality || 0) >= 80 ? '#4caf7d' : (s.quality || 0) >= 60 ? '#f59e0b' : '#e05555';
        return (
          <MCard key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <SleepRing pct={s.quality || 0} size={60} thickness={6} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.date}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {s.bedtime} → {s.wakeTime}
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

// ── Nutrition tab ──────────────────────────────────────────────────────────────
function NutritionTab({ settings, today }) {
  const { items: nutritionLogs = [] } = useCollection('nutrition_logs', 'valerie_nutrition_logs');
  const calGoal  = settings?.calorieGoal || 2500;
  const protGoal = settings?.proteinGoal || 160;
  const carbGoal = settings?.carbGoal    || 250;
  const fatGoal  = settings?.fatGoal     || 80;

  const todayNutr = useMemo(() =>
    nutritionLogs.filter(l => l.date === today),
  [nutritionLogs, today]);

  const totCal  = todayNutr.reduce((s, l) => s + (l.calories || 0), 0);
  const totProt = todayNutr.reduce((s, l) => s + (l.protein  || 0), 0);
  const totCarb = todayNutr.reduce((s, l) => s + (l.carbs    || 0), 0);
  const totFat  = todayNutr.reduce((s, l) => s + (l.fat      || 0), 0);

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

      {/* Meal list */}
      <MCard style={{ padding: 0 }}>
        {todayNutr.length === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-muted)' }}>Nothing logged today</div>
        ) : [...todayNutr].sort((a, b) => (a.time || '').localeCompare(b.time || '')).map((l, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px',
            borderBottom: i < todayNutr.length - 1 ? '0.5px solid var(--card-border)' : 'none',
          }}>
            <div style={{ minWidth: 0 }}>
              {l.time && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{l.time}</div>}
              <div style={{ fontSize: 13, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.name || l.meal}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, fontSize: 11 }}>
              <span style={{ color: '#f59e0b' }}>{l.calories}kcal</span>
              <span style={{ color: '#e879a0' }}>{l.protein}p</span>
              <span style={{ color: '#a78bfa' }}>{l.carbs}c</span>
              <span style={{ color: '#4caf7d' }}>{l.fat}f</span>
            </div>
          </div>
        ))}
      </MCard>
    </div>
  );
}

// ── Water tab ──────────────────────────────────────────────────────────────────
function WaterTab({ settings, today }) {
  const { items: waterLogs = [] } = useCollection('water_logs', 'valerie_water_logs');
  const goalMl     = settings?.waterGoalMl || 2800;
  const todayWater = useMemo(() =>
    waterLogs.filter(l => l.date === today).reduce((s, l) => s + (l.amount || 0), 0),
  [waterLogs, today]);
  const pct = Math.min(100, Math.round(todayWater / goalMl * 100));

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
      </MCard>

      <MCard style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--card-border)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Today's intake</span>
        </div>
        {waterLogs.filter(l => l.date === today).length === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-muted)' }}>Nothing logged yet</div>
        ) : (
          [...waterLogs.filter(l => l.date === today)].reverse().map((l, i, arr) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '11px 16px',
              borderBottom: i < arr.length - 1 ? '0.5px solid var(--card-border)' : 'none',
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {l.amount >= 1000 ? `${l.amount/1000}L` : `${l.amount}ml`}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.time}</span>
            </div>
          ))
        )}
      </MCard>
    </div>
  );
}

// ── Body tab ───────────────────────────────────────────────────────────────────
function BodyTab() {
  const { items: bodyMetrics = [] } = useCollection('body_metrics', STORAGE_KEYS.BODY);
  const sorted = useMemo(() =>
    [...bodyMetrics].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
  [bodyMetrics]);
  const latest = sorted[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!latest ? (
        <MCard>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Log body metrics from your desktop — they'll sync here automatically.
          </div>
        </MCard>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {latest.weight     && <VitalCard label="Weight"   value={latest.weight}     unit="kg" color="var(--text-primary)" />}
            {latest.bodyFat    && <VitalCard label="Body Fat" value={latest.bodyFat}    unit="%"  color="#f59e0b" />}
            {latest.muscleMass && <VitalCard label="Muscle"   value={latest.muscleMass} unit="kg" color="#4caf7d" />}
          </div>

          <MCard style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--card-border)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>History</span>
            </div>
            {sorted.slice(0, 10).map((m, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', padding: '10px 16px',
                borderBottom: i < Math.min(sorted.length, 10) - 1 ? '0.5px solid var(--card-border)' : 'none',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.date}</span>
                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  {m.weight     && <span style={{ color: 'var(--text-secondary)' }}>{m.weight}kg</span>}
                  {m.bodyFat    && <span style={{ color: '#f59e0b' }}>{m.bodyFat}%</span>}
                  {m.muscleMass && <span style={{ color: '#4caf7d' }}>{m.muscleMass}kg</span>}
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
export default function MobileHealth({ settings }) {
  const [sub, setSub] = useState('Overview');
  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ padding: '16px', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>

      <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', marginBottom: 14 }}>Health</div>

      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 14,
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {SUB_TABS.map(t => (
          <button key={t} onClick={() => setSub(t)} style={{
            flexShrink: 0, padding: '6px 16px', borderRadius: 20,
            fontSize: 13, fontWeight: sub === t ? 600 : 400, cursor: 'pointer',
            border: sub === t ? '1px solid var(--accent)' : '0.5px solid var(--card-border)',
            background: sub === t ? 'var(--active-bg)' : 'none',
            color: sub === t ? 'var(--accent)' : 'var(--text-secondary)',
            WebkitTapHighlightColor: 'transparent',
          }}>{t}</button>
        ))}
      </div>

      {sub === 'Overview'   && <OverviewTab   settings={settings} today={today} />}
      {sub === 'Sleep'      && <SleepTab      today={today} />}
      {sub === 'Nutrition'  && <NutritionTab  settings={settings} today={today} />}
      {sub === 'Water'      && <WaterTab      settings={settings} today={today} />}
      {sub === 'Body'       && <BodyTab />}
    </div>
  );
}
