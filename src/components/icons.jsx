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
  settings:   'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
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
  // Coach sub-screens
  bolt:       'M13 2L4 14h7l-1 8 9-12h-7z',
  moon:       'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  pill:       'M10.5 20.5l10-10a4.95 4.95 0 10-7-7l-10 10a4.95 4.95 0 107 7z M8.5 8.5l7 7',
  coffee:     'M17 8h1a4 4 0 010 8h-1 M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4z M6 2v2 M10 2v2 M14 2v2',
  utensils:   'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2 M7 2v20 M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7',
  scale:      'M12 3v18 M5 7h14 M5 7l-3 7a3.5 3.5 0 006 0z M19 7l-3 7a3.5 3.5 0 006 0z M8 21h8',
  trending:   'M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6',
  activity:   'M22 12h-4l-3 9L9 3l-3 9H2',
  checkCircle:'M22 11.08V12a10 10 0 11-5.93-9.14 M22 4L12 14.01l-3-3',
  alert:      'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
  card:       'M2 5h20v14H2z M2 10h20',
  repeat:     'M17 1l4 4-4 4 M3 11V9a4 4 0 014-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 01-4 4H3',
  lock:       'M5 11h14v10H5z M8 11V7a4 4 0 118 0v4',
  sparkle:    'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z M19 17l.9 2.1L22 20l-2.1.9L19 23l-.9-2.1L16 20l2.1-.9z',
  music:      'M9 18V5l12-2v13 M6 21a3 3 0 100-6 3 3 0 000 6z M18 19a3 3 0 100-6 3 3 0 000 6z',
  key:        'M21 2l-2 2 M15.5 7.5L19 4 M15.5 7.5a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78z',
  mic:        'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8',
  mealplan:   'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z M8 14h8 M8 18h5',
  play:       'M7 4.5v15l12-7.5z',
  pause:      'M7 4h3.5v16H7z M13.5 4H17v16h-3.5z',
  skip:       'M5 4.5v15l10-7.5z M18 5v14',
  reset:      'M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8 M3 3v5h5',
  user:       'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z',
  plug:       'M9 2v6 M15 2v6 M6 8h12v4a6 6 0 01-12 0z M12 18v4',
  cpu:        'M6 6h12v12H6z M9 9h6v6H9z M9 2v4 M15 2v4 M9 18v4 M15 18v4 M2 9h4 M2 15h4 M18 9h4 M18 15h4',
  globe:      'M12 22a10 10 0 100-20 10 10 0 000 20z M2 12h20 M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z',
  monitor:    'M2 3h20v14H2z M8 21h8 M12 17v4',
  database:   'M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3z M21 12c0 1.66-4 3-9 3s-9-1.34-9-3 M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5',
  cloud:      'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z',
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
