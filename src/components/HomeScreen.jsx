// HomeScreen — the Home tab for a gym and looks app. Short on purpose: by default calories and
// protein left, weight and goal progress, streak, skin routine, water, sleep and readiness.
// Everything else (today's workout, next moves, steps, coach updates, recap, overall rating) is
// off until you turn it on under Customise. One component serves the phone and the desktop.
// Rules: domain/homeLayout.js.
import Avatar from './Avatar.jsx';
import { useMemo, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument } from '../supabase/useDocument.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { getGreeting } from '../utils/time.js';
import { updateSettings } from '../utils/settingsStore.js';
import { todaysTargets } from '../utils/todaysTargets.js';
import { currentWaterGoal } from '../utils/waterGoal.js';
import { progressTiles } from '../domain/checkin.js';
import { weightCoach } from '../domain/weight.js';
import { stepsFor, completion } from '../domain/skin.js';
import { WEEK, dayKeyFromDate, dayExercises, isRest } from '../domain/splits.js';
import { HOME_SECTIONS, layoutRows, cleanHome, setSection, moveSection, calorieStatus, waterStatus, weightStatus } from '../domain/homeLayout.js';
import { label } from './ui.js';
import ReadinessCard from './ReadinessCard.jsx';
import NextMoves from './NextMoves.jsx';
import CoachUpdates from './CoachUpdates.jsx';
import OverallCard from './OverallCard.jsx';
import StepsCard from './StepsCard.jsx';
import MetricsCard from './MetricsCard.jsx';
import { HomeRecap, HomeStreak } from './HomeRecap.jsx';
import { AnimatedNumber, Collapse, ProgressBar } from './Motion.jsx';

// Cards, buttons, bars and numbers come from the design system (styles/system.css, Motion.jsx).
const card = (compact) => ({ padding: compact ? 16 : 20, display: 'flex', flexDirection: 'column', gap: 10 });
const big = { fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em' };
const small = { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 };
const btn = (primary) => `ui-btn is-sm${primary ? ' is-primary' : ''}`;

function Bar({ pct, colour }) {
  return <ProgressBar value={pct} color={colour} height={6} />;
}

function Calories({ settings, compact }) {
  const { items: nutrition = [] } = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);
  const today = toLocalDateKey(new Date());
  const row = nutrition.find(l => l.date === today);
  const hasTargets = !!(settings?.coachGoal || settings?.macroGoal || settings?.macros);
  const s = hasTargets ? calorieStatus(todaysTargets(settings, new Date()), { calories: row?.calories, protein: row?.protein }) : null;
  if (!s) return (
    <section aria-label="Calories" className="ui-card" style={card(compact)}>
      <div style={label}>Calories and protein</div>
      <div style={small}>Set a goal and your daily calories and protein show here. Open Progress &gt; Goal.</div>
    </section>
  );
  return (
    <section aria-label="Calories and protein left" className="ui-card" style={card(compact)}>
      <div style={label}>Left today</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ ...big, fontSize: 40 }}>{s.kcal.over ? '+' : ''}<AnimatedNumber value={s.kcal.over ? s.kcal.over : s.kcal.left} /></span>
        <span style={small}>{s.kcal.over ? 'kcal over' : 'kcal left'} · {s.kcal.eaten} of {s.kcal.target}</span>
      </div>
      <Bar pct={s.kcal.pct} colour={s.kcal.over ? '#e8a13a' : 'var(--tab-accent, var(--accent))'} />
      {s.protein && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...small }}><span>Protein</span><span className="val-num">{s.protein.eaten} of {s.protein.target} g{s.protein.left ? ` · ${s.protein.left} g left` : ' · done'}</span></div>
          <Bar pct={s.protein.pct} colour="#e879a0" />
        </>
      )}
    </section>
  );
}

