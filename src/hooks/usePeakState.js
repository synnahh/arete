//  usePeakState  computes 0-100 daily Peak State score 
// Resets at midnight. Sleep = previous night's entry only.
// Factors: sleep quality 25%, sleep duration 15%, hydration 15%,
//          supplements 10%, macros 10%, workout 10%, stimulants 10%, mood 5%

import { useState, useEffect, useRef } from 'react';
import { supabase, getUserId, getUserIdSync } from '../supabase/supabase.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';

const TODAY = () => toLocalDateKey(new Date());
const YESTERDAY = () => {
  const d = new Date(); d.setDate(d.getDate() - 1); return toLocalDateKey(d);
};

function clamp(v, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, v)); }

function waterGoalMl() {
  try {
    const p = JSON.parse(localStorage.getItem('valerie_water_profile') || '{}');
    const kg = p.unit === 'lbs' ? (p.weight || 176) * 0.4536 : (p.weight || 80);
    const base = kg * (p.sex === 'female' ? 31 : 35);
    const act  = ((p.trainingHoursPerWeek || 0) / 7) * 500;
    const caf  = Math.max(0, ((p.dailyCaffeineMg || 0) - 200) * 1.5);
    return Math.round((base + act + caf) / 50) * 50 || 2500;
  } catch { return 2500; }
}

function scoreColor(s) {
  if (s >= 80) return '#4caf7d';
  if (s >= 60) return '#f4a642';
  if (s >= 40) return '#f97316';
  return '#e25d7a';
}

