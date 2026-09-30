import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../supabase/supabase.js', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
import { sendServerSMS, __resetServerSms } from './serverSms.js';

const httpError = (status) => ({ data: null, error: { message: 'x', context: { status } } });
beforeEach(() => __resetServerSms());

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
