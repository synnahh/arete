import { describe, it, expect } from 'vitest';
import { parseSkinAnalysis, scanContext, compareAssessments, assessmentRow, overallScore, SKIN_SCAN_PROMPT } from './skinAnalysis.js';

const GOOD = { face: true, scores: { acne: 4, redness: 3, pigmentation: 2, texture: 5, dryness: 1 }, oiliness: 'oily', observations: ['Some shine on the forehead', 'A few small spots on the chin'], suggestions: ['Add a gentle BHA twice a week'], seeProfessional: false, confidence: 'medium', note: 'Warm indoor light.' };

describe('parseSkinAnalysis', () => {
  it('reads a good reply, even wrapped in prose', () => {
    const r = parseSkinAnalysis(`Here you go:\n${JSON.stringify(GOOD)}\nHope that helps`);
    expect(r.ok).toBe(true);
    expect(r.analysis.scores.acne).toBe(4);
    expect(r.analysis.score).toBe(overallScore(GOOD.scores));
    expect(r.analysis.oiliness).toBe('oily');
    expect(r.analysis.confidence).toBe('medium');
  });

  it('rejects no-face, unreadable and incomplete replies instead of inventing scores', () => {
    expect(parseSkinAnalysis('{"face":false}')).toMatchObject({ ok: false, reason: /No face/ });
    expect(parseSkinAnalysis('sorry, cannot help')).toMatchObject({ ok: false });
    const partial = { ...GOOD, scores: { acne: 4 } };
    expect(parseSkinAnalysis(JSON.stringify(partial))).toMatchObject({ ok: false, reason: /incomplete/ });
    expect(parseSkinAnalysis(JSON.stringify({ ...GOOD, scores: { ...GOOD.scores, acne: 'lots' } })).ok).toBe(false);
    expect(parseSkinAnalysis(JSON.stringify({ ...GOOD, scores: { ...GOOD.scores, acne: null } })).ok).toBe(false);
  });

  it('clamps scores and limits the text lengths and counts', () => {
    const r = parseSkinAnalysis(JSON.stringify({ ...GOOD, scores: { acne: 99, redness: -4, pigmentation: 2.6, texture: 5, dryness: 1 }, observations: Array(9).fill('x'.repeat(500)), suggestions: Array(9).fill('y'), confidence: 'certain', oiliness: 'shiny' }));
    expect(r.analysis.scores).toMatchObject({ acne: 10, redness: 0, pigmentation: 3 });
    expect(r.analysis.observations).toHaveLength(4);
    expect(r.analysis.observations[0]).toHaveLength(160);
    expect(r.analysis.suggestions).toHaveLength(3);
    expect(r.analysis.confidence).toBe('low');
    expect(r.analysis.oiliness).toBe('unclear');
  });

  it('only flags a professional when the model says true', () => {
    expect(parseSkinAnalysis(JSON.stringify({ ...GOOD, seeProfessional: 'yes' })).analysis.seeProfessional).toBe(false);
    const r = parseSkinAnalysis(JSON.stringify({ ...GOOD, seeProfessional: true, professionalReason: 'One spot looks irregular.' }));
    expect(r.analysis.seeProfessional).toBe(true);
    expect(r.analysis.professionalReason).toBe('One spot looks irregular.');
  });
});

describe('prompt', () => {
  it('forbids diagnosis and prescriptions and asks for a referral on red flags', () => {
    expect(SKIN_SCAN_PROMPT).toMatch(/Never name a medical condition/);
    expect(SKIN_SCAN_PROMPT).toMatch(/prescription/);
    expect(SKIN_SCAN_PROMPT).toMatch(/seeProfessional/);
  });
});

describe('scanContext', () => {
  it('summarises the profile and routine, and stays plain without them', () => {
    expect(scanContext([], {})).toBe('Analyse this face photo.');
    const c = scanContext([{ name: 'Cleanser' }, { name: 'Retinol serum' }], { type: 'oily', concerns: ['acne'], avoid: 'fragrance' });
    expect(c).toMatch(/Skin type: oily/);
    expect(c).toMatch(/Concerns: acne/);
    expect(c).toMatch(/Current routine: Cleanser, Retinol serum/);
  });
});

describe('compareAssessments and assessmentRow', () => {
  it('reports what got better or worse by at least a point', () => {
    const c = compareAssessments({ acne: 6, redness: 3, pigmentation: 2, texture: 5, dryness: 4 }, { acne: 4, redness: 3, pigmentation: 3, texture: 5, dryness: 6 });
    expect(c.better).toEqual(['acne']);
    expect(c.worse).toEqual(['pigmentation', 'dryness']);
    expect(c.changes.acne).toBe(-2);
    expect(compareAssessments(null, {})).toBeNull();
    expect(compareAssessments({}, {})).toBeNull();
  });

  it('saves in the same shape as a manual assessment, marked as AI-read', () => {
    const a = parseSkinAnalysis(JSON.stringify(GOOD)).analysis;
    const row = assessmentRow(a, '2026-09-30');
    expect(row).toMatchObject({ acne: 4, redness: 3, pigmentation: 2, texture: 5, dryness: 1, date: '2026-09-30', source: 'ai-photo', score: a.score });
  });
});
