// useCoachReminders — the coach's morning and evening check-in: once per slot per
// day, the top of "Next moves" as a toast and (where allowed) a system
// notification. Rules: domain/reminders.js. Mounted once, in App (the phone
// shell is a child of it), and waits until the data has synced (or 45 s offline) so the first
// message is not built from a stale local copy.
import { useEffect, useRef } from 'react';
import { storage } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { useNextMoves } from './useNextMoves.js';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { dueCoachReminder, waitBeforeNudge } from '../domain/reminders.js';
import { showLocalNotification } from '../utils/pushNotifications.js';

const FLAG_KEY = 'valerie_notif_flags';   // shared with useNotifications

const flagFor = (slot, day) => `coach-${slot}_${day}`;

export function useCoachReminders(settings) {
  const moves = useNextMoves();
  // The tables the moves are built from. Until they have synced, a check-in could describe a stale
  // local copy ("nothing logged yet" for a day that has entries).
  const synced = [
    useCollection('nutrition_logs', STORAGE_KEYS.MACROS).synced,
    useCollection('water_logs', STORAGE_KEYS.WATER).synced,
    useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS).synced,
    useCollection('habits', STORAGE_KEYS.HABITS).synced,
    useCollection('essentials', STORAGE_KEYS.ESSENTIALS).synced,
    useCollection('body_metrics', STORAGE_KEYS.BODY).synced,
  ].every(Boolean);
  const startedAt = useRef(Date.now());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    // Same default as the Settings toggle: on unless the master switch was turned off.
    if (settingsRef.current?.notifications?.enabled === false) return undefined;

    const run = () => {
      if (waitBeforeNudge({ elapsedMs: Date.now() - startedAt.current, synced }) > 0) return;
      const now = new Date();
      const day = toLocalDateKey(now);
      const flags = storage.get(FLAG_KEY, {}) || {};
      const fired = ['morning', 'evening'].filter(s => flags[flagFor(s, day)]);
      const due = dueCoachReminder({ hour: now.getHours(), moves, cfg: settingsRef.current?.notifications?.coach, fired });
      if (!due) return;
      // Mark first so a re-render or a second shell cannot send it twice.
      // Only today's flags are ever read, so older ones are dropped rather than accumulating.
      const todays = Object.fromEntries(Object.entries(flags).filter(([k]) => k.endsWith(`_${day}`)));
      storage.set(FLAG_KEY, { ...todays, [flagFor(due.slot, day)]: true });
      window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: `${due.title}. ${due.body}`, type: 'info' } }));
      try { showLocalNotification(due.title, due.body, { tag: `coach-${due.slot}`, url: '/' })?.catch?.(() => {}); } catch { /* the toast already showed it */ }
    };

    run();
    const wait = waitBeforeNudge({ elapsedMs: Date.now() - startedAt.current, synced });
    if (wait <= 0) return undefined;
    const t = setTimeout(run, wait + 250);
    return () => clearTimeout(t);
  }, [moves, synced]);
}
