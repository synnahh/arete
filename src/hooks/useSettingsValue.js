// useSettingsValue — the saved settings object, kept current when anything saves settings.
import { useEffect, useState } from 'react';
import { storage, STORAGE_KEYS } from '../utils/storage.js';

export function useSettingsValue() {
  const [settings, setSettings] = useState(() => storage.get(STORAGE_KEYS.SETTINGS, {}) || {});
  useEffect(() => {
    const on = (e) => setSettings(e.detail || storage.get(STORAGE_KEYS.SETTINGS, {}) || {});
    window.addEventListener('valerie:settings-changed', on);
    return () => window.removeEventListener('valerie:settings-changed', on);
  }, []);
  return settings;
}
