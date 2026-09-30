import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../supabase/supabase.js', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
import { fetchServerTTS, sendServerSMS, __resetServerVoice } from './serverVoice.js';

const httpError = (status) => ({ data: null, error: { message: 'x', context: { status } } });
beforeEach(() => __resetServerVoice());

describe('fetchServerTTS', () => {
  it('returns an audio/mpeg blob on success', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: new Blob([new Uint8Array([1, 2, 3])]), error: null });
    const b = await fetchServerTTS('hello', 'abcdefghij12', invoke);
    expect(b.type).toBe('audio/mpeg');
    expect(b.size).toBe(3);
    expect(invoke).toHaveBeenCalledWith('voice-tts', { body: { text: 'hello', voiceId: 'abcdefghij12' } });
  });

  it('returns null and stops asking for the session once the function is missing or unconfigured', async () => {
    const invoke = vi.fn().mockResolvedValue(httpError(503));
    expect(await fetchServerTTS('hi', null, invoke)).toBeNull();
    expect(await fetchServerTTS('hi again', null, invoke)).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('keeps trying after a transient failure and never throws', async () => {
    const invoke = vi.fn().mockResolvedValueOnce(httpError(500)).mockRejectedValueOnce(new Error('net')).mockResolvedValue({ data: new Blob(['a']), error: null });
    expect(await fetchServerTTS('a', null, invoke)).toBeNull();
    expect(await fetchServerTTS('a', null, invoke)).toBeNull();
    expect(await fetchServerTTS('a', null, invoke)).not.toBeNull();
  });

  it('ignores empty text and empty audio', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: new Blob([]), error: null });
    expect(await fetchServerTTS('   ', null, invoke)).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
    expect(await fetchServerTTS('hi', null, invoke)).toBeNull();
  });
});

describe('sendServerSMS', () => {
  it('reports success', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    expect(await sendServerSMS('hello', 'sentry', invoke)).toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledWith('send-sms', { body: { body: 'hello', channel: 'sentry' } });
  });

  it('flags an unavailable function once so the caller can fall back, and stops calling it', async () => {
    const invoke = vi.fn().mockResolvedValue(httpError(404));
    expect(await sendServerSMS('a', 'reminders', invoke)).toEqual({ ok: false, unavailable: true });
    expect(await sendServerSMS('b', 'reminders', invoke)).toEqual({ ok: false, unavailable: true });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('distinguishes a refusal from an unavailable function', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { message: 'Twilio error 400', context: { status: 502 } } });
    const r = await sendServerSMS('a', 'reminders', invoke);
    expect(r.ok).toBe(false);
    expect(r.unavailable).toBeUndefined();
    expect(r.error).toMatch(/Twilio/);
  });
});
