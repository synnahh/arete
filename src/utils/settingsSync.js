// settingsSync.js — keeps settings the same on every device. A change on the desktop reaches
// the iPhone within a moment (and back), instead of only on a device's very first launch.
// The synced row never holds credentials (settingsForSync strips them), so the merge keeps this
// device's own local-only values and lays the other device's settings over everything else.

import { supabase } from '../supabase/supabase.js';
import { storage, STORAGE_KEYS } from './storage.js';
import { settingsForSync, stripLegacyClaudeKeys } from './settingsSecurity.js';
import { hasPendingDoc, flushDocs } from '../supabase/docQueue.js';

const stable = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x));

/**
 * The settings to use after receiving `remote`, or null when nothing needs to change
 * (it is not an object, or it is just our own last save coming back).
 */
export function mergeRemoteSettings(local, remote) {
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return null;
  const mine = local && typeof local === 'object' ? local : {};
  if (stable(settingsForSync(mine)) === stable(settingsForSync(remote))) return null;
  return stripLegacyClaudeKeys({ ...mine, ...remote });
}

/**
 * Pull the settings row once, then follow changes live. `onApplied(merged)` runs when this
 * device's settings changed because of another device. Returns a function that stops it.
 */
export function startSettingsSync(userId, onApplied) {
  if (!userId) return () => {};
  let alive = true;
  const apply = (remote) => {
    if (!alive) return;
    if (hasPendingDoc('settings')) { flushDocs(); return; }   // a change made offline is newer than what the server has
    const merged = mergeRemoteSettings(storage.get(STORAGE_KEYS.SETTINGS, {}), remote);
    if (!merged) return;
    storage.set(STORAGE_KEYS.SETTINGS, merged);
    onApplied?.(merged);
  };

  supabase.from('user_meta').select('value').eq('user_id', userId).eq('key', 'settings').maybeSingle()
    .then(({ data, error }) => { if (!error && data?.value) apply(data.value); });

  const channel = supabase
    .channel(`settings:${userId}:${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_meta', filter: `user_id=eq.${userId}` }, (payload) => {
      if (payload?.new?.key === 'settings') apply(payload.new.value);
    })
    .subscribe();

  return () => { alive = false; supabase.removeChannel(channel); };
}
