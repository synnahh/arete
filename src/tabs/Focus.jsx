// ─── VALERIE — Focus Tab ──────────────────────────────────────────────────────
import { Icon as LineIcon } from '../components/icons.jsx';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS }  from '../utils/storage.js';
import { addXP }         from '../utils/xp.js';
import { storage }       from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';

// ─── Ambient sound engine (AudioContext — fully offline) ──────────────────────
function createNoiseBuffer(audioCtx, type) {
  const sampleRate = audioCtx.sampleRate;
  const len        = sampleRate * 3; // 3-second loop
  const buffer     = audioCtx.createBuffer(1, len, sampleRate);
  const data       = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  } else if (type === 'brown') {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }

  } else if (type === 'pink') {
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759;
      b2 = 0.96900*b2 + w*0.1538520; b3 = 0.86650*b3 + w*0.3104856;
      b4 = 0.55000*b4 + w*0.5329522; b5 =-0.76160*b5 - w*0.0168980;
      data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
      b6 = w * 0.115926;
    }
  }
  return buffer;
}

function buildAmbient(audioCtx, type) {
  let source, gainNode;
  gainNode = audioCtx.createGain();
  gainNode.gain.value = 0.18;
  gainNode.connect(audioCtx.destination);

  if (type === 'white' || type === 'brown' || type === 'pink') {
    source = audioCtx.createBufferSource();
    source.buffer = createNoiseBuffer(audioCtx, type);
    source.loop   = true;

    if (type === 'pink') {
      // Forest: pink noise + gentle lowpass
      const lp = audioCtx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1400;
      source.connect(lp); lp.connect(gainNode);
    } else if (type === 'white') {
      // Rain: white noise through bandpass
      const bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.5;
      source.connect(bp); bp.connect(gainNode);
    } else {
      source.connect(gainNode);
    }
    source.start();

  } else if (type === 'binaural') {
    // Binaural-style: two slightly detuned oscillators
    const oscL = audioCtx.createOscillator();
    const oscR = audioCtx.createOscillator();
    const merger = audioCtx.createChannelMerger(2);
    oscL.frequency.value = 200;
    oscR.frequency.value = 210; // 10 Hz beat
    oscL.connect(merger, 0, 0);
    oscR.connect(merger, 0, 1);
    merger.connect(gainNode);
    oscL.start(); oscR.start();
    source = oscL; // keep reference for cleanup
  }

  return { source, gainNode };
}

// ─── Ambient sounds list ──────────────────────────────────────────────────────
const SOUNDS = [
  { id: 'off',      label: 'Off',       icon: '🔇', engine: null      },
  { id: 'white',    label: 'Rain',      icon: '🌧️', engine: 'white'   },
  { id: 'brown',    label: 'Brown',     icon: '🌊', engine: 'brown'   },
  { id: 'pink',     label: 'Forest',    icon: '🌲', engine: 'pink'    },
  { id: 'binaural', label: 'Focus',     icon: '🎧', engine: 'binaural'},
];

// ─── SVG ring timer ───────────────────────────────────────────────────────────
function RingTimer({ remaining, total, running, size = 260 }) {
  const cx  = size / 2;
  const r   = (size - 22) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = total > 0 ? Math.max(remaining / total, 0) : 1;
  const dash  = pct * circ;

  // Format mm:ss
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={cx} cy={cx} r={r} fill="none"
          stroke="rgba(255,255,255,0.05)" strokeWidth={10} />
        {/* Progress */}
        <circle cx={cx} cy={cx} r={r} fill="none"
          stroke="var(--accent)" strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: running ? 'stroke-dasharray 1s linear' : 'stroke-dasharray 0.4s ease' }}
        />
      </svg>
      {/* Centre time */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: size * 0.17, fontWeight: 200, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          {mm}:{ss}
        </span>
        <span style={{ fontSize: size * 0.065, color: 'var(--text-muted)', marginTop: 4 }}>
          {running ? 'focusing' : remaining === 0 ? 'complete' : 'paused'}
        </span>
      </div>
    </div>
  );
}

