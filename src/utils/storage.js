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
};
