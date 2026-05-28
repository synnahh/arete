// ─── Claude API (Anthropic) ────────────────────────────────────────────────────
// Model: claude-sonnet-4-20250514
// Used for complex reasoning, multi-step tasks, nuanced responses

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are VALERIE — a highly capable, calm, and direct personal AI assistant.
You help with tasks, planning, health, finance, focus, and daily life.
Keep responses concise and actionable unless detail is explicitly needed.
You speak to your user like a trusted partner — intelligent, confident, never sycophantic.`;

/**
 * Send a message to Claude API
 * @param {string} message — user message
 * @param {Array}  history — [{role:'user'|'assistant', content:string}]
 * @param {string} apiKey  — Anthropic API key
 * @returns {Promise<string>} assistant reply text
 */
export async function askClaude(message, history = [], apiKey) {
  if (!apiKey) throw new Error('No Claude API key');

  const messages = [
    ...history.slice(-12), // keep last 12 messages for context window
    { role: 'user', content: message },
  ];

  const res = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Claude API error ${res.status}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

/**
 * Check if Claude API is reachable and key is valid
 * @param {string} apiKey
 * @returns {Promise<boolean>}
 */
export async function pingClaude(apiKey) {
  if (!apiKey) return false;
  try {
    const res = await fetch(CLAUDE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok || res.status === 400; // 400 = key valid but bad request — still connected
  } catch {
    return false;
  }
}
