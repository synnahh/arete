import { useEffect } from 'react';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { supabase, getUserId } from '../supabase/supabase.js';
import Dock from './Dock.jsx';
import { GROUPS, groupScreens, groupOf, ALL_SCREENS, SCREEN_LABELS, inBarOrder } from '../nav/groups.js';

// ─── All reorderable tabs in default order ────────────────────────────────────
// Every screen, labelled by group (Settings uses this for hiding and ordering).
export const ALL_TABS = ALL_SCREENS.map(id => ({ id, label: `${groupOf(id).label} · ${SCREEN_LABELS[id] ?? id}` }));


export default function Sidebar({ activeGroup, onGroupClick, internetOnline, firebaseSynced, hiddenTabs = [], peakState }) {

  // Sync the saved screen order from Supabase (cross-device). The order now
  // decides section order inside each group; App reads it from storage.
  useEffect(() => {
    let channel;
    let alive = true;
    getUserId().then(userId => {
      if (!alive) return; // cleaned up before getUserId resolved (StrictMode race)
      const applyOrder = (saved) => {
        if (!saved?.length) return;
        storage.set(STORAGE_KEYS.SIDEBAR_ORDER_DESKTOP, saved);
        window.dispatchEvent(new CustomEvent('valerie:sidebar-order-changed'));
      };

      supabase.from('user_meta').select('value').eq('user_id', userId).eq('key', 'sidebar_order_desktop').maybeSingle()
        .then(({ data }) => { if (data?.value?.order) applyOrder(data.value.order); });

      channel = supabase.channel(`sidebar:${userId}:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_meta', filter: `user_id=eq.${userId}` },
          async () => {
            const { data } = await supabase.from('user_meta').select('value').eq('user_id', userId).eq('key', 'sidebar_order_desktop').maybeSingle();
            if (data?.value?.order) applyOrder(data.value.order);
          })
        .subscribe();
    });
    return () => { alive = false; if (channel) supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = (g) => groupScreens(g.id, { hidden: hiddenTabs }).length > 0;
  const mainGroups   = inBarOrder(GROUPS.filter(g => g.id !== 'settings' && visible(g)));
  const settingsTab  = GROUPS.find(g => g.id === 'settings');

  return (
    <Dock
      groups={mainGroups}
      settingsGroup={settingsTab}
      activeGroup={activeGroup}
      onGroupClick={onGroupClick}
      internetOnline={internetOnline ?? navigator.onLine}
      synced={firebaseSynced ?? false}
    />
  );
}
