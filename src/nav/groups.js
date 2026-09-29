// groups.js — Arete navigation: six groups laid over Valerie's existing screens.
//
// Screen ids are unchanged ('workout', 'tasks', ...), so AI navigate actions,
// the command palette, nudges, hidden-tab settings and saved sidebar order all
// keep working. A group is only a way of showing those screens together.

export const GROUPS = [
  { id: 'home',     label: 'Home',     desc: 'Today at a glance',                 screens: ['dashboard', 'assistant'] },
  { id: 'plan',     label: 'Plan',     desc: 'Tasks · Calendar · Routines · Supplies', screens: ['tasks', 'calendar', 'routines', 'focus', 'progress', 'essentials', 'places'] },
  { id: 'coach',    label: 'Coach',    desc: 'Train · Health · Look · Style',     screens: ['workout', 'health', 'lm', 'style'] },
  { id: 'mind',     label: 'Mind',     desc: 'Mind · Notes · Lists',              screens: ['mind', 'notes', 'lists'] },
  { id: 'finance',  label: 'Finance',  desc: 'Money · Portfolio',                 screens: ['finance', 'portfolio'] },
  { id: 'settings', label: 'Settings', desc: 'Settings · Vault',                  screens: ['settings', 'vault'] },
];

// Section labels inside a group. Screens keep their ids; only the label changes.
export const SCREEN_LABELS = {
  dashboard: 'Today',    assistant: 'Ask',
  tasks: 'Tasks',        calendar: 'Calendar',  routines: 'Routines', focus: 'Focus',
  progress: 'Progress',  essentials: 'Supplies', places: 'Places',
  workout: 'Train',      health: 'Health',      lm: 'Look',           style: 'Style',
  mind: 'Mind',          notes: 'Notes',        lists: 'Lists',
  finance: 'Money',      portfolio: 'Portfolio',
  settings: 'Settings',  vault: 'Vault',
};

export const DEFAULT_SCREEN = 'dashboard';

// Settings can never be hidden, or there would be no way to unhide anything.
const NEVER_HIDDEN = new Set(['settings']);

const GROUP_BY_ID = new Map(GROUPS.map(g => [g.id, g]));
const GROUP_BY_SCREEN = new Map(GROUPS.flatMap(g => g.screens.map(s => [s, g])));

export const ALL_SCREENS = GROUPS.flatMap(g => g.screens);

export function isScreen(id) { return GROUP_BY_SCREEN.has(id); }
export function isGroup(id)  { return GROUP_BY_ID.has(id); }

/** The group a screen belongs to (Home for anything unknown). */
export function groupOf(screenId) {
  return GROUP_BY_SCREEN.get(screenId) ?? GROUPS[0];
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
  return screens.filter(id => NEVER_HIDDEN.has(id) || !hidden.includes(id));
}

/**
 * Turn a navigation target (screen id or group id) into the screen to show.
 * A group opens its last-visited screen if still visible, else its first.
 * Returns null for anything unrecognised so callers can ignore bad targets.
 */
export function resolveTarget(target, { hidden = [], order = null, lastByGroup = {} } = {}) {
  if (isScreen(target)) return target;
  if (!isGroup(target)) return null;
  const visible = groupScreens(target, { hidden, order });
  const last = lastByGroup[target];
  if (last && visible.includes(last)) return last;
  return visible[0] ?? null;
}

/** Every target the AI may navigate to: screens and groups. */
export const NAV_TARGETS = [...ALL_SCREENS, ...GROUPS.map(g => g.id)];
