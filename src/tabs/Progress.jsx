// ─── VALERIE — Progress Tab ───────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { ProgressBar, MilestoneLine } from '../components/Charts.jsx';
import { getXP, addXP, getRank, awardActivityXP, TIER_CONFIG, TIER_THRESHOLDS, XP_SOURCES } from '../utils/xp.js';
import { computeStreaks } from '../utils/streaks.js';
import { withLiveStreaks, isDone } from '../domain/habits.js';
import { AnimatedNumber } from '../components/Motion.jsx';
import { toLocalDateKey, isOnLocalDay } from '../utils/localDate.js';

// ─── Glass label ─────────────────────────────────────────────────────────────
function GlassLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 18, height: 1, background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap' }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(255,255,255,0.1),transparent)' }} />
    </div>
  );
}

// ─── SVG Badge System ─────────────────────────────────────────────────────────
// All badges use a 100x100 viewBox centred at (50, 50)
const toRad = d => d * Math.PI / 180;

function poly(cx, cy, r, n, start = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = toRad(start + i * 360 / n);
    return [+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)];
  });
}

function starPts(cx, cy, R, r, n, start = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a   = toRad(start + i * 180 / n);
    const rad = i % 2 === 0 ? R : r;
    pts.push([+(cx + rad * Math.cos(a)).toFixed(2), +(cy + rad * Math.sin(a)).toFixed(2)]);
  }
  return pts;
}

function ptsToD(pts, close = true) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + (close ? ' Z' : '');
}

function crossD(cx, cy, R, hw) {
  return `M${cx-hw},${cy-R} L${cx+hw},${cy-R} L${cx+hw},${cy-hw} L${cx+R},${cy-hw} L${cx+R},${cy+hw} L${cx+hw},${cy+hw} L${cx+hw},${cy+R} L${cx-hw},${cy+R} L${cx-hw},${cy+hw} L${cx-R},${cy+hw} L${cx-R},${cy-hw} L${cx-hw},${cy-hw} Z`;
}
function holeD(cx, cy, r) {
  // Small square hole (counter-clockwise) for evenodd cutout
  return `M${cx+r},${cy-r} L${cx-r},${cy-r} L${cx-r},${cy+r} L${cx+r},${cy+r} Z`;
}

