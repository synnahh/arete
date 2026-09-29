import { describe, it, expect } from 'vitest';
import { dayIndex, daysBetween, fitWithin, photoPath, byPose, nearestWeight, comparison, defaultPair, normalisePose } from './photos.js';

describe('dayIndex / daysBetween', () => {
  it('counts whole days across a month and DST boundary', () => {
    expect(daysBetween('2026-09-01', '2026-09-29')).toBe(28);
    expect(daysBetween('2026-10-03', '2026-10-05')).toBe(2); // AU DST starts 4 Oct
  });
  it('rejects malformed and impossible dates', () => {
    expect(dayIndex('2026-02-31')).toBeNaN();
    expect(dayIndex('yesterday')).toBeNaN();
    expect(dayIndex(undefined)).toBeNaN();
    expect(daysBetween('2026-09-01', 'nope')).toBeNull();
  });
});

describe('fitWithin', () => {
  it('scales the long edge down and keeps the ratio', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 });
    expect(fitWithin(3000, 4000, 400)).toEqual({ w: 300, h: 400 });
  });
  it('never upscales and survives bad input', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ w: 800, h: 600 });
    expect(fitWithin(0, 100, 400)).toEqual({ w: 0, h: 0 });
  });
});

describe('poses', () => {
  it('knows the face pose and keeps body poses separate', async () => {
    const { POSES, BODY_POSES } = await import('./photos.js');
    expect(POSES.map(p => p.id)).toContain('face');
    expect(BODY_POSES).toEqual(['front', 'side', 'back']);
    expect(normalisePose('face')).toBe('face');
  });
});

describe('photoPath', () => {
  it('puts the user id first and sanitises the nonce', () => {
    const p = photoPath('u-1', { date: '2026-09-29', pose: 'side', nonce: 'a/b..c' });
    expect(p).toBe('u-1/2026-09-29-side-abc.jpg');
    expect(p.startsWith('u-1/')).toBe(true);
  });
  it('marks thumbnails and falls back to the front pose', () => {
    expect(photoPath('u', { date: '2026-09-29', pose: 'weird', nonce: 'x', thumb: true })).toBe('u/2026-09-29-front-x-thumb.jpg');
    expect(normalisePose('back')).toBe('back');
  });
});

describe('byPose / defaultPair', () => {
  const rows = [
    { id: 'c', date: '2026-09-29', pose: 'front', path: 'p3' },
    { id: 'a', date: '2026-09-01', pose: 'front', path: 'p1' },
    { id: 'x', date: '2026-09-10', pose: 'side',  path: 'p2' },
    { id: 'bad', date: 'garbage', pose: 'front', path: 'p4' },
    { id: 'nopath', date: '2026-09-05', pose: 'front' },
  ];
  it('filters to a pose, drops unusable rows and sorts oldest first', () => {
    expect(byPose(rows, 'front').map(r => r.id)).toEqual(['a', 'c']);
    expect(byPose(rows, 'back')).toEqual([]);
  });
  it('pairs first against latest only when there are two', () => {
    expect(defaultPair(byPose(rows, 'front'))).toMatchObject({ before: { id: 'a' }, after: { id: 'c' } });
    expect(defaultPair(byPose(rows, 'side'))).toBeNull();
  });
});

describe('nearestWeight / comparison', () => {
  const metrics = [
    { date: '2026-09-01', weight: '82.4' },
    { date: '2026-09-27', weight: 80.9 },
    { date: '2026-08-01', weight: 90 },
    { date: '2026-09-20', weight: 'n/a' },
  ];
  it('takes the closest weigh-in inside the gap and coerces strings', () => {
    expect(nearestWeight(metrics, '2026-09-02')).toBe(82.4);
    expect(nearestWeight(metrics, '2026-09-29')).toBe(80.9);
  });
  it('returns null rather than a stale reading', () => {
    expect(nearestWeight(metrics, '2026-09-14')).toBeNull();
    expect(nearestWeight([], '2026-09-14')).toBeNull();
  });
  it('summarises the gap in days and kg', () => {
    const c = comparison({ date: '2026-09-01' }, { date: '2026-09-29' }, metrics);
    expect(c).toEqual({ days: 28, weightBefore: 82.4, weightAfter: 80.9, weightDeltaKg: -1.5 });
  });
  it('leaves the weight change null when a weigh-in is missing', () => {
    expect(comparison({ date: '2026-09-01' }, { date: '2026-09-14' }, metrics).weightDeltaKg).toBeNull();
    expect(comparison(null, { date: '2026-09-14' }, metrics)).toBeNull();
  });
});