function Weight({ settings, compact, go }) {
  const { items: body = [] } = useCollection('body_metrics', STORAGE_KEYS.BODY);
  const goal = settings?.coachGoal;
  const today = toLocalDateKey(new Date());
  const tiles = useMemo(() => progressTiles(body, goal, today), [body, goal, today]);
  const coach = useMemo(() => weightCoach(body, goal?.targets?.weeklyRateKg ?? null, goal?.targetWeightKg ?? null, today), [body, goal, today]);
  const w = weightStatus(tiles, coach, goal);
  return (
    <section aria-label="Weight and goal progress" className="ui-card" style={card(compact)}>
      <div style={label}>Weight</div>
      {!w ? (
        <>
          <div style={small}>No weigh-in yet. Your first one starts the trend and the goal date.</div>
          <div><button type="button" onClick={() => go('goal')} className={btn(false)}>Do a check-in</button></div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ ...big, fontSize: 34 }}><AnimatedNumber value={Number(w.latest) || 0} format={n => n.toFixed(1)} /><span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}> kg</span></span>
            {w.changeKg !== 0 && <span style={{ ...small, color: w.changeKg < 0 ? '#4caf7d' : '#e8a13a' }}>{w.changeKg > 0 ? '+' : ''}{w.changeKg} kg since you started</span>}
          </div>
          <div style={small}>
            {w.toGoKg != null ? (Math.abs(w.toGoKg) < 0.3 ? 'At your goal weight.' : `${Math.abs(w.toGoKg)} kg ${w.toGoKg < 0 ? 'to lose' : 'to gain'} to reach ${w.target} kg.`) : 'Add a goal weight in Progress > Goal to see how far to go.'}
            {w.ratePerWeek != null ? ` Trend ${w.ratePerWeek > 0 ? '+' : ''}${w.ratePerWeek} kg a week.` : ''}
          </div>
          {w.paceMessage && <div style={small}>{w.paceMessage}</div>}
        </>
      )}
    </section>
  );
}