// Tier badge components
function Badge({ tier, subRank = 1, size = 80, pulse = false }) {
  const cfg  = TIER_CONFIG[tier - 1];
  const col  = cfg.color;
  const c    = 50;
  const glow = subRank === 3 || tier === 8 ? 10 : subRank === 2 ? 5 : 2;

  const style = {
    filter: `drop-shadow(0 0 ${glow}px ${col})`,
    ...(pulse ? { animation: 'orbPulse 2.5s ease-in-out infinite' } : {}),
  };

  const sw  = 1.6;
  const sw2 = 1.1;

  let shapes = null;

  if (tier === 1) {
    // Hexagon + 3 diameters + inner hex
    const outer = poly(c, c, 36, 6, 0);
    const inner = poly(c, c, 20, 6, 0);
    const diam  = [[outer[0], outer[3]], [outer[1], outer[4]], [outer[2], outer[5]]];
    shapes = <>
      <path d={ptsToD(outer)} fill="none" stroke={col} strokeWidth={sw} />
      {diam.map((([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={col} strokeWidth={sw2} opacity={0.55} />
      )))}
      {subRank >= 2 && <path d={ptsToD(inner)} fill="none" stroke={col} strokeWidth={sw2} opacity={0.7} />}
      {subRank >= 2 && <circle cx={c} cy={c} r={7} fill="none" stroke={col} strokeWidth={sw2} />}
      {subRank >= 3 && <circle cx={c} cy={c} r={4} fill={col} opacity={0.9} />}
    </>;

  } else if (tier === 2) {
    // 4-point sharp star (Shard)
    const outer = ptsToD(starPts(c, c, 40, 6, 4, -45));
    const inner = ptsToD(starPts(c, c, 26, 4, 4, -45));
    shapes = <>
      <path d={outer} fill="none" stroke={col} strokeWidth={sw} />
      {subRank >= 2 && <path d={inner} fill="none" stroke={col} strokeWidth={sw2} opacity={0.7} />}
      {subRank >= 2 && <circle cx={c} cy={c} r={6} fill="none" stroke={col} strokeWidth={sw2} />}
      {subRank >= 3 && <circle cx={c} cy={c} r={3.5} fill={col} opacity={0.9} />}
    </>;

  } else if (tier === 3) {
    // Plus/cross with hollow centre (Void)
    const cross = crossD(c, c, 36, 12) + ' ' + holeD(c, c, 8);
    shapes = <>
      <path d={cross} fillRule="evenodd" fill={col} opacity={subRank >= 2 ? 0.85 : 0.7} />
      {subRank >= 2 && <path d={crossD(c, c, 24, 7) + ' ' + holeD(c, c, 5)}
        fillRule="evenodd" fill="none" stroke={col} strokeWidth={sw2} opacity={0.55} />}
      {subRank >= 3 && <circle cx={c} cy={c} r={4} fill={col} />}
    </>;

  } else if (tier === 4) {
    // 6-point double star (Raze)
    const outer = ptsToD(starPts(c, c, 38, 16, 6, -90));
    const inner = ptsToD(starPts(c, c, 24, 10, 6, -90));
    shapes = <>
      <path d={outer} fill="none" stroke={col} strokeWidth={sw} />
      {subRank >= 2 && <path d={inner} fill="none" stroke={col} strokeWidth={sw2} opacity={0.7} />}
      {subRank >= 2 && <circle cx={c} cy={c} r={6} fill="none" stroke={col} strokeWidth={sw2} />}
      {subRank >= 3 && <circle cx={c} cy={c} r={3.5} fill={col} opacity={0.9} />}
    </>;

  } else if (tier === 5) {
    // 8-point barbed star — very sharp (Fang)
    const outer = ptsToD(starPts(c, c, 40, 7, 8, -90));
    const inner = ptsToD(starPts(c, c, 26, 5, 8, -90));
    shapes = <>
      <path d={outer} fill="none" stroke={col} strokeWidth={sw} />
      {subRank >= 2 && <path d={inner} fill="none" stroke={col} strokeWidth={sw2} opacity={0.65} />}
      {subRank >= 2 && <circle cx={c} cy={c} r={7} fill="none" stroke={col} strokeWidth={sw2} />}
      {subRank >= 3 && <circle cx={c} cy={c} r={4} fill={col} opacity={0.9} />}
    </>;

  } else if (tier === 6) {
    // 8-point cross-star, ornate double outline (Crown)
    const outer = ptsToD(starPts(c, c, 38, 20, 8, -90));
    const mid   = ptsToD(starPts(c, c, 32, 15, 8, -90));
    const inner = ptsToD(starPts(c, c, 22, 10, 8, -90));
    shapes = <>
      <path d={outer} fill="none" stroke={col} strokeWidth={sw} />
      <path d={mid}   fill="none" stroke={col} strokeWidth={sw2} opacity={0.6} />
      {subRank >= 2 && <path d={inner} fill="none" stroke={col} strokeWidth={sw2} opacity={0.5} />}
      {subRank >= 2 && <circle cx={c} cy={c} r={7} fill="none" stroke={col} strokeWidth={sw2} />}
      {subRank >= 3 && <circle cx={c} cy={c} r={4} fill={col} opacity={0.95} />}
    </>;

  } else if (tier === 7) {
    // 12-point razor star (Spectre)
    const outer = ptsToD(starPts(c, c, 40, 7, 12, -90));
    const inner = ptsToD(starPts(c, c, 26, 5, 12, -90));
    shapes = <>
      <path d={outer} fill="none" stroke={col} strokeWidth={sw} />
      {subRank >= 2 && <path d={inner} fill="none" stroke={col} strokeWidth={sw2} opacity={0.6} />}
      {subRank >= 2 && <circle cx={c} cy={c} r={7} fill="none" stroke={col} strokeWidth={sw2} />}
      {subRank >= 3 && <circle cx={c} cy={c} r={4} fill={col} opacity={0.95} />}
    </>;

  } else if (tier === 8) {
    // Ascendant — 16-pt outer + 8-pt inner + diamond + glowing core
    const outer   = ptsToD(starPts(c, c, 40, 22, 16, -90));
    const mid     = ptsToD(starPts(c, c, 28, 15,  8, -90));
    const diamond = ptsToD([[c, c-14],[c+10, c],[c, c+14],[c-10, c]]);
    shapes = <>
      <path d={outer}   fill="none" stroke={col} strokeWidth={sw} />
      <path d={mid}     fill="none" stroke={col} strokeWidth={sw} opacity={0.8} />
      <path d={diamond} fill="none" stroke={col} strokeWidth={sw2} opacity={0.7} />
      <circle cx={c} cy={c} r={8}   fill="none" stroke={col} strokeWidth={sw} />
      <circle cx={c} cy={c} r={4.5} fill={col} opacity={0.95} />
    </>;
  }

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={style}>
      {tier === 8 && (
        <style>{`@keyframes orbPulse { 0%,100%{opacity:0.7} 50%{opacity:1} }`}</style>
      )}
      {shapes}
    </svg>
  );
}

