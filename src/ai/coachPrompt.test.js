import { describe, it, expect } from 'vitest';
import { detectTopics, situation, buildCoachBrief, PRINCIPLES } from './coachPrompt.js';

describe('detectTopics', () => {
  it('finds topics from the words', () => {
    expect(detectTopics('How much protein should I eat on a cut?')).toEqual(['nutrition']);
    expect(detectTopics('my bench has stalled for 3 sessions')).toEqual(['training']);
    expect(detectTopics('is retinol ok with my acne routine')).toEqual(expect.arrayContaining(['skin']));
    expect(detectTopics('I slept badly and feel tired')).toEqual(['sleep']);
  });

  it('does not match inside unrelated words', () => {
    expect(detectTopics('open the settings page')).toEqual([]);
    expect(detectTopics('book a restaurant table')).toEqual([]);
    expect(detectTopics('what is the weather')).toEqual([]);
  });

  it('adds the open screen as a topic, without duplicating', () => {
    expect(detectTopics('what should I do now', 'workout')).toEqual(['training']);
    expect(detectTopics('how many sets', 'workout')).toEqual(['training']);
    expect(detectTopics('hello', 'dashboard')).toEqual([]);
  });
});

describe('situation', () => {
  it('turns measured state into directives', () => {
    const s = situation({
      goal: 'cut', pace: { status: 'wrong-way' }, daysSinceWeighIn: 9, readiness: { band: 'go-easy', score: 31 },
      sleepDebt: 'high', stalledLifts: 2, skin: { steps: 4, trend: { status: 'ok', delta: -0.8 } },
    });
    expect(s.join(' ')).toMatch(/wrong way/);
    expect(s.join(' ')).toMatch(/9 days/);
    expect(s.join(' ')).toMatch(/Readiness is low \(31\)/);
    expect(s.join(' ')).toMatch(/Sleep debt is high/);
    expect(s.join(' ')).toMatch(/2 lifts are stalled/);
    expect(s.join(' ')).toMatch(/pausing the newest product/);
  });

  it('says nothing for an empty or null snapshot', () => {
    expect(situation({})).toEqual([]);
    expect(situation(null)).toEqual([]);
  });

  it('does not tell a bulker that fast weight change costs muscle', () => {
    expect(situation({ goal: 'bulk', pace: { status: 'too-fast' } }).join(' ')).not.toMatch(/muscle/);
    expect(situation({ goal: 'cut', pace: { status: 'too-fast' } }).join(' ')).toMatch(/muscle/);
  });

  it('suggests a starter routine only when there is none', () => {
    expect(situation({ skin: { steps: 0 } }).join(' ')).toMatch(/cleanser, moisturiser/);
    expect(situation({ skin: { steps: 3, trend: { status: 'insufficient' } } })).toEqual([]);
  });
});

describe('buildCoachBrief', () => {
  it('always carries the principles and the safety line', () => {
    const b = buildCoachBrief({ message: 'hi' });
    PRINCIPLES.forEach(p => expect(b).toContain(p));
    expect(b).toMatch(/not a doctor/);
    expect(b).not.toMatch(/METHOD FOR THIS QUESTION/);
    expect(b).not.toMatch(/WHAT THE DATA SAYS/);
  });

  it('adds only the methods for the topics touched', () => {
    const b = buildCoachBrief({ message: 'how many calories should I eat', snapshot: { readiness: { band: 'go-easy', score: 40 } } });
    expect(b).toMatch(/Mifflin-St Jeor/);
    expect(b).not.toMatch(/double progression/);
    expect(b).toMatch(/WHAT THE DATA SAYS RIGHT NOW/);
  });

  it('follows the personality and falls back for unknown ones', () => {
    expect(buildCoachBrief({ personality: 'drill sergeant' })).toMatch(/never insulting or shaming/);
    expect(buildCoachBrief({ personality: 'nonsense' })).toMatch(/measured and precise/);
  });
});
