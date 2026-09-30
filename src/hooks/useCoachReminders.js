// useCoachReminders — the coach's morning and evening check-in: once per slot per
// day, the top of "Next moves" as a toast and (where allowed) a system
// notification. Rules: domain/reminders.js. Runs wherever it is mounted (both
// shells) and waits a few seconds after launch so the first message is not
// built from data that is still loading.
import { useEffect, useRef } from 'react';
import { storage } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { useNextMoves } from './useNextMoves.js';
import { dueCoachReminder } from '../domain/reminders.js';
import { showLocalNotification } from '../utils/pushNotifications.js';

const FLAG_KEY = 'valerie_notif_flags';   // shared with useNotifications
const WARMUP_MS = 15000;

const flagFor = (slot, day) => `coach-${slot}_${day}`;

export function useCoachReminders(settings) {
  const moves = useNextMoves();
  const startedAt = useRef(Date.now());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    // Same default as the Settings toggle: on unless the master switch was turned off.
    if (settingsRef.current?.notifications?.enabled === false) return undefined;

    const run = () => {
      if (Date.now() - startedAt.current < WARMUP_MS) return;
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
    const t = setTimeout(run, WARMUP_MS + 500);
    return () => clearTimeout(t);
  }, [moves]);
}
