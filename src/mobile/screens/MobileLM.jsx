// MobileLM.jsx — Looksmaxxing OS for VALERIE iOS PWA
// Touch-first mirror of src/tabs/LM.jsx. Shares the exact same Supabase tables and
// storage keys (lm_profile doc + lm_* collections) so desktop and iOS stay in sync.
// Rendered as flow content inside the "More" hub (SubScreen provides the back header).

import { useState, useRef, useEffect, useMemo } from 'react';
import { useCollection } from '../../supabase/useCollection.js';
import { useDocument }   from '../../supabase/useDocument.js';
import { askClaudeRaw }  from '../../utils/claudeRaw.js';
import { haptics }       from '../utils/haptics.js';
import { useHealthData } from '../../hooks/useHealthData.js';
import { STORAGE_KEYS }  from '../../utils/storage.js';
import { toLocalDateKey } from '../../utils/localDate.js';
import SkinRoutine from '../../tabs/SkinRoutine.jsx';

const LIFT_MAP = { bench: 'Bench Press', squat: 'Barbell Squat', deadlift: 'Deadlift', pullups: 'Pull-ups', dips: 'Dips' };
function latestLifts(items = []) {
  const out = {};
  for (const [k, name] of Object.entries(LIFT_MAP)) {
    const logs = items.filter(l => l.exerciseName === name && l.topSet).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    if (logs[0]?.topSet) out[k] = logs[0].topSet;
  }
  return out;
}

// ─── Shared primitives (mobile tokens, mirrors MobileMind) ────────────────────

function MCard({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 16, overflow: 'hidden', ...style,
    }}>{children}</div>
  );
}

const INPUT = {
  width: '100%', boxSizing: 'border-box',
  padding: '11px 14px', borderRadius: 10,
  border: '0.5px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.85)',
  fontSize: 14, outline: 'none', fontFamily: 'inherit',
};
const TA = { ...INPUT, resize: 'none', lineHeight: 1.6, minHeight: 70 };
const BTN = { width: '100%', padding: '13px', borderRadius: 12, border: 'none',
  cursor: 'pointer', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600 };
const BTN_GHOST = { padding: '9px 16px', borderRadius: 10, cursor: 'pointer',
  border: '0.5px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13 };

const LABEL = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)',
  fontFamily: 'ui-monospace,monospace', marginBottom: 6, textTransform: 'uppercase' };
const MUTE = 'rgba(255,255,255,0.3)';
const today = () => toLocalDateKey(new Date());

function Spinner() {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '4px 0', alignItems: 'center' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
          animation: `lmBounce 0.9s ${i*0.15}s ease-in-out infinite` }} />
      ))}
    </div>
  );
}

function Ring({ pct, label, sub, size = 96, colour = 'var(--accent)' }) {
  const r = (size - 9) / 2, circ = 2 * Math.PI * r, dash = Math.min(Math.max(pct/100,0),1) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={9} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={colour} strokeWidth={9}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size*0.22, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>{label}</span>
        {sub && <span style={{ fontSize: 10.5, color: MUTE, marginTop: 2, letterSpacing: '0.06em' }}>{sub}</span>}
      </div>
    </div>
  );
}

// Score slider row (0-10)
function ScoreRow({ label, value, onChange, colour = 'var(--accent)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', width: 120, flexShrink: 0 }}>{label}</span>
      <input type="range" min="0" max="10" value={value ?? 0}
        onChange={e => onChange(Number(e.target.value))} style={{ flex: 1, accentColor: colour }} />
      <span style={{ fontSize: 13, fontFamily: 'ui-monospace,monospace', color: colour, width: 34, textAlign: 'right', fontWeight: 700 }}>{value ?? 0}</span>
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ textAlign: 'center', padding: '36px 0', fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>{children}</div>;
}

function PhotoInput({ onPhoto, label = 'Upload photo' }) {
  const ref = useRef(null);
  function handle(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => onPhoto(reader.result); reader.readAsDataURL(file);
  }
  return (
    <>
      <input ref={ref} type="file" accept="image/*" onChange={handle} style={{ display: 'none' }} />
      <button onClick={() => ref.current?.click()} style={BTN_GHOST}>{label}</button>
    </>
  );
}

// ─── constants (shared with desktop) ──────────────────────────────────────────

const PHASES = ['Fat Loss', 'Lean Bulk', 'Recomp', 'Skin Repair', 'Hair Improvement', 'Style Upgrade', 'Maintenance'];
const PRIORITY_OPTIONS = ['Reduce body fat', 'Improve skin', 'Better haircut', 'Improve posture', 'Upgrade wardrobe', 'Build muscle', 'Sharper jawline', 'More confidence', 'Better sleep', 'Grooming consistency'];
const SCORE_CATS = ['Skin', 'Hair', 'Eye Area', 'Jawline', 'Physique', 'Style', 'Grooming', 'Posture', 'Confidence', 'Social Presence'];
const STYLE_IDENTITIES = ['Classic', 'Minimalist', 'Athletic', 'Old Money', 'Streetwear', 'Business Casual', 'Creative'];
const PHOTO_CATS = ['Front face', 'Side profile', 'Smile', 'Full body front', 'Full body side'];
const FACE_SECTIONS = ['Face shape', 'Symmetry', 'Facial thirds', 'Eyes', 'Eyebrows', 'Nose', 'Lips', 'Jawline', 'Chin', 'Skin', 'Facial hair'];
const DAILY_GROUPS = [
  { group: 'Morning', items: ['Water', 'Skincare', 'Sunscreen', 'Hygiene'] },
  { group: 'Fitness', items: ['Workout', 'Cardio', 'Stretching', 'Step goal'] },
  { group: 'Nutrition', items: ['Hit calories', 'Hit protein', 'Hydrated'] },
  { group: 'Evening', items: ['Evening skincare', 'Teeth', 'Floss', 'Sleep on time'] },
];
const ALL_DAILY_ITEMS = DAILY_GROUPS.flatMap(g => g.items);
const BODY_FIELDS = [['weight','Weight'],['bodyFat','Body Fat %'],['waist','Waist'],['shoulders','Shoulders'],['chest','Chest'],['arms','Arms'],['forearms','Forearms'],['thighs','Thighs'],['calves','Calves'],['neck','Neck']];
const STRENGTH_FIELDS = [['bench','Bench'],['squat','Squat'],['deadlift','Deadlift'],['pullups','Pullups'],['dips','Dips']];
const SKIN_METRICS = ['acne','redness','pigmentation','texture','dryness'];
const WEEKLY_CHALLENGES = ['Start 3 conversations', 'Give 1 genuine compliment', 'Attend 1 social event', 'Hold eye contact in every chat', 'Speak up in 1 group setting'];

