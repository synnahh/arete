import { describe, it, expect } from 'vitest';
import { ageFrom, bmr, maintenanceFrom, splitFor, fitDays, missingAnswers, planFromAnswers, baseTemplateFor } from './intake.js';
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

describe('a custom goal', () => {
  const custom = { ...answers, goal: 'custom', customText: 'Build muscle as fast as possible in a calorie deficit', customDeltaPct: -12, customProtein: 2.2, customFat: 0.9 };
  it('uses your own deficit and protein, not a template', () => {
    const p = planFromAnswers(custom, TODAY);
    expect(p.goal.template).toBe('cut');                      // only the label and direction
    expect(p.goal.customText).toMatch(/muscle/);
    expect(p.goal.custom).toEqual({ deltaPct: -12, proteinPerKg: 2.2, fatPerKg: 0.9 });
    expect(p.goal.targets.kcal).toBe(2430);                   // 2760 x 0.88, to the nearest 10
    expect(p.goal.targets.protein).toBe(175);                 // 80 kg x 2.2 = 176, to the nearest 5
    expect(p.goal.targets.weeklyRateKg).toBeCloseTo(-0.3, 1); // from the real calorie change
  });
  it('picks the direction from the sign of the change', () => {
    expect([-12, 0, 8].map(baseTemplateFor)).toEqual(['cut', 'recomp', 'bulk']);
  });
  it('asks for the calorie target when it is missing', () => {
    expect(missingAnswers({ ...custom, customDeltaPct: '' })).toContain('your calorie target for the custom goal');
  });
  it('warns when the deficit is too big to build muscle in or protein is too low', () => {
    expect(planFromAnswers({ ...custom, customDeltaPct: -24 }, TODAY).notes.join(' ')).toMatch(/slows muscle gain/);
    expect(planFromAnswers({ ...custom, customProtein: 1.4 }, TODAY).notes.join(' ')).toMatch(/protein under/);
  });
  it('holds an out-of-range change at the limit and says so', () => {
    const p = planFromAnswers({ ...custom, customDeltaPct: -40 }, TODAY);
    expect(p.goal.custom.deltaPct).toBe(-25);
    expect(p.notes.join(' ')).toMatch(/outside what the app allows/);
  });
  it('can name its own training week', () => {
    expect(planFromAnswers({ ...custom, days: 5, splitTemplate: 'upperFrame' }, TODAY).split).toMatchObject({ templateId: 'upperFrame', days: 5 });
    expect(planFromAnswers({ ...custom, days: 5, splitTemplate: 'nonsense' }, TODAY).split.templateId).toBe('bro');
  });
});

describe("Rob's answers from his guides", () => {
  it('give a deficit in the size the guides call a mini-cut, with the guides protein', async () => {
    const { ROB_GUIDE_ANSWERS } = await import('./guideAnswers.js');
    const p = planFromAnswers({ ...ROB_GUIDE_ANSWERS, birthDate: '2005-03-01' }, TODAY);
    expect(p.missing).toBeUndefined();
    expect(p.maintenance.age).toBe(21);
    expect(p.maintenance.kcal).toBe(2390);                  // close to the guides' 2,300 trial intake
    expect(p.goal.targets.kcal).toBe(2100);                 // about 300 below, the guides' mini-cut size
    expect(p.goal.targets.protein).toBe(155);               // inside the guides' 145 to 160 g
    expect(p.goal.targets.weeklyRateKg).toBeCloseTo(-0.26, 2);
    expect(p.split).toMatchObject({ templateId: 'upperFrame', days: 5 });
    expect(p.goal.customText).toMatch(/muscle as fast as possible/);
    expect(p.notes.join(' ')).toMatch(/Right shoulder/);
  });
  it('leaves the birth date for him, since the guides only say 21', async () => {
    const { ROB_GUIDE_ANSWERS } = await import('./guideAnswers.js');
    expect(ROB_GUIDE_ANSWERS.birthDate).toBeUndefined();
    expect(planFromAnswers(ROB_GUIDE_ANSWERS, TODAY).missing).toContain('your birth date');
  });
});