function computeScore(collections, settings) {
  const today  = TODAY();
  const yest   = YESTERDAY();
  const { sleepData, waterLogs, suppLogs, supplements, nutritionLogs, workoutLogs, stimLogs, moodLogs } = collections;

  let score = 0;
  const factors = {};
  const actions = []; // "what to do now" suggestions

  //  1. Sleep quality (efficiency %)  25% 
  const prevSleep = [...(sleepData || [])].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).find(s => s.date <= today);
  const sleepEff = prevSleep?.efficiency ?? null;
  const sleepQualityScore = sleepEff !== null ? clamp(sleepEff) : 0;
  const sleepQualityPts   = (sleepQualityScore / 100) * 25;
  score += sleepQualityPts;
  factors.sleepQuality = { label: 'Sleep Quality', value: sleepEff !== null ? `${sleepEff}%` : 'No data', pts: Math.round(sleepQualityPts), max: 25, pct: sleepQualityScore };
  if (sleepEff === null) actions.push({ priority: 3, text: 'Log last night\'s sleep to unlock +25 points' });
  else if (sleepEff < 70) actions.push({ priority: 2, text: `Sleep efficiency was ${sleepEff}%  aim for 85%+ tonight` });

  //  2. Sleep duration (vs 8h = 480 min)  15% 
  const sleepDur  = prevSleep?.duration ?? null;
  const durScore  = sleepDur !== null ? clamp((sleepDur / 480) * 100) : 0;
  const durPts    = (durScore / 100) * 15;
  score += durPts;
  const durH = sleepDur ? Math.floor(sleepDur / 60) : 0;
  const durM = sleepDur ? sleepDur % 60 : 0;
  factors.sleepDuration = { label: 'Sleep Duration', value: sleepDur !== null ? `${durH}h ${durM}m` : 'No data', pts: Math.round(durPts), max: 15, pct: durScore };
  if (sleepDur !== null && sleepDur < 420) actions.push({ priority: 2, text: `Only ${durH}h ${durM}m sleep  target 78h tonight` });

  //  3. Hydration  15% 
  const goal       = waterGoalMl();
  const todayWater = (waterLogs || []).filter(l => l.date === today).reduce((s, l) => s + (l.amount || 0), 0);
  const hydPct     = clamp((todayWater / goal) * 100);
  const hydPts     = (hydPct / 100) * 15;
  score += hydPts;
  const remaining  = Math.max(0, goal - todayWater);
  factors.hydration = { label: 'Hydration', value: `${todayWater >= 1000 ? (todayWater / 1000).toFixed(1) + 'L' : todayWater + 'ml'} / ${goal >= 1000 ? (goal / 1000).toFixed(1) + 'L' : goal + 'ml'}`, pts: Math.round(hydPts), max: 15, pct: hydPct };
  if (hydPct < 100 && remaining > 0) actions.push({ priority: hydPct < 50 ? 1 : 3, text: `Drink ${remaining >= 1000 ? (remaining / 1000).toFixed(1) + 'L' : remaining + 'ml'} more water to add +${Math.round(((remaining / goal) * 15))} pts` });

  //  4. Supplements  10% 
  const totalSupps = (supplements || []).length;
  const takenSupps = new Set((suppLogs || []).filter(l => l.date === today).map(l => l.suppId)).size;
  const suppPct    = totalSupps > 0 ? clamp((takenSupps / totalSupps) * 100) : 100;
  const suppPts    = (suppPct / 100) * 10;
  score += suppPts;
  factors.supplements = { label: 'Supplements', value: totalSupps > 0 ? `${takenSupps}/${totalSupps}` : 'None set', pts: Math.round(suppPts), max: 10, pct: suppPct };
  if (totalSupps > 0 && takenSupps < totalSupps) actions.push({ priority: 4, text: `Take ${totalSupps - takenSupps} remaining supplement${totalSupps - takenSupps > 1 ? 's' : ''} (+${Math.round(((totalSupps - takenSupps) / totalSupps) * 10)} pts)` });

  //  5. Macros  10% 
  const calGoal   = settings?.macroGoal    ?? 2500;
  const protGoal  = settings?.proteinGoal  ?? 160;
  const todayNut  = (nutritionLogs || []).filter(l => l.date === today);
  const todayCal  = todayNut.reduce((s, l) => s + (l.calories || 0), 0);
  const todayProt = todayNut.reduce((s, l) => s + (l.protein || 0), 0);
  const calScore  = clamp((todayCal / calGoal) * 100);
  const protScore = clamp((todayProt / protGoal) * 100);
  const macroPct  = (calScore + protScore) / 2;
  const macroPts  = (macroPct / 100) * 10;
  score += macroPts;
  factors.macros = { label: 'Macros', value: `${todayCal} kcal · ${todayProt}g pro`, pts: Math.round(macroPts), max: 10, pct: macroPct };
  if (macroPct < 80) actions.push({ priority: 4, text: `Log your meals to track macros (+${Math.round((1 - macroPct / 100) * 10)} pts available)` });

  //  6. Workout  10% 
  const workedOut   = (workoutLogs || []).some(l => l.date === today);
  const workoutPts  = workedOut ? 10 : 0;
  score += workoutPts;
  factors.workout = { label: 'Workout', value: workedOut ? 'Done S' : 'Not yet', pts: workoutPts, max: 10, pct: workedOut ? 100 : 0 };
  if (!workedOut) actions.push({ priority: 3, text: 'Complete a workout for +10 pts' });

  //  7. Stimulant timing  10% 
  // Penalty: any caffeine logged within 6h of midnight (i.e. after 18:00)
  const todayCaff = (stimLogs || []).filter(l => l.date === today && l.type === 'caffeine');
  const lateCaff  = todayCaff.filter(l => {
    const h = parseInt((l.time || '00:00').split(':')[0], 10);
    return h >= 18;
  });
  const stimScore  = lateCaff.length > 0 ? 0 : 100;
  const stimPts    = (stimScore / 100) * 10;
  score += stimPts;
  factors.stimulants = { label: 'Stimulant Timing', value: lateCaff.length > 0 ? `a Caffeine after 6PM` : 'Good', pts: Math.round(stimPts), max: 10, pct: stimScore };
  if (lateCaff.length > 0) actions.push({ priority: 2, text: 'Avoid caffeine after 6PM  it hurt sleep quality (-10 pts)' });

  //  8. Mood  5% 
  const todayMood = (moodLogs || []).find(m => m.date === today);
  const moodVal   = todayMood?.value ?? null;
  const moodScore = moodVal !== null ? clamp(((moodVal - 1) / 6) * 100) : 0;
  const moodPts   = (moodScore / 100) * 5;
  score += moodPts;
  factors.mood = { label: 'Mood', value: moodVal !== null ? `${moodVal}/7` : 'Not logged', pts: Math.round(moodPts), max: 5, pct: moodScore };
  if (moodVal === null) actions.push({ priority: 5, text: 'Log your mood in Progress tab for +5 pts' });

  const finalScore = Math.round(clamp(score));

  // Pick highest-priority action
  actions.sort((a, b) => a.priority - b.priority);
  const suggestion = actions[0]?.text ?? 'You\'re performing at peak. Keep it up!';

  return { score: finalScore, factors, suggestion, color: scoreColor(finalScore) };
}

