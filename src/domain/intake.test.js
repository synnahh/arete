import { describe, it, expect } from 'vitest';
import { ageFrom, bmr, maintenanceFrom, splitFor, fitDays, missingAnswers, planFromAnswers } from './intake.js';
import { buildFromTemplate } from './splits.js';
import { paceRows } from './goals.js';

const TODAY = '2026-10-12';
const answers = {
  goal: 'cut', pace: 'normal', birthDate: '1996-03-20', sex: 'male', heightCm: 180, weightKg: 80, targetWeightKg: 74,
  activity: 'moderate', experience: 'intermediate', days: 4, equipment: 'gym', sleepHours: 8,
  limitations: 'left shoulder', skinType: 'oily', skinConcerns: ['acne'], skinAvoid: 'fragrance',
};

describe('body maths', () => {
  it('works out age on the right side of the birthday', () => {
    expect(ageFrom('1996-03-20', TODAY)).toBe(30);
    expect(ageFrom('1996-10-13', TODAY)).toBe(29);
    expect(ageFrom('1996-10-12', TODAY)).toBe(30);
    expect(ageFrom('nope', TODAY)).toBeNull();
    expect(ageFrom('2026-01-01', TODAY)).toBeNull();
  });
  it('Mifflin-St Jeor for a man and a woman', () => {
    expect(bmr({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' })).toBe(1780);
    expect(bmr({ weightKg: 60, heightCm: 165, age: 28, sex: 'female' })).toBeCloseTo(1330.25, 2);
    expect(bmr({ weightKg: 0, heightCm: 180, age: 30, sex: 'male' })).toBeNull();
  });
  it('maintenance is resting energy times the activity factor, to the nearest 10', () => {
    expect(maintenanceFrom({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' }, 'moderate')).toBe(2760);
    expect(maintenanceFrom({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' }, 'nope')).toBeNull();
  });
});

describe('training week', () => {
  it('picks a split from the days you have', () => {
    expect([2, 3, 4, 5, 6].map(n => splitFor(n, 'intermediate'))).toEqual(['fullBody', 'fullBody', 'upperLower', 'bro', 'ppl']);
    expect(splitFor(5, 'beginner')).toBe('ppl');
    expect(splitFor(7)).toBeNull();
  });
  it('trims a week to the days you asked for, spread out', () => {
    const { days } = buildFromTemplate('fullBody', []);
    const two = fitDays(days, 2);
    expect(Object.values(two).filter(d => d.splitType !== 'rest')).toHaveLength(2);
    expect(two.mon.splitType).not.toBe('rest');
    expect(two.fri.splitType).not.toBe('rest');
    expect(fitDays(days, 3)).toBe(days);
  });
});

describe('the plan', () => {
  it('asks for what is missing instead of guessing', () => {
    expect(missingAnswers({})).toContain('your birth date');
    expect(planFromAnswers({ ...answers, heightCm: '' }, TODAY).missing).toContain('your height');
    expect(planFromAnswers({ ...answers, goal: 'nonsense' }, TODAY).missing).toEqual(['a goal']);
  });
  it('builds the goal, targets and split from the answers', () => {
    const p = planFromAnswers(answers, TODAY);
    expect(p.maintenance).toMatchObject({ kcal: 2760, age: 30, source: 'formula' });
    expect(p.goal).toMatchObject({ template: 'cut', pace: 'normal', startWeightKg: 80, targetWeightKg: 74, maintenanceSource: 'formula' });
    expect(p.goal.targets.kcal).toBe(2210);          // 2760 x 0.8, rounded to 10
    expect(p.split).toEqual({ templateId: 'upperLower', label: 'Upper / Lower', days: 4 });
    expect(p.equipment).toMatchObject({ preset: 'gym', gym: 'commercial' });
    expect(p.skinProfile).toEqual({ type: 'oily', concerns: ['acne'], avoid: 'fragrance' });
    expect(p.sleepNeedHours).toBe(8);
    expect(p.notes.join(' ')).toMatch(/left shoulder/);
  });
  it('a faster pace lowers calories more, a slower one less, and recomp ignores pace', () => {
    const kcal = (pace, goal = 'cut') => planFromAnswers({ ...answers, goal, pace }, TODAY).goal.targets.kcal;
    expect(kcal('slow')).toBeGreaterThan(kcal('normal'));
    expect(kcal('fast')).toBeLessThan(kcal('normal'));
    expect(kcal('aggressive')).toBeLessThan(kcal('fast'));
    expect(kcal('aggressive', 'recomp')).toBe(kcal('slow', 'recomp'));
  });
  it('flags a goal weight that points the wrong way', () => {
    expect(planFromAnswers({ ...answers, targetWeightKg: 85 }, TODAY).notes.join(' ')).toMatch(/not below/);
    expect(planFromAnswers({ ...answers, goal: 'bulk', targetWeightKg: 75 }, TODAY).notes.join(' ')).toMatch(/not above/);
  });
  it('shows the weekly change each pace gives', () => {
    const rows = paceRows('cut', 80);
    expect(rows.map(r => r.id)).toEqual(['slow', 'normal', 'fast', 'aggressive']);
    expect(rows[1].weeklyRateKg).toBe(-0.6);
    expect(rows[3].discouraged).toBe(true);
    expect(paceRows('cut', 0)).toEqual([]);
  });
});
