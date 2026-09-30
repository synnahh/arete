// skinAnalysis.js — turn the model's reply to "look at this face photo" into a
// skin assessment the user can check, then save. The reply is untrusted text:
// one JSON object is pulled out, every field is checked and clamped, and the UI
// shows it for review before anything is stored. It describes what is VISIBLE in
// one photo (lighting, camera and makeup all change it); it never diagnoses.
// The scores use the same 0 (clear) to 10 (severe) scale as the monthly Skin
// Assessment in Look, so a scan can be saved straight into that history.

export const SKIN_METRICS = ['acne', 'redness', 'pigmentation', 'texture', 'dryness'];
const CONFIDENCE = new Set(['low', 'medium', 'high']);

const SHAPE = `Reply with ONLY one JSON object, no other text:
{"face":true,"scores":{"acne":0,"redness":0,"pigmentation":0,"texture":0,"dryness":0},"oiliness":"dry"|"balanced"|"oily"|"unclear","observations":["what you can see, plainly"],"suggestions":["one small routine change each"],"seeProfessional":false,"professionalReason":"","confidence":"low"|"medium"|"high","note":"one sentence on what limits this read (lighting, angle, makeup, distance)"}
Scores are 0 (clear) to 10 (severe) for what is visible in THIS photo only.`;

export const SKIN_SCAN_PROMPT = `You are a skincare coach looking at one face photo.
${SHAPE}
Rules:
- Describe only what is visible (oiliness, redness, texture, spots, dryness). Never name a medical condition or diagnose.
- Suggestions are cosmetic routine changes (cleanser, moisturiser, sunscreen, a gentle active introduced slowly). Never recommend prescription drugs or dosages.
- Set "seeProfessional" to true, with a short reason, for anything painful, bleeding, rapidly changing, spreading, scarring, or a mole or spot that looks irregular.
- Poor light, heavy makeup, a filter, or a very small face means low confidence and an honest note.
- Give at most 4 observations and 3 suggestions. Use the user's routine and skin profile if provided; do not suggest something that clashes with their current actives.
- If the photo has no face, reply {"face":false}.`;

/** First balanced {...} in the text, parsed, or null. */
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

const strings = (v, n, len) => (Array.isArray(v) ? v : []).map(x => String(x ?? '').trim().slice(0, len)).filter(Boolean).slice(0, n);

/** Overall 0-10 (higher = better), the same formula the monthly assessment uses. */
export const overallScore = (scores) => Math.round(SKIN_METRICS.reduce((s, k) => s + (10 - (Number(scores?.[k]) || 0)), 0) / SKIN_METRICS.length);

/**
 * { ok: true, analysis } or { ok: false, reason }.
 * Missing or non-numeric scores fail rather than defaulting, so a garbled reply
 * can never save a made-up assessment.
 */
export function parseSkinAnalysis(text) {
  const j = firstJsonObject(text);
  if (!j || typeof j !== 'object') return { ok: false, reason: 'Could not read the analysis. Try a clearer, well-lit photo.' };
  if (j.face === false) return { ok: false, reason: 'No face spotted in that photo.' };
  const scores = {};
  for (const k of SKIN_METRICS) {
    const n = Number(j.scores?.[k]);
    if (j.scores?.[k] == null || !Number.isFinite(n)) return { ok: false, reason: 'The analysis was incomplete. Try again.' };
    scores[k] = Math.max(0, Math.min(10, Math.round(n)));
  }
  const reason = String(j.professionalReason || '').trim().slice(0, 200);
  return {
    ok: true,
    analysis: {
      scores,
      score: overallScore(scores),
      oiliness: ['dry', 'balanced', 'oily', 'unclear'].includes(j.oiliness) ? j.oiliness : 'unclear',
      observations: strings(j.observations, 4, 160),
      suggestions: strings(j.suggestions, 3, 160),
      seeProfessional: j.seeProfessional === true,
      professionalReason: reason,
      confidence: CONFIDENCE.has(j.confidence) ? j.confidence : 'low',
      note: String(j.note || '').trim().slice(0, 200),
    },
  };
}

/** What to tell the model about the user, kept short. Nothing here is a secret. */
export function scanContext(steps = [], skinProfile = {}) {
  const parts = [];
  if (skinProfile?.type) parts.push(`Skin type: ${skinProfile.type}.`);
  if (skinProfile?.concerns?.length) parts.push(`Concerns: ${skinProfile.concerns.join(', ')}.`);
  if (skinProfile?.avoid) parts.push(`Avoids: ${String(skinProfile.avoid).slice(0, 100)}.`);
  const names = steps.map(s => String(s?.name || '').trim()).filter(Boolean).slice(0, 12);
  if (names.length) parts.push(`Current routine: ${names.join(', ')}.`);
  return parts.length ? `Analyse this face photo. ${parts.join(' ')}` : 'Analyse this face photo.';
}

/** Per-metric change from the previous assessment: negative = clearer. Null with nothing to compare. */
export function compareAssessments(prev, now) {
  if (!prev || !now) return null;
  const changes = {};
  for (const k of SKIN_METRICS) {
    const a = Number(prev[k]), b = Number(now[k]);
    if (Number.isFinite(a) && Number.isFinite(b)) changes[k] = b - a;
  }
  const keys = Object.keys(changes);
  if (!keys.length) return null;
  return { changes, better: keys.filter(k => changes[k] <= -1), worse: keys.filter(k => changes[k] >= 1) };
}

/** The lm_skin row to save: same shape as a manual assessment, marked as AI-read. */
export function assessmentRow(analysis, date) {
  return { ...analysis.scores, score: analysis.score, date, source: 'ai-photo', confidence: analysis.confidence };
}
