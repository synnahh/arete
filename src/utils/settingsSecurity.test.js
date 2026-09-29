import { describe, expect, it } from 'vitest';
import { settingsForSync, stripLegacyClaudeKeys } from './settingsSecurity.js';

describe('settings security', () => {
  it('removes legacy Claude credentials from local settings', () => {
    expect(stripLegacyClaudeKeys({ theme: 'obsidian', apiKey: 'a', claudeApiKey: 'b', claudeKey: 'c' }))
      .toEqual({ theme: 'obsidian' });
  });

  it('keeps preferences but strips provider credentials from synced settings', () => {
    const input = {
      theme: 'ember', finnhubKey: 'stock-secret', twilioAuthToken: 'sms-secret',
      voice: { provider: 'elevenlabs', elevenlabsKey: 'voice-secret', elevenlabsVoiceId: 'voice-id' },
    };
    expect(settingsForSync(input)).toEqual({
      theme: 'ember', voice: { provider: 'elevenlabs', elevenlabsVoiceId: 'voice-id' },
    });
    expect(input.voice.elevenlabsKey).toBe('voice-secret');
  });
});
