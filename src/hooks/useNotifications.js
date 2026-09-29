//  useNotifications  VALERIE notification scheduler 
// Checks conditions every 60s and fires toasts, SMS, and push notifications.
// Each tab has its own config: { enabled, hour, message, ... }
// Deduped per day via localStorage flags  won't spam on every tick.

import { useEffect, useRef } from 'react';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { isTauri } from '../utils/platform.js';
import { sendSMS } from '../utils/twilio.js';
import { currencySymbol as currencySym } from '../utils/currency.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { currentWaterGoal } from '../utils/waterGoal.js';

const todayStr    = () => toLocalDateKey(new Date());
const currentHour = () => new Date().getHours();
const FLAG_KEY    = 'valerie_notif_flags';

function getFlags()   { return storage.get(FLAG_KEY, {}); }
function setFlag(key) {
  const f = getFlags();
  f[`${key}_${todayStr()}`] = true;
  storage.set(FLAG_KEY, f);
}
function fired(key) { return !!getFlags()[`${key}_${todayStr()}`]; }

function toast(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type } }));
}

// Resolve a message template  replaces all {placeholder} tokens
function resolveMsg(template, tokens = {}) {
  return Object.entries(tokens).reduce(
    (msg, [k, v]) => msg.replace(new RegExp(`\\{${k}\\}`, 'g'), v),
    template,
  );
}

async function maybeSMS(settings, message) {
  const { twilioAccountSid, twilioAuthToken, twilioReminders, phoneNumber } = settings;
  if (!twilioAccountSid || !twilioAuthToken || !phoneNumber || !twilioReminders) return;
  if (window.__valerieSleepMode) return;
  await sendSMS({
    to: phoneNumber, from: twilioReminders, body: message,
    accountSid: twilioAccountSid, authToken: twilioAuthToken,
  });
}

async function maybeAlertSMS(settings, message) {
  const { twilioAccountSid, twilioAuthToken, twilioSentry, phoneNumber } = settings;
  if (!twilioAccountSid || !twilioAuthToken || !phoneNumber || !twilioSentry) return;
  const template = settings.smsMessages?.alert || 'VALERIE ALERT: {message}';
  const body = template.replace('{message}', message);
  await sendSMS({
    to: phoneNumber, from: twilioSentry, body,
    accountSid: twilioAccountSid, authToken: twilioAuthToken,
  });
}

async function maybePush(title, body) {
  if (isTauri()) return;
  if (!('serviceWorker' in navigator)) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise(resolve => setTimeout(() => resolve(null), 3000)),
  ]).catch(() => null);

  if (!reg) return;
  reg.showNotification(title, {
    body, icon: '/assets/icon-192.png', badge: '/assets/icon-192.png',
    tag: title, renotify: false,
  });
}

// Helper  get per-tab config with fallback defaults
function tabCfg(settings, key) {
  return settings?.notifications?.tabs?.[key] ?? {};
}

