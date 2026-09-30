// Client for the send-sms Supabase function, which holds the Twilio credentials so
// they need not live in the app. Returns a plain result and never throws: when the
// function is not deployed or not configured (404 / 503) it is remembered as
// unavailable for the session and the caller falls back to the older path.
import { supabase } from '../supabase/supabase.js';

const state = { sms: false };
export const __resetServerSms = () => { state.sms = false; };

const defaultInvoke = (name, options) => supabase.functions.invoke(name, options);
const statusOf = (error) => Number(error?.context?.status) || 0;
const isUnavailable = (status) => status === 404 || status === 503;

/**
 * { ok: true } when sent; { ok: false, unavailable: true } when the function is not set up
 * (use the old client-side path); { ok: false, error } when it was set up but refused.
 */
export async function sendServerSMS(body, channel = 'reminders', invoke = defaultInvoke) {
  if (state.sms) return { ok: false, unavailable: true };
  try {
    const { data, error } = await invoke('send-sms', { body: { body: String(body || '').slice(0, 320), channel } });
    if (error) {
      const status = statusOf(error);
      if (isUnavailable(status)) { state.sms = true; return { ok: false, unavailable: true }; }
      return { ok: false, error: error.message || `SMS error ${status || ''}`.trim() };
    }
    return data?.ok ? { ok: true } : { ok: false, error: data?.error || 'SMS failed' };
  } catch (err) {
    return { ok: false, error: err?.message || 'SMS failed' };
  }
}
