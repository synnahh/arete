import { describe, it, expect } from 'vitest';
import { needsConfirmation, isSafeSettingKey, isSafeSettingValue, describeAction } from './confirm.js';

describe('needsConfirmation', () => {
  it('holds setting changes and lets logging through', () => {
    expect(needsConfirmation({ type: 'changeSetting' })).toBe(true);
    expect(needsConfirmation({ type: 'toggleSetting' })).toBe(true);
    for (const type of ['logWater', 'logCalories', 'logSleep', 'logMood', 'addTask', 'addNote', 'navigate']) {
      expect(needsConfirmation({ type })).toBe(false);
    }
    expect(needsConfirmation(null)).toBe(false);
  });
});

describe('isSafeSettingKey', () => {
  it('accepts ordinary names', () => {
    for (const k of ['waterGoal', 'animationIntensity', 'orbShape', 'currency', 'macroGoal']) expect(isSafeSettingKey(k)).toBe(true);
  });
  it('refuses secrets, locks and odd shapes', () => {
    for (const k of ['apiKey', 'finnhubKey', 'twilioSid', 'authToken', 'userPin', 'pinCode', 'password', 'secret', 'ELEVENLABS_KEY', '__proto__', 'a.b', '', '1abc', 'x'.repeat(50), undefined, 5]) {
      expect(isSafeSettingKey(k)).toBe(false);
    }
  });
});

describe('isSafeSettingValue', () => {
  it('allows plain values only', () => {
    expect(isSafeSettingValue(true)).toBe(true);
    expect(isSafeSettingValue(2500)).toBe(true);
    expect(isSafeSettingValue('obsidian')).toBe(true);
    expect(isSafeSettingValue({ calories: 1 })).toBe(false);
    expect(isSafeSettingValue([1])).toBe(false);
    expect(isSafeSettingValue(null)).toBe(false);
    expect(isSafeSettingValue(NaN)).toBe(false);
    expect(isSafeSettingValue('x'.repeat(500))).toBe(false);
  });
});

describe('describeAction', () => {
  it('says what will change and from what', () => {
    expect(describeAction({ type: 'changeSetting', key: 'orbShape', value: 'cube' }, { orbShape: 'sphere' }))
      .toEqual({ title: 'Change "orbShape" to "cube"?', detail: 'Currently "sphere".' });
    expect(describeAction({ type: 'changeSetting', key: 'waterGoal', value: 3000 }, {}))
      .toEqual({ title: 'Change "waterGoal" to 3000?', detail: 'Currently not set.' });
    expect(describeAction({ type: 'toggleSetting', key: 'sounds' }, { sounds: true }))
      .toEqual({ title: 'Turn "sounds" off?', detail: 'Currently on.' });
  });
  it('returns null for anything that must not run', () => {
    expect(describeAction({ type: 'changeSetting', key: 'apiKey', value: 'x' })).toBeNull();
    expect(describeAction({ type: 'changeSetting', key: 'coachGoal', value: { a: 1 } })).toBeNull();
    expect(describeAction({ type: 'toggleSetting', key: 'currency' }, { currency: 'AUD' })).toBeNull();
    expect(describeAction({ type: 'logWater' })).toBeNull();
  });
});
