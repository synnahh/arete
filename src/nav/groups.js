// groups.js — Arete navigation: six groups for a gym and looks app (Home, Train, Fuel, Look, Progress, Profile).
//
// Screen ids are unchanged ('workout', 'tasks', ...), so AI navigate actions,
// the command palette, nudges, hidden-tab settings and saved sidebar order all
// keep working. A group is only a way of showing those screens together.

export const GROUPS = [
  { id: 'home',     label: 'Home',     desc: 'Today at a glance',                          screens: ['dashboard'] },
  { id: 'train',    label: 'Train',    desc: 'Your session, split and exercises',      screens: ['workout'] },
  { id: 'eat',      label: 'Fuel',     desc: 'Meals, water, supplements and supplies',     screens: ['fuel', 'essentials'] },
  { id: 'look',     label: 'Look',     desc: 'Skin, hair, grooming and style',             screens: ['lm', 'style'] },
  { id: 'results',  label: 'Progress', desc: 'Weight, photos, goal, sleep, habits',        screens: ['body', 'goal', 'recover', 'habits', 'insights'] },
  { id: 'settings', label: 'Profile',  desc: 'Profile and settings',                        screens: ['profile', 'settings'] },
];

// Section labels inside a group. Screens keep their ids; only the label changes.
export const SCREEN_LABELS = {
  dashboard: 'Today',
  workout: 'Train', essentials: 'Supplies', fuel: 'Fuel', lm: 'Look', style: 'Style',
  body: 'Body', goal: 'Goal', recover: 'Sleep', habits: 'Habits', insights: 'Insights',
  profile: 'Profile', settings: 'Settings',
};

export const DEFAULT_SCREEN = 'dashboard';

// Old ids that now open a newer screen. This is a gym and looks app: tasks, calendar, notes, money,
// focus and the mind screens were taken out of the menus (their saved data is untouched). Any old
// link, notification or saved "last screen" for them opens Home instead of a blank page.
export const SCREEN_ALIASES = {
  health: 'goal', assistant: 'dashboard',
  coachtoday: 'dashboard', agenda: 'dashboard', tasks: 'dashboard', calendar: 'dashboard', routines: 'dashboard', focus: 'dashboard',
  progress: 'dashboard', places: 'dashboard', notes: 'dashboard', lists: 'dashboard',
  finance: 'dashboard', moneytoday: 'dashboard', portfolio: 'dashboard', vault: 'dashboard', mind: 'dashboard', mindtoday: 'dashboard',
  plan: 'dashboard', coach: 'workout',
};

// Settings can never be hidden, or there would be no way to unhide anything.
const NEVER_HIDDEN = new Set(['settings']);

const GROUP_BY_ID = new Map(GROUPS.map(g => [g.id, g]));
const GROUP_BY_SCREEN = new Map(GROUPS.flatMap(g => g.screens.map(s => [s, g])));

export const ALL_SCREENS = GROUPS.flatMap(g => g.screens);

export function isScreen(id) { return GROUP_BY_SCREEN.has(id); }
const unalias = (id) => SCREEN_ALIASES[id] ?? id;
export function isGroup(id)  { return GROUP_BY_ID.has(id); }

/** The group a screen belongs to (Home for anything unknown). */
export function groupOf(screenId) {
  return GROUP_BY_SCREEN.get(unalias(screenId)) ?? GROUPS[0];
}

/**
 * A group's visible screens, in the user's saved order where one exists.
 * `hidden` and `order` are the existing hiddenTabs / sidebar-order settings,
 * both keyed by screen id.
 */
export function groupScreens(groupId, { hidden = [], order = null } = {}) {
  const g = GROUP_BY_ID.get(groupId);
  if (!g) return [];
  let screens = g.screens;
  if (Array.isArray(order) && order.length) {
    const rank = new Map(order.map((id, i) => [id, i]));
    screens = screens
      .map((id, i) => ({ id, r: rank.has(id) ? rank.get(id) : order.length + i }))
      .sort((a, b) => a.r - b.r)
      .map(x => x.id);
  }
  const hiddenSet = new Set(hidden.map(unalias)); // a hidden 'health' hides Goal HQ
  return screens.filter(id => NEVER_HIDDEN.has(id) || !hiddenSet.has(id));
}

/**
 * Turn a navigation target (screen id or group id) into the screen to show.
 * A group opens its last-visited screen if still visible, else its first.
 * Returns null for anything unrecognised so callers can ignore bad targets.
 */
export function resolveTarget(target, { hidden = [], order = null, lastByGroup = {} } = {}) {
  target = unalias(target);
  if (isScreen(target)) return target;
  if (!isGroup(target)) return null;
  const visible = groupScreens(target, { hidden, order });
  const last = lastByGroup[target];
  if (last && visible.includes(last)) return last;
  return visible[0] ?? null;
}

// Coach splits the old Health screen: each Coach screen shows these Health
// sections (ids from Health.jsx SUB_SECTIONS), in this order.
export const HEALTH_SECTIONS_BY_SCREEN = {
  goal:    ['overview'],
  fuel:    ['nutrition', 'mealplan', 'water', 'supplements', 'stimulant'],
  recover: ['sleep', 'peakstate'],
  body:    ['body'],
  habits:  ['habits'],
};
export const SCREEN_FOR_HEALTH_SECTION = Object.fromEntries(
  Object.entries(HEALTH_SECTIONS_BY_SCREEN).flatMap(([screen, secs]) => secs.map(s => [s, screen]))
);

/** Every target the AI may navigate to: screens and groups. */
export const NAV_TARGETS = [...ALL_SCREENS, ...Object.keys(SCREEN_ALIASES), ...GROUPS.map(g => g.id)];
