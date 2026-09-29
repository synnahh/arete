import { describe, it, expect } from 'vitest';
import { scheduledDaysPerPack, daysPerPack, forecast, restock, dueItems, parseAsin, cartLinks, shoppingList, projectedSpend, toBase, isTracked, pantryUsage, applyUsage, expiry, expiringItems } from './ahead.js';

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

describe('food log → pantry', () => {
  const rice = { id: 'r', name: 'Rice', category: 'kitchen', boughtDate: '2026-09-01', packQty: 5, unit: 'kg', packsOnHand: 1 };
  const chicken = { id: 'c', name: 'Chicken breast', category: 'kitchen', boughtDate: '2026-09-01', packQty: 1000, unit: 'g' };
  const day = (date, ...meals) => ({ date, meals });
  const eat = (name, qty, unit = 'g') => ({ name, qty, unit });

  it('converts mass and volume units, and rejects the rest', () => {
    expect(toBase(2, 'kg')).toMatchObject({ kind: 'mass', amount: 2000 });
    expect(toBase(250, 'ml')).toMatchObject({ kind: 'vol', amount: 250 });
    expect(toBase(1, 'serving')).toBeNull();
    expect(toBase(0, 'g')).toBeNull();
  });

  it('only tracks Kitchen supplies with a measurable pack, unless switched off', () => {
    expect(isTracked(rice)).toBe(true);
    expect(isTracked({ ...rice, autoSubtract: false })).toBe(false);
    expect(isTracked({ ...rice, category: 'grooming' })).toBe(false);
    expect(isTracked({ ...rice, unit: 'x' })).toBe(false);
  });

  it('subtracts matching foods in the unit the supply is measured in', () => {
    const logs = [day('2026-09-05', eat('Basmati rice, cooked', 300), eat('Whey', 30)), day('2026-09-06', eat('Rice', 0.5, 'kg'))];
    const u = pantryUsage([rice], logs, '2026-09-10').get('r');
    expect(u.consumed).toBe(0.8);
    expect(u.left).toBe(4.2);
  });

  it('ignores food eaten before the pack was opened or after today', () => {
    const logs = [day('2026-08-30', eat('Rice', 500)), day('2026-09-20', eat('Rice', 500))];
    expect(pantryUsage([rice], logs, '2026-09-10').size).toBe(0);
  });

  it('needs every word of the supply name, and matching units', () => {
    const logs = [day('2026-09-05', eat('Chicken thigh', 200), eat('Rice milk', 200, 'ml'))];
    expect(pantryUsage([chicken, rice], logs, '2026-09-10').size).toBe(0);
  });

  it('prefers the most specific supply and refuses to guess between equals', () => {
    const plain = { id: 'p', name: 'Rice', category: 'kitchen', boughtDate: '2026-09-01', packQty: 1000, unit: 'g' };
    const brown = { id: 'b', name: 'Brown rice', category: 'kitchen', boughtDate: '2026-09-01', packQty: 1000, unit: 'g' };
    const logs = [day('2026-09-05', eat('Brown rice cooked', 100))];
    expect([...pantryUsage([plain, brown], logs, '2026-09-10').keys()]).toEqual(['b']);
    const dup = { ...plain, id: 'p2' };
    expect(pantryUsage([plain, dup], [day('2026-09-05', eat('Rice', 100))], '2026-09-10').size).toBe(0);
  });

  it('deleting a meal puts the stock back (it is derived, not stored)', () => {
    const one = pantryUsage([chicken], [day('2026-09-05', eat('Chicken breast', 200))], '2026-09-10').get('c');
    const none = pantryUsage([chicken], [day('2026-09-05')], '2026-09-10');
    expect(one.left).toBe(800);
    expect(none.size).toBe(0);
  });

  it('shows stock left but keeps the schedule until 3 days of use', () => {
    const two = [day('2026-09-08', eat('Chicken breast', 200)), day('2026-09-09', eat('Chicken breast', 200))];
    const [item] = applyUsage([chicken], two, '2026-09-10');
    expect(item.stockLeft).toBe(600);
    expect(item.usageDaysLeft).toBeUndefined();
  });

  it('forecasts run-out from real use once there are 3+ days of it', () => {
    // 200 g on each of 5 days = 1000 g gone of 1000 → out.
    const logs = ['05', '06', '07', '08', '09'].map(d => day(`2026-09-${d}`, eat('Chicken breast', 200)));
    const [gone] = applyUsage([chicken], logs, '2026-09-10');
    expect(forecast(gone, '2026-09-10').status).toBe('out');
    // 100 g on each of 3 days over a 10-day span: 300 g used, 700 left, 30 g/day → ~23 days.
    const light = ['07', '08', '09'].map(d => day(`2026-09-${d}`, eat('Chicken breast', 100)));
    const [item] = applyUsage([{ ...chicken, lifespanDays: 200 }], light, '2026-09-10');
    const f = forecast(item, '2026-09-10');
    expect(f.source).toBe('usage');
    expect(f.daysLeft).toBe(23);
  });

  it('never postpones a run-out the schedule already predicts', () => {
    const logs = ['07', '08', '09'].map(d => day(`2026-09-${d}`, eat('Chicken breast', 10)));
    const soon = { ...chicken, lifespanDays: 12 }; // schedule: out 2026-09-13
    const [item] = applyUsage([soon], logs, '2026-09-10');
    const f = forecast(item, '2026-09-10');
    expect(f.source).toBe('manual');
    expect(f.runOut).toBe('2026-09-13');
  });

  it('lets a supply with no schedule at all be forecast from use alone', () => {
    const logs = ['07', '08', '09'].map(d => day(`2026-09-${d}`, eat('Chicken breast', 100)));
    const [item] = applyUsage([chicken], logs, '2026-09-10');
    expect(forecast(item, '2026-09-10')).toMatchObject({ source: 'usage' });
  });

  it('leaves untracked items and empty logs untouched', () => {
    const items = [rice];
    expect(applyUsage(items, [], '2026-09-10')).toBe(items);
  });
});

