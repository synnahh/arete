import { useState, useEffect } from 'react';

const WAKE_HOUR  = 8;
const SLEEP_HOUR = 24;
const C          = 2 * Math.PI * 52; // circumference

const COLOR_STOPS = [
  { pct:   0, r: 255, g: 216, b: 158 },
  { pct: 12.5, r: 255, g: 205, b: 121 },
  { pct:  25, r: 255, g: 227, b: 143 },
  { pct: 37.5, r: 255, g: 183, b: 106 },
  { pct:  50, r: 255, g: 149, b:  89 },
  { pct: 62.5, r: 243, g: 111, b:  79 },
  { pct:  75, r: 226, g:  93, b: 122 },
  { pct: 87.5, r: 123, g:  91, b: 176 },
  { pct: 100, r:  47, g:  58, b: 102 },
];

function interpolateColor(pct) {
  const p = Math.max(0, Math.min(100, pct));
  let lo = COLOR_STOPS[0], hi = COLOR_STOPS[COLOR_STOPS.length - 1];
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (p >= COLOR_STOPS[i].pct && p <= COLOR_STOPS[i + 1].pct) {
      lo = COLOR_STOPS[i]; hi = COLOR_STOPS[i + 1]; break;
    }
  }
  const t = lo.pct === hi.pct ? 0 : (p - lo.pct) / (hi.pct - lo.pct);
  const r = Math.round(lo.r + (hi.r - lo.r) * t);
  const g = Math.round(lo.g + (hi.g - lo.g) * t);
  const b = Math.round(lo.b + (hi.b - lo.b) * t);
  return `rgb(${r},${g},${b})`;
}

function fmtClock(d) {
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtRemaining(minutes) {
  if (minutes <= 0) return 'Sleep!';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function compute(now) {
  const hours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

  if (hours < WAKE_HOUR) {
    const minsUntilWake = Math.round((WAKE_HOUR - hours) * 60);
    return {
      percent: 0,
      color: '#4D4B47',
      phase: 'SLEEPING',
      status: '=4 Still sleeping',
      remaining: `${fmtRemaining(minsUntilWake)} until wake-up`,
      dashoffset: C,
    };
  }

  if (hours >= SLEEP_HOUR) {
    return {
      percent: 100,
      color: '#E25D7A',
      phase: 'PAST BEDTIME',
      status: ' Past bedtime',
      remaining: 'Sleep!',
      dashoffset: 0,
    };
  }

  const percent = Math.min(100, ((hours - WAKE_HOUR) / 16) * 100);
  const color   = interpolateColor(percent);
  const minsLeft = Math.round((SLEEP_HOUR - hours) * 60);

  let phase, status;
  if (percent < 25)      { phase = 'MORNING';   status = ' Morning  fresh start'; }
  else if (percent < 50) { phase = 'MIDDAY';    status = ' Midday  keep moving'; }
  else if (percent < 75) { phase = 'AFTERNOON'; status = '=% Afternoon  push it'; }
  else if (percent < 90) { phase = 'EVENING';   status = ' Evening  wrap up'; }
  else                   { phase = 'BEDTIME';   status = '< Bedtime soon'; }

  return {
    percent,
    color,
    phase,
    status,
    remaining: `${fmtRemaining(minsLeft)} awake time left`,
    dashoffset: C * (1 - percent / 100),
  };
}

export default function DayRing() {
  const [state, setState] = useState(() => compute(new Date()));
  const [clock, setClock] = useState(() => fmtClock(new Date()));

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setState(compute(now));
      setClock(fmtClock(now));
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const pctLabel = state.percent === 0 ? '' : `${Math.round(state.percent)}%`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, flexWrap: 'nowrap', minWidth: 0 }}>
      {/* Ring */}
      <div style={{ width: 168, height: 168, position: 'relative', flexShrink: 0 }}>
        <svg viewBox="0 0 120 120" width="168" height="168">
          <defs>
            <filter id="ring-glow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Track */}
          <circle cx="60" cy="60" r="52" fill="none"
            stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          {/* Fill */}
          <circle cx="60" cy="60" r="52" fill="none"
            stroke={state.color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={state.dashoffset}
            filter="url(#ring-glow)"
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              transition: 'stroke 0.7s cubic-bezier(0.22,1,0.36,1), stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)',
            }}
          />
        </svg>

        {/* Center overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: 40, fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.04em',
            color: state.percent === 0 ? 'var(--text-muted)' : state.color,
            lineHeight: 1,
          }}>
            {pctLabel}
          </div>
          <div style={{
            fontSize: 9.5, fontFamily: 'monospace', fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.16em',
            marginTop: 5, color: 'var(--text-muted)',
          }}>
            {state.phase}
          </div>
          <div style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: 3 }}>
            {clock}
          </div>
        </div>
      </div>

      {/* Status column */}
      <div style={{ maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          {state.status}
        </div>
        <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
          {state.remaining}
        </div>
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
          8:00 AM  12:00 AM
        </div>
      </div>
    </div>
  );
}
