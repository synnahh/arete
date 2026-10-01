// mindToday.js — the Mind front page's logic. Pure; UI is tabs/MindToday.jsx.
//
// Journal entries are ordinary notes (collection `notes`) flagged `journal: true` with a `date`,
// so they sync with no new table and still show in the Notes screen. The structured fields
// (intention, gratitude, reflection) are the source of truth; `body` is rebuilt from them on save.
import { dayIndex, keyOfDay } from '../utils/dayIndex.js';

export const MOOD_LABELS = ['Rough', 'Low', 'Flat', 'Okay', 'Good', 'Great', 'Peak']; // index = stored `mood` (0-6)

const stripBullet = (line) => String(line).replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
const linesOf = (text) => String(text || '').split(/\r?\n/).map(stripBullet).filter(l => l.length >= 3);

/**
 * One line from your own constitution for today, the same all day and different tomorrow:
 * non-negotiables, rules, principles and values pooled in that order. Null when there is nothing written.
 */
export function standardOfDay(constitution, date) {
  const i = dayIndex(date);
  if (i == null || !constitution) return null;
  const pool = [];
  for (const [key, source] of [['nonNegotiables', 'Non-negotiable'], ['rules', 'Rule'], ['principles', 'Principle'], ['values', 'Value']]) {
    for (const text of linesOf(constitution[key])) pool.push({ text, source });
  }
  return pool.length ? pool[((i % pool.length) + pool.length) % pool.length] : null;
}

/** The last `days` days of mood, oldest first, plus the 7-day average and its change on the 7 before. */
export function moodStrip(logs = [], today, days = 14) {
  const t = dayIndex(today);
  if (t == null) return null;
  const by = new Map();
  for (const l of logs) {
    const m = Number(l?.mood);
    if (l?.date && dayIndex(l.date) != null && Number.isInteger(m) && m >= 0 && m <= 6) by.set(l.date, m);
  }
  const strip = Array.from({ length: days }, (_, k) => { const date = keyOfDay(t - (days - 1 - k)); return { date, mood: by.has(date) ? by.get(date) : null }; });
  const avg = (rows) => { const v = rows.filter(r => r.mood != null).map(r => r.mood); return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null; };
  const last7 = strip.slice(-7), prev7 = strip.slice(-14, -7);
  const a = avg(last7), b = avg(prev7);
  return { strip, today: by.has(today) ? by.get(today) : null, avg7: a, change: a != null && b != null ? Math.round((a - b) * 10) / 10 : null, logged: strip.filter(r => r.mood != null).length };
}

export const journalTitle = (date) => `Journal · ${new Date(`${date}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}`;

/** The journal note for `date`, if there is one. */
export const journalFor = (notes = [], date) => notes.find(n => n?.journal === true && n.date === date) || null;

/** Fields from a journal note, with sensible empties. */
export function readJournal(note) {
  const g = Array.isArray(note?.gratitude) ? note.gratitude.map(x => String(x || '')) : [];
  return { intention: String(note?.intention || ''), gratitude: [g[0] || '', g[1] || '', g[2] || ''], reflection: String(note?.reflection || '') };
}

/** Is there anything worth saving? */
export const journalHasContent = (j) => !!(j.intention.trim() || j.reflection.trim() || j.gratitude.some(x => x.trim()));

/** The note row to store for a day's journal. */
export function journalRow(date, j) {
  const gratitude = j.gratitude.map(x => x.trim()).filter(Boolean);
  const parts = [];
  if (j.intention.trim()) parts.push(`Intention: ${j.intention.trim()}`);
  if (gratitude.length) parts.push(`Grateful for:\n${gratitude.map(x => `- ${x}`).join('\n')}`);
  if (j.reflection.trim()) parts.push(`Reflection: ${j.reflection.trim()}`);
  return {
    title: journalTitle(date), body: parts.join('\n\n'), journal: true, date,
    intention: j.intention.trim(), gratitude, reflection: j.reflection.trim(), updatedAt: Date.now(),
  };
}

/** Consecutive days with a non-empty journal, ending today (or yesterday while today is still open). */
export function journalStreak(notes = [], today) {
  const t = dayIndex(today);
  if (t == null) return { current: 0, best: 0, today: false };
  const days = new Set(notes.filter(n => n?.journal === true && dayIndex(n.date) != null && (n.body || n.intention || n.reflection)).map(n => dayIndex(n.date)));
  const doneToday = days.has(t);
  let cur = 0;
  for (let d = doneToday ? t : t - 1; days.has(d); d--) cur++;
  let best = 0, run = 0, prev = null;
  for (const d of [...days].sort((a, b) => a - b)) { run = prev != null && d === prev + 1 ? run + 1 : 1; prev = d; if (run > best) best = run; }
  return { current: cur, best, today: doneToday };
}

/**
 * Decisions due a look: no actual outcome written yet, and either their review date has come or
 * they are over `afterDays` old. Oldest first.
 */
export function decisionsToRevisit(decisions = [], today, { afterDays = 30, limit = 3 } = {}) {
  const t = dayIndex(today);
  if (t == null) return [];
  return decisions
    .filter(d => d?.title && !String(d.actualOutcome || '').trim())
    .map(d => {
      const review = dayIndex(d.reviewDate), made = dayIndex(d.date);
      const due = review != null ? review <= t : made != null && t - made >= afterDays;
      return { d, due, since: made != null ? t - made : null };
    })
    .filter(x => x.due)
    .sort((a, b) => (b.since ?? 0) - (a.since ?? 0))
    .slice(0, limit)
    .map(x => ({ ...x.d, daysAgo: x.since }));
}

/** Watch-list items you are part-way through, newest first, and how many are queued. */
export function listsGlance(items = []) {
  const inProgress = items.filter(i => i?.status === 'in_progress' && i.title);
  return { inProgress: inProgress.slice(0, 4), upNext: items.filter(i => i?.status === 'up_next').length, total: items.length };
}
