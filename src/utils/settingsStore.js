// settingsStore.js — the one way to save settings from anywhere in the app:
// merge into localStorage, sync the full row to Supabase (so the iOS PWA can
// pull it), and tell App so appearance and consumers update live.
// Extracted from Settings.jsx handleSave; behaviour is unchanged.
import { storage, STORAGE_KEYS } from './storage.js';
import { supabase, getUserIdSync } from '../supabase/supabase.js';

const toast = (message) =>
  window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type: 'error' } }));

/**
 * Merge `updates` over `base` (default: stored settings) and persist.
 * Returns the merged settings.
 */
export function updateSettings(updates, base = storage.get(STORAGE_KEYS.SETTINGS, {})) {
  // Strip any non-serialisable data before merging (prevents localStorage QuotaExceededError)
  const safeUpdates = JSON.parse(JSON.stringify(updates));
  const merged = { ...base, ...safeUpdates };
  try { storage.set(STORAGE_KEYS.SETTINGS, merged); } catch {}

  // Sync full settings to Supabase so iOS PWA can pull them on first launch.
  // This is a single-user personal app — keys are safe in the user's own row.
  const userId = getUserIdSync();
  if (!userId) {
    console.error('[Settings sync] not signed in — saved locally only');
    toast('⚠️ Not signed in — settings saved on this device only');
  } else {
    supabase.from('user_meta').upsert({ user_id: userId, key: 'settings', value: merged }, { onConflict: 'user_id,key' }).then(({ error }) => {
      if (error) {
        console.error('[Settings sync]', error.message);
        toast(`⚠️ Couldn't sync settings — ${error.message}`);
      }
    });
  }

  window.dispatchEvent(new CustomEvent('valerie:settings-changed', { detail: merged }));
  return merged;
}
