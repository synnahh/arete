// workoutImport.js — bring a training plan written elsewhere (Claude, ChatGPT, a coach, notes)
// into the app with no AI link. Pure.
//
//   buildWorkoutPrompt()  the text you give an AI so its answer is readable here.
//   parseWorkoutPlan()    reads JSON from that prompt, or plain text such as
//                         "Monday - Upper A / Bench Press 3x8-10 / Lat Pulldown 3 x 8-12".
//   matchExercise()       finds each lift in the exercise database (exact, then close wording).
//   buildWorkoutImport()  turns the reading into library entries and a program, writing nothing.
//   detectKind()          meal plan or training plan? Used by "Paste and apply".
//
// Nothing is guessed silently: lifts not in the database come back as `custom` so the review
// can say so, and are added as your own exercises with no starting weight.

import { EXERCISE_DB, findExercise, toLibraryEntry } from './exerciseDb.js';
import { freshEntries } from './exercisePick.js';
import { firstJson, normaliseDay } from './mealPlanImport.js';

export const WEEK_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_KEY = { Monday: 'mon', Tuesday: 'tue', Wednesday: 'wed', Thursday: 'thu', Friday: 'fri', Saturday: 'sat', Sunday: 'sun' };
// Where n unnamed training days go in the week.
const SPREAD = { 1: ['mon'], 2: ['mon', 'thu'], 3: ['mon', 'wed', 'fri'], 4: ['mon', 'tue', 'thu', 'fri'], 5: ['mon', 'tue', 'wed', 'thu', 'fri'], 6: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], 7: WEEK_KEYS };

export function buildWorkoutPrompt({ days = 4, level = 'intermediate', equipment = 'full gym', goal = 'build muscle', notes = '' } = {}) {
  return `Create a weekly training program for me.

Training days per week: ${days}. Experience: ${level}. Equipment: ${equipment}. Goal: ${goal}.
Notes (injuries, preferences): ${notes.trim() || 'none'}.

Reply with ONLY one JSON object, no explanation and no markdown fences, in exactly this shape:
{
  "name": "Upper / Lower 4 day",
  "days": [
    {
      "day": "Monday",
      "label": "Upper A",
      "exercises": [
        { "name": "Bench Press", "sets": 3, "reps": "6-10" },
        { "name": "Close-Grip Lat Pulldown", "sets": 3, "reps": "8-12" }
      ]
    },
    { "day": "Tuesday", "label": "Rest", "exercises": [] }
  ]
}

Rules:
- Include all 7 days Monday to Sunday; rest days have an empty exercises list.
- Use common, standard exercise names (for example Bench Press, Romanian Deadlift, Lateral Raise, Hack Squat).
- "reps" is a range like "8-12" or a single number. "sets" is a number from 1 to 8.
- 5 to 8 exercises per training day, hardest lifts first.`;
}

// ── Matching lifts to the exercise database ──────────────────────────────────

const WORD = { dumbbell: 'db', dumbbells: 'db', barbell: 'bb', 'smith machine': 'smith', 'romanian': 'romanian', rdl: 'romanian deadlift', ohp: 'overhead press', 'pull-up': 'pull up', 'pull-ups': 'pull up', pullups: 'pull up', 'chin-up': 'chin up', 'chin-ups': 'chin up', raises: 'raise', curls: 'curl', presses: 'press', rows: 'row', squats: 'squat', extensions: 'extension', flyes: 'fly', flies: 'fly', pulldowns: 'pulldown' };
const STOP = new Set(['the', 'a', 'an', 'with', 'on', 'bb', 'machine', 'standing']);

function tokens(name) {
  let s = String(name || '').toLowerCase().replace(/[()]/g, ' ').replace(/[^a-z0-9\- ]+/g, ' ');
  s = s.split(/\s+/).map(w => WORD[w] ?? w).join(' ');
  return new Set(s.replace(/-/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)));
}

