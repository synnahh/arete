// Client for the voice-tts and send-sms Supabase functions, which hold the
// ElevenLabs and Twilio credentials so they need not live in the app. Both return
// a plain result and never throw: when a function is not deployed or not
// configured (404 / 503) it is remembered as unavailable for the session and the
// caller falls back to the older path.
import { supabase } from '../supabase/supabase.js';

const state = { tts: false, sms: false };
export const __resetServerVoice = () => { state.tts = false; state.sms = false; };

const defaultInvoke = (name, options) => supabase.functions.invoke(name, options);
const statusOf = (error) => Number(error?.context?.status) || 0;
const isUnavailable = (status) => status === 404 || status === 503;

/** MP3 bytes as a Blob, or null (unavailable, refused or failed; the caller falls back). */
export async function fetchServerTTS(text, voiceId, invoke = defaultInvoke) {
  if (state.tts || !text?.trim()) return null;
  try {
    const { data, error } = await invoke('voice-tts', { body: { text: text.slice(0, 1500), ...(voiceId ? { voiceId } : {}) } });
    if (error) { if (isUnavailable(statusOf(error))) state.tts = true; return null; }
    if (data instanceof Blob && data.size > 0) return new Blob([data], { type: 'audio/mpeg' });
    return null;
  } catch { return null; }
}

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
