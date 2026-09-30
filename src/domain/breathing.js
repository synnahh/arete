// breathing.js — timed breathing patterns. Pure: given a pattern and how long the
// exercise has run, say which phase you are in and how far through it. The
// component (components/BreathingTool.jsx) only draws it. Not medical advice; the
// long-exhale patterns are widely used to settle down, nothing more is claimed.

// phases: [label, seconds, 'in' | 'hold' | 'out']
export const PATTERNS = {
  box:   { name: 'Box', blurb: 'Even and steady. Good before something demanding.', phases: [['Breathe in', 4, 'in'], ['Hold', 4, 'hold'], ['Breathe out', 4, 'out'], ['Hold', 4, 'hold']] },
  calm:  { name: '4-7-8', blurb: 'Long, slow exhale. Good for winding down before bed.', phases: [['Breathe in', 4, 'in'], ['Hold', 7, 'hold'], ['Breathe out', 8, 'out']] },
  sigh:  { name: 'Quick reset', blurb: 'Two short in-breaths, one long out. A fast way to ease tension.', phases: [['Breathe in', 2, 'in'], ['Sip in more', 1, 'in'], ['Long breath out', 6, 'out']] },
};
export const DURATIONS_MIN = [1, 3, 5];

export const cycleSeconds = (pattern) => pattern.phases.reduce((s, p) => s + p[1], 0);

/**
 * Where you are after `elapsedMs`: { done, phase, kind, remaining (whole seconds left in this phase),
 * progress (0-1 through the phase), cycle (1-based), scale (0.55-1 for a circle: grows on in, shrinks on out) }.
 * done is true once `totalMs` has passed.
 */
export function phaseAt(pattern, elapsedMs, totalMs) {
  const total = cycleSeconds(pattern) * 1000;
  const t = Math.max(0, elapsedMs);
  if (Number.isFinite(totalMs) && t >= totalMs) return { done: true, phase: 'Done', kind: 'done', remaining: 0, progress: 1, cycle: Math.ceil(totalMs / total), scale: 0.55 };
  const cycle = Math.floor(t / total);
  let within = t - cycle * total;
  for (let i = 0; i < pattern.phases.length; i++) {
    const [label, secs, kind] = pattern.phases[i];
    const len = secs * 1000;
    if (within < len) {
      const progress = within / len;
      const scale = kind === 'in' ? 0.55 + 0.45 * progress : kind === 'out' ? 1 - 0.45 * progress : (heldAfter(pattern, i) === 'in' ? 1 : 0.55);
      return { done: false, phase: label, kind, remaining: Math.ceil((len - within) / 1000), progress, cycle: cycle + 1, scale };
    }
    within -= len;
  }
  return { done: false, phase: pattern.phases[0][0], kind: pattern.phases[0][2], remaining: pattern.phases[0][1], progress: 0, cycle: cycle + 1, scale: 0.55 };
}

// A hold keeps the size of the breath before it: full after breathing in, small after breathing out.
function heldAfter(pattern, i) {
  for (let k = 1; k <= pattern.phases.length; k++) {
    const kind = pattern.phases[(i - k + pattern.phases.length) % pattern.phases.length][2];
    if (kind !== 'hold') return kind;
  }
  return 'out';
}
