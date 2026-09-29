//  actions.js  VALERIE action layer 
// Parses structured action objects from Claude's JSON response and executes them.
// This is how VALERIE actually controls the app  not just talks about it.

import { supabase, getUserId } from '../supabase/supabase.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { sanitizePayload } from '../utils/sanitize.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { makeTask } from '../domain/tasks.js';
import { NAV_TARGETS } from '../nav/groups.js';
import { updateSettings } from '../utils/settingsStore.js';
import { waterRow, sleepRow, nutritionDay } from '../domain/dayLogs.js';
import { needsConfirmation, describeAction } from './confirm.js';

//  Callback registry 
// Components register handlers here so VALERIE can trigger UI actions.
const _registry = {};

export function registerActionHandler(name, fn) {
  _registry[name] = fn;
}

// Insert a row VALERIE created on the user's behalf (task/note/transaction/etc).
// A failed insert used to fall back to a `local_*` row with NO indication
// anything went wrong — the item just never showed up on the other device.
// Now it still saves locally (so the action doesn't feel like it failed) but
// loudly reports why it didn't sync.
async function insertActionRow(table, storageKey, payload) {
  const userId = await getUserId();
  if (userId) {
    const { error } = await supabase.from(table).insert({ user_id: userId, data: payload });
    if (!error) return;
    console.error(`[VALERIE action] insert failed on "${table}":`, error.message);
    window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: `⚠️ Couldn't sync — ${error.message}. Saved on this device only.`, type: 'error' } }));
  } else {
    console.error(`[VALERIE action] insert failed on "${table}": not signed in`);
    window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: '⚠️ Not signed in — saved on this device only', type: 'error' } }));
  }
  const local = storage.get(storageKey, []);
  storage.set(storageKey, [{ id: `local_${Date.now()}`, ...payload }, ...local]);
}

// Update today's row for a once-a-day table (nutrition, sleep) or insert it.
// `build(existingData | null)` returns the new row data (or null to skip).
// Matches by date against the local mirror, ignoring unsynced local_* rows.
async function upsertDayRow(table, storageKey, date, build) {
  const mirror = storage.get(storageKey, []);
  const rows = Array.isArray(mirror) ? mirror : [];
  const existing = rows.find(r => r.date === date && !String(r.id).startsWith('local_'));
  const { id, ...existingData } = existing || {};
  const built = build(existing ? existingData : null);
  if (!built) return;
  const data = sanitizePayload(built);

  if (!existing) { await insertActionRow(table, storageKey, data); return; }

  const userId = await getUserId();
  let synced = false;
  if (userId) {
    const { error } = await supabase.from(table).update({ data }).eq('id', id);
    synced = !error;
    if (error) {
      console.error(`[VALERIE action] update failed on "${table}":`, error.message);
      window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: `⚠️ Couldn't sync — ${error.message}. Saved on this device only.`, type: 'error' } }));
    }
  } else {
    console.error(`[VALERIE action] update failed on "${table}": not signed in`);
    window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: '⚠️ Not signed in — saved on this device only', type: 'error' } }));
  }
  storage.set(storageKey, rows.map(r => (r.id === id ? { id, ...data } : r)));
  return synced;
}

//  parseResponse 
/**
 * Parse Claude's JSON response into { speech, actions, remember }.
 * Falls back gracefully if Claude didn't return valid JSON.
 */
export function parseResponse(raw) {
  if (!raw) return { speech: '', actions: [], remember: null };

  // Try to strip markdown code fence if Claude wrapped it
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === 'object' && parsed !== null && 'speech' in parsed) {
      return {
        speech:   String(parsed.speech   || ''),
        actions:  Array.isArray(parsed.actions) ? parsed.actions : [],
        remember: parsed.remember ? String(parsed.remember) : null,
      };
    }
  } catch {}

  // Fallback: entire raw text is the speech response, no actions
  return {
    speech:   raw,
    actions:  [],
    remember: null,
  };
}

