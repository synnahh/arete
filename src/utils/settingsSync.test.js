import { describe, it, expect } from 'vitest';
import { mergeRemoteSettings } from './settingsSync.js';

describe('mergeRemoteSettings', () => {
  it('ignores our own save coming back, whatever the key order', () => {
    const local = { stepGoal: 8000, train: { effort: 'rir' }, apiKey: 'local-secret', twilioAuthToken: 'x' };
    const remote = { train: { effort: 'rir' }, stepGoal: 8000 };
    expect(mergeRemoteSettings(local, remote)).toBeNull();
  });
  it('applies another device\'s change and keeps this device\'s local-only credentials', () => {
    const local = { stepGoal: 8000, finnhubKey: 'keep-me' };
    const merged = mergeRemoteSettings(local, { stepGoal: 9000, coachGoal: { template: 'recomp' } });
    expect(merged.stepGoal).toBe(9000);
    expect(merged.coachGoal.template).toBe('recomp');
    expect(merged.finnhubKey).toBe('keep-me');
  });
  it('rejects junk and never lets a legacy Claude key in', () => {
    expect(mergeRemoteSettings({}, null)).toBeNull();
    expect(mergeRemoteSettings({}, [1, 2])).toBeNull();
    expect(mergeRemoteSettings({}, { apiKey: 'sk-ant', stepGoal: 1 }).apiKey).toBeUndefined();
  });
  it('works from an empty local', () => {
    expect(mergeRemoteSettings(undefined, { stepGoal: 5000 })).toEqual({ stepGoal: 5000 });
  });
});
