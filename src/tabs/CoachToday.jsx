// CoachToday — the Coach group's front page: how today is going against your goal, what
// to do next, today's session, fuel and water with one-tap logging, recovery, your weight
// trend, habits, and what the coach changed. Rules: domain/coachToday.js and the domains
// the existing Coach screens already use.
import { useMemo, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument } from '../supabase/useDocument.js';
import { useNextMoves } from '../hooks/useNextMoves.js';
import { useRecovery } from '../hooks/useRecovery.js';
import { useDayScore } from '../hooks/useDayScore.js';
import { useRecap } from '../hooks/useRecap.js';
import { useSettingsValue } from '../hooks/useSettingsValue.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { todaysTargets } from '../utils/todaysTargets.js';
import { currentWaterGoal } from '../utils/waterGoal.js';
import { GOAL_TEMPLATES } from '../domain/goals.js';
import { weightCoach } from '../domain/weight.js';
import { toggleDay, isDone, currentStreak } from '../domain/habits.js';
import { quickEntry, appendMeals } from '../domain/foods.js';
import { eatenToday, macroBars, waterBar, goalWeek, sessionToday } from '../domain/coachToday.js';
import { weekdayKey } from '../domain/plan.js';
import { groupOf } from '../nav/groups.js';
import CoachUpdates from '../components/CoachUpdates.jsx';
import GoalEta from '../components/GoalEta.jsx';
import WeightChart from '../components/WeightChart.jsx';
import StreakCard from '../components/StreakCard.jsx';
import LogCalendar from "../components/LogCalendar.jsx";
import RecapCard from '../components/RecapCard.jsx';
import StepsCard from '../components/StepsCard.jsx';
import { label } from '../components/ui.js';

const CARD = { padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 };
const STATE_COLOUR = { under: 'var(--tab-accent)', on: '#4caf7d', over: '#e8a13a' };
const toast = (detail) => window.dispatchEvent(new CustomEvent('valerie:toast', { detail }));
const clock = () => { const n = new Date(); return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const field = { height: 36, padding: '0 10px', borderRadius: 9, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-mono)', minWidth: 0, width: 96 };
const btn = { height: 36, padding: '0 14px', borderRadius: 9, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const primary = { ...btn, background: 'var(--tab-accent)', color: 'var(--on-tab-accent)', border: 'none' };
const linkBtn = { background: 'none', border: 'none', color: 'var(--tab-accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 4, fontFamily: 'inherit' };

function Bar({ pct, colour, height = 6 }) {
  return (
    <span aria-hidden="true" style={{ display: 'block', height, borderRadius: 999, background: 'var(--hover-bg)', overflow: 'hidden' }}>
      <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: colour, borderRadius: 999, transition: 'width 400ms ease' }} />
    </span>
  );
}

function ScoreRing({ score, size = 76 }) {
  const R = 32, C = 2 * Math.PI * R;
  return (
    <span style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} role="img" aria-label={`Today ${score} out of 100`}>
      <svg width={size} height={size} viewBox="0 0 76 76" aria-hidden="true">
        <circle cx="38" cy="38" r={R} fill="none" stroke="var(--card-border)" strokeWidth="6" />
        <circle cx="38" cy="38" r={R} fill="none" stroke="var(--tab-accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} transform="rotate(-90 38 38)" />
      </svg>
      <span className="val-num" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>{score}</span>
    </span>
  );
}