function Skin({ compact, go }) {
  const profile = useDocument('lm_profile', 'valerie_lm_profile', {});
  const daily = useCollection('lm_daily', 'valerie_lm_daily');
  const steps = Array.isArray(profile.data?.skinSteps) ? profile.data.skinSteps : [];
  const today = toLocalDateKey(new Date());
  const weekday = new Date().getDay();
  const row = daily.items.find(d => d.date === today);
  const ticks = row?.skin ?? {};
  if (!steps.length) return (
    <section aria-label="Skin routine" className="ui-card" style={card(compact)}>
      <div style={label}>Skin routine</div>
      <div style={small}>No routine yet. Build one in Look &gt; Skin, or import your guide in Progress &gt; Goal.</div>
      <div><button type="button" onClick={() => go('lm')} className={btn(false)}>Open Look</button></div>
    </section>
  );
  const toggle = async (period, id) => {
    const next = { ...ticks, [period]: { ...(ticks[period] || {}), [id]: !(ticks[period] || {})[id] } };
    if (row) await daily.update(row.id, { skin: next });
    else await daily.add({ date: today, items: {}, pct: 0, skin: next });
  };
  const hour = new Date().getHours();
  const period = hour >= 15 ? 'pm' : 'am';              // mornings show morning steps, afternoons show night steps
  const list = stepsFor(steps, period, weekday);
  const c = completion(steps, ticks[period] || {}, period, weekday);
  return (
    <section aria-label="Skin routine" className="ui-card" style={card(compact)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={label}>Skin · {period === 'am' ? 'morning' : 'night'}</div>
        <span className="val-num" style={small}>{c.done}/{c.total}</span>
      </div>
      {list.length === 0 && <div style={small}>Nothing scheduled for {period === 'am' ? 'this morning' : 'tonight'}.</div>}
      {list.map(s => {
        const on = !!(ticks[period] || {})[s.id];
        return (
          <button key={s.id} type="button" aria-pressed={on} onClick={() => toggle(period, s.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: on ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
            <span aria-hidden="true" className={`ui-check${on ? ' is-on ui-confirm' : ''}`} style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, border: `1.5px solid ${on ? 'transparent' : 'var(--card-hover-border)'}`, background: on ? 'var(--tab-accent, var(--accent))' : 'transparent', color: 'var(--on-tab-accent, var(--bg-base))', transition: 'background-color var(--dur-1) var(--ease-out), border-color var(--dur-1) var(--ease-out)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17l9-10" /></svg>
            </span>
            <span style={{ fontSize: 14.5, textDecoration: on ? 'line-through' : 'none', textDecorationColor: 'var(--text-muted)', transition: 'color var(--dur-2) var(--ease-out)' }}>{s.name}</span>
          </button>
        );
      })}
    </section>
  );
}

function Water({ settings, compact }) {
  const water = useCollection('water_logs', STORAGE_KEYS.WATER);
  const today = toLocalDateKey(new Date());
  const total = water.items.filter(l => l.date === today).reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const w = waterStatus(total, currentWaterGoal(settings));
  const add = (ml) => { const now = new Date(); water.add({ date: today, amount: ml, time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, source: 'home' }); };
  return (
    <section aria-label="Water" className="ui-card" style={card(compact)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={label}>Water</div>
        <span className="val-num" style={small}><AnimatedNumber value={w.total / 1000} format={n => n.toFixed(2)} duration={500} />{w.goal ? ` of ${(w.goal / 1000).toFixed(1)}` : ''} L</span>
      </div>
      <Bar pct={w.pct} colour={w.done ? '#4caf7d' : '#4a9eff'} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => add(250)} className={btn(false)}>+ 250 ml</button>
        <button type="button" onClick={() => add(500)} className={btn(false)}>+ 500 ml</button>
      </div>
    </section>
  );
}

function Workout({ compact, go }) {
  const { items: programs = [] } = useCollection('programs', STORAGE_KEYS.PROGRAMS);
  const { data: lib } = useDocument('overload_exercises', STORAGE_KEYS.OVERLOAD_EXERCISES, null);
  const program = programs.find(p => p.isActive);
  const day = program?.days?.[dayKeyFromDate()];
  const n = day && !isRest(day) ? dayExercises(day, Array.isArray(lib) ? lib : []).length : 0;
  return (
    <section aria-label="Today's workout" className="ui-card" style={card(compact)}>
      <div style={label}>Today</div>
      {!program ? <div style={small}>No program yet. Open Train &gt; Split Planner to set one up.</div>
        : isRest(day) ? <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Rest day</div>
        : <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{day.label || 'Workout'} <span style={{ ...small, fontWeight: 400 }}>· {n} exercises</span></div>}
      <div><button type="button" onClick={() => go('workout')} className={btn(true)}>{program && !isRest(day) ? 'Start' : 'Open Train'}</button></div>
    </section>
  );
}

function Customise({ ids, onChange }) {
  return (
    <section aria-label="Customise Home" style={card(true)}>
      <div style={label}>Customise Home</div>
      <div style={small}>Choose what Home shows and use the arrows to reorder it. This only changes Home; your data is never touched.</div>
      {ids.map((id, i) => {
        const s = HOME_SECTIONS.find(x => x.id === id);
        return (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
            <input type="checkbox" checked aria-label={`Show ${s.label}`} onChange={() => onChange(setSection(ids, id, false))} style={{ width: 20, height: 20 }} />
            <span style={{ flex: 1, fontSize: 14.5, color: 'var(--text-primary)' }}>{s.label}</span>
            <button type="button" aria-label={`Move ${s.label} up`} disabled={i === 0} onClick={() => onChange(moveSection(ids, id, -1))} className="ui-btn is-sm is-icon">↑</button>
            <button type="button" aria-label={`Move ${s.label} down`} disabled={i === ids.length - 1} onClick={() => onChange(moveSection(ids, id, 1))} className="ui-btn is-sm is-icon">↓</button>
          </div>
        );
      })}
      <div style={{ ...label, marginTop: 6 }}>Not shown</div>
      {HOME_SECTIONS.filter(s => !ids.includes(s.id)).map(s => (
        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
          <input type="checkbox" checked={false} onChange={() => onChange(setSection(ids, s.id, true))} style={{ width: 20, height: 20 }} />
          <span style={{ flex: 1 }}><span style={{ fontSize: 14.5, color: 'var(--text-primary)' }}>{s.label}</span><span style={{ ...small, display: 'block', fontSize: 12.5 }}>{s.hint}</span></span>
        </label>
      ))}
    </section>
  );
}

export default function HomeScreen({ settings, onTabChange, compact = false }) {
  const ids = cleanHome(settings?.home);
  const [editing, setEditing] = useState(false);
  const go = (t) => onTabChange?.(t);
  const save = (next) => updateSettings({ home: { ...(settings?.home || {}), sections: next } }); // keep the metrics you chose

  const sections = {
    calories: <Calories settings={settings} compact={compact} />,
    weight:   <Weight settings={settings} compact={compact} go={go} />,
    streak:   <HomeStreak compact={compact} />,
    skin:     <Skin compact={compact} go={go} />,
    water:    <Water settings={settings} compact={compact} />,
    sleep:    <ReadinessCard compact={compact} />,
    metrics:  <MetricsCard compact={compact} />,
    workout:  <Workout compact={compact} go={go} />,
    moves:    <NextMoves onTabChange={onTabChange} compact={compact} />,
    steps:    <StepsCard />,
    updates:  <CoachUpdates compact={compact} />,
    recap:    <HomeRecap compact={compact} />,
    overall:  <OverallCard compact={compact} />,
  };

  // The desktop shell clips overflow (main is overflow:hidden), so Home owns its scrolling there.
  // The phone shell scrolls the screen itself.
  const frameStyle = compact ? undefined : { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' };

  return (
    <div style={frameStyle}>
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: compact ? '8px 16px 24px' : '24px 28px 100px', display: 'flex', flexDirection: 'column', gap: 14, boxSizing: 'border-box' }}>
      <div aria-hidden="true" style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: compact ? 17 : 19, letterSpacing: '0.42em', paddingLeft: '0.42em', color: 'var(--tab-accent, var(--accent))', textTransform: 'uppercase' }}>Arete</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {settings?.profile?.avatar && <Avatar settings={settings} size={compact ? 32 : 36} />}
          <h1 style={{ margin: 0, fontSize: compact ? 17 : 19, fontWeight: 500, color: 'var(--text-secondary)' }}>{getGreeting()}{settings?.userName ? `, ${settings.userName}` : ''}</h1>
        </div>
        <button type="button" onClick={() => setEditing(e => !e)} aria-expanded={editing} className={`ui-btn is-sm${editing ? ' is-soft' : ''}`}>{editing ? 'Done' : 'Customise'}</button>
      </div>

      <Collapse open={editing}><Customise ids={ids} onChange={save} /></Collapse>

      {ids.length === 0 && !editing && (
        <div style={{ ...small, padding: 16 }}>Home is empty. Tap Customise to choose what to see here.</div>
      )}

      {/* Cards are dealt into columns (not a grid), so a short card never leaves a gap below it. A card
          that renders nothing is hidden with :empty so it adds no gap either. */}
      {layoutRows(ids, compact ? 1 : 2).map((row, r) => {
        const slot = (id) => <div key={id} className="ui-enter home-slot" style={{ '--i': ids.indexOf(id) }}>{sections[id]}</div>;
        if (row.full) return <div key={r} className="home-row">{slot(row.full)}</div>;
        return (
          <div key={r} className="home-row" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {row.cols.map((col, c) => <div key={c} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>{col.map(slot)}</div>)}
          </div>
        );
      })}
    </div>
    </div>
  );
}
