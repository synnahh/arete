//  context.js  Dynamic live context builder 
// Before every AI request, we assemble a real-time snapshot of the app's state.
// This is injected into VALERIE's system prompt so she always speaks from
// current knowledge  never generically.

import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey, isOnLocalDay } from '../utils/localDate.js';
import { normalizeTasks } from '../domain/tasks.js';

//  buildContext 
/**
 * Assembles a live context string from localStorage data.
 * @param {object} opts
 * @param {string} [opts.activeTab]  currently visible tab
 * @returns {string}
 */
export function buildContext({ activeTab = 'dashboard' } = {}) {
  const now  = new Date();
  const date = now.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const time = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });

  const lines = [
    `Date: ${date}`,
    `Time: ${time}`,
    `Active tab: ${activeTab}`,
    '',
  ];

  //  Tasks 
  try {
    // normalizeTasks reads both the UI shape {text, done} and the legacy
    // assistant shape {title, completed}. Previously this read only the legacy
    // shape, so done UI tasks counted as pending and were named "undefined".
    const tasks = normalizeTasks(storage.get(STORAGE_KEYS.TASKS, []));
    const open  = tasks.filter(t => !t.done);
    const high  = open.filter(t => t.priority === 'high');
    lines.push(`Pending tasks: ${open.length} total${high.length ? `, ${high.length} high priority` : ''}`);
    const preview = open.slice(0, 4).map(t => `"${t.text}"${t.priority === 'high' ? ' [HIGH]' : ''}`).join(', ');
    if (preview) lines.push(`   ${preview}`);
  } catch {}

  //  Calendar events 
  try {
    const events   = storage.get(STORAGE_KEYS.EVENTS, []);
    const today    = toLocalDateKey(now);
    const upcoming = events
      .filter(e => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
    if (upcoming.length) {
      lines.push(`Upcoming events: ${upcoming.map(e => `"${e.title}" on ${e.date}${e.time ? ' at ' + e.time : ''}`).join('; ')}`);
    } else {
      lines.push('Upcoming events: None scheduled');
    }
  } catch {}

  //  Habits / streaks 
  try {
    const habits = storage.get(STORAGE_KEYS.HABITS, []);
    if (habits.length) {
      const activeStreaks = habits
        .filter(h => (h.streak || 0) > 0)
        .sort((a, b) => (b.streak || 0) - (a.streak || 0))
        .slice(0, 3);
      if (activeStreaks.length) {
        lines.push(`Active habit streaks: ${activeStreaks.map(h => `${h.name} (${h.streak}d)`).join(', ')}`);
      }
    }
  } catch {}

  //  Focus session 
  try {
    const sessions = storage.get(STORAGE_KEYS.FOCUS_SESSIONS, []);
    const todayStr = toLocalDateKey(now);
    const todaySessions = sessions.filter(s => isOnLocalDay(s.date || s.completedAt, todayStr));
    if (todaySessions.length) {
      lines.push(`Focus sessions today: ${todaySessions.length} completed`);
    }
  } catch {}

  //  Health / water 
  // Water is stored as a flat array of {date, amount, ...} objects by useCollection
  try {
    const waterLogs = storage.get(STORAGE_KEYS.WATER, []);
    const today     = toLocalDateKey(now);
    // Handle both flat-array format (current) and legacy {daily:[]} object format
    const logs = Array.isArray(waterLogs) ? waterLogs : (waterLogs?.daily || []);
    const todayML = logs
      .filter(e => e.date === today)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    if (todayML > 0) {
      lines.push(`Water today: ${todayML >= 1000 ? (todayML / 1000).toFixed(1) + 'L' : todayML + 'ml'}`);
    }
  } catch {}

  //  Sleep 
  try {
    const sleepLogs = storage.get(STORAGE_KEYS.SLEEP, []);
    const logs = Array.isArray(sleepLogs) ? sleepLogs : [];
    const last = [...logs].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
    if (last) {
      const h = Math.floor((last.duration || (last.hours || 0) * 60) / 60);
      const m = (last.duration || (last.hours || 0) * 60) % 60;
      const dur = last.duration ? `${h}h ${m}m` : last.hours ? `${last.hours}h` : null;
      const eff = last.efficiency ? ` (${last.efficiency}% efficiency)` : '';
      if (dur) lines.push(`Last sleep: ${dur}${eff} on ${last.date}`);
    }
  } catch {}

  //  Mood 
  try {
    const moodLogs = storage.get(STORAGE_KEYS.MOOD_LOGS, []);
    const todayStr = toLocalDateKey(now);
    const todayMood = moodLogs.find(m => m.date === todayStr);
    if (todayMood) {
      lines.push(`Mood today: ${todayMood.emoji || ''} (${todayMood.value || ''}/10)`);
    } else {
      lines.push('Mood today: Not yet logged');
    }
  } catch {}

  //  XP / rank 
  try {
    const xpData = storage.get('xp', { total: 0 });
    if (xpData.total > 0) {
      lines.push(`XP total: ${xpData.total.toLocaleString()}`);
    }
  } catch {}

  //  Finance snapshot 
  try {
    const transactions = storage.get(STORAGE_KEYS.TRANSACTIONS, []);
    const now7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekTransactions = transactions.filter(t => new Date(t.date) >= now7);
    const weekSpend = weekTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    if (weekSpend > 0) {
      lines.push(`Spending this week: $${weekSpend.toFixed(2)}`);
    }
  } catch {}

  //  Body / physique (from Health body_metrics — also fed by Apple Health)
  try {
    const body   = storage.get(STORAGE_KEYS.BODY, []);
    const latest = [...(Array.isArray(body) ? body : [])].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
    if (latest?.weight) lines.push(`Body: ${latest.weight}kg${latest.bodyFat ? `, ${latest.bodyFat}% body fat` : ''}${latest.muscle ? `, ${latest.muscle}kg muscle` : ''}`);
  } catch {}

  //  Looksmaxxing (LM) phase + appearance scorecard
  try {
    const lm = storage.get('valerie_lm_profile', {}) || {};
    if (lm.phase) lines.push(`Looksmaxxing phase: ${lm.phase}${(lm.priorities || []).length ? ` (priorities: ${lm.priorities.join(', ')})` : ''}`);
    const sc = lm.scorecard;
    if (sc) {
      const vals = Object.values(sc).map(v => v?.current).filter(v => v != null);
      if (vals.length) lines.push(`Appearance scorecard: ${(vals.reduce((a, b) => a + Number(b), 0) / vals.length).toFixed(1)}/10 avg across ${vals.length} categories`);
    }
  } catch {}

  return lines.filter(l => l !== undefined).join('\n');
}
