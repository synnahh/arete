import { describe, it, expect } from 'vitest';
import { GROUPS, ALL_SCREENS, groupOf, groupScreens, resolveTarget, NAV_TARGETS, HEALTH_SECTIONS_BY_SCREEN, SCREEN_FOR_HEALTH_SECTION, BAR_ORDER, inBarOrder } from './groups.js';

// Every screen the app has ever had. Old links, notifications and saved "last screen" values must
// still open something real, never a blank page.
const LEGACY_SCREENS = [
  'dashboard', 'assistant', 'tasks', 'calendar', 'notes', 'health', 'workout',
  'finance', 'portfolio', 'progress', 'style', 'essentials', 'lists', 'focus',
  'vault', 'settings', 'routines', 'mind', 'lm', 'places',
  'agenda', 'coachtoday', 'moneytoday', 'mindtoday', 'plan', 'coach',
];

describe('groups', () => {
  it('every old id still opens a real screen', () => {
    for (const id of LEGACY_SCREENS) expect(ALL_SCREENS).toContain(resolveTarget(id));
  });

  it('removed non-gym screens open Home, not a blank page', () => {
    for (const id of ['tasks', 'finance', 'portfolio', 'calendar', 'notes', 'vault', 'focus', 'agenda', 'moneytoday']) {
      expect(resolveTarget(id)).toBe('dashboard');
    }
    expect(resolveTarget('coach')).toBe('workout');
  });

  it('keeps no money, tasks or planner screens in the menus', () => {
    for (const gone of ['tasks', 'finance', 'portfolio', 'calendar', 'notes', 'lists', 'vault', 'focus', 'routines', 'places', 'mind', 'agenda', 'moneytoday', 'mindtoday', 'coachtoday']) {
      expect(ALL_SCREENS).not.toContain(gone);
    }
  });

  it('puts each screen in exactly one group', () => {
    expect(new Set(ALL_SCREENS).size).toBe(ALL_SCREENS.length);
  });

  it('opens old Health links on Goal HQ', () => {
    expect(resolveTarget('health')).toBe('goal');
    expect(groupOf('health').id).toBe('results');
    expect(NAV_TARGETS).toContain('health');
  });

  it('gives every Health section exactly one screen', () => {
    const all = Object.values(HEALTH_SECTIONS_BY_SCREEN).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(['body', 'habits', 'mealplan', 'nutrition', 'overview', 'peakstate', 'sleep', 'stimulant', 'supplements', 'water']);
    expect(SCREEN_FOR_HEALTH_SECTION.water).toBe('fuel');
    for (const screen of Object.keys(HEALTH_SECTIONS_BY_SCREEN)) expect(ALL_SCREENS).toContain(screen);
  });

  it('has the six groups in order: Home, Train, Fuel, Look, Progress, Profile', () => {
    expect(GROUPS.map(g => g.id)).toEqual(['home', 'train', 'eat', 'look', 'results', 'settings']);
    expect(GROUPS.map(g => g.label)).toEqual(['Home', 'Train', 'Fuel', 'Look', 'Progress', 'Profile']);
  });

  it('puts Home in the middle of the bar, with Profile behind its own icon', () => {
    expect(BAR_ORDER).toEqual(['train', 'eat', 'home', 'look', 'results']);
    expect(inBarOrder(GROUPS).map(g => g.id)).toEqual(['train', 'eat', 'home', 'look', 'results', 'settings']);
  });

  it('maps screens to their group', () => {
    expect(groupOf('workout').id).toBe('train');
    expect(groupOf('fuel').id).toBe('eat');
    expect(groupOf('essentials').id).toBe('eat');
    expect(groupOf('lm').id).toBe('look');
    expect(groupOf('style').id).toBe('look');
    expect(groupOf('body').id).toBe('results');
    expect(groupOf('recover').id).toBe('results');
    expect(groupOf('settings').id).toBe('settings');
    expect(groupOf('nonsense').id).toBe('home');
  });

  it('no group has more than five chips, so a tab never gets cluttered', () => {
    for (const g of GROUPS) expect(g.screens.length).toBeLessThanOrEqual(5);
  });
});

describe('groupScreens', () => {
  it('drops hidden screens but never Settings', () => {
    expect(groupScreens('results', { hidden: ['habits', 'insights'] })).toEqual(['body', 'goal', 'recover']);
    expect(groupScreens('settings', { hidden: ['settings', 'profile'] })).toEqual(['settings']);
  });

  it('follows the saved order, unknown ids last in default order', () => {
    expect(groupScreens('results', { order: ['recover', 'dashboard', 'body'] })).toEqual(['recover', 'body', 'goal', 'habits', 'insights']);
  });

  it('returns nothing for an unknown group', () => {
    expect(groupScreens('nope')).toEqual([]);
  });
});

describe('resolveTarget', () => {
  it('passes screen ids straight through', () => {
    expect(resolveTarget('workout')).toBe('workout');
  });

  it('opens a group at its last-visited screen when still visible', () => {
    expect(resolveTarget('results', { lastByGroup: { results: 'recover' } })).toBe('recover');
    expect(resolveTarget('results', { lastByGroup: { results: 'recover' }, hidden: ['recover'] })).toBe('body');
  });

  it('opens a group at its first screen by default', () => {
    expect(resolveTarget('look')).toBe('lm');
    expect(resolveTarget('eat')).toBe('fuel');
  });

  it('rejects unknown targets', () => {
    expect(resolveTarget('rm -rf')).toBeNull();
  });

  it('lets navigation reach groups and screens', () => {
    expect(NAV_TARGETS).toContain('results');
    expect(NAV_TARGETS).toContain('workout');
  });
});
