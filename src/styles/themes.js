// Theme definitions — each is a complete visual package
// The 'key' maps to the data-theme attribute on <html>

export const THEMES = {
  obsidian: {
    key: 'obsidian',
    name: 'Obsidian',
    description: 'Deep black, silver & white',
    preview: { bg: '#080c14', accent: '#d2d2d2', sidebar: '#0d0f14' },
  },
  midnight: {
    key: 'midnight',
    name: 'Midnight',
    description: 'Deep navy, electric blue',
    preview: { bg: '#070b14', accent: '#64a0ff', sidebar: '#0a0f1e' },
  },
  ember: {
    key: 'ember',
    name: 'Ember',
    description: 'Dark charcoal, warm amber',
    preview: { bg: '#0e0a06', accent: '#e69628', sidebar: '#140e08' },
  },
  phantom: {
    key: 'phantom',
    name: 'Phantom',
    description: 'Near-black, deep purple',
    preview: { bg: '#08060e', accent: '#a064e6', sidebar: '#0e0a18' },
  },
  arctic: {
    key: 'arctic',
    name: 'Arctic',
    description: 'Clean white, cool blue',
    preview: { bg: '#f4f6f9', accent: '#3c78c8', sidebar: '#ebeef2' },
    light: true,
  },
  crimson: {
    key: 'crimson',
    name: 'Crimson',
    description: 'Deep dark red',
    preview: { bg: '#0e0606', accent: '#dc4646', sidebar: '#160a0a' },
  },
};

export const THEME_KEYS = Object.keys(THEMES);
export const DEFAULT_THEME = 'obsidian';

/** Apply a theme instantly by setting data-theme on <html> */
export function applyTheme(themeKey) {
  const key = THEME_KEYS.includes(themeKey) ? themeKey : DEFAULT_THEME;
  document.documentElement.setAttribute('data-theme', key);
  return key;
}
