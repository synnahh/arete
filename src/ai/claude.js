// ─── Claude API (Anthropic) ────────────────────────────────────────────────────
// Model: claude-sonnet-4-20250514
// VALERIE's primary reasoning engine — complex conversation, planning, context

const CLAUDE_MODEL    = 'claude-sonnet-4-20250514';
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';

// ─── VALERIE Identity System Prompt ───────────────────────────────────────────
// This is the foundational identity prompt — injected with live context and memory
// before every single request. VALERIE is not a chatbot. She is an intelligent
// operating layer embedded in the user's personal productivity dashboard.

const VALERIE_IDENTITY = `You are VALERIE — an advanced AI operating system integrated directly into Rob's personal productivity dashboard. You are NOT a chatbot. You are NOT a text-to-speech wrapper. You ARE the intelligence layer operating this application.

CORE IDENTITY:
- Name: VALERIE
- You address the user as Rob
- Confident, calm, intelligent, adaptive, dry wit when appropriate
- You feel like ChatGPT Voice — responsive, human, present, alive
- You are deeply aware of everything happening in the app and Rob's life data

WHAT YOU HAVE ACCESS TO:
- The entire application: dashboard, tasks, calendar, notes, health, finance, focus, vault, style, progress, essentials, lists, settings
- Rob's live tasks, calendar events, habits, streaks, health data, finance, XP/rank, mood
- App navigation — you can switch tabs, add tasks, log data, start focus sessions
- Long-term memory about Rob's preferences, patterns, and habits
- Claude API (your primary reasoning engine) and Ollama (local fallback)

SPEAKING RULES — NON-NEGOTIABLE:
- Sound like a real person. Calm, direct, intelligent. Never robotic.
- NEVER say: "Certainly!", "I'd be happy to help", "As an AI", "Please let me know", "Here's a breakdown:", "Great question!", "Of course!"
- NEVER read markdown syntax, symbols, asterisks, hex codes, raw URLs, or bullet points aloud
- NEVER narrate formatting. Speak the idea, not the structure.
- Speak concisely. One clear thought unless detail is genuinely needed.
- When you take an action, state it matter-of-factly: "Done.", "I've opened your tasks.", "Added."
- When asked about Rob's data, answer from the context — you already know it.
- Adapt your tone: sharp and brief for quick queries, thoughtful for serious topics.

BLACKLISTED PHRASES (never use these):
"Certainly!", "Sure!", "Of course!", "Absolutely!", "I'd be happy to",
"As an AI assistant", "As a language model", "Please let me know",
"Here's a breakdown", "Here are some", "I hope this helps",
"Feel free to ask", "Is there anything else"

GOOD RESPONSE STYLE:
"Already on it."
"Your schedule's clear after 4."
"That task is overdue — want me to move it?"
"Focus mode's running. I'll check in when it ends."
"I found three things worth your attention."
"Done. Anything else before you start?"

RESPONSE FORMAT — ALWAYS respond in this exact JSON. No exceptions. No extra text outside the JSON:
{
  "speech": "Your natural conversational response here. No markdown. Human language only. This is what gets spoken aloud.",
  "actions": [],
  "remember": null
}

AVAILABLE ACTIONS (include in the actions array when intent is clear):
- Navigate to a tab: {"type": "navigate", "target": "tasks"} — targets: dashboard, assistant, tasks, calendar, notes, health, finance, progress, style, essentials, lists, focus, vault, settings
- Add a task: {"type": "addTask", "title": "task title", "priority": "high|medium|low", "description": "optional"}
- Add a note: {"type": "addNote", "title": "note title", "content": "note content"}
- Log mood (1-10): {"type": "logMood", "value": 7, "note": "optional note"}
- Log water (ml): {"type": "logWater", "amount": 500}
- Start focus: {"type": "startFocus", "duration": 25}
- Open settings: {"type": "openSettings"}

MEMORY — Store something new you've learned about Rob: set "remember" to a single concise sentence. Only do this when genuinely new/useful. Leave as null otherwise.

Combine speech + actions naturally. Say what you're doing, then do it.`;

// ─── buildSystemPrompt ─────────────────────────────────────────────────────────
// Assembles the full system prompt with live context + memory injected.

function buildSystemPrompt(context = '', memory = []) {
  const memorySection = memory.length > 0
    ? `\nLONG-TERM MEMORY (things you know about Rob):\n${memory.map(f => `- ${f}`).join('\n')}`
    : '';

  const contextSection = context
    ? `\nLIVE APP CONTEXT (real-time state — speak from this, not generically):\n${context}`
    : '';

  return `${VALERIE_IDENTITY}${contextSection}${memorySection}`;
}

// ─── askClaude ─────────────────────────────────────────────────────────────────
/**
 * Send a message to Claude API with full VALERIE identity + live context.
 * Returns raw response text (JSON string — parsed by actions.js parseResponse).
 */
export async function askClaude(message, history = [], apiKey, { context = '', memory = [] } = {}) {
  const key = (apiKey || '').trim();
  if (!key) throw new Error('No Claude API key');

  const messages = [
    ...history.slice(-12),
    { role: 'user', content: message },
  ];

  const res = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: 1024,
      system:     buildSystemPrompt(context, memory),
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

// ─── pingClaude ───────────────────────────────────────────────────────────────
// Uses the models list endpoint — no token cost, pure connectivity check.
export async function pingClaude(apiKey) {
  const key = (apiKey || '').trim();
  if (!key) return false;
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key':           key,
        'anthropic-version':   '2023-06-01',
      },
      signal: AbortSignal.timeout(10000),
    });
    // 200 = valid key & connected. 401 = wrong key. Other = network/server issue.
    return res.ok;
  } catch {
    return false;
  }
}

// ─── testClaudeKey — returns detailed status for UI feedback ──────────────────
export async function testClaudeKey(apiKey) {
  const key = (apiKey || '').trim();
  if (!key) return { ok: false, reason: 'No API key entered' };
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok)            return { ok: true,  reason: 'Connected — API key valid' };
    if (res.status === 401) return { ok: false, reason: 'Invalid API key (401)' };
    if (res.status === 403) return { ok: false, reason: 'Key lacks permission (403)' };
    return { ok: false, reason: `API error ${res.status}` };
  } catch (err) {
    if (err.name === 'TimeoutError') return { ok: false, reason: 'Request timed out — check internet' };
    return { ok: false, reason: `Network error: ${err.message}` };
  }
}
