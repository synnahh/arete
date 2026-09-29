// LM.jsx — Looksmaxxing OS
// A complete personal appearance optimisation system.
// Sections: Dashboard · Baseline · Foundation · Physique · Skin · Hair · Grooming ·
//           Style · Posture · Social · Photos · Experiments · Daily · Analytics · Coach
//
// Follows VALERIE conventions: GlassCard tokens, useCollection / useDocument for
// Supabase-backed, user-scoped, auto-persisting data, askClaudeRaw for AI, and the
// zero-dep SVG chart primitives in components/Charts.jsx.

import { useState, useEffect, useRef, useMemo } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument }   from '../supabase/useDocument.js';
import { STORAGE_KEYS }  from '../utils/storage.js';
import { askClaudeRaw }  from '../utils/claudeRaw.js';
import { RingChart, ProgressBar, BarChart } from '../components/Charts.jsx';
import { useHealthData } from '../hooks/useHealthData.js';
import { toLocalDateKey } from '../utils/localDate.js';
import SkinRoutine from './SkinRoutine.jsx';

// Map LM strength fields → Workout-tab exercise names, so LM can show your real lifts.
const LIFT_MAP = { bench: 'Bench Press', squat: 'Barbell Squat', deadlift: 'Deadlift', pullups: 'Pull-ups', dips: 'Dips' };
function latestLifts(workoutItems = []) {
  const out = {};
  for (const [k, name] of Object.entries(LIFT_MAP)) {
    const logs = workoutItems
      .filter(l => l.exerciseName === name && l.topSet)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    if (logs[0]?.topSet) out[k] = logs[0].topSet; // { weight, reps }
  }
  return out;
}

// ─── Shared design tokens (mirrors Mind.jsx) ──────────────────────────────────

const GLASS = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 16,
  backdropFilter: 'blur(24px)',
  boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 12px 40px rgba(0,0,0,0.4)',
  position: 'relative', overflow: 'hidden',
};

function GlassCard({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ ...GLASS, padding: '18px 20px', ...style }}>
      <div style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 1,
        background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)', pointerEvents: 'none' }} />
      {children}
    </div>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 18, height: 1, background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace,monospace' }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(255,255,255,0.1),transparent)' }} />
      {right}
    </div>
  );
}

const INPUT = {
  padding: '9px 12px', borderRadius: 9,
  border: '0.5px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.85)',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
  width: '100%', boxSizing: 'border-box',
};
const TEXTAREA = { ...INPUT, resize: 'vertical', lineHeight: 1.65, minHeight: 80 };
const BTN = {
  padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
  background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
  transition: 'opacity 0.15s',
};
const BTN_GHOST = {
  padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
  border: '0.5px solid rgba(255,255,255,0.1)',
  background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13,
};

function Spinner() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '2px 0', alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)',
          animation: `lmBounce 0.9s ${i * 0.15}s ease-in-out infinite` }} />
      ))}
    </div>
  );
}

function Tag({ label, colour }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20,
      fontSize: 10.5, fontWeight: 600, background: colour + '20', color: colour,
      border: `0.5px solid ${colour}44` }}>{label}</span>
  );
}

const MUTE = 'rgba(255,255,255,0.3)';
const FIELD_LABEL = { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: MUTE,
  fontFamily: 'ui-monospace,monospace', marginBottom: 4, textTransform: 'uppercase' };
const today = () => toLocalDateKey(new Date());

function EmptyState({ children }) {
  return (
    <GlassCard>
      <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
        {children}
      </div>
    </GlassCard>
  );
}

// Small labelled number input
function NumField({ label, value, onChange, placeholder, step }) {
  return (
    <div>
      <div style={FIELD_LABEL}>{label}</div>
      <input type="number" step={step} value={value ?? ''} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} style={INPUT} />
    </div>
  );
}

// Reusable 1–10 score slider row
function ScoreRow({ label, value, onChange, colour = 'var(--accent)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', width: 130, flexShrink: 0 }}>{label}</span>
      <input type="range" min="0" max="10" value={value ?? 0}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: colour }} />
      <span style={{ fontSize: 12, fontFamily: 'ui-monospace,monospace', color: colour, width: 34,
        textAlign: 'right', fontWeight: 700 }}>{value ?? 0}/10</span>
    </div>
  );
}

// ─── Scorecard definition ─────────────────────────────────────────────────────

const SCORE_CATS = [
  'Skin', 'Hair', 'Eye Area', 'Jawline', 'Physique',
  'Style', 'Grooming', 'Posture', 'Confidence', 'Social Presence',
];

const PHASES = ['Fat Loss', 'Lean Bulk', 'Recomp', 'Skin Repair', 'Hair Improvement', 'Style Upgrade', 'Maintenance'];
const PRIORITY_OPTIONS = [
  'Reduce body fat', 'Improve skin', 'Better haircut', 'Improve posture',
  'Upgrade wardrobe', 'Build muscle', 'Sharper jawline', 'More confidence',
  'Better sleep', 'Grooming consistency',
];
const STYLE_IDENTITIES = ['Classic', 'Minimalist', 'Athletic', 'Old Money', 'Streetwear', 'Business Casual', 'Creative'];

// ═══════════════════════════════════════════════════════════════════════════════
// AI LOOKSMAXXING COACH — deeply integrated, reads all module data
// ═══════════════════════════════════════════════════════════════════════════════

function buildCoachContext(data) {
  const { profile, metrics, daily, sleep, nutrition, skin, strength, experiments, health } = data;
  const last = (arr) => arr[arr.length - 1];
  const lastMetric = last(metrics) || {};
  const recentDaily = daily.slice(-7);
  const avgDaily = recentDaily.length
    ? Math.round(recentDaily.reduce((s, d) => s + (d.pct || 0), 0) / recentDaily.length)
    : null;
  const avgSleep = sleep.slice(-7).length
    ? (sleep.slice(-7).reduce((s, d) => s + (Number(d.duration) || 0), 0) / sleep.slice(-7).length).toFixed(1)
    : null;
  const sc = profile?.scorecard || {};
  const scoreLines = SCORE_CATS.map(c => `${c}: ${sc[c]?.current ?? '?'}/10 (goal ${sc[c]?.goal ?? '?'})`).join(', ');

  // Canonical Health-tab data (auto-synced incl. Apple Health) — weight/bodyFat/sleep/
  // nutrition live here, so the coach correlates appearance progress against real vitals.
  const h = health || {};
  const healthSection = h.hasHealthData
    ? `\n\nFROM THE HEALTH TAB (live, synced — use this as the source of truth for weight/sleep/nutrition):
Body weight: ${h.latestWeight != null ? h.latestWeight + 'kg' : 'no data'}${h.latestBodyFat != null ? `, body fat ${h.latestBodyFat}%` : ''}${h.latestMuscle != null ? `, muscle ${h.latestMuscle}kg` : ''}${h.latestBodyDate ? ` (as of ${h.latestBodyDate})` : ''}
Sleep: avg ${h.avgSleepHours != null ? h.avgSleepHours + 'h' : 'no data'} over last 7 nights${h.lastSleepEfficiency != null ? `, last efficiency ${h.lastSleepEfficiency}%` : ''}
Today's nutrition: ${h.todayCalories != null ? h.todayCalories + ' kcal' : 'not logged'}${h.todayProtein != null ? `, ${h.todayProtein}g protein` : ''}${h.todayWaterMl != null ? `, water ${(h.todayWaterMl/1000).toFixed(1)}L` : ''}`
    : '\n\nFROM THE HEALTH TAB: no synced health data yet — recommend the user log weight/sleep/nutrition in the Health tab (or connect Apple Health) so progress can be correlated.';

  return `THE USER'S LOOKSMAXXING DATA (live from their tracker):
Current phase: ${profile?.phase || 'not set'}
Top priorities: ${(profile?.priorities || []).join(', ') || 'none set'}
Appearance scorecard — ${scoreLines}
Latest LM measurements: weight ${lastMetric.weight || h.latestWeight || '?'}, body fat ${lastMetric.bodyFat || h.latestBodyFat || '?'}%, waist ${lastMetric.waist || '?'}, shoulders ${lastMetric.shoulders || '?'}, chest ${lastMetric.chest || '?'}, arms ${lastMetric.arms || '?'}, neck ${lastMetric.neck || '?'}
Body-measurement logs on record: ${metrics.length}
Strength logs: ${strength.length}${strength.length ? ` (latest bench ${last(strength).bench || '?'}, squat ${last(strength).squat || '?'}, deadlift ${last(strength).deadlift || '?'})` : ''}
Daily-tracker completion (last 7 days avg): ${avgDaily != null ? avgDaily + '%' : 'no data'}
Avg LM-logged sleep (last 7 logs): ${avgSleep != null ? avgSleep + 'h' : 'no data'}
Skin assessments logged: ${skin.length}${skin.length ? ` (latest overall ${last(skin).score || '?'}/10)` : ''}
Nutrition logs: ${nutrition.length}${nutrition.length ? ` (latest protein ${last(nutrition).protein || '?'}g, calories ${last(nutrition).calories || '?'})` : ''}
Active experiments: ${experiments.filter(e => !e.verdict).length}, completed: ${experiments.filter(e => e.verdict).length}${healthSection}`;
}