const DB_TOKENS = EXERCISE_DB.map(ex => ({ ex, t: tokens(ex.name) }));

/** { ex, exact } for the best database match, or { ex: null }. Needs most words in common, never a loose guess. */
export function matchExercise(name) {
  const direct = findExercise(name);
  if (direct) return { ex: direct, exact: true };
  const want = tokens(name);
  if (!want.size) return { ex: null };
  let best = null, bestScore = 0;
  for (const { ex, t } of DB_TOKENS) {
    let hit = 0;
    for (const w of want) if (t.has(w)) hit++;
    const score = hit / (want.size + t.size - hit); // Jaccard
    if (score > bestScore) { best = ex; bestScore = score; }
  }
  return bestScore >= 0.6 ? { ex: best, exact: false } : { ex: null };
}

// ── Reading a pasted plan ────────────────────────────────────────────────────

const num = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : 0; };
const clampSets = (n) => Math.min(8, Math.max(1, n || 3));

function parseReps(reps) {
  const m = /^(\d{1,3})(?:\s*[-\u2013to]+\s*(\d{1,3}))?/i.exec(String(reps ?? '').trim());
  if (!m) return {};
  const a = num(m[1]), b = m[2] ? num(m[2]) : a;
  return { repsMin: Math.min(a, b), repsMax: Math.max(a, b) };
}

function exerciseFrom(raw) {
  const name = String(raw?.name || raw?.exercise || '').trim().slice(0, 80);
  if (!name) return null;
  const reps = raw.repsMin || raw.repsMax ? { repsMin: num(raw.repsMin) || num(raw.repsMax), repsMax: num(raw.repsMax) || num(raw.repsMin) } : parseReps(raw.reps);
  return { name, sets: clampSets(num(raw.sets)), ...reps };
}

function fromJson(json) {
  const src = json?.program || json;
  const list = Array.isArray(src) ? src : Array.isArray(src?.days) ? src.days : Array.isArray(src?.plan) ? src.plan : Array.isArray(src?.weeks?.[0]?.days) ? src.weeks[0].days : null;
  if (!list) return null;
  const days = list.map((d, i) => {
    const heading = String(d?.day || d?.name || '').trim();
    const wk = normaliseDay(heading);
    const exercises = (Array.isArray(d?.exercises) ? d.exercises : []).map(exerciseFrom).filter(Boolean);
    const label = String(d?.label || d?.focus || d?.title || '').trim();
    return { key: DAY_KEY[wk] || null, label: label || (DAY_KEY[wk] ? '' : heading) || `Day ${i + 1}`, rest: !exercises.length, exercises };
  });
  return { name: String(src?.name || src?.title || '').trim(), days };
}

const SETS_FIRST = /(\d{1,2})\s*(?:x|\u00d7|sets?\s*(?:of|x)?)\s*(\d{1,3})(?:\s*(?:-|\u2013|to)\s*(\d{1,3}))?/i;
const SETS_REPS_WORDS = /(\d{1,2})\s*sets?\b[^\d]{0,15}(\d{1,3})(?:\s*(?:-|\u2013|to)\s*(\d{1,3}))?\s*reps?/i;

