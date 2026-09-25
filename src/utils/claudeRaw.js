// claudeRaw.js — Direct Claude API call with custom system prompt
// Used by Mind tab advisors, forecasting, analysis — bypasses VALERIE identity format.
// Returns plain text (not VALERIE JSON).

import { platformFetch } from './platform.js';
import { storage, STORAGE_KEYS } from './storage.js';

const CLAUDE_MODEL    = 'claude-sonnet-4-20250514';
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';

export async function askClaudeRaw(userMessage, systemPrompt, history = []) {
  const settings = storage.get(STORAGE_KEYS.SETTINGS, {});
  const key = (settings.claudeKey || import.meta.env.VITE_CLAUDE_API_KEY || '').trim();
  if (!key) throw new Error('No Claude API key — add it in Settings → AI');

  const messages = [
    ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const res = await platformFetch(CLAUDE_ENDPOINT, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: 2048,
      system:     systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Claude ${res.status}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}
