// AreteLogo — the emblem, in the colourway that goes with the current theme.
// Files are in src/public/assets (black knocked out to transparent).
import { useEffect, useState } from 'react';

// Explicit map (no string-built names): theme -> colourway.
const VARIANT_BY_THEME = {
  obsidian: 'silver',
  midnight: 'silver',
  ember:    'gold',
  phantom:  'violet',
  arctic:   'gold',
  crimson:  'gold',
};
const EMBLEM = {
  silver: '/assets/arete-emblem-silver.png',
  gold:   '/assets/arete-emblem-gold.png',
  violet: '/assets/arete-emblem-violet.png',
};
const FULL = {
  silver: '/assets/arete-silver.png',
  gold:   '/assets/arete-gold.png',
  violet: '/assets/arete-violet.png',
};

const readTheme = () => (typeof document === 'undefined' ? 'obsidian' : document.documentElement.getAttribute('data-theme') || 'obsidian');

export function useLogoVariant() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setTheme(readTheme()));
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return VARIANT_BY_THEME[theme] || 'silver';
}

/** `full` shows the wordmark too (use at 120px or more); the default is the emblem alone. */
export default function AreteLogo({ full = false, alt = 'Arete', style, ...rest }) {
  const variant = useLogoVariant();
  const light = (typeof document !== 'undefined') && document.documentElement.getAttribute('data-theme') === 'arctic';
  return (
    <img
      src={(full ? FULL : EMBLEM)[variant]}
      alt={alt}
      draggable={false}
      style={{ objectFit: 'contain', ...(light ? { filter: 'brightness(0.62) saturate(1.4)' } : null), ...style }}
      {...rest}
    />
  );
}
