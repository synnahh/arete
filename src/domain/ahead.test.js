import { describe, it, expect } from 'vitest';
import { scheduledDaysPerPack, daysPerPack, forecast, restock, dueItems, parseAsin, cartLinks, shoppingList, projectedSpend } from './ahead.js';

// A 50 ml serum, 1 ml a use, twice a day → 25 days a pack.
const serum = { name: 'Niacinamide serum', category: 'grooming', boughtDate: '2026-09-01', packQty: 50, unit: 'ml', dosePerUse: 1, usesPerDay: 2 };

describe('days per pack', () => {
  it('comes from the schedule when pack, dose and uses are known', () => {
    expect(scheduledDaysPerPack(serum)).toBe(25);
    expect(daysPerPack(serum)).toMatchObject({ days: 25, source: 'schedule' });
  });

  it('falls back to a manual lifespan for old rows', () => {
    expect(daysPerPack({ lifespanDays: 30 })).toMatchObject({ days: 30, source: 'manual' });
    expect(daysPerPack({})).toBeNull();
  });

  it('trusts learned usage after two real cycles', () => {
    expect(daysPerPack({ ...serum, learnedDaysPerPack: 21, learnCycles: 1 }).source).toBe('schedule');
    expect(daysPerPack({ ...serum, learnedDaysPerPack: 21, learnCycles: 2 })).toMatchObject({ days: 21, source: 'learned' });
  });
});

describe('forecast', () => {
  it('runs out after days-per-pack × packs, reorder lead + buffer earlier', () => {
    const f = forecast(serum, '2026-09-10');
    expect(f.runOut).toBe('2026-09-26');
    expect(f.reorderBy).toBe('2026-09-21');   // 3 days delivery + 2 buffer
    expect(f).toMatchObject({ status: 'ok', daysLeft: 16, daysToReorder: 11 });
  });

  it('moves through soon → order → out', () => {
    expect(forecast(serum, '2026-09-16').status).toBe('soon');
    expect(forecast(serum, '2026-09-21').status).toBe('order');
    expect(forecast(serum, '2026-09-26').status).toBe('out');
  });

  it('counts spare packs and custom lead times', () => {
    const f = forecast({ ...serum, packsOnHand: 2, leadDays: 1, bufferDays: 0 }, '2026-09-10');
    expect(f.runOut).toBe('2026-10-21');
    expect(f.reorderBy).toBe('2026-10-20');
  });

  it('is unknown without enough information', () => {
    expect(forecast({ name: 'x' }, '2026-09-10').status).toBe('unknown');
  });

  it('does not crash the Supplies screen on malformed legacy dates', () => {
    expect(forecast({ ...serum, boughtDate: 'not-a-date' }, '2026-09-10').status).toBe('unknown');
    expect(forecast({ ...serum, boughtDate: '2026-02-30' }, '2026-09-10').status).toBe('unknown');
    expect(forecast(serum, 'not-a-date').status).toBe('unknown');
  });
});

describe('restock learning', () => {
  it('learns the real cycle length and resets the opened date', () => {
    const u = restock(serum, '2026-09-21'); // lasted 20 days, not 25
    expect(u).toMatchObject({ boughtDate: '2026-09-21', packsOnHand: 1, learnedDaysPerPack: 20, learnCycles: 1 });
    const u2 = restock({ ...serum, ...u }, '2026-10-13'); // 22 days
    expect(u2.learnedDaysPerPack).toBe(20.6);             // 20×0.7 + 22×0.3
    expect(u2.learnCycles).toBe(2);
  });

  it('divides by the packs that were on hand', () => {
    expect(restock({ ...serum, packsOnHand: 2 }, '2026-10-21').learnedDaysPerPack).toBe(25);
  });

  it('ignores outliers such as a forgotten restock', () => {
    const u = restock(serum, '2027-06-01'); // 273 days for a 25-day pack
    expect(u.learnedDaysPerPack).toBeUndefined();
    expect(u.boughtDate).toBe('2027-06-01');
  });
});

