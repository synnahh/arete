// homeLayout.js — what Home shows, in what order, and the small sums its cards need. Pure.
//
// Home is deliberately short. By default it shows six things (chosen by Rob): calories and protein
// left, weight and goal progress, streak, skin routine, water, sleep and readiness. Everything else
// is one tap away in Customise and off until you turn it on. The choice is saved in settings.home
// as an ordered list of section ids.

export const HOME_SECTIONS = [
  { id: 'calories', label: 'Calories and protein left', hint: 'Today against your targets', on: true },
  { id: 'weight',   label: 'Weight and goal progress',  hint: 'Latest weigh-in, trend, kg to go', on: true },
  { id: 'streak',   label: 'Streak and week',           hint: 'Days in a row you trained or logged', on: true },
  { id: 'skin',     label: 'Skin routine',              hint: 'Tick off morning and night steps', on: true },
  { id: 'water',    label: 'Water',                     hint: 'One-tap glasses against your goal', on: true },
  { id: 'sleep',    label: 'Sleep and readiness',       hint: 'Last night and how ready you are', on: true },
  { id: 'metrics',  label: 'Metrics',                   hint: 'Steps, heart, sleep, body: every reading, automatically', on: true },
  { id: 'workout',  label: "Today's workout",           hint: 'What you train today, with Start', on: false },
  { id: 'moves',    label: 'Next moves',                hint: 'The few things to do right now', on: false },
  { id: 'steps',    label: 'Steps',                     hint: 'Today and your 7-day average', on: false },
  { id: 'updates',  label: 'Coach updates',             hint: 'Changes the coach made, with Undo', on: false },
  { id: 'recap',    label: 'Weekly recap',              hint: 'How last week went', on: false },
  { id: 'overall',  label: 'Overall rating',            hint: 'One score from the last 28 days', on: false },
];

export const DEFAULT_HOME = HOME_SECTIONS.filter(s => s.on).map(s => s.id);
const VALID = new Set(HOME_SECTIONS.map(s => s.id));

// Sections that existed before `metrics` was added. A layout saved back then has not been offered it,
// so it is shown once (at the end) instead of staying hidden forever.
const LEGACY_SEEN = HOME_SECTIONS.map(s => s.id).filter(id => id !== 'metrics');

/** Every section id, for recording what a saved layout has already been offered. */
export const ALL_SECTION_IDS = HOME_SECTIONS.map(s => s.id);

/**
 * The ordered list of section ids to show: yours if saved (unknown ids dropped, no repeats), else the default.
 * A saved layout also gets any on-by-default section it has never been offered (`raw.seen`), so new cards such
 * as Metrics appear by themselves; turning one off is remembered because saving records everything as seen.
 */
export function cleanHome(raw) {
  const list = Array.isArray(raw?.sections) ? raw.sections : null;
  if (!list) return [...DEFAULT_HOME];
  const shown = [...new Set(list.filter(id => VALID.has(id)))];
  const seen = new Set(Array.isArray(raw?.seen) ? raw.seen : LEGACY_SEEN);
  const fresh = DEFAULT_HOME.filter(id => !seen.has(id) && !shown.includes(id));
  return [...shown, ...fresh];
}

/** Turn a section on (added at the end) or off. */
export function setSection(ids, id, on) {
  if (!VALID.has(id)) return ids;
  const has = ids.includes(id);
  if (on && !has) return [...ids, id];
  if (!on && has) return ids.filter(x => x !== id);
  return ids;
}

/** Move a shown section up (-1) or down (+1). */
export function moveSection(ids, id, delta) {
  const i = ids.indexOf(id), j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const out = [...ids];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

// ── Card sums ────────────────────────────────────────────────────────────────

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Calories and protein against today's targets: { kcal: { eaten, target, left, over, pct }, protein: {...} } or null without targets. */
export function calorieStatus(targets, eaten) {
  const part = (t, e) => {
    const target = Math.round(n(t)), eat = Math.round(n(e));
    if (!(target > 0)) return null;
    return { eaten: eat, target, left: Math.max(0, target - eat), over: Math.max(0, eat - target), pct: Math.min(1, eat / target) };
  };
  const kcal = part(targets?.kcal, eaten?.calories);
  if (!kcal) return null;
  return { kcal, protein: part(targets?.protein, eaten?.protein) };
}

/** Water against the goal, in millilitres. */
export function waterStatus(totalMl, goalMl) {
  const total = Math.max(0, Math.round(n(totalMl))), goal = Math.round(n(goalMl));
  return { total, goal: goal > 0 ? goal : null, left: goal > 0 ? Math.max(0, goal - total) : null, pct: goal > 0 ? Math.min(1, total / goal) : 0, done: goal > 0 && total >= goal };
}

/** The weight card: latest weigh-in, trend, kg lost or gained since the start, and kg to go. */
export function weightStatus(tiles, coach, goal) {
  if (!tiles && !coach) return null;
  const latest = tiles?.currentKg ?? coach?.latest ?? null;
  if (latest == null) return null;
  const rate = coach?.rate ?? null;
  const target = Number(goal?.targetWeightKg) > 0 ? Number(goal.targetWeightKg) : null;
  return {
    latest, trend: coach?.trend ?? null, lastDate: tiles?.lastDate ?? null,
    changeKg: tiles?.changeKg ?? 0, week: tiles?.week ?? null,
    toGoKg: target != null ? Math.round((target - (coach?.trend ?? latest)) * 10) / 10 : null,
    ratePerWeek: rate, target, paceMessage: coach?.pace?.message ?? null,
  };
}

// ── Page layout ──────────────────────────────────────────────────────────────

/** Sections that take the whole row instead of sharing it. */
export const FULL_WIDTH = ['metrics'];

// Rough card heights (1 = a short card), used only to even out the columns.
export const CARD_WEIGHT = { calories: 1, weight: 1.3, streak: 1.7, skin: 1.3, water: 1, sleep: 3.3, workout: 1, moves: 2, steps: 2, updates: 2, recap: 2, overall: 1.5 };

/**
 * Split the shown sections into rows. A full-width section is a row of its own; the sections around
 * it go into `columns` columns, tallest cards first, each to the column that is shortest so far (by CARD_WEIGHT), so
 * the columns end at about the same height and no card leaves a hole below it. Within a column the
 * cards keep the order you chose.
 * @returns {Array<{ full: string } | { cols: string[][] }>}
 */
export function layoutRows(ids, columns = 2) {
  const rows = [];
  let run = [];
  const flush = () => {
    if (!run.length) return;
    const cols = Array.from({ length: Math.max(1, columns) }, () => ({ ids: [], h: 0 }));
    const w = (id) => CARD_WEIGHT[id] ?? 1.5;
    // Tallest cards first (stable, so equal heights keep your order), then each column back in your order.
    const byHeight = [...run].sort((a, b) => w(b) - w(a));
    for (const id of byHeight) {
      const c = cols.reduce((best, x) => (x.h < best.h ? x : best), cols[0]);
      c.ids.push(id); c.h += w(id);
    }
    rows.push({ cols: cols.map(c => c.ids.sort((a, b) => run.indexOf(a) - run.indexOf(b))).filter(c => c.length) });
    run = [];
  };
  for (const id of ids) {
    if (FULL_WIDTH.includes(id)) { flush(); rows.push({ full: id }); } else run.push(id);
  }
  flush();
  return rows;
}
