// mealPlanImport.js — bring a meal plan made elsewhere (Claude, ChatGPT, a dietitian, your own
// notes) into the app without any AI link. Pure.
//
//   buildPlanPrompt()  the text you give Claude/ChatGPT so its answer comes back in a shape
//                      this file can read exactly.
//   parseMealPlan()    reads what you paste back: the JSON from that prompt, or plain text
//                      such as "Monday / Breakfast: Oats 450 kcal 30P 50C 10F".
//   emptyPlan / planFromDays / dayTotals / planIngredients  small helpers for hand-built plans.
//
// A plan is [{ day, meals: [{ name, type, description, calories, protein, carbs, fat, ingredients }], totals }].
// Totals are always recomputed from the meals, never trusted from the pasted text.

import { cleanIngredients } from './foods.js';

export const PLAN_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
const round1 = (n) => Math.round(n * 10) / 10;

const DAY_RE = /^(mon|tue|wed|thu|fri|sat|sun)/i;

/** "mon", "Tues", "wednesday" -> "Wednesday"; "Day 3" -> "Day 3"; anything else -> '' */
export function normaliseDay(raw) {
  const s = String(raw || '').trim();
  const m = DAY_RE.exec(s);
  if (m) return PLAN_DAYS.find(d => d.toLowerCase().startsWith(m[1].toLowerCase()));
  const n = /^day\s*(\d{1,2})\b/i.exec(s);
  return n ? `Day ${+n[1]}` : '';
}

/** Any label to one of breakfast/lunch/dinner/snack (unknown labels fall to snack). */
export function normaliseType(raw) {
  const s = String(raw || '').toLowerCase();
  if (/break|morning|brekkie|brekky/.test(s)) return 'breakfast';
  if (/lunch|midday/.test(s)) return 'lunch';
  if (/dinner|supper|evening|tea\b/.test(s)) return 'dinner';
  return 'snack';
}

export function cleanMeal(m, fallbackType = 'snack') {
  const calories = Math.round(num(m?.calories ?? m?.kcal ?? m?.cal));
  const name = String(m?.name || m?.meal || m?.title || '').trim().slice(0, 80);
  if (!name) return null;
  const ingredients = cleanIngredients(m?.ingredients);
  const cost = m?.estimatedCost ?? m?.cost;
  return {
    name,
    type: m?.type || m?.slot ? normaliseType(m.type || m.slot) : fallbackType,
    description: String(m?.description || m?.notes || m?.instructions || '').trim().slice(0, 600),
    calories: Math.max(0, calories),
    protein: Math.max(0, round1(num(m?.protein))),
    carbs: Math.max(0, round1(num(m?.carbs ?? m?.carbohydrates))),
    fat: Math.max(0, round1(num(m?.fat))),
    ...(cost != null && num(cost) > 0 ? { estimatedCost: round1(num(cost)) } : {}),
    ...(ingredients.length ? { ingredients } : {}),
  };
}

