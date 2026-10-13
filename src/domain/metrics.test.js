import { describe, it, expect } from 'vitest';
import { buildMetrics, prettyName, formatMetric, freshness } from './metrics.js';
import { mapHealthExport } from '../../supabase/functions/_shared/healthMap.js';

const row = (date, data) => ({ date, data });

describe('buildMetrics', () => {
  it('returns nothing when there is no data', () => {
    expect(buildMetrics({})).toEqual([]);
    expect(buildMetrics({ health: [row('2026-10-01', {})], body: [{ date: '2026-10-01', weight: 0 }] })).toEqual([]);
  });

  it('shows a tile only for metrics that have a reading, and the latest value', () => {
    const t = buildMetrics({
      health: [row('2026-10-01', { steps: 5000 }), row('2026-10-02', { steps: 8000, hrv: 52 })],
      today: '2026-10-02',
    });
    expect(t.map(x => x.id)).toEqual(['steps', 'hrv']);
    const steps = t.find(x => x.id === 'steps');
    expect(steps.value).toBe(8000);
    expect(steps.daysAgo).toBe(0);
    expect(steps.series).toHaveLength(2);
  });

  it('compares the latest day with the 7 days before it and judges it by what is good', () => {
    const days = [60, 61, 62, 63, 64, 65, 66].map((v, i) => row(`2026-10-0${i + 1}`, { restingHeartRate: v }));
    days.push(row('2026-10-08', { restingHeartRate: 57 }));          // lower resting HR is good
    const rhr = buildMetrics({ health: days, today: '2026-10-08' }).find(x => x.id === 'restingHeartRate');
    expect(rhr.change).toBe(-6);
    expect(rhr.tone).toBe('good');
    const up = buildMetrics({ health: days.map(d => row(d.date, { hrv: d.data.restingHeartRate })), today: '2026-10-08' }).find(x => x.id === 'hrv');
    expect(up.tone).toBe('warn');                                    // HRV falling is not
  });

  it('does not judge weight, and says when a reading is old', () => {
    const t = buildMetrics({ body: [{ date: '2026-10-01', weight: 80 }, { date: '2026-10-05', weight: 78 }], today: '2026-10-08' });
    const w = t.find(x => x.id === 'weight');
    expect(w.value).toBe(78);
    expect(w.change).toBe(-2);
    expect(w.tone).toBe('flat');
    expect(w.daysAgo).toBe(3);
    expect(freshness(w.daysAgo)).toBe('3 days ago');
    expect(freshness(0)).toBe('today');
    expect(freshness(1)).toBe('yesterday');
  });

  it('averages several weigh-ins on one day and turns sleep minutes into hours', () => {
    const t = buildMetrics({
      body: [{ date: '2026-10-01', weight: 79 }, { date: '2026-10-01', weight: 81 }],
      sleep: [{ date: '2026-10-01', duration: 450, efficiency: 91 }],
      today: '2026-10-01',
    });
    expect(t.find(x => x.id === 'weight').value).toBe(80);
    expect(t.find(x => x.id === 'sleepHours').value).toBe(7.5);
    expect(t.find(x => x.id === 'sleepEfficiency').value).toBe(91);
  });

  it('shows heart rate from the avg field and any metric the phone sends under `more`', () => {
    const t = buildMetrics({
      health: [row('2026-10-01', { heartRate: { avg: 71, min: 50, max: 140 }, more: { vo2_max: { v: 44.2, u: 'ml/kg/min' }, walking_running_distance: { v: 6.4, u: 'km' } } })],
      today: '2026-10-01',
    });
    expect(t.find(x => x.id === 'heartRate').value).toBe(71);
    const vo2 = t.find(x => x.id === 'x:vo2_max');
    expect(vo2).toMatchObject({ label: 'Vo2 max', unit: 'ml/kg/min', value: 44.2, group: 'Other' });
    expect(t.find(x => x.id === 'x:walking_running_distance').label).toBe('Walking running distance');
  });

  it('keeps 14 days at most, oldest first', () => {
    const health = Array.from({ length: 20 }, (_, i) => row(`2026-09-${String(i + 1).padStart(2, '0')}`, { steps: 1000 + i }));
    const s = buildMetrics({ health, today: '2026-09-20' })[0];
    expect(s.series).toHaveLength(14);
    expect(s.series[0].date < s.series[13].date).toBe(true);
  });

  it('formats numbers', () => {
    expect(formatMetric({ value: 8123, digits: 0 })).toBe((8123).toLocaleString('en-AU'));
    expect(formatMetric({ value: 78, digits: 1 })).toBe('78.0');
    expect(prettyName('walkingRunningDistance')).toBe('Walking running distance');
  });
});

describe('health export: metrics without a field of their own', () => {
  it('lands in days[day].more, summed when it accumulates and averaged otherwise', () => {
    const payload = { data: { metrics: [
      { name: 'walking_running_distance', units: 'km', data: [{ date: '2026-10-02 08:00:00 +1000', qty: 2 }, { date: '2026-10-02 18:00:00 +1000', qty: 3.5 }] },
      { name: 'vo2_max', units: 'ml/kg/min', data: [{ date: '2026-10-02 08:00:00 +1000', qty: 40 }, { date: '2026-10-02 09:00:00 +1000', qty: 44 }] },
      { name: 'step_count', units: 'count', data: [{ date: '2026-10-02 08:00:00 +1000', qty: 100 }] },
    ] } };
    const { days } = mapHealthExport(payload);
    expect(days['2026-10-02'].more.walking_running_distance).toEqual({ v: 5.5, u: 'km' });
    expect(days['2026-10-02'].more.vo2_max).toEqual({ v: 42, u: 'ml/kg/min' });
    expect(days['2026-10-02'].more.step_count).toBeUndefined();
    expect(days['2026-10-02'].steps).toBe(100);
  });
});