// ─── Session dots ─────────────────────────────────────────────────────────────
function SessionDots({ completed, total = 4 }) {
  const show = Math.max(total, completed);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {Array.from({ length: show }, (_, i) => (
        <div key={i} style={{
          width: i < completed ? 10 : 8,
          height: i < completed ? 10 : 8,
          borderRadius: '50%',
          background: i < completed ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
          boxShadow: i < completed ? '0 0 6px var(--accent)' : 'none',
          transition: 'all 0.3s ease',
        }} />
      ))}
      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
        {completed} session{completed !== 1 ? 's' : ''} today
      </span>
    </div>
  );
}

// ─── Main Focus Tab ───────────────────────────────────────────────────────────
export default function Focus({ settings }) {
  const sessions = useCollection('focus_sessions', STORAGE_KEYS.FOCUS_SESSIONS);
  const tasks    = storage.get(STORAGE_KEYS.TASKS, []);

  // Timer state
  const [durationMin, setDurationMin] = useState(25);
  const [remaining,   setRemaining]   = useState(25 * 60);
  const [running,     setRunning]     = useState(false);
  const [finished,    setFinished]    = useState(false);
  const [taskLabel,   setTaskLabel]   = useState('');
  const [customTask,  setCustomTask]  = useState('');
  const [sound,       setSound]       = useState('off');
  const [setupMode,   setSetupMode]   = useState(true);

  // Audio refs
  const audioCtxRef  = useRef(null);
  const soundNodeRef = useRef(null);
  const intervalRef  = useRef(null);

  // Today's completed sessions
  const today = toLocalDateKey(new Date());
  const todaySessions = sessions.items.filter(s => s.date === today);

  // Duration change resets remaining
  useEffect(() => {
    if (!running && setupMode) setRemaining(durationMin * 60);
  }, [durationMin, setupMode]);

  // Timer tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  // Ambient sound control
  useEffect(() => {
    stopSound();
    if (sound !== 'off' && running) startSound(sound);
  }, [sound, running]);

  // Cleanup
  useEffect(() => () => {
    clearInterval(intervalRef.current);
    stopSound();
    audioCtxRef.current?.close();
  }, []);

  function startSound(type) {
    stopSound();
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const s = SOUNDS.find(s => s.id === type);
      if (!s?.engine) return;
      const { source, gainNode } = buildAmbient(ctx, s.engine);
      soundNodeRef.current = { source, gainNode };
    } catch (e) { console.warn('AudioContext not supported:', e); }
  }

  function stopSound() {
    try {
      soundNodeRef.current?.source?.stop?.();
    } catch {}
    soundNodeRef.current = null;
  }

  function handleStart() {
    setSetupMode(false);
    setRunning(true);
    setFinished(false);
    if (sound !== 'off') startSound(sound);
  }

  function handlePause() {
    setRunning(false);
    stopSound();
  }

  function handleReset() {
    setRunning(false);
    setFinished(false);
    setSetupMode(true);
    setRemaining(durationMin * 60);
    stopSound();
  }

  function handleSkip() {
    setRunning(false);
    stopSound();
    handleComplete();
  }

  function handleComplete() {
    setRunning(false);
    setFinished(true);
    stopSound();

    // Log session
    const label = customTask.trim() || taskLabel || 'Focus session';
    sessions.add({
      date:       today,
      duration:   durationMin,
      taskLabel:  label,
      createdAt:  new Date().toISOString(),
    });

    // Award XP
    addXP('FOCUS_SESSION');

    // VALERIE spoken check-in
    if (window.speechSynthesis && settings?.voiceEnabled !== false) {
      const msg = new SpeechSynthesisUtterance(
        `Focus session complete. ${durationMin} minutes of solid work, Rob.`
      );
      msg.rate = settings?.speechRate || 1;
      window.speechSynthesis.speak(msg);
    }
  }

  const activeTasks = tasks.filter?.(t => !t.completed) ?? [];
  const taskName    = customTask.trim() || taskLabel;

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-start',
      padding: '32px 24px', overflowY: 'auto', gap: 28,
    }}>

      {/* Task label row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', maxWidth: 480 }}>
        <select value={taskLabel} onChange={e => setTaskLabel(e.target.value)}
          disabled={!setupMode}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '0.5px solid var(--card-border)',
            color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            opacity: setupMode ? 1 : 0.5,
          }}>
          <option value="">Pick a task…</option>
          {activeTasks.map(t => (
            <option key={t.id} value={t.title}>{t.title}</option>
          ))}
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>or</span>
        <input placeholder="Type a label…" value={customTask}
          onChange={e => setCustomTask(e.target.value)}
          disabled={!setupMode}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '0.5px solid var(--card-border)',
            color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            opacity: setupMode ? 1 : 0.5,
          }}
        />
      </div>

      {/* Duration picker (setup only) */}
      {setupMode && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            DURATION (MINUTES)
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[15, 25, 30, 45, 60, 90].map(m => (
              <button key={m} onClick={() => setDurationMin(m)} style={{
                width: 44, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: durationMin === m ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: durationMin === m ? '#fff' : 'var(--text-secondary)',
                fontSize: 13,
              }}>{m}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Custom:</span>
            <input type="number" min={1} max={240} value={durationMin}
              onChange={e => setDurationMin(Math.max(1, Math.min(240, parseInt(e.target.value) || 1)))}
              style={{
                width: 60, padding: '6px 10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '0.5px solid var(--card-border)',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none', textAlign: 'center',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>min</span>
          </div>
        </div>
      )}

      {/* Ring Timer */}
      <div style={{ position: 'relative' }}>
        <RingTimer remaining={remaining} total={durationMin * 60} running={running} size={260} />
        {taskName && (
          <div style={{
            position: 'absolute', bottom: -24, left: '50%', transform: 'translateX(-50%)',
            fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap',
          }}>
            {taskName}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
        <button onClick={handleReset} aria-label="Reset" style={{
          width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          background: 'var(--hover-bg)', color: 'var(--text-secondary)',
        }} title="Reset"><LineIcon name="reset" size={18} /></button>

        {finished ? (
          <button onClick={handleReset} style={{
            width: 60, height: 60, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: '#4caf7d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          }} aria-label="Start again"><LineIcon name="reset" size={24} /></button>
        ) : (
          <button onClick={running ? handlePause : handleStart} style={{
            width: 60, height: 60, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            boxShadow: running ? '0 0 20px color-mix(in srgb, var(--accent) 27%, transparent)' : 'none',
            transition: 'box-shadow 0.3s ease',
          }}>
            <span style={{ marginLeft: running ? 0 : 3, display: 'flex' }}><LineIcon name={running ? 'pause' : 'play'} size={24} /></span>
          </button>
        )}

        <button onClick={handleSkip} style={{
          width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'var(--hover-bg)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
        }} aria-label="Skip to end" title="Skip to end"><LineIcon name="skip" size={18} /></button>
      </div>

      {/* Completion message */}
      {finished && (
        <div style={{
          background: '#4caf7d18', border: '0.5px solid #4caf7d44',
          borderRadius: 12, padding: '12px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, color: '#4caf7d', fontWeight: 400 }}>
            Session complete — +15 XP earned
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {durationMin} minutes of focused work
          </div>
        </div>
      )}

      {/* Ambient sound selector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%', maxWidth: 420 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>AMBIENT SOUND</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {SOUNDS.map(s => (
            <button key={s.id} onClick={() => setSound(s.id)} style={{
              padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
              background: sound === s.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: sound === s.id ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
        {running && sound !== 'off' && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            " Playing  audio generated locally, no files required
          </div>
        )}
      </div>

      {/* Session dots */}
      <SessionDots completed={todaySessions.length} />
    </div>
  );
}

