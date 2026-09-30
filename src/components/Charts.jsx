// ─── VALERIE Chart Primitives — custom SVG, zero dependencies ────────────────

// ── Polar coordinate helper ───────────────────────────────────────────────────
function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ── Ring / Progress Arc ───────────────────────────────────────────────────────
export function RingChart({
  value = 0, max = 100,
  size = 120, thickness = 9,
  colour = 'var(--accent)',
  trackColour = 'rgba(255,255,255,0.05)',
  label, sublabel,
  labelSize,
}) {
  const r    = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = Math.min(Math.max(value / max, 0), 1);
  const dash = pct * circ;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={trackColour} strokeWidth={thickness} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={colour} strokeWidth={thickness}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      {label !== undefined && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: labelSize ?? Math.round(size * 0.19),
            fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1,
          }}>
            {label}
          </span>
          {sublabel && (
            <span style={{ fontSize: Math.round(size * 0.1), color: 'var(--text-muted)', marginTop: 2 }}>
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Horizontal Progress Bar ───────────────────────────────────────────────────
export function ProgressBar({
  value = 0, max = 100,
  colour = 'var(--accent)',
  height = 5,
  rounded = true,
}) {
  const pct = Math.min((value / max) * 100, 100);
  const r   = rounded ? height : 0;
  return (
    <div style={{
      width: '100%', height,
      borderRadius: r,
      background: 'rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        borderRadius: r,
        background: colour,
        transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
      }} />
    </div>
  );
}

// ── Proportional Stage Bar (sleep stages, macro breakdown) ────────────────────
export function StageBar({ stages = [], height = 16 }) {
  const total = stages.reduce((s, st) => s + (st.value || 0), 0);
  if (!total) return (
    <div style={{ height, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} />
  );
  return (
    <div style={{ display: 'flex', height, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
      {stages.filter(s => s.value > 0).map((st, i) => (
        <div key={i}
          title={`${st.label}: ${st.value}m`}
          style={{
            flex: st.value,
            background: st.colour,
            transition: 'flex 0.5s ease',
            minWidth: 2,
          }}
        />
      ))}
    </div>
  );
}

// ── Bar Chart (vertical bars) ─────────────────────────────────────────────────
export function BarChart({
  data = [],
  maxHeight = 80,
  colour = 'var(--accent)',
  goalLine,
  goalColour = 'rgba(255,255,255,0.18)',
  minBarWidth = 18,
}) {
  const maxVal = Math.max(...data.map(d => d.value ?? 0), goalLine ?? 0, 1);

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 3,
      height: maxHeight + 24, width: '100%',
      position: 'relative',
    }}>
      {/* Goal line */}
      {goalLine != null && (
        <div style={{
          position: 'absolute',
          bottom: 24 + ((goalLine / maxVal) * maxHeight),
          left: 0, right: 0,
          height: 1,
          background: goalColour,
          zIndex: 1,
        }} />
      )}

      {data.map((d, i) => {
        const h = Math.max((d.value / maxVal) * maxHeight, d.value ? 2 : 0);
        return (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, flex: 1, minWidth: minBarWidth,
          }}>
            <div title={String(d.value ?? '')} style={{
              width: '100%',
              height: h,
              background: d.colour ?? colour,
              borderRadius: '3px 3px 0 0',
              opacity: d.muted ? 0.3 : 0.75,
              transition: 'height 0.4s ease',
            }} />
            <span style={{
              fontSize: 10.5, color: 'var(--text-muted)',
              whiteSpace: 'nowrap', letterSpacing: '0.02em',
            }}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Donut Chart (spending by category) ───────────────────────────────────────
export function DonutChart({
  segments = [],
  size = 160,
  thickness = 26,
  label, sublabel,
}) {
  const cx    = size / 2;
  const cy    = size / 2;
  const r     = (size - thickness) / 2;
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0);

  if (!total) return (
    <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="rgba(255,255,255,0.05)" strokeWidth={thickness} />
      </svg>
    </div>
  );

  // Build arc paths from -90° (top)
  let currentAngle = -90;
  const GAP = total > 1 ? 2 : 0; // gap in degrees between segments

  const arcs = segments.map(seg => {
    const angle      = (seg.value / total) * (360 - GAP * segments.length);
    const startAngle = currentAngle + GAP / 2;
    const endAngle   = startAngle + angle;
    currentAngle     = endAngle + GAP / 2;
    return { ...seg, startAngle, endAngle, angle };
  });

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="rgba(255,255,255,0.04)" strokeWidth={thickness} />
        {arcs.map((arc, i) => {
          if (arc.angle < 0.5) return null;
          const start    = polar(cx, cy, r, arc.startAngle);
          const end      = polar(cx, cy, r, arc.endAngle);
          const largeArc = arc.angle > 180 ? 1 : 0;
          const d        = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
          return (
            <path key={i} d={d} fill="none"
              stroke={arc.colour} strokeWidth={thickness}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      {label !== undefined && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: Math.round(size * 0.13), fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>
            {label}
          </span>
          {sublabel && (
            <span style={{ fontSize: Math.round(size * 0.08), color: 'var(--text-muted)', marginTop: 3, textAlign: 'center' }}>
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Milestone Line (savings goals) ────────────────────────────────────────────
export function MilestoneLine({ milestones = [], progress = 0, colour = 'var(--accent)' }) {
  if (!milestones.length) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%', padding: '4px 0' }}>
      {milestones.map((m, i) => {
        const reached = progress >= m.pct;
        const isCurrent = !reached && (i === 0 || progress >= milestones[i - 1]?.pct);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            {/* Connector line before dot */}
            {i > 0 && (
              <div style={{
                flex: 1, height: 2,
                background: progress >= milestones[i - 1]?.pct
                  ? colour : 'rgba(255,255,255,0.08)',
                transition: 'background 0.4s ease',
              }} />
            )}
            {/* Dot */}
            <div title={m.label} style={{
              width: reached ? 14 : isCurrent ? 12 : 10,
              height: reached ? 14 : isCurrent ? 12 : 10,
              borderRadius: '50%',
              background: reached ? colour : isCurrent ? 'transparent' : 'rgba(255,255,255,0.08)',
              border: `2px solid ${reached || isCurrent ? colour : 'rgba(255,255,255,0.1)'}`,
              boxShadow: reached ? `0 0 8px ${colour}80` : 'none',
              transition: 'all 0.4s ease',
              flexShrink: 0,
            }} />
            {/* Connector line after last dot */}
            {i === milestones.length - 1 && (
              <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.08)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
