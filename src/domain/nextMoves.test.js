import { describe, it, expect } from 'vitest';
import { nextMoves } from './nextMoves.js';

const ids = (snap) => nextMoves(snap).map(m => m.id);
const targets = { kcal: 2400, protein: 180 };

describe('nextMoves', () => {
  it('says nothing when there is nothing to say', () => {
    expect(nextMoves({ hour: 9 })).toEqual([]);
    expect(nextMoves()).toEqual([]);
  });

  it('puts a supply that has run out first, naming what and why', () => {
    const m = nextMoves({ hour: 15, supplies: { due: [{ name: 'Whey', daysToReorder: -2, status: 'out' }, { name: 'Rice', daysToReorder: 0, status: 'order' }] }, training: { isTrainingDay: true, trainedToday: false, label: 'Legs' } });
    expect(m[0]).toMatchObject({ id: 'reorder', tab: 'essentials', title: 'Reorder Whey, Rice' });
    expect(m[0].why).toMatch(/Whey has run out/);
  });

  it('ignores supplies that are merely coming up', () => {
    expect(ids({ hour: 12, supplies: { due: [{ name: 'Rice', daysToReorder: 3, status: 'soon' }] } })).not.toContain('reorder');
  });

  it('nudges training in the morning, harder in the evening, and stops once trained', () => {
    const base = { isTrainingDay: true, trainedToday: false, label: 'Push' };
    expect(nextMoves({ hour: 8, training: base })[0]).toMatchObject({ id: 'train', priority: 55 });
    expect(nextMoves({ hour: 17, training: base })[0]).toMatchObject({ id: 'train', priority: 76 });
    expect(ids({ hour: 17, training: { ...base, trainedToday: true } })).not.toContain('train');
    expect(ids({ hour: 17, training: { ...base, isTrainingDay: false } })).not.toContain('train');
  });

  it('turns a training-day nudge into "go lighter" on a low-readiness day', () => {
    const m = nextMoves({ hour: 10, training: { isTrainingDay: true, trainedToday: false, label: 'Legs', readiness: { status: 'ok', band: 'go-easy', score: 32, label: 'Go easier' } } });
    expect(m[0]).toMatchObject({ id: 'train-easy' });
    expect(m[0].why).toMatch(/Readiness is 32/);
  });

  it('only worries about food at sensible times of day', () => {
    expect(ids({ hour: 10, targets, eaten: { calories: 0, protein: 0 } })).not.toContain('log-food');
    expect(ids({ hour: 13, targets, eaten: { calories: 0, protein: 0 } })).toContain('log-food');
    // Fasting: not eating yet is the plan.
    expect(ids({ hour: 13, targets, eaten: { calories: 0, protein: 0 }, fast: { done: false, elapsedH: 15, targetHours: 16 } })).not.toContain('log-food');
  });

  it('flags protein that is behind the pace for the time of day', () => {
    const m = nextMoves({ hour: 18, targets, eaten: { calories: 900, protein: 40 } });
    const p = m.find(x => x.id === 'protein');
    expect(p.title).toMatch(/behind pace/);
    expect(ids({ hour: 18, targets, eaten: { calories: 1500, protein: 120 } })).not.toContain('protein');
    expect(ids({ hour: 11, targets, eaten: { calories: 300, protein: 5 } })).not.toContain('protein');
  });

  it('flags only under-eating late in the day', () => {
    expect(ids({ hour: 21, targets, eaten: { calories: 900, protein: 150 } })).toContain('under-eaten');
    expect(ids({ hour: 15, targets, eaten: { calories: 900, protein: 150 } })).not.toContain('under-eaten');
  });

  it('passes on behind-pace water, high sleep debt and a long gap since a weigh-in', () => {
    const m = ids({ hour: 15, water: { advice: { status: 'behind', message: 'Have 500 ml.' } }, sleep: { status: 'high', debtHours: 8.5, bedtime: '22:00' }, weight: { hasGoal: true, daysSinceWeighIn: 6 } });
    expect(m).toEqual(expect.arrayContaining(['water', 'sleep-debt', 'weigh-in']));
    expect(ids({ hour: 15, weight: { hasGoal: true, daysSinceWeighIn: 2 } })).not.toContain('weigh-in');
    expect(ids({ hour: 15, weight: { hasGoal: false, daysSinceWeighIn: 30 } })).not.toContain('weigh-in');
    expect(ids({ hour: 15, weight: { hasGoal: true, daysSinceWeighIn: null } })).toContain('weigh-in');
    expect(ids({ hour: 15, sleep: { status: 'moderate', debtHours: 4 } })).not.toContain('sleep-debt');
  });

  it('reminds about habits and the night routine only in the evening', () => {
    const snap = { habits: { done: 1, total: 4 }, skin: { pmDone: 1, pmTotal: 3 } };
    expect(ids({ hour: 14, ...snap })).toEqual([]);
    expect(ids({ hour: 19, ...snap })).toEqual(['habits']);
    expect(ids({ hour: 21, ...snap })).toEqual(['habits', 'skin-pm']);
    expect(nextMoves({ hour: 21, ...snap })[0].title).toBe('3 habits left today');
  });

  it('celebrates a finished fast and flags expired products', () => {
    expect(ids({ hour: 12, fast: { done: true, elapsedH: 17.4, targetHours: 16 } })).toContain('fast-done');
    const m = nextMoves({ hour: 12, supplies: { due: [], expiring: [{ name: 'Serum', daysLeft: -3 }, { name: 'SPF', daysLeft: 9 }] } });
    expect(m).toHaveLength(1);
    expect(m[0].title).toBe('Serum is past its use-by date');
  });

  it('caps the list at five, highest priority first', () => {
    const m = nextMoves({
      hour: 21, targets, eaten: { calories: 800, protein: 30 },
      supplies: { due: [{ name: 'Rice', daysToReorder: -1, status: 'out' }], expiring: [{ name: 'Serum', daysLeft: -1 }] },
      training: { isTrainingDay: true, trainedToday: false, label: 'Legs' },
      water: { advice: { status: 'behind', message: 'x' } }, sleep: { status: 'high', debtHours: 9 },
      weight: { hasGoal: true, daysSinceWeighIn: 9 }, habits: { done: 0, total: 3 }, skin: { pmDone: 0, pmTotal: 2 },
    });
    expect(m).toHaveLength(5);
    expect(m.map(x => x.priority)).toEqual([...m.map(x => x.priority)].sort((a, b) => b - a));
    expect(m[0].id).toBe('reorder');
  });
});
