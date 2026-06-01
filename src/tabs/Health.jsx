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
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap' }}>{children}</span>
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
// 1. OVERVIEW — dense command centre
// ═══════════════════════════════════════════════════════════════════════════════
function Overview({ habits, waterLogs, nutritionLogs, sleepData, settings, supplements, suppLogs, stimLogs, workoutLogs, bodyMetrics, onNav }) {
  const today = todayStr();

  const waterGoal      = settings?.waterGoal ?? 2500;
  const macroGoal      = settings?.macroGoal ?? 2500;
  const caffLimit      = settings?.caffeineLimitMg ?? 400;
  const nicLimit       = settings?.nicotineLimitMg ?? 20;
  const proteinGoal    = settings?.proteinGoal ?? 160;

  const todayWater     = useMemo(() => (waterLogs||[]).filter(l=>l.date===today).reduce((s,l)=>s+(l.amount||0),0),[waterLogs,today]);
  const todayNutrition = useMemo(() => (nutritionLogs||[]).find(l=>l.date===today),[nutritionLogs,today]);
  const todayCal       = todayNutrition?.totalCalories ?? 0;
  const todayProtein   = todayNutrition?.protein ?? 0;
  const lastSleep      = useMemo(() => [...(sleepData||[])].sort((a,b)=>(b.date??'').localeCompare(a.date??''))[0],[sleepData]);
  const todayHabits    = useMemo(()=>{ const t=(habits||[]).length; const d=(habits||[]).filter(h=>h.lastCompleted===today).length; return{done:d,total:t};},[habits,today]);
  const todaySupps     = useMemo(()=>{ const t=(supplements||[]).length; const d=new Set((suppLogs||[]).filter(l=>l.date===today).map(l=>l.suppId)).size; return{done:d,total:t};},[supplements,suppLogs,today]);
  const todayStims     = useMemo(()=>{ const logs=(stimLogs||[]).filter(l=>l.date===today); return{ caffeine:logs.filter(l=>l.type==='caffeine').reduce((s,l)=>s+(l.amount||0),0), nicotine:logs.filter(l=>l.type==='nicotine').reduce((s,l)=>s+(l.amount||0),0) };},[stimLogs,today]);
  const workedOutToday = useMemo(()=>(workoutLogs||[]).some(l=>l.date===today),[workoutLogs,today]);
  const latestBody     = useMemo(()=>[...(bodyMetrics||[])].sort((a,b)=>(b.date??'').localeCompare(a.date??''))[0],[bodyMetrics]);

  const sleepH = Math.floor((lastSleep?.duration??0)/60);
  const sleepM = (lastSleep?.duration??0)%60;

  // Inline stat row item
  const Stat = ({ label, value, sub, colour='rgba(255,255,255,0.85)', warn, nav }) => (
    <div onClick={nav} style={{
      flex:'1 1 0', minWidth:0, padding:'10px 12px', cursor:nav?'pointer':'default',
      background:'rgba(255,255,255,0.03)', borderRadius:10,
      border:`0.5px solid ${warn?'rgba(229,90,90,0.4)':'rgba(255,255,255,0.07)'}`,
      transition:'background 0.15s',
    }}
      onMouseEnter={e=>nav&&(e.currentTarget.style.background='rgba(255,255,255,0.06)')}
      onMouseLeave={e=>nav&&(e.currentTarget.style.background='rgba(255,255,255,0.03)')}
    >
      <div style={{fontSize:8.5,fontWeight:700,letterSpacing:'0.16em',textTransform:'uppercase',color:'rgba(255,255,255,0.28)',fontFamily:'ui-monospace,monospace',marginBottom:5}}>{label}</div>
      <div style={{fontSize:16,fontWeight:600,color:warn?'#e55a5a':colour,lineHeight:1,fontVariantNumeric:'tabular-nums'}}>{value}</div>
      {sub&&<div style={{fontSize:9.5,color:'rgba(255,255,255,0.28)',marginTop:3,fontFamily:'ui-monospace,monospace'}}>{sub}</div>}
    </div>
  );

  // Mini progress bar
  const Bar = ({value,max,colour})=>{
    const pct=Math.min((value/Math.max(max,1))*100,100);
    return(
      <div style={{height:3,borderRadius:2,background:'rgba(255,255,255,0.08)',overflow:'hidden',marginTop:5}}>
        <div style={{height:'100%',width:`${pct}%`,background:colour,borderRadius:2,transition:'width 0.5s ease'}}/>
      </div>
    );
  };

  return (
    <Section title="Overview">
      {/* ── Vitals strip ── */}
      <GlassLabel>Vitals</GlassLabel>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        <Stat label="Sleep" value={lastSleep?`${lastSleep.efficiency??'—'}%`:'—'} sub={lastSleep?`${sleepH}h ${sleepM}m · ${lastSleep.stages?'staged':'no stages'}`:'no data'} colour={lastSleep?.efficiency>=85?'#4caf7d':lastSleep?.efficiency>=70?'#f4a642':'#e55a5a'} nav={()=>onNav('sleep')} />
        <Stat label="Water" value={todayWater>=1000?`${(todayWater/1000).toFixed(1)}L`:`${todayWater}ml`} sub={`of ${waterGoal>=1000?(waterGoal/1000).toFixed(1)+'L':waterGoal+'ml'}`} colour="#4a9eff" warn={todayWater===0} nav={()=>onNav('water')} />
        <Stat label="Calories" value={todayCal} sub={`of ${macroGoal} kcal`} colour="#f4a642" nav={()=>onNav('nutrition')} />
        <Stat label="Protein" value={`${todayProtein}g`} sub={`of ${proteinGoal}g`} colour="#f97316" nav={()=>onNav('nutrition')} />
        <Stat label="Habits" value={`${todayHabits.done}/${todayHabits.total}`} sub={todayHabits.done===todayHabits.total&&todayHabits.total>0?'✓ all done':`${todayHabits.total-todayHabits.done} left`} colour="#4caf7d" nav={()=>onNav('habits')} />
        <Stat label="Supplements" value={`${todaySupps.done}/${todaySupps.total}`} sub={todaySupps.done===todaySupps.total&&todaySupps.total>0?'✓ all taken':'remaining'} colour="#9b5de5" nav={()=>onNav('supplements')} />
        <Stat label="Workout" value={workedOutToday?'Done ✓':'Not yet'} colour={workedOutToday?'#4caf7d':'rgba(255,255,255,0.3)'} sub={workedOutToday?'logged today':'no session'} nav={()=>onNav('workout')} />
        {latestBody?.weight&&<Stat label="Weight" value={`${latestBody.weight}kg`} sub={latestBody.date===today?'today':`${latestBody.date?.slice(5)??'—'}`} colour="rgba(255,255,255,0.65)" nav={()=>onNav('body')} />}
      </div>

      {/* ── Stimulants strip ── */}
      <GlassLabel>Stimulants</GlassLabel>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        <div style={{flex:'1 1 0',padding:'10px 14px',background:'rgba(255,255,255,0.03)',borderRadius:10,border:`0.5px solid ${todayStims.caffeine>caffLimit*0.9?'rgba(244,166,66,0.4)':'rgba(255,255,255,0.07)'}`}}>
          <div style={{fontSize:8.5,fontWeight:700,letterSpacing:'0.16em',textTransform:'uppercase',color:'rgba(255,255,255,0.28)',fontFamily:'ui-monospace,monospace',marginBottom:4}}>Caffeine</div>
          <div style={{display:'flex',alignItems:'baseline',gap:6}}>
            <span style={{fontSize:20,fontWeight:600,color:todayStims.caffeine>caffLimit*0.9?'#f4a642':'rgba(255,255,255,0.85)',fontVariantNumeric:'tabular-nums'}}>{todayStims.caffeine}</span>
            <span style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>/ {caffLimit}mg</span>
          </div>
          <Bar value={todayStims.caffeine} max={caffLimit} colour={todayStims.caffeine>caffLimit*0.9?'#f4a642':'#4a9eff'} />
        </div>
        {todayStims.nicotine>0&&(
          <div style={{flex:'1 1 0',padding:'10px 14px',background:'rgba(255,255,255,0.03)',borderRadius:10,border:'0.5px solid rgba(255,255,255,0.07)'}}>
            <div style={{fontSize:8.5,fontWeight:700,letterSpacing:'0.16em',textTransform:'uppercase',color:'rgba(255,255,255,0.28)',fontFamily:'ui-monospace,monospace',marginBottom:4}}>Nicotine</div>
            <div style={{display:'flex',alignItems:'baseline',gap:6}}>
              <span style={{fontSize:20,fontWeight:600,color:'#f4a642',fontVariantNumeric:'tabular-nums'}}>{todayStims.nicotine}</span>
              <span style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>/ {nicLimit}mg</span>
            </div>
            <Bar value={todayStims.nicotine} max={nicLimit} colour="#f4a642" />
          </div>
        )}
        <div style={{flex:'3 1 0',minWidth:0}}/>
      </div>

      {/* ── Two column: sleep stages + today's activity ── */}
      <div style={{display:'flex',gap:8}}>
        {/* Sleep stages */}
        <GlassCard style={{flex:1,marginBottom:0}}>
          <GlassLabel>Last night — sleep stages</GlassLabel>
          {lastSleep?.stages ? (
            <>
              <StageBar height={8} stages={[
                {label:'Deep', value:lastSleep.stages.deep??0, colour:'#4a9eff'},
                {label:'REM',  value:lastSleep.stages.rem??0,  colour:'#9b5de5'},
                {label:'Core', value:lastSleep.stages.core??0, colour:'#4caf7d'},
                {label:'Awake',value:lastSleep.stages.awake??0,colour:'rgba(255,255,255,0.15)'},
              ]}/>
              <div style={{display:'flex',gap:12,marginTop:8,flexWrap:'wrap'}}>
                {[{l:'Deep',c:'#4a9eff',v:lastSleep.stages.deep},{l:'REM',c:'#9b5de5',v:lastSleep.stages.rem},{l:'Core',c:'#4caf7d',v:lastSleep.stages.core},{l:'Awake',c:'rgba(255,255,255,0.3)',v:lastSleep.stages.awake}].map(s=>(
                  <div key={s.l} style={{display:'flex',alignItems:'center',gap:4}}>
                    <div style={{width:5,height:5,borderRadius:'50%',background:s.c,flexShrink:0}}/>
                    <span style={{fontSize:9.5,color:'rgba(255,255,255,0.35)',fontFamily:'ui-monospace,monospace'}}>{s.l} {Math.floor((s.v??0)/60)}h{(s.v??0)%60}m</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{fontSize:12,color:'rgba(255,255,255,0.25)',padding:'8px 0'}}>No sleep data yet — log via Sleep tab or Apple Health sync.</div>
          )}
          {lastSleep&&<div style={{marginTop:10,display:'flex',gap:16}}>
            {[{l:'Bed',v:lastSleep.bedTime},{l:'Wake',v:lastSleep.wakeTime},{l:'Efficiency',v:`${lastSleep.efficiency??'—'}%`}].map(s=>(
              <div key={s.l}>
                <div style={{fontSize:8.5,color:'rgba(255,255,255,0.25)',letterSpacing:'0.1em',fontFamily:'ui-monospace,monospace'}}>{s.l.toUpperCase()}</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,0.7)',fontVariantNumeric:'tabular-nums'}}>{s.v??'—'}</div>
              </div>
            ))}
          </div>}
        </GlassCard>

        {/* Today's quick activity */}
        <GlassCard style={{flex:1,marginBottom:0}}>
          <GlassLabel>Today's progress</GlassLabel>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {[
              {label:'Water',value:todayWater,max:waterGoal,colour:'#4a9eff',display:todayWater>=1000?`${(todayWater/1000).toFixed(1)}L`:`${todayWater}ml`,goal:waterGoal>=1000?`${(waterGoal/1000).toFixed(1)}L`:`${waterGoal}ml`},
              {label:'Calories',value:todayCal,max:macroGoal,colour:'#f4a642',display:`${todayCal} kcal`,goal:`${macroGoal} kcal`},
              {label:'Protein',value:todayProtein,max:proteinGoal,colour:'#f97316',display:`${todayProtein}g`,goal:`${proteinGoal}g`},
              {label:'Supplements',value:todaySupps.done,max:Math.max(todaySupps.total,1),colour:'#9b5de5',display:`${todaySupps.done} of ${todaySupps.total}`,goal:'complete'},
              {label:'Habits',value:todayHabits.done,max:Math.max(todayHabits.total,1),colour:'#4caf7d',display:`${todayHabits.done} of ${todayHabits.total}`,goal:'complete'},
            ].map(row=>(
              <div key={row.label}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:10.5,color:'rgba(255,255,255,0.5)'}}>{row.label}</span>
                  <span style={{fontSize:10.5,color:'rgba(255,255,255,0.5)',fontFamily:'ui-monospace,monospace'}}>{row.display} <span style={{opacity:0.4}}>/ {row.goal}</span></span>
                </div>
                <Bar value={row.value} max={row.max} colour={row.colour}/>
              </div>
            ))}
          </div>
        </GlassCard>
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
// Water goal formula: weight(kg)×35 + activity bonus + caffeine bonus
function calcWaterGoal(profile) {
  const { weight=75, activityHours=0, caffeineMg=0, sex='male' } = profile;
  let base = weight * 35; // ml
  if (sex === 'female') base = weight * 31;
  const activityBonus  = (activityHours / 7) * 500;
  const caffBonus      = Math.max(0, (caffeineMg - 200) * 1.5);
  return Math.round((base + activityBonus + caffBonus) / 50) * 50; // round to 50ml
}

