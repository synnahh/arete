// ─── twilio.js — SMS via Twilio REST API ──────────────────────────────────────
// Sends SMS through Twilio. Credentials (Account SID + Auth Token) are stored
// in Settings → Notifications and never sent to Firestore.
// Uses platformFetch so it works in both Tauri (bypasses CORS) and browser.

import { platformFetch } from './platform.js';
import { captureError }  from './sentry.js';

const TWILIO_BASE = 'https://api.twilio.com/2010-04-01';

/**
 * Send an SMS via Twilio.
 * @param {object} params
 * @param {string} params.to          — recipient phone number e.g. "+61412345678"
 * @param {string} params.from        — Twilio source number e.g. "+61400000001"
 * @param {string} params.body        — message body
 * @param {string} params.accountSid  — Twilio Account SID
 * @param {string} params.authToken   — Twilio Auth Token
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function sendSMS({ to, from, body, accountSid, authToken }) {
  if (!to || !from || !body || !accountSid || !authToken) {
    return { ok: false, error: 'Missing required Twilio credentials or phone numbers.' };
  }

  const url = `${TWILIO_BASE}/Accounts/${accountSid}/Messages.json`;
  const creds = btoa(`${accountSid}:${authToken}`);

  const params = new URLSearchParams({ To: to, From: from, Body: body });

  try {
    const res = await platformFetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg  = data?.message || `Twilio error ${res.status}`;
      captureError(new Error(msg), { source: 'twilio', status: res.status });
      return { ok: false, error: msg };
    }

    return { ok: true };
  } catch (err) {
    captureError(err, { source: 'twilio' });
    return { ok: false, error: err.message || 'Network error sending SMS' };
  }
}

/**
 * Send a test SMS so the user can verify credentials are correct.
 */
export async function sendTestSMS(settings) {
  const { twilioAccountSid, twilioAuthToken, twilioReminders, phoneNumber } = settings;
  return sendSMS({
    to:         phoneNumber,
    from:       twilioReminders,
    body:       'VALERIE — SMS is working correctly.',
    accountSid: twilioAccountSid,
    authToken:  twilioAuthToken,
  });
}
