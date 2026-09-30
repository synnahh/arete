// mealScan.js — turn the model's reply to "estimate this meal photo" into a
// log entry. The reply is treated as untrusted text: we pull one JSON object
// out of it, check every field, clamp the numbers, and the UI shows the result
// for the user to edit before anything is logged. It is an estimate, never a
// measurement, and the card says so.
import { quickEntry } from './foods.js';

export const MEAL_SCAN_PROMPT = `You estimate the nutrition of a meal from one photo.
Reply with ONLY one JSON object, no other text:
{"food":true,"name":"short meal name","items":["each visible food with a rough amount"],"calories":0,"protein":0,"carbs":0,"fat":0,"confidence":"low"|"medium"|"high","note":"one sentence on what you were unsure about"}
Estimate the whole plate. Grams for protein, carbs and fat; kcal for calories.
If portions are unclear, assume a typical serving and use confidence "low".
If the photo has no food in it, reply {"food":false}.`;

const CONFIDENCE = new Set(['low', 'medium', 'high']);

/** The first balanced {...} in the text, parsed, or null. */
function firstJsonObject(text) {
  const s = String(text || '');
  for (let start = s.indexOf('{'); start !== -1; start = s.indexOf('{', start + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        try { return JSON.parse(s.slice(start, i + 1)); } catch { break; }
      }
    }
  }
  return null;
}

/**
 * { ok: true, estimate: { name, items, calories, protein, carbs, fat, confidence, note } }
 * or { ok: false, reason } (no food, unreadable, or numbers that make no sense).
 */
export function parseMealEstimate(text) {
  const j = firstJsonObject(text);
  if (!j || typeof j !== 'object') return { ok: false, reason: 'Could not read the estimate. Try a clearer photo.' };
  if (j.food === false) return { ok: false, reason: 'No food spotted in that photo.' };
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
  const calories = Math.round(num(j.calories));
  if (!(calories >= 1 && calories <= 5000)) return { ok: false, reason: 'The estimate did not make sense. Try again or log it by hand.' };
  const grams = (v) => { const n = num(v); return Number.isFinite(n) && n >= 0 && n <= 500 ? Math.round(n * 10) / 10 : 0; };
  return {
    ok: true,
    estimate: {
      name: String(j.name || 'Meal from photo').trim().slice(0, 60) || 'Meal from photo',
      items: (Array.isArray(j.items) ? j.items : []).map(x => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 8),
      calories, protein: grams(j.protein), carbs: grams(j.carbs), fat: grams(j.fat),
      confidence: CONFIDENCE.has(j.confidence) ? j.confidence : 'low',
      note: String(j.note || '').trim().slice(0, 200),
    },
  };
}

/** A nutrition-log entry from a (possibly edited) estimate, marked as an estimate. */
export function entryFromEstimate(e, now = new Date()) {
  const base = quickEntry({ name: e.name, calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat }, now);
  if (!base) return null;
  return { ...base, quick: undefined, estimated: true, source: 'photo' };
}
