// MuscleRanking — Train > Muscles. Each muscle gets a 0-100 score and a rank from four things
// (strength for your bodyweight, weekly sets, progression, consistency); the maths and the
// sources are in domain/muscleScore.js. Tap a muscle on the figure or in the list to see what
// makes up its score and the one thing that would raise it most.
import { useMemo, useState } from 'react';
import { anteriorData, posteriorData } from './bodyModel.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { scoreMuscles, RANKS, WEIGHTS, RANK_GATES } from '../domain/muscleScore.js';
import { MUSCLE_IDS, MUSCLE_LABEL } from '../domain/muscles.js';
import { useHealthData } from '../hooks/useHealthData.js';
import { AnimatedNumber, Collapse, ProgressBar, SlidingTabs } from './Motion.jsx';

const LIB_TO_MUSCLE = {
  chest: 'chest', 'front-deltoids': 'shoulders', 'back-deltoids': 'shoulders',
  biceps: 'biceps', triceps: 'triceps', forearm: 'forearms',
  trapezius: 'back', 'upper-back': 'back', 'lower-back': 'back',
  quadriceps: 'quads', hamstring: 'hamstrings', gluteal: 'glutes',
  calves: 'calves', 'left-soleus': 'calves', 'right-soleus': 'calves',
};
const BODY_FILL = 'color-mix(in srgb, var(--text-primary) 16%, transparent)';   // untracked anatomy (abs, neck, head)
const PART_LABEL = { strength: 'Strength for your bodyweight', volume: 'Weekly hard sets', progression: 'Progression', consistency: 'Consistency' };
const SIDE = { front: ['chest', 'shoulders', 'biceps', 'forearms', 'quads', 'calves'], back: ['back', 'triceps', 'hamstrings', 'glutes', 'calves', 'shoulders'] };

function BodyFigure({ side, scores, selected, onPick }) {
  const data = side === 'back' ? posteriorData : anteriorData;
  return (
    <svg key={side} viewBox="0 0 100 200" className="ui-scale" role="img" aria-label={`Body map, ${side}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {data.map((m, gi) => {
        const mid = LIB_TO_MUSCLE[m.muscle];
        const s = mid ? scores[mid] : null;
        const fill = !mid ? BODY_FILL : s.rank.color;
        const dim = selected && mid !== selected;
        return m.svgPoints.map((pts, i) => (
          <polygon key={`${gi}-${i}`} points={pts} fill={fill}
            fillOpacity={!mid ? 1 : dim ? 0.35 : s.days ? 0.55 + (s.score / 100) * 0.45 : 0.5}
            stroke={mid && mid === selected ? 'var(--text-primary)' : 'rgba(0,0,0,0.3)'} strokeWidth={mid && mid === selected ? 0.7 : 0.3} strokeLinejoin="round"
            onClick={mid ? () => onPick(mid) : undefined}
            style={{ cursor: mid ? 'pointer' : 'default', transition: 'fill var(--dur-3) var(--ease-out), fill-opacity var(--dur-3) var(--ease-out), stroke var(--dur-2) var(--ease-out)' }} />
        ));
      })}
    </svg>
  );
}

function PartRow({ k, part }) {
  const has = part.score != null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 550 }}>{PART_LABEL[k]} <span className="t-num" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round(WEIGHTS[k] * 100)}%</span></span>
        <span className="t-num" style={{ fontSize: 13, color: has ? 'var(--text-primary)' : 'var(--text-muted)' }}>{has ? part.score : '—'}</span>
      </div>
      <ProgressBar value={has ? part.score / 100 : 0} height={4} />
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{part.detail}</span>
    </div>
  );
}

function MuscleRow({ id, s, open, onToggle, index }) {
  return (
    <div className="ui-card ui-enter" style={{ '--i': Math.min(index, 8), padding: 0, overflow: 'hidden', ...(open ? { borderColor: 'var(--accent-line)' } : {}) }}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`m-${id}`}
        style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.rank.color, flexShrink: 0, boxShadow: `0 0 0 3px color-mix(in srgb, ${s.rank.color} 22%, transparent)` }} />
          <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{MUSCLE_LABEL[id]}</span>
          <span style={{ fontSize: 12, fontWeight: 650, color: s.rank.color }}>{s.rank.label}{s.capped ? ' ·' : ''}</span>
          <span className="t-num" style={{ fontSize: 17, fontWeight: 650, color: 'var(--text-primary)', minWidth: 30, textAlign: 'right' }}><AnimatedNumber value={s.score} duration={600} /></span>
          <span className={`ui-chev${open ? ' is-open' : ''}`} style={{ color: 'var(--text-muted)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </span>
        </div>
        <ProgressBar value={s.score / 100} color={s.rank.color} height={4} />
      </button>
      <Collapse open={open} id={`m-${id}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '2px 14px 14px' }}>
          {Object.keys(WEIGHTS).map(k => <PartRow key={k} k={k} part={s.parts[k]} />)}
          <div className="t-num" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.days} training day{s.days === 1 ? '' : 's'} on this muscle</div>
          {s.tip && <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text-primary)', padding: '9px 11px', borderRadius: 10, background: 'var(--accent-soft)' }}>{s.tip}</div>}
        </div>
      </Collapse>
    </div>
  );
}

