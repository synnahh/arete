//  GoalRing  Home's HUD card: today's score against the Coach goal.
//  The ring's "laurel draw" is Home's signature moment (approved board):
//  it sweeps to the score once on mount; Reduced motion skips it.
import { useMemo } from 'react';
import { useHealthData } from '../hooks/useHealthData.js';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { GOAL_TEMPLATES, dayScore } from '../domain/goals.js';
import { currentWaterGoal } from '../utils/waterGoal.js';

const R = 50;
const CIRC = 2 * Math.PI * R;

function Ticks() {
  const t = { position: 'absolute', width: 9, height: 9, borderColor: 'var(--tab-accent)', borderStyle: 'solid', borderWidth: 0 };
  return (
    <>
      <span style={{ ...t, left: 7,  top: 7,    borderLeftWidth: 1,  borderTopWidth: 1 }} />
      <span style={{ ...t, right: 7, top: 7,    borderRightWidth: 1, borderTopWidth: 1 }} />
      <span style={{ ...t, left: 7,  bottom: 7, borderLeftWidth: 1,  borderBottomWidth: 1 }} />
      <span style={{ ...t, right: 7, bottom: 7, borderRightWidth: 1, borderBottomWidth: 1 }} />
    </>
  );
}

export default function GoalRing({ settings, onTabChange, compact = false }) {
  const goal = settings?.coachGoal;
  const health = useHealthData();
  const { items: workoutLogs = [] } = useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS);
  const today = toLocalDateKey(new Date());

  const result = useMemo(() => goal && dayScore({
    targets: goal.targets,
    calories: health.todayCalories ?? 0,
    protein: health.todayProtein ?? 0,
    waterMl: health.todayWaterMl ?? 0,
    waterGoalMl: currentWaterGoal(settings),
    sleepHours: health.lastSleepHours ?? 0,
    trained: workoutLogs.some(l => l.date === today),
  }), [goal, health, settings?.waterGoal, workoutLogs, today]);

  const card = {
    position: 'relative', display: 'flex', alignItems: 'center', gap: compact ? 16 : 22,
    padding: compact ? 16 : 20, borderRadius: 16,
    background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', flexShrink: 0,
  };

  if (!goal) {
    return (
      <div style={card}>
        <Ticks />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--tab-accent)' }}>Set your goal</span>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Pick one goal in Coach and Home scores every day against it.</span>
        </div>
        <button type="button" onClick={() => onTabChange?.('goal')} style={{
          height: 40, padding: '0 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          background: 'var(--tab-accent)', color: 'var(--on-tab-accent)', fontSize: 14, fontWeight: 600,
        }}>Goal HQ</button>
      </div>
    );
  }

  const { score, factors } = result;
  const offset = CIRC * (1 - score / 100);
  const label = GOAL_TEMPLATES[goal.template]?.label ?? goal.template;
  const size = compact ? 104 : 116;

  return (
    <button type="button" onClick={() => onTabChange?.('goal')} aria-label={`Today ${score} out of 100 for your ${label} goal. Open Goal HQ`}
      style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' }}>
      <Ticks />
      <style>{`@keyframes val-laurel { from { stroke-dashoffset: ${CIRC}; } to { stroke-dashoffset: ${offset}; } }`}</style>
      <span style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox="0 0 116 116" aria-hidden="true"
          style={{ filter: 'drop-shadow(0 0 7px color-mix(in srgb, var(--tab-accent) 40%, transparent))' }}>
          <circle cx="58" cy="58" r={R} fill="none" stroke="var(--card-border)" strokeWidth="7" />
          <circle className="val-signature" cx="58" cy="58" r={R} fill="none" stroke="var(--tab-accent)" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={offset} transform="rotate(-90 58 58)"
            style={{ animation: 'val-laurel 600ms cubic-bezier(.2,.8,.2,1) both' }} />
        </svg>
        <span style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span className="val-num" style={{ fontSize: compact ? 30 : 34, fontWeight: 500, lineHeight: 1, color: 'var(--text-primary)' }}>{score}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-secondary)', marginTop: 4 }}>TODAY</span>
        </span>
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--tab-accent)', textTransform: 'uppercase' }}>{label}</span>
        {factors.map(f => (
          <span key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{f.label}</span>
              <span className="val-num" style={{ color: 'var(--text-primary)' }}>{f.value}</span>
            </span>
            <span style={{ height: 3, borderRadius: 2, background: 'var(--card-border)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: 3, width: `${Math.round(f.pct * 100)}%`, background: 'var(--tab-accent)', borderRadius: 2 }} />
            </span>
          </span>
        ))}
      </span>
    </button>
  );
}
