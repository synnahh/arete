//  Health Tab 
// 8 sub-sections: Overview · Habits · Nutrition · Water · Body · Supplements · Sleep · Stimulant

import { Icon as LineIcon } from '../components/icons.jsx';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useCollection }                  from '../supabase/useCollection.js';
import { useDocument }                    from '../supabase/useDocument.js';
import { storage, STORAGE_KEYS }          from '../utils/storage.js';
import { RingChart, ProgressBar, StageBar, BarChart } from '../components/Charts.jsx';
import { askClaudeRaw } from '../utils/claudeRaw.js';
import { useAppleHealth } from '../hooks/useAppleHealth.js';
import { MICRONUTRIENTS, MICRO_BY_KEY, MICRO_GROUPS, extractMicrosFromOFF, scaleMicros, sumMicros, hasMicros } from '../utils/micronutrients.js';
import { currencySymbol as currencySym } from '../utils/currency.js';
import { searchOpenFoodFacts, lookupBarcode, startBarcodeScan } from '../utils/openFoodFacts.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { peekHealthSection, clearHealthSection, screenForHealthSection } from '../nav/healthSection.js';
import RecipeBuilder from '../components/RecipeBuilder.jsx';
import CustomFoodForm from '../components/CustomFoodForm.jsx';
import StarButton from '../components/StarButton.jsx';
import { useFoodLibrary } from '../hooks/useFoodLibrary.js';
import { customFoodEntry, favouriteEntry, servingText } from '../domain/customFoods.js';
import { mealEntry, draftFromSaved, PORTIONS } from '../domain/recipes.js';
import { recentFoods, yesterdayKey, copyMeals, appendMeals, mealFromPlan, cleanIngredients, groupBySection } from '../domain/foods.js';
import FoodShortcuts from '../components/FoodShortcuts.jsx';
import { weightCoach } from '../domain/weight.js';
import { weeklyMicros, microCoach } from '../domain/micros.js';
import ProgressPhotos from '../components/ProgressPhotos.jsx';
import ReadinessCard from '../components/ReadinessCard.jsx';
import MuscleRecovery from '../components/MuscleRecovery.jsx';
import SleepLogger from '../components/SleepLogger.jsx';
import FastingCard from '../components/FastingCard.jsx';
import GoalEta from '../components/GoalEta.jsx';
import HabitHeatmap from '../components/HabitHeatmap.jsx';
import { withTodaysTargets } from '../utils/todaysTargets.js';
import { isDone, currentStreak, toggleDay } from '../domain/habits.js';
import MicroCoachCard from '../components/MicroCoachCard.jsx';
import { calcWaterGoal, waterAdvice, DEFAULT_WATER_PROFILE } from '../domain/water.js';
import { currentWaterGoal, trainedToday, sleepWindow } from '../utils/waterGoal.js';
import WeightChart from '../components/WeightChart.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────
const todayStr = () => toLocalDateKey(new Date());
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

// ── Glass card (matches Finance tab aesthetic) ─────────────────────────────────
const GLASS = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 16,
  padding: '16px 18px',
  marginBottom: 10,
  backdropFilter: 'blur(24px)',
  boxShadow: '0 1px 0 0 rgba(255,255,255,0.07) inset, 0 12px 40px rgba(0,0,0,0.4)',
  position: 'relative',
  overflow: 'hidden',
};
function GlassCard({ children, style }) {
  return (
    <div style={{ ...GLASS, ...style }}>
      <div style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)', pointerEvents: 'none' }} />
      {children}
    </div>
  );
}
function GlassLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 18, height: 1, background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap' }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(255,255,255,0.1),transparent)' }} />
    </div>
  );
}

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
  display: 'block', fontSize: 11, color: 'var(--text-muted)',
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
        {/* Capped so cards and bars do not stretch across very wide windows. */}
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>{children}</div>
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
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
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
// ── Demo data shown when nothing is logged ────────────────────────────────────
const DEMO_SLEEP = { date:'demo', efficiency:82, duration:445, bedTime:'22:45', wakeTime:'07:00',
  stages:{ deep:62, rem:88, core:228, awake:67 } };
const DEMO_NUTRITION = { calories:1650, protein:95, carbs:182, fat:54, meals:[
  { id:'d1', name:'Oats + banana', calories:380, protein:12, carbs:68, fat:6,  time:'07:30' },
  { id:'d2', name:'Chicken & rice', calories:620, protein:52, carbs:72, fat:11, time:'12:45' },
  { id:'d3', name:'Protein shake',  calories:220, protein:28, carbs:14, fat:5,  time:'15:00' },
  { id:'d4', name:'Greek yoghurt',  calories:130, protein:13, carbs:9,  fat:4,  time:'16:30' },
  { id:'d5', name:'Steak & veg',    calories:300, protein:38, carbs:19, fat:8,  time:'19:00' },
]};
const DEMO_BODY = { weight:82.4, bodyFat:14.8, muscle:68.2 };
const DEMO_WATER = 1850;