describe('shelf life after opening', () => {
  const jar = { name: 'Vitamin C serum', boughtDate: '2026-04-01', paoMonths: 6 };
  it('adds the months to the day it was opened', () => {
    expect(expiry(jar, '2026-06-01')).toEqual({ status: 'ok', useBy: '2026-10-01', daysLeft: 122 });
    expect(expiry({ ...jar, openedDate: '2026-05-15' }, '2026-06-01').useBy).toBe('2026-11-15');
  });
  it('warns inside 30 days and flags it once past', () => {
    expect(expiry(jar, '2026-09-10')).toMatchObject({ status: 'soon', daysLeft: 21 });
    expect(expiry(jar, '2026-10-01')).toMatchObject({ status: 'soon', daysLeft: 0 });
    expect(expiry(jar, '2026-10-02')).toMatchObject({ status: 'expired', daysLeft: -1 });
  });
  it('clamps to the end of a short month', () => {
    expect(expiry({ boughtDate: '2026-01-31', paoMonths: 1 }, '2026-01-31').useBy).toBe('2026-02-28');
    expect(expiry({ boughtDate: '2027-12-31', paoMonths: 2 }, '2027-12-31').useBy).toBe('2028-02-29');
  });
  it('says nothing without a shelf life or a valid date', () => {
    expect(expiry({ boughtDate: '2026-04-01' }, '2026-09-10').status).toBe('unknown');
    expect(expiry({ paoMonths: 6 }, '2026-09-10').status).toBe('unknown');
    expect(expiry({ boughtDate: 'soon', paoMonths: 6 }, '2026-09-10').status).toBe('unknown');
    expect(expiry({ boughtDate: '2026-04-01', paoMonths: 0 }, '2026-09-10').status).toBe('unknown');
    expect(expiry({ boughtDate: '2026-04-01', paoMonths: 99 }, '2026-09-10').status).toBe('unknown');
  });
  it('lists what to use up, soonest first', () => {
    const items = [jar, { name: 'SPF', boughtDate: '2025-10-15', paoMonths: 12 }, { name: 'Cleanser', boughtDate: '2026-08-01', paoMonths: 12 }, { name: 'Rice' }];
    expect(expiringItems(items, '2026-09-20').map(x => x.item.name)).toEqual(['Vitamin C serum', 'SPF']);
  });
});
