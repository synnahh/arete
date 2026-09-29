import { describe, it, expect } from 'vitest';
import { GROUPS, ALL_SCREENS, groupOf, groupScreens, resolveTarget, NAV_TARGETS } from './groups.js';

// Every screen Valerie had before the regroup (App.jsx TAB_MAP keys).
const LEGACY_SCREENS = [
  'dashboard', 'assistant', 'tasks', 'calendar', 'notes', 'health', 'workout',
  'finance', 'portfolio', 'progress', 'style', 'essentials', 'lists', 'focus',
  'vault', 'settings', 'routines', 'mind', 'lm', 'places',
];

describe('groups', () => {
  it('keeps every existing screen, each in exactly one group', () => {
    expect([...ALL_SCREENS].sort()).toEqual([...LEGACY_SCREENS].sort());
    expect(new Set(ALL_SCREENS).size).toBe(ALL_SCREENS.length);
  });

  it('has the six agreed groups in order', () => {
    expect(GROUPS.map(g => g.id)).toEqual(['home', 'plan', 'coach', 'mind', 'finance', 'settings']);
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
    expect(groupScreens('coach', { hidden: ['style'] })).toEqual(['workout', 'health', 'lm']);
    expect(groupScreens('settings', { hidden: ['settings', 'vault'] })).toEqual(['settings']);
  });

  it('follows the saved sidebar order, unknown ids last in default order', () => {
    const order = ['lm', 'dashboard', 'workout'];
    expect(groupScreens('coach', { order })).toEqual(['lm', 'workout', 'health', 'style']);
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
    expect(resolveTarget('coach', { lastByGroup: { coach: 'lm' }, hidden: ['lm'] })).toBe('workout');
  });

  it('opens a group at its first screen by default', () => {
    expect(resolveTarget('plan')).toBe('tasks');
  });

  it('rejects unknown targets', () => {
    expect(resolveTarget('rm -rf')).toBeNull();
  });

  it('lets the AI navigate to groups and screens', () => {
    expect(NAV_TARGETS).toContain('coach');
    expect(NAV_TARGETS).toContain('workout');
  });
});