// ─── Tier track ───────────────────────────────────────────────────────────────
function TierTrack({ currentTier, currentSubRank }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
      {TIER_CONFIG.map((cfg, i) => {
        const t       = i + 1;
        const reached = t < currentTier || (t === currentTier);
        const active  = t === currentTier;
        return (
          <div key={t} title={cfg.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ opacity: reached ? 1 : 0.2, transition: 'opacity 0.3s' }}>
              <Badge tier={t} subRank={active ? currentSubRank : t < currentTier ? 3 : 1} size={36} />
            </div>
            <span style={{ fontSize: 10.5, color: active ? cfg.color : 'var(--text-muted)', letterSpacing: '0.04em' }}>
              {cfg.name.toUpperCase()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Mood check-in ────────────────────────────────────────────────────────────
const MOODS = ['😞','😔','😐','🙂','😊','😄','🤩'];

function MoodCheckin({ moodLogs, onLog }) {
  const todayStr = toLocalDateKey(new Date());
  const todayLog = moodLogs.find(m => m.date === todayStr);
  const [selected, setSelected] = useState(null);
  const [note, setNote]         = useState('');

  function submit() {
    if (selected === null) return;
    onLog({ date: todayStr, mood: selected, note: note.trim() || null });
    addXP('MOOD_LOGGED');
    setSelected(null);
    setNote('');
  }

  if (todayLog) {
    return (
      <div style={{
        background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
        borderRadius: 12, padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 28 }}>{MOODS[todayLog.mood]}</span>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>Mood logged for today</div>
          {todayLog.note && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{todayLog.note}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 12, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>HOW ARE YOU TODAY?</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        {MOODS.map((emoji, i) => (
          <button key={i} onClick={() => setSelected(i)} style={{
            fontSize: 22, background: 'none', border: 'none', cursor: 'pointer',
            transform: selected === i ? 'scale(1.35)' : 'scale(1)',
            transition: 'transform 0.15s ease',
            filter: selected === null || selected === i ? 'none' : 'grayscale(0.8) opacity(0.4)',
            padding: 4,
          }}>
            {emoji}
          </button>
        ))}
      </div>
      {selected !== null && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Add a note (optional)" value={note} onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={{
              flex: 1, padding: '7px 12px', borderRadius: 8, outline: 'none', fontSize: 13,
              background: 'rgba(255,255,255,0.06)', border: '0.5px solid var(--card-border)',
              color: 'var(--text-primary)',
            }} />
          <button onClick={submit} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--accent)', color: '#fff', fontSize: 13,
          }}>Log +5 XP</button>
        </div>
      )}
    </div>
  );
}

// ─── Overview sub-tab ─────────────────────────────────────────────────────────
function Overview({ xp, rank, habits, moodLogs, onLogMood, focusSessions }) {
  const today     = toLocalDateKey(new Date());
  const todayFoc  = focusSessions.filter(s => s.date === today).length;
  const recentXP  = xp.log?.slice(0, 5) || [];

  const nextTier  = rank.tier < 8 ? TIER_CONFIG[rank.tier] : null;
  const xpToNext  = rank.xpToNext || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mood */}
      <MoodCheckin moodLogs={moodLogs} onLog={onLogMood} />

      {/* Rank snapshot */}
      <div style={{
        background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
        borderRadius: 12, padding: '16px 20px',
        display: 'flex', gap: 16, alignItems: 'center',
      }}>
        <Badge tier={rank.tier} subRank={rank.subRank} size={64} pulse={rank.tier === 8} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 400 }}>
            {rank.config.name} {rank.tier < 8 ? `${['I','II','III'][rank.subRank - 1]}` : ''}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {xp.total?.toLocaleString() || 0} XP total
          </div>
          <div style={{ marginTop: 8 }}>
            <ProgressBar
              value={100 - (xpToNext / (rank.tier < 8 ? TIER_THRESHOLDS[rank.tier] - TIER_THRESHOLDS[rank.tier - 1] : 1) * 100)}
              max={100}
              colour={rank.config.color}
              height={5}
            />
            {nextTier && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {xpToNext.toLocaleString()} XP to {nextTier.name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today quick stats */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
  ['Focus sessions', todayFoc, '⏱️'],
  ['Habits done', habits.filter(h => h.lastCompleted === today).length, '✅'],
  ['XP today', xp.log?.filter(e => isOnLocalDay(e.date, today)).reduce((s,e) => s + e.amount, 0) || 0, '⚡'],
        ].map(([label, val, icon]) => (
          <div key={label} style={{
            flex: 1, minWidth: 100,
            background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
            borderRadius: 12, padding: '12px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontSize: 20, fontWeight: 300, color: 'var(--text-primary)' }}>{val}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Recent XP */}
      {recentXP.length > 0 && (
        <div style={{
          background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
          borderRadius: 12, padding: '14px 18px',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 10 }}>
            RECENT XP
          </div>
          {recentXP.map((e, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: i < recentXP.length - 1 ? '0.5px solid var(--card-border)' : 'none',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.label}</span>
              <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>+{e.amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

//  Unified momentum card  overall + per-domain streaks
function MomentumCard({ streaks }) {
  const { overall, domains } = streaks;
  const order = ['focus', 'health', 'lm', 'tasks'];
  return (
    <div style={{
      background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 12, padding: '18px 20px',
      display: 'flex', alignItems: 'center', gap: 20,
    }}>
      {/* Overall flame */}
      <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 96 }}>
        <div style={{ fontSize: 40, fontWeight: 200, color: overall.current > 0 ? '#f4a642' : 'var(--text-muted)', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          {overall.current > 0 && <span className="val-pop" style={{ fontSize: 28 }}>🔥</span>}
          <AnimatedNumber value={overall.current} duration={600} format={n => Math.round(n)} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, letterSpacing: '0.06em' }}>DAY STREAK</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2, opacity: 0.7 }}>best {overall.best}</div>
      </div>
      {/* Per-domain */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
        {order.map(k => {
          const d = domains[k];
          return (
            <div key={k} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
              borderRadius: 9, background: 'rgba(255,255,255,0.03)',
              border: `0.5px solid ${d.active ? '#f4a64233' : 'var(--card-border)'}`,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0, filter: d.current > 0 ? 'none' : 'grayscale(0.7) opacity(0.5)' }}>{d.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{d.label}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 300, color: d.current > 0 ? '#f4a642' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {d.current}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

//  Streaks sub-tab
function Streaks({ habits, streaks }) {
  const today   = toLocalDateKey(new Date());
  const sorted  = [...habits].sort((a, b) => (b.streak || 0) - (a.streak || 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {streaks && <MomentumCard streaks={streaks} />}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>HABIT STREAKS</div>
      {sorted.length === 0 ? (
        <div style={{
          background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
          borderRadius: 12, padding: '32px 20px', textAlign: 'center',
          color: 'var(--text-muted)', fontSize: 13,
        }}>
          Add habits in the Health tab to see your streaks here.
        </div>
      ) : sorted.map(h => {
        const active  = isDone(h, today);
        const streak  = h.streak || 0;
        return (
          <div key={h.id} style={{
            background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
            borderRadius: 12, padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{h.icon || ' '}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{h.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {active ? '✓ Done today' : '✗ Not done today'}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 300, color: streak > 0 ? '#f4a642' : 'var(--text-muted)' }}>
  {streak > 0 ? '🔥' : ''}{streak}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>day streak</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Goals sub-tab ────────────────────────────────────────────────────────────
function Goals({ goals, onAdd, onUpdate, onRemove }) {
  const [showForm, setShowForm] = useState(false);
  const [name,     setName]     = useState('');
  const [target,   setTarget]   = useState('');
  const [unit,     setUnit]     = useState('');
  const [current,  setCurrent]  = useState('');
  const [deadline, setDeadline] = useState('');

  function handleCreate() {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(), target: parseFloat(target) || 100,
      unit: unit.trim() || '', current: parseFloat(current) || 0,
      deadline: deadline || null,
  milestones: [{ pct: 25, label: '25%' }, { pct: 50, label: '50%' }, { pct: 75, label: '75%' }, { pct: 100, label: '🏆' }],
    });
    setName(''); setTarget(''); setUnit(''); setCurrent(''); setDeadline('');
    setShowForm(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>PERSONAL GOALS</div>
        <button onClick={() => setShowForm(v => !v)} style={{
          padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'var(--accent)', color: '#fff', fontSize: 12,
        }}>+ New Goal</button>
      </div>

      {showForm && (
        <div style={{
          background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
          borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input placeholder="Goal name" value={name} onChange={e => setName(e.target.value)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, outline: 'none', fontSize: 13,
                background: 'rgba(255,255,255,0.06)', border: '0.5px solid var(--card-border)',
                color: 'var(--text-primary)',
              }} />
            <input type="number" placeholder="Target" value={target}
              onChange={e => setTarget(e.target.value)}
              style={{
                width: 90, padding: '8px 12px', borderRadius: 8, outline: 'none', fontSize: 13,
                background: 'rgba(255,255,255,0.06)', border: '0.5px solid var(--card-border)',
                color: 'var(--text-primary)',
              }} />
            <input placeholder="Unit" value={unit} onChange={e => setUnit(e.target.value)}
              style={{
                width: 70, padding: '8px 12px', borderRadius: 8, outline: 'none', fontSize: 13,
                background: 'rgba(255,255,255,0.06)', border: '0.5px solid var(--card-border)',
                color: 'var(--text-primary)',
              }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" placeholder="Current progress" value={current}
              onChange={e => setCurrent(e.target.value)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, outline: 'none', fontSize: 13,
                background: 'rgba(255,255,255,0.06)', border: '0.5px solid var(--card-border)',
                color: 'var(--text-primary)',
              }} />
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, outline: 'none', fontSize: 13,
                background: 'rgba(255,255,255,0.06)', border: '0.5px solid var(--card-border)',
                color: 'var(--text-primary)',
              }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{
              padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
              background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
            }}>Cancel</button>
            <button onClick={handleCreate} style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
              background: 'var(--accent)', color: '#fff',
            }}>Create</button>
          </div>
        </div>
      )}

      {goals.length === 0 && !showForm && (
        <div style={{
          background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
          borderRadius: 12, padding: '32px 20px', textAlign: 'center',
          color: 'var(--text-muted)', fontSize: 13,
        }}>
          Set a personal goal to track your progress.
        </div>
      )}

      {goals.map(g => {
        const pct  = g.target > 0 ? Math.min(((g.current || 0) / g.target) * 100, 100) : 0;
        const done = pct >= 100;
        return (
          <div key={g.id} style={{
            background: 'var(--bg-panel)', border: `0.5px solid ${done ? '#4caf7d33' : 'var(--card-border)'}`,
            borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{g.name}{done ? ' x}0' : ''}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {g.current || 0}{g.unit ? ` ${g.unit}` : ''} / {g.target}{g.unit ? ` ${g.unit}` : ''}
              </div>
            </div>
            <ProgressBar value={pct} max={100} colour={done ? '#4caf7d' : 'var(--accent)'} height={5} />
            {g.milestones?.length > 0 && (
              <MilestoneLine milestones={g.milestones} progress={pct} colour={done ? '#4caf7d' : 'var(--accent)'} />
            )}
            {!done && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" placeholder="Update progress"
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 7, outline: 'none', fontSize: 12,
                    background: 'rgba(255,255,255,0.06)', border: '0.5px solid var(--card-border)',
                    color: 'var(--text-primary)',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) { onUpdate(g.id, { current: Math.min(v, g.target) }); e.target.value = ''; }
                    }
                  }}
                />
                <button onClick={() => onRemove(g.id)} style={{
                  padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12,
                  background: 'rgba(255,255,255,0.06)', color: '#e55a5a',
                }}>Remove</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Stats sub-tab ────────────────────────────────────────────────────────────
function Stats({ focusSessions, habits }) {
  const xp  = getXP();
  const now = new Date();

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i));
    const key = toLocalDateKey(d);
    const dayXP = (xp.log || []).filter(e => isOnLocalDay(e.date, key)).reduce((s, e) => s + e.amount, 0);
    const daySessions = focusSessions.filter(s => s.date === key).length;
    return { date: key, xp: dayXP, sessions: daySessions,
      label: d.toLocaleDateString('en-GB', { weekday: 'short' }) };
  });

  const totalFocusMin = focusSessions.reduce((s, f) => s + (f.duration || 0), 0);
  const topStreak     = Math.max(...habits.map(h => h.streak || 0), 0);

  const StatCard = ({ label, value, sub }) => (
    <div style={{
      background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 12, padding: '14px 18px', flex: 1, minWidth: 110, textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatCard label="Total XP"       value={xp.total?.toLocaleString() || 0} />
        <StatCard label="Focus minutes"  value={totalFocusMin} />
        <StatCard label="Top streak"     value={`${topStreak}d`} sub="days" />
      </div>

      {/* 7-day XP chart */}
      <div style={{
        background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
        borderRadius: 12, padding: '16px 18px',
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 14 }}>
          XP — LAST 7 DAYS
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
          {last7.map((d, i) => {
            const maxXP = Math.max(...last7.map(x => x.xp), 1);
            const h = (d.xp / maxXP) * 70;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: '100%', height: Math.max(h, d.xp > 0 ? 3 : 0),
                  background: 'var(--accent)', borderRadius: '3px 3px 0 0', opacity: 0.75,
                  transition: 'height 0.4s ease',
                }} />
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* XP breakdown */}
      <div style={{
        background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
        borderRadius: 12, padding: '16px 18px',
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 12 }}>
          XP SOURCES
        </div>
        {Object.entries(XP_SOURCES).map(([key, src]) => {
          const total = (xp.log || []).filter(e => e.source === key).reduce((s, e) => s + e.amount, 0);
          if (!total) return null;
          return (
            <div key={key} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 0', borderBottom: '0.5px solid var(--card-border)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{src.label}</span>
              <span style={{ fontSize: 12, color: 'var(--accent)' }}>{total.toLocaleString()} XP</span>
            </div>
          );
        }).filter(Boolean)}
        {!(xp.log?.length) && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            XP earned throughout the app will appear here.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Rank sub-tab ─────────────────────────────────────────────────────────────
function RankView({ xp, rank }) {
  const subRankLabels = ['I', 'II', 'III'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
      {/* Main badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Badge tier={rank.tier} subRank={rank.subRank} size={140} pulse={rank.tier === 8} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 300, color: rank.config.color }}>
            {rank.config.name}
            {rank.tier < 8 && ` ${subRankLabels[rank.subRank - 1]}`}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            <AnimatedNumber value={xp.total || 0} /> XP
          </div>
        </div>
      </div>

      {/* XP progress */}
      {rank.tier < 8 && (
        <div style={{ width: '100%', maxWidth: 320 }}>
          <ProgressBar
            value={100 - (rank.xpToNext / (TIER_THRESHOLDS[rank.tier] - TIER_THRESHOLDS[rank.tier - 1]) * 100)}
            max={100}
            colour={rank.config.color}
            height={8}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {TIER_CONFIG[rank.tier - 1].name} {subRankLabels[rank.subRank - 1]}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {(rank.xpToNext || 0).toLocaleString()} XP to next
            </span>
          </div>
        </div>
      )}

      {/* Tier track */}
      <div style={{
        background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
        borderRadius: 12, padding: '16px 18px', width: '100%',
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 14, textAlign: 'center' }}>
          ALL TIERS
        </div>
        <TierTrack currentTier={rank.tier} currentSubRank={rank.subRank} />
      </div>

      {/* Sub-rank progression */}
      {rank.tier < 8 && (
        <div style={{
          background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
          borderRadius: 12, padding: '16px 20px', width: '100%',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 14 }}>
            {rank.config.name.toUpperCase()} PROGRESSION
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
            {[1, 2, 3].map(sr => (
              <div key={sr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ opacity: rank.tier > TIER_CONFIG.indexOf(rank.config) + 1 || rank.subRank >= sr ? 1 : 0.25 }}>
                  <Badge tier={rank.tier} subRank={sr} size={56} />
                </div>
                <span style={{
                  fontSize: 11,
                  color: rank.subRank === sr ? rank.config.color : 'var(--text-muted)',
                  fontWeight: rank.subRank === sr ? 500 : 400,
                }}>
                  {rank.config.name} {subRankLabels[sr - 1]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* XP reference */}
      <div style={{
        background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
        borderRadius: 12, padding: '14px 18px', width: '100%',
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 10 }}>
          XP PER ACTION
        </div>
        {Object.entries(XP_SOURCES).map(([, src]) => (
          <div key={src.label} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '4px 0', borderBottom: '0.5px solid var(--card-border)',
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{src.label}</span>
            <span style={{ fontSize: 11, color: 'var(--accent)' }}>+{src.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Progress Tab — single scrollable page ───────────────────────────────
export default function Progress() {
  const [xp, setXp] = useState(() => getXP());

  const habits   = useCollection('habits',         STORAGE_KEYS.HABITS);
  const goals    = useCollection('goals',           STORAGE_KEYS.GOALS);
  const moodLogs = useCollection('mood_logs',       STORAGE_KEYS.MOOD_LOGS);
  const sessions = useCollection('focus_sessions',  STORAGE_KEYS.FOCUS_SESSIONS);

  // Run the unified XP sweep once on mount (awards cross-domain activity
  // idempotently), then read the resulting total.
  useEffect(() => { awardActivityXP(); setXp(getXP()); }, []);

  const streaks = useMemo(() => computeStreaks(), [
    habits.items, sessions.items, goals.items, moodLogs.items,
  ]);

  const rank = getRank(xp.total || 0);

  function handleLogMood(data) {
    moodLogs.add({ ...data, createdAt: new Date().toISOString() });
    setTimeout(() => setXp(getXP()), 100);
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Main scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ── RANK ── */}
        <section>
          <GlassLabel>Rank</GlassLabel>
          <RankView xp={xp} rank={rank} />
        </section>

        {/* ── OVERVIEW — mood + today's stats ── */}
        <section>
          <GlassLabel>Today</GlassLabel>
          <Overview
            xp={xp} rank={rank}
            habits={habits.items}
            moodLogs={moodLogs.items}
            onLogMood={handleLogMood}
            focusSessions={sessions.items}
          />
        </section>

        {/* ── STREAKS ── */}
        <section>
          <GlassLabel>Streaks</GlassLabel>
          <Streaks habits={withLiveStreaks(habits.items, toLocalDateKey(new Date()))} streaks={streaks} />
        </section>

        {/* ── GOALS ── */}
        <section>
          <GlassLabel>Goals</GlassLabel>
          <Goals
            goals={goals.items}
            onAdd={data => goals.add({ ...data, createdAt: new Date().toISOString() })}
            onUpdate={goals.update}
            onRemove={goals.remove}
          />
        </section>

        {/* ── STATS ── */}
        <section>
          <GlassLabel>Stats</GlassLabel>
          <Stats focusSessions={sessions.items} habits={withLiveStreaks(habits.items, toLocalDateKey(new Date()))} />
        </section>

      </div>
    </div>
  );
}

