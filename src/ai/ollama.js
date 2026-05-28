// ─── Ollama local API (offline fallback) ──────────────────────────────────────
// Model: llama3 running on localhost:11434
// Used for simple/offline tasks when Claude is unavailable

const OLLAMA_BASE = 'http://localhost:11434';
const OLLAMA_MODEL = 'llama3';

const SYSTEM_PROMPT = `You are VALERIE — a calm, direct personal AI assistant.
Keep responses short and actionable. You help with tasks, reminders, planning, and quick lookups.`;

/**
 * Send a message to Ollama (local llama3)
 * @param {string} message — user message
 * @param {Array}  history — [{role:'user'|'assistant', content:string}]
 * @returns {Promise<string>} assistant reply text
 */
export async function askOllama(message, history = []) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-6),
    { role: 'user', content: message },
  ];

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error ${res.status}`);
  }

  const data = await res.json();
  return data.message?.content ?? '';
}

/**
 * Check if Ollama is running locally
 * @returns {Promise<boolean>}
 */
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

/**
 * Check if the llama3 model is available in Ollama
 * @returns {Promise<boolean>}
 */
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
