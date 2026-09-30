// One icon set for the app: 24 x 24 line icons drawn with the current text
// colour, so they follow the theme. Use <Icon name="..." size={16|18|20} />.
// Sizes: 16 inline with text and in lists, 18 in buttons and nav, 20 for
// headers. Stroke is fixed so every icon has the same visual weight.

export const ICON_PATHS = {
  // Screens
  dashboard:  'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  home:       'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  // 3D extruded V: front face + back face offset + three connector lines
  assistant:  'M4 5L12 19L20 5 M6 3L14 17L22 3 M4 5L6 3 M20 5L22 3 M12 19L14 17',
  tasks:      'M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  calendar:   'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  plan:       'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  notes:      'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  health:     'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  workout:    'M6.5 6.5h11v11h-11z M2 12h4 M18 12h4 M12 2v4 M12 18v4',
  coach:      'M7 7v10 M17 7v10 M4 9.5v5 M20 9.5v5 M7 12h10',
  goal:       'M12 22a10 10 0 100-20 10 10 0 000 20z M12 18a6 6 0 100-12 6 6 0 000 12z M12 14a2 2 0 100-4 2 2 0 000 4z',
  finance:    'M12 2v20 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  portfolio:  'M18 20V10 M12 20V4 M6 20v-6',
  progress:   'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  style:      'M20.84 7l-3-4H6.16L3 7l3.5 2V20h11V9L20.84 7zM9 4c0 1.65 1.35 3 3 3s3-1.35 3-3',
  essentials: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
  lists:      'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  focus:      'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2',
  vault:      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  settings:   'M12 20a8 8 0 100-16 8 8 0 000 16z M12 14a2 2 0 100-4 2 2 0 000 4z',
  routines:   'M4 4h16v2H4z M4 8h10v2H4z M4 12h16v2H4z M4 16h10v2H4z M17 15l4 4-4 4',
  mind:       'M9.5 2a2.5 2.5 0 015 0v.5A7.5 7.5 0 0117 9.5v1.5h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v.5a3.5 3.5 0 01-3.5 3.5h-3A3.5 3.5 0 017 16.5V16H6a1 1 0 01-1-1v-3a1 1 0 011-1h1V9.5A7.5 7.5 0 019.5 2.5z',
  places:     'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  // Sharp 'chad' face: chiselled jaw silhouette + brow ticks
  lm:         'M7 4L17 4L18 10.5L14.5 19L12 21L9.5 19L6 10.5Z M8.8 9H10.6 M13.4 9H15.2',
  // Actions and things
  brief:      'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5',
  mood:       'M12 22a10 10 0 100-20 10 10 0 000 20z M8 14s1.5 2 4 2 4-2 4-2 M9 9h.01 M15 9h.01',
  water:      'M12 2.7l5.66 5.66a8 8 0 11-11.31 0z',
  chart:      'M3 3v18h18 M7 15l4-4 3 3 5-6',
  review:     'M2 4h7a3 3 0 013 3v14a2 2 0 00-2-2H2z M22 4h-7a3 3 0 00-3 3v14a2 2 0 012-2h8z',
  today:      'M12 17a5 5 0 100-10 5 5 0 000 10z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42',
  trash:      'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6',
  plus:       'M12 5v14 M5 12h14',
  download:   'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  upload:     'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  theme:      'M12 22a10 10 0 110-20c5.5 0 10 4 10 9a5 5 0 01-5 5h-1.8a1.7 1.7 0 00-1.2 2.9A1.7 1.7 0 0112 22z M7.5 11h.01 M10.5 7h.01 M15.5 7.5h.01',
  task:       'M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  note:       'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6',
  event:      'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  search:     'M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35',
  bell:       'M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0',
  close:      'M18 6L6 18 M6 6l12 12',
  check:      'M5 12.5l5 4.5 9-10',
  chevronRight: 'M9 18l6-6-6-6',
};

export function Icon({ name, size = 18, strokeWidth = 1.75, style, title }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined}
      style={{ flexShrink: 0, display: 'block', ...style }}>
      {title && <title>{title}</title>}
      <path d={d} />
    </svg>
  );
}
