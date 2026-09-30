import { describe, it, expect } from 'vitest';
import { scoreProduct, scoreBand } from './skinScore.js';
import { newStep } from './skin.js';

const CERAVE = 'Aqua, Glycerin, Cetearyl Alcohol, Ceramide NP, Ceramide AP, Hyaluronic Acid, Cholesterol, Phenoxyethanol';
const ACNE_GEL = 'Aqua, Salicylic Acid, Niacinamide, Glycerin, Zinc PCA, Panthenol, Parfum';

describe('scoreProduct', () => {
  it('will not score without a profile or without ingredients', () => {
    expect(scoreProduct({ name: 'X', ingredients: CERAVE }, {}).score).toBeNull();
    expect(scoreProduct({ name: 'X', ingredients: '' }, { type: 'dry' }).score).toBeNull();
    expect(scoreProduct({ name: 'X', ingredients: '' }, { type: 'dry' }).reasons[0].text).toMatch(/ingredient list/);
  });

  it('rewards a moisturiser for dry skin with dryness, and says why', () => {
    const r = scoreProduct({ name: 'CeraVe', ingredients: CERAVE }, { type: 'dry', concerns: ['dryness'] });
    expect(r.band).toBe('great');
    expect(r.reasons.find(x => x.kind === 'good' && /dryness/.test(x.text)).text).toMatch(/hyaluronic acid.*glycerin.*ceramides/);
  });

  it('scores an acne product well for oily acne-prone skin, but marks the fragrance down for sensitive skin', () => {
    const oily = scoreProduct({ name: 'Gel', ingredients: ACNE_GEL }, { type: 'oily', concerns: ['acne'] });
    const sensitive = scoreProduct({ name: 'Gel', ingredients: ACNE_GEL }, { type: 'sensitive', concerns: ['acne'] });
    expect(oily.score).toBeGreaterThan(sensitive.score);
    expect(sensitive.reasons.some(r => r.kind === 'bad' && /fragrance/i.test(r.text))).toBe(true);
    expect(oily.reasons.some(r => /fragrance/i.test(r.text))).toBe(false);
  });

  it('penalises pore-cloggers for oily or acne-prone skin only', () => {
    const oil = 'Cocos Nucifera Oil, Isopropyl Myristate, Aqua, Glycerin, Tocopherol';
    expect(scoreProduct({ name: 'Oil', ingredients: oil }, { type: 'oily' }).reasons.some(r => r.kind === 'bad' && /clog/.test(r.text))).toBe(true);
    expect(scoreProduct({ name: 'Oil', ingredients: oil }, { type: 'dry' }).reasons.some(r => /clog/.test(r.text))).toBe(false);
  });

  it('treats the avoid list as absolute', () => {
    const base = scoreProduct({ name: 'G', ingredients: CERAVE }, { type: 'dry', concerns: ['dryness'] }).score;
    const r = scoreProduct({ name: 'G', ingredients: CERAVE }, { type: 'dry', concerns: ['dryness'], avoid: 'phenoxyethanol, ab' });
    expect(r.score).toBe(base - 25);
    expect(r.reasons.some(x => /phenoxyethanol/.test(x.text))).toBe(true);
    // two-letter entries are ignored rather than matching half the alphabet
    expect(r.reasons.filter(x => /"ab"/.test(x.text))).toHaveLength(0);
  });

  it('marks a product down when it clashes with the current routine', () => {
    const steps = [newStep('Retinol serum', 'pm')];
    const acid = 'Aqua, Glycolic Acid, Glycerin, Sodium Hydroxide, Panthenol';
    const clean = scoreProduct({ name: 'Toner', ingredients: acid }, { type: 'normal', concerns: ['pigmentation'] }, []);
    const clash = scoreProduct({ name: 'Toner', ingredients: acid }, { type: 'normal', concerns: ['pigmentation'] }, steps);
    expect(clash.score).toBeLessThan(clean.score);
    expect(clash.reasons.some(r => /clash/.test(r.text))).toBe(true);
  });

  it('stays within 0-100 and bands sensibly', () => {
    const worst = scoreProduct({ name: 'W', ingredients: 'Parfum, Alcohol Denat, Limonene, Retinol, Glycolic Acid, Benzoyl Peroxide' }, { type: 'sensitive', avoid: 'parfum, alcohol denat, limonene' });
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.band).toBe('poor');
    expect([scoreBand(80), scoreBand(60), scoreBand(40), scoreBand(10), scoreBand(null)]).toEqual(['great', 'decent', 'mixed', 'poor', 'unknown']);
  });

  it('warns when the ingredient list looks incomplete', () => {
    expect(scoreProduct({ name: 'X', ingredients: 'Aqua, Glycerin' }, { type: 'dry' }).reasons.some(r => /very short/.test(r.text))).toBe(true);
  });
});

describe('avoid-list aliases', () => {
  it('matches fragrance to parfum and coconut to Cocos Nucifera', () => {
    const list = 'Aqua, Glycerin, Parfum, Cocos Nucifera Oil, Niacinamide';
    const base = scoreProduct({ name: 'X', ingredients: list }, { type: 'normal', concerns: ['dryness'] }).score;
    const r = scoreProduct({ name: 'X', ingredients: list }, { type: 'normal', concerns: ['dryness'], avoid: 'fragrance, coconut' });
    expect(r.score).toBe(base - 50);
    expect(scoreProduct({ name: 'X', ingredients: 'Aqua, Glycerin, Niacinamide, Panthenol' }, { type: 'normal', concerns: ['dryness'], avoid: 'fragrance' }).reasons.some(x => /avoid list/.test(x.text))).toBe(false);
  });
});

describe('one ingredient, paid once', () => {
  it('does not credit niacinamide separately for every concern', () => {
    const list = 'Aqua, Niacinamide, Glycerin, Phenoxyethanol';
    const one = scoreProduct({ name: 'N', ingredients: list }, { type: 'normal', concerns: ['acne'] });
    const three = scoreProduct({ name: 'N', ingredients: list }, { type: 'normal', concerns: ['acne', 'pigmentation', 'redness'] });
    expect(three.score).toBe(one.score);
    expect(three.reasons.filter(r => r.kind === 'good')).toHaveLength(1);
    expect(three.reasons.some(r => /already counted/.test(r.text))).toBe(true);
  });
});