export function useNotifications(settings) {
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    const check = async () => {
      try {
        const s = settingsRef.current;
        if (!s?.notifications?.enabled) return;

        const hour  = currentHour();
        const today = todayStr();

        // Only fire during waking hours (6am10pm)
        if (hour < 6 || hour >= 22) return;

        //  = Water 
        const water = tabCfg(s, 'water');
        if (water.enabled !== false && !fired('water') && hour >= (water.hour ?? 12)) {
          const waterLogs = storage.get(STORAGE_KEYS.WATER, []);
          const logs      = Array.isArray(waterLogs) ? waterLogs : (waterLogs?.daily || []);
          const todayML   = logs.filter(l => l.date === today).reduce((a, l) => a + (l.amount || 0), 0);
          const goal      = currentWaterGoal(s);
          if (todayML < goal * 0.5) {
            setFlag('water');
            const msg = resolveMsg(water.message || 'VALERIE: Only {value}ml logged. Goal is {goal}ml.', { value: todayML, goal });
            toast(msg);
            await maybeSMS(s, msg);
            await maybePush('Drink Water =', msg);
          }
        }

        //  <} Nutrition 
        const nutrition = tabCfg(s, 'nutrition');
        if (nutrition.enabled !== false && !fired('nutrition') && hour >= (nutrition.hour ?? 13)) {
          const nutritionLogs = storage.get(STORAGE_KEYS.MACROS, []);
          const todayNut      = nutritionLogs.find(l => l.date === today);
          const cal           = todayNut?.calories ?? todayNut?.totalCalories ?? 0;
          const calGoal       = s.macroGoal ?? 2500;
          if (cal === 0) {
            setFlag('nutrition');
            const msg = resolveMsg(nutrition.message || 'VALERIE: No calories logged yet. {value} kcal remaining.', { value: calGoal });
            toast(msg);
            await maybeSMS(s, msg);
            await maybePush('Log Your Meals <}', msg);
          }
        }

        //  = Supplements 
        const supplements = tabCfg(s, 'supplements');
        if (supplements.enabled !== false && !fired('supplements') && hour >= (supplements.hour ?? 10)) {
          const supps    = storage.get(STORAGE_KEYS.SUPPLEMENTS, []);
          const suppLogs = storage.get(STORAGE_KEYS.SUPP_LOGS, []);
          const taken    = new Set(suppLogs.filter(l => l.date === today).map(l => l.suppId));
          const missed   = supps.filter(s => !taken.has(s.id));
          if (missed.length > 0) {
            setFlag('supplements');
            const msg = resolveMsg(supplements.message || 'VALERIE: {value} supplement(s) not taken yet today.', { value: missed.length });
            toast(msg);
            await maybeSMS(s, msg);
            await maybePush('Supplements =', msg);
          }
        }

        //   Habits 
        const habits = tabCfg(s, 'habits');
        if (habits.enabled !== false && !fired('habit') && hour >= (habits.hour ?? 9)) {
          const habitList = storage.get(STORAGE_KEYS.HABITS, []);
          const missed    = habitList.filter(h => h.active && h.lastCompleted !== today);
          if (missed.length > 0) {
            setFlag('habit');
            const msg = resolveMsg(habits.message || 'VALERIE: {value} habit(s) still pending today.', { value: missed.length });
            toast(msg);
            await maybeSMS(s, msg);
            await maybePush('Habits ', msg);
          }
        }

        //  = Tasks 
        const tasks = tabCfg(s, 'tasks');
        if (tasks.enabled !== false && !fired('task') && hour >= (tasks.hour ?? 10)) {
          const taskList = storage.get(STORAGE_KEYS.TASKS, []);
          const overdue  = taskList.filter(t => !t.completed && t.dueDate && t.dueDate < today);
          const highOpen = taskList.filter(t => !t.completed && t.priority === 'high');
          const count    = overdue.length || highOpen.length;
          if (count > 0) {
            setFlag('task');
            const msg = resolveMsg(tasks.message || 'VALERIE: {value} task(s) need your attention.', { value: count });
            toast(msg);
            await maybeSMS(s, msg);
            await maybePush('Tasks =', msg);
          }
        }

        //  =4 Sleep 
        const sleep = tabCfg(s, 'sleep');
        if (sleep.enabled !== false && !fired('sleep') && hour >= (sleep.hour ?? 8)) {
          const sleepData = storage.get(STORAGE_KEYS.SLEEP, []);
          const logged    = sleepData.some(l => l.date === today || l.date === toLocalDateKey(new Date(Date.now() - 86400000)));
          if (!logged) {
            setFlag('sleep');
            const msg = sleep.message || 'VALERIE: Log last night\'s sleep to track your recovery.';
            toast(msg);
            await maybeSMS(s, msg);
            await maybePush('Log Sleep =4', msg);
          }
        }

        //  < Workout 
        const workout = tabCfg(s, 'workout');
        if (workout.enabled && !fired('workout') && hour >= (workout.hour ?? 18)) {
          const workoutLogs = storage.get(STORAGE_KEYS.WORKOUT_LOGS, []);
          const workedOut   = workoutLogs.some(l => l.date === today);
          if (!workedOut) {
            setFlag('workout');
            const msg = workout.message || 'VALERIE: No workout logged today. Rest day or forgot?';
            toast(msg);
            await maybeSMS(s, msg);
            await maybePush('Workout <', msg);
          }
        }

        //  = Calendar  fires X min before each event 
        const cal = tabCfg(s, 'calendar');
        if (cal.enabled !== false) {
          const calMinutes = cal.calMinutes ?? 30;
          const events     = storage.get(STORAGE_KEYS.CALENDAR_EVENTS ?? 'valerie_calendar_events', []);
          const now        = Date.now();
          for (const ev of events) {
            const start = new Date(ev.start).getTime();
            const diff  = Math.round((start - now) / 60000);
            const flagK = `calendar_${ev.id ?? ev.title}`;
            if (diff > 0 && diff <= calMinutes && !fired(flagK)) {
              setFlag(flagK);
              const msg = resolveMsg(cal.message || 'VALERIE: {value} starts in {time} minutes.', { value: ev.title ?? ev.summary ?? 'An event', time: diff });
              toast(msg);
              await maybeSMS(s, msg);
              await maybePush('Upcoming Event =', msg);
            }
          }
        }

        //  = Finance  weekly (Mondays 9am) 
        const finance = tabCfg(s, 'finance');
        if (finance.enabled !== false && !fired('finance_week') && hour === (finance.hour ?? 9) && new Date().getDay() === 1) {
          const transactions = storage.get(STORAGE_KEYS.TRANSACTIONS, []);
          const cutoff       = toLocalDateKey(new Date(Date.now() - 7 * 86400000));
          const weekSpend    = transactions
            .filter(t => t.type === 'expense' && t.date >= cutoff)
            .reduce((a, t) => a + (t.amount || 0), 0);
          if (weekSpend > 0) {
            setFlag('finance_week');
            const sym = currencySym(s.currency);
            const msg = resolveMsg(finance.message || 'VALERIE: Weekly spend so far: {value}.', { value: `${sym}${weekSpend.toFixed(2)}` });
            toast(msg);
            await maybeSMS(s, msg);
            await maybePush('Finance Summary =', msg);
          }
        }

        //  Storage quota warning 
        if (!fired('storage_warn')) {
          const used = Object.keys(localStorage)
            .filter(k => k.startsWith('valerie_'))
            .reduce((a, k) => a + (localStorage.getItem(k)?.length || 0), 0);
          if (used > 3_000_000) {
            setFlag('storage_warn');
            const mb  = (used / 1_000_000).toFixed(1);
            const msg = `Storage at ${mb}MB  consider clearing old data in Settings.`;
            toast(msg, 'error');
            await maybeAlertSMS(s, msg);
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
