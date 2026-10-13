import { describe, it, expect } from 'vitest';
import { scoreMuscles, standardFor, gradeRatio, levelWords, rankFor, RANKS } from './muscleScore.js';

const M = ['chest', 'triceps', 'shoulders', 'back', 'biceps', 'quads', 'glutes', 'hamstrings', 'calves', 'forearms'];
const TODAY = '2026-10-13';
const ago = (n) => { const d = new Date(Date.UTC(2026, 9, 13) - n * 86400000); return d.toISOString().slice(0, 10); };
const bench = (n, weight, reps = 5, sets = 3) => ({ date: ago(n), exerciseName: 'Bench Press', muscles: ['chest', 'triceps', 'shoulders'], sets: Array.from({ length: sets }, () => ({ weight, reps })) });

describe('strength standards', () => {
  it('matches each lift to the right standard', () => {
    expect(standardFor('Bench Press').id).toBe('bench');
    expect(standardFor('DB Bench Press').id).toBe('db-bench');
    expect(standardFor('DB Shoulder Press').id).toBe('db-shoulder');
    expect(standardFor('Barbell Squat').id).toBe('squat');
    expect(standardFor('Bulgarian Split Squat')).toBeNull();
    expect(standardFor('Romanian Deadlift').id).toBe('rdl');
    expect(standardFor('Deadlift').id).toBe('deadlift');
    expect(standardFor('Lat Pulldown').id).toBe('pulldown');
    expect(standardFor('Pull-ups').id).toBe('pullup');
    expect(standardFor('Leg Curl').id).toBe('leg-curl');
    expect(standardFor('DB Curl').id).toBe('db-curl');
    expect(standardFor('Cable Fly')).toBeNull();
  });

  it('grades a bodyweight ratio 20 points per level', () => {
    const t = [0.5, 0.75, 1.0, 1.5, 2.0];
    expect(gradeRatio(0.25, t)).toBe(10);
    expect(gradeRatio(0.5, t)).toBe(20);
    expect(gradeRatio(1.0, t)).toBe(60);
    expect(gradeRatio(1.25, t)).toBe(70);
    expect(gradeRatio(2.4, t)).toBe(100);
    expect(levelWords(1.25, t)).toBe('between intermediate and advanced');
  });
});

describe('ranks', () => {
  it('cannot run ahead of training history', () => {
    expect(rankFor(95, 0).id).toBe('untrained');
    expect(rankFor(95, 3).id).toBe('developing');
    expect(rankFor(95, 10).id).toBe('intermediate');
    expect(rankFor(95, 25).id).toBe('advanced');
    expect(rankFor(95, 45).id).toBe('elite');
    expect(rankFor(10, 45).id).toBe('beginner');
    expect(RANKS.map(r => r.id)).toEqual(['untrained', 'beginner', 'developing', 'intermediate', 'advanced', 'elite']);
  });
});

