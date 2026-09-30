import { describe, it, expect } from 'vitest';
import { parsePao, parseBeautyProduct, isBarcode } from './openBeautyFacts.js';

describe('parsePao', () => {
  it('reads the months the database uses', () => {
    expect(parsePao('12 months')).toBe(12);
    expect(parsePao('12M')).toBe(12);
    expect(parsePao('6-months-e')).toBe(6);
    expect(parsePao('en:24-months')).toBe(24);
  });
  it('rejects anything else', () => {
    for (const v of [undefined, '', 'unknown', '0 months', '99 months', 'months']) expect(parsePao(v)).toBeNull();
  });
});

describe('parseBeautyProduct', () => {
  it('builds a tidy product', () => {
    const p = parseBeautyProduct({ status: 1, product: { product_name: ' Retinol 0.3% Serum ', brands: 'Brand A, Brand B', ingredients_text: 'Aqua,\n Retinol,   Glycerin', periods_after_opening: '6-months' } });
    expect(p).toEqual({ name: 'Retinol 0.3% Serum', brand: 'Brand A', ingredients: 'Aqua, Retinol, Glycerin', paoMonths: 6 });
  });
  it('prefers English ingredients and falls back on the generic name', () => {
    expect(parseBeautyProduct({ status: 1, product: { generic_name: 'Cleanser', ingredients_text: 'eau', ingredients_text_en: 'water' } }))
      .toMatchObject({ name: 'Cleanser', ingredients: 'water', paoMonths: null });
  });
  it('is null for an unknown barcode or an empty record', () => {
    expect(parseBeautyProduct({ status: 0 })).toBeNull();
    expect(parseBeautyProduct({ status: 1, product: {} })).toBeNull();
    expect(parseBeautyProduct(null)).toBeNull();
  });
});

describe('isBarcode', () => {
  it('accepts 6-14 digits only', () => {
    expect(isBarcode('9300633123456')).toBe(true);
    expect(isBarcode(' 012345678905 ')).toBe(true);
    for (const v of ['12345', '123456789012345', 'abc', '../etc', '', undefined]) expect(isBarcode(v)).toBe(false);
  });
});
