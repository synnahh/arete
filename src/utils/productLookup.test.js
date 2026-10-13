import { describe, it, expect, vi } from 'vitest';

vi.mock('./platform.js', () => ({ platformFetch: vi.fn() }));
const { parsePackSize, doseFor, parseSupplement, lookupProduct } = await import('./productLookup.js');

describe('pack sizes', () => {
  it('reads counts and weights as printed on labels', () => {
    expect(parsePackSize('60 capsules')).toEqual({ qty: 60, unit: 'capsules' });
    expect(parsePackSize('120 Tablets')).toEqual({ qty: 120, unit: 'tablets' });
    expect(parsePackSize('90 softgels')).toEqual({ qty: 90, unit: 'softgels' });
    expect(parsePackSize('500g')).toEqual({ qty: 500, unit: 'g' });
    expect(parsePackSize('1.5 kg')).toEqual({ qty: 1500, unit: 'g' });
    expect(parsePackSize('2 L')).toEqual({ qty: 2000, unit: 'ml' });
    expect(parsePackSize('250 ml')).toEqual({ qty: 250, unit: 'ml' });
    expect(parsePackSize('30 serves')).toEqual({ qty: 30, unit: 'serves' });
    expect(parsePackSize('1,2 kg')).toEqual({ qty: 1200, unit: 'g' });
  });
  it('multiplies multipacks and survives noise', () => {
    expect(parsePackSize('2 x 30 capsules')).toEqual({ qty: 60, unit: 'capsules' });
    expect(parsePackSize('Value pack 100 vcaps')).toEqual({ qty: 100, unit: 'capsules' });
    expect(parsePackSize('')).toBeNull();
    expect(parsePackSize('big tub')).toBeNull();
  });
});

describe('dose per use', () => {
  it('uses the number in the pack unit, wherever it sits in the serving text', () => {
    expect(doseFor('capsules', '2 capsules (1.5 g)')).toBe(2);
    expect(doseFor('g', '1 scoop (30 g)')).toBe(30);
    expect(doseFor('g', '1 kg')).toBe(1000);
    expect(doseFor('tablets', '1 tablet')).toBe(1);
  });
  it('says nothing when the serving cannot be matched to the pack', () => {
    expect(doseFor('capsules', '1 scoop')).toBeNull();
    expect(doseFor('capsules', '')).toBeNull();
    expect(doseFor(null, '2 capsules')).toBeNull();
  });
});

describe('parseSupplement', () => {
  it('builds a supply from an Open Food Facts product', () => {
    const s = parseSupplement({ status: 1, product: { product_name: 'Creatine Monohydrate', brands: 'Optimum Nutrition, ON', quantity: '600 g', serving_size: '1 scoop (5 g)', ingredients_text: 'Creatine monohydrate' } }, '748927052357');
    expect(s).toMatchObject({ name: 'Optimum Nutrition Creatine Monohydrate', packQty: 600, unit: 'g', dosePerUse: 5, code: '748927052357' });
  });
  it('does not repeat the brand when the name already starts with it', () => {
    expect(parseSupplement({ status: 1, product: { product_name: 'Swisse Ultiboost Vitamin D', brands: 'Swisse', quantity: '60 tablets' } }, '1').name).toBe('Swisse Ultiboost Vitamin D');
  });
  it('returns null for an unknown product', () => {
    expect(parseSupplement({ status: 0 }, '1')).toBeNull();
    expect(parseSupplement({ status: 1, product: {} }, '1')).toBeNull();
  });
});

describe('lookupProduct', () => {
  const ok = (product) => ({ ok: true, json: async () => ({ status: product ? 1 : 0, product }) });

  it('falls through to the next database when the first does not know the barcode', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok(null)).mockResolvedValueOnce(ok({ product_name: 'Zinc serum', quantity: '30 ml' }));
    const r = await lookupProduct('9300000000011', { fetcher });
    expect(r.name).toBe('Zinc serum');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toContain('openbeautyfacts');
  });
  it('says so when no database knows it', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok(null));
    await expect(lookupProduct('9300000000011', { fetcher })).rejects.toMatchObject({ notFound: true });
  });
  it('says the connection failed when nothing could be reached', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(lookupProduct('9300000000011', { fetcher })).rejects.toMatchObject({ notFound: false, message: expect.stringMatching(/connection/) });
  });
  it('never sends a non-barcode', async () => {
    const fetcher = vi.fn();
    await expect(lookupProduct('hello', { fetcher })).rejects.toThrow(/digits/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