export default function MuscleRanking({ workoutLogs = [] }) {
  const [view, setView] = useState('front');
  const [sort, setSort] = useState('body');
  const [open, setOpen] = useState(null);
  const [how, setHow] = useState(false);
  const { latestWeight } = useHealthData();

  // Bodyweight for the strength grade: the latest weigh-in, else one saved on a workout log.
  const logWeight = useMemo(() => [...workoutLogs].filter(l => l.bodyWeight).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]?.bodyWeight ?? null, [workoutLogs]);
  const bodyweight = latestWeight ?? logWeight;
  const scores = useMemo(() => scoreMuscles(workoutLogs, { today: toLocalDateKey(new Date()), bodyweight, muscles: MUSCLE_IDS }), [workoutLogs, bodyweight]);

  const trained = MUSCLE_IDS.filter(m => scores[m].days > 0);
  const overall = trained.length ? Math.round(MUSCLE_IDS.reduce((s, m) => s + scores[m].score, 0) / MUSCLE_IDS.length) : 0;
  const order = sort === 'body' ? MUSCLE_IDS
    : [...MUSCLE_IDS].sort((a, b) => (sort === 'strong' ? scores[b].score - scores[a].score : scores[a].score - scores[b].score));
  const pick = (m) => { setOpen(o => (o === m ? null : m)); if (!SIDE[view].includes(m)) setView(view === 'front' ? 'back' : 'front'); };

  const bodyWeightLogs = useMemo(() => workoutLogs.filter(l => l.bodyWeight).sort((a, b) => a.date?.localeCompare(b.date)).slice(-12).map(l => ({ date: l.date, w: l.bodyWeight })), [workoutLogs]);

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '18px 16px 28px', maxWidth: 980, margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Muscle ranking</h2>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Strength, weekly sets, progression and consistency</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="t-num" style={{ fontSize: 30, fontWeight: 650, color: 'var(--text-primary)', lineHeight: 1 }}><AnimatedNumber value={overall} /></div>
            <div className="t-caption" style={{ fontSize: 9.5 }}>Overall</div>
          </div>
        </div>

        <div className="ui-card" style={{ padding: 0 }}>
          <button type="button" onClick={() => setHow(v => !v)} aria-expanded={how}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: 'var(--text-primary)', fontSize: 14, fontWeight: 550 }}>
            How the score works
            <span className={`ui-chev${how ? ' is-open' : ''}`} style={{ color: 'var(--text-muted)' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></span>
          </button>
          <Collapse open={how}>
            <div style={{ padding: '0 14px 14px', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div><strong style={{ color: 'var(--text-primary)' }}>Strength (40%)</strong>: your best estimated one-rep max in the last 120 days, divided by your bodyweight, against approximate adult-male standards for that lift. Helper muscles get 75%.</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Weekly sets (25%)</strong>: hard sets a week over the last four weeks (helpers count half) against the guide's target for that muscle.</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Progression (15%)</strong>: your best in the last six weeks against the 18 weeks before. Flat is 50; +10% is 100.</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Consistency (20%)</strong>: weeks of the last eight you trained it; twice a week is a full week.</div>
              <div>A part with no data is left out and the rest re-weighted. Ranks also need training days: Intermediate {RANK_GATES.intermediate}, Advanced {RANK_GATES.advanced}, Elite {RANK_GATES.elite}. Stop training and the score falls on its own.</div>
              {!bodyweight && <div style={{ color: 'var(--warn)' }}>No bodyweight logged yet, so strength is not graded. Weigh in under Progress &gt; Body.</div>}
            </div>
          </Collapse>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, alignItems: 'start' }}>
          <div className="ui-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <SlidingTabs boxed label="Body side" value={view} onChange={setView} items={[{ id: 'front', label: 'Front' }, { id: 'back', label: 'Back' }]} style={{ width: 200 }} />
            <div style={{ width: '100%', maxWidth: 'min(260px, 52vw)' }}>
              <BodyFigure side={view} scores={scores} selected={open} onPick={pick} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', justifyContent: 'center' }}>
              {RANKS.map(r => (
                <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: r.color }} />{r.label}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SlidingTabs mode="toggle" size="sm" label="Sort muscles" value={sort} onChange={setSort}
              items={[{ id: 'body', label: 'Body order' }, { id: 'strong', label: 'Strongest' }, { id: 'weak', label: 'Needs work' }]} />
            {order.map((m, i) => <MuscleRow key={m} id={m} s={scores[m]} index={i} open={open === m} onToggle={() => setOpen(o => (o === m ? null : m))} />)}
          </div>
        </div>

        {bodyWeightLogs.length > 0 && (
          <div className="ui-card" style={{ padding: '14px 16px' }}>
            <div className="t-caption" style={{ marginBottom: 12 }}>Body weight on workout days</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64 }}>
              {bodyWeightLogs.map((d, i) => {
                const vals = bodyWeightLogs.map(x => x.w);
                const min = Math.min(...vals), max = Math.max(...vals);
                const h = Math.max(8, ((d.w - min) / (max - min || 1)) * 50 + 10);
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div className="t-num" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.w}</div>
                    <div className="ui-enter" style={{ '--i': i, width: '100%', height: h, background: 'color-mix(in srgb, var(--info) 45%, transparent)', borderRadius: '4px 4px 0 0', transformOrigin: 'bottom' }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