const SECTIONS = [
  { id: 'dashboard',   label: 'Dashboard',   emoji: '🎯' },
  { id: 'daily',       label: 'Daily',       emoji: '✅' },
  { id: 'physique',    label: 'Physique',    emoji: '💪' },
  { id: 'foundation',  label: 'Foundation',  emoji: '😴' },
  { id: 'skin',        label: 'Skin',        emoji: '✨' },
  { id: 'hair',        label: 'Hair',        emoji: '💇' },
  { id: 'grooming',    label: 'Grooming',    emoji: '🪒' },
  { id: 'style',       label: 'Style',       emoji: '👔' },
  { id: 'posture',     label: 'Posture',     emoji: '🧍' },
  { id: 'social',      label: 'Social',      emoji: '🗣️' },
  { id: 'photos',      label: 'Photos',      emoji: '📸' },
  { id: 'baseline',    label: 'Baseline',    emoji: '🪞' },
  { id: 'lab',         label: 'Lab',         emoji: '🧪' },
  { id: 'analytics',   label: 'Analytics',   emoji: '📊' },
];

// ═══ DASHBOARD ════════════════════════════════════════════════════════════════

function Dashboard({ profile, save, metrics, health }) {
  const sc = profile?.scorecard || {};
  const avg = useMemo(() => {
    const v = SCORE_CATS.map(c => sc[c]?.current).filter(x => x != null);
    return v.length ? Math.round(v.reduce((a,b)=>a+Number(b),0)/v.length*10) : 0;
  }, [sc]);
  const rawLast = metrics[metrics.length - 1] || {};
  const last = { ...rawLast, weight: health?.latestWeight ?? rawLast.weight, bodyFat: health?.latestBodyFat ?? rawLast.bodyFat };

  function togglePriority(p) {
    const cur = profile?.priorities || [];
    let next;
    if (cur.includes(p)) next = cur.filter(x => x !== p);
    else if (cur.length >= 3) return;
    else next = [...cur, p];
    haptics.tap(); save({ ...profile, priorities: next });
  }
  function setScore(cat, field, val) { save({ ...profile, scorecard: { ...sc, [cat]: { ...sc[cat], [field]: val } } }); }

  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <MCard style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Ring pct={avg} label={avg} sub="OVERALL" />
        <div>
          <div style={{ fontSize: 11, color: MUTE, letterSpacing: '0.06em', marginBottom: 2 }}>LATEST WEIGHT{health?.latestWeight != null ? ' · HEALTH' : ''}</div>
          <div style={{ fontSize: 24, fontWeight: 300, color: 'rgba(255,255,255,0.9)' }}>{last.weight || '—'}{health?.latestBodyFat != null ? <span style={{ fontSize: 13, color: MUTE }}> · {health.latestBodyFat}% bf</span> : null}</div>
          <div style={{ fontSize: 11, color: MUTE, marginTop: 8 }}>Phase: <span style={{ color: 'var(--accent)' }}>{profile?.phase || 'not set'}</span></div>
        </div>
      </MCard>

      <MCard style={{ padding: '14px 16px' }}>
        <div style={LABEL}>Current Phase</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PHASES.map(p => (
            <button key={p} onClick={() => { haptics.tap(); save({ ...profile, phase: p }); }} style={{
              padding: '7px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: profile?.phase === p ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: profile?.phase === p ? '#fff' : 'rgba(255,255,255,0.45)' }}>{p}</button>
          ))}
        </div>
      </MCard>

      <MCard style={{ padding: '14px 16px' }}>
        <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between' }}><span>Top Priorities</span><span>{(profile?.priorities||[]).length}/3</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRIORITY_OPTIONS.map(p => {
            const on = (profile?.priorities || []).includes(p);
            return (
              <button key={p} onClick={() => togglePriority(p)} style={{
                padding: '6px 11px', borderRadius: 20, cursor: 'pointer', fontSize: 11.5,
                border: `0.5px solid ${on ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                background: on ? 'color-mix(in srgb, var(--accent) 13%, transparent)' : 'transparent', color: on ? 'var(--accent)' : 'rgba(255,255,255,0.4)' }}>{p}</button>
            );
          })}
        </div>
      </MCard>

      <MCard style={{ padding: '14px 16px' }}>
        <div style={LABEL}>Appearance Scorecard</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SCORE_CATS.map(cat => {
            const cur = sc[cat]?.current ?? 0, goal = sc[cat]?.goal ?? 10;
            return (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{cat}</span>
                  <span style={{ fontFamily: 'ui-monospace,monospace', color: cur >= goal && cur > 0 ? '#6BE3A4' : 'var(--accent)' }}>{cur}/10 → {goal}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="range" min="0" max="10" value={cur} onChange={e => setScore(cat,'current',Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent)' }} />
                  <input type="range" min="0" max="10" value={goal} onChange={e => setScore(cat,'goal',Number(e.target.value))} style={{ flex: 1, accentColor: 'rgba(255,255,255,0.3)' }} />
                </div>
              </div>
            );
          })}
        </div>
      </MCard>
    </div>
  );
}

// ═══ DAILY ════════════════════════════════════════════════════════════════════

function DailyTracker({ daily }) {
  const todayLog = useMemo(() => daily.items.find(d => d.date === today()), [daily.items]);
  const checked = todayLog?.items || {};
  function toggle(item) {
    haptics.light();
    const next = { ...checked, [item]: !checked[item] };
    const pct = Math.round(Object.values(next).filter(Boolean).length / ALL_DAILY_ITEMS.length * 100);
    if (todayLog) daily.update(todayLog.id, { items: next, pct });
    else daily.add({ date: today(), items: next, pct });
  }
  const pct = todayLog?.pct || 0;
  const streak = useMemo(() => {
    const byDate = Object.fromEntries(daily.items.map(d => [d.date, d.pct || 0]));
    let s = 0; const d = new Date();
    for (;;) {
      const key = toLocalDateKey(d);
      if ((byDate[key] || 0) >= 80) { s++; d.setDate(d.getDate()-1); }
      else if (key === today() && s === 0) { d.setDate(d.getDate()-1); }
      else break;
    }
    return s;
  }, [daily.items]);

  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <MCard style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
        <Ring pct={pct} label={`${pct}%`} sub="TODAY" size={92} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 300, color: '#f4a642' }}>{streak}🔥</div>
          <div style={{ fontSize: 10.5, color: MUTE, letterSpacing: '0.06em' }}>DAY STREAK</div>
        </div>
      </MCard>
      {DAILY_GROUPS.map(g => (
        <MCard key={g.group} style={{ padding: '14px 16px' }}>
          <div style={LABEL}>{g.group}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {g.items.map(item => {
              const on = !!checked[item];
              return (
                <button key={item} onClick={() => toggle(item)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', cursor: 'pointer',
                  border: 'none', background: 'none', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                    border: `1.5px solid ${on ? '#6BE3A4' : 'rgba(255,255,255,0.25)'}`,
                    background: on ? '#6BE3A4' : 'transparent', color: '#000', fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
                  <span style={{ fontSize: 14, color: on ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)' }}>{item}</span>
                </button>
              );
            })}
          </div>
        </MCard>
      ))}
    </div>
  );
}

// ═══ PHYSIQUE ═════════════════════════════════════════════════════════════════

function Physique({ profile, save, metrics, strength, health, workouts }) {
  const [bForm, setBForm] = useState({});
  const [sForm, setSForm] = useState({});
  const last = metrics.items[metrics.items.length - 1] || {};
  const lifts = useMemo(() => latestLifts(workouts), [workouts]);
  const ph = (k) => (k === 'weight'  ? (health?.latestWeight  ?? last.weight)
                   : k === 'bodyFat' ? (health?.latestBodyFat ?? last.bodyFat)
                   : last[k]) || '—';

  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {health?.latestWeight != null && (
        <MCard style={{ padding: '12px 14px', borderLeft: '3px solid #6BE3A4' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ color: '#6BE3A4', fontWeight: 600 }}>From Health:</span> {health.latestWeight}kg{health.latestBodyFat != null ? ` · ${health.latestBodyFat}% bf` : ''}{health.latestMuscle != null ? ` · ${health.latestMuscle}kg muscle` : ''}
          </div>
          <div style={{ fontSize: 11, color: MUTE, marginTop: 3 }}>Auto-synced — log circumferences below.</div>
        </MCard>
      )}
      <MCard style={{ padding: '14px 16px' }}>
        <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between' }}><span>Measurements</span><span>{metrics.items.length} logs</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {BODY_FIELDS.map(([k, lab]) => (
            <div key={k}>
              <div style={{ fontSize: 10.5, color: MUTE, marginBottom: 3 }}>{lab.toUpperCase()}</div>
              <input type="number" step="0.1" value={bForm[k] ?? ''} placeholder={ph(k)}
                onChange={e => setBForm(p => ({ ...p, [k]: e.target.value }))} style={INPUT} />
            </div>
          ))}
        </div>
        <button style={{ ...BTN, marginTop: 12 }} onClick={() => { haptics.success(); metrics.add({ ...bForm, date: today() }); setBForm({}); }}>+ Log snapshot</button>
      </MCard>

      <MCard style={{ padding: '14px 16px' }}>
        <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between' }}><span>Strength</span>{Object.keys(lifts).length ? <span style={{ color: '#6BE3A4' }}>● from Workout</span> : null}</div>
        {Object.keys(lifts).length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
            {STRENGTH_FIELDS.filter(([k]) => lifts[k]).map(([k, lab]) => `${lab} ${lifts[k].weight ? lifts[k].weight + 'kg' : 'BW'}×${lifts[k].reps ?? '?'}`).join(' · ')}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {STRENGTH_FIELDS.map(([k, lab]) => (
            <div key={k}>
              <div style={{ fontSize: 10.5, color: MUTE, marginBottom: 3 }}>{lab.toUpperCase()}</div>
              <input type="number" value={sForm[k] ?? ''} onChange={e => setSForm(p => ({ ...p, [k]: e.target.value }))} style={INPUT} />
            </div>
          ))}
        </div>
        <button style={{ ...BTN, marginTop: 12 }} onClick={() => { haptics.success(); strength.add({ ...sForm, date: today() }); setSForm({}); }}>Log lifts</button>
      </MCard>

      <MCard style={{ padding: '14px 16px' }}>
        <div style={LABEL}>Weak Point Analysis</div>
        <textarea value={profile?.weakPoints || ''} onChange={e => save({ ...profile, weakPoints: e.target.value })}
          placeholder="Lagging muscle groups & notes..." style={TA} />
      </MCard>
    </div>
  );
}

// ═══ FOUNDATION ═══════════════════════════════════════════════════════════════

function Foundation({ profile, save, sleep, nutrition, health }) {
  const [s, setS] = useState({ bedtime: '', wake: '', duration: '', quality: 7 });
  const [n, setN] = useState({ calories: '', protein: '', carbs: '', fat: '', fiber: '', water: '' });
  const s7 = sleep.items.slice(-7);
  const avg = s7.length ? (s7.reduce((a,d)=>a+(Number(d.duration)||0),0)/s7.length).toFixed(1) : '—';

  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {health?.hasHealthData && (
        <MCard style={{ padding: '14px 16px', borderLeft: '3px solid #6BE3A4' }}>
          <div style={LABEL}>From Health · live</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[['Sleep avg', health.avgSleepHours != null ? health.avgSleepHours + 'h' : '—'],
              ['Protein', health.todayProtein != null ? health.todayProtein + 'g' : '—'],
              ['Calories', health.todayCalories != null ? health.todayCalories : '—']].map(([l,v]) => (
              <div key={l} style={{ padding: '8px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: 10.5, color: MUTE, marginBottom: 3 }}>{l.toUpperCase()}</div>
                <div style={{ fontSize: 17, fontWeight: 300, color: 'rgba(255,255,255,0.9)' }}>{v}</div>
              </div>
            ))}
          </div>
        </MCard>
      )}
      <MCard style={{ padding: '14px 16px' }}>
        <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between' }}><span>Sleep</span><span>7-day avg {avg}h</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><div style={{ fontSize: 10.5, color: MUTE, marginBottom: 3 }}>BEDTIME</div><input type="time" value={s.bedtime} onChange={e=>setS(p=>({...p,bedtime:e.target.value}))} style={INPUT} /></div>
          <div><div style={{ fontSize: 10.5, color: MUTE, marginBottom: 3 }}>WAKE</div><input type="time" value={s.wake} onChange={e=>setS(p=>({...p,wake:e.target.value}))} style={INPUT} /></div>
          <div><div style={{ fontSize: 10.5, color: MUTE, marginBottom: 3 }}>DURATION (H)</div><input type="number" step="0.1" value={s.duration} onChange={e=>setS(p=>({...p,duration:e.target.value}))} style={INPUT} /></div>
          <div><div style={{ fontSize: 10.5, color: MUTE, marginBottom: 3 }}>QUALITY</div><input type="number" value={s.quality} onChange={e=>setS(p=>({...p,quality:e.target.value}))} style={INPUT} /></div>
        </div>
        <button style={{ ...BTN, marginTop: 12 }} onClick={() => { haptics.success(); sleep.add({ ...s, date: today() }); setS({ bedtime:'', wake:'', duration:'', quality:7 }); }}>Log sleep</button>
      </MCard>

      <MCard style={{ padding: '14px 16px' }}>
        <div style={LABEL}>Hydration</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Daily goal</span>
          <input type="number" step="0.25" value={profile?.waterGoal || 3} onChange={e => save({ ...profile, waterGoal: Number(e.target.value) })} style={{ ...INPUT, width: 90 }} />
          <span style={{ fontSize: 13, color: MUTE }}>L / day</span>
        </div>
      </MCard>

      <MCard style={{ padding: '14px 16px' }}>
        <div style={LABEL}>Nutrition</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[['calories','Cals'],['protein','Protein'],['carbs','Carbs'],['fat','Fat'],['fiber','Fiber'],['water','Water L']].map(([k,lab]) => (
            <div key={k}><div style={{ fontSize: 10.5, color: MUTE, marginBottom: 3 }}>{lab.toUpperCase()}</div>
              <input type="number" value={n[k]} onChange={e=>setN(p=>({...p,[k]:e.target.value}))} style={INPUT} /></div>
          ))}
        </div>
        <button style={{ ...BTN, marginTop: 12 }} onClick={() => { haptics.success(); nutrition.add({ ...n, date: today() }); setN({ calories:'', protein:'', carbs:'', fat:'', fiber:'', water:'' }); }}>Log nutrition</button>
      </MCard>
    </div>
  );
}

// ═══ SKIN ═════════════════════════════════════════════════════════════════════

function SkinMaxxing({ profile, save, skin, daily }) {
  const [a, setA] = useState({ acne: 5, redness: 5, pigmentation: 5, texture: 5, dryness: 5 });
  function logAssessment() {
    const score = Math.round(SKIN_METRICS.reduce((s,k)=>s+(10-a[k]),0)/SKIN_METRICS.length);
    haptics.success(); skin.add({ ...a, score, date: today() }); setA({ acne:5, redness:5, pigmentation:5, texture:5, dryness:5 });
  }
  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SkinRoutine profile={profile} saveProfile={save} daily={daily} />
      <MCard style={{ padding: '14px 16px' }}>
        <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between' }}><span>Skin assessment</span><span>0 clear · 10 severe</span></div>
        {SKIN_METRICS.map(k => <ScoreRow key={k} label={k[0].toUpperCase()+k.slice(1)} value={a[k]} onChange={v=>setA(p=>({...p,[k]:v}))} colour="#f4a642" />)}
        <button style={{ ...BTN, marginTop: 12 }} onClick={logAssessment}>Log assessment ({skin.items.length})</button>
      </MCard>
    </div>
  );
}

// ═══ HAIR ═════════════════════════════════════════════════════════════════════

function HairMaxxing({ profile, save, haircuts, products }) {
  const hair = profile?.hair || {};
  const [cut, setCut] = useState({ style: '', barber: '', rating: 7 });
  const [prod, setProd] = useState({ name: '', effectiveness: 7 });
  const HF = [['type','Hair type'],['density','Density'],['hairline','Hairline'],['crown','Crown'],['texture','Texture'],['style','Current style']];
  const hairProducts = products.items.filter(p => p.domain === 'hair');
  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={LABEL}>Hair Profile</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {HF.map(([k,lab]) => (
            <div key={k}><div style={{ fontSize: 10.5, color: MUTE, marginBottom: 3 }}>{lab.toUpperCase()}</div>
              <input value={hair[k] || ''} onChange={e => save({ ...profile, hair: { ...hair, [k]: e.target.value } })} style={INPUT} /></div>
          ))}
        </div>
      </MCard>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between' }}><span>Haircuts</span><span>{haircuts.items.length}</span></div>
        <input placeholder="Style" value={cut.style} onChange={e=>setCut(p=>({...p,style:e.target.value}))} style={{ ...INPUT, marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input placeholder="Barber" value={cut.barber} onChange={e=>setCut(p=>({...p,barber:e.target.value}))} style={{ ...INPUT, flex: 2 }} />
          <input type="number" placeholder="★" value={cut.rating} onChange={e=>setCut(p=>({...p,rating:e.target.value}))} style={{ ...INPUT, flex: 1 }} />
        </div>
        <button style={BTN} onClick={() => { if (cut.style.trim()) { haptics.success(); haircuts.add({ ...cut, date: today() }); setCut({ style:'', barber:'', rating:7 }); } }}>Add haircut</button>
        <SimpleList items={[...haircuts.items].reverse()} onRemove={haircuts.remove} render={c => `${c.date} · ${c.style} · ${c.rating}/10`} />
      </MCard>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={LABEL}>Products</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input placeholder="Product" value={prod.name} onChange={e=>setProd(p=>({...p,name:e.target.value}))} style={{ ...INPUT, flex: 2 }} />
          <input type="number" placeholder="★" value={prod.effectiveness} onChange={e=>setProd(p=>({...p,effectiveness:e.target.value}))} style={{ ...INPUT, flex: 1 }} />
        </div>
        <button style={BTN} onClick={() => { if (prod.name.trim()) { haptics.success(); products.add({ ...prod, domain: 'hair', date: today() }); setProd({ name:'', effectiveness:7 }); } }}>Add product</button>
        <SimpleList items={[...hairProducts].reverse()} onRemove={products.remove} render={p => `${p.name} · ${p.effectiveness}/10`} />
      </MCard>
    </div>
  );
}

function SimpleList({ items, onRemove, render }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
      {items.map((it, i) => (
        <div key={it.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', fontSize: 13, color: 'var(--text-secondary)' }}>
          <span>{render(it)}</span>
          <button onClick={() => { haptics.tap(); onRemove(it.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>×</button>
        </div>
      ))}
    </div>
  );
}

// ═══ GROOMING ═════════════════════════════════════════════════════════════════

function Grooming({ profile, save, fragrances }) {
  const teeth = profile?.teeth || {};
  const facialHair = profile?.facialHair || {};
  const [frag, setFrag] = useState({ name: '', rating: 7 });
  const STYLES = ['Clean shave', 'Stubble', 'Short beard', 'Full beard', 'Goatee'];
  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={LABEL}>Teeth</div>
        {[['brushing','Brushing'],['flossing','Flossing'],['whitening','Whitening']].map(([k,lab]) =>
          <ScoreRow key={k} label={lab} value={teeth[k]||0} onChange={v=>save({ ...profile, teeth: { ...teeth, [k]: v } })} />)}
      </MCard>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={LABEL}>Facial Hair</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {STYLES.map(st => (
            <button key={st} onClick={() => save({ ...profile, facialHair: { ...facialHair, current: st } })} style={{
              padding: '7px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
              background: facialHair.current === st ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: facialHair.current === st ? '#fff' : 'rgba(255,255,255,0.45)' }}>{st}</button>
          ))}
        </div>
        <textarea value={facialHair.notes || ''} onChange={e => save({ ...profile, facialHair: { ...facialHair, notes: e.target.value } })}
          placeholder="Style comparison & ratings..." style={TA} />
      </MCard>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between' }}><span>Fragrances</span><span>{fragrances.items.length}</span></div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input placeholder="Name" value={frag.name} onChange={e=>setFrag(p=>({...p,name:e.target.value}))} style={{ ...INPUT, flex: 2 }} />
          <input type="number" placeholder="★" value={frag.rating} onChange={e=>setFrag(p=>({...p,rating:e.target.value}))} style={{ ...INPUT, flex: 1 }} />
        </div>
        <button style={BTN} onClick={() => { if (frag.name.trim()) { haptics.success(); fragrances.add({ ...frag, date: today() }); setFrag({ name:'', rating:7 }); } }}>Add fragrance</button>
        <SimpleList items={[...fragrances.items].reverse()} onRemove={fragrances.remove} render={f => `${f.name} · ${f.rating}/10`} />
      </MCard>
    </div>
  );
}

// ═══ STYLE ════════════════════════════════════════════════════════════════════

function StyleMaxxing({ profile, save, wardrobe, outfits }) {
  const [item, setItem] = useState({ name: '', category: 'Tops', fit: 7, keep: true });
  const [outfit, setOutfit] = useState({ name: '', rating: 7, photo: '' });
  const CATS = ['Tops','Bottoms','Shoes','Outerwear','Accessories'];
  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={LABEL}>Style Identity</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STYLE_IDENTITIES.map(st => (
            <button key={st} onClick={() => save({ ...profile, styleIdentity: st })} style={{
              padding: '7px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: profile?.styleIdentity === st ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: profile?.styleIdentity === st ? '#fff' : 'rgba(255,255,255,0.45)' }}>{st}</button>
          ))}
        </div>
      </MCard>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between' }}><span>Wardrobe</span><span>{wardrobe.items.length}</span></div>
        <input placeholder="Item" value={item.name} onChange={e=>setItem(p=>({...p,name:e.target.value}))} style={{ ...INPUT, marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select value={item.category} onChange={e=>setItem(p=>({...p,category:e.target.value}))} style={{ ...INPUT, flex: 2 }}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
          <input type="number" placeholder="Fit" value={item.fit} onChange={e=>setItem(p=>({...p,fit:e.target.value}))} style={{ ...INPUT, flex: 1 }} />
          <button onClick={() => setItem(p=>({...p,keep:!p.keep}))} style={{ ...BTN_GHOST, color: item.keep ? '#6BE3A4' : '#e55a5a' }}>{item.keep ? 'Keep' : 'Remove'}</button>
        </div>
        <button style={BTN} onClick={() => { if (item.name.trim()) { haptics.success(); wardrobe.add({ ...item }); setItem({ name:'', category:'Tops', fit:7, keep:true }); } }}>Add item</button>
        <SimpleList items={[...wardrobe.items].reverse()} onRemove={wardrobe.remove} render={w => `${w.category} · ${w.name} · ${w.keep ? 'keep' : 'remove'}`} />
      </MCard>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between' }}><span>Outfits</span><span>{outfits.items.length}</span></div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input placeholder="Outfit name" value={outfit.name} onChange={e=>setOutfit(p=>({...p,name:e.target.value}))} style={{ ...INPUT, flex: 2 }} />
          <input type="number" placeholder="★" value={outfit.rating} onChange={e=>setOutfit(p=>({...p,rating:e.target.value}))} style={{ ...INPUT, flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <PhotoInput onPhoto={url => setOutfit(p=>({...p,photo:url}))} label={outfit.photo ? '✓ Photo' : 'Photo'} />
          <button style={{ ...BTN, flex: 1 }} onClick={() => { if (outfit.name.trim()) { haptics.success(); outfits.add({ ...outfit, date: today() }); setOutfit({ name:'', rating:7, photo:'' }); } }}>Add outfit</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          {[...outfits.items].reverse().map((o,i) => (
            <MCard key={o.id||i} style={{ padding: 8, position: 'relative' }}>
              {o.photo && <img src={o.photo} alt="" style={{ width: '100%', borderRadius: 8, aspectRatio: '3/4', objectFit: 'cover', marginBottom: 6 }} />}
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{o.name}</div>
              <div style={{ fontSize: 11, color: 'var(--accent)' }}>{o.rating}/10</div>
              <button onClick={() => { haptics.tap(); outfits.remove(o.id); }} style={{ position: 'absolute', top: 4, right: 6, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 22, height: 22, color: '#fff', cursor: 'pointer' }}>×</button>
            </MCard>
          ))}
        </div>
      </MCard>
    </div>
  );
}

// ═══ POSTURE ══════════════════════════════════════════════════════════════════

function PostureMaxxing({ profile, save, postureLogs }) {
  const posture = profile?.posture || {};
  const [note, setNote] = useState('');
  const ISSUES = [['forwardHead','Forward head'],['roundedShoulders','Rounded shoulders'],['pelvicTilt','Anterior pelvic tilt']];
  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between' }}><span>Posture</span><span>0 fixed · 10 severe</span></div>
        {ISSUES.map(([k,lab]) => <ScoreRow key={k} label={lab} value={posture[k]||0} colour="#e879f9" onChange={v=>save({ ...profile, posture: { ...posture, [k]: v } })} />)}
      </MCard>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={LABEL}>Corrective Routine</div>
        <textarea value={posture.routine || ''} onChange={e => save({ ...profile, posture: { ...posture, routine: e.target.value } })}
          placeholder="Chin tucks 3x15\nFace pulls 3x20\nWall slides 3x12" style={{ ...TA, minHeight: 90 }} />
      </MCard>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between' }}><span>Sessions</span><span>{postureLogs.items.length}</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Session note" style={{ ...INPUT, flex: 1 }} />
          <button style={{ ...BTN, width: 'auto', padding: '11px 16px' }} onClick={() => { if (note.trim()) { haptics.success(); postureLogs.add({ note, date: today() }); setNote(''); } }}>Log</button>
        </div>
        <SimpleList items={[...postureLogs.items].reverse()} onRemove={postureLogs.remove} render={l => `${l.date} · ${l.note}`} />
      </MCard>
    </div>
  );
}

// ═══ SOCIAL ═══════════════════════════════════════════════════════════════════

function SocialMaxxing({ profile, save, social }) {
  const [score, setScore] = useState({ confidence: 5, eyeContact: 5, conversation: 5 });
  const done = profile?.challengesDone || {};
  const weekKey = (() => { const d = new Date(); const j = new Date(d.getFullYear(),0,1); return `${d.getFullYear()}-W${Math.ceil(((d-j)/86400000 + j.getDay()+1)/7)}`; })();
  const weekDone = done[weekKey] || [];
  function toggle(c) {
    haptics.light();
    const next = weekDone.includes(c) ? weekDone.filter(x=>x!==c) : [...weekDone, c];
    save({ ...profile, challengesDone: { ...done, [weekKey]: next } });
  }
  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={LABEL}>Weekly Self-Scores</div>
        <ScoreRow label="Confidence" value={score.confidence} onChange={v=>setScore(p=>({...p,confidence:v}))} colour="#4a9eff" />
        <ScoreRow label="Eye Contact" value={score.eyeContact} onChange={v=>setScore(p=>({...p,eyeContact:v}))} colour="#4a9eff" />
        <ScoreRow label="Conversation" value={score.conversation} onChange={v=>setScore(p=>({...p,conversation:v}))} colour="#4a9eff" />
        <button style={{ ...BTN, marginTop: 12 }} onClick={() => { haptics.success(); social.add({ ...score, date: today() }); }}>Log this week</button>
      </MCard>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between' }}><span>Weekly Challenges</span><span>{weekDone.length}/{WEEKLY_CHALLENGES.length}</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {WEEKLY_CHALLENGES.map(c => {
            const on = weekDone.includes(c);
            return (
              <button key={c} onClick={() => toggle(c)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px',
                border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, border: `1.5px solid ${on ? '#6BE3A4' : 'rgba(255,255,255,0.25)'}`,
                  background: on ? '#6BE3A4' : 'transparent', color: '#000', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
                <span style={{ fontSize: 13.5, color: on ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)', textDecoration: on ? 'line-through' : 'none' }}>{c}</span>
              </button>
            );
          })}
        </div>
      </MCard>
    </div>
  );
}

// ═══ PHOTOS ═══════════════════════════════════════════════════════════════════

function PhotoVault({ photos }) {
  const [cat, setCat] = useState(PHOTO_CATS[0]);
  const [compare, setCompare] = useState(false);
  const list = useMemo(() => photos.items.filter(p => p.category === cat).sort((a,b)=>(a.date||'').localeCompare(b.date||'')), [photos.items, cat]);
  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {PHOTO_CATS.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
            background: cat === c ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: cat === c ? '#fff' : 'rgba(255,255,255,0.45)' }}>{c}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <PhotoInput onPhoto={url => { haptics.success(); photos.add({ category: cat, image: url, date: today() }); }} label="+ Add photo" />
        {list.length > 1 && <button onClick={() => setCompare(v=>!v)} style={{ ...BTN_GHOST, color: compare ? 'var(--accent)' : 'rgba(255,255,255,0.5)' }}>{compare ? 'Timeline' : 'Before/After'}</button>}
      </div>
      {list.length === 0 ? <Empty>No {cat.toLowerCase()} photos yet.</Empty> : compare ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[list[0], list[list.length-1]].map((p,i) => (
            <div key={i}><div style={{ fontSize: 10.5, color: MUTE, marginBottom: 4, textAlign: 'center' }}>{i===0?'BEFORE':'NOW'} · {p.date}</div>
              <img src={p.image} alt="" style={{ width: '100%', borderRadius: 12, aspectRatio: '3/4', objectFit: 'cover' }} /></div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {list.map((p,i) => (
            <div key={p.id||i} style={{ position: 'relative' }}>
              <img src={p.image} alt="" style={{ width: '100%', borderRadius: 12, aspectRatio: '3/4', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 11, color: '#fff', textShadow: '0 1px 4px #000', fontFamily: 'ui-monospace,monospace' }}>{p.date}</div>
              <button onClick={() => { haptics.tap(); photos.remove(p.id); }} style={{ position: 'absolute', top: 6, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 24, height: 24, color: '#fff', cursor: 'pointer' }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══ BASELINE ═════════════════════════════════════════════════════════════════

function Baseline({ profile, save }) {
  const baseline = profile?.baseline || {};
  const [open, setOpen] = useState(FACE_SECTIONS[0]);
  const cur = baseline[open] || {};
  function setField(field, val) { save({ ...profile, baseline: { ...baseline, [open]: { ...baseline[open], [field]: val } } }); }
  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {FACE_SECTIONS.map(s => (
          <button key={s} onClick={() => setOpen(s)} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
            background: open === s ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: open === s ? '#fff' : 'rgba(255,255,255,0.45)' }}>
            {s}{baseline[s]?.assessment ? ' ✓' : ''}</button>
        ))}
      </div>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: 12 }}>{open}</div>
        {[['assessment','Current assessment'],['strengths','Strengths'],['weaknesses','Weaknesses'],['plan','Improvement plan'],['notes','Notes']].map(([k,lab]) => (
          <div key={k} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10.5, color: MUTE, marginBottom: 4 }}>{lab.toUpperCase()}</div>
            <textarea value={cur[k] || ''} onChange={e => setField(k, e.target.value)} placeholder={`${lab}...`} style={{ ...TA, minHeight: 50 }} />
          </div>
        ))}
        {cur.photo && <img src={cur.photo} alt="" style={{ maxWidth: 140, borderRadius: 10, marginBottom: 8, display: 'block' }} />}
        <PhotoInput onPhoto={url => setField('photo', url)} label={cur.photo ? 'Replace photo' : 'Upload photo'} />
      </MCard>
    </div>
  );
}

// ═══ LAB ══════════════════════════════════════════════════════════════════════

function ExperimentLab({ experiments }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ goal: '', hypothesis: '', change: '', startDate: today(), endDate: '' });
  const sorted = [...experiments.items].sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''));
  function add() { if (!form.goal.trim()) return; haptics.success(); experiments.add({ ...form }); setForm({ goal:'', hypothesis:'', change:'', startDate: today(), endDate:'' }); setShow(false); }
  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button style={BTN} onClick={() => setShow(v=>!v)}>+ New experiment</button>
      {show && (
        <MCard style={{ padding: '14px 16px' }}>
          <input placeholder="Goal" value={form.goal} onChange={e=>setForm(p=>({...p,goal:e.target.value}))} style={{ ...INPUT, marginBottom: 8 }} />
          <textarea placeholder="Hypothesis" value={form.hypothesis} onChange={e=>setForm(p=>({...p,hypothesis:e.target.value}))} style={{ ...TA, marginBottom: 8 }} />
          <textarea placeholder="Change implemented" value={form.change} onChange={e=>setForm(p=>({...p,change:e.target.value}))} style={{ ...TA, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShow(false)} style={{ ...BTN_GHOST, flex: 1 }}>Cancel</button>
            <button onClick={add} style={{ ...BTN, flex: 2 }}>Start</button>
          </div>
        </MCard>
      )}
      {sorted.length === 0 ? <Empty>No experiments yet.</Empty> : sorted.map((e,i) => <LabCard key={e.id||i} exp={e} onUpdate={experiments.update} onRemove={experiments.remove} />)}
    </div>
  );
}

function LabCard({ exp, onUpdate, onRemove }) {
  const [edit, setEdit] = useState(false);
  const [results, setResults] = useState(exp.results || '');
  const [verdict, setVerdict] = useState(exp.verdict || '');
  const active = !exp.verdict;
  const col = active ? '#f4a642' : '#6BE3A4';
  return (
    <MCard style={{ borderLeft: `3px solid ${col}`, padding: '13px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: col, letterSpacing: '0.1em', background: col+'20', padding: '2px 7px', borderRadius: 20 }}>{active ? 'ACTIVE' : 'COMPLETE'}</span>
        <span style={{ fontSize: 11, color: MUTE, fontFamily: 'ui-monospace,monospace' }}>{exp.startDate}</span>
        <button onClick={() => { haptics.tap(); onRemove(exp.id); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 17, cursor: 'pointer' }}>×</button>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{exp.goal}</div>
      {exp.hypothesis && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{exp.hypothesis}</div>}
      {exp.results && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}><b>Results:</b> {exp.results}</div>}
      {exp.verdict && <div style={{ fontSize: 12, color: '#6BE3A4', marginTop: 4 }}><b>Verdict:</b> {exp.verdict}</div>}
      {active && (edit ? (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea value={results} onChange={e=>setResults(e.target.value)} placeholder="Results" style={TA} />
          <input value={verdict} onChange={e=>setVerdict(e.target.value)} placeholder="Verdict" style={INPUT} />
          <button style={BTN} onClick={() => { haptics.success(); onUpdate(exp.id, { results, verdict, endDate: exp.endDate || today() }); setEdit(false); }}>Save & close</button>
        </div>
      ) : <button style={{ ...BTN_GHOST, marginTop: 10 }} onClick={() => setEdit(true)}>Record results</button>)}
    </MCard>
  );
}

// ═══ ANALYTICS ════════════════════════════════════════════════════════════════

function buildCtx(d) {
  const last = a => a[a.length - 1] || {};
  const sc = d.profile?.scorecard || {};
  const daily30 = d.daily.slice(-30);
  const comp = daily30.length ? Math.round(daily30.reduce((s,x)=>s+(x.pct||0),0)/daily30.length) : 0;
  const h = d.health || {};
  const healthSection = h.hasHealthData
    ? `\nFROM HEALTH TAB (live, synced incl. Apple Health — source of truth for weight/sleep/nutrition):
Body weight: ${h.latestWeight != null ? h.latestWeight + 'kg' : 'no data'}${h.latestBodyFat != null ? `, body fat ${h.latestBodyFat}%` : ''}${h.latestBodyDate ? ` (as of ${h.latestBodyDate})` : ''}
Sleep: avg ${h.avgSleepHours != null ? h.avgSleepHours + 'h' : 'no data'} (7 nights)${h.lastSleepEfficiency != null ? `, last efficiency ${h.lastSleepEfficiency}%` : ''}
Today nutrition: ${h.todayCalories != null ? h.todayCalories + ' kcal' : 'not logged'}${h.todayProtein != null ? `, ${h.todayProtein}g protein` : ''}`
    : '\nFROM HEALTH TAB: no synced data yet — recommend logging weight/sleep/nutrition in Health (or connecting Apple Health).';
  return `THE USER'S LOOKSMAXXING DATA (live):
Phase: ${d.profile?.phase || 'not set'} · Priorities: ${(d.profile?.priorities||[]).join(', ') || 'none'}
Scorecard: ${SCORE_CATS.map(c=>`${c} ${sc[c]?.current ?? '?'}/${sc[c]?.goal ?? '?'}`).join(', ')}
Latest LM measurements: weight ${last(d.metrics).weight || h.latestWeight || '?'}, bodyFat ${last(d.metrics).bodyFat || h.latestBodyFat || '?'}, waist ${last(d.metrics).waist||'?'}
Body logs: ${d.metrics.length} · Strength logs: ${d.strength.length} · Skin assessments: ${d.skin.length}
30-day daily-tracker completion avg: ${comp}% · Sleep logs: ${d.sleep.length} · Nutrition logs: ${d.nutrition.length}
Experiments active: ${d.experiments.filter(e=>!e.verdict).length}, completed: ${d.experiments.filter(e=>e.verdict).length}${healthSection}`;
}

function Analytics({ data }) {
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);
  const daily30 = data.daily.slice(-30);
  const comp = daily30.length ? Math.round(daily30.reduce((s,x)=>s+(x.pct||0),0)/daily30.length) : 0;
  const habitRates = useMemo(() => {
    const counts = {}; ALL_DAILY_ITEMS.forEach(i => counts[i] = 0);
    daily30.forEach(d => Object.entries(d.items || {}).forEach(([k,v]) => { if (v && counts[k] != null) counts[k]++; }));
    return ALL_DAILY_ITEMS.map(i => ({ label: i, value: daily30.length ? Math.round(counts[i]/daily30.length*100) : 0 })).sort((a,b)=>b.value-a.value);
  }, [daily30]);

  async function gen() {
    setLoading(true); setReview('');
    try {
      const prompt = `You are generating the user's MONTHLY LOOKSMAXXING REVIEW. Sections (short bullets): 1. WINS 2. LOSSES 3. BIGGEST IMPROVEMENT 4. HIGHEST-ROI HABITS 5. SMART INSIGHTS (data-grounded correlations) 6. RECOMMENDED NEXT FOCUS. Reference their real numbers; if data is thin say what to track.\n\n${buildCtx(data)}`;
      setReview(await askClaudeRaw('Generate my monthly review now.', prompt));
    } catch (e) { setReview(`Error: ${e.message}`); } finally { setLoading(false); }
  }

  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[['30-day consistency', comp+'%', '#6BE3A4'], ['Body logs', data.metrics.length, 'var(--accent)'],
          ['Skin checks', data.skin.length, '#f4a642'], ['Experiments', data.experiments.length, '#4a9eff']].map(([l,v,c]) => (
          <MCard key={l} style={{ padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 300, color: c }}>{v}</div>
            <div style={{ fontSize: 10.5, color: MUTE, letterSpacing: '0.06em' }}>{l.toUpperCase()}</div>
          </MCard>
        ))}
      </div>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={LABEL}>Habit Completion (30 days)</div>
        {habitRates.some(h=>h.value>0) ? habitRates.map(h => (
          <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 110, flexShrink: 0 }}>{h.label}</span>
            <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ height: '100%', width: `${h.value}%`, borderRadius: 3, background: h.value>=70?'#6BE3A4':h.value>=40?'#f4a642':'#e55a5a' }} />
            </div>
            <span style={{ fontSize: 11, fontFamily: 'ui-monospace,monospace', color: MUTE, width: 34, textAlign: 'right' }}>{h.value}%</span>
          </div>
        )) : <div style={{ fontSize: 12, color: MUTE, padding: '12px 0' }}>Use the Daily tab to build habit data.</div>}
      </MCard>
      <MCard style={{ padding: '14px 16px' }}>
        <div style={LABEL}>AI Monthly Review</div>
        <button style={BTN} onClick={gen} disabled={loading}>{loading ? 'Generating…' : 'Generate review'}</button>
        {loading ? <div style={{ marginTop: 12 }}><Spinner /></div> : review ? (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginTop: 12 }}>{review}</div>
        ) : null}
      </MCard>
    </div>
  );
}

