// useCoachEngine — runs the coach engine (domain/coachEngine.js) over the synced data.
//
// Mounted once with { run: true } in App: waits until the data has synced, then
// applies routine updates by itself (each with a toast and Undo) and records them
// in settings.coachLog. Any other caller (the Coach updates feed) gets the same
// picture without applying anything: the updates waiting for a tap, the recent log,
// and apply / dismiss / undo.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument } from '../supabase/useDocument.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { updateSettings } from '../utils/settingsStore.js';
import { settingsForGoal } from '../domain/goals.js';
import { suggestWeek } from '../domain/split.js';
import { coachUpdates, logEntry, pushLog, canUndo, coolingDown } from '../domain/coachEngine.js';
import { fitbitUpdates } from '../domain/fitbitCoach.js';
import { useHealthHistory } from './useHealthHistory.js';

const WARMUP_MS = 4000;
let applying = false; // one writer at a time across every mounted copy

// Undo a water change only while it is the newest one and the profile is still what it set.
const undoableWater = (entry, log, current) => entry.status === 'applied' && !!entry.before?.water
  && log.find(e => e.after?.water && e.status === 'applied')?.id === entry.id
  && JSON.stringify(current ?? null) === JSON.stringify(entry.after.water);

const readSettings = () => storage.get(STORAGE_KEYS.SETTINGS, {}) || {};
const toast = (detail) => window.dispatchEvent(new CustomEvent('valerie:toast', { detail }));

