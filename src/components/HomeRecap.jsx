// The recap (Monday and Tuesday, until dismissed) and the logging streak, for Home.
import { useRecap } from '../hooks/useRecap.js';
import RecapCard from './RecapCard.jsx';
import StreakCard from './StreakCard.jsx';

export function HomeRecap({ compact = false }) {
  const { recap, dueOnHome, dismiss } = useRecap();
  if (!dueOnHome) return null;
  return <RecapCard recap={recap} onDismiss={dismiss} compact={compact} />;
}

export function HomeStreak({ compact = false }) {
  const { streak } = useRecap();
  if (!streak || (streak.current === 0 && streak.best === 0)) return null;
  return <StreakCard streak={streak} compact={compact} />;
}
