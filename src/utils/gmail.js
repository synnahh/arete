// gmail.js — Gmail OAuth + email parsing for Finance auto-import
// Uses Gmail API with readonly scope. Token stored in Supabase user_meta.

import { supabase, getUserId } from '../supabase/supabase.js';
import { toLocalDateKey } from './localDate.js';

const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_KEY    = 'valerie_gmail_token';
const EXPIRY_KEY   = 'valerie_gmail_expiry';

// ─── OAuth helpers ────────────────────────────────────────────────────────────

export async function gmailLogin(googleClientId) {
  if (!googleClientId) throw new Error('Google OAuth Client ID not configured in Settings → Integrations');

  return new Promise((resolve, reject) => {
    const width  = 500, height = 650;
    const left   = Math.round(window.screen.width  / 2 - width  / 2);
    const top    = Math.round(window.screen.height / 2 - height / 2);

    const redirectUri = `${window.location.origin}/gmail-callback`;
    const state       = Math.random().toString(36).slice(2);

    const params = new URLSearchParams({
      client_id:     googleClientId,
      redirect_uri:  redirectUri,
      response_type: 'token',
      scope:         GMAIL_SCOPES,
      state,
      include_granted_scopes: 'true',
    });

    const popup = window.open(
      `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      'gmail_oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) { reject(new Error('Popup blocked — allow popups for this site')); return; }

    const timer = setInterval(() => {
      if (popup.closed) { clearInterval(timer); reject(new Error('Popup closed')); return; }
      try {
        const url  = popup.location.href;
        if (!url.startsWith(window.location.origin + '/gmail-callback')) return;
        const hash = new URLSearchParams(popup.location.hash.slice(1));
        const token  = hash.get('access_token');
        const expIn  = parseInt(hash.get('expires_in') || '3600', 10);
        if (token) {
          clearInterval(timer);
          popup.close();
          const expiry = Date.now() + expIn * 1000;
          localStorage.setItem(TOKEN_KEY,  token);
          localStorage.setItem(EXPIRY_KEY, String(expiry));
          // Persist to Supabase for cross-device
          persistGmailToken(token, expiry).catch(console.warn);
          resolve(token);
        }
      } catch (_) { /* cross-origin frame, keep polling */ }
    }, 300);

    setTimeout(() => {
      clearInterval(timer);
      if (!popup.closed) popup.close();
      reject(new Error('Gmail sign-in timed out'));
    }, 120_000);
  });
}

export function gmailDisconnect() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  getUserId().then(userId =>
    supabase.from('user_meta').delete().eq('user_id', userId).eq('key', 'gmail_token')
  ).catch(console.warn);
}

export function isGmailConnected() {
  const token  = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) || '0', 10);
  return !!token && Date.now() < expiry;
}

async function persistGmailToken(token, expiry) {
  const userId = await getUserId();
  await supabase.from('user_meta').upsert({
    user_id: userId,
    key: 'gmail_token',
    value: { token, expiry },
  }, { onConflict: 'user_id,key' });
}

async function getGmailToken() {
  const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) || '0', 10);
  if (Date.now() < expiry) return localStorage.getItem(TOKEN_KEY);

  // Try Supabase fallback
  try {
    const userId = await getUserId();
    const { data } = await supabase.from('user_meta')
      .select('value').eq('user_id', userId).eq('key', 'gmail_token').maybeSingle();
    if (data?.value?.token && Date.now() < data.value.expiry) {
      localStorage.setItem(TOKEN_KEY,  data.value.token);
      localStorage.setItem(EXPIRY_KEY, String(data.value.expiry));
      return data.value.token;
    }
  } catch (_) {}
  return null;
}

// ─── Gmail API ────────────────────────────────────────────────────────────────

async function gmailFetch(path, options = {}) {
  const token = await getGmailToken();
  if (!token) throw new Error('Gmail not connected');
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
  if (res.status === 401) { gmailDisconnect(); throw new Error('Gmail session expired — reconnect in Settings'); }
  if (!res.ok) throw new Error(`Gmail API ${res.status}`);
  return res.json();
}

// Fetch emails matching a query in the last N days
export async function fetchEmailsSince(days = 90, maxResults = 50) {
  const after = Math.floor((Date.now() - days * 86400000) / 1000);
  const query = encodeURIComponent(`after:${after}`);
  const list  = await gmailFetch(`/users/me/messages?q=${query}&maxResults=${maxResults}`);
  if (!list.messages?.length) return [];

  // Fetch each message (parallel, capped)
  const msgs = await Promise.all(
    list.messages.slice(0, maxResults).map(m =>
      gmailFetch(`/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`)
        .catch(() => null)
    )
  );
  return msgs.filter(Boolean);
}

// ─── Email parsing ────────────────────────────────────────────────────────────

// Default keyword rules — user can customise these in Settings
export const DEFAULT_EMAIL_RULES = [
  { id: 'xero_pay',     keyword: 'xero',           type: 'income',  category: 'income',    amountPattern: 'net pay|amount paid|total pay',    label: 'Xero Payslip'         },
  { id: 'salary',       keyword: 'salary',          type: 'income',  category: 'income',    amountPattern: 'amount|pay|salary',                label: 'Salary'               },
  { id: 'payslip',      keyword: 'payslip',         type: 'income',  category: 'income',    amountPattern: 'net|total|amount',                 label: 'Payslip'              },
  { id: 'paid',         keyword: 'you have been paid', type: 'income', category: 'income',  amountPattern: '\\$[\\d,\\.]+|£[\\d,\\.]+',       label: 'Payment Received'     },
  { id: 'invoice',      keyword: 'invoice',         type: 'expense', category: 'bills',     amountPattern: 'total|amount due|amount owing',    label: 'Invoice'              },
  { id: 'receipt',      keyword: 'receipt',         type: 'expense', category: 'shopping',  amountPattern: 'total|amount|order total',         label: 'Receipt'              },
  { id: 'bank_deposit', keyword: 'deposit',         type: 'income',  category: 'income',    amountPattern: 'amount|deposit|credited',          label: 'Bank Deposit'         },
  { id: 'transfer_in',  keyword: 'transfer received',type: 'income', category: 'income',    amountPattern: '\\$[\\d,\\.]+|£[\\d,\\.]+',       label: 'Transfer Received'    },
  { id: 'subscription', keyword: 'subscription',    type: 'expense', category: 'bills',     amountPattern: 'charged|billed|amount',            label: 'Subscription Charge'  },
  { id: 'direct_debit', keyword: 'direct debit',    type: 'expense', category: 'bills',     amountPattern: 'amount|debit|payment',             label: 'Direct Debit'         },
];

function getHeader(msg, name) {
  return msg.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function extractAmount(text) {
  // Match currency amounts: $1,234.56 or £1,234.56 or 1234.56
  const matches = text.match(/(?:\$|£|€|AUD\s*)[\d,]+\.?\d{0,2}|[\d,]+\.\d{2}/g);
  if (!matches) return null;
  // Find the largest plausible amount (not a date or zip code)
  const amounts = matches
    .map(m => parseFloat(m.replace(/[^\d.]/g, '')))
    .filter(n => n > 0.5 && n < 1_000_000);
  if (!amounts.length) return null;
  return Math.max(...amounts);
}

/**
 * Apply rules to a list of Gmail messages.
 * Returns detected transactions for user review.
 */
export function applyRulesToEmails(messages, rules = DEFAULT_EMAIL_RULES) {
  const detected = [];

  for (const msg of messages) {
    const subject = getHeader(msg, 'Subject').toLowerCase();
    const from    = getHeader(msg, 'From').toLowerCase();
    const date    = getHeader(msg, 'Date');
    const snippet = (msg.snippet || '').toLowerCase();
    const full    = `${subject} ${from} ${snippet}`;

    for (const rule of rules) {
      if (!rule.enabled !== false && rule.keyword) {
        const kw = rule.keyword.toLowerCase();
        if (full.includes(kw)) {
          const amount = extractAmount(full) || extractAmount(msg.snippet || '');
          detected.push({
            id:          `email_${msg.id}_${rule.id}`,
            messageId:   msg.id,
            subject:     getHeader(msg, 'Subject'),
            from:        getHeader(msg, 'From'),
            date:        date ? toLocalDateKey(new Date(date)) : toLocalDateKey(new Date()),
            ruleLabel:   rule.label,
            type:        rule.type,
            category:    rule.category,
            amount:      amount,
            description: rule.label + (getHeader(msg, 'Subject') ? ': ' + getHeader(msg, 'Subject').slice(0, 60) : ''),
            confirmed:   false,
          });
          break; // one rule per email
        }
      }
    }
  }

  // De-duplicate by messageId (keep first match)
  const seen = new Set();
  return detected.filter(d => { if (seen.has(d.messageId)) return false; seen.add(d.messageId); return true; });
}