// ═══ ROOT ═════════════════════════════════════════════════════════════════════

export default function MobileLM() {
  const [section, setSection] = useState('dashboard');

  const profileDoc = useDocument('lm_profile', 'valerie_lm_profile', {});
  const profile = profileDoc.data || {};
  const save = (d) => profileDoc.save(d);

  const metrics     = useCollection('lm_metrics',     'valerie_lm_metrics');
  const strength    = useCollection('lm_strength',    'valerie_lm_strength');
  const daily       = useCollection('lm_daily',       'valerie_lm_daily');
  const sleep       = useCollection('lm_sleep',       'valerie_lm_sleep');
  const nutrition   = useCollection('lm_nutrition',   'valerie_lm_nutrition');
  const skin        = useCollection('lm_skin',        'valerie_lm_skin');
  const haircuts    = useCollection('lm_haircuts',    'valerie_lm_haircuts');
  const products    = useCollection('lm_products',    'valerie_lm_products');
  const fragrances  = useCollection('lm_fragrances',  'valerie_lm_fragrances');
  const wardrobe    = useCollection('lm_wardrobe',    'valerie_lm_wardrobe');
  const outfits     = useCollection('lm_outfits',     'valerie_lm_outfits');
  const postureLogs = useCollection('lm_posture',     'valerie_lm_posture');
  const social      = useCollection('lm_social',      'valerie_lm_social');
  const photos      = useCollection('lm_photos',      'valerie_lm_photos');
  const experiments = useCollection('lm_experiments', 'valerie_lm_experiments');

  // Canonical Health-tab data (weight/bodyFat/sleep/nutrition, auto-synced incl. Apple Health)
  const health = useHealthData();
  const workouts = useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS);

  const aiData = {
    profile, metrics: metrics.items, daily: daily.items, sleep: sleep.items,
    nutrition: nutrition.items, skin: skin.items, strength: strength.items, experiments: experiments.items,
    health,
  };

  return (
    <div>
      {/* Horizontal pill nav */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12,
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => { haptics.tap(); setSection(s.id); }} style={{
            flexShrink: 0, padding: '6px 13px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace,monospace', letterSpacing: '0.04em',
            background: section === s.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
            color: section === s.id ? '#fff' : 'rgba(255,255,255,0.4)' }}>{s.emoji} {s.label.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)' }} />

      {section === 'dashboard'  && <Dashboard profile={profile} save={save} metrics={metrics.items} health={health} />}
      {section === 'daily'      && <DailyTracker daily={daily} />}
      {section === 'physique'   && <Physique profile={profile} save={save} metrics={metrics} strength={strength} health={health} workouts={workouts.items} />}
      {section === 'foundation' && <Foundation profile={profile} save={save} sleep={sleep} nutrition={nutrition} health={health} />}
      {section === 'skin'       && <SkinMaxxing profile={profile} save={save} skin={skin} daily={daily} />}
      {section === 'hair'       && <HairMaxxing profile={profile} save={save} haircuts={haircuts} products={products} />}
      {section === 'grooming'   && <Grooming profile={profile} save={save} fragrances={fragrances} />}
      {section === 'style'      && <StyleMaxxing profile={profile} save={save} wardrobe={wardrobe} outfits={outfits} />}
      {section === 'posture'    && <PostureMaxxing profile={profile} save={save} postureLogs={postureLogs} />}
      {section === 'social'     && <SocialMaxxing profile={profile} save={save} social={social} />}
      {section === 'photos'     && <PhotoVault photos={photos} />}
      {section === 'baseline'   && <Baseline profile={profile} save={save} />}
      {section === 'lab'        && <ExperimentLab experiments={experiments} />}
      {section === 'analytics'  && <Analytics data={aiData} />}

      <style>{`
        @keyframes lmBounce { 0%,100% { transform:translateY(0); opacity:0.4; } 50% { transform:translateY(-4px); opacity:1; } }
      `}</style>
    </div>
  );
}
