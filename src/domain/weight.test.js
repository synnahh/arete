import { describe, it, expect } from 'vitest';
import { trendSeries, weeklyRate, paceVsGoal, weightCoach } from './weight.js';

// Daily weigh-ins from 2026-09-01: a steady fall of `perWeek` kg with ±`noise` wobble.
const days = (n, start, perWeek, noise = 0) =>
  Array.from({ length: n }, (_, i) => ({
    date: new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10),
    weight: String(+(start + (perWeek / 7) * i + (i % 2 ? noise : -noise)).toFixed(2)), // strings, like the form
  }));

describe('trendSeries', () => {
  it('smooths noise: the trend moves far less than the readings', () => {
    const s = trendSeries(days(14, 80, 0, 1));
    const readings = s.map(p => p.weight), trend = s.map(p => p.trend);
    const range = (a) => Math.max(...a) - Math.min(...a);
    expect(range(trend)).toBeLessThan(range(readings) / 2);
  });

  it('starts at the first reading and coerces string weights', () => {
    const s = trendSeries([{ date: '2026-09-01', weight: '80.4' }]);
    expect(s).toEqual([{ date: '2026-09-01', weight: 80.4, trend: 80.4 }]);
  });

  it('weights a reading more after a gap', () => {
    const daily = trendSeries([{ date: '2026-09-01', weight: 80 }, { date: '2026-09-02', weight: 82 }]);
    const gap = trendSeries([{ date: '2026-09-01', weight: 80 }, { date: '2026-09-15', weight: 82 }]);
    expect(gap[1].trend).toBeGreaterThan(daily[1].trend);
  });

  it('averages a day with several readings and ignores junk', () => {
    const s = trendSeries([{ date: '2026-09-01', weight: 80 }, { date: '2026-09-01', weight: 82 }, { date: '2026-09-02', weight: 8 }, { date: '2026-09-03', weight: 'abc' }, { weight: 80 }]);
    expect(s).toHaveLength(1);
    expect(s[0].weight).toBe(81);
  });

  it('sorts unordered input', () => {
    expect(trendSeries([{ date: '2026-09-03', weight: 79 }, { date: '2026-09-01', weight: 80 }]).map(p => p.date)).toEqual(['2026-09-01', '2026-09-03']);
  });
});

describe('weeklyRate', () => {
  it('recovers a steady loss', () => {
    const r = weeklyRate(trendSeries(days(28, 80, -0.5)));
    expect(r).toBeLessThan(-0.35);
    expect(r).toBeGreaterThan(-0.55);
  });

  it('needs enough data over enough time', () => {
    expect(weeklyRate(trendSeries(days(2, 80, -0.5)))).toBeNull();
    expect(weeklyRate(trendSeries(days(5, 80, -0.5)))).toBeNull(); // < 7 days
    expect(weeklyRate([])).toBeNull();
  });
});

describe('paceVsGoal', () => {
  it('judges a cut', () => {
    expect(paceVsGoal(-0.6, -0.6).status).toBe('on-track');
    expect(paceVsGoal(-0.2, -0.6).status).toBe('too-slow');
    expect(paceVsGoal(-1.2, -0.6).status).toBe('too-fast');
    expect(paceVsGoal(0.3, -0.6).status).toBe('wrong-way');
  });

  it('judges a bulk and a hold', () => {
    expect(paceVsGoal(0.3, 0.25).status).toBe('on-track');
    expect(paceVsGoal(0.05, 0).status).toBe('on-track');
    expect(paceVsGoal(-0.5, 0).status).toBe('too-fast');
  });

  it('is silent without a rate or a target', () => {
    expect(paceVsGoal(null, -0.6)).toBeNull();
    expect(paceVsGoal(-0.5, null)).toBeNull();
  });
});

describe('weightCoach', () => {
  it('bundles latest, trend, rate and pace', () => {
    const c = weightCoach(days(28, 80, -0.6), -0.6);
    expect(c.series).toHaveLength(28);
    expect(c.pace.status).toBe('on-track');
    expect(c.trend).toBeGreaterThan(c.latest);   // the trend lags a falling weight
  });
  it('returns null with no usable weights', () => {
    expect(weightCoach([{ date: '2026-09-01', weight: '' }])).toBeNull();
  });
});
