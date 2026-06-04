// ─── useNotifications — VALERIE notification scheduler ───────────────────────
// Checks conditions every 60s and fires toasts, SMS, and push notifications.
// Deduped per day via localStorage flags — won't spam on every tick.

import { useEffect, useRef } from 'react';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { isTauri } from '../utils/platform.js';
import { sendSMS } from '../utils/twilio.js';

const todayStr  = () => new Date().toISOString().slice(0, 10);
const currentHour = () => new Date().getHours();
const FLAG_KEY  = 'valerie_notif_flags';

function getFlags()  { return storage.get(FLAG_KEY, {}); }
function setFlag(key) {
  const f = getFlags();
  f[`${key}_${todayStr()}`] = true;
  storage.set(FLAG_KEY, f);
}
function fired(key) { return !!getFlags()[`${key}_${todayStr()}`]; }

function toast(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type } }));
}

async function maybeSMS(settings, number, message, isAlert = false) {
  const { twilioAccountSid, twilioAuthToken, phoneNumber, smsMessages } = settings;
  if (!twilioAccountSid || !twilioAuthToken || !phoneNumber || !number) return;
  if (window.__valerieSleepMode) return;
  const template = isAlert
    ? (smsMessages?.alert    || 'VALERIE ALERT: {message}')
    : (smsMessages?.reminder || 'VALERIE: {message}');
  const body = template.replace('{message}', message);
  await sendSMS({ to: phoneNumber, from: number, body, accountSid: twilioAccountSid, authToken: twilioAuthToken });
}

async function maybePush(title, body) {
  // Tauri desktop has no registered service worker — skip entirely to prevent
  // navigator.serviceWorker.ready from hanging forever (it never resolves without a SW).
  if (isTauri()) return;
  if (!('serviceWorker' in navigator)) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  // Timeout so a missing service worker doesn't hang the check loop
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise(resolve => setTimeout(() => resolve(null), 3000)),
  ]).catch(() => null);

  if (!reg) return;

  reg.showNotification(title, {
    body,
    icon:     '/assets/icon-192.png',
    badge:    '/assets/icon-192.png',
    tag:      title,
    renotify: false,
  });
}

export function useNotifications(settings) {
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    const check = async () => {
      try {
        const s = settingsRef.current;
        if (!s?.notifications?.enabled) return;

        const hour = currentHour();
        // Only fire during waking hours (7am–10pm)
        if (hour < 7 || hour >= 22) return;

        // ── Water reminder (after noon if under 40% of goal) ─────────────
        if (s.notifications?.waterReminders && !fired('water') && hour >= 12) {
          const waterLogs = storage.get(STORAGE_KEYS.WATER, []);
          const logs      = Array.isArray(waterLogs) ? waterLogs : (waterLogs?.daily || []);
          const todayML   = logs.filter(l => l.date === todayStr()).reduce((a, l) => a + (l.amount || 0), 0);
          const goal      = s.waterGoal ?? 2500;
          if (todayML < goal * 0.4) {
            setFlag('water');
            const msg = `Hydration check — ${todayML}ml logged so far. Goal is ${goal}ml.`;
            toast(msg);
            await maybeSMS(s, s.twilioReminders, msg);
            await maybePush('Drink Water 💧', msg);
          }
        }

        // ── Habit reminder (from 9am) ─────────────────────────────────────
        if (s.notifications?.habitReminders && !fired('habit') && hour >= 9) {
          const habits = storage.get(STORAGE_KEYS.HABITS, []);
          const missed = habits.filter(habit => habit.active && habit.lastCompleted !== todayStr());
          if (missed.length > 0) {
            setFlag('habit');
            const names = missed.slice(0, 3).map(habit => habit.name).join(', ');
            const msg   = `${missed.length} habit${missed.length > 1 ? 's' : ''} pending: ${names}`;
            toast(msg);
            await maybeSMS(s, s.twilioReminders, msg);
            await maybePush('Habits ⚡', msg);
          }
        }

        // ── Overdue task reminder (from 10am) ─────────────────────────────
        if (s.notifications?.taskReminders && !fired('task') && hour >= 10) {
          const tasks    = storage.get(STORAGE_KEYS.TASKS, []);
          const overdue  = tasks.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr());
          const highOpen = tasks.filter(t => !t.completed && t.priority === 'high');
          if (overdue.length > 0 || highOpen.length > 0) {
            setFlag('task');
            const msg = overdue.length > 0
              ? `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}: ${overdue.slice(0, 2).map(t => t.title).join(', ')}`
              : `${highOpen.length} high-priority task${highOpen.length > 1 ? 's' : ''} open`;
            toast(msg);
            await maybeSMS(s, s.twilioReminders, msg);
            await maybePush('Tasks 📋', msg);
          }
        }

        // ── Weekly finance summary (Mondays 9am) ──────────────────────────
        if (s.notifications?.weeklyFinance && !fired('finance_week') && hour === 9 && new Date().getDay() === 1) {
          const transactions = storage.get(STORAGE_KEYS.TRANSACTIONS, []);
          const cutoff       = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
          const weekSpend    = transactions
            .filter(t => t.type === 'expense' && t.date >= cutoff)
            .reduce((a, t) => a + (t.amount || 0), 0);
          if (weekSpend > 0) {
            setFlag('finance_week');
            const sym = s.currency === 'GBP' ? '£' : s.currency === 'EUR' ? '€' : '$';
            const msg = `Weekly spend: ${sym}${weekSpend.toFixed(2)}`;
            toast(msg);
            await maybeSMS(s, s.twilioReminders, msg);
            await maybePush('Finance Summary 💰', msg);
          }
        }

        // ── Storage quota warning ─────────────────────────────────────────
        if (!fired('storage_warn')) {
          const used = Object.keys(localStorage)
            .filter(k => k.startsWith('valerie_'))
            .reduce((a, k) => a + (localStorage.getItem(k)?.length || 0), 0);
          if (used > 3_000_000) {
            setFlag('storage_warn');
            const mb  = (used / 1_000_000).toFixed(1);
            const msg = `Storage at ${mb}MB — consider clearing old data in Settings.`;
            toast(msg, 'error');
            await maybeSMS(s, s.twilioSentry, msg, true);
          }
        }
      } catch (err) {
        console.warn('[useNotifications] check error:', err.message);
      }
    };

    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
