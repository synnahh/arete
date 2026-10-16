import { describe, it, expect } from 'vitest';
import { HOME_SECTIONS, DEFAULT_HOME, ALL_SECTION_IDS, cleanHome, setSection, moveSection, calorieStatus, waterStatus, weightStatus } from './homeLayout.js';

describe('Home layout', () => {
  it('shows the six things Rob picked by default, in order, then the metrics area', () => {
    expect(DEFAULT_HOME).toEqual(['calories', 'weight', 'streak', 'skin', 'water', 'sleep', 'metrics']);
  });
  it('keeps every other section available but off', () => {
    const off = HOME_SECTIONS.filter(s => !s.on).map(s => s.id);
    expect(off).toEqual(['workout', 'moves', 'steps', 'updates', 'recap', 'overall']);
  });
  it('uses the default until you save a layout, then your layout', () => {
    expect(cleanHome(undefined)).toEqual(DEFAULT_HOME);
    expect(cleanHome({})).toEqual(DEFAULT_HOME);
    expect(cleanHome({ sections: ['water', 'calories'], seen: ALL_SECTION_IDS })).toEqual(['water', 'calories']);
  });
  it('drops unknown ids and repeats, and allows an empty Home', () => {
    expect(cleanHome({ sections: ['water', 'bogus', 'water', 'sleep'], seen: ALL_SECTION_IDS })).toEqual(['water', 'sleep']);
    expect(cleanHome({ sections: [], seen: ALL_SECTION_IDS })).toEqual([]);
  });
  it('turns sections on (at the end) and off, and moves them', () => {
    expect(setSection(['calories'], 'workout', true)).toEqual(['calories', 'workout']);
    expect(setSection(['calories', 'workout'], 'calories', false)).toEqual(['workout']);
    expect(setSection(['calories'], 'nope', true)).toEqual(['calories']);
    expect(moveSection(['calories', 'weight'], 'bogus', -1)).toEqual(['calories', 'weight']);
    expect(moveSection(['calories', 'weight', 'streak'], 'weight', -1)).toEqual(['weight', 'calories', 'streak']);
    expect(moveSection(['calories', 'weight'], 'weight', 1)).toEqual(['calories', 'weight']);
  });
});

describe('Home card sums', () => {
  it('works out calories and protein left, and what is over', () => {
    const s = calorieStatus({ kcal: 2300, protein: 155 }, { calories: 1500, protein: 160 });
    expect(s.kcal).toMatchObject({ eaten: 1500, target: 2300, left: 800, over: 0 });
    expect(s.protein).toMatchObject({ left: 0, over: 5 });
    expect(calorieStatus({ kcal: 0 }, {})).toBeNull();
    expect(calorieStatus(null, {})).toBeNull();
  });
  it('works out water against the goal', () => {
    expect(waterStatus(1250, 3000)).toMatchObject({ total: 1250, left: 1750, done: false });
    expect(waterStatus(3200, 3000).done).toBe(true);
    expect(waterStatus(500, 0).goal).toBeNull();
  });
  it('summarises weight, trend and kg to go', () => {
    const w = weightStatus({ currentKg: 71.2, lastDate: '2026-10-12', changeKg: -0.8, week: 3 }, { latest: 71.2, trend: 71.5, rate: -0.3, pace: { message: 'On track.' } }, { targetWeightKg: 69 });
    expect(w).toMatchObject({ latest: 71.2, trend: 71.5, changeKg: -0.8, toGoKg: -2.5, target: 69, paceMessage: 'On track.' });
    expect(weightStatus(null, null, null)).toBeNull();
  });
});

import { layoutRows } from './homeLayout.js';
describe('Home page layout', () => {
  it('puts each card in the shortest column so the columns end together', () => {
    // sleep is tall: it sits alone while the short cards stack in the other column
    expect(layoutRows(['calories', 'sleep', 'water', 'skin'], 2)).toEqual([{ cols: [['sleep'], ['calories', 'water', 'skin']] }]);
    expect(layoutRows(['calories', 'weight'], 1)).toEqual([{ cols: [['calories', 'weight']] }]);
  });
  it('gives metrics its own full-width row, keeping the order around it', () => {
    expect(layoutRows(['calories', 'weight', 'metrics', 'water'], 2)).toEqual([{ cols: [['weight'], ['calories']] }, { full: 'metrics' }, { cols: [['water']] }]);
    expect(layoutRows(['metrics'], 2)).toEqual([{ full: 'metrics' }]);
    expect(layoutRows([], 2)).toEqual([]);
  });
});

describe('cleanHome offers new default sections once', () => {
  it('adds Metrics to a layout saved before it existed', async () => {
    const { cleanHome } = await import('./homeLayout.js');
    expect(cleanHome({ sections: ['calories', 'water'] })).toEqual(['calories', 'water', 'metrics']);
  });
  it('respects a layout that has seen it and turned it off', async () => {
    const { cleanHome, ALL_SECTION_IDS } = await import('./homeLayout.js');
    expect(cleanHome({ sections: ['calories', 'water'], seen: ALL_SECTION_IDS })).toEqual(['calories', 'water']);
  });
  it('does not repeat it when already shown', async () => {
    const { cleanHome } = await import('./homeLayout.js');
    expect(cleanHome({ sections: ['metrics', 'water'] })).toEqual(['metrics', 'water']);
  });
});