export function dayTotals(meals) {
  const sum = (k) => round1((meals || []).reduce((s, m) => s + (Number(m[k]) || 0), 0));
  const cost = sum('estimatedCost');
  return { calories: Math.round(sum('calories')), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat'), ...(cost > 0 ? { cost } : {}) };
}

/** One day object with totals filled in. */
export function makeDay(day, meals = []) {
  const clean = meals.map(m => cleanMeal(m)).filter(Boolean);
  return { day, meals: clean, totals: dayTotals(clean) };
}

/** Seven empty days, Monday to Sunday. */
export function emptyPlan() {
  return PLAN_DAYS.map(d => makeDay(d));
}

/** Replace the totals of every day with ones worked out from its meals. */
export function withTotals(plan) {
  return (plan || []).map(d => makeDay(d.day, d.meals));
}

/** Every ingredient in the plan added up by name+unit (the shopping list). */
export function planIngredients(plan) {
  const map = new Map();
  for (const d of plan || []) for (const m of d.meals || []) for (const i of cleanIngredients(m.ingredients)) {
    const k = `${i.name.toLowerCase()}|${i.unit.toLowerCase()}`;
    const cur = map.get(k);
    if (cur) cur.qty = round1(cur.qty + i.qty); else map.set(k, { ...i });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ── The prompt you give an AI ────────────────────────────────────────────────

export function buildPlanPrompt({ calories = 2300, protein = 150, carbs = 250, fat = 70, mealsPerDay = 4, days = 7, notes = '', currency = 'AUD' } = {}) {
  return `Create a ${days}-day meal plan for me.

My daily targets: ${calories} kcal, ${protein} g protein, ${carbs} g carbs, ${fat} g fat.
Meals per day: ${mealsPerDay}.
Dietary notes: ${notes.trim() || 'none'}.

Reply with ONLY one JSON object, no explanation and no markdown fences, in exactly this shape:
{
  "plan": [
    {
      "day": "Monday",
      "meals": [
        {
          "name": "Beef and rice bowl",
          "type": "dinner",
          "description": "One or two sentences on how to make it.",
          "calories": 650,
          "protein": 45,
          "carbs": 70,
          "fat": 18,
          "estimatedCost": 6.5,
          "ingredients": [{ "name": "Lean beef mince", "qty": 200, "unit": "g" }, { "name": "Eggs", "qty": 2, "unit": "" }]
        }
      ]
    }
  ]
}

Rules:
- "type" is one of breakfast, lunch, dinner, snack.
- Each day lands within 5% of my calories and protein.
- Use real, specific meal names. Keep meals simple enough to repeat; repeating a meal on several days is fine.
- Give every ingredient a qty and a unit ("g" or "ml", or "" for whole items). Use the same plain ingredient name every time so the week adds up into one shopping list.
- estimatedCost is in ${currency}.`;
}

// ── Reading what you paste back ──────────────────────────────────────────────

function stripFences(text) {
  return String(text || '').replace(/```[a-z]*\s*/gi, '').replace(/```/g, '').trim();
}

export function firstJson(text) {
  const t = stripFences(text);
  const start = t.search(/[\[{]/);
  if (start < 0) return null;
  const open = t[start], close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) { try { return JSON.parse(t.slice(start, i + 1)); } catch { return null; } }
  }
  return null;
}

function fromJson(json) {
  let days = null;
  if (Array.isArray(json)) days = json;
  else if (Array.isArray(json?.plan)) days = json.plan;
  else if (Array.isArray(json?.days)) days = json.days;
  else if (Array.isArray(json?.meals)) days = [json];
  else if (json && typeof json === 'object') {
    // { Monday: [meals], Tuesday: {meals: []} }
    const keys = Object.keys(json).filter(k => normaliseDay(k));
    if (keys.length) days = keys.map(k => ({ day: k, meals: Array.isArray(json[k]) ? json[k] : json[k]?.meals }));
  }
  if (!days) return null;
  // A bare array of meals (no day wrapper) is one day.
  if (days.length && days.every(d => d && !Array.isArray(d.meals) && (d.name || d.calories != null))) days = [{ day: 'Monday', meals: days }];
  return days.map((d, i) => makeDay(normaliseDay(d?.day || d?.name) || String(d?.day || '').trim() || PLAN_DAYS[i] || `Day ${i + 1}`, Array.isArray(d?.meals) ? d.meals : []));
}

const KCAL = /(\d[\d,.]*)\s*(?:kcal|cals?|calories)\b/i;
const MACRO = {
  protein: [/(\d[\d.]*)\s*g?\s*(?:of\s+)?protein/i, /protein\s*[:=]?\s*(\d[\d.]*)/i, /\b(\d[\d.]*)\s*g?\s*p\b/i, /\bp\s*[:=]?\s*(\d[\d.]*)/i],
  carbs: [/(\d[\d.]*)\s*g?\s*(?:of\s+)?carbs?(?:ohydrates?)?/i, /carbs?(?:ohydrates?)?\s*[:=]?\s*(\d[\d.]*)/i, /\b(\d[\d.]*)\s*g?\s*c\b/i, /\bc\s*[:=]?\s*(\d[\d.]*)/i],
  fat: [/(\d[\d.]*)\s*g?\s*(?:of\s+)?fats?\b/i, /fats?\s*[:=]?\s*(\d[\d.]*)/i, /\b(\d[\d.]*)\s*g?\s*f\b/i, /\bf\s*[:=]?\s*(\d[\d.]*)/i],
};
const pick = (line, res) => { for (const re of res) { const m = re.exec(line); if (m) return num(m[1]); } return 0; };

function parseMealLine(line, lastType) {
  const cal = KCAL.exec(line);
  if (!cal) return null;
  let rest = line.replace(/^[\s>*\-•·\d.)]+/, '').replace(/[*_`#]/g, '').trim();
  let type = lastType;
  const label = /^(breakfast|brunch|lunch|dinner|supper|snacks?|pre-?workout|post-?workout|morning tea|afternoon tea|meal\s*\d+)\s*[:\-–—]?\s*/i.exec(rest);
  if (label) { type = /meal/i.test(label[1]) ? lastType : normaliseType(label[1]); rest = rest.slice(label[0].length); }
  const cut = rest.search(/\s[\-–—:(|]\s|\s*[(|]|,\s*\d|\d/);
  const name = (cut > 0 ? rest.slice(0, cut) : rest).replace(/[\s\-–—:,]+$/, '').trim();
  if (!name) return null;
  return {
    name, type: type || 'snack', calories: num(cal[1]),
    protein: pick(line, MACRO.protein), carbs: pick(line, MACRO.carbs), fat: pick(line, MACRO.fat),
  };
}

function fromText(text) {
  const lines = stripFences(text).split(/\r?\n/);
  const days = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.replace(/^[\s#>*_\-•]+|[*_:\s]+$/g, '');
    const asDay = normaliseDay(heading);
    if (asDay && heading.length <= 40 && !KCAL.test(line)) { cur = { day: asDay, meals: [] }; days.push(cur); continue; }
    const meal = parseMealLine(line, cur?.meals.at(-1)?.type);
    if (meal) {
      if (!cur) { cur = { day: PLAN_DAYS[0], meals: [] }; days.push(cur); }
      cur.meals.push(meal);
    } else if (cur?.meals.length && /^[\s>*\-•]/.test(raw) && !/kcal|cal/i.test(line)) {
      // an indented note under a meal becomes its description
      const last = cur.meals.at(-1);
      last.description = `${last.description ? `${last.description} ` : ''}${line.replace(/^[\s>*\-•]+/, '')}`.slice(0, 600);
    }
  }
  return days.length ? days.map(d => makeDay(d.day, d.meals)) : null;
}

/**
 * Read a pasted plan. Returns { ok: true, plan, meals, warnings } or { ok: false, reason }.
 * `warnings` lists things worth a look (meals with no calories, days with no meals).
 */
export function parseMealPlan(text) {
  const raw = String(text || '').trim();
  if (!raw) return { ok: false, reason: 'Paste a plan first.' };
  if (raw.length > 200000) return { ok: false, reason: 'That is too long to be a meal plan.' };
  let plan = null;
  const json = firstJson(raw);
  if (json) plan = fromJson(json);
  if (!plan) plan = fromText(raw);
  plan = (plan || []).filter(d => d.meals.length);
  if (!plan.length) return { ok: false, reason: 'No meals found. Each meal needs a name and calories, for example "Breakfast: Oats and whey, 450 kcal, 35P 55C 9F", under a day heading such as "Monday".' };
  const warnings = [];
  const meals = plan.reduce((n, d) => n + d.meals.length, 0);
  for (const d of plan) for (const m of d.meals) if (!m.calories) warnings.push(`${d.day}: "${m.name}" has no calories, so it won't count towards the day's total.`);
  if (plan.length > 14) warnings.push(`${plan.length} days found, which is a lot. Check the headings were read correctly.`);
  return { ok: true, plan, meals, warnings };
}

// ── Typing ingredients by hand ───────────────────────────────────────────────

const UNIT_WORDS = { g: 'g', gram: 'g', grams: 'g', kg: 'kg', ml: 'ml', l: 'l', tbsp: 'tbsp', tsp: 'tsp', cup: 'cup', cups: 'cup', scoop: 'scoop', scoops: 'scoop', slice: 'slice', slices: 'slice' };

/** "200 g chicken breast" / "2 eggs" / "chicken 200g" per line -> [{ name, qty, unit }] (lines it can't read are skipped). */
export function parseIngredientLines(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n|;/)) {
    const line = raw.replace(/^[\s\-•*]+/, '').trim();
    if (!line) continue;
    let m = /^(\d+(?:[.,]\d+)?)\s*([a-z]+)?\s+(?:of\s+)?(.+)$/i.exec(line);
    if (m) {
      const unit = UNIT_WORDS[m[2]?.toLowerCase()];
      out.push(unit ? { name: m[3].trim(), qty: num(m[1].replace(',', '.')), unit } : { name: `${m[2] ? `${m[2]} ` : ''}${m[3]}`.trim(), qty: num(m[1]), unit: '' });
      continue;
    }
    m = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([a-z]+)?$/i.exec(line);
    if (m) out.push({ name: m[1].trim(), qty: num(m[2].replace(',', '.')), unit: UNIT_WORDS[m[3]?.toLowerCase()] || '' });
  }
  return cleanIngredients(out);
}

export function ingredientsToText(list) {
  return cleanIngredients(list).map(i => (i.unit ? `${i.qty} ${i.unit} ${i.name}` : `${i.qty} ${i.name}`)).join('\n');
}

/** Add `incoming` days' meals onto `plan` (same day name = appended), keeping day order. */
export function mergePlans(plan, incoming) {
  const byDay = new Map((plan || []).map(d => [d.day, d.meals || []]));
  for (const d of incoming || []) byDay.set(d.day, [...(byDay.get(d.day) || []), ...d.meals]);
  const known = PLAN_DAYS.filter(n => byDay.has(n));
  const rest = [...byDay.keys()].filter(n => !PLAN_DAYS.includes(n));
  return [...known, ...rest].map(n => makeDay(n, byDay.get(n)));
}