const WATER_PROFILE_KEY = 'valerie_water_profile';

function Water({ waterLogs, addWaterLog, settings }) {
  const today     = todayStr();
  const [showSettings, setShowSettings] = useState(false);
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem(WATER_PROFILE_KEY)) || { weight:75, age:25, sex:'male', activityHours:5, caffeineMg:200, unit:'ml' }; }
    catch { return { weight:75, age:25, sex:'male', activityHours:5, caffeineMg:200, unit:'ml' }; }
  });
  const [custom, setCustom] = useState('');

  const saveProfile = (p) => {
    setProfile(p);
    localStorage.setItem(WATER_PROFILE_KEY, JSON.stringify(p));
  };

  const goal = calcWaterGoal(profile);

  const todayLogs = useMemo(() =>
    [...(waterLogs||[]).filter(l=>l.date===today)].sort((a,b)=>(a.time??'').localeCompare(b.time??'')),
    [waterLogs, today]);
  const total = todayLogs.reduce((s,l)=>s+(l.amount||0),0);
  const pct   = Math.min((total/goal)*100,100);
  const colour = pct>=100?'#4caf7d':pct>=60?'#4a9eff':pct>=30?'#f4a642':'#e55a5a';

  const log = async (ml) => addWaterLog({ date:today, amount:ml, time:nowStr() });

  const fmtWater = (ml) => profile.unit==='L'&&ml>=1000?`${(ml/1000).toFixed(1)}L`:`${ml}ml`;

  const QUICK = [250, 330, 500, 750, 1000];

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
            <div style={{fontSize:10,color:'var(--text-muted)',marginTop:4}}>
              ☕ 1 coffee ≈ 95mg · espresso ≈ 75mg · energy drink ≈ 160mg. Above 200mg adds to daily water target.
            </div>
          </div>
          {/* Calculated goal */}
          <div style={{padding:'10px 14px',borderRadius:8,background:'rgba(74,158,255,0.08)',border:'0.5px solid rgba(74,158,255,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:12,color:'rgba(255,255,255,0.6)'}}>Calculated daily goal</span>
            <span style={{fontSize:16,fontWeight:600,color:'#4a9eff'}}>{goal>=1000?`${(goal/1000).toFixed(1)}L`:`${goal}ml`}</span>
          </div>
        </GlassCard>
      )}

      {/* ── Main: ring + log ── */}
      <div style={{display:'flex',gap:16,marginBottom:14,alignItems:'flex-start'}}>
        {/* Ring */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,flexShrink:0}}>
          <RingChart value={total} max={goal} size={130} thickness={10} colour={colour}
            label={fmtWater(total)} sublabel={`of ${fmtWater(goal)}`} labelSize={17}/>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>{Math.round(pct)}% complete</div>
          {pct<100&&<div style={{fontSize:10.5,color:colour}}>{fmtWater(goal-total)} remaining</div>}
        </div>

        {/* Right: quick log + recent */}
        <div style={{flex:1,minWidth:0}}>
          {/* Quick log buttons */}
          <GlassLabel>Quick log</GlassLabel>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
            {QUICK.map(ml=>(
              <button key={ml} onClick={()=>log(ml)} style={{
                ...btnGhost,fontSize:12,padding:'7px 12px',
                borderColor:colour+'44',
              }}>
                {ml<1000?`${ml}ml`:`${ml/1000}L`}
              </button>
            ))}
          </div>
          <div style={{display:'flex',gap:6,marginBottom:14}}>
            <input type="number" value={custom} onChange={e=>setCustom(e.target.value)}
              placeholder="Custom ml…" style={{...inputSx,flex:1}}
              onKeyDown={e=>e.key==='Enter'&&custom&&(log(parseInt(custom)),setCustom(''))}
              onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--input-border)'}
            />
            <button onClick={()=>{if(custom){log(parseInt(custom));setCustom('');}}} style={btnPrimary}>Log</button>
          </div>

          {/* Today's log */}
          <GlassLabel>Today</GlassLabel>
          {todayLogs.length===0?(
            <div style={{fontSize:12,color:'var(--text-muted)',padding:'4px 0'}}>Nothing logged yet.</div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {[...todayLogs].reverse().slice(0,6).map((l,i)=>(
                <div key={l.id||i} style={{display:'flex',justifyContent:'space-between',padding:'5px 8px',borderRadius:6,background:'rgba(255,255,255,0.02)'}}>
                  <span style={{fontSize:12,color:'var(--text-secondary)'}}>{fmtWater(l.amount)}</span>
                  <span style={{fontSize:11,color:'var(--text-muted)',fontFamily:'ui-monospace,monospace'}}>{l.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. BODY
// ═══════════════════════════════════════════════════════════════════════════════
const BODY_TABS = [
  { id:'weight',       label:'Weight',       emoji:'⚖' },
  { id:'measurements', label:'Measurements', emoji:'📏' },
  { id:'photos',       label:'Photos',       emoji:'📸' },
];

function Body({ bodyMetrics, addBodyMetric }) {
  const [bodyTab,  setBodyTab]  = useState('weight');
  const [logForm,  setLogForm]  = useState({ weight:'', bodyFat:'', muscle:'', notes:'' });
  const [adding,   setAdding]   = useState(false);
  const [measures, setMeasures] = useState(() => { try { return JSON.parse(localStorage.getItem('valerie_measurements')||'{}'); } catch { return {}; } });
  const [photos,   setPhotos]   = useState(() => { try { return JSON.parse(localStorage.getItem('valerie_photos')||'[]'); } catch { return []; } });
  const [compare,  setCompare]  = useState([null,null]);
  const fileRef = useRef(null);

  const sorted = useMemo(()=>[...(bodyMetrics||[])].sort((a,b)=>(b.date??'').localeCompare(a.date??'')),[bodyMetrics]);
  const latest = sorted[0];
  const weightData = useMemo(()=>sorted.slice(0,30).reverse().map(m=>({value:parseFloat(m.weight)||0,label:m.date?m.date.slice(5):''})),[sorted]);

  const saveMeasures = (m) => { setMeasures(m); localStorage.setItem('valerie_measurements',JSON.stringify(m)); };
  const savePhotos   = (p) => { setPhotos(p);   localStorage.setItem('valerie_photos',JSON.stringify(p)); };

  const addPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const entry = { id: Date.now(), date: todayStr(), src: ev.target.result, note:'' };
      savePhotos([entry, ...photos]);
    };
    reader.readAsDataURL(file);
  };

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
      bodyTab==='photos'?<button onClick={()=>fileRef.current?.click()} style={btnPrimary}>📸 Add photo</button>:null
    }>
      <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={addPhoto}/>

      {/* Sub-tab bar */}
      <div style={{display:'flex',gap:4,marginBottom:14,background:'rgba(255,255,255,0.03)',padding:4,borderRadius:10,border:'0.5px solid rgba(255,255,255,0.07)'}}>
        {BODY_TABS.map(t=>(
          <button key={t.id} onClick={()=>setBodyTab(t.id)} style={{
            flex:1,padding:'6px 0',borderRadius:7,border:'none',cursor:'pointer',
            background:bodyTab===t.id?'var(--active-bg)':'transparent',
            color:bodyTab===t.id?'var(--accent)':'var(--text-muted)',
            fontSize:12,fontWeight:bodyTab===t.id?600:400,transition:'all 0.15s',
          }}>{t.emoji} {t.label}</button>
        ))}
      </div>

      {/* ── Weight tab ── */}
      {bodyTab==='weight'&&(
        <>
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
                  if(!logForm.weight) return;
                  await addBodyMetric({date:todayStr(),...logForm});
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
                  <div style={{fontSize:9,color:'var(--text-muted)',letterSpacing:'0.1em',marginBottom:4}}>{m.label}</div>
                  <div style={{fontSize:22,fontWeight:300,color:'var(--text-primary)'}}>{m.value}<span style={{fontSize:10,color:'var(--text-muted)',marginLeft:2}}>{m.unit}</span></div>
                  <div style={{fontSize:9.5,color:'var(--text-muted)',marginTop:2}}>{latest.date===todayStr()?'today':latest.date?.slice(5)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Trend chart */}
          {weightData.length>1?(
            <GlassCard>
              <GlassLabel>Weight trend — last {weightData.length} entries</GlassLabel>
              <BarChart data={weightData} maxHeight={80}/>
            </GlassCard>
          ):(
            <div style={{textAlign:'center',padding:32,opacity:0.35}}>
              <div style={{fontSize:28}}>⚖</div>
              <p style={{fontSize:12,color:'var(--text-muted)',marginTop:8}}>Log a few entries to see your trend.</p>
            </div>
          )}

          <div style={{padding:'10px 14px',borderRadius:8,background:'rgba(255,255,255,0.02)',border:'0.5px solid var(--card-border)',fontSize:11.5,color:'var(--text-muted)',marginTop:10}}>
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
      {bodyTab==='photos'&&(
        <>
          {photos.length===0?(
            <div style={{textAlign:'center',padding:40,opacity:0.4}}>
              <div style={{fontSize:36}}>📸</div>
              <p style={{fontSize:13,color:'var(--text-muted)',marginTop:8}}>No progress photos yet.</p>
              <button onClick={()=>fileRef.current?.click()} style={{...btnPrimary,marginTop:10}}>Add first photo</button>
            </div>
          ):(
            <>
              {/* Compare mode: pick 2 */}
              {photos.length>=2&&(
                <div style={{marginBottom:12}}>
                  <GlassLabel>Side-by-side comparison</GlassLabel>
                  <div style={{display:'flex',gap:8}}>
                    {[0,1].map(idx=>(
                      <div key={idx} style={{flex:1}}>
                        <select value={compare[idx]??''} onChange={e=>{const c=[...compare];c[idx]=e.target.value;setCompare(c);}}
                          style={{...inputSx,marginBottom:6,fontSize:11}}>
                          <option value="">— pick photo —</option>
                          {photos.map(p=><option key={p.id} value={p.id}>{p.date} {p.note&&`· ${p.note}`}</option>)}
                        </select>
                        {compare[idx]&&(()=>{
                          const p=photos.find(ph=>String(ph.id)===String(compare[idx]));
                          return p?<img src={p.src} alt={p.date} style={{width:'100%',borderRadius:8,border:'0.5px solid var(--card-border)',objectFit:'cover',maxHeight:220}}/>:null;
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Photo grid */}
              <GlassLabel>All photos ({photos.length})</GlassLabel>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8}}>
                {photos.map(p=>(
                  <div key={p.id} style={{borderRadius:8,overflow:'hidden',border:'0.5px solid var(--card-border)',position:'relative',cursor:'pointer'}}>
                    <img src={p.src} alt={p.date} style={{width:'100%',aspectRatio:'3/4',objectFit:'cover',display:'block'}}/>
                    <div style={{padding:'6px 8px',background:'rgba(0,0,0,0.7)',position:'absolute',bottom:0,left:0,right:0,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:10,color:'rgba(255,255,255,0.7)',fontFamily:'ui-monospace,monospace'}}>{p.date}</span>
                      <button onClick={()=>savePhotos(photos.filter(ph=>ph.id!==p.id))} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,100,100,0.7)',fontSize:12,padding:0}}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
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
  { id: 'anytime', label: 'Anytime', emoji: '⏱',  range: '' },
];
const SUPP_SUGGESTIONS = [
  { name:'Creatine',         dose:'5g',   info:'Post-workout · increases strength' },
  { name:'Magnesium',        dose:'400mg',info:'Evening · sleep quality + recovery' },
  { name:'Vitamin D3',       dose:'5000IU',info:'Morning · with fat for absorption' },
  { name:'Omega-3',          dose:'2g',   info:'Morning · with food' },
  { name:'Zinc',             dose:'15mg', info:'Evening · immune + testosterone' },
  { name:'Ashwagandha',      dose:'600mg',info:'Evening · cortisol + stress' },
  { name:'L-Citrulline',     dose:'6–8g', info:'Morning · ~30 min pre-workout' },
  { name:'L-Carnitine',      dose:'1–2g', info:'Morning · with carbs' },
  { name:'Glutamine',        dose:'5g',   info:'Post-workout or bedtime' },
  { name:'Vitamin C',        dose:'1000mg',info:'Morning · antioxidant' },
  { name:'B-Complex',        dose:'1 cap',info:'Morning · energy metabolism' },
  { name:'Probiotics',       dose:'1 cap',info:'Morning · empty stomach' },
  { name:'Collagen',         dose:'10g',  info:'Morning · with vitamin C' },
  { name:'Berberine',        dose:'500mg',info:'With meals · blood sugar' },
  { name:'NMN',              dose:'500mg',info:'Morning · NAD+ precursor' },
  { name:'Protein Powder',   dose:'30g',  info:'Post-workout or morning' },
  { name:'Pre-workout',      dose:'1 scoop',info:'30 min before training' },
];

function Supplements({ supplements, suppLogs, addSupplement, removeSupplement, addSuppLog }) {
  const today      = todayStr();
  const [search,   setSearch]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name:'', dose:'', timeOfDay:'morning', colour:SUPP_COLOURS[0], notes:'' });
  const [showSuggestions, setShowSuggestions] = useState(false);

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
    await addSupplement({ name: form.name.trim(), dose: form.dose, timeOfDay: form.timeOfDay, colour: form.colour, notes: form.notes, streak: 0 });
    setForm({ name:'', dose:'', timeOfDay:'morning', colour:SUPP_COLOURS[0], notes:'' });
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
                  <div key={s.name} onClick={()=>{setForm(p=>({...p,name:s.name,dose:s.dose}));setSearch('');setShowSuggestions(false);}}
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

          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>{setShowForm(false);setSearch('');}} style={{...btnGhost,flex:1}}>Cancel</button>
            <button onClick={addSupp} style={{...btnPrimary,flex:2}}>Add to stack</button>
          </div>
        </GlassCard>
      )}

      {/* ── Stack grouped by time ── */}
      {supplements.length===0&&!showForm?(
        <div style={{textAlign:'center',padding:40,opacity:0.4}}>
          <div style={{fontSize:32}}>💊</div>
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
                        <div style={{fontSize:13,color:taken?'var(--text-muted)':'var(--text-primary)',textDecoration:taken?'line-through':'none',transition:'all 0.2s'}}>{s.name}</div>
                        {s.dose&&<div style={{fontSize:10.5,color:'var(--text-muted)',marginTop:1}}>{s.dose}{s.notes?` · ${s.notes}`:''}</div>}
                      </div>

                      {/* Running low badge — if quantity tracked */}
                      {s.runningLow&&(
                        <span style={{fontSize:9.5,fontWeight:700,padding:'2px 7px',borderRadius:4,background:'rgba(244,166,66,0.15)',color:'#f4a642',letterSpacing:'0.04em',flexShrink:0}}>
                          ⚠ Running low
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
      case 'overview':    return <Overview     {...p} habits={habits} waterLogs={waterLogs} nutritionLogs={nutritionLogs} sleepData={sleepData} supplements={supplements} suppLogs={suppLogs} stimLogs={stimLogs} workoutLogs={workoutLogs} bodyMetrics={bodyMetrics} onNav={setActive} />;
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