// 1. OVERVIEW — dense command centre
// ═══════════════════════════════════════════════════════════════════════════════
function Overview({ habits, waterLogs, nutritionLogs, sleepData, settings, supplements, suppLogs, stimLogs, workoutLogs, bodyMetrics, onNav, onTabChange, appleHealth }) {
  const today = todayStr();

  const waterGoal   = currentWaterGoal(settings);
  const calGoal     = settings?.macroGoal ?? 2500;
  const protGoal    = settings?.proteinGoal ?? 160;
  const carbGoal    = settings?.macros?.carbs ?? 250;
  const fatGoal     = settings?.macros?.fat ?? 80;
  const caffLimit   = settings?.caffeineLimitMg ?? 400;
  const nicLimit    = settings?.nicotineLimitMg ?? 20;

  const rawWater    = useMemo(() => (waterLogs||[]).filter(l=>l.date===today).reduce((s,l)=>s+(l.amount||0),0),[waterLogs,today]);
  const todayNut    = useMemo(() => (nutritionLogs||[]).find(l=>l.date===today),[nutritionLogs,today]);
  const todayCal    = todayNut?.calories ?? todayNut?.totalCalories ?? 0;
  const todayProtein = todayNut?.protein ?? 0;
  const rawCarbs    = todayNut?.carbs ?? 0;
  const rawFat      = todayNut?.fat ?? 0;
  const rawLastSleep = useMemo(() => [...(sleepData||[])].sort((a,b)=>(b.date??'').localeCompare(a.date??''))[0],[sleepData]);
  const todayHabitsRaw  = useMemo(()=>{ const t=(habits||[]).length; const d=(habits||[]).filter(h=>h.lastCompleted===today).length; return{done:d,total:t};},[habits,today]);
  const todaySuppsRaw   = useMemo(()=>{ const t=(supplements||[]).length; const d=new Set((suppLogs||[]).filter(l=>l.date===today).map(l=>l.suppId)).size; return{done:d,total:t};},[supplements,suppLogs,today]);
  const todayStims      = useMemo(()=>{ const logs=(stimLogs||[]).filter(l=>l.date===today); return{ caffeine:logs.filter(l=>l.type==='caffeine').reduce((s,l)=>s+(l.amount||0),0), nicotine:logs.filter(l=>l.type==='nicotine').reduce((s,l)=>s+(l.amount||0),0) };},[stimLogs,today]);
  const workedOutToday  = useMemo(()=>(workoutLogs||[]).some(l=>l.date===today),[workoutLogs,today]);
  const latestBodyRaw   = useMemo(()=>[...(bodyMetrics||[])].sort((a,b)=>(b.date??'').localeCompare(a.date??''))[0],[bodyMetrics]);

  // Apple Health data  used as fallback when nothing is manually logged
  const ah = appleHealth?.data ?? null;
  const ahConnected = appleHealth?.connected ?? false;
  const ahLastSync  = appleHealth?.lastSync ?? null;

  const useDemo    = !rawLastSleep && rawWater === 0 && todayCal === 0 && !ah;
  const lastSleep  = rawLastSleep ?? ah?.sleep ?? (useDemo ? DEMO_SLEEP : null);
  const todayWater = rawWater   > 0 ? rawWater    : useDemo ? DEMO_WATER    : 0;
  const todayCal2  = todayCal   > 0 ? todayCal    : useDemo ? DEMO_NUTRITION.calories : 0;
  const todayProt  = todayProtein > 0 ? todayProtein : useDemo ? DEMO_NUTRITION.protein  : 0;
  const todayCarbs = rawCarbs   > 0 ? rawCarbs    : useDemo ? DEMO_NUTRITION.carbs    : 0;
  const todayFat   = rawFat     > 0 ? rawFat      : useDemo ? DEMO_NUTRITION.fat      : 0;
  const todayMeals = todayNut?.meals?.length ? todayNut.meals : useDemo ? DEMO_NUTRITION.meals : [];
  const todayHabits = todayHabitsRaw.total > 0 ? todayHabitsRaw : useDemo ? {done:3,total:5} : todayHabitsRaw;
  const todaySupps  = todaySuppsRaw.total  > 0 ? todaySuppsRaw  : useDemo ? {done:4,total:6} : todaySuppsRaw;
  const latestBody  = latestBodyRaw ?? (ah ? { weight: ah.weight, bodyFat: ah.bodyFat } : null) ?? (useDemo ? DEMO_BODY : null);

  // Apple Health extras shown in Overview
  const ahSteps      = ah?.steps       ?? null;
  const ahHeartRate  = ah?.heartRate   ?? null;
  const ahHrv        = ah?.hrv         ?? null;
  const ahEnergy     = ah?.activeEnergy ?? null;

  const sleepH = Math.floor((lastSleep?.duration??0)/60);
  const sleepM = (lastSleep?.duration??0)%60;

  const effColour = e => e>=85?'#4caf7d':e>=70?'#f4a642':'#e55a5a';
  const C44 = 2*Math.PI*44;

  const MacroCard = ({ label, value, display, goal, goalDisplay, colour, onClick }) => {
    const pct = Math.min((value/Math.max(goal,1))*100,100);
    return (
      <div onClick={onClick} style={{flex:'1 1 0',minWidth:0,padding:'20px 18px',background:'rgba(255,255,255,0.03)',borderRadius:14,border:'0.5px solid rgba(255,255,255,0.07)',cursor:'pointer',transition:'background 0.15s'}}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.06)'}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
        <div style={{fontSize:10.5,fontWeight:700,letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--text-muted)',fontFamily:'ui-monospace,monospace',marginBottom:10}}>{label}</div>
        <div style={{fontSize:32,fontWeight:300,color:colour,lineHeight:1,fontVariantNumeric:'tabular-nums',marginBottom:5}}>{display}</div>
        <div style={{fontSize:10.5,color:'var(--text-muted)',marginBottom:10}}>of {goalDisplay}</div>
        <div style={{height:5,borderRadius:3,background:'rgba(255,255,255,0.08)',overflow:'hidden'}}>
          <div style={{height:'100%',width:`${pct}%`,background:colour,borderRadius:3,transition:'width 0.5s ease'}}/>
        </div>
      </div>
    );
  };

  const Stat = ({ label, value, sub, colour='rgba(255,255,255,0.85)', warn, nav }) => (
    <div onClick={nav} style={{flex:'1 1 0',minWidth:0,padding:'14px 16px',cursor:nav?'pointer':'default',background:'rgba(255,255,255,0.03)',borderRadius:12,border:`0.5px solid ${warn?'rgba(229,90,90,0.4)':'rgba(255,255,255,0.07)'}`,transition:'background 0.15s'}}
      onMouseEnter={e=>nav&&(e.currentTarget.style.background='rgba(255,255,255,0.06)')}
      onMouseLeave={e=>nav&&(e.currentTarget.style.background='rgba(255,255,255,0.03)')}>
      <div style={{fontSize:10.5,fontWeight:700,letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--text-muted)',fontFamily:'ui-monospace,monospace',marginBottom:7}}>{label}</div>
      <div style={{fontSize:20,fontWeight:600,color:warn?'#e55a5a':colour,lineHeight:1,fontVariantNumeric:'tabular-nums'}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:4,fontFamily:'ui-monospace,monospace'}}>{sub}</div>}
    </div>
  );

  const Bar = ({value,max,colour})=>{
    const pct=Math.min((value/Math.max(max,1))*100,100);
    return(
      <div style={{height:5,borderRadius:3,background:'rgba(255,255,255,0.08)',overflow:'hidden',marginTop:6}}>
        <div style={{height:'100%',width:`${pct}%`,background:colour,borderRadius:3,transition:'width 0.5s ease'}}/>
      </div>
    );
  };

  return (
    <Section title="Overview">
      <div style={{display:'flex',flexDirection:'column',gap:22}}>

        {useDemo && (
          <div style={{padding:'8px 14px',borderRadius:10,background:'rgba(74,158,255,0.07)',border:'0.5px solid rgba(74,158,255,0.2)',fontSize:11,color:'rgba(74,158,255,0.7)'}}>
            = Showing demo data  log your first entry to see real stats
          </div>
        )}

        {/*  Apple Health sync badge  */}
        {ahConnected && (
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',borderRadius:10,background:'rgba(76,175,125,0.07)',border:'0.5px solid rgba(76,175,125,0.2)'}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#4caf7d',flexShrink:0,boxShadow:'0 0 6px #4caf7d'}}/>
            <span style={{fontSize:11,color:'rgba(76,175,125,0.9)'}}>
              Apple Health synced {ahLastSync ? ` ${ahLastSync}` : ''}
            </span>
          </div>
        )}

        {/*  Apple Health vitals row (steps, HR, HRV, energy)  */}
        {ahConnected && (ahSteps || ahHeartRate || ahHrv || ahEnergy) && (
          <div>
            <GlassLabel>Apple Health</GlassLabel>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {ahSteps != null && (
                <Stat label="Steps" value={ahSteps.toLocaleString()} colour="#4a9eff" />
              )}
              {ahHeartRate != null && (
                <Stat label="Heart Rate" value={Math.round(ahHeartRate)} sub="bpm avg" colour="#e55a5a" />
              )}
              {ahHrv != null && (
                <Stat label="HRV" value={Math.round(ahHrv)} sub="ms SDNN" colour="#9b5de5" />
              )}
              {ahEnergy != null && (
                <Stat label="Active Cal" value={Math.round(ahEnergy)} sub="kcal" colour="#f4a642" />
              )}
            </div>
          </div>
        )}

        {/* ── SLEEP QUALITY ── */}
        <div>
          <GlassLabel>Sleep Quality</GlassLabel>
          <GlassCard style={{cursor:'pointer'}} onClick={()=>onNav('sleep')}>
            {lastSleep ? (
              <div style={{display:'flex',gap:24,alignItems:'flex-start'}}>
                <div style={{position:'relative',width:110,height:110,flexShrink:0}}>
                  <svg viewBox="0 0 100 100" width="110" height="110">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"/>
                    <circle cx="50" cy="50" r="44" fill="none"
                      stroke={effColour(lastSleep.efficiency??0)} strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={C44}
                      strokeDashoffset={C44*(1-(lastSleep.efficiency??0)/100)}
                      style={{transform:'rotate(-90deg)',transformOrigin:'center',transition:'stroke-dashoffset 0.8s'}}
                    />
                  </svg>
                  <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                    <div style={{fontSize:20,fontWeight:700,color:effColour(lastSleep.efficiency??0),lineHeight:1}}>{lastSleep.efficiency??'—'}%</div>
                    <div style={{fontSize:10.5,color:'var(--text-muted)',letterSpacing:'0.08em',marginTop:3}}>EFF</div>
                  </div>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'baseline',gap:12,marginBottom:4}}>
                    <span style={{fontSize:38,fontWeight:200,color:'rgba(255,255,255,0.92)',lineHeight:1}}>{sleepH}h <span style={{fontSize:26}}>{sleepM}m</span></span>
                    <span style={{fontSize:12,color:'var(--text-muted)',fontFamily:'ui-monospace,monospace'}}>{lastSleep.bedTime??'—'} → {lastSleep.wakeTime??'—'}</span>
                  </div>
                  {lastSleep.stages ? (
                    <>
                      <StageBar height={8} stages={[
                        {label:'Deep', value:lastSleep.stages.deep??0,  colour:'#4a9eff'},
                        {label:'REM',  value:lastSleep.stages.rem??0,   colour:'#9b5de5'},
                        {label:'Core', value:lastSleep.stages.core??0,  colour:'#4caf7d'},
                        {label:'Awake',value:lastSleep.stages.awake??0, colour:'rgba(255,255,255,0.15)'},
                      ]}/>
                      <div style={{display:'flex',gap:16,marginTop:8,flexWrap:'wrap'}}>
                        {[{l:'Deep',c:'#4a9eff',v:lastSleep.stages.deep},{l:'REM',c:'#9b5de5',v:lastSleep.stages.rem},{l:'Core',c:'#4caf7d',v:lastSleep.stages.core},{l:'Awake',c:'rgba(255,255,255,0.25)',v:lastSleep.stages.awake}].map(s=>(
                          <div key={s.l} style={{display:'flex',alignItems:'center',gap:5}}>
                            <div style={{width:6,height:6,borderRadius:'50%',background:s.c,flexShrink:0}}/>
                            <span style={{fontSize:11,color:'var(--text-muted)',fontFamily:'ui-monospace,monospace'}}>{s.l}: {Math.floor((s.v??0)/60)}h{String((s.v??0)%60).padStart(2,'0')}m</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:8}}>No stage data</div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{display:'flex',alignItems:'center',gap:18,padding:'8px 0'}}>
                <div style={{width:110,height:110,borderRadius:'50%',border:'0.5px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <span style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><LineIcon name="moon" size={26} strokeWidth={1.5} /></span>
                </div>
                <div>
                  <div style={{fontSize:15,color:'var(--text-muted)',marginBottom:6}}>No sleep logged yet</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,0.18)'}}>Log via Sleep tab or sync Apple Health on iOS →</div>
                </div>
              </div>
            )}
          </GlassCard>
        </div>

        {/* ── VITALS ── */}
        <div>
          <GlassLabel>Vitals</GlassLabel>
          <div style={{display:'flex',gap:10}}>
            <MacroCard label="Water"    value={todayWater} display={todayWater>=1000?`${(todayWater/1000).toFixed(1)}L`:`${todayWater}ml`}  goal={waterGoal} goalDisplay={waterGoal>=1000?`${(waterGoal/1000).toFixed(1)}L`:`${waterGoal}ml`} colour="#4a9eff" onClick={()=>onNav('water')} />
            <MacroCard label="Calories" value={todayCal2}  display={`${todayCal2}`}  goal={calGoal}  goalDisplay={`${calGoal} kcal`}  colour="#f4a642" onClick={()=>onNav('nutrition')} />
            <MacroCard label="Protein"  value={todayProt}  display={`${todayProt}g`} goal={protGoal} goalDisplay={`${protGoal}g`}      colour="#f97316" onClick={()=>onNav('nutrition')} />
            <MacroCard label="Carbs"    value={todayCarbs} display={`${todayCarbs}g`} goal={carbGoal} goalDisplay={`${carbGoal}g`}     colour="#4caf7d" onClick={()=>onNav('nutrition')} />
            <MacroCard label="Fat"      value={todayFat}   display={`${todayFat}g`}  goal={fatGoal}  goalDisplay={`${fatGoal}g`}       colour="#9b5de5" onClick={()=>onNav('nutrition')} />
          </div>
        </div>

        {/* ── STATUS chips ── */}
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <Stat label="Habits"      value={`${todayHabits.done}/${todayHabits.total}`} sub={todayHabits.done===todayHabits.total&&todayHabits.total>0?'✓ all done':`${todayHabits.total-todayHabits.done} left`} colour="#4caf7d" nav={()=>onNav('habits')} />
          <Stat label="Supplements" value={`${todaySupps.done}/${todaySupps.total}`}   sub={todaySupps.done===todaySupps.total&&todaySupps.total>0?'✓ all taken':'remaining'} colour="#9b5de5" nav={()=>onNav('supplements')} />
          <Stat label="Workout"     value={workedOutToday?'Done ✓':'Not yet'} colour={workedOutToday?'#4caf7d':'rgba(255,255,255,0.35)'} sub={workedOutToday?'logged today':'no session'} nav={()=>onTabChange?.('workout')} />
          <div style={{flex:'1 1 0',minWidth:0,padding:'14px 16px',background:'rgba(255,255,255,0.03)',borderRadius:12,border:`0.5px solid ${todayStims.caffeine>caffLimit*0.9?'rgba(244,166,66,0.4)':'rgba(255,255,255,0.07)'}`}}>
            <div style={{fontSize:10.5,fontWeight:700,letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--text-muted)',fontFamily:'ui-monospace,monospace',marginBottom:7}}>Caffeine</div>
            <div style={{display:'flex',alignItems:'baseline',gap:4}}>
              <span style={{fontSize:20,fontWeight:600,color:todayStims.caffeine>caffLimit*0.9?'#f4a642':'rgba(255,255,255,0.85)',fontVariantNumeric:'tabular-nums'}}>{useDemo?180:todayStims.caffeine}</span>
              <span style={{fontSize:10.5,color:'var(--text-muted)'}}>/{caffLimit}mg</span>
            </div>
            <Bar value={useDemo?180:todayStims.caffeine} max={caffLimit} colour={todayStims.caffeine>caffLimit*0.9?'#f4a642':'#4a9eff'}/>
          </div>
          {(todayStims.nicotine>0)&&(
            <div style={{flex:'1 1 0',minWidth:0,padding:'14px 16px',background:'rgba(255,255,255,0.03)',borderRadius:12,border:'0.5px solid rgba(255,255,255,0.07)'}}>
              <div style={{fontSize:10.5,fontWeight:700,letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--text-muted)',fontFamily:'ui-monospace,monospace',marginBottom:7}}>Nicotine</div>
              <div style={{display:'flex',alignItems:'baseline',gap:4}}>
                <span style={{fontSize:20,fontWeight:600,color:'#f4a642',fontVariantNumeric:'tabular-nums'}}>{todayStims.nicotine}</span>
                <span style={{fontSize:10.5,color:'var(--text-muted)'}}>/{nicLimit}mg</span>
              </div>
              <Bar value={todayStims.nicotine} max={nicLimit} colour="#f4a642"/>
            </div>
          )}
        </div>

        {/* ── BODY metrics ── */}
        {latestBody && (
          <div>
            <GlassLabel>Body</GlassLabel>
            <div style={{display:'flex',gap:10}}>
              <div onClick={()=>onNav('body')} style={{flex:1,padding:'20px 18px',background:'rgba(255,255,255,0.03)',borderRadius:14,border:'0.5px solid rgba(255,255,255,0.07)',cursor:'pointer'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.06)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
                <div style={{fontSize:10.5,fontWeight:700,letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--text-muted)',fontFamily:'ui-monospace,monospace',marginBottom:10}}>Weight</div>
                <div style={{fontSize:34,fontWeight:200,color:'rgba(255,255,255,0.9)',lineHeight:1}}>{latestBody.weight}<span style={{fontSize:15,color:'var(--text-muted)',marginLeft:4}}>kg</span></div>
                {latestBody.date&&<div style={{fontSize:10.5,color:'var(--text-muted)',marginTop:6,fontFamily:'ui-monospace,monospace'}}>{latestBody.date===today?'logged today':latestBody.date?.slice(5)??'—'}</div>}
              </div>
              {latestBody.bodyFat!=null&&(
                <div onClick={()=>onNav('body')} style={{flex:1,padding:'20px 18px',background:'rgba(255,255,255,0.03)',borderRadius:14,border:'0.5px solid rgba(255,255,255,0.07)',cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.06)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
                  <div style={{fontSize:10.5,fontWeight:700,letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--text-muted)',fontFamily:'ui-monospace,monospace',marginBottom:10}}>Body Fat</div>
                  <div style={{fontSize:34,fontWeight:200,color:'#f4a642',lineHeight:1}}>{latestBody.bodyFat}<span style={{fontSize:15,color:'var(--text-muted)',marginLeft:3}}>%</span></div>
                </div>
              )}
              {latestBody.muscle!=null&&(
                <div onClick={()=>onNav('body')} style={{flex:1,padding:'20px 18px',background:'rgba(255,255,255,0.03)',borderRadius:14,border:'0.5px solid rgba(255,255,255,0.07)',cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.06)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
                  <div style={{fontSize:10.5,fontWeight:700,letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--text-muted)',fontFamily:'ui-monospace,monospace',marginBottom:10}}>Muscle</div>
                  <div style={{fontSize:34,fontWeight:200,color:'#4caf7d',lineHeight:1}}>{latestBody.muscle}<span style={{fontSize:15,color:'var(--text-muted)',marginLeft:4}}>kg</span></div>
                </div>
              )}
              <div style={{flex:2}}/>
            </div>
          </div>
        )}

        {/* ── TODAY'S MEALS ── */}
        <div>
          <GlassLabel>Today's meals</GlassLabel>
          <GlassCard>
            {todayMeals.length > 0 ? (
              <div style={{display:'flex',flexDirection:'column',gap:0}}>
                {todayMeals.map((m,i)=>(
                  <div key={m.id||i} style={{display:'flex',alignItems:'center',gap:14,padding:'11px 0',borderBottom:i<todayMeals.length-1?'0.5px solid rgba(255,255,255,0.05)':'none'}}>
                    <span style={{fontSize:10.5,color:'var(--text-muted)',fontFamily:'ui-monospace,monospace',minWidth:40}}>{m.time??'—'}</span>
                    <span style={{flex:1,fontSize:13,color:'var(--text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</span>
                    <div style={{display:'flex',gap:12,flexShrink:0}}>
                      {[{v:m.calories,u:'kcal',c:'#f4a642'},{v:m.protein,u:'p',c:'#4a9eff'},{v:m.carbs,u:'c',c:'#4caf7d'},{v:m.fat,u:'f',c:'#9b5de5'}].map(({v,u,c})=>(
                        <span key={u} style={{fontSize:11,color:c,fontFamily:'ui-monospace,monospace'}}>{v}<span style={{opacity:0.45}}>{u}</span></span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 0'}}>
                <span style={{fontSize:13,color:'var(--text-muted)'}}>No meals logged today</span>
                <button onClick={()=>onNav('nutrition')} style={{...btnGhost,fontSize:11,padding:'5px 12px'}}>+ Log food</button>
              </div>
            )}
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:10}}>
              <button onClick={()=>onNav('nutrition')} style={{fontSize:11,color:'var(--accent)',background:'none',border:'none',cursor:'pointer',padding:0}}>View nutrition →</button>
            </div>
          </GlassCard>
        </div>

      </div>
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

  // Streak rules live in domain/habits.js: a missed day now breaks the streak.
  const toggle = (habit) => updateHabit(habit.id, toggleDay(habit, today));

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

      <div style={{ marginBottom: 16 }}><HabitHeatmap habits={habits} /></div>

      {/* Habit list */}
      {habits.length === 0 && !adding ? (
        <div style={{ textAlign: 'center', padding: 40, opacity: 0.4 }}>
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><LineIcon name="water" size={26} strokeWidth={1.5} /></div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>No habits yet. Add one to start tracking.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {habits.map(h => {
            const done = isDone(h, today);
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
                    {currentStreak(h, today)} day streak
                  </div>
                </div>
                <button onClick={() => toggle(h)} aria-label={`${done ? 'Untick' : 'Tick'} ${h.name}`} aria-pressed={!!done} style={{
                  width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${done ? 'var(--accent)' : 'var(--card-border)'}`,
                  background: done ? 'var(--active-bg)' : 'transparent',
                  color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, transition: 'all 0.15s ease',
                }}>
                  {done ? '✓' : ''}
                </button>
                <button onClick={() => removeHabit(h.id)} aria-label={`Delete ${h.name}`} style={{
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
// searchOpenFoodFacts / lookupBarcode now live in utils/openFoodFacts.js so the
// mobile build's barcode scanner uses the exact same logic (see import above).

// Daily micronutrient panel — aggregates food (OpenFoodFacts) + taken supplements
// into one intake-vs-RDA view, grouped Vitamins / Minerals / Other.
function MicronutrientPanel({ micros }) {
  const [open, setOpen] = useState(true);
  const tracked = MICRONUTRIENTS.filter(m => (micros[m.key] || 0) > 0).length;

  const fmt = (n, unit) => {
    const v = unit === 'g' ? Math.round(n * 10) / 10
            : n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
    return `${v}${unit}`;
  };

  return (
    <div style={{ ...cardSx, marginBottom: 16 }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.07em' }}>MICRONUTRIENTS</div>
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
          {tracked > 0 ? `${tracked} tracked today` : 'no data yet'} {open ? '▾' : '▸'}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tracked === 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Log food (via Search/Scan) or tick supplements that list what they provide — micros fill in automatically.
            </div>
          )}
          {MICRO_GROUPS.map(g => {
            const rows = MICRONUTRIENTS.filter(m => m.group === g.id);
            return (
              <div key={g.id}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: g.colour, marginBottom: 8, opacity: 0.85 }}>
                  {g.label.toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {rows.map(m => {
                    const amt = micros[m.key] || 0;
                    const pct = m.rda > 0 ? (amt / m.rda) * 100 : 0;
                    const over = m.limit && amt > m.rda;
                    const colour = over ? '#e55a5a' : amt === 0 ? 'rgba(255,255,255,0.12)' : g.colour;
                    return (
                      <div key={m.key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 11.5, color: amt === 0 ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                            {m.label}{m.limit && <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 4 }}>limit</span>}
                          </span>
                          <span style={{ fontSize: 10.5, color: over ? '#e55a5a' : 'var(--text-muted)' }}>
                            {fmt(amt, m.unit)} / {fmt(m.rda, m.unit)} · {Math.round(pct)}%
                          </span>
                        </div>
                        <ProgressBar value={Math.min(amt, m.rda)} max={m.rda} colour={colour} height={4} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', opacity: 0.7, lineHeight: 1.5 }}>
            RDAs are general adult reference values. Micros only appear when a logged food or supplement reports them.
          </div>
        </div>
      )}
    </div>
  );
}

function Nutrition({ nutritionLogs, addNutritionLog, updateNutritionLog, settings, savedMeals = [], addSavedMeal, updateSavedMeal, removeSavedMeal, supplements = [], suppLogs = [] }) {
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

  // Unified daily micronutrients: food-derived + taken supplements.
  const dailyMicros = useMemo(() => {
    const foodMicros = sumMicros(meals.map(m => m.micros).filter(Boolean));
    const takenIds   = new Set((suppLogs || []).filter(l => l.date === today).map(l => l.suppId));
    const suppMicros = sumMicros((supplements || []).filter(s => takenIds.has(s.id)).map(s => s.micros).filter(Boolean));
    return sumMicros([foodMicros, suppMicros]);
  }, [meals, suppLogs, supplements, today]);

  // Micro coach: the last 7 days, judged only when enough logs carry micronutrient data
  const microAdvice = useMemo(
    () => microCoach(weeklyMicros({ nutritionLogs, supplements, suppLogs, today })),
    [nutritionLogs, supplements, suppLogs, today]
  );

  const [showAdd, setShowAdd]   = useState(false);
  const [addMode, setAddMode]   = useState('my');   // 'my' | 'search'
  const [showSaveMeal, setShowSaveMeal] = useState(false);
  const [recipeDraft, setRecipeDraft] = useState(null); // null | { initial: draft-or-null }
  const [portions, setPortions] = useState({});
  const lib = useFoodLibrary();
  const [foodDraft, setFoodDraft] = useState(null); // null | { initial }
  const [servingsFor, setServingsFor] = useState({});
  const [saveMealForm, setSaveMealForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  const [search, setSearch]   = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [qty, setQty]             = useState('100');
  const [unit, setUnit]           = useState('g');
  const [scanning, setScanning]   = useState(false);
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  const logSavedMeal = async (meal, portions = 1) => {
    const entry = mealEntry(meal, portions);
    entry.time = nowStr();
    const newMeals = [...meals, entry];
    const newTotals = newMeals.reduce((s, m) => ({
      calories: s.calories + (m.calories||0), protein: s.protein + (m.protein||0),
      carbs: s.carbs + (m.carbs||0), fat: s.fat + (m.fat||0),
    }), { calories:0, protein:0, carbs:0, fat:0 });
    if (todayLog?.id) await updateNutritionLog(todayLog.id, { meals: newMeals, ...newTotals });
    else await addNutritionLog({ date: today, meals: newMeals, ...newTotals });
  };

  // Recent & frequent: your own most-eaten foods from the last two months.
  const frequent = useMemo(() => recentFoods(nutritionLogs, { today, limit: 8 }), [nutritionLogs, today]);

  // Copy yesterday / quick-add: append entries to today with a short Undo.
  const yesterdayMeals = useMemo(() => copyMeals((nutritionLogs || []).find(l => l.date === yesterdayKey(today))), [nutritionLogs, today]);
  const appendEntries = async (entries, message) => {
    const prev = { meals, ...totals };
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
  };
  const removeMeal = async (id) => {
    if (!todayLog?.id) return;
    const prev = { meals, ...totals };
    const row = appendMeals({ ...todayLog, meals: [] }, meals.filter(m => m.id !== id), today);
    await updateNutritionLog(todayLog.id, { meals: row.meals, calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat });
    window.dispatchEvent(new CustomEvent('valerie:toast', { detail: {
      message: 'Removed from today', type: 'info',
      undo: async () => { await updateNutritionLog(todayLog.id, prev); },
    } }));
  };
  const copyYesterday = () => appendEntries(copyMeals((nutritionLogs || []).find(l => l.date === yesterdayKey(today))),
    `Copied ${yesterdayMeals.length} item${yesterdayMeals.length === 1 ? '' : 's'} from yesterday`);
  const quickAdd = (entry) => appendEntries([entry], `Added ${entry.calories} kcal`);

  // One tap: log the food exactly as last time, with a short Undo.
  const quickLog = async (food) => {
    const prev = { meals, ...totals };
    await logSavedMeal({ name: food.name, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, micros: food.micros, ingredients: food.ingredients });
    window.dispatchEvent(new CustomEvent('valerie:toast', { detail: {
      message: `Logged ${food.name} · ${food.calories} kcal`, type: 'success',
      undo: async () => {
        // The row may have just been created, so find it in the local mirror.
        const row = storage.get(STORAGE_KEYS.MACROS, []).find(l => l.date === today && !String(l.id).startsWith('local_'));
        if (row) await updateNutritionLog(row.id, prev);
      },
    } }));
  };

  const handleSaveMeal = async () => {
    const { name, calories, protein, carbs, fat } = saveMealForm;
    if (!name.trim() || !calories) return;
    await addSavedMeal({
      name: name.trim(),
      calories: parseFloat(calories)||0,
      protein:  parseFloat(protein)||0,
      carbs:    parseFloat(carbs)||0,
      fat:      parseFloat(fat)||0,
    });
    setSaveMealForm({ name:'', calories:'', protein:'', carbs:'', fat:'' });
    setShowSaveMeal(false);
  };

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
      micros:   scaleMicros(selected.per100.micros, factor),
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

  // QR / Barcode scanner — shared with mobile (utils/openFoodFacts.js)
  const startScan = () => {
    setScanning(true);
    streamRef.current = startBarcodeScan(videoRef.current, {
      onDetect: async (code) => {
        stopScan();
        try {
          const food = await lookupBarcode(code);
          setSelected(food); setSearch(food.name); setResults([food]);
        } catch {}
      },
      onError: (err) => { alert(err.message); setScanning(false); },
    });
  };
  const stopScan = () => {
    streamRef.current?.(); // stop() function returned by startBarcodeScan
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
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => { setShowAdd(true); setAddMode('my'); }} style={btnPrimary}>+ Log food</button>
        <button onClick={() => { setShowSaveMeal(false); setFoodDraft({ initial: null }); }} style={{ ...btnGhost, fontSize: 11 }}>⊕ New food</button>
        <button onClick={() => { setShowSaveMeal(false); setRecipeDraft({ initial: null }); }} style={{ ...btnGhost, fontSize: 11 }}>⊕ Build recipe</button>
        <button onClick={() => setShowSaveMeal(v => !v)} style={{ ...btnGhost, fontSize: 11 }}>
          {showSaveMeal ? '✕' : '⊕ Save meal'}
        </button>
      </div>
    }>
      {/* Macro bars */}
      <div style={{ ...cardSx, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.07em' }}>TODAY'S MACROS</div>
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

      <FastingCard />

      <FoodShortcuts
        yesterday={yesterdayMeals.length ? { count: yesterdayMeals.length, kcal: Math.round(yesterdayMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0)) } : null}
        onCopy={copyYesterday} onQuickAdd={quickAdd} />

      {/* Favourites: starred foods, one tap to log exactly as starred */}
      {lib.favourites.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 8 }}>FAVOURITES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {lib.favourites.map(f => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', borderRadius: 10, background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)' }}>
                <button type="button" onClick={() => appendEntries([favouriteEntry(f)], `Logged ${f.name} · ${f.calories} kcal`)} aria-label={`Log ${f.name}, ${f.calories} kilocalories`}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '8px 4px 8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', maxWidth: 190 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{f.name}</span>
                  <span className="val-num" style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>{f.calories} kcal · P{f.protein}</span>
                </button>
                <StarButton on name={f.name} onClick={() => lib.toggleFav(f)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent & frequent: one-tap re-log */}
      {frequent.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 8 }}>RECENT &amp; FREQUENT</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {frequent.map(f => (
              <button key={f.name} type="button" onClick={() => quickLog(f)}
                aria-label={`Log ${f.name}, ${f.calories} kilocalories`}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '8px 12px',
                  borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', maxWidth: 200,
                  background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
                }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 176 }}>+ {f.name}</span>
                <span className="val-num" style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>{f.calories} kcal · P{f.protein}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {settings?.todayTargetKind && (
        <div role="status" style={{ marginBottom: 12, fontSize: 12.5, color: 'var(--text-secondary)' }}>
          {settings.todayTargetKind === 'training' ? 'Training day' : 'Rest day'}: {settings.todayTargetDelta > 0 ? '+' : ''}{settings.todayTargetDelta} kcal today, all in carbs. Protein and fat stay put.
        </div>
      )}

      {/* Micro coach: 7-day gaps and what to eat */}
      <MicroCoachCard advice={microAdvice} style={{ ...cardSx, marginBottom: 16 }} />

      {/* Micronutrients (food + supplements) */}
      <MicronutrientPanel micros={dailyMicros} />

      {/* Custom food: your own food, numbers for one serving */}
      {foodDraft && (
        <div style={{ ...cardSx, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>{foodDraft.initial?.id ? 'Edit food' : 'New food'}</div>
          <CustomFoodForm key={foodDraft.initial?.id || 'new'} initial={foodDraft.initial}
            onCancel={() => setFoodDraft(null)}
            onDelete={async (id) => { await lib.removeCustomFood(id); setFoodDraft(null); }}
            onSave={async (row, id) => {
              const ok = id ? await lib.updateCustomFood(id, row) : await lib.addCustomFood(row);
              if (ok) { setFoodDraft(null); window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: id ? 'Food updated' : 'Food saved to My Foods', type: 'success' } })); }
            }} />
        </div>
      )}

      {/* Recipe builder: build a meal from ingredients, save or update it in My Meals */}
      {recipeDraft && (
        <div style={{ ...cardSx, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>{recipeDraft.initial?.id ? 'Edit recipe' : 'Build a recipe'}</div>
          <RecipeBuilder key={recipeDraft.initial?.id || 'new'} initial={recipeDraft.initial} recent={frequent} foods={lib.customFoods}
            onCancel={() => setRecipeDraft(null)}
            onDelete={async (id) => { await removeSavedMeal(id); setRecipeDraft(null); }}
            onSave={async (row, id) => {
              const ok = id ? await updateSavedMeal(id, row) : await addSavedMeal(row);
              if (ok) { setRecipeDraft(null); window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: id ? 'Recipe updated' : 'Recipe saved to My Meals', type: 'success' } })); }
            }} />
        </div>
      )}

      {/* Save meal form */}
      {showSaveMeal && (
        <div style={{ ...cardSx, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Save a meal</div>
          <input value={saveMealForm.name} onChange={e => setSaveMealForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Meal name (e.g. Protein shake)" style={inputSx}
            onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--input-border)'} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            {[['calories','Kcal'],['protein','Protein'],['carbs','Carbs'],['fat','Fat']].map(([k,l]) => (
              <div key={k}>
                <label style={lblSx}>{l}</label>
                <input type="number" value={saveMealForm[k]} onChange={e => setSaveMealForm(p => ({ ...p, [k]: e.target.value }))}
                  placeholder="0" style={inputSx} min="0"
                  onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--input-border)'} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowSaveMeal(false)} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
            <button onClick={handleSaveMeal} style={{ ...btnPrimary, flex: 1 }}>Save meal</button>
          </div>
        </div>
      )}

      {/* Add food modal */}
      {showAdd && (
        <div style={{ ...cardSx, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 0, borderRadius: 7, overflow: 'hidden', border: '0.5px solid var(--card-border)' }}>
              {[['my','🍽 My Meals'],['foods','🥣 My Foods'],['search','🔍 Search']].map(([id, label]) => (
                <button key={id} onClick={() => setAddMode(id)} style={{
                  padding: '5px 14px', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 500,
                  background: addMode === id ? 'rgba(255,255,255,0.9)' : 'var(--card-fill)',
                  color: addMode === id ? '#111' : 'var(--text-secondary)', transition: 'all 0.12s',
                }}>{label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {addMode === 'search' && (
                <button onClick={scanning ? stopScan : startScan} title="Scan barcode"
                  style={{ ...btnGhost, padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ScanIcon /> {scanning ? 'Stop scan' : 'Scan'}
                </button>
              )}
              <button onClick={() => { setShowAdd(false); stopScan(); }} style={btnGhost}>Cancel</button>
            </div>
          </div>

          {/* My Meals quick-pick */}
          {addMode === 'my' && (
            <div>
              {savedMeals.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No saved meals yet — save a meal above for quick logging.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {savedMeals.map(m => (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                      borderRadius: 8, background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{m.name}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                          {m.calories} kcal · P{m.protein}g · C{m.carbs}g · F{m.fat}g
                        </div>
                      </div>
                      <select aria-label={`Portions of ${m.name}`} value={portions[m.id] ?? 1} onChange={e => setPortions(p => ({ ...p, [m.id]: Number(e.target.value) }))} style={{ ...inputSx, width: 62, padding: '5px 6px', fontSize: 11 }}>
                        {PORTIONS.map(x => <option key={x} value={x}>{`×${x}`}</option>)}
                      </select>
                      <StarButton on={lib.isFav(m.name)} name={m.name} onClick={() => lib.toggleFav(m)} />
                      <button onClick={() => { setShowAdd(false); setRecipeDraft({ initial: { ...draftFromSaved(m), id: m.id } }); }} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11 }}>Edit</button>
                      <button onClick={async () => { const p = portions[m.id] ?? 1; const prev = { meals, ...totals }; setShowAdd(false); await logSavedMeal(m, p); window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: `Logged ${m.name}${p === 1 ? '' : ` ×${p}`}`, type: 'success', undo: async () => { const row = storage.get(STORAGE_KEYS.MACROS, []).find(l => l.date === today && !String(l.id).startsWith('local_')); if (row) await updateNutritionLog(row.id, prev); } } })); }} style={{ ...btnPrimary, padding: '5px 12px', fontSize: 11 }}>
                        + Log
                      </button>
                      <button onClick={() => removeSavedMeal(m.id)} style={{ ...btnGhost, padding: '5px 8px', fontSize: 11, color: 'var(--text-muted)' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search mode */}
          {/* My Foods: your own foods, pick how many servings */}
          {addMode === 'foods' && (
            <div>
              {lib.customFoods.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No foods of your own yet.
                  <div style={{ marginTop: 10 }}><button onClick={() => { setShowAdd(false); setFoodDraft({ initial: null }); }} style={btnPrimary}>⊕ New food</button></div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lib.customFoods.map(food => (
                    <div key={food.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{food.name}{food.brand ? ` (${food.brand})` : ''}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{food.calories} kcal · P{food.protein}g · C{food.carbs}g · F{food.fat}g · per {servingText(food)}</div>
                      </div>
                      <select aria-label={`Servings of ${food.name}`} value={servingsFor[food.id] ?? 1} onChange={e => setServingsFor(p => ({ ...p, [food.id]: Number(e.target.value) }))} style={{ ...inputSx, width: 62, padding: '5px 6px', fontSize: 11 }}>
                        {PORTIONS.map(x => <option key={x} value={x}>{`×${x}`}</option>)}
                      </select>
                      <StarButton on={lib.isFav(food.brand ? `${food.name} (${food.brand})` : food.name)} name={food.name} onClick={() => lib.toggleFav(customFoodEntry(food, 1))} />
                      <button onClick={() => { setShowAdd(false); setFoodDraft({ initial: food }); }} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11 }}>Edit</button>
                      <button onClick={() => { const n = servingsFor[food.id] ?? 1; setShowAdd(false); appendEntries([customFoodEntry(food, n)], `Logged ${food.name}${n === 1 ? '' : ` ×${n}`}`); }} style={{ ...btnPrimary, padding: '5px 12px', fontSize: 11 }}>+ Log</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {addMode === 'search' && <>

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
          </>}
        </div>
      )}

      {/* Meal log */}
      <div style={{ ...cardSx }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 10 }}>TODAY'S LOG</div>
        {meals.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>Nothing logged yet today.</p>
        ) : (
          groupBySection(meals).map(sec => (
            <div key={sec.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, letterSpacing: '0.07em', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 0' }}>
                <span>{sec.label}</span><span>{sec.kcal} kcal</span>
              </div>
              {sec.meals.map((m, i) => (
                <div key={m.id || i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                  padding: '7px 0', borderBottom: i < sec.meals.length - 1 ? '0.5px solid var(--sidebar-divider)' : 'none',
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{m.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {m.time}{m.qty ? `  ${m.qty}${m.unit || ''}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                    <div>{m.calories} kcal</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>P{m.protein} C{m.carbs} F{m.fat}</div>
                  </div>
                  <StarButton on={lib.isFav(m.name)} name={m.name} onClick={() => lib.toggleFav(m)} />
                  <button type="button" onClick={() => removeMeal(m.id)} aria-label={`Remove ${m.name}`}
                    style={{ width: 32, height: 32, flexShrink: 0, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer' }}>×</button>
                </div>
              ))}
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

// 5. WATER
// ═══════════════════════════════════════════════════════════════════════════════
// Water goal formula: weight(kg)×35 + activity bonus + caffeine bonus


function Water({ waterLogs, addWaterLog, settings }) {
  const today     = todayStr();
  const [showSettings, setShowSettings] = useState(false);
  const { data: profileDoc, save: saveProfileDoc } = useDocument('water_profile', STORAGE_KEYS.WATER_PROFILE, DEFAULT_WATER_PROFILE);
  const profile = profileDoc || DEFAULT_WATER_PROFILE;
  const [custom, setCustom] = useState('');

  const saveProfile = (p) => { saveProfileDoc(p); };

  const trained = trainedToday();
  const goal = calcWaterGoal(profile, { trainedToday: trained });

  const todayLogs = useMemo(() =>
    [...(waterLogs||[]).filter(l=>l.date===today)].sort((a,b)=>(a.time??'').localeCompare(b.time??'')),
    [waterLogs, today]);
  const total = todayLogs.reduce((s,l)=>s+(l.amount||0),0);
  const pct   = Math.min((total/goal)*100,100);
  const colour = pct>=100?'#4caf7d':pct>=60?'#4a9eff':pct>=30?'#f4a642':'#e55a5a';

  const log = async (ml) => addWaterLog({ date:today, amount:ml, time:nowStr() });

  const fmtWater = (ml) => profile.unit==='L'&&ml>=1000?`${(ml/1000).toFixed(1)}L`:`${ml}ml`;

  const QUICK = [250, 330, 500, 750, 1000];

  // Coaching: are you on pace for this hour of your day?
  const advice = waterAdvice({ totalMl: total, goalMl: goal, now: new Date(), ...sleepWindow() });

  return (
    <Section title="Water" action={
      <button onClick={()=>setShowSettings(v=>!v)} style={{...btnGhost,fontSize:11}}>
        {showSettings?'✕ Close':'⚙ Settings'}
      </button>
    }>

      {/* ── Profile / Settings panel ── */}
      {showSettings&&(
        <GlassCard style={{marginBottom:14}}>
          <GlassLabel>Personal profile — daily goal calculator</GlassLabel>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            {/* Weight */}
            <div>
              <label style={lblSx}>Weight</label>
              <div style={{display:'flex',gap:6}}>
                <input type="number" value={profile.weight} onChange={e=>saveProfile({...profile,weight:+e.target.value})} style={{...inputSx,flex:1}}/>
                <div style={{display:'flex',borderRadius:7,overflow:'hidden',border:'0.5px solid var(--card-border)'}}>
                  {['kg','lb'].map(u=>(
                    <button key={u} onClick={()=>saveProfile({...profile,weightUnit:u})} style={{
                      padding:'7px 10px',fontSize:11,border:'none',cursor:'pointer',
                      background:profile.weightUnit===u?'var(--accent)':'var(--hover-bg)',
                      color:profile.weightUnit===u?'#fff':'var(--text-muted)',
                    }}>{u}</button>
                  ))}
                </div>
              </div>
            </div>
            {/* Age */}
            <div>
              <label style={lblSx}>Age</label>
              <input type="number" value={profile.age} onChange={e=>saveProfile({...profile,age:+e.target.value})} style={inputSx}/>
            </div>
            {/* Sex */}
            <div>
              <label style={lblSx}>Sex</label>
              <div style={{display:'flex',borderRadius:7,overflow:'hidden',border:'0.5px solid var(--card-border)'}}>
                {['male','female','other'].map(s=>(
                  <button key={s} onClick={()=>saveProfile({...profile,sex:s})} style={{
                    flex:1,padding:'7px 6px',fontSize:11,border:'none',cursor:'pointer',
                    background:profile.sex===s?'var(--accent)':'var(--hover-bg)',
                    color:profile.sex===s?'#fff':'var(--text-muted)',
                    textTransform:'capitalize',
                  }}>{s}</button>
                ))}
              </div>
            </div>
            {/* Activity */}
            <div>
              <label style={lblSx}>Training hours / week</label>
              <input type="number" value={profile.activityHours} onChange={e=>saveProfile({...profile,activityHours:+e.target.value})} style={inputSx} min={0} max={21}/>
            </div>
          </div>
          {/* Caffeine */}
          <div style={{marginBottom:10}}>
            <label style={lblSx}>Average daily caffeine (mg)</label>
            <input type="number" value={profile.caffeineMg} onChange={e=>saveProfile({...profile,caffeineMg:+e.target.value})} style={inputSx}/>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>
              ☕ 1 coffee ≈ 95mg · espresso ≈ 75mg · energy drink ≈ 160mg. Above 200mg adds to daily water target.
            </div>
          </div>
          {/* Calculated goal */}
          <div style={{padding:'10px 14px',borderRadius:8,background:'rgba(74,158,255,0.08)',border:'0.5px solid rgba(74,158,255,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:12,color:'var(--text-secondary)'}}>Calculated daily goal</span>
            <span style={{fontSize:16,fontWeight:600,color:'#4a9eff'}}>{goal>=1000?`${(goal/1000).toFixed(1)}L`:`${goal}ml`}</span>
          </div>
        </GlassCard>
      )}

      {/* ── Main hero: ring centred ── */}
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,marginBottom:22,padding:'20px 0'}}>
        <div style={{position:'relative'}}>
          <RingChart value={total} max={goal} size={200} thickness={14} colour={colour}
            label={fmtWater(total)} sublabel={`of ${fmtWater(goal)}`} labelSize={24}/>
          <div style={{position:'absolute',inset:0,borderRadius:'50%',background:`radial-gradient(circle,${colour}08 0%,transparent 70%)`,pointerEvents:'none'}}/>
        </div>
        <div style={{fontSize:14,color:colour,fontWeight:500}}>{Math.round(pct)}% complete</div>
        {pct<100&&<div style={{fontSize:11.5,color:'var(--text-muted)'}}>{fmtWater(goal-total)} remaining</div>}
        {trained&&<div style={{fontSize:11,color:'var(--text-secondary)'}}>Goal includes +500 ml for today's training</div>}
        {advice&&(
          <div role="status" style={{fontSize:13,marginTop:4,textAlign:'center',maxWidth:320,lineHeight:1.45,color:advice.status==='behind'?'#e8a13a':advice.status==='done'||advice.status==='ahead'?'#4caf7d':'var(--text-secondary)'}}>{advice.message}</div>
        )}
        {advice?.sipMl>0&&(
          <button type="button" onClick={()=>log(advice.sipMl)} style={{...btnPrimary,marginTop:4}}>Log {advice.sipMl} ml</button>
        )}
      </div>

      {/* ── Quick log + entry ── */}
      <GlassCard style={{marginBottom:14}}>
        <GlassLabel>Quick log</GlassLabel>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
          {QUICK.map(ml=>(
            <button key={ml} onClick={()=>log(ml)} style={{
              flex:'1 1 0',padding:'10px 8px',borderRadius:10,fontSize:13,cursor:'pointer',
              border:`0.5px solid ${colour}44`,background:'rgba(255,255,255,0.03)',
              color:'var(--text-secondary)',transition:'all 0.15s',
            }}
            onMouseEnter={e=>{e.currentTarget.style.background=`${colour}14`;e.currentTarget.style.color=colour;}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)';e.currentTarget.style.color='var(--text-secondary)';}}>
              {ml<1000?`${ml}ml`:`${ml/1000}L`}
            </button>
          ))}
        </div>
        <div style={{display:'flex',gap:8}}>
          <input type="number" value={custom} onChange={e=>setCustom(e.target.value)}
            placeholder="Custom amount in ml…" style={{...inputSx,flex:1,fontSize:13}}
            onKeyDown={e=>e.key==='Enter'&&custom&&(log(parseInt(custom)),setCustom(''))}
            onFocus={e=>e.target.style.borderColor=colour} onBlur={e=>e.target.style.borderColor='var(--input-border)'}
          />
          <button onClick={()=>{if(custom){log(parseInt(custom));setCustom('');}}} style={{...btnPrimary,padding:'8px 20px',fontSize:13}}>Log</button>
        </div>
      </GlassCard>

      {/* ── Today's log ── */}
      <GlassCard>
        <GlassLabel>Today's intake</GlassLabel>
        {todayLogs.length===0?(
          <div style={{fontSize:12,color:'var(--text-muted)',padding:'4px 0'}}>Nothing logged yet.</div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {[...todayLogs].reverse().slice(0,8).map((l,i)=>(
              <div key={l.id||i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 10px',borderRadius:8,background:'rgba(255,255,255,0.025)'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:colour,flexShrink:0}}/>
                  <span style={{fontSize:13,color:'var(--text-secondary)'}}>{fmtWater(l.amount)}</span>
                </div>
                <span style={{fontSize:11,color:'var(--text-muted)',fontFamily:'ui-monospace,monospace'}}>{l.time}</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. BODY
// ═══════════════════════════════════════════════════════════════════════════════
const BODY_TABS = [
  { id:'weight',       label:'Weight' },
  { id:'measurements', label:'Measurements' },
  { id:'photos',       label:'Photos' },
];

function Body({ bodyMetrics, addBodyMetric, settings }) {
  const [bodyTab,  setBodyTab]  = useState('weight');
  const [logForm,  setLogForm]  = useState({ weight:'', bodyFat:'', muscle:'', notes:'' });
  const [adding,   setAdding]   = useState(false);
  const { data: measuresDoc, save: saveMeasuresDoc } = useDocument('measurements', STORAGE_KEYS.MEASUREMENTS, {});
  const [measures, setMeasures] = useState(() => measuresDoc || {});

  // Sync measurements from Firestore cross-device
  useEffect(() => { if (measuresDoc) setMeasures(measuresDoc); }, [measuresDoc]);

  const rawSorted = useMemo(()=>[...(bodyMetrics||[])].sort((a,b)=>(b.date??'').localeCompare(a.date??'')),[bodyMetrics]);
  const useBodyDemo = rawSorted.length === 0;

  const DEMO_BODY_METRICS = useMemo(() => [
    { date:'2026-06-02', weight:82.4, bodyFat:14.8, muscle:68.2, notes:'Demo data' },
    { date:'2026-05-26', weight:82.8, bodyFat:15.1, muscle:67.9 },
    { date:'2026-05-19', weight:83.2, bodyFat:15.4, muscle:67.6 },
    { date:'2026-05-12', weight:83.6, bodyFat:15.7, muscle:67.3 },
    { date:'2026-05-05', weight:84.0, bodyFat:16.0, muscle:67.0 },
    { date:'2026-04-28', weight:84.5, bodyFat:16.3, muscle:66.8 },
  ], []);

  const sorted = useBodyDemo ? DEMO_BODY_METRICS : rawSorted;
  const latest = sorted[0];
  const weightData = useMemo(()=>sorted.slice(0,30).reverse().map(m=>({value:parseFloat(m.weight)||0,label:m.date?m.date.slice(5):''})),[sorted]);

  // Weight coach: smoothed trend + weekly rate + pace against the Coach goal (real data only)
  const coach = useMemo(() => (useBodyDemo ? null : weightCoach(rawSorted, settings?.coachGoal?.targets?.weeklyRateKg ?? null, settings?.coachGoal?.targetWeightKg ?? null, todayStr())), [useBodyDemo, rawSorted, settings?.coachGoal]);

  const saveMeasures = (m) => { setMeasures(m); saveMeasuresDoc(m); };
  const MEASURE_FIELDS = [
    { key:'waist',  label:'Waist',  unit:'cm' },
    { key:'chest',  label:'Chest',  unit:'cm' },
    { key:'hips',   label:'Hips',   unit:'cm' },
    { key:'arms',   label:'Arms',   unit:'cm' },
    { key:'thighs', label:'Thighs', unit:'cm' },
    { key:'neck',   label:'Neck',   unit:'cm' },
  ];

  return (
    <Section title="Body" action={
      bodyTab==='weight'?<button onClick={()=>setAdding(v=>!v)} style={btnPrimary}>{adding?'✕ Close':'+ Log'}</button>:
      null
    }>
      {/* Sub-tab bar */}
      <div style={{display:'flex',gap:4,marginBottom:14,background:'rgba(255,255,255,0.03)',padding:4,borderRadius:10,border:'0.5px solid rgba(255,255,255,0.07)'}}>
        {BODY_TABS.map(t=>(
          <button key={t.id} onClick={()=>setBodyTab(t.id)} style={{
            flex:1,padding:'6px 0',borderRadius:7,border:'none',cursor:'pointer',
            background:bodyTab===t.id?'var(--active-bg)':'transparent',
            color:bodyTab===t.id?'var(--accent)':'var(--text-muted)',
            fontSize:12,fontWeight:bodyTab===t.id?600:400,transition:'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Weight tab ── */}
      {bodyTab==='weight'&&(
        <>
          {useBodyDemo && (
            <div style={{padding:'8px 14px',borderRadius:10,background:'rgba(74,158,255,0.07)',border:'0.5px solid rgba(74,158,255,0.2)',fontSize:11,color:'rgba(74,158,255,0.7)',marginBottom:12}}>
              = Showing demo data  tap + Log to start tracking your real metrics
            </div>
          )}
          {/* Log form */}
          {adding&&(
            <GlassCard style={{marginBottom:12}}>
              <GlassLabel>Log today's metrics</GlassLabel>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                {[['weight','Weight','kg'],['bodyFat','Body Fat','%'],['muscle','Muscle','%']].map(([k,l,u])=>(
                  <div key={k}>
                    <label style={lblSx}>{l} ({u})</label>
                    <input type="number" value={logForm[k]} onChange={e=>setLogForm(p=>({...p,[k]:e.target.value}))}
                      placeholder={`e.g. ${k==='weight'?'80':k==='bodyFat'?'15':'40'}`} style={inputSx}/>
                  </div>
                ))}
                <div style={{gridColumn:'1/-1'}}>
                  <label style={lblSx}>Notes</label>
                  <input value={logForm.notes} onChange={e=>setLogForm(p=>({...p,notes:e.target.value}))} placeholder="optional notes" style={inputSx}/>
                </div>
              </div>
              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>setAdding(false)} style={{...btnGhost,flex:1}}>Cancel</button>
                <button onClick={async()=>{
                  if(!(Number(logForm.weight) > 0)) return;
                  const num = (v) => (v === '' || v == null || !(Number(v) > 0) ? undefined : Number(v));
                  await addBodyMetric({date:todayStr(), weight:num(logForm.weight), bodyFat:num(logForm.bodyFat), muscle:num(logForm.muscle), notes:logForm.notes});
                  setLogForm({weight:'',bodyFat:'',muscle:'',notes:''});setAdding(false);
                }} style={{...btnPrimary,flex:2}}>Save</button>
              </div>
            </GlassCard>
          )}

          {/* Latest stats */}
          {latest&&(
            <div style={{display:'flex',gap:8,marginBottom:12}}>
              {[{label:'WEIGHT',value:latest.weight,unit:'kg'},{label:'BODY FAT',value:latest.bodyFat,unit:'%'},{label:'MUSCLE',value:latest.muscle,unit:'%'}].filter(m=>m.value).map(m=>(
                <div key={m.label} style={{...cardSx,flex:1,textAlign:'center'}}>
                  <div style={{fontSize:10.5,color:'var(--text-muted)',letterSpacing:'0.1em',marginBottom:4}}>{m.label}</div>
                  <div style={{fontSize:22,fontWeight:300,color:'var(--text-primary)'}}>{m.value}<span style={{fontSize:11,color:'var(--text-muted)',marginLeft:2}}>{m.unit}</span></div>
                  <div style={{fontSize:10.5,color:'var(--text-muted)',marginTop:2}}>{latest.date===todayStr()?'today':latest.date?.slice(5)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Weight coach: trend, weekly rate, pace vs goal */}
          {coach && coach.series.length>1 ? (
            <GlassCard>
              <div style={{display:'flex',gap:18,alignItems:'flex-end',flexWrap:'wrap',marginBottom:10}}>
                <div>
                  <div style={{fontSize:10.5,color:'var(--text-muted)',letterSpacing:'0.1em',marginBottom:4}}>TREND WEIGHT</div>
                  <div className="val-num" style={{fontSize:28,fontWeight:500,color:'var(--tab-accent)',lineHeight:1}}>{coach.trend}<span style={{fontSize:12,color:'var(--text-secondary)',marginLeft:3}}>kg</span></div>
                </div>
                <div>
                  <div style={{fontSize:10.5,color:'var(--text-muted)',letterSpacing:'0.1em',marginBottom:4}}>RATE</div>
                  <div className="val-num" style={{fontSize:20,color:'var(--text-primary)',lineHeight:1.1}}>{coach.rate==null?'—':(coach.rate>0?'+':'')+coach.rate}<span style={{fontSize:11,color:'var(--text-secondary)',marginLeft:3}}>kg/week</span></div>
                </div>
              </div>
              {coach.pace && (
                <div role="status" style={{fontSize:12.5,lineHeight:1.45,marginBottom:10,color:coach.pace.status==='on-track'?'#4caf7d':'#e8a13a'}}>{coach.pace.message}</div>
              )}
              {coach.eta && (
                <div style={{ marginBottom: 10 }}><GoalEta eta={coach.eta} targetKg={settings?.coachGoal?.targetWeightKg} /></div>
              )}
              {coach.rate==null && <div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:10}}>Log weight on a few days over a week or more to see your rate.</div>}
              <WeightChart series={coach.series} />
              <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:6}}>Dots are daily weigh-ins; the line is your trend. Judge progress by the line: daily readings swing with water and food.</div>
            </GlassCard>
          ) : weightData.length>1?(
            <GlassCard>
              <GlassLabel>Weight trend — last {weightData.length} entries</GlassLabel>
              <BarChart data={weightData} maxHeight={80}/>
            </GlassCard>
          ):(
            <div style={{textAlign:'center',padding:32,opacity:0.35}}>
              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><LineIcon name="scale" size={26} strokeWidth={1.5} /></div>
              <p style={{fontSize:12,color:'var(--text-muted)',marginTop:8}}>Log a few entries to see your trend.</p>
            </div>
          )}

          <div style={{padding:'10px 14px',borderRadius:8,background:'rgba(255,255,255,0.02)',border:'0.5px solid var(--card-border)',fontSize:11.5,color:'var(--text-muted)',marginTop:10}}>
            🔵 Eufy body metrics sync automatically from Apple Health on iOS. Log manually on desktop until iPhone is set up.
      </div>

      {/* History */}
          {/* History */}
          {sorted.length>0&&(
            <GlassCard style={{marginTop:10}}>
              <GlassLabel>History</GlassLabel>
              {sorted.slice(0,8).map((m,i)=>(
                <div key={m.id||i} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:i<Math.min(sorted.length,8)-1?'0.5px solid rgba(255,255,255,0.05)':'none'}}>
                  <span style={{fontSize:11,color:'var(--text-muted)',fontFamily:'ui-monospace,monospace'}}>{m.date}</span>
                  <span style={{fontSize:11.5,color:'var(--text-secondary)'}}>{m.weight&&`${m.weight}kg`}{m.bodyFat&&` · ${m.bodyFat}% fat`}{m.muscle&&` · ${m.muscle}% muscle`}</span>
                </div>
              ))}
            </GlassCard>
          )}
        </>
      )}

      {/* ── Measurements tab ── */}
      {bodyTab==='measurements'&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <GlassLabel>Current measurements</GlassLabel>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {MEASURE_FIELDS.map(f=>(
              <div key={f.key} style={{...cardSx}}>
                <label style={lblSx}>{f.label} ({f.unit})</label>
                <input type="number" value={measures[f.key]??''} onChange={e=>saveMeasures({...measures,[f.key]:e.target.value})}
                  placeholder="—" style={{...inputSx,fontSize:16,fontWeight:300,padding:'6px 8px'}}/>
              </div>
            ))}
          </div>
          <div style={{fontSize:11,color:'var(--text-muted)',padding:'6px 0'}}>Measurements auto-save as you type.</div>
        </div>
      )}

      {/* ── Photos tab ── */}
      {bodyTab==='photos'&&<ProgressPhotos bodyMetrics={bodyMetrics} />}
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. SUPPLEMENTS — tap-to-take stack
// ═══════════════════════════════════════════════════════════════════════════════
const SUPP_COLOURS = ['#4a9eff','#4caf7d','#f4a642','#9b5de5','#e55a5a','#00c9a7','#f7b731'];
const TIME_SLOTS   = [
  { id: 'morning', label: 'Morning', emoji: '🌅', range: '7–10 AM' },
  { id: 'midday',  label: 'Midday',  emoji: '☀️', range: '11 AM–2 PM' },
  { id: 'evening', label: 'Evening', emoji: '🌙', range: '7–10 PM' },
  { id: 'anytime', label: 'Anytime', emoji: '',  range: '' },
];
const SUPP_SUGGESTIONS = [
  { name:'Creatine',         dose:'5g',   info:'Post-workout · increases strength' },
  { name:'Magnesium',        dose:'400mg',info:'Evening · sleep quality + recovery', micros:{ magnesium:400 } },
  { name:'Vitamin D3',       dose:'5000IU',info:'Morning · with fat for absorption', micros:{ vitaminD:125 } },
  { name:'Omega-3',          dose:'2g',   info:'Morning · with food' },
  { name:'Zinc',             dose:'15mg', info:'Evening · immune + testosterone', micros:{ zinc:15 } },
  { name:'Ashwagandha',      dose:'600mg',info:'Evening · cortisol + stress' },
  { name:'L-Citrulline',     dose:'6–8g', info:'Morning · ~30 min pre-workout' },
  { name:'L-Carnitine',      dose:'1–2g', info:'Morning · with carbs' },
  { name:'Glutamine',        dose:'5g',   info:'Post-workout or bedtime' },
  { name:'Vitamin C',        dose:'1000mg',info:'Morning · antioxidant', micros:{ vitaminC:1000 } },
  { name:'B-Complex',        dose:'1 cap',info:'Morning · energy metabolism', micros:{ thiamin:50, riboflavin:50, niacin:50, b6:50, folate:400, b12:100 } },
  { name:'Probiotics',       dose:'1 cap',info:'Morning · empty stomach' },
  { name:'Collagen',         dose:'10g',  info:'Morning · with vitamin C' },
  { name:'Berberine',        dose:'500mg',info:'With meals · blood sugar' },
  { name:'NMN',              dose:'500mg',info:'Morning · NAD+ precursor' },
  { name:'Protein Powder',   dose:'30g',  info:'Post-workout or morning' },
  { name:'Pre-workout',      dose:'1 scoop',info:'30 min before training' },
  { name:'Iron',             dose:'18mg', info:'Morning · with vitamin C', micros:{ iron:18, vitaminC:60 } },
  { name:'Calcium',          dose:'500mg',info:'With food · bone health', micros:{ calcium:500 } },
  { name:'Vitamin K2',       dose:'100µg',info:'Morning · with D3', micros:{ vitaminK:100 } },
];

function Supplements({ supplements, suppLogs, addSupplement, removeSupplement, addSuppLog }) {
  const today      = todayStr();
  const [search,   setSearch]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name:'', dose:'', timeOfDay:'morning', colour:SUPP_COLOURS[0], notes:'', micros:{} });
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Editable rows for "nutrients provided" — derived from form.micros
  const microRows = Object.entries(form.micros || {});
  const addMicroRow = () => {
    const used = new Set(Object.keys(form.micros || {}));
    const next = MICRONUTRIENTS.find(m => !used.has(m.key));
    if (next) setForm(p => ({ ...p, micros: { ...p.micros, [next.key]: 0 } }));
  };
  const setMicroKey = (oldKey, newKey) => setForm(p => {
    const m = { ...p.micros }; const v = m[oldKey]; delete m[oldKey]; m[newKey] = v; return { ...p, micros: m };
  });
  const setMicroVal = (key, val) => setForm(p => ({ ...p, micros: { ...p.micros, [key]: parseFloat(val) || 0 } }));
  const removeMicroRow = (key) => setForm(p => { const m = { ...p.micros }; delete m[key]; return { ...p, micros: m }; });

  const takenToday = new Set((suppLogs||[]).filter(l=>l.date===today).map(l=>l.suppId));

  const tap = async (supp) => {
    if (takenToday.has(supp.id)) return;
    await addSuppLog({ suppId: supp.id, date: today, time: nowStr() });
  };

  const markAllSlot = async (slotSupps) => {
    const pending = slotSupps.filter(s => !takenToday.has(s.id));
    for (const s of pending) await addSuppLog({ suppId: s.id, date: today, time: nowStr() });
  };

  const addSupp = async () => {
    if (!form.name.trim()) return;
    await addSupplement({ name: form.name.trim(), dose: form.dose, timeOfDay: form.timeOfDay, colour: form.colour, notes: form.notes, micros: form.micros || {}, streak: 0 });
    setForm({ name:'', dose:'', timeOfDay:'morning', colour:SUPP_COLOURS[0], notes:'', micros:{} });
    setShowForm(false); setSearch('');
  };

  const filteredSuggestions = SUPP_SUGGESTIONS.filter(s =>
    search.length > 0 && s.name.toLowerCase().includes(search.toLowerCase()) &&
    !supplements.find(ex => ex.name.toLowerCase() === s.name.toLowerCase())
  );

  const totalTaken = takenToday.size;
  const totalSupps = supplements.length;

  return (
    <Section title="Supplements" action={
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        {totalSupps>0&&<span style={{fontSize:11,color:'var(--text-muted)'}}>{totalTaken}/{totalSupps} taken</span>}
        <button onClick={()=>{setShowForm(v=>!v);setSearch('');}} style={btnPrimary}>
          {showForm?'✕ Close':'+ Add'}
        </button>
      </div>
    }>

      {/* ── Add form ── */}
      {showForm&&(
        <GlassCard style={{marginBottom:14}}>
          <GlassLabel>Add to stack</GlassLabel>
          {/* Search / name */}
          <div style={{position:'relative',marginBottom:8}}>
            <input
              value={search||form.name}
              onChange={e=>{setSearch(e.target.value);setForm(p=>({...p,name:e.target.value}));setShowSuggestions(true);}}
              placeholder="Search or type supplement name…"
              style={{...inputSx}}
              onFocus={()=>setShowSuggestions(true)}
            />
            {showSuggestions&&filteredSuggestions.length>0&&(
              <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:20,background:'var(--bg-panel)',border:'0.5px solid var(--card-border)',borderRadius:8,marginTop:3,maxHeight:200,overflowY:'auto',boxShadow:'0 8px 24px rgba(0,0,0,0.4)'}}>
                {filteredSuggestions.map(s=>(
                  <div key={s.name} onClick={()=>{setForm(p=>({...p,name:s.name,dose:s.dose,micros:s.micros||{}}));setSearch('');setShowSuggestions(false);}}
                    style={{padding:'9px 12px',cursor:'pointer',borderBottom:'0.5px solid var(--card-border)',display:'flex',flexDirection:'column',gap:2}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--hover-bg)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  >
                    <span style={{fontSize:13,color:'var(--text-primary)'}}>{s.name}</span>
                    <span style={{fontSize:10.5,color:'var(--text-muted)'}}>{s.dose} · {s.info}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{display:'flex',gap:8,marginBottom:8}}>
            <div style={{flex:1}}>
              <label style={lblSx}>Dose / amount</label>
              <input value={form.dose} onChange={e=>setForm(p=>({...p,dose:e.target.value}))} placeholder="e.g. 5g" style={inputSx}/>
            </div>
            <div style={{flex:1}}>
              <label style={lblSx}>Time of day</label>
              <select value={form.timeOfDay} onChange={e=>setForm(p=>({...p,timeOfDay:e.target.value}))}
                style={{...inputSx,cursor:'pointer'}}>
                {TIME_SLOTS.map(t=><option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <label style={lblSx}>Colour tag</label>
            <div style={{display:'flex',gap:6}}>
              {SUPP_COLOURS.map(c=>(
                <button key={c} onClick={()=>setForm(p=>({...p,colour:c}))} style={{width:22,height:22,borderRadius:'50%',background:c,cursor:'pointer',border:`2.5px solid ${form.colour===c?'white':'transparent'}`,padding:0}}/>
              ))}
            </div>
          </div>

          {/* Nutrients provided — feeds the unified daily micronutrient totals */}
          <div style={{marginBottom:10}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
              <label style={{...lblSx,marginBottom:0}}>Nutrients provided (optional)</label>
              <button onClick={addMicroRow} style={{...btnGhost,fontSize:10.5,padding:'3px 9px'}}>+ Nutrient</button>
            </div>
            {microRows.length===0 ? (
              <div style={{fontSize:10.5,color:'var(--text-muted)',opacity:0.8}}>Add what one dose delivers (e.g. Vitamin D 125µg) so taking it counts toward your day.</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {microRows.map(([key,val])=>{
                  const def = MICRO_BY_KEY[key];
                  const taken = new Set(Object.keys(form.micros||{}));
                  return (
                    <div key={key} style={{display:'flex',gap:6,alignItems:'center'}}>
                      <select value={key} onChange={e=>setMicroKey(key,e.target.value)} style={{...inputSx,flex:2,cursor:'pointer'}}>
                        {MICRONUTRIENTS.filter(m=>m.key===key||!taken.has(m.key)).map(m=>(
                          <option key={m.key} value={m.key}>{m.label}</option>
                        ))}
                      </select>
                      <input type="number" min="0" value={val} onChange={e=>setMicroVal(key,e.target.value)} style={{...inputSx,flex:1}}/>
                      <span style={{fontSize:11,color:'var(--text-muted)',minWidth:22}}>{def?.unit}</span>
                      <button onClick={()=>removeMicroRow(key)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:4,display:'flex'}}><TrashIcon/></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>{setShowForm(false);setSearch('');}} style={{...btnGhost,flex:1}}>Cancel</button>
            <button onClick={addSupp} style={{...btnPrimary,flex:2}}>Add to stack</button>
          </div>
        </GlassCard>
      )}

      {/* ── Stack grouped by time ── */}
      {supplements.length===0&&!showForm?(
        <div style={{textAlign:'center',padding:40,opacity:0.4}}>
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><LineIcon name="pill" size={30} strokeWidth={1.5} /></div>
          <p style={{fontSize:13,color:'var(--text-muted)',marginTop:8}}>No supplements in your stack yet.</p>
        </div>
      ):(
        TIME_SLOTS.map(slot=>{
          const slotSupps = supplements.filter(s=>(s.timeOfDay??'anytime')===slot.id);
          if (slotSupps.length===0) return null;
          const allTaken  = slotSupps.every(s=>takenToday.has(s.id));

          return(
            <div key={slot.id} style={{marginBottom:16}}>
              {/* Slot header */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:16}}>{slot.emoji}</span>
                  <span style={{fontSize:13,fontWeight:600,color:'var(--text-primary)'}}>{slot.label}</span>
                  {slot.range&&<span style={{fontSize:10.5,color:'var(--text-muted)'}}>{slot.range}</span>}
                </div>
                {!allTaken&&slotSupps.length>1&&(
                  <button onClick={()=>markAllSlot(slotSupps)} style={{...btnGhost,fontSize:10.5,padding:'4px 10px'}}>
                    Mark all taken
                  </button>
                )}
                {allTaken&&<span style={{fontSize:10.5,color:'#4caf7d'}}>✓ All taken</span>}
              </div>

              {/* Supplement rows */}
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {slotSupps.map(s=>{
                  const taken = takenToday.has(s.id);
                  return(
                    <div key={s.id} style={{
                      display:'flex',alignItems:'center',gap:12,
                      padding:'10px 14px',borderRadius:10,
                      background:taken?'rgba(76,175,125,0.06)':'rgba(255,255,255,0.03)',
                      border:`0.5px solid ${taken?'rgba(76,175,125,0.25)':'rgba(255,255,255,0.07)'}`,
                      transition:'all 0.2s',cursor:'pointer',
                    }} onClick={()=>tap(s)}>
                      {/* Circle checkbox */}
                      <div style={{
                        width:28,height:28,borderRadius:'50%',flexShrink:0,
                        border:`2px solid ${taken?'#4caf7d':(s.colour??'var(--accent)')+'66'}`,
                        background:taken?'#4caf7d':'transparent',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        transition:'all 0.2s',
                      }}>
                        {taken&&<span style={{fontSize:13,color:'#fff',lineHeight:1}}>✓</span>}
                      </div>

                      {/* Colour dot */}
                      <div style={{width:8,height:8,borderRadius:'50%',background:s.colour??'var(--accent)',flexShrink:0,opacity:taken?0.4:1}}/>

                      {/* Info */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,color:taken?'var(--text-muted)':'var(--text-primary)',textDecoration:taken?'line-through':'none',transition:'all 0.2s',display:'flex',alignItems:'center',gap:6}}>
                          {s.name}
                          {hasMicros(s.micros)&&(
                            <span style={{fontSize:10.5,fontWeight:700,padding:'1px 6px',borderRadius:4,background:'rgba(74,158,255,0.14)',color:'#4a9eff',letterSpacing:'0.03em',flexShrink:0}}>
                              {Object.keys(s.micros).filter(k=>MICRO_BY_KEY[k]&&s.micros[k]>0).length} nutrients
                            </span>
                          )}
                        </div>
                        {s.dose&&<div style={{fontSize:10.5,color:'var(--text-muted)',marginTop:1}}>{s.dose}{s.notes?` · ${s.notes}`:''}</div>}
                      </div>

                      {/* Running low badge — if quantity tracked */}
                      {s.runningLow&&(
                        <span style={{fontSize:10.5,fontWeight:700,padding:'2px 7px',borderRadius:4,background:'rgba(244,166,66,0.15)',color:'#f4a642',letterSpacing:'0.04em',flexShrink:0}}>
                           Running low
                        </span>
                      )}

                      {/* Delete */}
                      <button onClick={e=>{e.stopPropagation();removeSupplement(s.id);}} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.2)',padding:4,borderRadius:4,display:'flex',flexShrink:0}}
                        onMouseEnter={e=>e.currentTarget.style.color='var(--text-muted)'}
                        onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.2)'}
                      >
                        <TrashIcon/>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Progress footer */}
      {supplements.length>0&&(
        <div style={{marginTop:8,padding:'10px 14px',borderRadius:10,background:'rgba(255,255,255,0.02)',border:'0.5px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:11.5,color:'var(--text-muted)'}}>{totalTaken} of {totalSupps} taken today</span>
          <div style={{width:120,height:4,borderRadius:2,background:'rgba(255,255,255,0.08)',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${totalSupps>0?(totalTaken/totalSupps)*100:0}%`,background:'#4caf7d',borderRadius:2,transition:'width 0.4s ease'}}/>
          </div>
        </div>
      )}
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. SLEEP
// ═══════════════════════════════════════════════════════════════════════════════
function Sleep({ sleepData, settings }) {
  const sorted = useMemo(() =>
    [...(sleepData || [])].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [sleepData]);
  const last14 = sorted.slice(0, 14).reverse();
  const latest = sorted[0];
  const effColour = (eff) => eff >= 85 ? '#4caf7d' : eff >= 75 ? '#f4a642' : '#e55a5a';

  // ── Sleep Scheduler state ────────────────────────────────────────────────
  const { data: schedule, save: saveSchedule } = useDocument('sleep_schedule', 'sleep_schedule', null);
  const [bedtime,   setBedtime]   = useState('');
  const [wakeTime,  setWakeTime]  = useState('');
  const [schedSaved, setSchedSaved] = useState(false);

  // Sync inputs when schedule loads from Firestore
  useEffect(() => {
    if (schedule?.bedtime  && !bedtime)  setBedtime(schedule.bedtime);
    if (schedule?.wakeTime && !wakeTime) setWakeTime(schedule.wakeTime);
  }, [schedule]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScheduleSave = async () => {
    await saveSchedule({ bedtime, wakeTime });
    setSchedSaved(true);
    setTimeout(() => setSchedSaved(false), 2000);
  };

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
      <div style={{ marginBottom: 16 }}><ReadinessCard /></div>
      <div style={{ marginBottom: 16 }}><MuscleRecovery /></div>
      <div style={{ marginBottom: 16 }}><SleepLogger /></div>
      {!latest && (
        <div style={{
          padding: '8px 14px', borderRadius: 8, marginBottom: 14,
          background: 'rgba(74,158,255,0.08)', border: '0.5px solid rgba(74,158,255,0.25)',
          fontSize: 11.5, color: '#4a9eff',
        }}>
          = Live sleep data syncs from Apple Health on iPhone. Showing demo data below.
        </div>
      )}

      {displayLatest && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {displayLatest.efficiency != null && (
            <RingChart
              value={displayLatest.efficiency} max={100}
              size={120} thickness={10}
              colour={effColour(displayLatest.efficiency)}
              label={`${displayLatest.efficiency}%`}
              sublabel="efficiency"
              labelSize={20}
            />
          )}
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
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 10 }}>SLEEP STAGES</div>
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
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 12 }}>
            14-NIGHT TREND (hours)
          </div>
          <BarChart data={chartData} maxHeight={100} goalLine={8} />
        </div>
      )}

      {/* Sleep Scheduler */}
      <div style={{ ...cardSx, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.07em' }}>SLEEP SCHEDULER</div>
          {schedule?.bedtime && (
            <span style={{ fontSize: 10.5, color: '#4a9eff', background: 'rgba(74,158,255,0.1)', borderRadius: 6, padding: '2px 8px' }}>
              {schedule.bedtime} → {schedule.wakeTime || '—'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 5 }}>Bedtime</div>
            <input
              type="time"
              value={bedtime}
              onChange={e => setBedtime(e.target.value)}
              style={{ ...inputSx }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 5 }}>Wake time</div>
            <input
              type="time"
              value={wakeTime}
              onChange={e => setWakeTime(e.target.value)}
              style={{ ...inputSx }}
            />
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
          Arete will remind you 30 minutes before bedtime and gradually dim the interface.
        </div>
        <button
          onClick={handleScheduleSave}
          disabled={!bedtime || !wakeTime}
          style={{
            padding: '7px 18px', borderRadius: 7, border: 'none', cursor: bedtime && wakeTime ? 'pointer' : 'not-allowed',
            background: bedtime && wakeTime ? 'var(--accent)' : 'var(--hover-bg)',
            color: bedtime && wakeTime ? 'var(--bg-base)' : 'var(--text-muted)',
            fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
          }}
        >
          {schedSaved ? 'Saved ✓' : 'Save Schedule'}
        </button>
      </div>
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

  // Build caffeine timeline: running total through the day
  const caffTimeline = useMemo(() => {
    const events = todayLogs.filter(l => l.type === 'caffeine').map(l => {
      const [hh, mm] = (l.time || '00:00').split(':').map(Number);
      return { h: hh + mm / 60, mg: l.amount || 0, name: l.name };
    }).sort((a, b) => a.h - b.h);
    let running = 0;
    return events.map(e => { running += e.mg; return { ...e, running }; });
  }, [todayLogs]);

  const caffLineW = 560, caffLineH = 80;
  const caffLinePath = useMemo(() => {
    if (caffTimeline.length === 0) return '';
    const maxMg = Math.max(caffLimit, ...caffTimeline.map(e => e.running));
    const pts = [{ x: 0, y: caffLineH }]; // start at 0
    caffTimeline.forEach(e => {
      const x = (e.h / 24) * caffLineW;
      const y = caffLineH - (e.running / maxMg) * caffLineH;
      pts.push({ x, y });
    });
    // extend to now
    const nowX = (new Date().getHours() / 24) * caffLineW;
    if (caffTimeline.length > 0) pts.push({ x: Math.max(nowX, pts[pts.length - 1].x), y: pts[pts.length - 1].y });
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaPath = linePath + ` L${pts[pts.length - 1].x.toFixed(1)},${caffLineH} L0,${caffLineH} Z`;
    return areaPath;
  }, [caffTimeline, caffLimit]); // eslint-disable-line react-hooks/exhaustive-deps

  const caffColour = caffTotal > caffLimit * 0.9 ? '#f4a642' : caffTotal > caffLimit * 0.6 ? '#4a9eff' : '#4caf7d';

  return (
    <Section title="Stimulants">
      {/* Summary — two large stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {/* Caffeine */}
        <GlassCard style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Caffeine</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 48, fontWeight: 200, color: caffColour, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{caffTotal}</span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/ {caffLimit}mg</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min((caffTotal/caffLimit)*100,100)}%`, background: caffColour, borderRadius: 3, transition: 'width 0.5s' }}/>
          </div>
          {caffTotal > caffLimit * 0.9 && <div style={{ fontSize: 10.5, color: '#f4a642', marginTop: 6 }}>Near your limit. Consider stopping for today.</div>}
        </GlassCard>

        {/* Nicotine */}
        <GlassCard style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Nicotine</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 48, fontWeight: 200, color: nicTotal > nicLimit * 0.8 ? '#e55a5a' : '#f4a642', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{nicTotal}</span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/ {nicLimit}mg</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min((nicTotal/nicLimit)*100,100)}%`, background: nicTotal > nicLimit * 0.8 ? '#e55a5a' : '#f4a642', borderRadius: 3, transition: 'width 0.5s' }}/>
          </div>
        </GlassCard>
      </div>

      {/* Caffeine timeline graph */}
      {caffTimeline.length > 0 && (
        <GlassCard style={{ marginBottom: 20 }}>
          <GlassLabel>Caffeine intake timeline</GlassLabel>
          <svg viewBox={`0 0 ${caffLineW} ${caffLineH + 20}`} style={{ width: '100%', display: 'block' }}>
            <defs>
              <linearGradient id="caffGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={caffColour} stopOpacity="0.4" />
                <stop offset="100%" stopColor={caffColour} stopOpacity="0.03" />
              </linearGradient>
            </defs>
            {/* Limit line */}
            {(() => {
              const maxMg = Math.max(caffLimit, ...caffTimeline.map(e => e.running));
              const limitY = caffLineH - (caffLimit / maxMg) * caffLineH;
              return <line x1={0} y1={limitY} x2={caffLineW} y2={limitY} stroke="rgba(244,166,66,0.3)" strokeWidth="1" strokeDasharray="4,3" />;
            })()}
            <path d={caffLinePath} fill="url(#caffGrad)" />
            {/* Event dots */}
            {caffTimeline.map((e, i) => {
              const maxMg = Math.max(caffLimit, ...caffTimeline.map(ev => ev.running));
              const x = (e.h / 24) * caffLineW;
              const y = caffLineH - (e.running / maxMg) * caffLineH;
              return <circle key={i} cx={x} cy={y} r="4" fill={caffColour} opacity="0.9" />;
            })}
            {/* X labels */}
            {['12am','6am','12pm','6pm'].map((l,i) => (
              <text key={l} x={(i/4)*caffLineW} y={caffLineH+15} fontSize="9" fill="rgba(255,255,255,0.25)" textAnchor="middle" fontFamily="ui-monospace,monospace">{l}</text>
            ))}
          </svg>
          <div style={{ fontSize: 11, color: 'rgba(244,166,66,0.5)', marginTop: 2 }}>— dashed = daily limit ({caffLimit}mg)</div>
        </GlassCard>
      )}

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
              {p.name} <span style={{ opacity:0.6, fontSize:11 }}>{p.amount}{p.unit}</span>
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
             Restore all presets ({hiddenPresets.length} hidden)
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
          <div style={{ fontSize:11, color:'var(--text-muted)', letterSpacing:'0.07em' }}>TODAY</div>
          {todayLogs.length > 0 && (
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Tap × to remove an entry</span>
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
                  {l.amount}{l.unit}
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

// ═══════════════════════════════════════════════════════════════════════════════
// MEAL PLANNER — AI-generated personalised weekly plan
// ═══════════════════════════════════════════════════════════════════════════════
const MEAL_TYPES = ['breakfast','lunch','dinner','snack'];
const MEAL_TYPE_COLOUR = { breakfast:'#f4a642', lunch:'#4caf7d', dinner:'#4a9eff', snack:'#9b5de5' };
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

async function generateMealPlan({ calorieGoal, proteinGoal, carbGoal, fatGoal, weight, mealsPerDay, dietaryNotes, supplements, currency = 'AUD' }) {
  const suppList = supplements.length ? supplements.map(s => s.name).join(', ') : 'none';
  const prompt = `Generate a detailed personalised 7-day meal plan.

User profile:
- Daily targets: ${calorieGoal} kcal, protein ${proteinGoal}g, carbs ${carbGoal}g, fat ${fatGoal}g
- Body weight: ${weight || 'unknown'}kg
- Meals per day: ${mealsPerDay}
- Dietary notes: ${dietaryNotes || 'none'}
- Current supplements: ${suppList}

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "plan": [
    {
      "day": "Monday",
      "meals": [
        {
          "name": "Meal name",
          "description": "1-2 sentence description with ingredients/prep",
          "type": "breakfast",
          "calories": 520,
          "protein": 38,
          "carbs": 52,
          "fat": 14,
          "estimatedCost": 4.50,
          "ingredients": [{ "name": "Chicken breast", "qty": 200, "unit": "g" }, { "name": "Eggs", "qty": 2, "unit": "" }]
        }
      ],
      "totals": { "calories": 2400, "protein": 172, "carbs": 245, "fat": 78, "cost": 18.50 }
    }
  ]
}

Rules:
- Each day must have exactly ${mealsPerDay} meals (distribute types sensibly)
- Day totals must be close to targets (within 10%)
- Use realistic, specific meal names (not "Healthy Meal")
- Descriptions should be practical and appetising
- Vary meals across the week — no repeated meals
- Adjust protein timing around workouts where relevant
- Include realistic estimatedCost per meal in ${currency} (typical local supermarket prices)
- List every ingredient with qty and unit (g or ml; unit "" for whole items like eggs); use the same plain ingredient names across the week so they add up into one shopping list
- Include daily cost total in totals.cost`;

  const text = await askClaudeRaw(prompt, 'Return only the requested valid JSON object. Do not use markdown fences.', [], { maxTokens: 4096 });
  // Strip any markdown fences just in case
  const clean = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  return JSON.parse(clean);
}

function MealPlanner({ settings, savedMeals = [], addSavedMeal, bodyMetrics = [], supplements = [] }) {
  const goals  = settings?.macros ?? {};
  const latestBody  = [...bodyMetrics].sort((a,b)=>(b.date??'').localeCompare(a.date??''))[0];
  const currencySymbol = currencySym(settings?.currency);

  const txn = useCollection('transactions', STORAGE_KEYS.TRANSACTIONS);
  const nutrition = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);

  // Log a planned meal (with its ingredients, so the pantry follows) with an Undo.
  const logPlanned = async (meal) => {
    const entry = mealFromPlan(meal);
    if (!entry) return;
    const day = toLocalDateKey(new Date());
    const existing = nutrition.items.find(l => l.date === day);
    const prev = existing ? { meals: existing.meals, calories: existing.calories, protein: existing.protein, carbs: existing.carbs, fat: existing.fat } : { meals: [], calories: 0, protein: 0, carbs: 0, fat: 0 };
    const row = appendMeals(existing, [entry], day);
    const fields = { meals: row.meals, calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat };
    if (existing?.id) await nutrition.update(existing.id, fields); else await nutrition.add({ date: day, ...fields });
    window.dispatchEvent(new CustomEvent('valerie:toast', { detail: {
      message: `Logged ${entry.name} · ${entry.calories} kcal`, type: 'success',
      undo: async () => {
        const saved = storage.get(STORAGE_KEYS.MACROS, []).find(l => l.date === day && !String(l.id).startsWith('local_'));
        if (saved) await nutrition.update(saved.id, prev);
      },
    } }));
  };

  // Editable targets  default from settings, overridable inline
  const [calorieGoal, setCalorieGoal] = useState(settings?.macroGoal ?? 2500);
  const [proteinGoal, setProteinGoal] = useState(settings?.proteinGoal ?? 160);
  const [carbGoal,    setCarbGoal]    = useState(goals?.carbs ?? 250);
  const [fatGoal,     setFatGoal]     = useState(goals?.fat ?? 80);

  const [mealsPerDay, setMealsPerDay] = useState(4);
  const [dietaryNotes, setDietaryNotes] = useState('');
  // The latest plan is kept (it used to vanish on leaving the screen) and
  // Plan → Supplies turns its ingredients into this week's grocery list.
  const { data: savedPlan, save: savePlanDoc } = useDocument('meal_plan', STORAGE_KEYS.MEAL_PLANS, null);
  const [plan, setPlan] = useState(() => savedPlan?.plan ?? null);
  useEffect(() => { if (!plan && savedPlan?.plan) setPlan(savedPlan.plan); }, [savedPlan]); // eslint-disable-line react-hooks/exhaustive-deps
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [activeDay, setActiveDay] = useState(0);
  const [saved, setSaved] = useState({});
  const [logged, setLogged] = useState(false);

  const generate = async () => {
    setGenerating(true); setError(''); setPlan(null);
    try {
      const result = await generateMealPlan({
        calorieGoal, proteinGoal, carbGoal, fatGoal,
        weight: latestBody?.weight,
        mealsPerDay, dietaryNotes,
        supplements, currency: settings?.currency || 'AUD',
      });
      const newPlan = result.plan ?? result;
      setPlan(newPlan);
      setActiveDay(0);
      savePlanDoc({ generatedOn: toLocalDateKey(new Date()), plan: newPlan });
    } catch (err) {
      setError(err.message || 'Generation failed — try again.');
    } finally {
      setGenerating(false);
    }
  };

  const saveMeal = async (meal) => {
    const ingredients = cleanIngredients(meal.ingredients);
    await addSavedMeal({ name: meal.name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, ...(ingredients.length ? { ingredients } : {}) });
    setSaved(p => ({ ...p, [meal.name]: true }));
    setTimeout(() => setSaved(p => { const n = {...p}; delete n[meal.name]; return n; }), 2000);
  };

  const weeklyTotal = useMemo(() => {
    if (!plan) return 0;
    return plan.reduce((sum, day) => {
      const dayCost = day.totals?.cost ?? day.meals?.reduce((s, m) => s + (m.estimatedCost ?? 0), 0) ?? 0;
      return sum + dayCost;
    }, 0);
  }, [plan]);

  const logToFinance = async () => {
    if (weeklyTotal <= 0 || logged) return;
    await txn.add({
      type: 'expense', amount: parseFloat(weeklyTotal.toFixed(2)),
      description: 'Weekly meal plan — food & ingredients',
      category: 'food', date: toLocalDateKey(new Date()),
      createdAt: new Date().toISOString(),
    });
    setLogged(true);
    setTimeout(() => setLogged(false), 4000);
  };

  const totalColour = (actual, target) => {
    const pct = actual / Math.max(target, 1);
    return pct >= 0.9 && pct <= 1.1 ? '#4caf7d' : pct >= 0.8 ? '#f4a642' : '#e25d7a';
  };

  return (
    <Section title="AI Meal Plan">
      <div style={{ maxWidth: '100%' }}>

        {/* Config panel */}
        <GlassCard style={{ marginBottom: 18 }}>
          <GlassLabel>Plan parameters</GlassLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {/* Editable targets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={lblSx}>DAILY TARGETS</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { l: 'Kcal',    val: calorieGoal, set: setCalorieGoal, c: '#f4a642' },
                  { l: 'Protein', val: proteinGoal,  set: setProteinGoal, c: '#4a9eff' },
                  { l: 'Carbs',   val: carbGoal,     set: setCarbGoal,    c: '#4caf7d' },
                  { l: 'Fat',     val: fatGoal,      set: setFatGoal,     c: '#9b5de5' },
                ].map(({ l, val, set, c }) => (
                  <div key={l} style={{ padding: '6px 10px', borderRadius: 8, background: `${c}14`, border: `0.5px solid ${c}40`, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ fontSize: 10.5, color: c, fontWeight: 700, letterSpacing: '0.08em' }}>{l}</div>
                    <input
                      type="number"
                      value={val}
                      onChange={e => set(+e.target.value)}
                      style={{
                        width: 64, background: 'transparent', border: 'none', outline: 'none',
                        fontSize: 14, fontWeight: 600, color: c, padding: 0,
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <span style={lblSx}>MEALS PER DAY</span>
                <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '0.5px solid var(--card-border)', width: 'fit-content' }}>
                  {[3,4,5,6].map(n => (
                    <button key={n} onClick={() => setMealsPerDay(n)} style={{
                      width: 40, height: 34, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      background: mealsPerDay === n ? 'rgba(255,255,255,0.9)' : 'var(--card-fill)',
                      color: mealsPerDay === n ? '#111' : 'var(--text-secondary)', transition: 'all 0.12s',
                    }}>{n}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={lblSx}>DIETARY NOTES / RESTRICTIONS</span>
            <input value={dietaryNotes} onChange={e => setDietaryNotes(e.target.value)}
              placeholder="e.g. no dairy, high-protein focus, prefer Mediterranean, avoid spicy…"
              style={{ ...inputSx }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--input-border)'} />
          </div>
          {latestBody?.weight && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
              Using body weight: <span style={{ color: 'var(--accent)' }}>{latestBody.weight}kg</span>
              {supplements.length > 0 && <> · Supplements: <span style={{ color: 'var(--accent)' }}>{supplements.slice(0,3).map(s=>s.name).join(', ')}{supplements.length > 3 ? ` +${supplements.length-3}` : ''}</span></>}
            </div>
          )}
          <button onClick={generate} disabled={generating} style={{
            width: '100%', padding: '12px 0', borderRadius: 10,
            border: '0.5px solid rgba(255,255,255,0.2)',
            background: generating ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)',
            color: generating ? 'var(--text-muted)' : 'var(--text-primary)',
            fontSize: 13, fontWeight: 600, cursor: generating ? 'default' : 'pointer',
            letterSpacing: '0.03em', transition: 'all 0.15s',
          }}>
            {generating ? '✨ Generating your plan…' : plan ? '🔄 Regenerate plan' : '✨ Generate 7-day meal plan'}
          </button>
          {error && <div style={{ marginTop: 10, fontSize: 11.5, color: '#e25d7a', padding: '7px 12px', borderRadius: 8, background: 'rgba(226,93,122,0.08)', border: '0.5px solid rgba(226,93,122,0.25)' }}>{error}</div>}
        </GlassCard>

        {/* Plan display */}
        {plan && (
          <>
            {/* Day tabs + weekly cost */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {plan.map((day, i) => (
                <button key={i} onClick={() => setActiveDay(i)} style={{
                  padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 11.5, fontWeight: 500,
                  border: `0.5px solid ${activeDay === i ? 'var(--accent)' : 'var(--card-border)'}`,
                  background: activeDay === i ? 'var(--active-bg)' : 'transparent',
                  color: activeDay === i ? 'var(--accent)' : 'var(--text-secondary)', transition: 'all 0.12s',
                }}>{day.day}</button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                {weeklyTotal > 0 && (
                  <div style={{ fontSize: 12, color: '#f4a642', fontWeight: 600 }}>
                    Est. {currencySymbol}{weeklyTotal.toFixed(2)} / week
                  </div>
                )}
                <button
                  onClick={logToFinance}
                  disabled={weeklyTotal <= 0 || logged}
                  style={{
                    padding: '6px 13px', borderRadius: 8, fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
                    background: logged ? 'rgba(76,175,125,0.1)' : 'rgba(244,166,66,0.1)',
                    border: `0.5px solid ${logged ? 'rgba(76,175,125,0.3)' : 'rgba(244,166,66,0.3)'}`,
                    color: logged ? '#4caf7d' : '#f4a642',
                    opacity: weeklyTotal <= 0 ? 0.4 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {logged ? '✓ Logged to Finance' : '→ Log to Finance'}
                </button>
              </div>
            </div>

            {/* Active day */}
            {(() => {
              const day = plan[activeDay];
              if (!day) return null;
              return (
                <div>
                  {/* Day totals */}
                  <GlassCard style={{ marginBottom: 14 }}>
                    <GlassLabel>{day.day} — Daily Totals</GlassLabel>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {[['Calories', day.totals?.calories, calorieGoal, '#f4a642', ''], ['Protein', day.totals?.protein, proteinGoal, '#4a9eff', 'g'], ['Carbs', day.totals?.carbs, carbGoal, '#4caf7d', 'g'], ['Fat', day.totals?.fat, fatGoal, '#9b5de5', 'g']].map(([l, v, t, c, u]) => (
                        <div key={l} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `0.5px solid ${totalColour(v, t)}30` }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6 }}>{l.toUpperCase()}</div>
                          <div style={{ fontSize: 22, fontWeight: 600, color: totalColour(v, t), lineHeight: 1 }}>{v}{u}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>target {t}{u}</div>
                        </div>
                      ))}
                      {day.totals?.cost != null && (
                        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: 'rgba(244,166,66,0.05)', border: '0.5px solid rgba(244,166,66,0.2)' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6 }}>FOOD COST</div>
                          <div style={{ fontSize: 22, fontWeight: 600, color: '#f4a642', lineHeight: 1 }}>{currencySymbol}{day.totals.cost.toFixed(2)}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>est. ingredients</div>
                        </div>
                      )}
                    </div>
                  </GlassCard>

                  {/* Meals */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {day.meals.map((meal, mi) => {
                      const typeColour = MEAL_TYPE_COLOUR[meal.type] ?? 'var(--accent)';
                      const isSaved = saved[meal.name];
                      const alreadySaved = savedMeals.some(s => s.name === meal.name);
                      return (
                        <div key={mi} style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ flexShrink: 0, marginTop: 2 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeColour }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{meal.name}</div>
                                <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 99, background: `${typeColour}18`, color: typeColour, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{meal.type}</span>
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 10 }}>{meal.description}</div>
                              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                                {[['Kcal', meal.calories, '#f4a642'], ['P', meal.protein, '#4a9eff'], ['C', meal.carbs, '#4caf7d'], ['F', meal.fat, '#9b5de5']].map(([l, v, c]) => (
                                  <div key={l} style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{l}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: c, fontVariantNumeric: 'tabular-nums' }}>{v}{l!=='Kcal'?'g':''}</span>
                                  </div>
                                ))}
                                {meal.estimatedCost != null && (
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginLeft: 'auto' }}>
                                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>COST</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#f4a642', fontVariantNumeric: 'tabular-nums' }}>{currencySymbol}{meal.estimatedCost.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <button onClick={() => logPlanned(meal)} aria-label={`Log ${meal.name} to today`} style={{
                              flexShrink: 0, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                              border: '0.5px solid var(--tab-accent)', background: 'transparent', color: 'var(--tab-accent)',
                            }}>Log now</button>
                            <button onClick={() => saveMeal(meal)} disabled={alreadySaved || isSaved} style={{
                              flexShrink: 0, padding: '5px 11px', borderRadius: 8, cursor: alreadySaved ? 'default' : 'pointer',
                              fontSize: 11, fontWeight: 500, transition: 'all 0.15s',
                              border: `0.5px solid ${isSaved ? 'rgba(76,175,125,0.5)' : alreadySaved ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.12)'}`,
                              background: isSaved ? 'rgba(76,175,125,0.12)' : 'transparent',
                              color: isSaved ? '#4caf7d' : alreadySaved ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
                            }}>
                              {isSaved ? '✓ Saved' : alreadySaved ? '✓ In My Meals' : '⊕ Save meal'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {!plan && !generating && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
            Configure your plan above and hit Generate.
          </div>
        )}

      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PEAK STATE — 24h performance graph + factor breakdown
// ═══════════════════════════════════════════════════════════════════════════════

// Compute circadian performance 0–100 for a given hour (0–24)
// Two-peak model: primary peak ~10am, secondary ~5pm, low at ~4am and ~2pm
function circadianScore(hour, sleepEfficiency = 75) {
  const norm = (sleepEfficiency - 50) / 50; // -1 to 1
  const base  = 48
    + 28 * Math.cos(Math.PI * (hour - 10) / 12)   // main wave, peaks 10am
    + 10 * Math.cos(Math.PI * (hour - 17) / 7);    // secondary, peaks 5pm
  const bonus = norm * 15; // sleep quality lifts/dampens the curve
  return Math.max(5, Math.min(100, base + bonus));
}

function PeakStateSection({ stimLogs, sleepData, peakState }) {
  const today = toLocalDateKey(new Date());

  const lastSleep = useMemo(() =>
    [...(sleepData || [])].sort((a,b)=>(b.date??'').localeCompare(a.date??''))[0],
    [sleepData]);
  const sleepEff = lastSleep?.efficiency ?? 75;

  const todayStims = useMemo(() =>
    (stimLogs || []).filter(l => l.date === today && l.type === 'caffeine'),
    [stimLogs, today]);

  const nowH = new Date().getHours() + new Date().getMinutes() / 60;

  // Build SVG curve data (48 points = every 30 min)
  const W = 600, H = 140;
  const POINTS = Array.from({ length: 49 }, (_, i) => {
    const h = i * 0.5;
    const y = circadianScore(h, sleepEff);
    return { h, y, x: (h / 24) * W, sy: H - (y / 100) * H };
  });

  const pathD = POINTS.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.sy.toFixed(1)}`).join(' ');
  const areaD = pathD + ` L${W},${H} L0,${H} Z`;

  // NOW position
  const nowX = (nowH / 24) * W;
  const nowScore = Math.round(circadianScore(nowH, sleepEff));

  const score       = peakState?.score ?? 0;
  const scoreColour = score >= 75 ? '#4caf7d' : score >= 50 ? '#f4a642' : '#e55a5a';
  const scoreLabel  = score >= 80 ? 'PEAK' : score >= 60 ? 'GOOD' : score >= 40 ? 'AVERAGE' : 'LOW';

  const FACTOR_COLOURS = {
    sleepQuality: '#9b5de5', sleepDuration: '#4a9eff', hydration: '#4a9eff',
    supplements: '#4caf7d', macros: '#f4a642', workout: '#e25d7a',
    stimulants: '#f97316', mood: '#ffd700',
  };

  const X_LABELS = ['12am', '6am', '12pm', '6pm', '12am'];

  return (
    <Section title="Peak State">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Score header */}
        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 56, fontWeight: 200, color: scoreColour, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {score}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 4 }}>
                {scoreLabel}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.55 }}>
                {peakState?.suggestion ?? ''}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { l: 'Recovery', v: sleepEff, c: '#9b5de5' },
                  { l: 'Circadian', v: nowScore, c: '#4a9eff' },
                  { l: 'Peak State', v: peakState.score, c: scoreColour },
                ].map(s => (
                  <div key={s.l} style={{ padding: '6px 12px', borderRadius: 8, background: `${s.c}14`, border: `0.5px solid ${s.c}30` }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: s.c, marginBottom: 3 }}>{s.l.toUpperCase()}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* 24h Performance Graph */}
        <GlassCard>
          <GlassLabel>24-Hour Performance Curve</GlassLabel>
          <div style={{ position: 'relative', overflow: 'visible' }}>
            <svg viewBox={`0 0 ${W} ${H + 28}`} style={{ width: '100%', display: 'block' }}>
              <defs>
                <linearGradient id="peakGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={scoreColour} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={scoreColour} stopOpacity="0.03" />
                </linearGradient>
                {/* Future section gradient (dimmer) */}
                <linearGradient id="peakFutureGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.12)" stopOpacity="1" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.12)" stopOpacity="0.1" />
                </linearGradient>
              </defs>

              {/* Horizontal grid lines */}
              {[25, 50, 75].map(v => (
                <line key={v} x1={0} y1={H - (v/100)*H} x2={W} y2={H - (v/100)*H}
                  stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              ))}

              {/* Area fill — past */}
              <path d={areaD} fill="url(#peakGrad)" />

              {/* Line */}
              <path d={pathD} fill="none" stroke={scoreColour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

              {/* NOW vertical line */}
              <line x1={nowX} y1={0} x2={nowX} y2={H} stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="4,3" />
              <circle cx={nowX} cy={H - (nowScore/100)*H} r="5" fill={scoreColour} />
              <text x={nowX + 6} y={H - (nowScore/100)*H - 6} fontSize="9" fill="rgba(255,255,255,0.55)" fontFamily="ui-monospace,monospace">
                NOW
              </text>

              {/* X-axis labels */}
              {X_LABELS.map((l, i) => (
                <text key={l+i} x={(i/4)*W} y={H + 18} fontSize="9" fill="rgba(255,255,255,0.3)" textAnchor="middle" fontFamily="ui-monospace,monospace">{l}</text>
              ))}

              {/* Stimulant event markers */}
              {todayStims.map((s, i) => {
                if (!s.time) return null;
                const [hh, mm] = s.time.split(':').map(Number);
                const sx = ((hh + mm/60) / 24) * W;
                return (
                  <g key={s.id || i}>
                    <line x1={sx} y1={H - 20} x2={sx} y2={H} stroke="rgba(249,115,22,0.5)" strokeWidth="1.5" />
                    <circle cx={sx} cy={H - 22} r="4" fill="#f97316" opacity="0.85" />
                  </g>
                );
              })}
            </svg>
            {todayStims.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                 Orange dots = caffeine intake
              </div>
            )}
          </div>
        </GlassCard>

        {/* Factor breakdown */}
        <GlassCard>
          <GlassLabel>Factor Breakdown</GlassLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(peakState?.factors || {}).map(([key, factor]) => {
              const colour = FACTOR_COLOURS[key] || 'var(--accent)';
              const pct    = factor?.pct ?? 0;
              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{factor?.label ?? key}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{factor?.value}</span>
                    <span style={{ fontSize: 11, color: colour, fontVariantNumeric: 'tabular-nums', marginLeft: 8 }}>+{factor?.pts ?? 0}/{factor?.max ?? 0}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: colour, borderRadius: 3, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

      </div>
    </Section>
  );
}

const SUB_SECTIONS = [
  { id:'overview',    label:'Overview',    icon:'home' },
  { id:'peakstate',   label:'Peak State',  icon:'bolt' },
  { id:'habits',      label:'Habits',      icon:'checkCircle' },
  { id:'nutrition',   label:'Nutrition',   icon:'utensils' },
  { id:'water',       label:'Water',       icon:'water' },
  { id:'body',        label:'Body',        icon:'scale' },
  { id:'supplements', label:'Supplements', icon:'pill' },
  { id:'sleep',       label:'Sleep',       icon:'moon' },
  { id:'stimulant',   label:'Stimulant',   icon:'coffee' },
  { id:'mealplan',    label:'Meal Plan',   icon:'mealplan' },
];

// Coach screens (Fuel, Recover, Body, Habits, Goal HQ) each show a slice of
// Health, chosen by `sections`. A queued section (src/nav/healthSection.js)
// opens first when it belongs to this slice.
export default function Health({ settings, onTabChange, peakState, sections = null }) {
  const shown = sections
    ? sections.map(id => SUB_SECTIONS.find(s => s.id === id)).filter(Boolean)
    : SUB_SECTIONS;
  const [active, setActive] = useState(() => {
    const queued = peekHealthSection();
    return shown.some(s => s.id === queued) ? queued : shown[0].id;
  });
  useEffect(() => { if (shown.some(s => s.id === peekHealthSection())) clearHealthSection(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const settings_ = settings ?? storage.get(STORAGE_KEYS.SETTINGS, {});

  // Open a section here, or on the Coach screen that owns it.
  const goSection = (id) => {
    if (shown.some(s => s.id === id)) { setActive(id); return; }
    const screen = screenForHealthSection(id);
    if (screen && onTabChange) onTabChange(screen);
  };

  const { items: habits,     add: addHabit,     update: updateHabit,     remove: removeHabit }     = useCollection('habits',          STORAGE_KEYS.HABITS);
  const { items: waterLogs,  add: addWaterLog  }                                                    = useCollection('water_logs',      STORAGE_KEYS.WATER);
  const { items: nutritionLogs, add: addNutritionLog, update: updateNutritionLog }                 = useCollection('nutrition_logs',  STORAGE_KEYS.MACROS);
  const { items: workoutLogs }                                                  = useCollection('workout_logs',    STORAGE_KEYS.WORKOUT_LOGS);
  const { items: bodyMetrics, add: addBodyMetric }                                                  = useCollection('body_metrics',    STORAGE_KEYS.BODY);
  const { items: supplements, add: addSupplement, remove: removeSupplement }                        = useCollection('supplements',     STORAGE_KEYS.SUPPLEMENTS);
  const { items: suppLogs,   add: addSuppLog }                                                      = useCollection('supplement_logs', STORAGE_KEYS.SUPP_LOGS);
  const { items: sleepData }                                                                         = useCollection('sleep_data',      STORAGE_KEYS.SLEEP);
  const { items: stimLogs,   add: addStimLog,   remove: removeStimLog }                             = useCollection('stimulant_logs',  STORAGE_KEYS.STIMULANTS);
  const { items: savedMeals, add: addSavedMeal, update: updateSavedMeal, remove: removeSavedMeal }                           = useCollection('saved_meals',      STORAGE_KEYS.SAVED_MEALS);
  const appleHealth = useAppleHealth();

  const renderSection = () => {
    const p = { settings: withTodaysTargets(settings_) };
    switch (active) {
      case 'overview':    return <Overview {...p} onTabChange={onTabChange} habits={habits} waterLogs={waterLogs} nutritionLogs={nutritionLogs} sleepData={sleepData} supplements={supplements} suppLogs={suppLogs} stimLogs={stimLogs} workoutLogs={workoutLogs} bodyMetrics={bodyMetrics} onNav={goSection} appleHealth={appleHealth} />;
      case 'peakstate':   return <PeakStateSection stimLogs={stimLogs} sleepData={sleepData} peakState={peakState} />;
      case 'habits':      return <Habits       habits={habits} addHabit={addHabit} updateHabit={updateHabit} removeHabit={removeHabit} />;
      case 'nutrition':   return <Nutrition    {...p} nutritionLogs={nutritionLogs} addNutritionLog={addNutritionLog} updateNutritionLog={updateNutritionLog} savedMeals={savedMeals} addSavedMeal={addSavedMeal} updateSavedMeal={updateSavedMeal} removeSavedMeal={removeSavedMeal} supplements={supplements} suppLogs={suppLogs} />;
      case 'water':       return <Water        {...p} waterLogs={waterLogs} addWaterLog={addWaterLog} />;
      case 'body':        return <Body         bodyMetrics={bodyMetrics} addBodyMetric={addBodyMetric} settings={p.settings} />;
      case 'supplements': return <Supplements  supplements={supplements} suppLogs={suppLogs} addSupplement={addSupplement} removeSupplement={removeSupplement} addSuppLog={addSuppLog} />;
      case 'sleep':       return <Sleep        sleepData={sleepData} settings={p.settings} />;
      case 'stimulant':   return <Stimulant    {...p} stimLogs={stimLogs} addStimLog={addStimLog} removeStimLog={removeStimLog} />;
      case 'mealplan':   return <MealPlanner {...p} settings={settings_} savedMeals={savedMeals} addSavedMeal={addSavedMeal} bodyMetrics={bodyMetrics} supplements={supplements} />;
      default:            return null;
    }
  };

  if (shown.length === 1) {
    return <div style={{ height: '100%', overflow: 'hidden' }}>{renderSection()}</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left nav */}
      <div style={{
        width: 176, flexShrink: 0,
        borderRight: '0.5px solid var(--sidebar-divider)',
        display: 'flex', flexDirection: 'column',
        padding: '16px 0', gap: 2, overflowY: 'auto',
      }}>
        {shown.map(s => (
          <button key={s.id} onClick={() => setActive(s.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, minHeight: 36, whiteSpace: 'nowrap',
            padding: '8px 16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            borderLeft: `2px solid ${active === s.id ? 'var(--tab-accent)' : 'transparent'}`,
            color: active === s.id ? 'var(--tab-accent)' : 'var(--text-secondary)',
            fontSize: 13, fontWeight: active === s.id ? 500 : 400,
            transition: 'all 0.15s ease', textAlign: 'left',
            background: active === s.id ? 'var(--active-bg)' : 'transparent',
          }}>
            <LineIcon name={s.icon} size={17} />
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
