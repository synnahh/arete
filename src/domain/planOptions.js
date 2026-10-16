// planOptions.js — "Plan options": a plan, coaching brief or set of targets from somewhere else (Claude,
// ChatGPT, a coach) kept ALONGSIDE your real plan as an option. Saving an option changes nothing you
// already have; its text is a read-only reference, and any targets found in it can be previewed against
// what you use now and applied later, on purpose, with Undo. Pure.
//
// Options live in one document (`plan_options`): { items: [{ id, name, savedOn, text, targets }] }.

const MAX_ITEMS = 12;
export const MAX_TEXT = 60000;

const num = (s) => { const n = Number(String(s).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

// label -> regex capturing the number that follows it on the same line
const FIND = {
  kcal:    /(?:^|\n)[^\n\w]*(?:daily\s+)?(?:calories|energy)\b[^\n\d]{0,40}?(\d[\d,]{2,5})\s*(?:kcal|cal)/i,
  protein: /(?:^|\n)[^\n\w]*protein\b[^\n\d]{0,40}?(\d{2,3})\s*g\b/i,
  carbs:   /(?:^|\n)[^\n\w]*carbohydrates?\b[^\n\d]{0,40}?(\d{2,3})\s*g\b/i,
  fat:     /(?:^|\n)[^\n\w]*(?:dietary\s+)?fat\b[^\n\d]{0,40}?(\d{2,3})\s*g\b/i,
  fibre:   /(?:^|\n)[^\n\w]*fib(?:re|er)\b[^\n\d]{0,40}?(?:at least\s*)?(\d{2,3})\s*g\b/i,
  steps:   /(?:step goal|steps?)[^\n\d]{0,60}?(\d[\d,]{3,6})\s*(?:\/day|a day|per day|steps)/i,
};

/**
 * Daily targets stated in a text: { kcal, protein, carbs, fat, fibre?, steps?, notes: [] } or null when
 * calories and protein are not both found. `notes` lists anything that looks off (macros that do not add
 * up to the calories within 8%, calories outside 1,200 to 5,000).
 */
export function extractTargets(text) {
  const t = `\n${String(text || '')}`;
  const found = {};
  for (const [k, re] of Object.entries(FIND)) {
    const m = re.exec(t);
    const v = m ? num(m[1]) : null;
    if (v != null) found[k] = Math.round(v);
  }
  if (!found.kcal || !found.protein) return null;
  const notes = [];
  if (found.kcal < 1200 || found.kcal > 5000) return null;
  const { kcal, protein, carbs, fat } = found;
  if (carbs == null || fat == null) notes.push('Carbohydrate or fat was not stated, so they are not part of this option.');
  else {
    const sum = protein * 4 + carbs * 4 + fat * 9;
    if (Math.abs(sum - kcal) / kcal > 0.08) notes.push(`The macros add up to about ${Math.round(sum)} kcal, not ${kcal}. Check before applying.`);
  }
  return { ...found, notes };
}

/** What changes if `option` targets were applied over the current ones: [{ key, label, now, next, delta }]. */
export function compareTargets(current = {}, option = {}) {
  const rows = [['kcal', 'Calories', 'kcal'], ['protein', 'Protein', 'g'], ['carbs', 'Carbs', 'g'], ['fat', 'Fat', 'g']];
  return rows.filter(([k]) => option[k] != null).map(([k, label, unit]) => ({
    key: k, label, unit, now: current[k] ?? null, next: option[k], delta: current[k] != null ? option[k] - current[k] : null,
  }));
}

/** Can these targets replace the goal's (needs all four numbers)? */
export const appliable = (t) => !!t && [t.kcal, t.protein, t.carbs, t.fat].every((n) => Number.isFinite(n) && n > 0);

/** A clean option row from a name and text. Returns null for an empty text. */
export function makeOption({ name, text, savedOn, id }) {
  const body = String(text || '').trim().slice(0, MAX_TEXT);
  if (!body) return null;
  const firstLine = body.split(/\r?\n/).find((l) => l.trim()) || 'Plan option';
  const targets = extractTargets(body);
  return {
    id: id || `opt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    name: String(name || '').trim().slice(0, 60) || firstLine.replace(/^[#*\s-]+/, '').slice(0, 60),
    savedOn: savedOn || null,
    text: body,
    targets: targets ? { kcal: targets.kcal, protein: targets.protein, carbs: targets.carbs ?? null, fat: targets.fat ?? null, fibre: targets.fibre ?? null, steps: targets.steps ?? null, notes: targets.notes } : null,
  };
}

/** The list with `option` added (newest first, capped). Never modifies existing entries. */
export const addOption = (items = [], option) => (option ? [option, ...(Array.isArray(items) ? items : [])].slice(0, MAX_ITEMS) : items);
export const removeOption = (items = [], id) => (Array.isArray(items) ? items : []).filter((o) => o.id !== id);
