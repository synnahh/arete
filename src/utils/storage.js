// localStorage helpers — all VALERIE data uses these

const PREFIX = 'valerie_';

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
    catch (e) { console.error('storage.set failed:', e); }
  },
  remove(key) {
    localStorage.removeItem(PREFIX + key);
  },
  clear() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  },
};

// Specific keys
export const STORAGE_KEYS = {
  ONBOARDED:    'onboarded',        // flag — onboarding complete
  SETTINGS:     'settings',         // all app preferences
  USER:         'user',             // name, title
  TASKS:        'tasks',
  NOTES:        'notes',
  EVENTS:       'events',
  CONVERSATIONS:'conversations',
  MACROS:       'macros',
  STIMULANTS:   'stimulants',
  FINANCE:      'finance',
  HEALTH:       'health',
  ESSENTIALS:   'essentials',
  LISTS:        'lists',
  VAULT:        'vault_meta',       // vault metadata only — never store plaintext passwords
  PROGRESS:     'progress',
  MOOD:         'mood',
  // Session 4 additions
  HABITS:        'habits',
  WATER:         'water',
  WORKOUT:       'workout',
  WORKOUT_LOGS:  'workout_logs',
  BODY:          'body',
  SUPPLEMENTS:   'supplements',
  SUPP_LOGS:     'supplement_logs',
  SLEEP:         'sleep',
  TRANSACTIONS:   'transactions',
  SAVINGS:        'savings',
  SUBSCRIPTIONS:  'subscriptions',
  // Session 5 additions
  FOCUS_SESSIONS: 'focus_sessions',
  GOALS:          'goals',
  STYLE_BOARD:    'style_board',
  MOOD_LOGS:      'mood_logs',
  XP:             'xp',
  // Session 6 additions
  ROUTINES:             'routines',
  SIDEBAR_ORDER_DESKTOP:'sidebar_order_desktop',
  SIDEBAR_ORDER_IOS:    'sidebar_order_ios',
  DAILY_BRIEF_DATE:     'daily_brief_date',
  SAVED_MEALS:          'saved_meals',
  SLEEP_SCHEDULE:       'sleep_schedule',
};
