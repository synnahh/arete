// ─── actions.js — VALERIE action layer ────────────────────────────────────────
// Parses structured action objects from Claude's JSON response and executes them.
// This is how VALERIE actually controls the app — not just talks about it.

import { db, getDeviceId } from '../firebase/firebase.js';
import { collection, addDoc } from 'firebase/firestore';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { sanitizePayload } from '../utils/sanitize.js';

// ─── Callback registry ─────────────────────────────────────────────────────────
// Components register handlers here so VALERIE can trigger UI actions.
const _registry = {};

export function registerActionHandler(name, fn) {
  _registry[name] = fn;
}

// ─── parseResponse ─────────────────────────────────────────────────────────────
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

// ─── executeActions ────────────────────────────────────────────────────────────
/**
 * Execute an array of action objects from VALERIE's response.
 * Runs sequentially to avoid race conditions.
 */
export async function executeActions(actions = []) {
  for (const action of actions) {
    try {
      await _executeOne(action);
    } catch (err) {
      console.warn('[VALERIE/Actions] Failed to execute action:', action, err.message);
    }
  }
}

async function _executeOne(action) {
  if (!action?.type) return;

  switch (action.type) {

    // ── Navigation ─────────────────────────────────────────────────────────
    case 'navigate': {
      const valid = ['dashboard','assistant','tasks','calendar','notes','health',
                     'finance','progress','style','essentials','lists','focus','vault','settings'];
      if (valid.includes(action.target)) {
        _registry.navigate?.(action.target);
      }
      break;
    }

    // ── Add task ───────────────────────────────────────────────────────────
    case 'addTask': {
      if (!action.title?.trim()) break;
      const payload = {
        title:       action.title.trim(),
        description: action.description || '',
        priority:    ['high','medium','low'].includes(action.priority) ? action.priority : 'medium',
        completed:   false,
        createdAt:   Date.now(),
        updatedAt:   Date.now(),
      };
      try {
        const userId = getDeviceId();
        await addDoc(collection(db, 'users', userId, 'tasks'), sanitizePayload(payload));
      } catch {
        const local = storage.get(STORAGE_KEYS.TASKS, []);
        storage.set(STORAGE_KEYS.TASKS, [{ id: `local_${Date.now()}`, ...sanitizePayload(payload) }, ...local]);
      }
      break;
    }

    // ── Add note ───────────────────────────────────────────────────────────
    case 'addNote': {
      if (!action.title?.trim() && !action.content?.trim()) break;
      const payload = {
        title:     action.title?.trim() || 'Note',
        content:   action.content?.trim() || '',
        pinned:    false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      try {
        const userId = getDeviceId();
        await addDoc(collection(db, 'users', userId, 'notes'), sanitizePayload(payload));
      } catch {
        const local = storage.get(STORAGE_KEYS.NOTES, []);
        storage.set(STORAGE_KEYS.NOTES, [{ id: `local_${Date.now()}`, ...sanitizePayload(payload) }, ...local]);
      }
      break;
    }

    // ── Log mood ───────────────────────────────────────────────────────────
    case 'logMood': {
      const value = Math.min(10, Math.max(1, Number(action.value) || 5));
      const today = new Date().toISOString().split('T')[0];
      const entry = { date: today, value, note: action.note || '', ts: Date.now() };
      const existing = storage.get(STORAGE_KEYS.MOOD_LOGS, []);
      const updated  = [entry, ...existing.filter(m => m.date !== today)].slice(0, 90);
      storage.set(STORAGE_KEYS.MOOD_LOGS, updated);
      try {
        const userId = getDeviceId();
        await addDoc(collection(db, 'users', userId, 'mood_logs'), entry);
      } catch {}
      break;
    }

    // ── Log water ──────────────────────────────────────────────────────────
    case 'logWater': {
      const amount = Math.min(2000, Math.max(50, Number(action.amount) || 250));
      const today  = new Date().toISOString().split('T')[0];
      const water  = storage.get(STORAGE_KEYS.WATER, { daily: [] });
      water.daily  = [...(water.daily || []), { date: today, amount, ts: Date.now() }].slice(-200);
      storage.set(STORAGE_KEYS.WATER, water);
      break;
    }

    // ── Start focus session (navigates to Focus tab) ───────────────────────
    case 'startFocus': {
      _registry.navigate?.('focus');
      // Also store a pending duration so Focus tab can auto-start if it reads it
      if (action.duration) {
        storage.set('valerie_pending_focus', { duration: action.duration, ts: Date.now() });
      }
      break;
    }

    // ── Open settings ──────────────────────────────────────────────────────
    case 'openSettings': {
      _registry.navigate?.('settings');
      break;
    }

    // ── Add transaction (income or expense) ───────────────────────────────
    case 'addTransaction': {
      const amount = Math.abs(Number(action.amount));
      if (!amount) break;
      const type = action.transactionType === 'expense' ? 'expense' : 'income';
      const today = new Date().toISOString().split('T')[0];
      const payload = {
        type,
        amount,
        category:    String(action.category    || (type === 'income' ? 'Income' : 'General')),
        description: String(action.description || ''),
        date:        action.date || today,
        createdAt:   Date.now(),
        updatedAt:   Date.now(),
      };
      try {
        const userId = getDeviceId();
        await addDoc(collection(db, 'users', userId, 'transactions'), sanitizePayload(payload));
      } catch {
        const local = storage.get(STORAGE_KEYS.TRANSACTIONS, []);
        storage.set(STORAGE_KEYS.TRANSACTIONS, [{ id: `local_${Date.now()}`, ...sanitizePayload(payload) }, ...local]);
      }
      break;
    }

    // ── Log calories ───────────────────────────────────────────────────────
    case 'logCalories': {
      const cal   = Math.abs(Number(action.calories));
      if (!cal) break;
      const today = new Date().toISOString().split('T')[0];
      const health = storage.get(STORAGE_KEYS.HEALTH, {});
      const logs   = health.calorieLogs || [];
      const entry  = { date: today, calories: cal, meal: action.meal || '', ts: Date.now() };
      health.calorieLogs = [entry, ...logs.filter(l => l.date !== today || l.meal !== entry.meal)].slice(0, 200);
      storage.set(STORAGE_KEYS.HEALTH, health);
      break;
    }

    // ── Log sleep ──────────────────────────────────────────────────────────
    case 'logSleep': {
      const hours = Number(action.hours);
      if (!hours) break;
      const today = new Date().toISOString().split('T')[0];
      const sleep = storage.get(STORAGE_KEYS.SLEEP, { logs: [] });
      sleep.logs  = [{ date: today, hours, quality: action.quality || null, ts: Date.now() },
                     ...(sleep.logs || []).filter(l => l.date !== today)].slice(0, 90);
      storage.set(STORAGE_KEYS.SLEEP, sleep);
      break;
    }

    // ── Toggle a boolean setting ──────────────────────────────────────────
    case 'toggleSetting': {
      const key = action.key;
      if (!key) break;
      const s = storage.get(STORAGE_KEYS.SETTINGS, {});
      const newVal = !s[key];
      storage.set(STORAGE_KEYS.SETTINGS, { ...s, [key]: newVal });
      window.dispatchEvent(new CustomEvent('valerie:settings-changed', { detail: { ...s, [key]: newVal } }));
      break;
    }

    // ── Change a specific setting value ───────────────────────────────────
    case 'changeSetting': {
      const { key: sKey, value: sVal } = action;
      if (!sKey) break;
      const s2 = storage.get(STORAGE_KEYS.SETTINGS, {});
      const updated = { ...s2, [sKey]: sVal };
      storage.set(STORAGE_KEYS.SETTINGS, updated);
      window.dispatchEvent(new CustomEvent('valerie:settings-changed', { detail: updated }));
      break;
    }

    // ── Open a specific settings section ──────────────────────────────────
    case 'openSettingsSection': {
      _registry.navigate?.('settings');
      if (action.section) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('valerie:settings-section', { detail: action.section }));
        }, 300);
      }
      break;
    }

    default:
      console.info('[VALERIE/Actions] Unknown action type:', action.type);
  }
}
