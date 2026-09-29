// appearance.js — applies every Settings → Appearance choice to <html> in one
// place, so desktop, phone and live settings changes all agree.
import { applyTheme } from './themes.js';

export const HEADING_FONTS = {
  classical: "'Cinzel', serif",
  expanded:  "'Archivo', sans-serif",
};

/** Theme, accent, fonts, tab colours and animation intensity. */
export function applyAppearance(s = {}) {
  const root = document.documentElement;

  applyTheme(s.theme || 'obsidian');
  root.style.removeProperty('--accent');
  root.style.removeProperty('--accent-solid');
  if (s.accentColorHex) {
    root.style.setProperty('--accent',       s.accentColorHex);
    root.style.setProperty('--accent-solid', s.accentColorHex);
  }

  if (s.fontFamily) root.style.setProperty('--font-family', s.fontFamily);
  const heading = s.headingFont ?? 'classical';
  root.style.setProperty('--font-display',
    heading === 'body'
      ? "var(--font-family, 'DM Sans', sans-serif)"
      : (HEADING_FONTS[heading] ?? HEADING_FONTS.classical));

  root.dataset.tabColours = s.tabColours === 'theme' ? 'theme' : 'per-tab';

  const motion = ['full', 'reduced', 'none'].includes(s.animationIntensity) ? s.animationIntensity : 'full';
  root.dataset.motion = motion;
  if (motion === 'none') root.dataset.reduceMotion = 'true';
  else delete root.dataset.reduceMotion;
}

/** Marks the active navigation group so --tab-accent follows it. */
export function setActiveGroup(groupId) {
  document.documentElement.dataset.group = groupId;
}

/** Class for the app root from the Background setting and time of day. */
export function backgroundClass(style, timeOfDay) {
  if (style === 'solid') return 'bg-solid';
  if (style === 'noise') return 'bg-noise';
  if (style === 'animated-gradient') return 'bg-animated';
  return `bg-${timeOfDay}`;
}
