import { describe, it, expect } from 'vitest';
import { boardSummary, filterBoard, buildResults, getCurrSymbol, pollinationsUrl } from './style.js';

const items = [
  { id: 1, title: 'Boots', status: 'wishlist', price: 220 },
  { id: 2, title: 'Watch', status: 'wishlist', price: '150.50' },
  { id: 3, title: 'Jacket', status: 'purchased', price: 300 },
  { id: 4, title: 'Hat', status: 'pass', price: 40 },
  { id: 5, title: 'Belt', price: null },               // no status → wishlist
  { id: 6, title: 'Odd', status: 'archived', price: 'abc' }, // unknown status → wishlist, bad price ignored
];

describe('boardSummary', () => {
  it('counts by status and totals wishlist and purchases separately', () => {
    expect(boardSummary(items)).toEqual({ counts: { wishlist: 4, purchased: 1, pass: 1 }, wishlistTotal: 370.5, purchasedTotal: 300 });
  });
  it('handles an empty board', () => {
    expect(boardSummary([])).toEqual({ counts: { wishlist: 0, purchased: 0, pass: 0 }, wishlistTotal: 0, purchasedTotal: 0 });
  });
});

describe('filterBoard', () => {
  it('filters by status, newest (last added) first', () => {
    expect(filterBoard(items, 'wishlist').map(i => i.id)).toEqual([6, 5, 2, 1]);
    expect(filterBoard(items, 'pass').map(i => i.id)).toEqual([4]);
    expect(filterBoard(items, 'all')).toHaveLength(6);
  });
});

describe('buildResults / helpers', () => {
  it('builds nine ideas with encoded prompts', () => {
    const r = buildResults('Date Night', 'linen', () => 0.5);
    expect(r).toHaveLength(9);
    expect(r[0].title).toBe('Minimalist Date Night linen');
    expect(r[0].imageUrl).toBe(pollinationsUrl(r[0].prompt, r[0].seed));
    expect(new Set(r.map(x => x.id)).size).toBe(9);
  });
  it('falls back to a generic subject', () => {
    expect(buildResults('', '', () => 0)[0].title).toBe('Minimalist fashion outfit');
  });
  it('maps currencies to symbols', () => {
    expect(getCurrSymbol('AUD')).toBe('A$');
    expect(getCurrSymbol('GBP')).toBe('£');
    expect(getCurrSymbol('XYZ')).toBe('$');
  });
});