describe('scoreMuscles', () => {
  it('gives nothing to a muscle with no sets', () => {
    const s = scoreMuscles([], { today: TODAY, bodyweight: 80, muscles: M });
    expect(s.chest.score).toBe(0);
    expect(s.chest.rank.id).toBe('untrained');
    expect(s.chest.tip).toMatch(/Log a set/);
  });

  it('grades strength against bodyweight, and helpers at 75%', () => {
    // 100 kg x 1 = 100 kg e1RM, 1.25x of 80 kg: halfway intermediate-advanced = 70.
    const s = scoreMuscles([{ date: ago(1), exerciseName: 'Bench Press', muscles: ['chest', 'triceps'], sets: [{ weight: 100, reps: 1 }] }], { today: TODAY, bodyweight: 80, muscles: M });
    expect(s.chest.parts.strength.score).toBe(70);
    expect(s.chest.parts.strength.ratio).toBe(1.25);
    expect(s.triceps.parts.strength.score).toBe(53);
  });

  it('leaves strength out (and says why) without a bodyweight', () => {
    const s = scoreMuscles([bench(1, 80)], { today: TODAY, bodyweight: null, muscles: M });
    expect(s.chest.parts.strength.score).toBeNull();
    expect(s.chest.parts.strength.detail).toMatch(/bodyweight/);
    expect(s.chest.score).toBeGreaterThan(0);
  });

  it('counts weekly hard sets against the guide target, helpers at half', () => {
    // Two bench days in the last week, 3 sets each, over a 4-week history: 6 chest sets / 4 weeks.
    const logs = [bench(1, 80), bench(4, 80), bench(27, 80)];
    const s = scoreMuscles(logs, { today: TODAY, bodyweight: 80, muscles: M });
    expect(s.chest.parts.volume.perWeek).toBe(2.3);   // 9 sets over 4 weeks
    expect(s.chest.parts.volume.target).toBe(12);
    expect(s.triceps.parts.volume.perWeek).toBe(1.1); // helper: 4.5 sets over 4 weeks
  });

  it('rewards beating older bests and marks a slide', () => {
    const up = scoreMuscles([bench(70, 80), bench(5, 88)], { today: TODAY, bodyweight: 80, muscles: M });
    expect(up.chest.parts.progression.change).toBeCloseTo(10, 0);
    expect(up.chest.parts.progression.score).toBe(100);
    const down = scoreMuscles([bench(70, 80), bench(5, 76)], { today: TODAY, bodyweight: 80, muscles: M });
    expect(down.chest.parts.progression.score).toBe(25);
  });

  it('needs sessions six weeks apart before judging progression', () => {
    const s = scoreMuscles([bench(3, 80), bench(1, 82.5)], { today: TODAY, bodyweight: 80, muscles: M });
    expect(s.chest.parts.progression.score).toBeNull();
  });

  it('rates consistency by weeks hit, two days a week being full', () => {
    const logs = [];
    for (let w = 0; w < 8; w++) logs.push(bench(w * 7 + 1, 80), bench(w * 7 + 3, 80));
    const s = scoreMuscles(logs, { today: TODAY, bodyweight: 80, muscles: M });
    expect(s.chest.parts.consistency.score).toBe(100);
    expect(s.chest.parts.consistency.weeksHit).toBe(8);
  });

  it('caps a strong newcomer at Developing until the days are in', () => {
    const s = scoreMuscles([{ date: ago(1), exerciseName: 'Bench Press', muscles: ['chest'], sets: [{ weight: 160, reps: 1 }, { weight: 150, reps: 1 }] }], { today: TODAY, bodyweight: 80, muscles: M });
    expect(s.chest.rank.id).toBe('developing');
    expect(s.chest.capped).toBe(true);
    expect(s.chest.tip).toMatch(/8 training days/);
  });

  it('counts old strength at 85% once you stop', () => {
    const s = scoreMuscles([{ date: ago(200), exerciseName: 'Bench Press', muscles: ['chest'], sets: [{ weight: 100, reps: 1 }] }], { today: TODAY, bodyweight: 80, muscles: M });
    expect(s.chest.parts.strength.e1rm).toBe(85);
    expect(s.chest.parts.strength.detail).toMatch(/85%/);
  });

  it('adds bodyweight to pull-ups', () => {
    const s = scoreMuscles([{ date: ago(1), exerciseName: 'Pull-ups', muscles: ['back', 'biceps'], sets: [{ weight: 0, reps: 10 }] }], { today: TODAY, bodyweight: 80, muscles: M });
    expect(s.back.parts.strength.ratio).toBe(1.33);
  });

  it('ignores logs dated in the future', () => {
    const s = scoreMuscles([{ date: '2026-12-01', exerciseName: 'Bench Press', muscles: ['chest'], sets: [{ weight: 100, reps: 5 }] }], { today: TODAY, bodyweight: 80, muscles: M });
    expect(s.chest.days).toBe(0);
  });
});
