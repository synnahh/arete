// ─── Ollama — local AI (secondary brain / offline fallback) ───────────────────
// VALERIE's local systems layer. Fast, offline, free.
// Used when Claude is unavailable, or for quick local utility tasks.
// Ollama models are less reliable at JSON formatting, so we use a lighter
// prompt and fall back to plain text if JSON parsing fails.

const OLLAMA_BASE  = 'http://localhost:11434';
const OLLAMA_MODEL = 'llama3';

// Lighter identity prompt for Ollama — it's the local backup brain
const OLLAMA_SYSTEM = `You are VALERIE, a calm and direct AI assistant for Rob's personal productivity dashboard.
Keep responses short and natural. Speak like a real person — no markdown, no symbols, no filler phrases.
When possible, respond in this JSON format: {"speech": "your response here", "actions": []}
If you cannot format as JSON, just respond naturally in plain text.`;

// ─── askOllama ─────────────────────────────────────────────────────────────────
export async function askOllama(message, history = [], { context = '' } = {}) {
  const systemContent = context
    ? `${OLLAMA_SYSTEM}\n\nCurrent context:\n${context}`
    : OLLAMA_SYSTEM;

  const messages = [
    { role: 'system',    content: systemContent },
    ...history.slice(-6),
    { role: 'user',      content: message },
  ];

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:    OLLAMA_MODEL,
      messages,
      stream:   false,
    }),
  });

  if (!res.ok) throw new Error(`Ollama error ${res.status}`);

  const data = await res.json();
  return data.message?.content ?? '';
}

// ─── pingOllama ───────────────────────────────────────────────────────────────
export async function pingOllama() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── checkOllamaModel ─────────────────────────────────────────────────────────
export async function checkOllamaModel() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return (data.models ?? []).some(m => m.name?.startsWith('llama3'));
  } catch {
    return false;
  }
}
