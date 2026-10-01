// DockRing — today's score as a small ring at the end of the dock. Click opens Home.
// Hidden until a Coach goal is set (there is nothing to score against).
import { useDayScore } from '../hooks/useDayScore.js';
import { useSettingsValue } from '../hooks/useSettingsValue.js';

const R = 15, C = 2 * Math.PI * R;

export default function DockRing({ onOpen }) {
  const settings = useSettingsValue();
  const result = useDayScore(settings);
  if (!result) return null;
  const { score } = result;
  return (
    <button type="button" className="dock-item dock-ring" data-tint="home" onClick={onOpen} aria-label={`Today ${score} out of 100. Open Home`}>
      <svg width="34" height="34" viewBox="0 0 38 38" aria-hidden="true">
        <circle cx="19" cy="19" r={R} fill="none" stroke="var(--card-border)" strokeWidth="3.5" />
        <circle cx="19" cy="19" r={R} fill="none" stroke="var(--tab-accent)" strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} transform="rotate(-90 19 19)" />
      </svg>
      <span className="val-num" style={{ position: 'absolute', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{score}</span>
      <span className="dock-tip" role="tooltip"><strong>Today · {score}/100</strong><em>Score against your goal</em></span>
    </button>
  );
}