export function usePeakState(settings) {

  // Water is stored as a flat array by useCollection  normalise on read so
  // legacy {daily:[]} format (written by old actions.js) still works.
  const _readWater = () => {
    const raw = storage.get(STORAGE_KEYS.WATER, []);
    return Array.isArray(raw) ? raw : (raw?.daily || []);
  };

  const [state, setState] = useState(() => {
    try {
      // Instant hydrate from localStorage  zero flicker
      const collections = {
        sleepData:     storage.get(STORAGE_KEYS.SLEEP, [])         || [],
        waterLogs:     _readWater(),
        suppLogs:      storage.get(STORAGE_KEYS.SUPP_LOGS, [])     || [],
        supplements:   storage.get(STORAGE_KEYS.SUPPLEMENTS, [])   || [],
        nutritionLogs: storage.get(STORAGE_KEYS.MACROS, [])        || [],
        workoutLogs:   storage.get(STORAGE_KEYS.WORKOUT_LOGS, [])  || [],
        stimLogs:      storage.get(STORAGE_KEYS.STIMULANTS, [])    || [],
        moodLogs:      storage.get(STORAGE_KEYS.MOOD_LOGS, [])     || [],
      };
      return computeScore(collections, settings);
    } catch (e) {
      console.warn('[usePeakState] init error:', e);
      return { score: 0, factors: {}, suggestion: '', color: '#e25d7a' };
    }
  });

  const collectionsRef = useRef({
    sleepData:     storage.get(STORAGE_KEYS.SLEEP, []),
    waterLogs:     _readWater(),
    suppLogs:      storage.get(STORAGE_KEYS.SUPP_LOGS, []),
    supplements:   storage.get(STORAGE_KEYS.SUPPLEMENTS, []),
    nutritionLogs: storage.get(STORAGE_KEYS.MACROS, []),
    workoutLogs:   storage.get(STORAGE_KEYS.WORKOUT_LOGS, []),
    stimLogs:      storage.get(STORAGE_KEYS.STIMULANTS, []),
    moodLogs:      storage.get(STORAGE_KEYS.MOOD_LOGS, []),
  });
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const recompute = () => {
    try { setState(computeScore(collectionsRef.current, settingsRef.current)); }
    catch (e) { console.warn('[usePeakState] recompute error:', e); }
  };

  useEffect(() => {
    let channel;
    const TABLE_MAP = [
      ['sleep_data',      STORAGE_KEYS.SLEEP,        'sleepData'],
      ['water_logs',      STORAGE_KEYS.WATER,        'waterLogs'],
      ['supplement_logs', STORAGE_KEYS.SUPP_LOGS,    'suppLogs'],
      ['supplements',     STORAGE_KEYS.SUPPLEMENTS,  'supplements'],
      ['nutrition_logs',  STORAGE_KEYS.MACROS,       'nutritionLogs'],
      ['workout_logs',    STORAGE_KEYS.WORKOUT_LOGS, 'workoutLogs'],
      ['stimulant_logs',  STORAGE_KEYS.STIMULANTS,   'stimLogs'],
      ['mood_logs',       STORAGE_KEYS.MOOD_LOGS,    'moodLogs'],
    ];

    async function fetchTable(tableName, storageKey, key, uid) {
      const { data, error } = await supabase.from(tableName).select('*').eq('user_id', uid).order('created_at', { ascending: false });
      // A failed fetch (offline, network, auth) used to write [] over the local
      // mirror of all eight tables. Keep what we have instead.
      if (error || !Array.isArray(data)) {
        if (error) console.warn(`[usePeakState] ${tableName} fetch failed:`, error.message);
        return;
      }
      const mapped = data.map(r => ({ id: r.id, ...r.data }));
      collectionsRef.current = { ...collectionsRef.current, [key]: mapped };
      storage.set(storageKey, mapped);
      recompute();
    }

    let alive = true;
    getUserId().then(uid => {
      if (!alive) return; // effect was cleaned up before getUserId resolved (StrictMode)
      if (!uid) return;   // not signed in: nothing to fetch, keep the local mirror
      TABLE_MAP.forEach(([t, s, k]) => fetchTable(t, s, k, uid));
      // Unique channel name per mount — avoids reusing an already-subscribed channel
      // (which throws "cannot add postgres_changes callbacks after subscribe()").
      channel = supabase.channel(`peak_state:${uid}:${Math.random().toString(36).slice(2)}`);
      TABLE_MAP.forEach(([t, s, k]) => {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: 'user_id=eq.' + uid },
          () => fetchTable(t, s, k, uid));
      });
      channel.subscribe();
    });

    return () => { alive = false; if (channel) supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Recompute when settings change (macro goals etc.)
  useEffect(() => { recompute(); }, [settings?.macroGoal, settings?.proteinGoal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Midnight reset  reschedules itself so it fires every night, not just the first
  useEffect(() => {
    const msUntilMidnight = () => {
      const now = new Date();
      const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
      return midnight - now;
    };
    let id;
    const schedule = () => {
      id = setTimeout(() => { recompute(); schedule(); }, msUntilMidnight());
    };
    schedule();
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}


