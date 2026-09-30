// Sends an SMS through Twilio, so the Twilio credentials live in Supabase secrets
// instead of app settings. The destination is a secret too: this function can
// only ever text the owner, whatever a caller sends.
//
// Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, SMS_TO (owner's number, +61...),
//          TWILIO_FROM_REMINDERS, TWILIO_FROM_SENTRY (optional; falls back to reminders).
// Request: POST { body: string (max 320 chars), channel?: 'reminders' | 'sentry' }
import { corsHeaders, json, signedInUser } from '../_shared/http.ts';

const MAX_BODY = 320;
const E164 = /^\+[1-9]\d{7,14}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!signedInUser(req.headers.get('Authorization'))) return json({ error: 'Authentication required' }, 401);

  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const to = Deno.env.get('SMS_TO') || '';
  if (!sid || !token || !E164.test(to)) return json({ error: 'SMS service is not configured' }, 503);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  if (body.mode === 'status') return json({ ok: true });

  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) return json({ error: 'Message is required' }, 400);
  if (text.length > MAX_BODY) return json({ error: 'Message is too long' }, 413);

  const reminders = Deno.env.get('TWILIO_FROM_REMINDERS') || '';
  const from = (body.channel === 'sentry' ? Deno.env.get('TWILIO_FROM_SENTRY') : '') || reminders;
  if (!E164.test(from)) return json({ error: 'No sender number configured' }, 503);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: text }).toString(),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    return json({ error: (detail as { message?: string })?.message || `Twilio error ${res.status}` }, 502);
  }
  return json({ ok: true });
});