describe('cart', () => {
  it('lists due items soonest first', () => {
    const items = [serum, { name: 'Creatine', boughtDate: '2026-09-01', packQty: 300, dosePerUse: 5, usesPerDay: 1 }, { name: 'Unknown' }];
    const due = dueItems(items, '2026-09-16');
    expect(due.map(d => d.item.name)).toEqual(['Niacinamide serum']);
  });

  it('reads ASINs from URLs and builds one cart link', () => {
    expect(parseAsin('https://www.amazon.com.au/Some-Product/dp/B07XYZ1234/ref=sr_1_1')).toBe('B07XYZ1234');
    expect(parseAsin('b07xyz1234')).toBe('B07XYZ1234');
    expect(parseAsin('not an asin')).toBeNull();
    const l = cartLinks([{ name: 'Serum', asin: 'B07XYZ1234', qty: 2 }, { name: 'Creatine monohydrate' }]);
    expect(l.cart).toBe('https://www.amazon.com.au/gp/aws/cart/add.html?ASIN.1=B07XYZ1234&Quantity.1=2');
    expect(l.searches[0].url).toBe('https://www.amazon.com.au/s?k=Creatine%20monohydrate');
  });
});

describe('shopping list', () => {
  const plan = [
    { day: 'Monday', meals: [
      { name: 'Chicken rice', ingredients: [{ name: 'Chicken breast', qty: 200, unit: 'g' }, { name: 'Rice', qty: 80, unit: 'g' }] },
      { name: 'Omelette', ingredients: [{ name: 'Eggs', qty: 3, unit: '' }] },
    ] },
    { day: 'Tuesday', meals: [{ name: 'Chicken wrap', ingredients: [{ name: 'chicken breast', qty: 150, unit: 'g' }] }] },
  ];

  it('sums ingredients across the week by name and unit', () => {
    expect(shoppingList(plan, [], '2026-09-10')).toEqual([
      { name: 'Chicken breast', unit: 'g', qty: 350 },
      { name: 'Eggs', unit: '', qty: 3 },
      { name: 'Rice', unit: 'g', qty: 80 },
    ]);
  });

  it('skips what the pantry already has in stock', () => {
    const pantry = [{ name: 'Rice', category: 'kitchen', boughtDate: '2026-09-01', lifespanDays: 60 }];
    expect(shoppingList(plan, pantry, '2026-09-10').map(x => x.name)).toEqual(['Chicken breast', 'Eggs']);
  });
});

describe('projected spend', () => {
  const t = '2026-09-10';
  const serumP = { ...serum, price: 20 };          // 25-day pack; order by 2026-09-21 (in the window)
  const creatine = { name: 'Creatine', boughtDate: '2026-09-01', packQty: 300, dosePerUse: 5, usesPerDay: 1, price: 40 }; // 60 days; order by 2026-10-26 (outside)
  const overdue = { name: 'Toothpaste', boughtDate: '2026-07-01', lifespanDays: 30, price: 6 };  // long overdue → buy now, then every 30 days

  it('counts a purchase at the order-by date and again each pack later', () => {
    const p = projectedSpend([serumP], t, { days: 30 });
    expect(p.lines[0].dates).toEqual(['2026-09-21']);
    expect(p.total).toBe(20);
    expect(projectedSpend([serumP], t, { days: 60 }).lines[0].dates).toEqual(['2026-09-21', '2026-10-16']);
  });

  it('leaves out supplies that are not due in the window, or have no price or forecast', () => {
    const p = projectedSpend([creatine, { ...serum, price: null }, { name: 'x', price: 5 }], t, { days: 30 });
    expect(p).toEqual({ total: 0, lines: [] });
  });

  it('buys an overdue supply today and sums a mixed cart soonest first', () => {
    const p = projectedSpend([serumP, overdue], t, { days: 30 });
    expect(p.lines.map(l => [l.name, l.dates[0]])).toEqual([['Toothpaste', '2026-09-10'], ['Niacinamide serum', '2026-09-21']]);
    expect(p.lines[0].dates).toEqual(['2026-09-10', '2026-10-10']);
    expect(p.total).toBe(32);   // toothpaste x2 (12) + serum (20)
  });
});
