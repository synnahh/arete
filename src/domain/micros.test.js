import { describe, it, expect } from 'vitest';
import { weeklyMicros, microCoach } from './micros.js';

const meal = (micros) => ({ name: 'm', calories: 500, micros });
const log = (date, ...meals) => ({ date, meals });
const today = '2026-09-29';

// Four data days: plenty of vitamin C, little magnesium, sodium over the limit.
const good = [
  log('2026-09-25', meal({ vitaminC: 90, magnesium: 100, sodium: 3000 })),
  log('2026-09-26', meal({ vitaminC: 100, magnesium: 120, sodium: 2600 })),
  log('2026-09-27', meal({ vitaminC: 80, magnesium: 110, sodium: 2800 })),
  log('2026-09-28', meal({ vitaminC: 95, magnesium: 90, sodium: 3100 })),
];

describe('weeklyMicros', () => {
  it('averages per data day and reports coverage', () => {
    const s = weeklyMicros({ nutritionLogs: good, today });
    expect(s.dataDays).toBe(4);
    expect(s.avg.vitaminC).toBeCloseTo(91.25, 2);
    expect(s.coverage).toBe(1);
  });

  it('adds supplements taken that day', () => {
    const s = weeklyMicros({
      nutritionLogs: [log('2026-09-28', meal({ magnesium: 100 }))],
      supplements: [{ id: 's1', micros: { magnesium: 300 } }],
      suppLogs: [{ date: '2026-09-28', suppId: 's1' }, { date: '2026-09-27', suppId: 's1' }],
      today,
    });
    expect(s.avg.magnesium).toBe(400);
  });

  it('counts meals without micros against coverage and skips days with none', () => {
    const logs = [log('2026-09-27', { name: 'Toast', calories: 200 }), log('2026-09-28', meal({ iron: 5 }), { name: 'Rice', calories: 300 })];
    const s = weeklyMicros({ nutritionLogs: logs, today });
    expect(s.dataDays).toBe(1);
    expect(s.meals).toBe(3);
    expect(s.coverage).toBeCloseTo(1 / 3, 3);
  });

  it('ignores days outside the window', () => {
    expect(weeklyMicros({ nutritionLogs: [log('2026-09-01', meal({ iron: 5 }))], today }).dataDays).toBe(0);
  });
});

describe('microCoach', () => {
  it('names the lowest nutrients with food sources, and limit overages', () => {
    const c = microCoach(weeklyMicros({ nutritionLogs: good, today }));
    expect(c.status).toBe('ok');
    expect(c.gaps.map(g => g.key)).toEqual(['magnesium']);          // vitamin C is fine
    expect(c.gaps[0]).toMatchObject({ label: 'Magnesium', avgPct: 25 });
    expect(c.gaps[0].foods).toContain('pumpkin seeds');
    expect(c.overs[0]).toMatchObject({ key: 'sodium' });
  });

  it('does not judge a nutrient that is simply absent from the data', () => {
    const c = microCoach(weeklyMicros({ nutritionLogs: good, today }));
    expect(c.gaps.some(g => g.key === 'zinc')).toBe(false);
  });

  it('refuses to judge on thin data instead of crying deficiency', () => {
    expect(microCoach(weeklyMicros({ nutritionLogs: good.slice(0, 2), today })).status).toBe('low-coverage');   // 2 data days
    // same four days, but each also has two meals with no micronutrient data → 4 of 12 meals carry micros
    const sparse = good.map(l => ({ ...l, meals: [...l.meals, { name: 'x', calories: 400 }, { name: 'y', calories: 400 }] }));
    expect(microCoach(weeklyMicros({ nutritionLogs: sparse, today })).status).toBe('low-coverage');              // < 50% of meals carry micros
  });

  it('reports no data at all', () => {
    expect(microCoach(weeklyMicros({ nutritionLogs: [], today })).status).toBe('no-data');
  });
});