export function useCoachEngine({ run = false } = {}) {
  const body = useCollection('body_metrics', STORAGE_KEYS.BODY);
  const nutrition = useCollection('nutrition_logs', STORAGE_KEYS.MACROS);
  const workouts = useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS);
  const programs = useCollection('programs', STORAGE_KEYS.PROGRAMS);
  const sleep = useCollection('sleep_data', STORAGE_KEYS.SLEEP);
  const health = useHealthHistory(35); // Fitbit / phone / scale readings, one row per day
  // The water profile is only touched if you saved one (the default is never written).
  const water = useDocument('water_profile', STORAGE_KEYS.WATER_PROFILE, null);
  const synced = body.synced && nutrition.synced && workouts.synced && programs.synced && water.synced;

  const [settings, setSettings] = useState(readSettings);
  useEffect(() => {
    const on = (e) => setSettings(e.detail || readSettings());
    window.addEventListener('valerie:settings-changed', on);
    return () => window.removeEventListener('valerie:settings-changed', on);
  }, []);

  const today = toLocalDateKey(new Date());
  const activeProgram = useMemo(() => (programs.items || []).find(p => p?.isActive) || null, [programs.items]);
  const log = useMemo(() => (Array.isArray(settings.coachLog) ? settings.coachLog : []), [settings.coachLog]);

  const updates = useMemo(() => {
    const weights = (body.items || []).map(b => ({ date: b.date, weight: b.weight }));
    const base = coachUpdates({
      goal: settings.coachGoal,
      weights,
      nutrition: (nutrition.items || []).map(n => ({ date: n.date, calories: n.calories })),
      workouts: workouts.items || [],
      program: activeProgram,
      waterProfile: water.data,
      log,
      today,
    });
    // Fitbit-driven proposals never override one the data-only rules already made for the same thing.
    const fitbit = fitbitUpdates({
      goal: settings.coachGoal, profile: settings.profile, health: health.rows, sleep: sleep.items || [], weights,
      program: activeProgram, log, today, cooling: coolingDown,
    }).filter(u => !base.some(b => b.key === u.key || (b.apply.type === u.apply.type && u.apply.type !== 'advice')));
    return [...base, ...fitbit];
  }, [settings.coachGoal, settings.profile, body.items, nutrition.items, workouts.items, activeProgram, water.data, log, today, health.rows, sleep.items]);

  // Write one update and its log entry. Returns the log entry, or null if nothing changed.
  const commit = useCallback(async (update) => {
    const current = readSettings();
    if (update.apply.type === 'goal') {
      const before = { goal: current.coachGoal ?? null };
      const after = { goal: update.apply.goal };
      const entry = logEntry(update, 'applied', { before, after });
      updateSettings({ ...settingsForGoal(update.apply.goal, current.macros), coachLog: pushLog(current.coachLog, entry) }, current);
      return entry;
    }
    if (update.apply.type === 'split') {
      const prev = (programs.items || []).find(p => p?.isActive) || null;
      const names = storage.get(STORAGE_KEYS.SPLIT_NAMES, null) || undefined;
      const newId = await programs.add({ name: `${update.apply.days}-day plan (coach)`, isActive: true, days: suggestWeek(update.apply.days, names), pinnedExercises: {} });
      if (!newId) return null;
      if (prev) await programs.update(prev.id, { isActive: false });
      const entry = logEntry(update, 'applied', { before: { programId: prev?.id ?? null }, after: { programId: newId } });
      updateSettings({ coachLog: pushLog(readSettings().coachLog, entry) });
      return entry;
    }
    if (update.apply.type === 'advice') {
      // Advice changes no data: it is logged (so it is not repeated for a few days) and shown in the recent list.
      const entry = logEntry(update, 'applied');
      updateSettings({ coachLog: pushLog(readSettings().coachLog, entry) });
      return entry;
    }
    if (update.apply.type === 'water') {
      const before = { water: water.data };
      const after = { water: update.apply.profile };
      const entry = logEntry(update, 'applied', { before, after });
      await water.save(after.water);
      updateSettings({ coachLog: pushLog(readSettings().coachLog, entry) });
      return entry;
    }
    return null;
  }, [programs, water]);

  const undo = useCallback(async (entry) => {
    const current = readSettings();
    const entries = Array.isArray(current.coachLog) ? current.coachLog : [];
    if (entry.after?.goal) {
      if (!canUndo(entry, entries, current.coachGoal)) return false;
      const restored = entry.before?.goal;
      const marked = entries.map(e => (e.id === entry.id ? { ...e, status: 'undone' } : e));
      updateSettings({ ...(restored ? settingsForGoal(restored, current.macros) : { coachGoal: null }), coachLog: marked }, current);
      return true;
    }
    if (entry.after?.programId) {
      // The new plan is kept (you may have edited it); the previous one becomes active again.
      if (entry.before?.programId) await programs.update(entry.before.programId, { isActive: true });
      await programs.update(entry.after.programId, { isActive: false });
      updateSettings({ coachLog: entries.map(e => (e.id === entry.id ? { ...e, status: 'undone' } : e)) });
      return true;
    }
    if (entry.after?.water) {
      if (!undoableWater(entry, entries, water.data)) return false;
      await water.save(entry.before.water);
      updateSettings({ coachLog: entries.map(e => (e.id === entry.id ? { ...e, status: 'undone' } : e)) });
      return true;
    }
    return false;
  }, [programs, water]);

  const applyAsk = useCallback(async (update) => {
    if (applying) return;
    applying = true;
    try {
      const entry = await commit(update);
      if (entry) toast({ message: `Coach updated: ${entry.title}`, type: 'success', undo: () => undo(entry) });
    } finally { applying = false; }
  }, [commit, undo]);

  const dismiss = useCallback((update) => {
    const current = readSettings();
    updateSettings({ coachLog: pushLog(current.coachLog, logEntry(update, 'dismissed')) }, current);
  }, []);

  // The auto-apply loop: only the App-level copy runs it, only once data has synced.
  const startedAt = useRef(Date.now());
  useEffect(() => {
    if (!run || !synced) return undefined;
    const auto = updates.filter(u => u.mode === 'auto');
    if (!auto.length) return undefined;
    const wait = Math.max(0, WARMUP_MS - (Date.now() - startedAt.current));
    const t = setTimeout(async () => {
      if (applying) return;
      applying = true;
      try {
        // One update per pass: the next pass sees the new goal and the cooldown.
        const entry = await commit(auto[0]);
        if (entry) toast({ message: `Coach updated: ${entry.title}`, type: 'success', undo: () => undo(entry) });
      } finally { applying = false; }
    }, wait);
    return () => clearTimeout(t);
  }, [run, synced, updates, commit, undo]);

  const pending = useMemo(() => updates.filter(u => u.mode === 'ask'), [updates]);
  const undoable = useCallback((entry) => (entry.after?.goal ? canUndo(entry, log, settings.coachGoal)
    : entry.after?.water ? undoableWater(entry, log, water.data)
    : entry.status === 'applied' && !!entry.after?.programId && log.find(e => e.after?.programId && e.status === 'applied')?.id === entry.id), [log, settings.coachGoal, water.data]);

  return { pending, log, applyAsk, dismiss, undo, undoable };
}
