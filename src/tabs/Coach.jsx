//  Coach screens built from Valerie's existing Health tab. Each shows the
//  Health sections listed in HEALTH_SECTIONS_BY_SCREEN (src/nav/groups.js).
import Health from './Health.jsx';
import GoalHQ from './GoalHQ.jsx';
import { HEALTH_SECTIONS_BY_SCREEN } from '../nav/groups.js';

const slice = (screen) => function CoachSlice(props) {
  return <Health {...props} sections={HEALTH_SECTIONS_BY_SCREEN[screen]} />;
};

export const Fuel    = slice('fuel');
export const Recover = slice('recover');
export const Body    = slice('body');
export const Habits  = slice('habits');

// Goal HQ with today's Health overview underneath.
export function Goal(props) {
  return <GoalHQ {...props} overview={<Health {...props} sections={HEALTH_SECTIONS_BY_SCREEN.goal} />} />;
}
