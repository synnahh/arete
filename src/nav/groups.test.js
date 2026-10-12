import { describe, it, expect } from 'vitest';
import { GROUPS, ALL_SCREENS, groupOf, groupScreens, resolveTarget, NAV_TARGETS, HEALTH_SECTIONS_BY_SCREEN, SCREEN_FOR_HEALTH_SECTION } from './groups.js';

// Every screen Valerie had before the regroup (App.jsx TAB_MAP keys).
const LEGACY_SCREENS = [
  'dashboard', 'assistant', 'tasks', 'calendar', 'notes', 'health', 'workout',
  'finance', 'portfolio', 'progress', 'style', 'essentials', 'lists', 'focus',
  'vault', 'settings', 'routines', 'mind', 'lm', 'places',
];

describe('groups', () => {
  it('every pre-regroup id still opens a screen', () => {
    for (const id of LEGACY_SCREENS) expect(ALL_SCREENS).toContain(resolveTarget(id));
  });

  it('puts each screen in exactly one group', () => {
    expect(new Set(ALL_SCREENS).size).toBe(ALL_SCREENS.length);
  });

  it('opens old Health links on Goal HQ', () => {
    expect(resolveTarget('health')).toBe('goal');
    expect(groupOf('health').id).toBe('coach');
    expect(NAV_TARGETS).toContain('health');
  });

  it('gives every Health section exactly one Coach screen', () => {
    const all = Object.values(HEALTH_SECTIONS_BY_SCREEN).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(['body','habits','mealplan','nutrition','overview','peakstate','sleep','stimulant','supplements','water']);
    expect(SCREEN_FOR_HEALTH_SECTION.water).toBe('fuel');
    for (const screen of Object.keys(HEALTH_SECTIONS_BY_SCREEN)) expect(groupOf(screen).id).toBe('coach');
  });

  it('has the five groups in order', () => {
    expect(GROUPS.map(g => g.id)).toEqual(['home', 'plan', 'coach', 'finance', 'settings']);
  });

  it('maps screens to their group', () => {
    expect(groupOf('workout').id).toBe('coach');
    expect(groupOf('lm').id).toBe('coach');
    expect(groupOf('essentials').id).toBe('plan');
    expect(groupOf('vault').id).toBe('settings');
    expect(groupOf('nonsense').id).toBe('home');
  });
});

describe('groupScreens', () => {
  it('drops hidden screens but never Settings', () => {
    expect(groupScreens('coach', { hidden: ['style', 'body'] })).toEqual(['coachtoday', 'goal', 'workout', 'fuel', 'recover', 'lm', 'habits', 'insights']);
    expect(groupScreens('settings', { hidden: ['settings', 'vault'] })).toEqual(['profile', 'settings']);
  });

  it('follows the saved sidebar order, unknown ids last in default order', () => {
    const order = ['lm', 'dashboard', 'workout'];
    expect(groupScreens('coach', { order })).toEqual(['lm', 'workout', 'coachtoday', 'goal', 'fuel', 'recover', 'body', 'habits', 'style', 'insights']);
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
    expect(resolveTarget('coach', { lastByGroup: { coach: 'lm' } })).toBe('lm');
    expect(resolveTarget('coach', { lastByGroup: { coach: 'lm' }, hidden: ['lm'] })).toBe('coachtoday');
  });

  it('opens a group at its first screen by default', () => {
    expect(resolveTarget('plan')).toBe('agenda');
  });

  it('rejects unknown targets', () => {
    expect(resolveTarget('rm -rf')).toBeNull();
  });

  it('lets the AI navigate to groups and screens', () => {
    expect(NAV_TARGETS).toContain('coach');
    expect(NAV_TARGETS).toContain('workout');
  });
});
