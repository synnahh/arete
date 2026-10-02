import { describe, it, expect } from 'vitest';
import { mapHealthExport, toKg, safeEqual } from '../../supabase/functions/_shared/healthMap.js';

const metric = (name, units, data) => ({ name, units, data });
const payload = (...metrics) => ({ data: { metrics } });

describe('mapHealthExport', () => {
  it('sums steps per local day and keeps the phone date', () => {
    const r = mapHealthExport(payload(metric('step_count', 'count', [
      { date: '2026-10-02 08:00:00 +1000', qty: 1200 },
      { date: '2026-10-02 12:00:00 +1000', qty: 3000 },
      { date: '2026-10-01 23:00:00 +1000', qty: 500 },
    ])));
    expect(r.days['2026-10-02'].steps).toBe(4200);
    expect(r.days['2026-10-01'].steps).toBe(500);
  });

  it('keeps every weigh-in and attaches body fat from the same minute', () => {
    const r = mapHealthExport(payload(
      metric('weight_body_mass', 'kg', [
        { date: '2026-10-02 07:15:10 +1000', qty: 82.4 },
        { date: '2026-10-02 19:00:00 +1000', qty: 83.1 },
      ]),
      metric('body_fat_percentage', '%', [{ date: '2026-10-02 07:15:40 +1000', qty: 18.2 }]),
    ));
    expect(r.weights).toHaveLength(2);
    expect(r.weights[0]).toMatchObject({ date: '2026-10-02', time: '07:15', weight: 82.4, bodyFat: 18.2 });
    expect(r.weights[1].bodyFat).toBeUndefined();
    expect(r.weights[0].key).not.toBe(r.weights[1].key);
  });

  it('converts pounds and stone, and treats a 0-1 body fat as a fraction', () => {
    expect(toKg(180, 'lb')).toBeCloseTo(81.65, 1);
    expect(toKg(13, 'st')).toBeCloseTo(82.55, 1);
    const r = mapHealthExport(payload(
      metric('weight_body_mass', 'lb', [{ date: '2026-10-02 07:00:00 +1000', qty: 180 }]),
      metric('body_fat_percentage', '%', [{ date: '2026-10-02 07:00:00 +1000', qty: 0.182 }]),
    ));
    expect(r.weights[0].weight).toBeCloseTo(81.65, 1);
    expect(r.weights[0].bodyFat).toBe(18.2);
  });

  it('drops impossible weights', () => {
    const r = mapHealthExport(payload(metric('weight_body_mass', 'kg', [
      { date: '2026-10-02 07:00:00 +1000', qty: 8 }, { date: '2026-10-02 07:01:00 +1000', qty: 800 },
    ])));
    expect(r.weights).toEqual([]);
  });

  it('turns sleep hours into minutes with stages', () => {
    const r = mapHealthExport(payload(metric('sleep_analysis', 'hr', [{
      date: '2026-10-02 00:00:00 +1000', sleepStart: '2026-10-01 23:10:00 +1000', sleepEnd: '2026-10-02 06:50:00 +1000',
      asleep: 7, inBed: 7.5, deep: 1.2, rem: 1.5, core: 4.3, awake: 0.4,
    }])));
    expect(r.sleep[0]).toMatchObject({ date: '2026-10-02', duration: 420, efficiency: 93, bedTime: '23:10', wakeTime: '06:50' });
    expect(r.sleep[0].stages).toEqual({ deep: 72, rem: 90, core: 258, awake: 24 });
  });

  it('summarises heart rate and ignores junk and empty payloads', () => {
    const r = mapHealthExport(payload(metric('heart_rate', 'bpm', [
      { date: '2026-10-02 08:00:00 +1000', Min: 55, Avg: 70, Max: 120 },
      { date: '2026-10-02 09:00:00 +1000', Min: 58, Avg: 80, Max: 150 },
    ]), metric('step_count', 'count', [{ date: 'garbage', qty: 5 }, { date: '2026-10-02 08:00:00 +1000', qty: 'x' }])));
    expect(r.days['2026-10-02'].heartRate).toEqual({ avg: 75, min: 55, max: 150 });
    expect(r.days['2026-10-02'].steps).toBeUndefined();
    expect(mapHealthExport(null)).toEqual({ days: {}, weights: [], sleep: [] });
  });
});

describe('safeEqual', () => {
  it('matches only identical strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual(undefined, '')).toBe(true);
  });
});