function parseExerciseLine(line) {
  let m = SETS_FIRST.exec(line) || SETS_REPS_WORDS.exec(line);
  if (!m) return null;
  const sets = clampSets(num(m[1]));
  const a = num(m[2]), b = m[3] ? num(m[3]) : a;
  const clean = (s) => s.replace(/^[\s>*\-\u2022\d.)]+/, '').replace(/[*_`#]/g, '').replace(/[\s:,\-\u2013\u2014|@(]+$/, '').trim();
  let name = clean(line.slice(0, m.index));
  if (!name) name = clean(line.slice(m.index + m[0].length).replace(/^[\s:\-\u2013\u2014]+/, ''));
  if (!name || name.length > 70) return null;
  return { name, sets, repsMin: Math.min(a, b), repsMax: Math.max(a, b) };
}

function fromText(text) {
  const days = [];
  let cur = null;
  let name = '';
  for (const raw of String(text || '').replace(/```[a-z]*/gi, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const ex = parseExerciseLine(line);
    if (ex) {
      if (!cur) { cur = { key: null, label: '', rest: false, exercises: [] }; days.push(cur); }
      cur.exercises.push(ex);
      continue;
    }
    const head = line.replace(/^[\s#>*_\-\u2022]+|[*_:\s]+$/g, '');
    if (!head || head.length > 60 || /^[\-\u2022*]\s/.test(line) && !/^[\-*]{2}/.test(line)) continue;
    // "Monday - Upper A", "Monday: Rest", "Day 2 - Pull", "Upper A"
    const m = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s*(?:[:\-\u2013\u2014]\s*(.+))?$/i.exec(head);
    const dm = /^day\s*\d+\s*(?:[:\-\u2013\u2014]\s*(.+))?$/i.exec(head);
    if (m) {
      const label = (m[2] || '').trim();
      cur = { key: DAY_KEY[normaliseDay(m[1])], label, rest: /^(rest|off|recovery)$/i.test(label), exercises: [] };
      days.push(cur);
    } else if (dm) {
      const label = (dm[1] || head).trim();
      cur = { key: null, label, rest: /^(rest|off)$/i.test(label), exercises: [] };
      days.push(cur);
    } else if (!days.length && !name && head.length <= 50 && /\b(plan|program|programme|routine|split|week|schedule)\b/i.test(head)) {
      name = head; // a title line before the first day
    } else if (!/^(warm|cool|note|tip|rest\s+\d)/i.test(head) && !/[.!?]$/.test(head)) {
      cur = { key: null, label: head, rest: /^(rest|off)( day)?$/i.test(head), exercises: [] };
      days.push(cur);
    }
  }
  return { name, days };
}

/** Assign weekday keys: named days keep theirs, the rest fill the spread for the number of unnamed training days. */
function assignKeys(days) {
  const used = new Set(days.map(d => d.key).filter(Boolean));
  const unnamed = days.filter(d => !d.key && d.exercises.length);
  const slots = (SPREAD[Math.min(7, Math.max(1, unnamed.length + used.size))] || WEEK_KEYS).filter(k => !used.has(k));
  const free = slots.length >= unnamed.length ? slots : [...slots, ...WEEK_KEYS.filter(k => !used.has(k) && !slots.includes(k))];
  unnamed.forEach((d, i) => { d.key = free[i] || null; });
  return days;
}

/**
 * Read a pasted training plan. Returns { ok: true, name, days } (days: key, label, rest, exercises[])
 * or { ok: false, reason }.
 */
export function parseWorkoutPlan(text) {
  const raw = String(text || '').trim();
  if (!raw) return { ok: false, reason: 'Paste a plan first.' };
  if (raw.length > 200000) return { ok: false, reason: 'That is too long to be a training plan.' };
  const json = firstJson(raw);
  let read = json ? fromJson(json) : null;
  if (!read || !read.days.some(d => d.exercises.length)) read = fromText(raw);
  const days = assignKeys(read.days.filter(d => d.exercises.length || d.rest || d.key));
  const trained = days.filter(d => d.exercises.length && d.key);
  if (!trained.length) return { ok: false, reason: 'No exercises found. Each line needs a name and sets x reps, for example "Bench Press 3x8-10", under a day heading such as "Monday - Upper A".' };
  // Two days landing on the same weekday keeps the first; the rest are reported, not lost silently.
  const seen = new Set();
  const problems = [];
  for (const d of trained) {
    if (seen.has(d.key)) { problems.push(`"${d.label || d.key}" shares a weekday with another day and was left out.`); d.skip = true; } else seen.add(d.key);
  }
  return { ok: true, name: read.name, days: days.filter(d => !d.skip), problems };
}

// ── Turning it into app data ────────────────────────────────────────────────

const lc = (s) => String(s || '').trim().toLowerCase();
const slug = (name) => lc(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * What importing would add. Nothing is written here.
 * Returns { program, exercises, matched, custom, notes }:
 *  - exercises: new library entries (database lifts you lack, plus your-own entries for unknown names)
 *  - matched: [{ asked, as }] lifts read as a differently-worded database exercise
 *  - custom: names not in the database, added as your own exercises
 */
export function buildWorkoutImport(parsed, { library = [], programs = [], programName = '' } = {}) {
  const byName = new Map(library.map(e => [lc(e.name), e]));
  const wanted = [], matched = [], custom = [];
  const resolved = new Map(); // asked name (lc) -> library name (lc)

  for (const d of parsed.days) for (const e of d.exercises) {
    const k = lc(e.name);
    if (resolved.has(k)) continue;
    if (byName.has(k)) { resolved.set(k, k); continue; }
    const { ex, exact } = matchExercise(e.name);
    if (ex) {
      resolved.set(k, lc(ex.name));
      if (!exact) matched.push({ asked: e.name, as: ex.name });
      if (!byName.has(lc(ex.name)) && !wanted.some(w => lc(w.name) === lc(ex.name))) wanted.push(toLibraryEntry(ex));
    } else {
      resolved.set(k, k);
      custom.push(e.name);
      wanted.push({ id: `custom-${slug(e.name)}`, name: e.name, day: 'push', bodyweight: false, gym: 'both', startingWeight: 0, repsMin: e.repsMin || 8, repsMax: e.repsMax || 12, increment: 2.5 });
    }
  }

  const exercises = freshEntries(wanted, library);
  const idByName = new Map(library.map(e => [lc(e.name), e.id]));
  for (const e of exercises) idByName.set(lc(e.name), e.id);

  const days = {};
  for (const key of WEEK_KEYS) days[key] = { splitType: 'rest', label: 'Rest' };
  for (const d of parsed.days) {
    if (!d.key || !d.exercises.length) continue;
    const ids = [], targets = {};
    for (const e of d.exercises) {
      const id = idByName.get(resolved.get(lc(e.name)));
      if (!id || ids.includes(id)) continue;
      ids.push(id);
      targets[id] = { sets: e.sets, ...(e.repsMin ? { repsMin: e.repsMin, repsMax: e.repsMax } : {}) };
    }
    days[d.key] = { splitType: 'custom', label: d.label || 'Training', exerciseIds: ids, targets };
  }

  const base = (programName || parsed.name || 'Imported program').trim().slice(0, 60);
  const taken = new Set(programs.map(p => lc(p.name)));
  let name = base, n = 2;
  while (taken.has(lc(name))) name = `${base} (${n++})`;
  const trainingDays = Object.values(days).filter(d => d.splitType !== 'rest').length;
  return {
    program: { name, isActive: true, days, pinnedExercises: {}, note: 'Imported from pasted text', source: 'paste-import' },
    exercises, matched, custom, trainingDays,
  };
}

// ── Which kind of plan is this? ─────────────────────────────────────────────

/** 'meal' | 'workout' | null, from what the pasted text looks like. */
export function detectKind(text) {
  const t = String(text || '');
  const json = firstJson(t);
  if (json) {
    const s = JSON.stringify(json).slice(0, 4000);
    const meal = /"(calories|kcal|protein)"/i.test(s), work = /"(exercises|sets|reps)"/i.test(s);
    if (meal && !work) return 'meal';
    if (work && !meal) return 'workout';
  }
  const kcal = (t.match(/\d\s*(?:kcal|cals?\b|calories)/gi) || []).length;
  const sets = (t.match(new RegExp(SETS_FIRST.source, 'gi')) || []).length + (t.match(/\d\s*sets?\b/gi) || []).length;
  if (!kcal && !sets) return null;
  return kcal >= sets ? 'meal' : 'workout';
}