//  executeActions 
/**
 * Execute an array of action objects from VALERIE's response.
 * Runs sequentially to avoid race conditions.
 */
export async function executeActions(actions = []) {
  for (const action of actions) {
    try {
      // Setting changes wait for an Apply on a card; logging runs straight away.
      if (needsConfirmation(action)) { requestConfirmation(action); continue; }
      await _executeOne(action);
    } catch (err) {
      console.warn('[VALERIE/Actions] Failed to execute action:', action, err.message);
    }
  }
}

function requestConfirmation(action) {
  const info = describeAction(action, storage.get(STORAGE_KEYS.SETTINGS, {}));
  if (!info) { console.warn('[VALERIE/Actions] Refused setting change:', action?.type, action?.key); return; }
  window.dispatchEvent(new CustomEvent('valerie:confirm-action', { detail: { action, ...info } }));
}

/** Run an action the user approved on a confirmation card. */
export async function runConfirmed(action) {
  try { await _executeOne(action); }
  catch (err) { console.warn('[VALERIE/Actions] Approved action failed:', action, err.message); }
}

async function _executeOne(action) {
  if (!action?.type) return;

  switch (action.type) {

    //  Navigation
    case 'navigate': {
      // Screen ids or group ids (home, plan, coach, mind, finance, settings)
      if (NAV_TARGETS.includes(action.target)) {
        _registry.navigate?.(action.target);
      }
      break;
    }

    //  Add task 
    case 'addTask': {
      // The model is prompted with `title`; accept `text` too. Write the
      // canonical {text, done} shape the Tasks UI reads (was {title, completed},
      // which rendered as blank rows).
      const text = (action.text ?? action.title ?? '').trim();
      if (!text) break;
      const payload = makeTask({ text, priority: action.priority, description: action.description || '' });
      await insertActionRow('tasks', STORAGE_KEYS.TASKS, sanitizePayload(payload));
      break;
    }

    //  Add note
    case 'addNote': {
      if (!action.title?.trim() && !action.content?.trim()) break;
      const payload = {
        title:     action.title?.trim() || 'Note',
        content:   action.content?.trim() || '',
        pinned:    false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await insertActionRow('notes', STORAGE_KEYS.NOTES, sanitizePayload(payload));
      break;
    }

    //  Log mood 
    case 'logMood': {
      const value = Math.min(10, Math.max(1, Number(action.value) || 5));
      const today = toLocalDateKey(new Date());
      await upsertDayRow('mood_logs', STORAGE_KEYS.MOOD_LOGS, today, () => ({ date: today, value, note: action.note || '', ts: Date.now() }));
      break;
    }

    //  Log water 
    case 'logWater': {
      const today = toLocalDateKey(new Date());
      await insertActionRow('water_logs', STORAGE_KEYS.WATER, sanitizePayload(waterRow({ date: today, amountMl: action.amount })));
      break;
    }

    //  Start focus session (navigates to Focus tab) 
    case 'startFocus': {
      _registry.navigate?.('focus');
      // Also store a pending duration so Focus tab can auto-start if it reads it
      if (action.duration) {
        storage.set('valerie_pending_focus', { duration: action.duration, ts: Date.now() });
      }
      break;
    }

    //  Open settings 
    case 'openSettings': {
      _registry.navigate?.('settings');
      break;
    }

    //  Add transaction (income or expense) 
    case 'addTransaction': {
      const amount = Math.abs(Number(action.amount));
      if (!amount) break;
      const type = action.transactionType === 'expense' ? 'expense' : 'income';
      const today = toLocalDateKey(new Date());
      const payload = {
        type,
        amount,
        category:    String(action.category    || (type === 'income' ? 'Income' : 'General')),
        description: String(action.description || ''),
        date:        action.date || today,
        createdAt:   Date.now(),
        updatedAt:   Date.now(),
      };
      await insertActionRow('transactions', STORAGE_KEYS.TRANSACTIONS, sanitizePayload(payload));
      break;
    }

    //  Log calories: adds a meal to today's nutrition row, as Fuel does
    case 'logCalories': {
      const today = toLocalDateKey(new Date());
      await upsertDayRow('nutrition_logs', STORAGE_KEYS.MACROS, today,
        (existing) => nutritionDay({ date: today, existing, entry: {
          calories: action.calories, protein: action.protein, carbs: action.carbs, fat: action.fat, meal: action.meal,
        } }));
      break;
    }

    //  Log sleep: one row per date in sleep_data, keeping any stages already there
    case 'logSleep': {
      const today = toLocalDateKey(new Date());
      await upsertDayRow('sleep_data', STORAGE_KEYS.SLEEP, today,
        (existing) => sleepRow({ date: today, hours: action.hours, quality: action.quality, existing }));
      break;
    }

    //  Toggle a boolean setting 
    case 'toggleSetting': {
      const key = action.key;
      if (!key || !describeAction(action, storage.get(STORAGE_KEYS.SETTINGS, {}))) break; // never for secret-like keys
      const s = storage.get(STORAGE_KEYS.SETTINGS, {});
      updateSettings({ [key]: !s[key] }, s);
      break;
    }

    //  Change a specific setting value 
    case 'changeSetting': {
      const { key: sKey, value: sVal } = action;
      if (!sKey || !describeAction(action, storage.get(STORAGE_KEYS.SETTINGS, {}))) break; // safe key and plain value only
      const s2 = storage.get(STORAGE_KEYS.SETTINGS, {});
      updateSettings({ [sKey]: sVal }, s2);
      break;
    }

    //  Open a specific settings section
    case 'openSettingsSection': {
      _registry.navigate?.('settings');
      if (action.section) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('valerie:settings-section', { detail: action.section }));
        }, 300);
      }
      break;
    }

    //  Add calendar event
    case 'addCalendarEvent': {
      if (!action.title?.trim()) break;
      // Require an ISO date (YYYY-MM-DD). VALERIE resolves "Wednesday" etc. from the
      // current date in her context before emitting the action.
      const date = /^\d{4}-\d{2}-\d{2}$/.test(action.date || '')
        ? action.date
        : toLocalDateKey(new Date());
      const norm = (t) => {
        if (!t) return '';
        const m = String(t).match(/^(\d{1,2}):?(\d{2})$/); // accepts "1230" or "12:30"
        return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
      };
      const payload = {
        title:       action.title.trim(),
        description: action.description || '',
        date,
        time:        norm(action.time),
        endTime:     norm(action.endTime),
        colour:      action.colour || '#4a9eff',
        source:      'local',
        createdAt:   Date.now(),
        updatedAt:   Date.now(),
      };
      await insertActionRow('events', STORAGE_KEYS.EVENTS, sanitizePayload(payload));
      break;
    }

    //  Add essential / restock item
    case 'addEssential': {
      if (!action.name?.trim()) break;
      const validCats = ['grooming','health','kitchen','cleaning','supplements','other'];
      const payload = {
        name:         action.name.trim(),
        category:     validCats.includes(action.category) ? action.category : 'other',
        boughtDate:   /^\d{4}-\d{2}-\d{2}$/.test(action.boughtDate || '') ? action.boughtDate : toLocalDateKey(new Date()),
        lifespanDays: Number.isFinite(Number(action.lifespanDays)) && action.lifespanDays ? parseInt(action.lifespanDays) : null,
        price:        Number.isFinite(Number(action.price)) && action.price ? parseFloat(action.price) : null,
        notes:        action.notes?.trim() || null,
        createdAt:    new Date().toISOString(),
      };
      await insertActionRow('essentials', STORAGE_KEYS.ESSENTIALS, sanitizePayload(payload));
      break;
    }

    default:
      console.info('[VALERIE/Actions] Unknown action type:', action.type);
  }
}