export default function CoachToday({ onTabChange, compact = false }) {
  const today = toLocalDateKey(new Date());
  const settings = useSettingsValue();
  const goal = settings.coachGoal;
  const go = (screen) => onTabChange?.(screen);

  const score = useDayScore(settings);
  const moves = useNextMoves();
  const recovery = useRecovery();
  const { streak, recap, data: trackedData } = useRecap();

  const nutrition = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);
  const water = useCollection('water_logs', STORAGE_KEYS.WATER);
  const workouts = useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS);
  const programs = useCollection('programs', STORAGE_KEYS.PROGRAMS);
  const body = useCollection('body_metrics', STORAGE_KEYS.BODY);
  const habits = useCollection('habits', STORAGE_KEYS.HABITS);
  useDocument('lm_profile', 'valerie_lm_profile', {}); // keeps the skin routine in step for Next moves

  const [kcal, setKcal] = useState('');
  const [error, setError] = useState('');

  const targets = useMemo(() => (goal ? { ...goal.targets, ...todaysTargets(settings, new Date()) } : null), [goal, settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const eaten = useMemo(() => eatenToday(nutrition.items, today), [nutrition.items, today]);
  const bars = useMemo(() => macroBars(targets, eaten), [targets, eaten]);
  const waterToday = useMemo(() => (water.items || []).filter(w => w.date === today).reduce((s, w) => s + (Number(w.amount) || 0), 0), [water.items, today]);
  const wBar = waterBar(waterToday, currentWaterGoal(settings));
  const program = useMemo(() => (programs.items || []).find(p => p?.isActive) || null, [programs.items]);
  const session = sessionToday({ program, weekdayKey: weekdayKey(today), workouts: workouts.items, today });
  const weight = useMemo(() => weightCoach(body.items || [], goal?.targets?.weeklyRateKg ?? null, goal?.targetWeightKg ?? null, today), [body.items, goal, today]);
  const coachMoves = useMemo(() => (moves || []).filter(m => groupOf(m.tab)?.id === 'coach').slice(0, 4), [moves]);
  const week = goal ? goalWeek(goal.startedOn, today) : null;
  const habitList = habits.items || [];

  async function logWater(ml) {
    const id = await water.add({ date: today, amount: ml, time: clock() });
    if (!id) { setError('Could not save. Are you signed in?'); return; }
    setError('');
    toast({ message: `Logged ${ml} ml of water`, type: 'success', undo: () => water.remove(id) });
  }

  async function logFood() {
    const entry = quickEntry({ calories: kcal });
    if (!entry) { setError('Enter calories between 1 and 10,000.'); return; }
    const existing = (nutrition.items || []).find(l => l.date === today);
    const prev = existing ? { meals: existing.meals || [], calories: existing.calories || 0, protein: existing.protein || 0, carbs: existing.carbs || 0, fat: existing.fat || 0 } : null;
    const row = appendMeals(existing, [entry], today);
    const fields = { meals: row.meals, calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat };
    const id = existing ? ((await nutrition.update(existing.id, fields)) ? existing.id : null) : await nutrition.add({ date: today, ...fields });
    if (!id) { setError('Could not save. Are you signed in?'); return; }
    setError(''); setKcal('');
    toast({ message: `Added ${entry.calories} kcal`, type: 'success', undo: () => (existing ? nutrition.update(existing.id, prev) : nutrition.remove(id)) });
  }

  async function tick(h) {
    try { await habits.update(h.id, toggleDay(h, today)); } catch { /* useCollection raises the error toast */ }
  }

  const pad = compact ? '12px 14px 28px' : '20px 28px 40px';
  return (
    <div style={{ padding: pad, display: 'flex', flexDirection: 'column', gap: 16, width: '100%', boxSizing: 'border-box', overflowY: 'auto', height: '100%' }}>
      <section aria-label="Goal" style={{ ...CARD, flexDirection: 'row', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        {goal && score ? <ScoreRing score={score.score} /> : null}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={label}>{goal ? `${GOAL_TEMPLATES[goal.template]?.label ?? goal.template}${week ? ` · week ${week}` : ''}` : 'Coach'}</div>
          <h1 style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)', fontSize: compact ? 22 : 28, fontWeight: 600, letterSpacing: '0.03em', color: 'var(--text-primary)' }}>
            {goal ? (score ? (score.score >= 80 ? 'Strong day so far' : score.score >= 40 ? 'Day in progress' : 'Day just starting') : 'Today') : 'Pick a goal'}
          </h1>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
            {goal ? (weight ? `Trend ${weight.trend} kg${weight.rate != null ? ` · ${weight.rate > 0 ? '+' : ''}${weight.rate.toFixed(2)} kg/week` : ''}` : 'Log a weigh-in to start your trend.') : 'One goal and Coach plans your targets, sessions and food around it.'}
          </div>
        </div>
        {!goal && <button type="button" style={primary} onClick={() => go('goal')}>Set your goal</button>}
        {goal && <button type="button" style={btn} onClick={() => go('goal')}>Goal HQ</button>}
      </section>

      <div className="plan-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section aria-label="Do next" style={CARD}>
            <div style={label}>Do next</div>
            {coachMoves.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Nothing urgent. Log as you go and this fills in.</div>}
            {coachMoves.map((m, i) => (
              <button key={m.id} type="button" onClick={() => go(m.tab)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: i ? '0.5px solid var(--card-border)' : 'none' }}>
                <span className="val-num" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: i === 0 ? 'var(--tab-accent)' : 'var(--hover-bg)', color: i === 0 ? 'var(--on-tab-accent)' : 'var(--text-secondary)' }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, color: 'var(--text-primary)', fontWeight: 600 }}>{m.title}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{m.why}</span>
                </span>
                <span aria-hidden="true" style={{ color: 'var(--text-secondary)' }}>›</span>
              </button>
            ))}
          </section>

          <section aria-label="Training" style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={label}>Training</div>
              <button type="button" onClick={() => go('workout')} style={linkBtn}>Open Train</button>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
              {session.done ? `Logged · ${plural(session.exercises, 'exercise')}` : session.planned ? `Today: ${session.label}` : session.hasProgram ? 'Rest day' : 'No program set'}
            </div>
            {recovery.status === 'ok' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Readiness</span>
                  <span className="val-num" style={{ color: 'var(--text-primary)' }}>{recovery.score} · {recovery.label}</span>
                </div>
                <Bar pct={recovery.score} colour={recovery.score >= 75 ? '#4caf7d' : recovery.score >= 50 ? 'var(--tab-accent)' : '#e8a13a'} />
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{recovery.advice}</div>
              </div>
            )}
            {recovery.status !== 'ok' && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Log your sleep on Recover and Coach reads your readiness before you lift.</div>}
          </section>

          <section aria-label="Fuel" style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={label}>Fuel{targets && todaysTargets(settings).kind ? ` · ${todaysTargets(settings).kind} day` : ''}</div>
              <button type="button" onClick={() => go('fuel')} style={linkBtn}>Open Fuel</button>
            </div>
            {bars.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Set a goal and today's calories and macros appear here.</div>}
            {bars.map(b => (
              <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{b.label}</span>
                  <span className="val-num" style={{ color: 'var(--text-primary)' }}>{b.have.toLocaleString()} / {b.want.toLocaleString()} {b.unit}
                    <span style={{ color: b.state === 'over' ? '#e8a13a' : 'var(--text-secondary)' }}>{b.over > 0 ? `  +${b.over} over` : `  ${b.left.toLocaleString()} left`}</span>
                  </span>
                </div>
                <Bar pct={b.pct} colour={STATE_COLOUR[b.state]} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
              <input aria-label="Calories to add" inputMode="numeric" placeholder="kcal" value={kcal} onChange={e => setKcal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') logFood(); }} style={field} />
              <button type="button" style={primary} onClick={logFood}>Quick add</button>
              <button type="button" style={btn} onClick={() => go('fuel')}>Log food</button>
            </div>
          </section>

          <section aria-label="Water" style={CARD}>
            <div style={label}>Water</div>
            {wBar ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                  <span className="val-num" style={{ color: 'var(--text-primary)' }}>{(wBar.have / 1000).toFixed(2)} / {(wBar.want / 1000).toFixed(1)} L</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{wBar.left > 0 ? `${wBar.left} ml to go` : 'Goal reached'}</span>
                </div>
                <Bar pct={wBar.pct} colour="#6FA8F2" />
              </>
            ) : <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Set your weight in Settings or Goal HQ to get a daily water goal.</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[250, 500, 750].map(ml => <button key={ml} type="button" style={btn} onClick={() => logWater(ml)}>+{ml} ml</button>)}
            </div>
            {error && <div role="alert" style={{ fontSize: 12.5, color: '#e55a5a' }}>{error}</div>}
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <CoachUpdates compact />

          <section aria-label="Body" style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={label}>Weight trend</div>
              <button type="button" onClick={() => go('body')} style={linkBtn}>Open Body</button>
            </div>
            {weight && weight.series.length >= 2 ? <WeightChart series={weight.series} days={45} /> : <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Two or more weigh-ins draw your trend.</div>}
            {weight?.pace && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{weight.pace.text || weight.pace.message || ''}</div>}
            {goal?.targetWeightKg && weight ? <GoalEta eta={weight.eta} targetKg={goal.targetWeightKg} /> : null}
          </section>

          <section aria-label="Habits" style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={label}>Habits · {habitList.filter(h => isDone(h, today)).length}/{habitList.length}</div>
              <button type="button" onClick={() => go('habits')} style={linkBtn}>Open Habits</button>
            </div>
            {habitList.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>No habits yet. Add a couple and tick them here each day.</div>}
            {habitList.slice(0, 6).map(h => {
              const done = isDone(h, today);
              return (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button type="button" onClick={() => tick(h)} aria-pressed={done} aria-label={`${done ? 'Untick' : 'Tick'} ${h.name}`}
                    style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${done ? 'var(--tab-accent)' : 'var(--text-secondary)'}`, background: done ? 'var(--tab-accent)' : 'transparent', color: 'var(--on-tab-accent)' }}>
                    {done && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                  </button>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, color: 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                  <span className="val-num" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{currentStreak(h, today)}d</span>
                </div>
              );
            })}
          </section>

          <StepsCard />
          <StreakCard streak={streak} compact />
          <LogCalendar data={trackedData} compact />
          {recap && <RecapCard recap={recap} compact />}
        </div>
      </div>
    </div>
  );
}
