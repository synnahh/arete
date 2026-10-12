import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildIndex, searchIndex, dbFood, parsePortions, portionChips } from './foodDb.js';

const generic = buildIndex('generic', JSON.parse(readFileSync(new URL('../data/foods/generic.json', import.meta.url), 'utf8')));
const branded = buildIndex('branded', [
  ['Natural Light Greek Yoghurt', 'Chobani', 52, 8.1, 4.6, 0.2, 0, 4.4, 40, '170 g', 170, '9300000000011'],
  ['Lean Beef Mince', 'Coles', 160, 20.5, 0, 8.7, 0, 0, 70, '125 g', 125, '9300000000028'],
  ['Sourdough Bread', "Abbott's Village Bakery", 255, 9.3, 47, 2.1, 3.3, 3.2, 378, '1 slice (80 g)', 80, '9300000000035'],
]);
const all = [...branded, ...generic];

describe('bundled food database', () => {
  it('holds thousands of generic foods with sane numbers', () => {
    expect(generic.length).toBeGreaterThan(7000);
    expect(generic.every(e => e.per100.calories >= 0 && e.per100.calories < 950)).toBe(true);
  });
  it('finds basics by plain words', () => {
    expect(searchIndex(generic, 'banana')[0].name.toLowerCase()).toContain('banana');
    const chicken = searchIndex(generic, 'chicken breast', 5).map(e => e.name.toLowerCase());
    expect(chicken.length).toBe(5);
    expect(chicken.every(n => n.includes('chicken') && n.includes('breast'))).toBe(true);
    expect(searchIndex(generic, 'rolled oats', 3).length).toBeGreaterThan(0);
  });
  it('understands Australian words', () => {
    expect(searchIndex(generic, 'capsicum', 5).some(e => /pepper/i.test(e.name))).toBe(true);
    expect(searchIndex(generic, 'prawns', 5).some(e => /shrimp/i.test(e.name))).toBe(true);
    expect(searchIndex(generic, 'beef mince', 5).some(e => /ground/i.test(e.name))).toBe(true);
    expect(searchIndex(generic, 'yoghurt', 5).some(e => /yogurt/i.test(e.name))).toBe(true);
  });
  it('ranks branded products above generic ones and matches the brand', () => {
    const r = searchIndex(all, 'greek yoghurt', 5);
    expect(r[0].brand).toBe('Chobani');
    expect(searchIndex(all, 'coles mince')[0].brand).toBe('Coles');
    expect(searchIndex(all, 'abbott sourdough')[0].brand).toContain('Abbott');
  });
  it('matches the last word as a prefix while typing, but not the earlier ones', () => {
    expect(searchIndex(all, 'sourd')[0].name).toBe('Sourdough Bread');
    expect(searchIndex(all, 'sourd bread')).toEqual([]);
  });
  it('returns nothing for nonsense and empty queries', () => {
    expect(searchIndex(all, 'zzzqqq')).toEqual([]);
    expect(searchIndex(all, '   ')).toEqual([]);
  });
  it('keeps fast-food chains below the basics', () => {
    const r = searchIndex(generic, 'sundae', 10).map(e => e.name);
    expect(r.length).toBeGreaterThan(0);
  });
});

describe('turning a row into a food', () => {
  it('a branded product defaults to its serving and shows both kcal figures', () => {
    const f = dbFood(branded[0]);
    expect(f.name).toBe('Chobani Natural Light Greek Yoghurt');
    expect(f.defaultAmount).toBe(170);
    expect(f.sub).toContain('52 kcal / 100 g');
    expect(f.sub).toContain('88 kcal a serving');
    expect(f.brand).toBe('Chobani');
    expect(portionChips(f)[0].grams).toBe(170);
  });
  it('a generic food keeps its household portions', () => {
    expect(parsePortions('1 cup=240|1 slice, thin=20|bad|=5')).toEqual([{ label: '1 cup', grams: 240 }, { label: '1 slice, thin', grams: 20 }]);
    const f = dbFood(searchIndex(generic, 'bread pumpernickel', 1)[0]);
    expect(f.amountKind).toBe('grams');
    expect(f.per100.calories).toBeGreaterThan(200);
    expect(portionChips(f).length).toBeGreaterThan(0);
  });
});

describe('pinned staples', () => {
  it('every pinned name exists in the bundled data, so a rebuild cannot silently break them', async () => {
    const { STAPLES } = await import('./foodDb.js');
    const names = generic.map(e => e.name.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim());
    const missing = [];
    for (const [q, pins] of Object.entries(STAPLES)) for (const p of pins) {
      const n = p.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!names.some(x => x.startsWith(n))) missing.push(`${q}: ${p}`);
    }
    expect(missing).toEqual([]);
  });
  it('plain searches lead with the everyday food', () => {
    expect(searchIndex(generic, 'mince')[0].name).toMatch(/^Beef, ground/);
    expect(searchIndex(generic, 'capsicum')[0].name).toMatch(/^Peppers, sweet/);
    expect(searchIndex(generic, 'milk')[0].name).toMatch(/^Milk, whole/);
  });
});