const COACH_SYSTEM = (ctx) => `You are the user's elite personal Looksmaxxing Coach — a blunt, knowledgeable appearance-optimisation expert covering physique, skincare, hair, grooming, style, posture, confidence and social skills. You are evidence-based, never sleazy, never body-shaming. You give specific, actionable, prioritised guidance and you always ground your advice in the actual data below. If data is missing, tell the user exactly what to start tracking. Keep responses tight and skimmable — short paragraphs, numbered steps where useful. Max ~4 paragraphs unless asked for a full plan.

${ctx}`;

function CoachChat({ data }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const ctx = useMemo(() => buildCoachContext(data), [data]);

  const STARTERS = [
    "What's holding back my physique progress?",
    'Which habits correlate with my best skin?',
    'Build me a 30-day skin improvement plan',
    'What are my biggest bottlenecks right now?',
    'Give me a fat-loss roadmap',
  ];

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    const next = [...messages, { role: 'user', content: msg }];
    setMessages(next);
    setLoading(true);
    try {
      const reply = await askClaudeRaw(msg, COACH_SYSTEM(ctx), messages);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: '16px 24px 16px' }}>
      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', marginBottom: 10, padding: '7px 12px',
        borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)', lineHeight: 1.5 }}>
        Your coach reads your live tracker data — phase, scorecard, measurements, sleep, daily consistency, skin & nutrition logs. The more you log, the sharper the advice.
      </div>
      {messages.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {STARTERS.map((s, i) => (
            <button key={i} onClick={() => send(s)} style={{ padding: '5px 11px', borderRadius: 20, cursor: 'pointer',
              fontSize: 11, border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.5)', textAlign: 'left' }}>{s}</button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8, minHeight: 0 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '82%', padding: '10px 14px', fontSize: 13, lineHeight: 1.7,
              color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap',
              borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
              background: m.role === 'user' ? 'var(--accent)22' : 'rgba(255,255,255,0.04)',
              border: `0.5px solid ${m.role === 'user' ? 'var(--accent)44' : 'rgba(255,255,255,0.08)'}` }}>{m.content}</div>
          </div>
        ))}
        {loading && <div style={{ padding: '4px 14px' }}><Spinner /></div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask your looksmaxxing coach..." style={{ ...INPUT, flex: 1 }} />
        <button onClick={() => send()} disabled={!input.trim() || loading}
          style={{ ...BTN, opacity: (!input.trim() || loading) ? 0.5 : 1 }}>Send</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function Dashboard({ profile, saveProfile, metrics, daily, data, goTo, health }) {
  const sc = profile?.scorecard || {};
  const avgCurrent = useMemo(() => {
    const vals = SCORE_CATS.map(c => sc[c]?.current).filter(v => v != null);
    return vals.length ? Math.round((vals.reduce((a, b) => a + Number(b), 0) / vals.length) * 10) : 0;
  }, [sc]);
  // Prefer Health-tab data (auto-synced incl. Apple Health) for shared vitals; fall
  // back to LM's own logged measurement so the dashboard always shows the latest truth.
  const rawLast = metrics[metrics.length - 1] || {};
  const lastMetric = {
    ...rawLast,
    weight:  health?.latestWeight  ?? rawLast.weight,
    bodyFat: health?.latestBodyFat ?? rawLast.bodyFat,
  };
  const avgDaily7 = daily.slice(-7).length
    ? Math.round(daily.slice(-7).reduce((s, d) => s + (d.pct || 0), 0) / daily.slice(-7).length) : 0;

  function togglePriority(p) {
    const cur = profile?.priorities || [];
    let next;
    if (cur.includes(p)) next = cur.filter(x => x !== p);
    else if (cur.length >= 3) return;
    else next = [...cur, p];
    saveProfile({ ...profile, priorities: next });
  }

  function setScore(cat, field, val) {
    const next = { ...sc, [cat]: { ...sc[cat], [field]: val } };
    saveProfile({ ...profile, scorecard: next });
  }

  const METRIC_KEYS = ['weight', 'bodyFat', 'waist', 'shoulders', 'chest', 'arms', 'neck', 'height'];
  const METRIC_LABELS = { weight: 'Weight', bodyFat: 'Body Fat %', waist: 'Waist', shoulders: 'Shoulders',
    chest: 'Chest', arms: 'Arms', neck: 'Neck', height: 'Height' };

  return (
    <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Top: phase + composite ring + quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        <GlassCard>
          <SectionLabel>Current Phase</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PHASES.map(p => (
              <button key={p} onClick={() => saveProfile({ ...profile, phase: p })} style={{
                padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: profile?.phase === p ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: profile?.phase === p ? '#fff' : 'rgba(255,255,255,0.45)' }}>{p}</button>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <SectionLabel right={<span style={{ fontSize: 10, color: MUTE }}>{(profile?.priorities || []).length}/3</span>}>Top Priorities</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PRIORITY_OPTIONS.map(p => {
                const on = (profile?.priorities || []).includes(p);
                return (
                  <button key={p} onClick={() => togglePriority(p)} style={{
                    padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 11.5,
                    border: `0.5px solid ${on ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                    background: on ? 'var(--accent)22' : 'transparent',
                    color: on ? 'var(--accent)' : 'rgba(255,255,255,0.4)' }}>{p}</button>
                );
              })}
            </div>
          </div>
        </GlassCard>

        <GlassCard style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <RingChart value={avgCurrent} max={100} size={132} thickness={10}
            label={avgCurrent} sublabel="OVERALL" colour="var(--accent)" />
          <div style={{ display: 'flex', gap: 22 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 19, fontWeight: 300, color: 'rgba(255,255,255,0.9)' }}>{avgDaily7}%</div>
              <div style={{ fontSize: 9.5, color: MUTE, letterSpacing: '0.06em' }}>7-DAY CONSISTENCY</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 19, fontWeight: 300, color: 'rgba(255,255,255,0.9)' }}>{lastMetric.weight || '—'}</div>
              <div style={{ fontSize: 9.5, color: MUTE, letterSpacing: '0.06em' }}>LATEST WEIGHT</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Scorecard */}
      <GlassCard>
        <SectionLabel>Appearance Scorecard</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
          {SCORE_CATS.map(cat => {
            const cur = sc[cat]?.current ?? 0, goal = sc[cat]?.goal ?? 10;
            const reached = cur >= goal && cur > 0;
            return (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{cat}</span>
                  <span style={{ fontSize: 11, fontFamily: 'ui-monospace,monospace', color: reached ? '#6BE3A4' : 'var(--accent)' }}>
                    {cur}/10 <span style={{ color: MUTE }}>→ {goal}</span>
                  </span>
                </div>
                <ProgressBar value={cur} max={10} colour={reached ? '#6BE3A4' : 'var(--accent)'} />
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <input type="range" min="0" max="10" value={cur} onChange={e => setScore(cat, 'current', Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)' }} title="Current" />
                  <input type="range" min="0" max="10" value={goal} onChange={e => setScore(cat, 'goal', Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'rgba(255,255,255,0.3)' }} title="Goal" />
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Key metrics snapshot */}
      <GlassCard>
        <SectionLabel right={<button onClick={() => goTo('physique')} style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 11 }}>Log measurements →</button>}>
          Key Metrics
        </SectionLabel>
        {health?.latestWeight != null && (
          <div style={{ fontSize: 10.5, color: '#6BE3A4', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6BE3A4' }} />
            Weight & body fat synced live from your Health tab{health.latestBodyDate ? ` · ${health.latestBodyDate}` : ''}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {METRIC_KEYS.map(k => (
            <div key={k} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 9.5, color: MUTE, letterSpacing: '0.05em', marginBottom: 3 }}>{METRIC_LABELS[k].toUpperCase()}</div>
              <div style={{ fontSize: 18, fontWeight: 300, color: 'rgba(255,255,255,0.9)' }}>{lastMetric[k] || '—'}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BASELINE ANALYSIS (face)
// ═══════════════════════════════════════════════════════════════════════════════

const FACE_SECTIONS = ['Face shape', 'Symmetry', 'Facial thirds', 'Eyes', 'Eyebrows', 'Nose', 'Lips', 'Jawline', 'Chin', 'Skin', 'Facial hair'];

function Baseline({ profile, saveProfile }) {
  const baseline = profile?.baseline || {};
  const [open, setOpen] = useState(FACE_SECTIONS[0]);

  function setField(section, field, val) {
    const next = { ...baseline, [section]: { ...baseline[section], [field]: val } };
    saveProfile({ ...profile, baseline: next });
  }
  function setPhoto(section, dataUrl) { setField(section, 'photo', dataUrl); }

  const cur = baseline[open] || {};
  const FIELDS = [
    ['assessment', 'Current assessment', TEXTAREA],
    ['strengths', 'Strengths', TEXTAREA],
    ['weaknesses', 'Weaknesses', TEXTAREA],
    ['plan', 'Improvement plan', TEXTAREA],
    ['notes', 'Notes', TEXTAREA],
  ];

  return (
    <div style={{ padding: '20px 24px 40px', display: 'flex', gap: 14 }}>
      {/* Section rail */}
      <div style={{ width: 170, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {FACE_SECTIONS.map(s => {
          const done = baseline[s]?.assessment;
          return (
            <button key={s} onClick={() => setOpen(s)} style={{
              textAlign: 'left', padding: '9px 12px', borderRadius: 9, cursor: 'pointer', border: 'none',
              background: open === s ? 'var(--accent)22' : 'transparent', fontSize: 12.5,
              color: open === s ? 'var(--accent)' : 'rgba(255,255,255,0.5)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {s}{done && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6BE3A4' }} />}
            </button>
          );
        })}
      </div>

      {/* Detail */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <GlassCard>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: 16 }}>{open}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FIELDS.map(([k, label]) => (
              <div key={k}>
                <div style={FIELD_LABEL}>{label}</div>
                <textarea value={cur[k] || ''} onChange={e => setField(open, k, e.target.value)}
                  placeholder={`${label}...`} style={{ ...TEXTAREA, minHeight: 60 }} />
              </div>
            ))}
            <div>
              <div style={FIELD_LABEL}>Reference photo</div>
              {cur.photo && <img src={cur.photo} alt="" style={{ maxWidth: 160, borderRadius: 10, marginBottom: 8, display: 'block' }} />}
              <PhotoInput onPhoto={url => setPhoto(open, url)} label={cur.photo ? 'Replace photo' : 'Upload photo'} />
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// Image -> base64 helper input
function PhotoInput({ onPhoto, label = 'Upload photo' }) {
  const ref = useRef(null);
  function handle(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onPhoto(reader.result);
    reader.readAsDataURL(file);
  }
  return (
    <>
      <input ref={ref} type="file" accept="image/*" onChange={handle} style={{ display: 'none' }} />
      <button onClick={() => ref.current?.click()} style={BTN_GHOST}>{label}</button>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FOUNDATION (sleep / hydration / nutrition)
// ═══════════════════════════════════════════════════════════════════════════════

function Foundation({ profile, saveProfile, sleep, nutrition, health }) {
  const [sForm, setSForm] = useState({ bedtime: '', wake: '', duration: '', quality: 7 });
  const [nForm, setNForm] = useState({ calories: '', protein: '', carbs: '', fat: '', fiber: '', water: '' });
  const waterGoal = profile?.waterGoal || 3;

  const sleep7 = sleep.items.slice(-7);
  const avgSleep = sleep7.length ? (sleep7.reduce((s, d) => s + (Number(d.duration) || 0), 0) / sleep7.length).toFixed(1) : '—';
  const avgQual = sleep7.length ? Math.round(sleep7.reduce((s, d) => s + (Number(d.quality) || 0), 0) / sleep7.length) : '—';

  return (
    <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {health?.hasHealthData && (
        <GlassCard style={{ borderLeft: '3px solid #6BE3A4' }}>
          <SectionLabel>From Health · live</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              ['Sleep (7-night avg)', health.avgSleepHours != null ? health.avgSleepHours + 'h' : '—'],
              ['Today protein', health.todayProtein != null ? health.todayProtein + 'g' : '—'],
              ['Today calories', health.todayCalories != null ? health.todayCalories : '—'],
            ].map(([l, v]) => (
              <div key={l} style={{ padding: '8px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: 9, color: MUTE, letterSpacing: '0.05em', marginBottom: 3 }}>{l.toUpperCase()}</div>
                <div style={{ fontSize: 18, fontWeight: 300, color: 'rgba(255,255,255,0.9)' }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: MUTE, marginTop: 8 }}>Synced from your Health tab (incl. Apple Health). Use the cards below for manual LM-specific logging.</div>
        </GlassCard>
      )}
      {/* Sleep */}
      <GlassCard>
        <SectionLabel right={<span style={{ fontSize: 11, color: MUTE }}>7-day avg {avgSleep}h · quality {avgQual}/10</span>}>Sleep Tracking</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr) auto', gap: 10, alignItems: 'end' }}>
          <div><div style={FIELD_LABEL}>Bedtime</div><input type="time" value={sForm.bedtime} onChange={e => setSForm(p => ({ ...p, bedtime: e.target.value }))} style={INPUT} /></div>
          <div><div style={FIELD_LABEL}>Wake</div><input type="time" value={sForm.wake} onChange={e => setSForm(p => ({ ...p, wake: e.target.value }))} style={INPUT} /></div>
          <NumField label="Duration (h)" step="0.1" value={sForm.duration} onChange={v => setSForm(p => ({ ...p, duration: v }))} placeholder="8" />
          <NumField label="Quality (1-10)" value={sForm.quality} onChange={v => setSForm(p => ({ ...p, quality: v }))} placeholder="7" />
          <button style={BTN} onClick={() => { sleep.add({ ...sForm, date: today() }); setSForm({ bedtime: '', wake: '', duration: '', quality: 7 }); }}>Log</button>
        </div>
        {sleep7.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <BarChart data={sleep7.map(d => ({ label: d.date?.slice(5), value: Number(d.duration) || 0 }))} goalLine={8} maxHeight={70} />
          </div>
        )}
      </GlassCard>

      {/* Hydration */}
      <GlassCard>
        <SectionLabel>Hydration</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Daily water goal</span>
          <input type="number" step="0.25" value={waterGoal} onChange={e => saveProfile({ ...profile, waterGoal: Number(e.target.value) })}
            style={{ ...INPUT, width: 90 }} />
          <span style={{ fontSize: 12, color: MUTE }}>litres / day</span>
        </div>
      </GlassCard>

      {/* Nutrition */}
      <GlassCard>
        <SectionLabel>Nutrition</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr) auto', gap: 10, alignItems: 'end' }}>
          <NumField label="Calories" value={nForm.calories} onChange={v => setNForm(p => ({ ...p, calories: v }))} placeholder="2400" />
          <NumField label="Protein g" value={nForm.protein} onChange={v => setNForm(p => ({ ...p, protein: v }))} placeholder="180" />
          <NumField label="Carbs g" value={nForm.carbs} onChange={v => setNForm(p => ({ ...p, carbs: v }))} placeholder="220" />
          <NumField label="Fat g" value={nForm.fat} onChange={v => setNForm(p => ({ ...p, fat: v }))} placeholder="70" />
          <NumField label="Fiber g" value={nForm.fiber} onChange={v => setNForm(p => ({ ...p, fiber: v }))} placeholder="35" />
          <NumField label="Water L" value={nForm.water} onChange={v => setNForm(p => ({ ...p, water: v }))} placeholder="3" />
          <button style={BTN} onClick={() => { nutrition.add({ ...nForm, date: today() }); setNForm({ calories: '', protein: '', carbs: '', fat: '', fiber: '', water: '' }); }}>Log</button>
        </div>
        {nutrition.items.slice(-7).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={FIELD_LABEL}>Protein (last 7 logs)</div>
            <BarChart data={nutrition.items.slice(-7).map(d => ({ label: d.date?.slice(5), value: Number(d.protein) || 0 }))} maxHeight={70} colour="#6BE3A4" />
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. PHYSIQUEMAXXING
// ═══════════════════════════════════════════════════════════════════════════════

const BODY_FIELDS = [
  ['weight', 'Weight'], ['bodyFat', 'Body Fat %'], ['waist', 'Waist'], ['shoulders', 'Shoulders'],
  ['chest', 'Chest'], ['arms', 'Arms'], ['forearms', 'Forearms'], ['thighs', 'Thighs'], ['calves', 'Calves'], ['neck', 'Neck'],
];
const STRENGTH_FIELDS = [['bench', 'Bench'], ['squat', 'Squat'], ['deadlift', 'Deadlift'], ['pullups', 'Pullups'], ['dips', 'Dips']];

function Physique({ profile, saveProfile, metrics, strength, health, workouts }) {
  const [bForm, setBForm] = useState({});
  const [sForm, setSForm] = useState({});
  const mItems = metrics.items;
  const sItems = strength.items;
  const lifts = useMemo(() => latestLifts(workouts), [workouts]);
  const liftPh = (k) => sForm[k] != null ? undefined : (lifts[k] ? `${lifts[k].weight || 'BW'}${lifts[k].weight ? 'kg' : ''}` : '—');
  const last = mItems[mItems.length - 1] || {};
  const prev = mItems[mItems.length - 2] || {};
  const trend = (k) => (last[k] != null && prev[k] != null) ? (Number(last[k]) - Number(prev[k])) : null;
  // Health tab is the source of truth for weight + body fat — show it as the placeholder.
  const ph = (k) => (k === 'weight'  ? (health?.latestWeight  ?? last.weight)
                   : k === 'bodyFat' ? (health?.latestBodyFat ?? last.bodyFat)
                   : last[k]) || '—';

  return (
    <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {health?.latestWeight != null && (
        <GlassCard style={{ borderLeft: '3px solid #6BE3A4', padding: '12px 18px' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            <span style={{ color: '#6BE3A4', fontWeight: 600 }}>From Health:</span>{' '}
            {health.latestWeight}kg{health.latestBodyFat != null ? ` · ${health.latestBodyFat}% body fat` : ''}{health.latestMuscle != null ? ` · ${health.latestMuscle}kg muscle` : ''}
            {health.latestBodyDate ? <span style={{ color: MUTE }}> · {health.latestBodyDate}</span> : null}
          </div>
          <div style={{ fontSize: 10.5, color: MUTE, marginTop: 3 }}>Auto-synced. Log circumferences below to complete your physique snapshot.</div>
        </GlassCard>
      )}
      {/* Measurements */}
      <GlassCard>
        <SectionLabel right={<span style={{ fontSize: 11, color: MUTE }}>{mItems.length} logs</span>}>Measurements</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
          {BODY_FIELDS.map(([k, label]) => (
            <NumField key={k} label={label} step="0.1" value={bForm[k]} onChange={v => setBForm(p => ({ ...p, [k]: v }))} placeholder={ph(k)} />
          ))}
        </div>
        <button style={{ ...BTN, marginTop: 12 }} onClick={() => { metrics.add({ ...bForm, date: today() }); setBForm({}); }}>+ Log snapshot</button>
        {mItems.length > 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginTop: 16 }}>
            {BODY_FIELDS.map(([k, label]) => {
              const t = trend(k);
              return (
                <div key={k} style={{ padding: '8px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ fontSize: 9, color: MUTE, letterSpacing: '0.05em' }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize: 16, fontWeight: 300, color: 'rgba(255,255,255,0.9)' }}>{last[k] || '—'}</div>
                  {t != null && t !== 0 && (
                    <div style={{ fontSize: 10, color: t > 0 ? '#6BE3A4' : '#e55a5a' }}>{t > 0 ? '▲' : '▼'} {Math.abs(t).toFixed(1)}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Strength */}
      <GlassCard>
        <SectionLabel right={Object.keys(lifts).length ? <span style={{ fontSize: 10.5, color: '#6BE3A4' }}>● from Workout</span> : null}>Strength Metrics</SectionLabel>
        {Object.keys(lifts).length > 0 && (
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginBottom: 12, lineHeight: 1.6 }}>
            Latest top sets from your Workout tab:{' '}
            {STRENGTH_FIELDS.filter(([k]) => lifts[k]).map(([k, label]) =>
              `${label} ${lifts[k].weight ? lifts[k].weight + 'kg' : 'BW'}×${lifts[k].reps ?? '?'}`).join(' · ')}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr) auto', gap: 10, alignItems: 'end' }}>
          {STRENGTH_FIELDS.map(([k, label]) => (
            <NumField key={k} label={label} value={sForm[k]} onChange={v => setSForm(p => ({ ...p, [k]: v }))} placeholder={liftPh(k)} />
          ))}
          <button style={BTN} onClick={() => { strength.add({ ...sForm, date: today() }); setSForm({}); }}>Log</button>
        </div>
        {sItems.slice(-8).length > 1 && (
          <div style={{ marginTop: 16 }}>
            <div style={FIELD_LABEL}>Bench progression</div>
            <BarChart data={sItems.slice(-8).map(d => ({ label: d.date?.slice(5), value: Number(d.bench) || 0 }))} maxHeight={70} />
          </div>
        )}
      </GlassCard>

      {/* Weak point analysis */}
      <GlassCard>
        <SectionLabel>Weak Point Analysis</SectionLabel>
        <div style={FIELD_LABEL}>Lagging muscle groups & notes</div>
        <textarea value={profile?.weakPoints || ''} onChange={e => saveProfile({ ...profile, weakPoints: e.target.value })}
          placeholder="e.g. Rear delts and calves lagging — add volume..." style={{ ...TEXTAREA, minHeight: 90 }} />
      </GlassCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SKINMAXXING
// ═══════════════════════════════════════════════════════════════════════════════

const SKIN_METRICS = ['acne', 'redness', 'pigmentation', 'texture', 'dryness'];

function SkinMaxxing({ profile, saveProfile, skin, daily }) {
  const [assess, setAssess] = useState({ acne: 5, redness: 5, pigmentation: 5, texture: 5, dryness: 5 });

  function logAssessment() {
    const score = Math.round(SKIN_METRICS.reduce((s, k) => s + (10 - assess[k]), 0) / SKIN_METRICS.length); // lower issues = higher score
    skin.add({ ...assess, score, date: today() });
    setAssess({ acne: 5, redness: 5, pigmentation: 5, texture: 5, dryness: 5 });
  }

  return (
    <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SkinRoutine profile={profile} saveProfile={saveProfile} daily={daily} />

      <GlassCard>
        <SectionLabel right={<span style={{ fontSize: 11, color: MUTE }}>0 = clear · 10 = severe</span>}>Skin Assessment</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SKIN_METRICS.map(k => (
            <ScoreRow key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={assess[k]}
              onChange={v => setAssess(p => ({ ...p, [k]: v }))} colour="#f4a642" />
          ))}
        </div>
        <button style={{ ...BTN, marginTop: 14 }} onClick={logAssessment}>+ Log monthly assessment</button>
        {skin.items.slice(-8).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={FIELD_LABEL}>Overall skin score trend</div>
            <BarChart data={skin.items.slice(-8).map(d => ({ label: d.date?.slice(5), value: Number(d.score) || 0 }))} maxHeight={70} colour="#6BE3A4" goalLine={8} />
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. HAIRMAXXING
// ═══════════════════════════════════════════════════════════════════════════════

function HairMaxxing({ profile, saveProfile, haircuts, products }) {
  const hair = profile?.hair || {};
  const [cut, setCut] = useState({ style: '', barber: '', rating: 7 });
  const [prod, setProd] = useState({ name: '', effectiveness: 7, notes: '' });
  const hairProducts = products.items.filter(p => p.domain === 'hair');

  const HAIR_FIELDS = [['type', 'Hair type'], ['density', 'Density'], ['hairline', 'Hairline'], ['crown', 'Crown'], ['texture', 'Texture'], ['style', 'Current style']];

  return (
    <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <SectionLabel>Hair Profile</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {HAIR_FIELDS.map(([k, label]) => (
            <div key={k}>
              <div style={FIELD_LABEL}>{label}</div>
              <input value={hair[k] || ''} onChange={e => saveProfile({ ...profile, hair: { ...hair, [k]: e.target.value } })} style={INPUT} />
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionLabel right={<span style={{ fontSize: 11, color: MUTE }}>{haircuts.items.length} cuts</span>}>Haircut Database</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr auto auto', gap: 10, alignItems: 'end' }}>
          <div><div style={FIELD_LABEL}>Style</div><input value={cut.style} onChange={e => setCut(p => ({ ...p, style: e.target.value }))} style={INPUT} /></div>
          <div><div style={FIELD_LABEL}>Barber</div><input value={cut.barber} onChange={e => setCut(p => ({ ...p, barber: e.target.value }))} style={INPUT} /></div>
          <NumField label="Rating" value={cut.rating} onChange={v => setCut(p => ({ ...p, rating: v }))} />
          <button style={BTN} onClick={() => { if (cut.style.trim()) { haircuts.add({ ...cut, date: today() }); setCut({ style: '', barber: '', rating: 7 }); } }}>Add</button>
        </div>
        <ItemList items={[...haircuts.items].reverse()} onRemove={haircuts.remove}
          render={c => `${c.date} · ${c.style}${c.barber ? ' @ ' + c.barber : ''} · ${c.rating}/10`} />
      </GlassCard>

      <GlassCard>
        <SectionLabel>Hair Products</SectionLabel>
        <ProductForm prod={prod} setProd={setProd} onAdd={() => { if (prod.name.trim()) { products.add({ ...prod, domain: 'hair', date: today() }); setProd({ name: '', effectiveness: 7, notes: '' }); } }} />
        <ItemList items={[...hairProducts].reverse()} onRemove={products.remove}
          render={p => `${p.name} · ${p.effectiveness}/10${p.notes ? ' · ' + p.notes : ''}`} />
      </GlassCard>
    </div>
  );
}

function ProductForm({ prod, setProd, onAdd }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr auto 2fr auto', gap: 10, alignItems: 'end' }}>
      <div><div style={FIELD_LABEL}>Product</div><input value={prod.name} onChange={e => setProd(p => ({ ...p, name: e.target.value }))} style={INPUT} /></div>
      <NumField label="Effect" value={prod.effectiveness} onChange={v => setProd(p => ({ ...p, effectiveness: v }))} />
      <div><div style={FIELD_LABEL}>Notes</div><input value={prod.notes} onChange={e => setProd(p => ({ ...p, notes: e.target.value }))} style={INPUT} /></div>
      <button style={BTN} onClick={onAdd}>Add</button>
    </div>
  );
}

// Simple list with remove
function ItemList({ items, onRemove, render }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
      {items.map((it, i) => (
        <div key={it.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
          <span>{render(it)}</span>
          <button onClick={() => onRemove(it.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', fontSize: 15 }}>&#215;</button>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. GROOMING
// ═══════════════════════════════════════════════════════════════════════════════

function Grooming({ profile, saveProfile, fragrances }) {
  const teeth = profile?.teeth || {};
  const facialHair = profile?.facialHair || {};
  const [frag, setFrag] = useState({ name: '', rating: 7, notes: '' });
  const FACIAL_STYLES = ['Clean shave', 'Stubble', 'Short beard', 'Full beard', 'Goatee'];

  return (
    <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <SectionLabel>Teeth</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[['brushing', 'Brushing (per day)'], ['flossing', 'Flossing consistency'], ['whitening', 'Whitening']].map(([k, label]) => (
            <ScoreRow key={k} label={label} value={teeth[k] || 0} onChange={v => saveProfile({ ...profile, teeth: { ...teeth, [k]: v } })} />
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionLabel>Facial Hair</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {FACIAL_STYLES.map(s => (
            <button key={s} onClick={() => saveProfile({ ...profile, facialHair: { ...facialHair, current: s } })} style={{
              padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
              background: facialHair.current === s ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: facialHair.current === s ? '#fff' : 'rgba(255,255,255,0.45)' }}>{s}</button>
          ))}
        </div>
        <div style={FIELD_LABEL}>Style comparison & ratings</div>
        <textarea value={facialHair.notes || ''} onChange={e => saveProfile({ ...profile, facialHair: { ...facialHair, notes: e.target.value } })}
          placeholder="Clean shave 6/10 — too boyish. Stubble 8/10 — best jawline definition..." style={{ ...TEXTAREA, minHeight: 70 }} />
      </GlassCard>

      <GlassCard>
        <SectionLabel right={<span style={{ fontSize: 11, color: MUTE }}>{fragrances.items.length}</span>}>Fragrances</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr auto 2fr auto', gap: 10, alignItems: 'end' }}>
          <div><div style={FIELD_LABEL}>Name</div><input value={frag.name} onChange={e => setFrag(p => ({ ...p, name: e.target.value }))} style={INPUT} /></div>
          <NumField label="Rating" value={frag.rating} onChange={v => setFrag(p => ({ ...p, rating: v }))} />
          <div><div style={FIELD_LABEL}>Notes</div><input value={frag.notes} onChange={e => setFrag(p => ({ ...p, notes: e.target.value }))} style={INPUT} /></div>
          <button style={BTN} onClick={() => { if (frag.name.trim()) { fragrances.add({ ...frag, date: today() }); setFrag({ name: '', rating: 7, notes: '' }); } }}>Add</button>
        </div>
        <ItemList items={[...fragrances.items].reverse()} onRemove={fragrances.remove}
          render={f => `${f.name} · ${f.rating}/10${f.notes ? ' · ' + f.notes : ''}`} />
      </GlassCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. STYLEMAXXING
// ═══════════════════════════════════════════════════════════════════════════════

const WARDROBE_CATS = ['Tops', 'Bottoms', 'Shoes', 'Outerwear', 'Accessories'];

function StyleMaxxing({ profile, saveProfile, wardrobe, outfits }) {
  const [item, setItem] = useState({ name: '', category: 'Tops', fit: 7, condition: 7, keep: true });
  const [outfit, setOutfit] = useState({ name: '', rating: 7, notes: '', photo: '' });

  return (
    <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <SectionLabel>Style Identity</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STYLE_IDENTITIES.map(s => (
            <button key={s} onClick={() => saveProfile({ ...profile, styleIdentity: s })} style={{
              padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: profile?.styleIdentity === s ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: profile?.styleIdentity === s ? '#fff' : 'rgba(255,255,255,0.45)' }}>{s}</button>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionLabel right={<span style={{ fontSize: 11, color: MUTE }}>{wardrobe.items.length} pieces</span>}>Wardrobe Audit</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr auto auto auto auto', gap: 10, alignItems: 'end' }}>
          <div><div style={FIELD_LABEL}>Item</div><input value={item.name} onChange={e => setItem(p => ({ ...p, name: e.target.value }))} style={INPUT} /></div>
          <div><div style={FIELD_LABEL}>Category</div>
            <select value={item.category} onChange={e => setItem(p => ({ ...p, category: e.target.value }))} style={INPUT}>
              {WARDROBE_CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <NumField label="Fit" value={item.fit} onChange={v => setItem(p => ({ ...p, fit: v }))} />
          <NumField label="Cond" value={item.condition} onChange={v => setItem(p => ({ ...p, condition: v }))} />
          <div><div style={FIELD_LABEL}>Keep?</div>
            <button onClick={() => setItem(p => ({ ...p, keep: !p.keep }))} style={{ ...BTN_GHOST, color: item.keep ? '#6BE3A4' : '#e55a5a', borderColor: (item.keep ? '#6BE3A4' : '#e55a5a') + '55' }}>
              {item.keep ? 'Keep' : 'Remove'}
            </button>
          </div>
          <button style={BTN} onClick={() => { if (item.name.trim()) { wardrobe.add({ ...item }); setItem({ name: '', category: 'Tops', fit: 7, condition: 7, keep: true }); } }}>Add</button>
        </div>
        <ItemList items={[...wardrobe.items].reverse()} onRemove={wardrobe.remove}
          render={w => `${w.category} · ${w.name} · fit ${w.fit}/10 · ${w.keep ? 'keep' : 'remove'}`} />
      </GlassCard>

      <GlassCard>
        <SectionLabel right={<span style={{ fontSize: 11, color: MUTE }}>{outfits.items.length} outfits</span>}>Outfit Database</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr auto 2fr auto', gap: 10, alignItems: 'end' }}>
          <div><div style={FIELD_LABEL}>Outfit name</div><input value={outfit.name} onChange={e => setOutfit(p => ({ ...p, name: e.target.value }))} style={INPUT} /></div>
          <NumField label="Rating" value={outfit.rating} onChange={v => setOutfit(p => ({ ...p, rating: v }))} />
          <div><div style={FIELD_LABEL}>Notes</div><input value={outfit.notes} onChange={e => setOutfit(p => ({ ...p, notes: e.target.value }))} style={INPUT} /></div>
          <div style={{ display: 'flex', gap: 6 }}>
            <PhotoInput onPhoto={url => setOutfit(p => ({ ...p, photo: url }))} label={outfit.photo ? '✓ Photo' : 'Photo'} />
            <button style={BTN} onClick={() => { if (outfit.name.trim()) { outfits.add({ ...outfit, date: today() }); setOutfit({ name: '', rating: 7, notes: '', photo: '' }); } }}>Add</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 14 }}>
          {[...outfits.items].reverse().map((o, i) => (
            <GlassCard key={o.id || i} style={{ padding: 10 }}>
              {o.photo && <img src={o.photo} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 6, aspectRatio: '3/4', objectFit: 'cover' }} />}
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{o.name}</div>
              <div style={{ fontSize: 11, color: 'var(--accent)' }}>{o.rating}/10</div>
              {o.notes && <div style={{ fontSize: 10.5, color: MUTE, marginTop: 2 }}>{o.notes}</div>}
              <button onClick={() => outfits.remove(o.id)} style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>&#215;</button>
            </GlassCard>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. POSTUREMAXXING
// ═══════════════════════════════════════════════════════════════════════════════

const POSTURE_ISSUES = [['forwardHead', 'Forward head posture'], ['roundedShoulders', 'Rounded shoulders'], ['pelvicTilt', 'Anterior pelvic tilt']];

function PostureMaxxing({ profile, saveProfile, postureLogs }) {
  const posture = profile?.posture || {};
  const [routine, setRoutine] = useState('');

  return (
    <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <SectionLabel right={<span style={{ fontSize: 11, color: MUTE }}>0 = fixed · 10 = severe</span>}>Posture Assessment</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {POSTURE_ISSUES.map(([k, label]) => (
            <ScoreRow key={k} label={label} value={posture[k] || 0} colour="#e879f9"
              onChange={v => saveProfile({ ...profile, posture: { ...posture, [k]: v } })} />
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionLabel>Corrective Routine</SectionLabel>
        <div style={FIELD_LABEL}>Your posture routine (exercises & sets)</div>
        <textarea value={posture.routine || ''} onChange={e => saveProfile({ ...profile, posture: { ...posture, routine: e.target.value } })}
          placeholder="Chin tucks 3x15\nFace pulls 3x20\nWall slides 3x12\nHip flexor stretch 2x30s" style={{ ...TEXTAREA, minHeight: 100 }} />
      </GlassCard>

      <GlassCard>
        <SectionLabel right={<span style={{ fontSize: 11, color: MUTE }}>{postureLogs.items.length} sessions</span>}>Track Sessions</SectionLabel>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={routine} onChange={e => setRoutine(e.target.value)} placeholder="Session note — e.g. 'Did full routine, felt looser'" style={{ ...INPUT, flex: 1 }} />
          <button style={BTN} onClick={() => { if (routine.trim()) { postureLogs.add({ note: routine, date: today() }); setRoutine(''); } }}>Log</button>
        </div>
        <ItemList items={[...postureLogs.items].reverse()} onRemove={postureLogs.remove} render={l => `${l.date} · ${l.note}`} />
      </GlassCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. SOCIALMAXXING
// ═══════════════════════════════════════════════════════════════════════════════

const WEEKLY_CHALLENGES = ['Start 3 conversations', 'Give 1 genuine compliment', 'Attend 1 social event', 'Hold eye contact in every chat', 'Speak up in 1 group setting'];

function SocialMaxxing({ social, profile, saveProfile }) {
  const [score, setScore] = useState({ confidence: 5, eyeContact: 5, conversation: 5 });
  const done = profile?.challengesDone || {};
  const weekKey = (() => { const d = new Date(); const onejan = new Date(d.getFullYear(), 0, 1); return `${d.getFullYear()}-W${Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7)}`; })();
  const weekDone = done[weekKey] || [];

  function toggleChallenge(c) {
    const next = weekDone.includes(c) ? weekDone.filter(x => x !== c) : [...weekDone, c];
    saveProfile({ ...profile, challengesDone: { ...done, [weekKey]: next } });
  }

  const recent = social.items.slice(-8);
  return (
    <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <SectionLabel>Weekly Self-Scores</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ScoreRow label="Confidence" value={score.confidence} onChange={v => setScore(p => ({ ...p, confidence: v }))} colour="#4a9eff" />
          <ScoreRow label="Eye Contact" value={score.eyeContact} onChange={v => setScore(p => ({ ...p, eyeContact: v }))} colour="#4a9eff" />
          <ScoreRow label="Conversation Skills" value={score.conversation} onChange={v => setScore(p => ({ ...p, conversation: v }))} colour="#4a9eff" />
        </div>
        <button style={{ ...BTN, marginTop: 14 }} onClick={() => social.add({ ...score, date: today() })}>+ Log this week</button>
        {recent.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={FIELD_LABEL}>Confidence trend</div>
            <BarChart data={recent.map(d => ({ label: d.date?.slice(5), value: Number(d.confidence) || 0 }))} maxHeight={64} colour="#4a9eff" />
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <SectionLabel right={<span style={{ fontSize: 11, color: MUTE }}>{weekDone.length}/{WEEKLY_CHALLENGES.length} this week</span>}>Weekly Challenges</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {WEEKLY_CHALLENGES.map(c => {
            const on = weekDone.includes(c);
            return (
              <button key={c} onClick={() => toggleChallenge(c)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: `0.5px solid ${on ? '#6BE3A4' : 'rgba(255,255,255,0.1)'}`, background: on ? 'rgba(107,227,164,0.08)' : 'transparent', textAlign: 'left' }}>
                <span style={{ width: 18, height: 18, borderRadius: 6, border: `1.5px solid ${on ? '#6BE3A4' : 'rgba(255,255,255,0.25)'}`,
                  background: on ? '#6BE3A4' : 'transparent', color: '#000', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
                <span style={{ fontSize: 13, color: on ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)', textDecoration: on ? 'line-through' : 'none' }}>{c}</span>
              </button>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11. PHOTO VAULT
// ═══════════════════════════════════════════════════════════════════════════════

const PHOTO_CATS = ['Front face', 'Side profile', 'Smile', 'Full body front', 'Full body side'];

function PhotoVault({ photos }) {
  const [cat, setCat] = useState(PHOTO_CATS[0]);
  const [compare, setCompare] = useState(false);
  const catPhotos = useMemo(() => photos.items.filter(p => p.category === cat).sort((a, b) => (a.date || '').localeCompare(b.date || '')), [photos.items, cat]);

  function add(url) { photos.add({ category: cat, image: url, date: today() }); }

  return (
    <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {PHOTO_CATS.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
            background: cat === c ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: cat === c ? '#fff' : 'rgba(255,255,255,0.45)' }}>{c}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => setCompare(v => !v)} style={{ ...BTN_GHOST, color: compare ? 'var(--accent)' : 'rgba(255,255,255,0.5)' }}>
          {compare ? 'Timeline' : 'Before / After'}
        </button>
        <PhotoInput onPhoto={add} label="+ Add photo" />
      </div>

      {catPhotos.length === 0 ? (
        <EmptyState>No {cat.toLowerCase()} photos yet. Add your first to start a timeline.</EmptyState>
      ) : compare ? (
        <GlassCard>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[catPhotos[0], catPhotos[catPhotos.length - 1]].map((p, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ ...FIELD_LABEL, textAlign: 'center' }}>{i === 0 ? 'BEFORE · ' + p.date : 'NOW · ' + p.date}</div>
                <img src={p.image} alt="" style={{ width: '100%', borderRadius: 12, aspectRatio: '3/4', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </GlassCard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {catPhotos.map((p, i) => (
            <div key={p.id || i} style={{ position: 'relative' }}>
              <img src={p.image} alt="" style={{ width: '100%', borderRadius: 12, aspectRatio: '3/4', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 10, color: '#fff', textShadow: '0 1px 4px #000', fontFamily: 'ui-monospace,monospace' }}>{p.date}</div>
              <button onClick={() => photos.remove(p.id)} style={{ position: 'absolute', top: 6, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', color: '#fff', fontSize: 13 }}>&#215;</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 12. EXPERIMENT LAB
// ═══════════════════════════════════════════════════════════════════════════════

function ExperimentLab({ experiments }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ goal: '', hypothesis: '', change: '', startDate: today(), endDate: '', results: '', verdict: '' });
  const sorted = [...experiments.items].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

  function add() {
    if (!form.goal.trim()) return;
    experiments.add({ ...form });
    setForm({ goal: '', hypothesis: '', change: '', startDate: today(), endDate: '', results: '', verdict: '' });
    setShow(false);
  }

  return (
    <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: MUTE }}>Run controlled self-improvement experiments — one change at a time.</div>
        <button style={BTN} onClick={() => setShow(v => !v)}>+ New experiment</button>
      </div>

      {show && (
        <GlassCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div><div style={FIELD_LABEL}>Goal</div><input value={form.goal} onChange={e => setForm(p => ({ ...p, goal: e.target.value }))} placeholder="Clearer skin in 30 days" style={INPUT} /></div>
            <div><div style={FIELD_LABEL}>Hypothesis</div><textarea value={form.hypothesis} onChange={e => setForm(p => ({ ...p, hypothesis: e.target.value }))} placeholder="Adding azelaic acid will reduce redness" style={{ ...TEXTAREA, minHeight: 50 }} /></div>
            <div><div style={FIELD_LABEL}>Change implemented</div><textarea value={form.change} onChange={e => setForm(p => ({ ...p, change: e.target.value }))} style={{ ...TEXTAREA, minHeight: 50 }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><div style={FIELD_LABEL}>Start date</div><input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} style={INPUT} /></div>
              <div><div style={FIELD_LABEL}>End date</div><input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} style={INPUT} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={BTN_GHOST} onClick={() => setShow(false)}>Cancel</button>
              <button style={BTN} onClick={add}>Start experiment</button>
            </div>
          </div>
        </GlassCard>
      )}

      {sorted.length === 0 ? <EmptyState>No experiments yet. Test one change at a time and measure the result.</EmptyState> : sorted.map((e, i) => (
        <ExperimentCard key={e.id || i} exp={e} onUpdate={experiments.update} onRemove={experiments.remove} />
      ))}
    </div>
  );
}

function ExperimentCard({ exp, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [results, setResults] = useState(exp.results || '');
  const [verdict, setVerdict] = useState(exp.verdict || '');
  const active = !exp.verdict;

  return (
    <GlassCard style={{ borderLeft: `3px solid ${active ? '#f4a642' : '#6BE3A4'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Tag label={active ? 'ACTIVE' : 'COMPLETE'} colour={active ? '#f4a642' : '#6BE3A4'} />
            <span style={{ fontSize: 10.5, color: MUTE, fontFamily: 'ui-monospace,monospace' }}>{exp.startDate}{exp.endDate ? ' → ' + exp.endDate : ''}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{exp.goal}</div>
          {exp.hypothesis && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}><strong>Hypothesis:</strong> {exp.hypothesis}</div>}
          {exp.change && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}><strong>Change:</strong> {exp.change}</div>}
          {exp.results && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}><strong>Results:</strong> {exp.results}</div>}
          {exp.verdict && <div style={{ fontSize: 12, color: '#6BE3A4', marginTop: 4 }}><strong>Verdict:</strong> {exp.verdict}</div>}
        </div>
        <button onClick={() => onRemove(exp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', fontSize: 16 }}>&#215;</button>
      </div>
      {active && (editing ? (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea value={results} onChange={e => setResults(e.target.value)} placeholder="What were the results?" style={{ ...TEXTAREA, minHeight: 50 }} />
          <input value={verdict} onChange={e => setVerdict(e.target.value)} placeholder="Verdict — keep, drop, or iterate?" style={INPUT} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={BTN_GHOST} onClick={() => setEditing(false)}>Cancel</button>
            <button style={BTN} onClick={() => { onUpdate(exp.id, { results, verdict, endDate: exp.endDate || today() }); setEditing(false); }}>Save & close</button>
          </div>
        </div>
      ) : (
        <button style={{ ...BTN_GHOST, marginTop: 10 }} onClick={() => setEditing(true)}>Record results →</button>
      ))}
    </GlassCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 13. DAILY TRACKER
// ═══════════════════════════════════════════════════════════════════════════════

const DAILY_GROUPS = [
  { group: 'Morning', items: ['Water', 'Skincare', 'Sunscreen', 'Hygiene'] },
  { group: 'Fitness', items: ['Workout', 'Cardio', 'Stretching', 'Step goal'] },
  { group: 'Nutrition', items: ['Hit calories', 'Hit protein', 'Hydrated'] },
  { group: 'Evening', items: ['Evening skincare', 'Teeth', 'Floss', 'Sleep on time'] },
];
const ALL_DAILY_ITEMS = DAILY_GROUPS.flatMap(g => g.items);

function DailyTracker({ daily }) {
  const todayLog = useMemo(() => daily.items.find(d => d.date === today()), [daily.items]);
  const checked = todayLog?.items || {};

  function toggle(item) {
    const next = { ...checked, [item]: !checked[item] };
    const pct = Math.round(Object.values(next).filter(Boolean).length / ALL_DAILY_ITEMS.length * 100);
    if (todayLog) daily.update(todayLog.id, { items: next, pct });
    else daily.add({ date: today(), items: next, pct });
  }

  const todayPct = todayLog?.pct || 0;
  // streak: consecutive days (ending today/yesterday) with pct >= 80
  const streak = useMemo(() => {
    const byDate = Object.fromEntries(daily.items.map(d => [d.date, d.pct || 0]));
    let s = 0; const d = new Date();
    for (;;) {
      const key = toLocalDateKey(d);
      if ((byDate[key] || 0) >= 80) { s++; d.setDate(d.getDate() - 1); }
      else if (key === today() && s === 0) { d.setDate(d.getDate() - 1); } // allow today incomplete
      else break;
    }
    return s;
  }, [daily.items]);

  const month = daily.items.filter(d => d.date >= today().slice(0, 7) + '-01');
  const monthConsistency = month.length ? Math.round(month.reduce((s, d) => s + (d.pct || 0), 0) / month.length) : 0;

  return (
    <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 14, alignItems: 'center' }}>
        <GlassCard style={{ display: 'flex', justifyContent: 'center', padding: 18 }}>
          <RingChart value={todayPct} max={100} size={110} thickness={9} label={`${todayPct}%`} sublabel="TODAY" />
        </GlassCard>
        <GlassCard style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 300, color: '#f4a642' }}>{streak}🔥</div>
          <div style={{ fontSize: 10, color: MUTE, letterSpacing: '0.08em' }}>DAY STREAK (≥80%)</div>
        </GlassCard>
        <GlassCard style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 300, color: '#6BE3A4' }}>{monthConsistency}%</div>
          <div style={{ fontSize: 10, color: MUTE, letterSpacing: '0.08em' }}>MONTH CONSISTENCY</div>
        </GlassCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {DAILY_GROUPS.map(g => (
          <GlassCard key={g.group}>
            <SectionLabel>{g.group}</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {g.items.map(item => {
                const on = !!checked[item];
                return (
                  <button key={item} onClick={() => toggle(item)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 9, cursor: 'pointer',
                    border: 'none', background: on ? 'rgba(107,227,164,0.08)' : 'rgba(255,255,255,0.03)', textAlign: 'left' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 6, flexShrink: 0,
                      border: `1.5px solid ${on ? '#6BE3A4' : 'rgba(255,255,255,0.25)'}`,
                      background: on ? '#6BE3A4' : 'transparent', color: '#000', fontSize: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
                    <span style={{ fontSize: 13, color: on ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)' }}>{item}</span>
                  </button>
                );
              })}
            </div>
          </GlassCard>
        ))}
      </div>

      {daily.items.slice(-14).length > 1 && (
        <GlassCard>
          <SectionLabel>Completion — last 14 days</SectionLabel>
          <BarChart data={daily.items.slice(-14).map(d => ({ label: d.date?.slice(5), value: d.pct || 0 }))} goalLine={80} maxHeight={70} colour="#6BE3A4" />
        </GlassCard>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 14. ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

function Analytics({ data, profile }) {
  const { metrics, daily, sleep, nutrition, skin, strength, experiments, health } = data;
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);

  const daily30 = daily.slice(-30);
  const completion = daily30.length ? Math.round(daily30.reduce((s, d) => s + (d.pct || 0), 0) / daily30.length) : 0;
  const habitRates = useMemo(() => {
    const counts = {}; ALL_DAILY_ITEMS.forEach(i => counts[i] = 0);
    daily30.forEach(d => Object.entries(d.items || {}).forEach(([k, v]) => { if (v && counts[k] != null) counts[k]++; }));
    return ALL_DAILY_ITEMS.map(i => ({ label: i, value: daily30.length ? Math.round(counts[i] / daily30.length * 100) : 0 })).sort((a, b) => b.value - a.value);
  }, [daily30]);

  // simple correlation: sleep duration vs next-not-applicable; show avg metrics velocity
  const weightVelocity = (() => {
    if (metrics.length < 2) return null;
    const first = metrics[0], last = metrics[metrics.length - 1];
    if (first.weight == null || last.weight == null) return null;
    return (Number(last.weight) - Number(first.weight)).toFixed(1);
  })();

  async function genReview() {
    setLoading(true); setReview('');
    try {
      const ctx = buildCoachContext({ profile, metrics, daily, sleep, nutrition, skin, strength, experiments, health });
      const prompt = `You are generating the user's MONTHLY LOOKSMAXXING REVIEW based on their tracker data. Produce these sections with short bullet points:
1. WINS — biggest improvements this period
2. LOSSES — where they slipped or stalled
3. BIGGEST IMPROVEMENT — the single standout
4. HIGHEST-ROI HABITS — which tracked habits seem to drive the most progress
5. SMART INSIGHTS — 2-3 data-grounded observations (e.g. correlations between sleep, consistency and scores)
6. RECOMMENDED NEXT FOCUS — the one thing to prioritise next month
Be specific and reference their actual numbers. If data is thin, say what they must track next month.

${ctx}`;
      const reply = await askClaudeRaw('Generate my monthly review now.', prompt);
      setReview(reply);
    } catch (err) { setReview(`Error: ${err.message}`); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          ['30-day consistency', completion + '%', '#6BE3A4'],
          ['Body logs', metrics.length, 'var(--accent)'],
          ['Weight Δ', weightVelocity != null ? weightVelocity : '—', '#4a9eff'],
          ['Experiments', experiments.length, '#f4a642'],
        ].map(([label, val, col]) => (
          <GlassCard key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 300, color: col }}>{val}</div>
            <div style={{ fontSize: 9.5, color: MUTE, letterSpacing: '0.06em' }}>{label.toUpperCase()}</div>
          </GlassCard>
        ))}
      </div>

      <GlassCard>
        <SectionLabel>Habit Completion Rates — last 30 days</SectionLabel>
        {habitRates.some(h => h.value > 0) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {habitRates.map(h => (
              <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', width: 120, flexShrink: 0 }}>{h.label}</span>
                <div style={{ flex: 1 }}><ProgressBar value={h.value} max={100} colour={h.value >= 70 ? '#6BE3A4' : h.value >= 40 ? '#f4a642' : '#e55a5a'} /></div>
                <span style={{ fontSize: 11, fontFamily: 'ui-monospace,monospace', color: MUTE, width: 38, textAlign: 'right' }}>{h.value}%</span>
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 12, color: MUTE, padding: '20px 0', textAlign: 'center' }}>Use the Daily tab to start building habit data.</div>}
      </GlassCard>

      <GlassCard>
        <SectionLabel right={<button style={{ ...BTN, padding: '6px 14px', fontSize: 12 }} onClick={genReview} disabled={loading}>{loading ? 'Generating…' : 'Generate AI Monthly Review'}</button>}>
          AI Monthly Review
        </SectionLabel>
        {loading ? <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Spinner /><span style={{ fontSize: 12, color: MUTE }}>Analysing your data…</span></div>
          : review ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{review}</div>
          : <div style={{ fontSize: 12, color: MUTE }}>Generate a data-grounded review of your wins, losses, highest-ROI habits and recommended next focus.</div>}
      </GlassCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN LM TAB
// ═══════════════════════════════════════════════════════════════════════════════

const LM_TABS = [
  { id: 'dashboard',   label: 'DASHBOARD'   },
  { id: 'baseline',    label: 'BASELINE'    },
  { id: 'foundation',  label: 'FOUNDATION'  },
  { id: 'physique',    label: 'PHYSIQUE'    },
  { id: 'skin',        label: 'SKIN'        },
  { id: 'hair',        label: 'HAIR'        },
  { id: 'grooming',    label: 'GROOMING'    },
  { id: 'style',       label: 'STYLE'       },
  { id: 'posture',     label: 'POSTURE'     },
  { id: 'social',      label: 'SOCIAL'      },
  { id: 'photos',      label: 'PHOTOS'      },
  { id: 'experiments', label: 'LAB'         },
  { id: 'daily',       label: 'DAILY'       },
  { id: 'analytics',   label: 'ANALYTICS'   },
  { id: 'coach',       label: 'COACH'       },
];

export default function LM() {
  const [section, setSection] = useState('dashboard');

  // Single config/assessment document
  const profileDoc = useDocument('lm_profile', 'valerie_lm_profile', {});
  const profile = profileDoc.data || {};
  const saveProfile = (d) => profileDoc.save(d);

  // Collections
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

  // Canonical Health-tab data (weight, body fat, sleep, nutrition — auto-synced incl.
  // Apple Health). Read-only; lets LM correspond instantly with Health instead of re-logging.
  const health = useHealthData();

  // Workout-tab lifts (read-only) so LM strength corresponds with real overload data.
  const workouts = useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS);

  // Aggregated data for AI + analytics
  const aiData = {
    profile, metrics: metrics.items, daily: daily.items, sleep: sleep.items,
    nutrition: nutrition.items, skin: skin.items, strength: strength.items, experiments: experiments.items,
    health,
  };

  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [section]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ padding: '18px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 300, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.01em' }}>Looksmaxxing</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace', letterSpacing: '0.06em' }}>
            APPEARANCE OPERATING SYSTEM
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid rgba(255,255,255,0.07)', overflowX: 'auto' }}>
          {LM_TABS.map(t => (
            <button key={t.id} onClick={() => setSection(t.id)} style={{
              padding: '7px 14px 9px', border: 'none', cursor: 'pointer', background: 'transparent', whiteSpace: 'nowrap',
              color: section === t.id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'ui-monospace,monospace',
              borderBottom: section === t.id ? '1.5px solid var(--accent)' : '1.5px solid transparent',
              marginBottom: -0.5, transition: 'all 0.15s ease' }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: section === 'coach' ? 'hidden' : 'auto' }}>
        {section === 'dashboard'   && <Dashboard profile={profile} saveProfile={saveProfile} metrics={metrics.items} daily={daily.items} data={aiData} goTo={setSection} health={health} />}
        {section === 'baseline'    && <Baseline profile={profile} saveProfile={saveProfile} />}
        {section === 'foundation'  && <Foundation profile={profile} saveProfile={saveProfile} sleep={sleep} nutrition={nutrition} health={health} />}
        {section === 'physique'    && <Physique profile={profile} saveProfile={saveProfile} metrics={metrics} strength={strength} health={health} workouts={workouts.items} />}
        {section === 'skin'        && <SkinMaxxing profile={profile} saveProfile={saveProfile} skin={skin} daily={daily} />}
        {section === 'hair'        && <HairMaxxing profile={profile} saveProfile={saveProfile} haircuts={haircuts} products={products} />}
        {section === 'grooming'    && <Grooming profile={profile} saveProfile={saveProfile} fragrances={fragrances} />}
        {section === 'style'       && <StyleMaxxing profile={profile} saveProfile={saveProfile} wardrobe={wardrobe} outfits={outfits} />}
        {section === 'posture'     && <PostureMaxxing profile={profile} saveProfile={saveProfile} postureLogs={postureLogs} />}
        {section === 'social'      && <SocialMaxxing social={social} profile={profile} saveProfile={saveProfile} />}
        {section === 'photos'      && <PhotoVault photos={photos} />}
        {section === 'experiments' && <ExperimentLab experiments={experiments} />}
        {section === 'daily'       && <DailyTracker daily={daily} />}
        {section === 'analytics'   && <Analytics data={aiData} profile={profile} />}
        {section === 'coach'       && <CoachChat data={aiData} />}
      </div>

      <style>{`
        @keyframes lmBounce {
          0%, 100% { transform: translateY(0);   opacity: 0.4; }
          50%       { transform: translateY(-4px); opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
