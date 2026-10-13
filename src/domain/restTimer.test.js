import { describe, it, expect } from 'vitest';
import * as R from './restTimer.js';

const T0 = 1_000_000;

describe('rest timer', () => {
  it('works out what is left from the clock, so backgrounding cannot drift it', () => {
    const s = R.start(90, T0);
    expect(R.remaining(s, T0)).toBe(90);
    expect(R.remaining(s, T0 + 30_000)).toBe(60);
    expect(R.remaining(s, T0 + 89_100)).toBe(1);
    expect(R.isDone(s, T0 + 90_000)).toBe(true);
    expect(R.remaining(s, T0 + 500_000)).toBe(0);
  });

  it('pauses and resumes without losing time', () => {
    let s = R.start(60, T0);
    s = R.pause(s, T0 + 20_000);
    expect(R.isPaused(s)).toBe(true);
    expect(R.remaining(s, T0 + 999_000)).toBe(40);   // frozen while paused
    s = R.resume(s, T0 + 100_000);
    expect(R.remaining(s, T0 + 110_000)).toBe(30);
  });

  it('adds and takes time, never below one second, growing the ring', () => {
    let s = R.start(60, T0);
    s = R.add(s, 30, T0 + 10_000);
    expect(R.remaining(s, T0 + 10_000)).toBe(80);
    expect(s.total).toBe(90);
    s = R.add(s, -300, T0 + 10_000);
    expect(R.remaining(s, T0 + 10_000)).toBe(1);
    const p = R.add(R.pause(R.start(60, T0), T0), 15, T0);
    expect(R.remaining(p, T0 + 50_000)).toBe(75);
  });

  it('flags the last ten seconds and the ring fraction', () => {
    const s = R.start(60, T0);
    expect(R.isLow(s, T0 + 49_000)).toBe(false);
    expect(R.isLow(s, T0 + 50_500)).toBe(true);
    expect(R.isLow(s, T0 + 60_000)).toBe(false);   // done is not low
    expect(R.fraction(s, T0 + 30_000)).toBeCloseTo(0.5);
  });

  it('resets to the full rest, and survives a reload through storage', () => {
    const s = R.reset(R.start(120, T0), T0 + 60_000);
    expect(R.remaining(s, T0 + 60_000)).toBe(120);
    const mem = {};
    const storage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
    const live = R.start(90);
    R.save(live, storage);
    expect(R.load(storage)).toEqual(live);
    R.save(null, storage);
    expect(R.load(storage)).toBeNull();
  });

  it('forgets a rest that finished long ago', () => {
    const mem = { [R.REST_KEY]: JSON.stringify({ until: Date.now() - 11 * 60_000, total: 90, pausedLeft: null }) };
    expect(R.load({ getItem: k => mem[k] ?? null })).toBeNull();
  });

  it('formats minutes and seconds', () => {
    expect(R.fmt(65)).toBe('1:05');
    expect(R.fmt(0)).toBe('0:00');
    expect(R.fmt(-3)).toBe('0:00');
  });
});
